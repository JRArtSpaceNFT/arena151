/**
 * PreMatchTeamBuilder - Build and lock team BEFORE joining paid PVP
 * 
 * Required for server-authoritative matchmaking:
 * - User selects trainer
 * - Picks 6 pokemon
 * - Sets battle order
 * - Locks team via /api/team/lock
 * - Only then can proceed to room-select
 */

'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Lock, ArrowLeft } from 'lucide-react'
import { useArenaStore } from '@/lib/store'
import { CREATURES } from '@/lib/data/creatures'
import { TRAINERS } from '@/lib/data/trainers'
import TeamLockFlow from '@/components/TeamLockFlow'

export default function PreMatchTeamBuilder() {
  const { setScreen } = useArenaStore()
  const [selectedTrainerId, setSelectedTrainerId] = useState<string | null>(null)
  const [selectedTeam, setSelectedTeam] = useState<number[]>([])
  const [lockedOrder, setLockedOrder] = useState<number[]>([])
  const [showLockModal, setShowLockModal] = useState(false)

  const togglePokemon = (id: number) => {
    if (selectedTeam.includes(id)) {
      setSelectedTeam(selectedTeam.filter(p => p !== id))
      // Remove from order too
      setLockedOrder(lockedOrder.filter(idx => selectedTeam[idx] !== id))
    } else if (selectedTeam.length < 6) {
      setSelectedTeam([...selectedTeam, id])
    }
  }

  const moveUp = (index: number) => {
    if (index === 0) return
    const newOrder = [...lockedOrder]
    ;[newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]]
    setLockedOrder(newOrder)
  }

  const moveDown = (index: number) => {
    if (index === lockedOrder.length - 1) return
    const newOrder = [...lockedOrder]
    ;[newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]]
    setLockedOrder(newOrder)
  }

  const canLock = selectedTrainerId && selectedTeam.length === 6 && lockedOrder.length === 6

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => setScreen('draft-mode-intro')}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition"
          >
            <ArrowLeft size={20} />
            Back
          </button>
          <h1 className="text-2xl font-bold text-white">Build Your Team</h1>
          <div className="w-20" />
        </div>

        {/* Trainer Selection */}
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-6 mb-6">
          <h2 className="text-xl font-bold text-white mb-4">1. Choose Your Trainer</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.values(TRAINERS).map(trainer => (
              <button
                key={trainer.id}
                onClick={() => setSelectedTrainerId(trainer.id)}
                className={`p-4 rounded-xl border-2 transition ${
                  selectedTrainerId === trainer.id
                    ? 'border-yellow-400 bg-yellow-400/20'
                    : 'border-slate-600 hover:border-slate-500'
                }`}
              >
                <div className="text-4xl mb-2">👤</div>
                <div className="text-white font-bold text-sm">{trainer.name}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Pokemon Selection */}
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-6 mb-6">
          <h2 className="text-xl font-bold text-white mb-4">
            2. Pick 6 Pokémon ({selectedTeam.length}/6)
          </h2>
          <div className="grid grid-cols-3 md:grid-cols-6 lg:grid-cols-8 gap-3 max-h-96 overflow-y-auto">
            {CREATURES.map(creature => (
              <button
                key={creature.id}
                onClick={() => togglePokemon(creature.id)}
                disabled={selectedTeam.length >= 6 && !selectedTeam.includes(creature.id)}
                className={`p-3 rounded-lg border-2 transition ${
                  selectedTeam.includes(creature.id)
                    ? 'border-green-400 bg-green-400/20'
                    : selectedTeam.length >= 6
                    ? 'border-slate-700 bg-slate-800/30 opacity-50 cursor-not-allowed'
                    : 'border-slate-600 hover:border-slate-500'
                }`}
              >
                <div className="text-2xl mb-1">🐾</div>
                <div className="text-white text-xs font-bold truncate">{creature.name}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Battle Order */}
        {selectedTeam.length === 6 && (
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-6 mb-6">
            <h2 className="text-xl font-bold text-white mb-4">3. Set Battle Order</h2>
            {lockedOrder.length === 0 && (
              <button
                onClick={() => setLockedOrder(selectedTeam.map((_, i) => i))}
                className="w-full py-3 bg-blue-500 hover:bg-blue-600 rounded-xl text-white font-bold transition"
              >
                Use Current Order
              </button>
            )}
            {lockedOrder.length > 0 && (
              <div className="space-y-2">
                {lockedOrder.map((idx, position) => {
                  const creature = CREATURES.find(c => c.id === selectedTeam[idx])
                  return (
                    <div key={position} className="flex items-center gap-4 bg-slate-700/50 p-3 rounded-lg">
                      <div className="text-slate-400 font-bold w-8">#{position + 1}</div>
                      <div className="text-2xl">🐾</div>
                      <div className="flex-1 text-white font-bold">{creature?.name}</div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => moveUp(position)}
                          disabled={position === 0}
                          className="px-3 py-1 bg-slate-600 hover:bg-slate-500 disabled:opacity-30 rounded text-white text-sm"
                        >
                          ↑
                        </button>
                        <button
                          onClick={() => moveDown(position)}
                          disabled={position === lockedOrder.length - 1}
                          className="px-3 py-1 bg-slate-600 hover:bg-slate-500 disabled:opacity-30 rounded text-white text-sm"
                        >
                          ↓
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Lock Team Button */}
        <button
          onClick={() => setShowLockModal(true)}
          disabled={!canLock}
          className={`w-full py-4 rounded-xl font-bold text-lg transition flex items-center justify-center gap-2 ${
            canLock
              ? 'bg-yellow-400 hover:bg-yellow-500 text-slate-900'
              : 'bg-slate-700 text-slate-500 cursor-not-allowed'
          }`}
        >
          <Lock size={20} />
          {canLock ? 'Lock Team & Continue' : 'Complete All Steps to Lock'}
        </button>
      </div>

      {/* Lock Modal */}
      {showLockModal && canLock && (
        <div
          className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-4"
          onClick={() => setShowLockModal(false)}
        >
          <div onClick={(e) => e.stopPropagation()} className="max-w-md w-full">
            <TeamLockFlow
              trainerId={selectedTrainerId}
              team={selectedTeam}
              lockedOrder={lockedOrder}
              onLocked={() => {
                setShowLockModal(false)
                setScreen('room-select')
              }}
            />
            <button
              onClick={() => setShowLockModal(false)}
              className="mt-4 w-full py-3 bg-slate-700 hover:bg-slate-600 rounded-xl text-white"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
