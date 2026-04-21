/**
 * QueueScreen V2 - Server-authoritative matchmaking
 * 
 * Flow:
 * 1. Call /api/matchmaking/paid/join
 * 2. Receive canonical payload
 * 3. Validate payload
 * 4. If status='queueing', subscribe for updates
 * 5. If status='matched', ack and wait for arena_reveal
 * 6. Transition only when server says ready
 */

'use client'

import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useArenaStore } from '@/lib/store'
import { ROOM_TIERS } from '@/lib/constants'
import { supabase } from '@/lib/supabase'
import { CanonicalMatchPayload, validateCanonicalPayload } from '@/lib/types/canonical-match'

export default function QueueScreenV2() {
  const { queueState, cancelQueue, setScreen, currentTrainer } = useArenaStore()
  const [payload, setPayload] = useState<CanonicalMatchPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const tokenRef = useRef<string | null>(null)
  const hasJoinedRef = useRef(false)

  const room = queueState.roomId ? ROOM_TIERS[queueState.roomId] : null

  // Elapsed timer
  useEffect(() => {
    if (!queueState.searchStartTime) return
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - queueState.searchStartTime!) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [queueState.searchStartTime])

  // Main matchmaking effect
  useEffect(() => {
    if (!queueState.isSearching || !queueState.roomId) return
    if (hasJoinedRef.current) return
    hasJoinedRef.current = true

    const joinMatchmaking = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) {
          setError('Not authenticated')
          return
        }
        tokenRef.current = session.access_token

        const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
        const requestPayload = { roomId: queueState.roomId, requestId }
        
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        console.log('MATCHMAKING REQUEST ID:', requestId)
        console.log('MATCHMAKING REQUEST PAYLOAD:', requestPayload)

        const res = await fetch('/api/matchmaking/paid/join', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(requestPayload),
        })

        console.log('MATCHMAKING RESPONSE STATUS:', res.status)

        let data
        try {
          const rawText = await res.text()
          console.log('MATCHMAKING RESPONSE RAW JSON:', rawText)
          data = JSON.parse(rawText)
          console.log('MATCHMAKING RESPONSE AFTER NORMALIZATION:', JSON.stringify(data, null, 2))
        } catch (parseError) {
          console.error('Failed to parse response JSON:', parseError)
          setError(`Failed to parse server response (HTTP ${res.status})`)
          return
        }

        if (!res.ok) {
          // Throw detailed error using server-returned code and message
          const errorCode = data.code || data.error || 'UNKNOWN_ERROR'
          const errorMessage = data.message || data.error || 'Matchmaking failed'
          
          console.error(`MATCHMAKING ERROR [${errorCode}]:`, errorMessage)
          console.error('Full error details:', data)
          
          // Display detailed error on screen
          setError(`[${errorCode}] ${errorMessage}`)
          
          // Handle specific error codes
          if (errorCode === 'TEAM_NOT_LOCKED') {
            setTimeout(() => {
              cancelQueue()
              setScreen('draft-mode-intro')
            }, 3000)
            return
          }
          
          if (errorCode === 'INSUFFICIENT_FUNDS') {
            setTimeout(() => {
              cancelQueue()
              setScreen('room-select')
            }, 2000)
            return
          }
          
          // Don't proceed - error is already displayed
          return
        }

        console.log('[QueueV2] ✅ Matchmaking success:', data)

        // Validate payload
        const validationError = validateCanonicalPayload(data)
        console.log('MATCHMAKING VALIDATION RESULT:', validationError ? `FAILED: ${validationError}` : 'PASSED')
        if (validationError) {
          console.error('[QueueV2] Invalid payload:', validationError)
          console.error('Full payload that failed validation:', JSON.stringify(data, null, 2))
          setError(`Invalid match data: ${validationError}`)
          return
        }
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

        setPayload(data)

        // Handle different statuses
        if (data.status === 'queueing') {
          console.log('[QueueV2] Status=queueing, subscribing for updates...')
          subscribeToMatch(data.matchId)
        } else if (data.status === 'matched') {
          console.log('[QueueV2] Status=matched, acking and transitioning...')
          await ackMatched(data.matchId)
          // Wait for both acks then transition
          pollForArenaReveal(data.matchId)
        } else if (data.status === 'arena_reveal' || data.status === 'battle_ready') {
          console.log('[QueueV2] Match already advanced, transitioning...')
          setScreen('versus')
        }

      } catch (err) {
        console.error('[QueueV2] Error:', err)
        setError('Matchmaking failed')
      }
    }

    joinMatchmaking()

    return () => {
      if (channelRef.current) channelRef.current.unsubscribe()
    }
  }, [queueState.isSearching, queueState.roomId])

  const subscribeToMatch = (matchId: string) => {
    channelRef.current = supabase
      .channel(`match:${matchId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'matches',
          filter: `id=eq.${matchId}`,
        },
        async (update) => {
          console.log('[QueueV2] Match update:', update.new)
          const newStatus = update.new.status

          if (newStatus === 'matched') {
            console.log('[QueueV2] Opponent joined! Acking...')
            await ackMatched(matchId)
            pollForArenaReveal(matchId)
          } else if (newStatus === 'arena_reveal') {
            console.log('[QueueV2] Both players acked, transitioning to versus')
            if (channelRef.current) channelRef.current.unsubscribe()
            setScreen('versus')
          }
        }
      )
      .subscribe((status) => {
        console.log('[QueueV2] Subscription status:', status)
      })
  }

  const ackMatched = async (matchId: string) => {
    if (!tokenRef.current) return

    try {
      const res = await fetch(`/api/match/${matchId}/ack/matched`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${tokenRef.current}` },
      })

      if (res.ok) {
        const data = await res.json()
        console.log('[QueueV2] Matched ack response:', data)
        return data.bothAcked
      }
    } catch (err) {
      console.error('[QueueV2] Failed to ack matched:', err)
    }
    return false
  }

  const pollForArenaReveal = (matchId: string) => {
    let attempts = 0
    const poll = setInterval(async () => {
      attempts++
      if (attempts > 30) {
        clearInterval(poll)
        setError('Timed out waiting for opponent')
        return
      }

      try {
        const res = await fetch(`/api/match/${matchId}/canonical`, {
          headers: { 'Authorization': `Bearer ${tokenRef.current!}` },
        })

        if (res.ok) {
          const data = await res.json()
          if (data.status === 'arena_reveal' || data.status === 'battle_ready') {
            clearInterval(poll)
            setPayload(data)
            setScreen('versus')
          }
        }
      } catch (err) {
        console.error('[QueueV2] Poll error:', err)
      }
    }, 1000)
  }

  const handleCancel = () => {
    if (channelRef.current) channelRef.current.unsubscribe()
    // TODO: Call abandon endpoint if match was created
    cancelQueue()
    setScreen('room-select')
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
        <div className="text-center">
          <div className="text-red-400 text-xl mb-4">❌ {error}</div>
          <button
            onClick={handleCancel}
            className="px-6 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg"
          >
            Back to Room Select
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
      <div className="max-w-md w-full">
        <motion.div
          className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-8 text-center"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <div className="text-yellow-400 text-6xl mb-6">⚡</div>
          
          <h2 className="text-2xl font-bold text-white mb-2">
            {payload?.status === 'queueing' ? 'Searching for Opponent' : 'Match Found!'}
          </h2>
          
          <p className="text-slate-400 mb-6">
            {payload?.status === 'queueing' 
              ? 'Looking for a worthy rival...'
              : 'Syncing match data...'}
          </p>

          {room && (
            <div className="bg-slate-900/50 rounded-lg p-4 mb-6">
              <div className="text-sm text-slate-400 mb-1">Arena</div>
              <div className="text-white font-bold">{room.name}</div>
              <div className="text-sm text-yellow-400 mt-2">
                {room.entryFee} SOL entry
              </div>
            </div>
          )}

          <div className="text-sm text-slate-500 mb-4">
            {Math.floor(elapsed / 60)}:{(elapsed % 60).toString().padStart(2, '0')}
          </div>

          <motion.div
            className="w-full h-1 bg-slate-700 rounded-full overflow-hidden mb-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <motion.div
              className="h-full bg-yellow-400"
              animate={{ x: ['-100%', '100%'] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
            />
          </motion.div>

          <button
            onClick={handleCancel}
            className="flex items-center gap-2 mx-auto px-6 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white transition"
          >
            <X size={16} />
            Cancel Search
          </button>
        </motion.div>
      </div>
    </div>
  )
}
