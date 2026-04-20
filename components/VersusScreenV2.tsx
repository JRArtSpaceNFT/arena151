/**
 * VersusScreen V2 - Server-authoritative opponent display
 * 
 * CRITICAL: Only renders with validated canonical payload
 * No GENERIC_RIVAL fallbacks - server data only
 */

'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useArenaStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { CanonicalMatchPayload, validateCanonicalPayload } from '@/lib/types/canonical-match'

export default function VersusScreenV2() {
  const { setScreen } = useArenaStore()
  const [payload, setPayload] = useState<CanonicalMatchPayload | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadPayload()
  }, [])

  const loadPayload = async () => {
    try {
      // Get match ID from store or URL
      const matchId = sessionStorage.getItem('arena_matchId')
      if (!matchId) {
        setError('No active match')
        return
      }

      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setError('Not authenticated')
        return
      }

      const res = await fetch(`/api/match/${matchId}/canonical`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      })

      if (!res.ok) {
        setError('Failed to load match')
        return
      }

      const data = await res.json()
      const validationError = validateCanonicalPayload(data)
      if (validationError) {
        setError(`Invalid match data: ${validationError}`)
        return
      }

      setPayload(data)

      // Auto-transition to arena reveal after 3 seconds
      setTimeout(() => {
        setScreen('game')
      }, 3000)

    } catch (err) {
      console.error('[VersusV2] Error:', err)
      setError('Failed to load match')
    }
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-center">
          <div className="text-red-400 text-xl mb-4">❌ {error}</div>
          <button
            onClick={() => setScreen('room-select')}
            className="px-6 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg"
          >
            Back to Room Select
          </button>
        </div>
      </div>
    )
  }

  if (!payload) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-white text-xl">Loading match...</div>
      </div>
    )
  }

  const myData = payload.myRole === 'player_a' ? payload.playerA : payload.playerB
  const opponentData = payload.opponent

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 overflow-hidden">
      <div className="w-full max-w-6xl px-4">
        <motion.div
          className="grid grid-cols-3 gap-8 items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {/* Player 1 */}
          <motion.div
            className="text-center"
            initial={{ x: -100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <div className="text-6xl mb-4">🎮</div>
            <div className="text-2xl font-bold text-white mb-2">
              {myData.username}
            </div>
            <div className="text-slate-400">
              Trainer: {myData.trainerId}
            </div>
          </motion.div>

          {/* VS */}
          <motion.div
            className="text-center"
            initial={{ scale: 0 }}
            animate={{ scale: 1, rotate: [0, 5, -5, 0] }}
            transition={{ delay: 0.5, duration: 0.5 }}
          >
            <div className="text-8xl font-black text-yellow-400 drop-shadow-[0_0_30px_rgba(251,191,36,0.5)]">
              VS
            </div>
          </motion.div>

          {/* Player 2 */}
          <motion.div
            className="text-center"
            initial={{ x: 100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <div className="text-6xl mb-4">⚔️</div>
            <div className="text-2xl font-bold text-white mb-2">
              {opponentData.username}
            </div>
            <div className="text-slate-400">
              Trainer: {opponentData.trainerId}
            </div>
          </motion.div>
        </motion.div>

        {/* Match details */}
        <motion.div
          className="text-center mt-12"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 }}
        >
          <div className="text-slate-400 mb-2">Entry Fee</div>
          <div className="text-2xl font-bold text-yellow-400">
            {payload.entryFeeSol} SOL
          </div>
          <div className="text-sm text-slate-500 mt-2">
            Match ID: {payload.matchId.slice(0, 8)}...
          </div>
        </motion.div>
      </div>
    </div>
  )
}
