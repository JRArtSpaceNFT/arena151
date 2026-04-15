'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '@/lib/game-store'
import { playMusic, resumeAudioContext } from '@/lib/audio/musicEngine'
import { CREATURES } from '@/lib/data/creatures'
import type { Creature, PokemonType } from '@/lib/game-types'

// ── CONSTANTS ────────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  normal: '#9ca3af', fire: '#f97316', water: '#3b82f6', electric: '#eab308',
  grass: '#22c55e', ice: '#67e8f9', fighting: '#dc2626', poison: '#a855f7',
  ground: '#a16207', flying: '#818cf8', psychic: '#ec4899', bug: '#84cc16',
  rock: '#78716c', ghost: '#6d28d9', dragon: '#7c3aed', dark: '#374151', steel: '#94a3b8',
}

const TEAM_SIZE = 5
const BUDGET = 75
const DRAFT_TIME = 120

// ── POKEMON CARD ─────────────────────────────────────────────────────────────

interface PokemonCardProps {
  creature: Creature
  isSelected: boolean
  isAffordable: boolean
  onClick: () => void
  onHover: (creature: Creature | null) => void
}

function PokemonCard({ creature, isSelected, isAffordable, onClick, onHover }: PokemonCardProps) {
  const mainType = creature.types[0]
  const typeColor = TYPE_COLORS[mainType] || '#888'

  return (
    <motion.div
      whileHover={isAffordable ? { scale: 1.05, y: -4 } : {}}
      whileTap={isAffordable ? { scale: 0.98 } : {}}
      onClick={isAffordable ? onClick : undefined}
      onMouseEnter={() => onHover(creature)}
      onMouseLeave={() => onHover(null)}
      style={{
        position: 'relative',
        background: isSelected 
          ? `linear-gradient(135deg, ${typeColor}44, ${typeColor}22)` 
          : 'rgba(15, 23, 42, 0.8)',
        border: isSelected 
          ? `3px solid ${typeColor}` 
          : `2px solid ${isAffordable ? 'rgba(255,255,255,0.15)' : 'rgba(100,100,100,0.2)'}`,
        borderRadius: 16,
        padding: 16,
        cursor: isAffordable ? 'pointer' : 'not-allowed',
        opacity: isAffordable ? 1 : 0.4,
        backdropFilter: 'blur(12px)',
        boxShadow: isSelected 
          ? `0 8px 24px ${typeColor}88, inset 0 1px 0 rgba(255,255,255,0.2)` 
          : '0 2px 8px rgba(0,0,0,0.4)',
        transition: 'all 0.2s ease',
      }}
    >
      {/* Cost badge */}
      <div style={{
        position: 'absolute',
        top: 8,
        right: 8,
        background: isAffordable ? typeColor : '#555',
        color: '#fff',
        fontWeight: 900,
        fontSize: 14,
        padding: '4px 10px',
        borderRadius: 8,
        boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
      }}>
        {creature.pointCost}
      </div>

      {/* Sprite */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: 96,
        marginBottom: 8,
      }}>
        <img 
          src={creature.spriteUrl} 
          alt={creature.name}
          style={{
            width: 80,
            height: 80,
            imageRendering: 'pixelated',
            filter: isSelected ? `drop-shadow(0 0 12px ${typeColor})` : 'none',
          }}
        />
      </div>

      {/* Name */}
      <div style={{
        fontSize: 15,
        fontWeight: 700,
        color: isSelected ? typeColor : '#fff',
        textAlign: 'center',
        marginBottom: 6,
        textShadow: '0 1px 2px rgba(0,0,0,0.8)',
      }}>
        {creature.name}
      </div>

      {/* Types */}
      <div style={{
        display: 'flex',
        gap: 4,
        justifyContent: 'center',
        flexWrap: 'wrap',
      }}>
        {creature.types.map(type => (
          <div
            key={type}
            style={{
              background: TYPE_COLORS[type],
              color: '#000',
              fontSize: 10,
              fontWeight: 700,
              padding: '3px 8px',
              borderRadius: 6,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            {type}
          </div>
        ))}
      </div>

      {/* Selected checkmark */}
      {isSelected && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          style={{
            position: 'absolute',
            top: -8,
            left: -8,
            background: typeColor,
            color: '#000',
            width: 32,
            height: 32,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 18,
            fontWeight: 900,
            boxShadow: `0 4px 12px ${typeColor}aa`,
          }}
        >
          ✓
        </motion.div>
      )}
    </motion.div>
  )
}

// ── TEAM SLOT ────────────────────────────────────────────────────────────────

function TeamSlot({ creature, index }: { creature: Creature | null; index: number }) {
  if (!creature) {
    return (
      <div style={{
        background: 'rgba(255,255,255,0.03)',
        border: '2px dashed rgba(255,255,255,0.15)',
        borderRadius: 12,
        padding: 12,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: 80,
        color: '#555',
        fontSize: 12,
        fontWeight: 600,
      }}>
        Slot {index + 1}
      </div>
    )
  }

  const typeColor = TYPE_COLORS[creature.types[0]] || '#888'

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      style={{
        background: `linear-gradient(135deg, ${typeColor}33, ${typeColor}11)`,
        border: `2px solid ${typeColor}`,
        borderRadius: 12,
        padding: 12,
        display: 'flex',
        gap: 12,
        alignItems: 'center',
        boxShadow: `0 4px 12px ${typeColor}44`,
      }}
    >
      <img 
        src={creature.spriteUrl} 
        alt={creature.name}
        style={{
          width: 56,
          height: 56,
          imageRendering: 'pixelated',
        }}
      />
      <div style={{ flex: 1 }}>
        <div style={{
          fontSize: 14,
          fontWeight: 700,
          color: typeColor,
          marginBottom: 4,
        }}>
          {creature.name}
        </div>
        <div style={{
          fontSize: 11,
          color: '#999',
          fontWeight: 600,
        }}>
          {creature.pointCost} pts • {creature.types.join('/')}
        </div>
      </div>
    </motion.div>
  )
}

// ── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function DraftV2() {
  const {
    draftTeamA, draftBudgetA, draftBudgetB, 
    p1Trainer, p2Trainer, isP1Turn,
    addToDraft, removeFromDraft,
    autoDraftPick, confirmDraftOrder, navigateTo,
  } = useGameStore()

  const [hoveredCreature, setHoveredCreature] = useState<Creature | null>(null)
  const [timeLeft, setTimeLeft] = useState(DRAFT_TIME)
  const [selectedFilter, setSelectedFilter] = useState<PokemonType | 'all'>('all')

  const currentTrainer = isP1Turn ? p1Trainer : p2Trainer
  const opponentTrainer = isP1Turn ? p2Trainer : p1Trainer
  const currentBudget = draftBudgetA
  const draftTeam = draftTeamA
  const selectedIds = new Set(draftTeam.map(c => c.id))

  useEffect(() => {
    playMusic('draft')
    resumeAudioContext()
  }, [])

  // Timer
  useEffect(() => {
    if (timeLeft <= 0) return
    const t = setTimeout(() => setTimeLeft(prev => prev - 1), 1000)
    return () => clearTimeout(t)
  }, [timeLeft])

  const handleSelect = useCallback((creature: Creature) => {
    if (selectedIds.has(creature.id)) {
      removeFromDraft(creature.id)
    } else if (draftTeam.length < TEAM_SIZE && creature.pointCost <= currentBudget) {
      addToDraft(creature)
    }
  }, [selectedIds, draftTeam.length, currentBudget, addToDraft, removeFromDraft])

  // Filter creatures
  const filteredCreatures = CREATURES.filter(c => 
    selectedFilter === 'all' || c.types.includes(selectedFilter)
  )

  const canLockIn = draftTeam.length === TEAM_SIZE

  return (
    <div style={{
      height: '100dvh',
      background: 'linear-gradient(180deg, #0a0a0f 0%, #1a1a2e 100%)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* ── TOP BAR ──────────────────────────────────────────────────────── */}
      <div style={{
        background: 'rgba(15, 23, 42, 0.9)',
        borderBottom: '2px solid rgba(255,255,255,0.1)',
        padding: '16px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backdropFilter: 'blur(16px)',
        flexShrink: 0,
      }}>
        {/* Left: Trainers */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            fontSize: 18,
            fontWeight: 700,
            color: currentTrainer?.color,
          }}>
            {currentTrainer?.name}
          </div>
          <div style={{
            fontSize: 14,
            color: '#666',
            fontWeight: 600,
          }}>
            vs
          </div>
          <div style={{
            fontSize: 18,
            fontWeight: 700,
            color: opponentTrainer?.color,
            opacity: 0.5,
          }}>
            {opponentTrainer?.name}
          </div>
        </div>

        {/* Center: Timer */}
        <div style={{
          fontSize: 32,
          fontWeight: 900,
          color: timeLeft < 30 ? '#ef4444' : '#fff',
          fontFamily: 'monospace',
          textShadow: timeLeft < 30 ? '0 0 16px #ef4444' : 'none',
        }}>
          {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
        </div>

        {/* Right: Actions */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => autoDraftPick()}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: '2px solid rgba(255,255,255,0.2)',
              borderRadius: 12,
              padding: '10px 20px',
              color: '#fff',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Auto Pick
          </motion.button>

          <motion.button
            whileHover={canLockIn ? { scale: 1.05 } : {}}
            whileTap={canLockIn ? { scale: 0.95 } : {}}
            onClick={() => canLockIn && confirmDraftOrder()}
            disabled={!canLockIn}
            style={{
              background: canLockIn 
                ? `linear-gradient(135deg, ${currentTrainer?.color}, ${currentTrainer?.color}cc)` 
                : 'rgba(100,100,100,0.3)',
              border: canLockIn ? `2px solid ${currentTrainer?.color}` : '2px solid #555',
              borderRadius: 12,
              padding: '10px 24px',
              color: canLockIn ? '#000' : '#666',
              fontSize: 16,
              fontWeight: 900,
              cursor: canLockIn ? 'pointer' : 'not-allowed',
              boxShadow: canLockIn ? `0 4px 16px ${currentTrainer?.color}66` : 'none',
            }}
          >
            Lock In Team
          </motion.button>
        </div>
      </div>

      {/* ── MAIN CONTENT: 2-PANEL LAYOUT ────────────────────────────────── */}
      <div style={{
        flex: 1,
        display: 'flex',
        overflow: 'hidden',
      }}>
        {/* ── LEFT PANEL: POKEMON GRID ──────────────────────────────────── */}
        <div style={{
          flex: '0 0 67%',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          padding: 24,
          gap: 16,
        }}>
          {/* Type filters */}
          <div style={{
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
          }}>
            <button
              onClick={() => setSelectedFilter('all')}
              style={{
                background: selectedFilter === 'all' ? '#fff' : 'rgba(255,255,255,0.1)',
                color: selectedFilter === 'all' ? '#000' : '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '6px 12px',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              All
            </button>
            {['fire', 'water', 'electric', 'grass', 'psychic', 'dragon'].map(type => (
              <button
                key={type}
                onClick={() => setSelectedFilter(type as PokemonType)}
                style={{
                  background: selectedFilter === type ? TYPE_COLORS[type] : 'rgba(255,255,255,0.1)',
                  color: selectedFilter === type ? '#000' : '#fff',
                  border: 'none',
                  borderRadius: 8,
                  padding: '6px 12px',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                }}
              >
                {type}
              </button>
            ))}
          </div>

          {/* Pokemon grid */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
            gap: 16,
            alignContent: 'start',
            padding: 4,
          }}>
            {filteredCreatures.map(creature => (
              <PokemonCard
                key={creature.id}
                creature={creature}
                isSelected={selectedIds.has(creature.id)}
                isAffordable={creature.pointCost <= currentBudget || selectedIds.has(creature.id)}
                onClick={() => handleSelect(creature)}
                onHover={setHoveredCreature}
              />
            ))}
          </div>
        </div>

        {/* ── RIGHT PANEL: TEAM BUILDER ─────────────────────────────────── */}
        <div style={{
          flex: '0 0 33%',
          background: 'rgba(15, 23, 42, 0.9)',
          borderLeft: '2px solid rgba(255,255,255,0.1)',
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
          overflow: 'auto',
          backdropFilter: 'blur(16px)',
        }}>
          {/* Budget */}
          <div>
            <div style={{
              fontSize: 12,
              color: '#999',
              fontWeight: 600,
              marginBottom: 8,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
            }}>
              Points Remaining
            </div>
            <div style={{
              fontSize: 48,
              fontWeight: 900,
              color: currentBudget < 10 ? '#ef4444' : '#fff',
              fontFamily: 'monospace',
              textShadow: currentBudget < 10 ? '0 0 16px #ef4444' : 'none',
            }}>
              {currentBudget}
            </div>
          </div>

          {/* Team count */}
          <div>
            <div style={{
              fontSize: 12,
              color: '#999',
              fontWeight: 600,
              marginBottom: 8,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
            }}>
              Team
            </div>
            <div style={{
              fontSize: 24,
              fontWeight: 700,
              color: draftTeam.length === TEAM_SIZE ? '#22c55e' : '#fff',
            }}>
              {draftTeam.length} / {TEAM_SIZE}
            </div>
          </div>

          {/* Team slots */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}>
            {Array.from({ length: TEAM_SIZE }).map((_, i) => (
              <TeamSlot key={i} creature={draftTeam[i] || null} index={i} />
            ))}
          </div>

          {/* Hovered creature detail */}
          {hoveredCreature && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                background: `linear-gradient(135deg, ${TYPE_COLORS[hoveredCreature.types[0]]}22, ${TYPE_COLORS[hoveredCreature.types[0]]}11)`,
                border: `2px solid ${TYPE_COLORS[hoveredCreature.types[0]]}`,
                borderRadius: 12,
                padding: 16,
                marginTop: 'auto',
              }}
            >
              <div style={{
                fontSize: 16,
                fontWeight: 700,
                color: TYPE_COLORS[hoveredCreature.types[0]],
                marginBottom: 8,
              }}>
                {hoveredCreature.name}
              </div>
              <div style={{
                fontSize: 12,
                color: '#ccc',
                marginBottom: 8,
              }}>
                HP {hoveredCreature.baseHp} • ATK {hoveredCreature.baseAtk} • DEF {hoveredCreature.baseDef} • SPE {hoveredCreature.baseSpe}
              </div>
              <div style={{
                fontSize: 11,
                color: '#999',
                fontStyle: 'italic',
              }}>
                {hoveredCreature.passive.description}
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}
