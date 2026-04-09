/**
 * Attack Trail - Motion blur and elemental trails for attacks
 * Creates visual feedback showing attack direction and element
 */

'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect } from 'react'

interface AttackTrailProps {
  element: string
  from: 'left' | 'right'
  power: number
  isActive: boolean
}

const ELEMENT_TRAILS: Record<string, { color: string; emoji: string }> = {
  fire: { color: '#FF6600', emoji: '🔥' },
  water: { color: '#0066CC', emoji: '💧' },
  electric: { color: '#FFFF00', emoji: '⚡' },
  grass: { color: '#22C55E', emoji: '🍃' },
  ice: { color: '#67E8F9', emoji: '❄️' },
  psychic: { color: '#EC4899', emoji: '✨' },
  fighting: { color: '#DC2626', emoji: '💥' },
  dark: { color: '#330033', emoji: '🌑' },
  dragon: { color: '#7C3AED', emoji: '🐉' },
  poison: { color: '#A855F7', emoji: '☠️' },
  ghost: { color: '#6D28D9', emoji: '👻' },
  steel: { color: '#94A3B8', emoji: '⚙️' },
  fairy: { color: '#FFCCFF', emoji: '🌸' },
}

export default function AttackTrail({ element, from, power, isActive }: AttackTrailProps) {
  const [trail, setTrail] = useState<{ id: string; x: number; y: number; delay: number }[]>([])
  const config = ELEMENT_TRAILS[element] || { color: '#FFFFFF', emoji: '💫' }

  useEffect(() => {
    if (!isActive) {
      setTrail([])
      return
    }

    // Create trail particles
    const particleCount = Math.min(Math.floor(power / 15), 12)
    const newTrail = Array.from({ length: particleCount }, (_, i) => ({
      id: `trail-${Date.now()}-${i}`,
      x: from === 'left' ? 10 + (i * 80 / particleCount) : 90 - (i * 80 / particleCount),
      y: 45 + Math.random() * 10,
      delay: i * 50,
    }))

    setTrail(newTrail)

    const cleanup = setTimeout(() => setTrail([]), 1000)
    return () => clearTimeout(cleanup)
  }, [isActive, element, from, power])

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <AnimatePresence>
        {isActive && (
          <>
            {/* Main trail beam */}
            <motion.div
              initial={{
                opacity: 0,
                scaleX: 0,
                x: from === 'left' ? '0%' : '100%',
              }}
              animate={{
                opacity: [0, 0.8, 0.8, 0],
                scaleX: [0, 1, 1, 0],
              }}
              transition={{
                duration: 0.6,
                times: [0, 0.2, 0.7, 1],
                ease: 'easeOut',
              }}
              className="absolute top-1/2 -translate-y-1/2 h-2 blur-sm"
              style={{
                left: from === 'left' ? '10%' : 'auto',
                right: from === 'right' ? '10%' : 'auto',
                width: '80%',
                transformOrigin: from === 'left' ? 'left' : 'right',
                background: `linear-gradient(to ${from === 'left' ? 'right' : 'left'}, ${config.color}00, ${config.color}, ${config.color}00)`,
                boxShadow: `0 0 20px ${config.color}, 0 0 40px ${config.color}`,
              }}
            />

            {/* Trail particles */}
            {trail.map((particle) => (
              <motion.div
                key={particle.id}
                initial={{
                  left: `${particle.x}%`,
                  top: `${particle.y}%`,
                  scale: 0,
                  opacity: 0,
                }}
                animate={{
                  scale: [0, 1.5, 0],
                  opacity: [0, 1, 0],
                  rotate: [0, 360],
                }}
                transition={{
                  duration: 0.6,
                  delay: particle.delay / 1000,
                  ease: 'easeOut',
                }}
                className="absolute text-2xl"
              >
                {config.emoji}
              </motion.div>
            ))}

            {/* Energy distortion wave */}
            <motion.div
              initial={{
                opacity: 0,
                x: from === 'left' ? '-10%' : '110%',
              }}
              animate={{
                opacity: [0, 0.4, 0],
                x: from === 'left' ? '110%' : '-10%',
              }}
              transition={{
                duration: 0.5,
                ease: 'linear',
              }}
              className="absolute top-0 h-full w-1/4 blur-xl"
              style={{
                background: `linear-gradient(to ${from === 'left' ? 'right' : 'left'}, transparent, ${config.color}40, transparent)`,
              }}
            />
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
