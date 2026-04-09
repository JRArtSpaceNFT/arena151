/**
 * Fighting Attack Animation
 * Punch impacts, speed lines, fighting spirit aura, physical strikes
 */

'use client'

import { motion } from 'framer-motion'

interface FightingAttackProps {
  from: 'left' | 'right'
  onComplete?: () => void
}

export function FightingAttack({ from, onComplete }: FightingAttackProps) {
  const startX = from === 'left' ? 15 : 85
  const endX = from === 'left' ? 70 : 30

  return (
    <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
      {/* Speed lines (motion blur) */}
      {Array.from({ length: 8 }).map((_, i) => {
        const yPos = 30 + i * 5
        return (
          <motion.div
            key={`speed-line-${i}`}
            initial={{ 
              scaleX: 0,
              opacity: 0,
            }}
            animate={{
              scaleX: [0, 1, 0],
              opacity: [0, 0.8, 0],
            }}
            transition={{
              duration: 0.3,
              delay: i * 0.02,
              ease: 'easeOut',
            }}
            className="absolute h-1"
            style={{
              left: from === 'left' ? `${startX}%` : undefined,
              right: from === 'right' ? `${100 - startX}%` : undefined,
              top: `${yPos}%`,
              width: `${Math.abs(endX - startX) * 0.8}%`,
              background: `linear-gradient(90deg, 
                rgba(220, 38, 38, 0.8) 0%, 
                rgba(239, 68, 68, 0.4) 100%)`,
              transformOrigin: from === 'left' ? 'left center' : 'right center',
            }}
          />
        )
      })}

      {/* Fist projectile */}
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
          scale: [0.5, 1.3, 1.5],
          opacity: [0, 1, 0],
        }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        onAnimationComplete={onComplete}
        className="absolute"
        style={{
          transform: 'translate(-50%, -50%)',
        }}
      >
        {/* Fist symbol */}
        <div className="relative w-16 h-16">
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 0.2, repeat: Infinity }}
            className="absolute inset-0 flex items-center justify-center text-5xl"
            style={{
              filter: 'drop-shadow(0 0 8px rgba(220, 38, 38, 0.8))',
            }}
          >
            👊
          </motion.div>
        </div>
      </motion.div>

      {/* Fighting spirit aura trail */}
      {Array.from({ length: 6 }).map((_, i) => {
        const progress = i / 6
        const xPos = startX + (endX - startX) * progress
        return (
          <motion.div
            key={`aura-${i}`}
            initial={{ scale: 0, opacity: 0 }}
            animate={{
              scale: [0, 1.5, 2],
              opacity: [0, 0.6, 0],
            }}
            transition={{
              duration: 0.5,
              delay: i * 0.05,
            }}
            className="absolute"
            style={{
              left: `${xPos}%`,
              top: '45%',
              width: 60,
              height: 60,
              background: 'radial-gradient(circle, rgba(220, 38, 38, 0.5) 0%, transparent 70%)',
              transform: 'translate(-50%, -50%)',
              filter: 'blur(8px)',
            }}
          />
        )
      })}

      {/* Impact burst - concentric shockwaves */}
      {Array.from({ length: 4 }).map((_, i) => (
        <motion.div
          key={`impact-${i}`}
          initial={{ scale: 0, opacity: 0 }}
          animate={{
            scale: [0, 2 + i * 0.3],
            opacity: [0, 0.8, 0],
          }}
          transition={{
            duration: 0.5,
            delay: 0.3 + i * 0.08,
            ease: 'easeOut',
          }}
          className="absolute rounded-full border-4"
          style={{
            left: `${endX}%`,
            top: '45%',
            width: 80,
            height: 80,
            borderColor: '#DC2626',
            transform: 'translate(-50%, -50%)',
            boxShadow: '0 0 16px rgba(220, 38, 38, 0.8)',
          }}
        />
      ))}

      {/* Debris/impact particles */}
      {Array.from({ length: 16 }).map((_, i) => {
        const angle = (i / 16) * 360
        const distance = 35 + Math.random() * 20
        const destX = endX + Math.cos((angle * Math.PI) / 180) * (distance / 10)
        const destY = 45 + Math.sin((angle * Math.PI) / 180) * (distance / 10)
        
        return (
          <motion.div
            key={`debris-${i}`}
            initial={{
              x: `${endX}%`,
              y: '45%',
              scale: 0,
              opacity: 0,
              rotate: 0,
            }}
            animate={{
              x: `${destX}%`,
              y: `${destY}%`,
              scale: [0, 1, 0.5],
              opacity: [0, 1, 0],
              rotate: [0, 360 + Math.random() * 180],
            }}
            transition={{
              duration: 0.6,
              delay: 0.35 + i * 0.02,
              ease: 'easeOut',
            }}
            className="absolute w-2 h-2"
            style={{
              background: i % 2 === 0 ? '#EF4444' : '#DC2626',
              borderRadius: i % 3 === 0 ? '50%' : '0',
            }}
          />
        )
      })}

      {/* Screen flash on impact */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.3, 0] }}
        transition={{ duration: 0.2, delay: 0.3 }}
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at 70% 45%, rgba(220, 38, 38, 0.4) 0%, transparent 60%)',
        }}
      />
    </div>
  )
}
