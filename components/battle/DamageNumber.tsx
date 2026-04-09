/**
 * Enhanced Damage Numbers - Cinematic damage display
 */

'use client'

import { motion } from 'framer-motion'

interface DamageNumberProps {
  damage: number
  isCritical?: boolean
  isSuperEffective?: boolean
  element?: string
  position?: { x: number; y: number }
}

const ELEMENT_COLORS: Record<string, string> = {
  fire: '#FF6600',
  water: '#0066CC',
  electric: '#FFFF00',
  grass: '#22C55E',
  ice: '#CCFFFF',
  fighting: '#DC2626',
  psychic: '#EC4899',
  dark: '#330033',
  normal: '#9CA3AF',
}

export default function DamageNumber({
  damage,
  isCritical = false,
  isSuperEffective = false,
  element = 'normal',
  position = { x: 50, y: 30 },
}: DamageNumberProps) {
  const color = isCritical 
    ? '#FFD700' 
    : isSuperEffective 
    ? '#22C55E' 
    : ELEMENT_COLORS[element] || '#FFFFFF'

  const size = isCritical ? 'text-8xl' : isSuperEffective ? 'text-6xl' : 'text-5xl'
  
  const glow = isCritical 
    ? '0 0 30px #FFD700, 0 0 60px #FFD700' 
    : isSuperEffective
    ? '0 0 20px #22C55E, 0 0 40px #22C55E'
    : `0 0 20px ${color}`

  return (
    <motion.div
      initial={{
        x: `${position.x}%`,
        y: `${position.y}%`,
        scale: 0.5,
        opacity: 0,
      }}
      animate={{
        y: `${position.y - 20}%`,
        scale: isCritical ? 1.5 : 1,
        opacity: 1,
      }}
      exit={{
        y: `${position.y - 40}%`,
        scale: 0.8,
        opacity: 0,
      }}
      transition={{
        duration: 1,
        ease: 'easeOut',
      }}
      className={`absolute ${size} font-black pointer-events-none z-[9999]`}
      style={{
        color,
        textShadow: glow,
        WebkitTextStroke: '2px rgba(0,0,0,0.8)',
      }}
    >
      -{damage}
      {isCritical && <span className="text-4xl ml-2">✨</span>}
      {isSuperEffective && <span className="text-4xl ml-2">⚡</span>}
    </motion.div>
  )
}
