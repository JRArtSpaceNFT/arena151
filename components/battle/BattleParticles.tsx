/**
 * Battle Particles - Element-specific particle effects
 */

'use client'

import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'

interface Particle {
  id: string
  x: number
  y: number
  vx: number
  vy: number
  size: number
  color: string
  lifetime: number
  created: number
}

interface BattleParticlesProps {
  element?: string
  count?: number
  position?: { x: number; y: number }
  spread?: number
}

const ELEMENT_PARTICLES: Record<string, { color: string; emoji?: string }> = {
  fire: { color: '#FF6600', emoji: '🔥' },
  water: { color: '#0066CC', emoji: '💧' },
  electric: { color: '#FFFF00', emoji: '⚡' },
  grass: { color: '#22C55E', emoji: '🍃' },
  ice: { color: '#CCFFFF', emoji: '❄️' },
  psychic: { color: '#EC4899', emoji: '✨' },
  dark: { color: '#330033', emoji: '🌑' },
  dragon: { color: '#7C3AED', emoji: '🔮' },
}

export default function BattleParticles({
  element = 'normal',
  count = 50,
  position = { x: 50, y: 50 },
  spread = 100,
}: BattleParticlesProps) {
  const [particles, setParticles] = useState<Particle[]>([])

  useEffect(() => {
    const config = ELEMENT_PARTICLES[element] || { color: '#FFFFFF' }
    const newParticles: Particle[] = []

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2
      const speed = Math.random() * spread + 50
      
      newParticles.push({
        id: `${Date.now()}-${i}`,
        x: position.x + (Math.random() - 0.5) * 20,
        y: position.y + (Math.random() - 0.5) * 20,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.random() * 8 + 4,
        color: config.color,
        lifetime: Math.random() * 500 + 300,
        created: Date.now(),
      })
    }

    setParticles(newParticles)

    // Clean up after max lifetime
    const cleanup = setTimeout(() => setParticles([]), 1000)
    return () => clearTimeout(cleanup)
  }, [element, count, position.x, position.y, spread])

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          initial={{
            x: `${p.x}%`,
            y: `${p.y}%`,
            scale: 1,
            opacity: 1,
          }}
          animate={{
            x: `${p.x + p.vx / 10}%`,
            y: `${p.y + p.vy / 10}%`,
            scale: 0,
            opacity: 0,
          }}
          transition={{
            duration: p.lifetime / 1000,
            ease: 'easeOut',
          }}
          style={{
            position: 'absolute',
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            borderRadius: '50%',
            boxShadow: `0 0 ${p.size * 2}px ${p.color}`,
          }}
        />
      ))}
    </div>
  )
}
