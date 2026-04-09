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
  const startX = from === 'left' ? 15 : 85
  const endX = from === 'left' ? 70 : 30

  return (
    <div className="absolute inset-0 pointer-events-none z-30">
      {/* Projectile streak */}
      <motion.div
        initial={{
          x: `${startX}%`,
          y: '45%',
          scale: 0.5,
          opacity: 0,
        }}
        animate={{
          x: `${endX}%`,
          y: '45%',
          scale: [0.5, 1, 1.2],
          opacity: [0, 1, 0],
        }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        onAnimationComplete={onComplete}
        className="absolute w-12 h-12 rounded-full"
        style={{
          background: 'radial-gradient(circle, #FFFFFF 0%, #E5E7EB 100%)',
          boxShadow: '0 0 20px rgba(255, 255, 255, 0.8)',
        }}
      />

      {/* Impact stars */}
      {Array.from({ length: 8 }).map((_, i) => {
        const angle = (i / 8) * 360
        const distance = 25
        const destX = endX + Math.cos((angle * Math.PI) / 180) * (distance / 10)
        const destY = 45 + Math.sin((angle * Math.PI) / 180) * (distance / 10)
        
        return (
          <motion.div
            key={i}
            initial={{ x: `${endX}%`, y: '45%', scale: 0, opacity: 0 }}
            animate={{
              x: `${destX}%`,
              y: `${destY}%`,
              scale: [0, 1.5, 0],
              opacity: [0, 1, 0],
              rotate: [0, 180],
            }}
            transition={{ duration: 0.5, delay: 0.3 + i * 0.03 }}
            className="absolute"
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
