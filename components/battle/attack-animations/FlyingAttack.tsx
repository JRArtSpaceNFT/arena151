/**
 * Flying Attack Animation
 * Aerial, swift, slicing wind, atmospheric
 * Visual language: Wind slashes, feather trails, sky dive, gust vortex
 */

'use client'

import { motion } from 'framer-motion'

interface FlyingAttackProps {
  direction: 'left-to-right' | 'right-to-left'
  onComplete?: () => void
}

export function FlyingAttack({ direction, onComplete }: FlyingAttackProps) {
  const isLeftToRight = direction === 'left-to-right'

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {/* Gust vortex spiral */}
      <motion.div
        className="absolute w-96 h-96 rounded-full"
        style={{
          background: 'conic-gradient(from 0deg, transparent 0%, rgba(168,144,240,0.4) 15%, transparent 30%, rgba(168,144,240,0.3) 45%, transparent 60%)',
          left: isLeftToRight ? '10%' : 'auto',
          right: isLeftToRight ? 'auto' : '10%',
          top: '20%',
          filter: 'blur(20px)',
        }}
        initial={{ opacity: 0, scale: 0.4, rotate: 0 }}
        animate={{
          opacity: [0, 0.9, 0.6, 0],
          scale: [0.4, 1.3, 1.8],
          rotate: isLeftToRight ? [0, 180, 360] : [0, -180, -360],
          x: isLeftToRight ? ['0%', '100%'] : ['0%', '-100%'],
        }}
        transition={{ duration: 1.1, ease: 'easeOut' }}
        onAnimationComplete={onComplete}
      />

      {/* Wind slash blades (8 cutting arcs) */}
      {Array.from({ length: 8 }).map((_, i) => (
        <motion.div
          key={`slash-${i}`}
          className="absolute rounded-full"
          style={{
            width: 120 + (i % 3) * 40,
            height: 8 + (i % 2) * 4,
            background: `linear-gradient(90deg, transparent 0%, rgba(168,144,240,0.9) 30%, rgba(200,180,255,0.7) 70%, transparent 100%)`,
            boxShadow: '0 0 20px rgba(168,144,240,0.8), 0 0 40px rgba(200,180,255,0.4)',
            left: isLeftToRight ? `${-10 + (i % 4) * 8}%` : 'auto',
            right: isLeftToRight ? 'auto' : `${-10 + (i % 4) * 8}%`,
            top: `${15 + (i % 7) * 10}%`,
            transform: `rotate(${isLeftToRight ? 15 - i * 5 : -15 + i * 5}deg)`,
          }}
          initial={{ opacity: 0, scaleX: 0 }}
          animate={{
            opacity: [0, 1, 0.8, 0],
            scaleX: [0, 1.2, 1.5, 0.8],
            x: isLeftToRight ? [0, 150 + i * 20] : [0, -150 - i * 20],
          }}
          transition={{
            duration: 0.5 + (i % 4) * 0.1,
            delay: i * 0.06,
            ease: 'easeOut',
          }}
        />
      ))}

      {/* Feather trails (15 feathers) */}
      {Array.from({ length: 15 }).map((_, i) => (
        <motion.div
          key={`feather-${i}`}
          className="absolute"
          style={{
            width: 6 + (i % 3) * 3,
            height: 20 + (i % 4) * 8,
            background: 'linear-gradient(180deg, rgba(255,255,255,0.9) 0%, rgba(168,144,240,0.6) 100%)',
            borderRadius: '50% 50% 50% 50% / 20% 20% 80% 80%',
            boxShadow: '0 0 12px rgba(168,144,240,0.7)',
            left: isLeftToRight ? `${5 + (i % 6) * 13}%` : 'auto',
            right: isLeftToRight ? 'auto' : `${5 + (i % 6) * 13}%`,
            top: `${10 + (i % 8) * 10}%`,
          }}
          initial={{ opacity: 0, scale: 0, rotate: 0 }}
          animate={{
            opacity: [0, 1, 0.7, 0],
            scale: [0, 1, 1.2, 0.8],
            rotate: [0, (i % 2 === 0 ? 360 : -360)],
            x: isLeftToRight
              ? [0, 50 + i * 10, 100 + i * 15]
              : [0, -50 - i * 10, -100 - i * 15],
            y: [0, -15 + (i % 3) * 10, 10 + (i % 4) * 8],
          }}
          transition={{
            duration: 0.8 + (i % 5) * 0.12,
            delay: 0.05 + i * 0.04,
            ease: 'easeOut',
          }}
        />
      ))}

      {/* Air current particles (30 swift dots) */}
      {Array.from({ length: 30 }).map((_, i) => (
        <motion.div
          key={`air-${i}`}
          className="absolute rounded-full"
          style={{
            width: 4 + (i % 3) * 2,
            height: 4 + (i % 3) * 2,
            background: i % 3 === 0 ? '#c8b4ff' : '#a890f0',
            boxShadow: `0 0 10px ${i % 3 === 0 ? '#c8b4ff' : '#a890f0'}`,
            left: isLeftToRight ? `${5 + (i % 9) * 10}%` : 'auto',
            right: isLeftToRight ? 'auto' : `${5 + (i % 9) * 10}%`,
            top: `${15 + (i % 8) * 9}%`,
          }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{
            opacity: [0, 1, 0.6, 0],
            scale: [0, 1, 1.3, 0.7],
            x: isLeftToRight
              ? [0, 70 + i * 8, 140 + i * 12]
              : [0, -70 - i * 8, -140 - i * 12],
            y: [0, (i % 2 === 0 ? -10 : 10) + (i % 3) * 5, (i % 2 === 0 ? -20 : 20)],
          }}
          transition={{
            duration: 0.6 + (i % 5) * 0.08,
            delay: i * 0.02,
            ease: 'linear',
          }}
        />
      ))}

      {/* Wing beat pressure wave (3 expanding rings) */}
      {Array.from({ length: 3 }).map((_, i) => (
        <motion.div
          key={`wing-${i}`}
          className="absolute rounded-full border-2"
          style={{
            width: 100,
            height: 100,
            borderColor: 'rgba(168,144,240,0.6)',
            left: isLeftToRight ? '20%' : 'auto',
            right: isLeftToRight ? 'auto' : '20%',
            top: '30%',
            boxShadow: '0 0 20px rgba(168,144,240,0.4)',
          }}
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{
            scale: [0.5, 2 + i * 0.5, 3.5 + i * 0.5],
            opacity: [0, 0.8, 0],
          }}
          transition={{
            duration: 0.9,
            delay: i * 0.2,
            ease: 'easeOut',
          }}
        />
      ))}

      {/* Screen tint - light sky blue atmospheric */}
      <motion.div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(168,144,240,0.15) 0%, transparent 65%)',
          mixBlendMode: 'screen',
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.7, 0.4, 0] }}
        transition={{ duration: 1.1 }}
      />
    </div>
  )
}
