/**
 * Water Attack Animation
 * Wave splash, water droplets, ripple effect
 */

'use client'

import { motion } from 'framer-motion'

interface WaterAttackProps {
  from: 'left' | 'right'
  onComplete?: () => void
}

export function WaterAttack({ from, onComplete }: WaterAttackProps) {
  const startX = from === 'left' ? 0 : 100
  const endX = from === 'left' ? 70 : 30
  const centerY = 50

  return (
    <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
      {/* Main water wave */}
      <motion.svg
        className="absolute inset-0 w-full h-full"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0] }}
        transition={{ duration: 0.7 }}
        onAnimationComplete={onComplete}
      >
        <defs>
          <linearGradient id="waterGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style={{ stopColor: '#00CCFF', stopOpacity: 0.8 }} />
            <stop offset="50%" style={{ stopColor: '#0088CC', stopOpacity: 0.6 }} />
            <stop offset="100%" style={{ stopColor: '#0044AA', stopOpacity: 0.3 }} />
          </linearGradient>
        </defs>

        {/* Animated wave path - centered on battle area */}
        <motion.path
          d={`M ${startX},${centerY} Q ${(startX + endX) / 2},${centerY - 20} ${endX},${centerY} T ${endX + (endX - startX)},${centerY} V 100 H ${startX} Z`}
          fill="url(#waterGradient)"
          initial={{ x: from === 'left' ? '-100%' : '100%' }}
          animate={{ x: '0%' }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          style={{ filter: 'drop-shadow(0 0 10px #00CCFF)' }}
        />
      </motion.svg>

      {/* Water droplets */}
      {Array.from({ length: 20 }).map((_, i) => {
        const startXPos = from === 'left' ? 20 + i * 3 : 80 - i * 3
        return (
          <motion.div
            key={i}
            initial={{
              x: `${startXPos}%`,
              y: '40%',
              scale: 0,
              opacity: 0,
            }}
            animate={{
              x: `${startXPos + (from === 'left' ? 5 : -5)}%`,
              y: ['40%', `${20 + Math.random() * 40}%`, `${60 + Math.random() * 20}%`],
              scale: [0, 1, 0.5],
              opacity: [0, 0.8, 0],
            }}
            transition={{
              duration: 0.8,
              delay: i * 0.03,
              ease: 'easeOut',
            }}
            className="absolute w-2 h-3 rounded-full"
            style={{
              background: 'linear-gradient(180deg, #CCFFFF 0%, #0088CC 100%)',
              filter: 'drop-shadow(0 0 3px #00CCFF)',
            }}
          />
        )
      })}

      {/* Impact ripples */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: [0, 3, 4], opacity: [0, 0.6, 0] }}
        transition={{ duration: 0.6, delay: 0.4 }}
        className="absolute rounded-full border-4"
        style={{
          left: `${endX}%`,
          top: '45%',
          width: 100,
          height: 100,
          borderColor: '#00CCFF',
          transform: 'translate(-50%, -50%)',
        }}
      />
      
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: [0, 2.5, 3.5], opacity: [0, 0.4, 0] }}
        transition={{ duration: 0.6, delay: 0.5 }}
        className="absolute rounded-full border-4"
        style={{
          left: `${endX}%`,
          top: '45%',
          width: 100,
          height: 100,
          borderColor: '#0088CC',
          transform: 'translate(-50%, -50%)',
        }}
      />
    </div>
  )
}
