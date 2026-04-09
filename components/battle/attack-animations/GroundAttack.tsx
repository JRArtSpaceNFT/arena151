/**
 * Ground Attack Animation
 * Crushing, seismic, dusty, fractured
 * Visual language: Ground cracks, dust tsunami, debris, earthquake rumble
 */

'use client'

import { motion } from 'framer-motion'

interface GroundAttackProps {
  direction: 'left-to-right' | 'right-to-left'
  onComplete?: () => void
}

export function GroundAttack({ direction, onComplete }: GroundAttackProps) {
  const isLeftToRight = direction === 'left-to-right'

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {/* Dust tsunami wave */}
      <motion.div
        className="absolute w-full h-80 blur-2xl"
        style={{
          background: 'linear-gradient(90deg, rgba(224,192,104,0.7) 0%, rgba(184,160,56,0.5) 50%, transparent 100%)',
          bottom: '-10%',
          transformOrigin: isLeftToRight ? 'left center' : 'right center',
        }}
        initial={{ scaleX: 0, opacity: 0 }}
        animate={{
          scaleX: [0, 1.2, 1],
          opacity: [0, 0.9, 0.6, 0],
          x: isLeftToRight ? ['0%', '20%'] : ['0%', '-20%'],
        }}
        transition={{ duration: 1.0, ease: 'easeOut' }}
        onAnimationComplete={onComplete}
      />

      {/* Ground cracks (6 jagged lines) */}
      {Array.from({ length: 6 }).map((_, i) => (
        <motion.svg
          key={`crack-${i}`}
          className="absolute"
          style={{
            left: isLeftToRight ? `${10 + i * 15}%` : 'auto',
            right: isLeftToRight ? 'auto' : `${10 + i * 15}%`,
            bottom: '0%',
            width: 120,
            height: 300,
            filter: 'drop-shadow(0 0 8px rgba(224,192,104,0.8))',
          }}
          viewBox="0 0 120 300"
          initial={{ opacity: 0, pathLength: 0 }}
          animate={{
            opacity: [0, 1, 0.8, 0],
            pathLength: [0, 1, 1, 0.5],
          }}
          transition={{
            duration: 0.8,
            delay: i * 0.08,
            ease: 'easeOut',
          }}
        >
          <motion.path
            d={`M60,300 L${55 + (i % 3) * 5},${250 - i * 10} L${65 - (i % 2) * 10},${200 - i * 15} L${50 + (i % 4) * 8},${150 - i * 8} L${58 - (i % 3) * 6},${100 - i * 12} L60,50`}
            stroke="#e0c068"
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
            style={{
              filter: 'drop-shadow(0 0 6px #d4a044)',
            }}
          />
        </motion.svg>
      ))}

      {/* Boulder debris (12 chunks) */}
      {Array.from({ length: 12 }).map((_, i) => (
        <motion.div
          key={`boulder-${i}`}
          className="absolute"
          style={{
            width: 20 + (i % 5) * 10,
            height: 20 + (i % 5) * 10,
            background: `linear-gradient(135deg, #b8a038 0%, #8b7628 100%)`,
            borderRadius: '30% 70% 50% 50% / 60% 40% 60% 40%',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5), inset -2px -2px 8px rgba(0,0,0,0.3)',
            left: isLeftToRight ? `${5 + (i % 6) * 15}%` : 'auto',
            right: isLeftToRight ? 'auto' : `${5 + (i % 6) * 15}%`,
            bottom: '10%',
          }}
          initial={{ opacity: 0, y: -100, scale: 0, rotate: 0 }}
          animate={{
            opacity: [0, 1, 0.9, 0],
            y: [-100, 0, 20, 60],
            scale: [0, 1.2, 1, 0.8],
            rotate: [0, (i % 2 === 0 ? 180 : -180), (i % 2 === 0 ? 360 : -360)],
          }}
          transition={{
            duration: 0.9,
            delay: 0.1 + i * 0.06,
            ease: 'easeOut',
          }}
        />
      ))}

      {/* Dust particles (25 particles) */}
      {Array.from({ length: 25 }).map((_, i) => (
        <motion.div
          key={`dust-${i}`}
          className="absolute rounded-full"
          style={{
            width: 6 + (i % 4) * 4,
            height: 6 + (i % 4) * 4,
            background: i % 3 === 0 ? 'rgba(224,192,104,0.8)' : 'rgba(184,160,56,0.7)',
            boxShadow: `0 0 10px ${i % 3 === 0 ? 'rgba(224,192,104,0.6)' : 'rgba(184,160,56,0.5)'}`,
            left: isLeftToRight ? `${8 + (i % 8) * 11}%` : 'auto',
            right: isLeftToRight ? 'auto' : `${8 + (i % 8) * 11}%`,
            bottom: `${5 + (i % 6) * 8}%`,
          }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{
            opacity: [0, 0.9, 0.6, 0],
            scale: [0, 1, 1.3, 1.1],
            x: isLeftToRight
              ? [0, 40 + i * 6, 80 + i * 10]
              : [0, -40 - i * 6, -80 - i * 10],
            y: [0, -30 - (i % 5) * 10, -60 - (i % 4) * 15],
          }}
          transition={{
            duration: 0.7 + (i % 5) * 0.12,
            delay: 0.2 + i * 0.04,
            ease: 'easeOut',
          }}
        />
      ))}

      {/* Shockwave ring from impact point */}
      <motion.div
        className="absolute rounded-full border-4"
        style={{
          width: 80,
          height: 80,
          borderColor: 'rgba(224,192,104,0.8)',
          left: isLeftToRight ? 'auto' : '10%',
          right: isLeftToRight ? '10%' : 'auto',
          bottom: '15%',
          boxShadow: '0 0 30px rgba(224,192,104,0.6)',
        }}
        initial={{ scale: 0.3, opacity: 0 }}
        animate={{
          scale: [0.3, 2.5, 4],
          opacity: [0, 1, 0],
        }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
      />

      {/* Screen tint - brown/dust */}
      <motion.div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at 50% 80%, rgba(224,192,104,0.2) 0%, transparent 60%)',
          mixBlendMode: 'multiply',
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.7, 0.4, 0] }}
        transition={{ duration: 1.0 }}
      />
    </div>
  )
}
