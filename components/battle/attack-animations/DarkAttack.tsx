/**
 * Dark Attack Animation
 * Shadow tendrils, void energy, creeping darkness, ominous aura
 */

'use client'

import { motion } from 'framer-motion'

interface DarkAttackProps {
  from: 'left' | 'right'
  onComplete?: () => void
}

export function DarkAttack({ from, onComplete }: DarkAttackProps) {
  const startX = from === 'left' ? 15 : 85
  const endX = from === 'left' ? 70 : 30

  return (
    <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
      {/* Screen darkening vignette */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.7, 0] }}
        transition={{ duration: 1.2 }}
        onAnimationComplete={onComplete}
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at 50% 45%, transparent 30%, rgba(0, 0, 0, 0.8) 100%)',
        }}
      />

      {/* Shadow tendrils creeping */}
      {Array.from({ length: 6 }).map((_, i) => {
        const waveY = 45 + Math.sin(i * 1.2) * 12
        const curveControl = 45 + (Math.random() - 0.5) * 20
        
        return (
          <motion.div
            key={`tendril-${i}`}
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ 
              pathLength: 1,
              opacity: [0, 0.9, 0],
            }}
            transition={{
              duration: 0.8,
              delay: i * 0.08,
              ease: 'easeInOut',
            }}
            className="absolute inset-0"
          >
            <svg className="w-full h-full">
              <defs>
                <linearGradient id={`darkGradient-${i}`} x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#7C3AED" stopOpacity="0.8" />
                  <stop offset="50%" stopColor="#6D28D9" stopOpacity="0.6" />
                  <stop offset="100%" stopColor="#000000" stopOpacity="0.4" />
                </linearGradient>
              </defs>
              <motion.path
                d={`M ${startX} 50 Q ${(startX + endX) / 2} ${curveControl} ${endX} ${waveY}`}
                stroke={`url(#darkGradient-${i})`}
                strokeWidth="4"
                fill="none"
                strokeLinecap="round"
                style={{
                  filter: 'drop-shadow(0 0 8px rgba(124, 58, 237, 0.6))',
                }}
              />
            </svg>
          </motion.div>
        )
      })}

      {/* Void sphere projectile */}
      <motion.div
        initial={{
          x: `${startX}%`,
          y: '45%',
          scale: 0,
          opacity: 0,
        }}
        animate={{
          x: `${endX}%`,
          y: '45%',
          scale: [0, 1.2, 1.5],
          opacity: [0, 1, 0],
        }}
        transition={{ duration: 0.7, ease: 'easeInOut' }}
        className="absolute"
        style={{
          transform: 'translate(-50%, -50%)',
        }}
      >
        {/* Dark orb */}
        <div className="relative w-24 h-24">
          {/* Outer dark aura */}
          <motion.div
            className="absolute inset-0 rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(124, 58, 237, 0.6) 0%, rgba(0, 0, 0, 0.8) 70%, transparent 100%)',
            }}
            animate={{ scale: [1, 1.3, 1] }}
            transition={{ duration: 0.5, repeat: Infinity }}
          />
          
          {/* Core void */}
          <div
            className="absolute inset-4 rounded-full"
            style={{
              background: 'radial-gradient(circle, #000000 0%, #1a0033 60%, #7C3AED 100%)',
              boxShadow: '0 0 20px rgba(124, 58, 237, 0.8), inset 0 0 20px rgba(0, 0, 0, 0.9)',
            }}
          />

          {/* Swirling energy */}
          <motion.div
            className="absolute inset-2"
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          >
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="absolute w-1 h-6 rounded-full"
                style={{
                  background: 'linear-gradient(180deg, #7C3AED 0%, transparent 100%)',
                  left: '50%',
                  top: '50%',
                  transform: `translate(-50%, -50%) rotate(${i * 90}deg) translateY(-10px)`,
                  filter: 'blur(1px)',
                }}
              />
            ))}
          </motion.div>
        </div>
      </motion.div>

      {/* Shadow particles spreading */}
      {Array.from({ length: 20 }).map((_, i) => {
        const angle = (i / 20) * 360
        const distance = 40 + Math.random() * 30
        const destX = endX + Math.cos((angle * Math.PI) / 180) * (distance / 10)
        const destY = 45 + Math.sin((angle * Math.PI) / 180) * (distance / 10)
        
        return (
          <motion.div
            key={`shadow-${i}`}
            initial={{
              x: `${endX}%`,
              y: '45%',
              scale: 0,
              opacity: 0,
            }}
            animate={{
              x: `${destX}%`,
              y: `${destY}%`,
              scale: [0, 1.5, 1],
              opacity: [0, 0.8, 0],
            }}
            transition={{
              duration: 1,
              delay: 0.5 + i * 0.03,
              ease: 'easeOut',
            }}
            className="absolute w-3 h-3 rounded-full"
            style={{
              background: i % 2 === 0 
                ? 'radial-gradient(circle, #7C3AED 0%, transparent 100%)'
                : 'radial-gradient(circle, #000000 0%, transparent 100%)',
              filter: 'blur(2px)',
            }}
          />
        )
      })}

      {/* Reality tear effect */}
      <motion.div
        initial={{ scaleY: 0, opacity: 0 }}
        animate={{ 
          scaleY: [0, 1, 1, 0],
          opacity: [0, 0.8, 0.8, 0],
        }}
        transition={{ duration: 0.8, delay: 0.4 }}
        className="absolute"
        style={{
          left: `${endX}%`,
          top: '45%',
          width: 4,
          height: 100,
          background: 'linear-gradient(180deg, transparent 0%, #7C3AED 50%, transparent 100%)',
          transform: 'translate(-50%, -50%)',
          boxShadow: '0 0 20px #7C3AED',
        }}
      />
    </div>
  )
}
