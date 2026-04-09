/**
 * Ice Attack Animation
 * Freezing beam, ice shards, frost spread, crystalline effects
 */

'use client'

import { motion } from 'framer-motion'

interface IceAttackProps {
  from: 'left' | 'right'
  onComplete?: () => void
}

export function IceAttack({ from, onComplete }: IceAttackProps) {
  const startX = from === 'left' ? 15 : 85
  const endX = from === 'left' ? 70 : 30

  return (
    <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
      {/* Freezing beam core */}
      <motion.div
        initial={{ 
          width: 0,
          x: `${startX}%`,
          y: '45%',
          opacity: 0,
        }}
        animate={{
          width: `${Math.abs(endX - startX)}%`,
          opacity: [0, 1, 0.8, 0],
        }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        onAnimationComplete={onComplete}
        className="absolute h-12"
        style={{
          background: 'linear-gradient(90deg, rgba(204, 255, 255, 0.9) 0%, rgba(153, 204, 255, 0.7) 50%, rgba(102, 204, 255, 0.5) 100%)',
          transformOrigin: from === 'left' ? 'left center' : 'right center',
          transform: from === 'left' ? 'translateY(-50%)' : 'translateY(-50%) scaleX(-1)',
          filter: 'blur(4px)',
          boxShadow: '0 0 20px rgba(204, 255, 255, 0.8)',
        }}
      />

      {/* Sharp inner beam */}
      <motion.div
        initial={{ 
          width: 0,
          x: `${startX}%`,
          y: '45%',
          opacity: 0,
        }}
        animate={{
          width: `${Math.abs(endX - startX)}%`,
          opacity: [0, 1, 1, 0],
        }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="absolute h-4"
        style={{
          background: 'linear-gradient(90deg, #FFFFFF 0%, #CCFFFF 100%)',
          transformOrigin: from === 'left' ? 'left center' : 'right center',
          transform: from === 'left' ? 'translateY(-50%)' : 'translateY(-50%) scaleX(-1)',
          boxShadow: '0 0 12px #FFFFFF',
        }}
      />

      {/* Ice crystals forming along the beam */}
      {Array.from({ length: 10 }).map((_, i) => {
        const progress = i / 10
        const xPos = startX + (endX - startX) * progress
        return (
          <motion.div
            key={i}
            initial={{ scale: 0, opacity: 0, rotate: 0 }}
            animate={{
              scale: [0, 1, 0.8],
              opacity: [0, 1, 0.6],
              rotate: [0, 180],
            }}
            transition={{
              duration: 0.5,
              delay: i * 0.05,
            }}
            className="absolute"
            style={{
              left: `${xPos}%`,
              top: '45%',
              transform: 'translate(-50%, -50%)',
            }}
          >
            {/* Diamond-shaped crystal */}
            <svg width="16" height="16" viewBox="0 0 16 16">
              <path
                d="M8 0 L12 8 L8 16 L4 8 Z"
                fill="rgba(204, 255, 255, 0.8)"
                stroke="#FFFFFF"
                strokeWidth="1"
                style={{
                  filter: 'drop-shadow(0 0 4px rgba(204, 255, 255, 0.9))',
                }}
              />
            </svg>
          </motion.div>
        )
      })}

      {/* Ice shards explosion at impact */}
      {Array.from({ length: 12 }).map((_, i) => {
        const angle = (i / 12) * 360
        const distance = 40 + Math.random() * 30
        const endXPos = endX + Math.cos((angle * Math.PI) / 180) * (distance / 10)
        const endYPos = 45 + Math.sin((angle * Math.PI) / 180) * (distance / 10)
        
        return (
          <motion.div
            key={`shard-${i}`}
            initial={{
              x: `${endX}%`,
              y: '45%',
              scale: 0,
              opacity: 0,
              rotate: 0,
            }}
            animate={{
              x: `${endXPos}%`,
              y: `${endYPos}%`,
              scale: [0, 1.2, 1],
              opacity: [0, 1, 0],
              rotate: angle,
            }}
            transition={{
              duration: 0.6,
              delay: 0.3 + i * 0.02,
              ease: 'easeOut',
            }}
            className="absolute"
          >
            {/* Shard shape */}
            <svg width="20" height="20" viewBox="0 0 20 20">
              <path
                d="M10 0 L12 10 L10 20 L8 10 Z"
                fill="rgba(153, 204, 255, 0.9)"
                stroke="#CCFFFF"
                strokeWidth="1"
                style={{
                  filter: 'drop-shadow(0 0 6px rgba(153, 204, 255, 0.8))',
                }}
              />
            </svg>
          </motion.div>
        )
      })}

      {/* Frost spread effect at impact point */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ 
          scale: [0, 2, 2.5],
          opacity: [0, 0.8, 0],
        }}
        transition={{ duration: 0.8, delay: 0.3 }}
        className="absolute"
        style={{
          left: `${endX}%`,
          top: '45%',
          width: 150,
          height: 150,
          background: 'radial-gradient(circle, rgba(204, 255, 255, 0.6) 0%, rgba(153, 204, 255, 0.3) 40%, transparent 70%)',
          transform: 'translate(-50%, -50%)',
          filter: 'blur(12px)',
        }}
      />

      {/* Freezing mist particles */}
      {Array.from({ length: 20 }).map((_, i) => (
        <motion.div
          key={`mist-${i}`}
          initial={{
            x: `${endX}%`,
            y: '45%',
            scale: 0,
            opacity: 0,
          }}
          animate={{
            x: `${endX + (Math.random() - 0.5) * 15}%`,
            y: `${45 + (Math.random() - 0.5) * 20}%`,
            scale: [0, 1, 1.5],
            opacity: [0, 0.6, 0],
          }}
          transition={{
            duration: 1.2,
            delay: 0.4 + i * 0.03,
            ease: 'easeOut',
          }}
          className="absolute w-4 h-4 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(255, 255, 255, 0.8) 0%, rgba(204, 255, 255, 0.4) 50%, transparent 100%)',
            filter: 'blur(3px)',
          }}
        />
      ))}
    </div>
  )
}
