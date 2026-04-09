/**
 * Impact Ring Animation
 * Expanding shockwave circles on hit (Pokémon Showdown style)
 */

'use client'

import { motion } from 'framer-motion'

interface ImpactRingsProps {
  position: { x: number; y: number } // percentage-based (0-100)
  color?: string
  intensity?: 'light' | 'medium' | 'heavy'
  onComplete?: () => void
}

export function ImpactRings({ position, color = '#FFFFFF', intensity = 'medium', onComplete }: ImpactRingsProps) {
  const ringCount = intensity === 'heavy' ? 4 : intensity === 'medium' ? 3 : 2
  const maxScale = intensity === 'heavy' ? 4 : intensity === 'medium' ? 3 : 2
  const duration = intensity === 'heavy' ? 0.8 : intensity === 'medium' ? 0.6 : 0.4

  return (
    <div className="absolute inset-0 pointer-events-none z-30">
      {/* Multiple expanding rings */}
      {Array.from({ length: ringCount }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ 
            scale: [0, maxScale],
            opacity: [0, 0.8, 0],
          }}
          transition={{ 
            duration,
            delay: i * 0.1,
            ease: 'easeOut',
          }}
          onAnimationComplete={i === ringCount - 1 ? onComplete : undefined}
          className="absolute rounded-full border-4"
          style={{
            left: `${position.x}%`,
            top: `${position.y}%`,
            width: 80,
            height: 80,
            borderColor: color,
            transform: 'translate(-50%, -50%)',
            boxShadow: `0 0 20px ${color}`,
          }}
        />
      ))}

      {/* Central flash */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ 
          scale: [0, 1.5, 2],
          opacity: [0, 1, 0],
        }}
        transition={{ duration: 0.3 }}
        className="absolute rounded-full"
        style={{
          left: `${position.x}%`,
          top: `${position.y}%`,
          width: 60,
          height: 60,
          background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
          transform: 'translate(-50%, -50%)',
          filter: 'blur(10px)',
        }}
      />

      {/* Radiating lines */}
      {Array.from({ length: 8 }).map((_, i) => {
        const angle = (i * 360) / 8
        return (
          <motion.div
            key={i}
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ 
              scaleX: [0, 1],
              opacity: [0, 0.6, 0],
            }}
            transition={{ duration: 0.4, delay: i * 0.02 }}
            className="absolute"
            style={{
              left: `${position.x}%`,
              top: `${position.y}%`,
              width: 100,
              height: 3,
              background: `linear-gradient(90deg, ${color} 0%, transparent 100%)`,
              transformOrigin: 'left center',
              transform: `translate(0, -50%) rotate(${angle}deg)`,
              filter: `drop-shadow(0 0 4px ${color})`,
            }}
          />
        )
      })}
    </div>
  )
}
