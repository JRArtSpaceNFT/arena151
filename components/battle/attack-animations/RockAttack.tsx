/**
 * Rock Attack Animation
 * Heavy, crushing, jagged, unyielding
 * Visual language: Boulder barrage, stone shards, rock slide, dust impact
 */

'use client'

import { motion } from 'framer-motion'

interface RockAttackProps {
  direction: 'left-to-right' | 'right-to-left'
  onComplete?: () => void
}

export function RockAttack({ direction, onComplete }: RockAttackProps) {
  const isLeftToRight = direction === 'left-to-right'

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {/* Main boulder (1 massive rock) */}
      <motion.div
        className="absolute"
        style={{
          width: 180,
          height: 180,
          background: 'linear-gradient(135deg, #b8a038 0%, #9a8530 40%, #7a6520 100%)',
          borderRadius: '35% 65% 55% 45% / 60% 50% 50% 40%',
          boxShadow: '0 12px 40px rgba(0,0,0,0.7), inset -8px -8px 30px rgba(0,0,0,0.4), inset 4px 4px 20px rgba(255,255,255,0.1)',
          left: isLeftToRight ? '-15%' : 'auto',
          right: isLeftToRight ? 'auto' : '-15%',
          top: '20%',
        }}
        initial={{ opacity: 0, scale: 0.5, rotate: 0, x: 0 }}
        animate={{
          opacity: [0, 1, 1, 0.8],
          scale: [0.5, 1.2, 1.3, 1.1],
          rotate: [0, isLeftToRight ? 180 : -180, isLeftToRight ? 360 : -360],
          x: isLeftToRight ? ['0%', '600%'] : ['0%', '-600%'],
        }}
        transition={{ duration: 1.2, ease: 'easeIn' }}
        onAnimationComplete={onComplete}
      />

      {/* Boulder debris field (15 smaller rocks) */}
      {Array.from({ length: 15 }).map((_, i) => (
        <motion.div
          key={`rock-${i}`}
          className="absolute"
          style={{
            width: 25 + (i % 6) * 12,
            height: 25 + (i % 6) * 12,
            background: `linear-gradient(${120 + i * 20}deg, #b8a038 0%, #8a7628 60%, #6a5518 100%)`,
            borderRadius: '40% 60% 50% 50% / 55% 45% 55% 45%',
            boxShadow: '0 6px 20px rgba(0,0,0,0.6), inset -3px -3px 12px rgba(0,0,0,0.3)',
            left: isLeftToRight ? `${-5 + (i % 5) * 15}%` : 'auto',
            right: isLeftToRight ? 'auto' : `${-5 + (i % 5) * 15}%`,
            top: `${15 + (i % 8) * 10}%`,
          }}
          initial={{ opacity: 0, scale: 0, rotate: 0 }}
          animate={{
            opacity: [0, 1, 0.9, 0.6],
            scale: [0, 1.1, 1.2, 1],
            rotate: [0, (i % 2 === 0 ? 270 : -270)],
            x: isLeftToRight
              ? [0, 80 + i * 15, 160 + i * 20]
              : [0, -80 - i * 15, -160 - i * 20],
            y: [0, -40 + (i % 4) * 20, 30 + (i % 5) * 15],
          }}
          transition={{
            duration: 0.9 + (i % 5) * 0.12,
            delay: 0.05 + i * 0.04,
            ease: 'easeOut',
          }}
        />
      ))}

      {/* Stone shards (20 sharp fragments) */}
      {Array.from({ length: 20 }).map((_, i) => (
        <motion.div
          key={`shard-${i}`}
          className="absolute"
          style={{
            width: 8 + (i % 3) * 4,
            height: 20 + (i % 4) * 10,
            background: 'linear-gradient(135deg, #c4b050 0%, #9a8530 100%)',
            clipPath: 'polygon(50% 0%, 100% 100%, 0% 100%)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            left: isLeftToRight ? `${5 + (i % 7) * 12}%` : 'auto',
            right: isLeftToRight ? 'auto' : `${5 + (i % 7) * 12}%`,
            top: `${20 + (i % 8) * 9}%`,
          }}
          initial={{ opacity: 0, scale: 0, rotate: 0 }}
          animate={{
            opacity: [0, 1, 0.8, 0],
            scale: [0, 1.2, 1, 0.8],
            rotate: [0, (i % 2 === 0 ? 360 : -360)],
            x: isLeftToRight
              ? [0, 60 + i * 10, 120 + i * 12]
              : [0, -60 - i * 10, -120 - i * 12],
            y: [0, -25 + (i % 3) * 15, 20 + (i % 4) * 10],
          }}
          transition={{
            duration: 0.7 + (i % 5) * 0.1,
            delay: 0.1 + i * 0.03,
            ease: 'easeOut',
          }}
        />
      ))}

      {/* Rock dust cloud */}
      <motion.div
        className="absolute w-full h-96 blur-3xl"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, rgba(184,160,56,0.5) 30%, rgba(154,133,48,0.4) 60%, transparent 100%)',
          bottom: '0%',
          left: isLeftToRight ? '-20%' : 'auto',
          right: isLeftToRight ? 'auto' : '-20%',
        }}
        initial={{ opacity: 0, scaleX: 0 }}
        animate={{
          opacity: [0, 0.8, 0.6, 0],
          scaleX: [0, 1.2, 1.5, 1.8],
          x: isLeftToRight ? ['0%', '80%'] : ['0%', '-80%'],
        }}
        transition={{ duration: 1.1, ease: 'easeOut' }}
      />

      {/* Impact shockwave rings (3 expanding) */}
      {Array.from({ length: 3 }).map((_, i) => (
        <motion.div
          key={`shockwave-${i}`}
          className="absolute rounded-full border-4"
          style={{
            width: 100,
            height: 100,
            borderColor: 'rgba(184,160,56,0.7)',
            left: isLeftToRight ? 'auto' : '15%',
            right: isLeftToRight ? '15%' : 'auto',
            top: '35%',
            boxShadow: '0 0 30px rgba(184,160,56,0.5)',
          }}
          initial={{ scale: 0.3, opacity: 0 }}
          animate={{
            scale: [0.3, 2 + i * 0.5, 3.5 + i * 0.5],
            opacity: [0, 0.9, 0],
          }}
          transition={{
            duration: 0.8,
            delay: 0.4 + i * 0.15,
            ease: 'easeOut',
          }}
        />
      ))}

      {/* Gravel spray (25 tiny pebbles) */}
      {Array.from({ length: 25 }).map((_, i) => (
        <motion.div
          key={`gravel-${i}`}
          className="absolute rounded-full"
          style={{
            width: 4 + (i % 3) * 2,
            height: 4 + (i % 3) * 2,
            background: i % 3 === 0 ? '#b8a038' : i % 3 === 1 ? '#9a8530' : '#7a6520',
            boxShadow: `0 2px 6px rgba(0,0,0,0.4)`,
            left: isLeftToRight ? `${10 + (i % 9) * 9}%` : 'auto',
            right: isLeftToRight ? 'auto' : `${10 + (i % 9) * 9}%`,
            top: `${25 + (i % 7) * 10}%`,
          }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{
            opacity: [0, 1, 0.8, 0],
            scale: [0, 1, 1.2, 0.9],
            x: isLeftToRight
              ? [0, 50 + i * 7, 100 + i * 10]
              : [0, -50 - i * 7, -100 - i * 10],
            y: [0, -30 - (i % 5) * 8, 10 + (i % 4) * 12],
          }}
          transition={{
            duration: 0.6 + (i % 5) * 0.1,
            delay: 0.15 + i * 0.02,
            ease: 'easeOut',
          }}
        />
      ))}

      {/* Screen tint - brown/gray stone */}
      <motion.div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at 50% 60%, rgba(184,160,56,0.25) 0%, transparent 60%)',
          mixBlendMode: 'multiply',
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.8, 0.5, 0] }}
        transition={{ duration: 1.2 }}
      />
    </div>
  )
}
