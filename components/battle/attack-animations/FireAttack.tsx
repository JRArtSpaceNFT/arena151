/**
 * Fire Attack Animation
 * Rising flames, ember particles, heat shimmer
 */

'use client'

import { motion } from 'framer-motion'

interface FireAttackProps {
  from: 'left' | 'right'
  onComplete?: () => void
}

export function FireAttack({ from, onComplete }: FireAttackProps) {
  const startX = from === 'left' ? '30%' : '70%'  // Attacker position
  const endX = from === 'left' ? '70%' : '30%'    // Defender position
  const centerY = '50%'

  return (
    <div className="absolute inset-0 pointer-events-none z-30">
      {/* Main fireball projectile */}
      <motion.div
        initial={{ left: startX, top: centerY, scale: 0.5, opacity: 0 }}
        animate={{ 
          left: endX, 
          top: centerY, 
          scale: [0.5, 1.2, 1.5],
          opacity: [0, 1, 0],
        }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        onAnimationComplete={onComplete}
        className="absolute"
        style={{ transform: 'translate(-50%, -50%)' }}
      >
        {/* Fireball core */}
        <div className="relative w-24 h-24">
          {/* Outer glow */}
          <motion.div
            className="absolute inset-0 rounded-full"
            style={{
              background: 'radial-gradient(circle, #FF4400 0%, #FF8800 40%, transparent 70%)',
              filter: 'blur(20px)',
            }}
            animate={{ scale: [1, 1.3, 1] }}
            transition={{ duration: 0.3, repeat: Infinity }}
          />
          
          {/* Core */}
          <motion.div
            className="absolute inset-2 rounded-full"
            style={{
              background: 'radial-gradient(circle, #FFFF00 0%, #FF4400 60%, #FF0000 100%)',
            }}
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 0.2, repeat: Infinity }}
          />

          {/* Inner white hot center */}
          <div
            className="absolute inset-6 rounded-full"
            style={{
              background: '#FFFFFF',
              filter: 'blur(4px)',
            }}
          />
        </div>
      </motion.div>

      {/* Trailing ember particles */}
      {Array.from({ length: 12 }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ 
            x: startX, 
            y: '50%',
            scale: 0,
            opacity: 0,
          }}
          animate={{
            x: [startX, endX],
            y: [`${50 + (Math.random() - 0.5) * 20}%`, `${30 + Math.random() * 20}%`],
            scale: [0, 1, 0],
            opacity: [0, 1, 0],
          }}
          transition={{
            duration: 0.8,
            delay: i * 0.05,
            ease: 'easeOut',
          }}
          className="absolute w-3 h-3 rounded-full"
          style={{
            background: `radial-gradient(circle, ${i % 2 === 0 ? '#FFAA00' : '#FF4400'}, transparent)`,
          }}
        />
      ))}

      {/* Heat shimmer waves */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.6, 0] }}
        transition={{ duration: 0.6 }}
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at 50% 50%, rgba(255, 68, 0, 0.2) 0%, transparent 50%)',
          filter: 'blur(40px)',
        }}
      />
    </div>
  )
}
