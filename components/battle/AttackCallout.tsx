/**
 * Attack Callout - Special move name display
 */

'use client'

import { motion } from 'framer-motion'

interface AttackCalloutProps {
  attackName: string
  element: string
}

const ELEMENT_COLORS: Record<string, string> = {
  fire: '#FF6600',
  water: '#0066CC',
  electric: '#FFFF00',
  grass: '#22C55E',
  ice: '#CCFFFF',
  fighting: '#DC2626',
  poison: '#A855F7',
  psychic: '#EC4899',
  dark: '#330033',
  dragon: '#7C3AED',
}

export default function AttackCallout({ attackName, element }: AttackCalloutProps) {
  const color = ELEMENT_COLORS[element] || '#FFFFFF'

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[9998]">
      {/* Darkened background */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.7 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="absolute inset-0 bg-black"
      />

      {/* Attack name */}
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 1.2, opacity: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="relative text-7xl font-black uppercase tracking-wider"
        style={{
          color,
          textShadow: `
            0 0 20px ${color},
            0 0 40px ${color},
            0 0 60px ${color},
            4px 4px 0px rgba(0,0,0,0.8)
          `,
          WebkitTextStroke: '3px rgba(0,0,0,0.9)',
        }}
      >
        {attackName}
        
        {/* Decorative lines */}
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: '100%' }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="absolute -bottom-4 left-0 h-1"
          style={{ backgroundColor: color, boxShadow: `0 0 20px ${color}` }}
        />
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: '100%' }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="absolute -top-4 left-0 h-1"
          style={{ backgroundColor: color, boxShadow: `0 0 20px ${color}` }}
        />
      </motion.div>
    </div>
  )
}
