'use client'

import { motion, AnimatePresence } from 'framer-motion'
import type { Creature } from '@/lib/game-types'

const TYPE_COLORS: Record<string, string> = {
  normal: '#9ca3af', fire: '#f97316', water: '#3b82f6', electric: '#eab308',
  grass: '#22c55e', ice: '#67e8f9', fighting: '#dc2626', poison: '#a855f7',
  ground: '#a16207', flying: '#818cf8', psychic: '#ec4899', bug: '#84cc16',
  rock: '#78716c', ghost: '#6d28d9', dragon: '#7c3aed', dark: '#374151', steel: '#94a3b8',
}

interface PokemonInfoPanelProps {
  creature: Creature | null
}

export default function PokemonInfoPanel({ creature }: PokemonInfoPanelProps) {
  if (!creature) {
    return (
      <div style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#64748b',
        fontSize: 14,
        fontStyle: 'italic',
      }}>
        Hover over a Pokémon to see details
      </div>
    )
  }

  const typeColor = TYPE_COLORS[creature.types[0]] || '#888'

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={creature.id}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        transition={{ duration: 0.2 }}
        style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          paddingBottom: 20,
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          paddingBottom: 16,
          borderBottom: `2px solid ${typeColor}44`,
        }}>
          <img
            src={creature.spriteUrl}
            alt={creature.name}
            style={{
              width: 80,
              height: 80,
              imageRendering: 'pixelated',
              filter: `drop-shadow(0 4px 12px ${typeColor}66)`,
            }}
          />
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: 24,
              fontWeight: 900,
              color: typeColor,
              marginBottom: 4,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              {creature.name}
            </div>
            <div style={{
              display: 'flex',
              gap: 6,
              flexWrap: 'wrap',
            }}>
              {creature.types.map(type => (
                <div
                  key={type}
                  style={{
                    background: TYPE_COLORS[type],
                    color: '#000',
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '4px 10px',
                    borderRadius: 6,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  {type}
                </div>
              ))}
            </div>
          </div>
          <div style={{
            background: typeColor,
            color: '#000',
            fontSize: 18,
            fontWeight: 900,
            padding: '8px 14px',
            borderRadius: 8,
            boxShadow: `0 4px 12px ${typeColor}66`,
          }}>
            {creature.pointCost}
          </div>
        </div>

        {/* Stats */}
        <div>
          <div style={{
            fontSize: 11,
            fontWeight: 700,
            color: '#94a3b8',
            marginBottom: 8,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}>
            Base Stats
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 10,
          }}>
            <StatBar label="HP" value={creature.baseHp} color="#22c55e" />
            <StatBar label="ATK" value={creature.baseAtk} color="#ef4444" />
            <StatBar label="DEF" value={creature.baseDef} color="#3b82f6" />
            <StatBar label="SPE" value={creature.baseSpe} color="#eab308" />
          </div>
        </div>

        {/* Passive Ability */}
        <div>
          <div style={{
            fontSize: 11,
            fontWeight: 700,
            color: '#94a3b8',
            marginBottom: 8,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}>
            Passive Ability
          </div>
          <div style={{
            background: `linear-gradient(135deg, ${typeColor}22, ${typeColor}11)`,
            border: `2px solid ${typeColor}44`,
            borderRadius: 8,
            padding: 12,
          }}>
            <div style={{
              fontSize: 13,
              fontWeight: 700,
              color: typeColor,
              marginBottom: 4,
            }}>
              {creature.passive.name}
            </div>
            <div style={{
              fontSize: 12,
              color: '#cbd5e1',
              lineHeight: 1.5,
            }}>
              {creature.passive.description}
            </div>
          </div>
        </div>

        {/* Move Pool */}
        <div>
          <div style={{
            fontSize: 11,
            fontWeight: 700,
            color: '#94a3b8',
            marginBottom: 8,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}>
            Move Pool
          </div>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 6,
          }}>
            {creature.movePool.map(move => (
              <div
                key={move}
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: 6,
                  padding: '6px 10px',
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#e2e8f0',
                  textTransform: 'capitalize',
                }}
              >
                {move.replace(/_/g, ' ')}
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

function StatBar({ label, value, color }: { label: string; value: number; color: string }) {
  const maxStat = 200
  const percentage = (value / maxStat) * 100

  return (
    <div>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: 4,
        fontSize: 11,
        fontWeight: 700,
      }}>
        <span style={{ color: '#94a3b8' }}>{label}</span>
        <span style={{ color }}>{value}</span>
      </div>
      <div style={{
        height: 8,
        background: 'rgba(255,255,255,0.08)',
        borderRadius: 4,
        overflow: 'hidden',
      }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          style={{
            height: '100%',
            background: `linear-gradient(90deg, ${color}, ${color}dd)`,
            borderRadius: 4,
          }}
        />
      </div>
    </div>
  )
}
