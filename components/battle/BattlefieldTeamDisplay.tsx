'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Creature } from '@/lib/game-types'

const TYPE_COLORS: Record<string, string> = {
  normal: '#9ca3af', fire: '#f97316', water: '#3b82f6', electric: '#eab308',
  grass: '#22c55e', ice: '#67e8f9', fighting: '#dc2626', poison: '#a855f7',
  ground: '#a16207', flying: '#818cf8', psychic: '#ec4899', bug: '#84cc16',
  rock: '#78716c', ghost: '#6d28d9', dragon: '#7c3aed', dark: '#374151', steel: '#94a3b8',
}

interface FieldPosition {
  x: string // percentage
  y: string // percentage
  scale: number
}

// Position mapping: 1st = center, 2nd = bottom-left, 3rd = bottom-right, 4th = top-left, 5th = top-right
// Moved UP and LEFT to prevent squishing
const POSITIONS: FieldPosition[] = [
  { x: '42%', y: '35%', scale: 1.0 },    // 1st pick: CENTER (moved left + up)
  { x: '15%', y: '60%', scale: 1.0 },    // 2nd pick: BOTTOM LEFT (moved up)
  { x: '70%', y: '60%', scale: 1.0 },    // 3rd pick: BOTTOM RIGHT (moved left + up)
  { x: '15%', y: '12%', scale: 1.0 },    // 4th pick: TOP LEFT (moved up)
  { x: '70%', y: '12%', scale: 1.0 },    // 5th pick: TOP RIGHT (moved left + up)
]

interface BattlefieldTeamDisplayProps {
  team: Creature[]
  onSelectPokemon?: (creature: Creature | null) => void
}

export default function BattlefieldTeamDisplay({ team, onSelectPokemon }: BattlefieldTeamDisplayProps) {
  const [hoveredId, setHoveredId] = useState<number | null>(null)

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: '100%',
      overflow: 'hidden',
    }}>
      {/* Pure grass field background */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: '#7cb342',
        backgroundImage: 'url(/Grass-Field.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }} />

      {/* Pokemon positioned on field */}
      <AnimatePresence>
        {team.map((creature, index) => {
          const position = POSITIONS[index]
          if (!position) return null

          const typeColor = TYPE_COLORS[creature.types[0]] || '#888'
          const isHovered = hoveredId === creature.id

          return (
            <motion.div
              key={creature.id}
              initial={{ opacity: 0, scale: 0.5, y: 20 }}
              animate={{ 
                opacity: 1, 
                scale: 1.0,
                y: 0,
              }}
              exit={{ opacity: 0, scale: 0.5 }}
              transition={{ 
                type: 'spring',
                stiffness: 200,
                damping: 20,
                delay: index * 0.15,
              }}
              whileHover={{ scale: 1.08, y: -6 }}
              onMouseEnter={() => {
                setHoveredId(creature.id)
              }}
              onMouseLeave={() => {
                setHoveredId(null)
              }}
              onClick={() => onSelectPokemon?.(creature)}
              style={{
                position: 'absolute',
                left: position.x,
                top: position.y,
                transform: 'translate(-50%, -50%)',
                cursor: 'pointer',
                zIndex: isHovered ? 20 : 5,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
              }}
            >
              {/* Pokemon sprite */}
              <motion.div
                animate={{
                  filter: isHovered 
                    ? `drop-shadow(0 0 20px ${typeColor}) brightness(1.2)` 
                    : 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))',
                }}
                style={{
                  position: 'relative',
                }}
              >
                <img
                  src={creature.spriteUrl}
                  alt={creature.name}
                  style={{
                    width: 140,
                    height: 140,
                    imageRendering: 'pixelated',
                  }}
                />

                {/* Glow ring for hovered */}
                {isHovered && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 0.6, scale: 1 }}
                    style={{
                      position: 'absolute',
                      inset: -8,
                      borderRadius: '50%',
                      background: `radial-gradient(circle, ${typeColor}44 0%, transparent 70%)`,
                      pointerEvents: 'none',
                    }}
                  />
                )}
              </motion.div>

              {/* Pokeball */}
              <svg 
                width={18} 
                height={18} 
                viewBox="0 0 24 24"
                style={{
                  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))',
                }}
              >
                <circle cx="12" cy="12" r="11" fill="#ef4444" stroke="#000" strokeWidth="1.5"/>
                <circle cx="12" cy="12" r="11" fill="#f8f8f8" stroke="#000" strokeWidth="1.5" clipPath="inset(50% 0 0 0)"/>
                <line x1="1" y1="12" x2="23" y2="12" stroke="#000" strokeWidth="2"/>
                <circle cx="12" cy="12" r="4" fill="#f8f8f8" stroke="#000" strokeWidth="1.5"/>
                <circle cx="12" cy="12" r="2" fill={typeColor} />
              </svg>

              {/* Pokemon name */}
              <div
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  color: '#fff',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  textShadow: '0 2px 6px rgba(0,0,0,0.9)',
                  padding: '2px 5px',
                  background: isHovered 
                    ? `linear-gradient(135deg, ${typeColor}dd, ${typeColor}aa)` 
                    : 'rgba(0,0,0,0.75)',
                  borderRadius: 4,
                  border: isHovered ? `1px solid ${typeColor}` : '1px solid rgba(255,255,255,0.2)',
                  backdropFilter: 'blur(4px)',
                  whiteSpace: 'nowrap',
                  maxWidth: '120px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {creature.name}
              </div>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
