/**
 * TeamLockFlow - Mandatory team lock before joining paid PVP
 * 
 * User must:
 * 1. Select trainer
 * 2. Select 6 pokemon
 * 3. Set battle order
 * 4. Click "Lock Team" button
 * 
 * Only then can they join matchmaking
 */

'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Lock } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface TeamLockFlowProps {
  trainerId: string | null
  team: number[]
  lockedOrder: number[]
  onLocked: () => void
}

export default function TeamLockFlow({ trainerId, team, lockedOrder, onLocked }: TeamLockFlowProps) {
  const [isLocking, setIsLocking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canLock = trainerId && team.length === 6 && lockedOrder.length === 6

  const handleLock = async () => {
    if (!canLock) return

    setIsLocking(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setError('Not authenticated')
        setIsLocking(false)
        return
      }

      const res = await fetch('/api/team/lock', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          trainerId,
          team,
          lockedOrder,
        }),
      })

      if (!res.ok) {
        const errorData = await res.json()
        setError(errorData.error || 'Failed to lock team')
        setIsLocking(false)
        return
      }

      const data = await res.json()
      console.log('[TeamLock] Success:', data)
      
      onLocked()

    } catch (err) {
      console.error('[TeamLock] Error:', err)
      setError('Failed to lock team')
      setIsLocking(false)
    }
  }

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-4">
        <Lock className="text-yellow-400" size={24} />
        <h3 className="text-xl font-bold text-white">Lock Your Team</h3>
      </div>

      <div className="space-y-3 mb-6">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${trainerId ? 'bg-green-400' : 'bg-slate-600'}`} />
          <span className={trainerId ? 'text-white' : 'text-slate-400'}>
            Trainer selected {trainerId ? '✓' : ''}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${team.length === 6 ? 'bg-green-400' : 'bg-slate-600'}`} />
          <span className={team.length === 6 ? 'text-white' : 'text-slate-400'}>
            6 Pokémon selected {team.length === 6 ? '✓' : `(${team.length}/6)`}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${lockedOrder.length === 6 ? 'bg-green-400' : 'bg-slate-600'}`} />
          <span className={lockedOrder.length === 6 ? 'text-white' : 'text-slate-400'}>
            Battle order set {lockedOrder.length === 6 ? '✓' : ''}
          </span>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-700 rounded-lg p-3 mb-4 text-red-400 text-sm">
          {error}
        </div>
      )}

      <motion.button
        onClick={handleLock}
        disabled={!canLock || isLocking}
        className={`w-full py-3 rounded-xl font-bold transition ${
          canLock
            ? 'bg-yellow-400 hover:bg-yellow-500 text-slate-900'
            : 'bg-slate-700 text-slate-500 cursor-not-allowed'
        }`}
        whileHover={canLock ? { scale: 1.02 } : {}}
        whileTap={canLock ? { scale: 0.98 } : {}}
      >
        {isLocking ? 'Locking...' : 'Lock Team for PVP'}
      </motion.button>

      <p className="text-xs text-slate-500 text-center mt-3">
        Once locked, your team cannot be changed until after the match
      </p>
    </div>
  )
}
