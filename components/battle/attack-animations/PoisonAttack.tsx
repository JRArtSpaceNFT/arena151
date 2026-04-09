/**
 * Poison Attack Animation
 * Toxic, dripping, corrosive, lingering
 * Visual language: Toxic bubbles, dripping venom, corrosive mist, purple-green haze
 */

'use client'

import { motion } from 'framer-motion'

interface PoisonAttackProps {
  direction: 'left-to-right' | 'right-to-left'
  onComplete?: () => void
}

export function PoisonAttack({ direction, onComplete }: PoisonAttackProps) {
  const isLeftToRight = direction === 'left-to-right'

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {/* Toxic mist cloud */}
      <motion.div
        className="absolute w-96 h-96 rounded-full blur-3xl"
        style={{
          background: 'radial-gradient(circle, rgba(160,64,160,0.6) 0%, rgba(120,80,160,0.3) 40%, transparent 70%)',
          left: isLeftToRight ? '-20%' : 'auto',
          right: isLeftToRight ? 'auto' : '-20%',
          top: '30%',
        }}
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{
          opacity: [0, 0.8, 0.6, 0],
          scale: [0.5, 1.2, 1.4, 1.6],
          x: isLeftToRight ? ['0%', '120%'] : ['0%', '-120%'],
        }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
        onAnimationComplete={onComplete}
      />

      {/* Toxic bubbles (15 bubbles of varying sizes) */}
      {Array.from({ length: 15 }).map((_, i) => (
        <motion.div
          key={`bubble-${i}`}
          className="absolute rounded-full"
          style={{
            width: 12 + (i % 4) * 8,
            height: 12 + (i % 4) * 8,
            background: i % 3 === 0
              ? 'radial-gradient(circle at 30% 30%, rgba(160,64,160,0.9), rgba(120,80,160,0.7))'
              : 'radial-gradient(circle at 30% 30%, rgba(120,80,160,0.8), rgba(80,40,120,0.6))',
            border: '2px solid rgba(200,120,200,0.5)',
            boxShadow: '0 0 20px rgba(160,64,160,0.8), inset 0 0 10px rgba(255,255,255,0.3)',
            left: isLeftToRight ? `${5 + (i % 5) * 15}%` : 'auto',
            right: isLeftToRight ? 'auto' : `${5 + (i % 5) * 15}%`,
            top: `${20 + (i % 7) * 10}%`,
          }}
          initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
          animate={{
            opacity: [0, 1, 0.8, 0],
            scale: [0, 1, 1.2, 0.8],
            x: isLeftToRight
              ? [0, 60 + i * 12, 120 + i * 15]
              : [0, -60 - i * 12, -120 - i * 15],
            y: [0, -20 + (i % 3) * 15, -10 + (i % 4) * 10],
          }}
          transition={{
            duration: 0.8 + (i % 5) * 0.15,
            delay: i * 0.04,
            ease: 'easeOut',
          }}
        />
      ))}

      {/* Dripping venom trails (8 trails) */}
      {Array.from({ length: 8 }).map((_, i) => (
        <motion.div
          key={`drip-${i}`}
          className="absolute"
          style={{
            width: 4 + (i % 3) * 2,
            height: 60 + (i % 4) * 20,
            background: 'linear-gradient(180deg, rgba(160,64,160,0.9) 0%, rgba(120,80,160,0.6) 50%, transparent 100%)',
            borderRadius: '50% 50% 50% 50% / 20% 20% 80% 80%',
            left: isLeftToRight ? `${15 + (i % 6) * 12}%` : 'auto',
            right: isLeftToRight ? 'auto' : `${15 + (i % 6) * 12}%`,
            top: `${10 + (i % 5) * 15}%`,
            boxShadow: '0 0 12px rgba(160,64,160,0.7)',
          }}
          initial={{ opacity: 0, scaleY: 0 }}
          animate={{
            opacity: [0, 1, 0.7, 0],
            scaleY: [0, 1, 1.3, 0],
            x: isLeftToRight ? [0, 40 + i * 8] : [0, -40 - i * 8],
          }}
          transition={{
            duration: 0.6 + (i % 4) * 0.1,
            delay: 0.1 + i * 0.05,
            ease: 'easeIn',
          }}
        />
      ))}

      {/* Corrosive sizzle particles (20 small particles) */}
      {Array.from({ length: 20 }).map((_, i) => (
        <motion.div
          key={`sizzle-${i}`}
          className="absolute rounded-full"
          style={{
            width: 3 + (i % 3) * 2,
            height: 3 + (i % 3) * 2,
            background: i % 2 === 0 ? '#c084fc' : '#a855f7',
            boxShadow: `0 0 8px ${i % 2 === 0 ? '#c084fc' : '#a855f7'}`,
            left: isLeftToRight ? `${10 + (i % 8) * 10}%` : 'auto',
            right: isLeftToRight ? 'auto' : `${10 + (i % 8) * 10}%`,
            top: `${25 + (i % 6) * 10}%`,
          }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{
            opacity: [0, 1, 0.6, 0],
            scale: [0, 1.2, 0.8, 0],
            x: isLeftToRight
              ? [0, 30 + i * 5, 60 + i * 8]
              : [0, -30 - i * 5, -60 - i * 8],
            y: [0, (i % 2 === 0 ? -15 : 15) + (i % 3) * 5, (i % 2 === 0 ? -25 : 25)],
          }}
          transition={{
            duration: 0.5 + (i % 4) * 0.1,
            delay: 0.15 + i * 0.03,
            ease: 'easeOut',
          }}
        />
      ))}

      {/* Screen tint - purple toxic haze */}
      <motion.div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(160,64,160,0.25) 0%, transparent 60%)',
          mixBlendMode: 'screen',
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.6, 0.4, 0] }}
        transition={{ duration: 1.2 }}
      />
    </div>
  )
}
