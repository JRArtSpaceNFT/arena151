/**
 * Ghost Attack Animation
 * Spectral, phasing, haunting, ethereal
 * Visual language: Shadow wisps, phase shift, spectral hands, reality tear
 */

'use client'

import { motion } from 'framer-motion'

interface GhostAttackProps {
  direction: 'left-to-right' | 'right-to-left'
  onComplete?: () => void
}

export function GhostAttack({ direction, onComplete }: GhostAttackProps) {
  const isLeftToRight = direction === 'left-to-right'

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {/* Spectral phantom form */}
      <motion.div
        className="absolute w-96 h-96 rounded-full blur-3xl"
        style={{
          background: 'radial-gradient(ellipse, rgba(112,88,152,0.7) 0%, rgba(90,70,120,0.4) 40%, transparent 70%)',
          left: isLeftToRight ? '-10%' : 'auto',
          right: isLeftToRight ? 'auto' : '-10%',
          top: '25%',
        }}
        initial={{ opacity: 0, scale: 0.4 }}
        animate={{
          opacity: [0, 0.9, 0.7, 0],
          scale: [0.4, 1.2, 1.4, 1.6],
          x: isLeftToRight ? ['0%', '120%'] : ['0%', '-120%'],
        }}
        transition={{ duration: 1.3, ease: 'easeInOut' }}
        onAnimationComplete={onComplete}
      />

      {/* Shadow wisps (12 ethereal trails) */}
      {Array.from({ length: 12 }).map((_, i) => (
        <motion.div
          key={`wisp-${i}`}
          className="absolute"
          style={{
            width: 40 + (i % 4) * 20,
            height: 80 + (i % 5) * 30,
            background: `linear-gradient(${i % 2 === 0 ? '180' : '0'}deg, rgba(112,88,152,0.8) 0%, rgba(90,70,120,0.5) 40%, transparent 100%)`,
            borderRadius: '50% 50% 50% 50% / 30% 30% 70% 70%',
            filter: 'blur(12px)',
            left: isLeftToRight ? `${-5 + (i % 5) * 15}%` : 'auto',
            right: isLeftToRight ? 'auto' : `${-5 + (i % 5) * 15}%`,
            top: `${10 + (i % 8) * 10}%`,
          }}
          initial={{ opacity: 0, scaleY: 0 }}
          animate={{
            opacity: [0, 0.8, 0.6, 0],
            scaleY: [0, 1, 1.3, 0.8],
            x: isLeftToRight
              ? [0, 60 + i * 12, 120 + i * 18]
              : [0, -60 - i * 12, -120 - i * 18],
            y: [0, (i % 2 === 0 ? -20 : 20) + (i % 3) * 10, (i % 2 === 0 ? 10 : -10)],
          }}
          transition={{
            duration: 0.9 + (i % 5) * 0.15,
            delay: i * 0.05,
            ease: 'easeInOut',
          }}
        />
      ))}

      {/* Spectral hands reaching (5 ghostly hands) */}
      {Array.from({ length: 5 }).map((_, i) => (
        <motion.div
          key={`hand-${i}`}
          className="absolute"
          style={{
            width: 60 + (i % 3) * 20,
            height: 80 + (i % 3) * 30,
            background: 'radial-gradient(ellipse at 50% 30%, rgba(112,88,152,0.6) 0%, rgba(70,50,100,0.4) 60%, transparent 100%)',
            borderRadius: '40% 40% 60% 60% / 50% 50% 50% 50%',
            filter: 'blur(10px)',
            left: isLeftToRight ? `${10 + i * 18}%` : 'auto',
            right: isLeftToRight ? 'auto' : `${10 + i * 18}%`,
            top: `${20 + (i % 6) * 13}%`,
          }}
          initial={{ opacity: 0, scale: 0, rotate: 0 }}
          animate={{
            opacity: [0, 0.9, 0.7, 0],
            scale: [0, 1.2, 1, 0.8],
            rotate: [0, (i % 2 === 0 ? 15 : -15)],
            x: isLeftToRight ? [0, 80 + i * 15] : [0, -80 - i * 15],
          }}
          transition={{
            duration: 0.8,
            delay: 0.1 + i * 0.12,
            ease: 'easeOut',
          }}
        />
      ))}

      {/* Reality tear/phase rift (3 vertical distortions) */}
      {Array.from({ length: 3 }).map((_, i) => (
        <motion.div
          key={`rift-${i}`}
          className="absolute"
          style={{
            width: 6 + i * 4,
            height: 200 + i * 50,
            background: 'linear-gradient(90deg, transparent 0%, rgba(112,88,152,0.9) 20%, rgba(160,120,200,0.7) 50%, rgba(112,88,152,0.9) 80%, transparent 100%)',
            boxShadow: '0 0 30px rgba(112,88,152,0.8), 0 0 60px rgba(160,120,200,0.5)',
            left: isLeftToRight ? `${25 + i * 25}%` : 'auto',
            right: isLeftToRight ? 'auto' : `${25 + i * 25}%`,
            top: '10%',
            filter: 'blur(4px)',
          }}
          initial={{ opacity: 0, scaleX: 0 }}
          animate={{
            opacity: [0, 1, 0.8, 0],
            scaleX: [0, 1, 1.2, 0],
          }}
          transition={{
            duration: 0.6,
            delay: 0.2 + i * 0.15,
            ease: 'easeInOut',
          }}
        />
      ))}

      {/* Haunting orbs (18 floating spirit lights) */}
      {Array.from({ length: 18 }).map((_, i) => (
        <motion.div
          key={`orb-${i}`}
          className="absolute rounded-full"
          style={{
            width: 8 + (i % 4) * 6,
            height: 8 + (i % 4) * 6,
            background: 'radial-gradient(circle, rgba(160,120,200,0.9) 0%, rgba(112,88,152,0.6) 60%, transparent 100%)',
            boxShadow: `0 0 20px ${i % 2 === 0 ? 'rgba(160,120,200,0.8)' : 'rgba(112,88,152,0.7)'}`,
            left: isLeftToRight ? `${5 + (i % 7) * 13}%` : 'auto',
            right: isLeftToRight ? 'auto' : `${5 + (i % 7) * 13}%`,
            top: `${15 + (i % 9) * 8}%`,
          }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{
            opacity: [0, 1, 0.7, 0],
            scale: [0, 1.3, 1, 0.8],
            x: isLeftToRight
              ? [0, 50 + i * 8, 100 + i * 12]
              : [0, -50 - i * 8, -100 - i * 12],
            y: [
              0,
              (i % 2 === 0 ? -15 : 15) + Math.sin(i) * 10,
              (i % 2 === 0 ? 10 : -10) + Math.cos(i) * 8,
            ],
          }}
          transition={{
            duration: 0.8 + (i % 5) * 0.12,
            delay: i * 0.04,
            ease: 'easeInOut',
          }}
        />
      ))}

      {/* Ectoplasm drips (8 ghostly drips) */}
      {Array.from({ length: 8 }).map((_, i) => (
        <motion.div
          key={`ecto-${i}`}
          className="absolute"
          style={{
            width: 6 + (i % 2) * 4,
            height: 60 + (i % 4) * 25,
            background: 'linear-gradient(180deg, rgba(112,88,152,0.7) 0%, rgba(70,50,100,0.5) 60%, transparent 100%)',
            borderRadius: '50% 50% 50% 50% / 20% 20% 80% 80%',
            filter: 'blur(6px)',
            left: isLeftToRight ? `${15 + (i % 6) * 14}%` : 'auto',
            right: isLeftToRight ? 'auto' : `${15 + (i % 6) * 14}%`,
            top: `${10 + (i % 5) * 15}%`,
          }}
          initial={{ opacity: 0, scaleY: 0 }}
          animate={{
            opacity: [0, 0.8, 0.6, 0],
            scaleY: [0, 1, 1.4, 0.8],
            x: isLeftToRight ? [0, 30 + i * 8] : [0, -30 - i * 8],
          }}
          transition={{
            duration: 0.7 + (i % 4) * 0.1,
            delay: 0.15 + i * 0.06,
            ease: 'easeIn',
          }}
        />
      ))}

      {/* Pulse ripples (4 expanding spectral waves) */}
      {Array.from({ length: 4 }).map((_, i) => (
        <motion.div
          key={`pulse-${i}`}
          className="absolute rounded-full border-2"
          style={{
            width: 80,
            height: 80,
            borderColor: 'rgba(112,88,152,0.6)',
            left: isLeftToRight ? `${20 + i * 15}%` : 'auto',
            right: isLeftToRight ? 'auto' : `${20 + i * 15}%`,
            top: '35%',
            boxShadow: '0 0 25px rgba(112,88,152,0.5)',
          }}
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{
            scale: [0.5, 2, 3.5],
            opacity: [0, 0.8, 0],
          }}
          transition={{
            duration: 1.0,
            delay: i * 0.18,
            ease: 'easeOut',
          }}
        />
      ))}

      {/* Screen tint - purple spectral haze */}
      <motion.div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(112,88,152,0.3) 0%, transparent 65%)',
          mixBlendMode: 'multiply',
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.8, 0.5, 0] }}
        transition={{ duration: 1.3 }}
      />
    </div>
  )
}
