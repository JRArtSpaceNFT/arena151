/**
 * ArenaReveal V2 - Server-authoritative arena display
 * 
 * Uses arenaId from canonical payload ONLY
 * Acks when animation completes
 * Waits for both players to ack before advancing
 */

'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useGameStore } from '@/lib/game-store'
import { useArenaStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { ARENAS } from '@/lib/data/arenas'
import { CanonicalMatchPayload } from '@/lib/types/canonical-match'

export default function ArenaRevealV2() {
  const { proceedFromArenaReveal } = useGameStore()
  const { setScreen } = useArenaStore()
  const [payload, setPayload] = useState<CanonicalMatchPayload | null>(null)
  const [arena, setArena] = useState<typeof ARENAS[0] | null>(null)
  const [isLocked, setIsLocked] = useState(false)
  const [waitingForOpponent, setWaitingForOpponent] = useState(false)

  useEffect(() => {
    loadAndRevealArena()
  }, [])

  const loadAndRevealArena = async () => {
    try {
      const matchId = sessionStorage.getItem('arena_matchId')
      if (!matchId) {
        console.error('[ArenaRevealV2] No match ID')
        return
      }

      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return

      // Fetch canonical payload
      const res = await fetch(`/api/match/${matchId}/canonical`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      })

      if (!res.ok) {
        console.error('[ArenaRevealV2] Failed to fetch payload')
        return
      }

      const data: CanonicalMatchPayload = await res.json()
      setPayload(data)

      // Get arena from server arenaId
      const arenaData = ARENAS.find(a => a.id === data.arenaId)
      if (!arenaData) {
        console.error('[ArenaRevealV2] Arena not found:', data.arenaId)
        return
      }

      setArena(arenaData)
      
      console.log('[ArenaRevealV2] Arena:', arenaData.name, '| Match:', matchId)

      // Start reveal animation
      setTimeout(() => {
        setIsLocked(true)
        // After animation, ack arena
        setTimeout(async () => {
          await ackArena(matchId, session.access_token)
        }, 2000)
      }, 3000)

    } catch (err) {
      console.error('[ArenaRevealV2] Error:', err)
    }
  }

  const ackArena = async (matchId: string, token: string) => {
    try {
      const res = await fetch(`/api/match/${matchId}/ack/arena`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      })

      if (res.ok) {
        const data = await res.json()
        console.log('[ArenaRevealV2] Arena ack:', data)

        if (data.bothAcked) {
          console.log('[ArenaRevealV2] Both players ready, proceeding to battle')
          setTimeout(() => {
            proceedFromArenaReveal()
          }, 1000)
        } else {
          console.log('[ArenaRevealV2] Waiting for opponent to acknowledge...')
          setWaitingForOpponent(true)
          pollForBattleReady(matchId, token)
        }
      }
    } catch (err) {
      console.error('[ArenaRevealV2] Failed to ack:', err)
    }
  }

  const pollForBattleReady = (matchId: string, token: string) => {
    let attempts = 0
    const poll = setInterval(async () => {
      attempts++
      if (attempts > 30) {
        clearInterval(poll)
        console.error('[ArenaRevealV2] Timeout waiting for opponent')
        return
      }

      try {
        const res = await fetch(`/api/match/${matchId}/canonical`, {
          headers: { 'Authorization': `Bearer ${token}` },
        })

        if (res.ok) {
          const data = await res.json()
          if (data.status === 'battle_ready') {
            clearInterval(poll)
            console.log('[ArenaRevealV2] Opponent ready, proceeding')
            proceedFromArenaReveal()
          }
        }
      } catch (err) {
        console.error('[ArenaRevealV2] Poll error:', err)
      }
    }, 1000)
  }

  if (!arena) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-900">
        <div className="text-white text-xl">Loading arena...</div>
      </div>
    )
  }

  return (
    <div className="h-screen flex items-center justify-center bg-slate-900 overflow-hidden">
      <div className="text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: isLocked ? 1 : 1.2 }}
          transition={{ duration: 0.5 }}
        >
          <div className="text-6xl mb-4">🏟️</div>
          <div className="text-4xl font-bold text-white mb-2">
            {arena.name}
          </div>
          {isLocked && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-yellow-400 text-2xl font-bold mt-4"
            >
              🔒 LOCKED IN
            </motion.div>
          )}
          {waitingForOpponent && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-slate-400 mt-4"
            >
              Waiting for opponent...
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  )
}
