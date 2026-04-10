/**
 * Normal Attack Animation
 * Generic physical strike, impact stars, basic energy
 */

'use client'

import { motion } from 'framer-motion'

interface NormalAttackProps {
  from: 'left' | 'right'
  onComplete?: () => void
}

export function NormalAttack({ from, onComplete }: NormalAttackProps) {
  // Attacker and defender positions (centered on sprites)
  const startX = from === 'left' ? 30 : 70  // Attacker sprite position
  const endX = from === 'left' ? 70 : 30     // Defender sprite position
  const centerY = 50 // Vertical center of battle area

  return (
    <div className="absolute inset-0 pointer-events-none z-30">
      {/* Projectile streak */}
      <motion.div
        initial={{
          left: `${startX}%`,
          top: `${centerY}%`,
          scale: 0.5,
          opacity: 0,
        }}
        animate={{
          left: `${endX}%`,
          top: `${centerY}%`,
          scale: [0.5, 1, 1.2],
          opacity: [0, 1, 0],
        }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        onAnimationComplete={onComplete}
        className="absolute w-16 h-16 rounded-full"
        style={{
          background: 'radial-gradient(circle, #FFFFFF 0%, #E5E7EB 100%)',
          boxShadow: '0 0 20px rgba(255, 255, 255, 0.8)',
          transform: 'translate(-50%, -50%)',
        }}
      />

      {/* Impact stars */}
      {Array.from({ length: 8 }).map((_, i) => {
        const angle = (i / 8) * 360
        const distance = 60 // pixels
        const destX = Math.cos((angle * Math.PI) / 180) * distance
        const destY = Math.sin((angle * Math.PI) / 180) * distance
        
        return (
          <motion.div
            key={i}
            initial={{ 
              left: `${endX}%`, 
              top: `${centerY}%`, 
              x: 0,
              y: 0,
              scale: 0, 
              opacity: 0 
            }}
            animate={{
              x: destX,
              y: destY,
              scale: [0, 1.5, 0],
              opacity: [0, 1, 0],
              rotate: [0, 180],
            }}
            transition={{ duration: 0.5, delay: 0.3 + i * 0.03 }}
            className="absolute"
            style={{ transform: 'translate(-50%, -50%)' }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16">
              <path
                d="M8 0 L9.5 5.5 L15 7 L10 9 L8 16 L6 9 L1 7 L6.5 5.5 Z"
                fill="#FFFFFF"
                style={{ filter: 'drop-shadow(0 0 3px #E5E7EB)' }}
              />
            </svg>
          </motion.div>
        )
      })}
    </div>
  )
}
