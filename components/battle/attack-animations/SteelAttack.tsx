/**
 * Steel Attack Animation
 * Metallic, slicing, precise, unyielding
 * Visual language: Metal shards, blade flash, steel impact, iron rain
 */

'use client'

import { motion } from 'framer-motion'

interface SteelAttackProps {
  direction: 'left-to-right' | 'right-to-left'
  onComplete?: () => void
}

export function SteelAttack({ direction, onComplete }: SteelAttackProps) {
  const isLeftToRight = direction === 'left-to-right'

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {/* Metallic flash wave */}
      <motion.div
        className="absolute w-full h-96 blur-2xl"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, rgba(184,184,208,0.8) 30%, rgba(220,220,235,0.6) 50%, rgba(184,184,208,0.8) 70%, transparent 100%)',
          top: '20%',
          left: isLeftToRight ? '-20%' : 'auto',
          right: isLeftToRight ? 'auto' : '-20%',
        }}
        initial={{ opacity: 0, scaleX: 0 }}
        animate={{
          opacity: [0, 1, 0.7, 0],
          scaleX: [0, 1.5, 1.8, 2],
          x: isLeftToRight ? ['0%', '90%'] : ['0%', '-90%'],
        }}
        transition={{ duration: 1.1, ease: 'easeOut' }}
        onAnimationComplete={onComplete}
      />

      {/* Blade slashes (10 razor-sharp cuts) */}
      {Array.from({ length: 10 }).map((_, i) => (
        <motion.div
          key={`blade-${i}`}
          className="absolute"
          style={{
            width: 150 + (i % 4) * 40,
            height: 4 + (i % 2) * 3,
            background: 'linear-gradient(90deg, transparent 0%, rgba(220,220,235,1) 30%, rgba(255,255,255,0.9) 50%, rgba(220,220,235,1) 70%, transparent 100%)',
            boxShadow: '0 0 25px rgba(220,220,235,0.9), 0 0 50px rgba(184,184,208,0.6)',
            left: isLeftToRight ? `${-5 + (i % 5) * 12}%` : 'auto',
            right: isLeftToRight ? 'auto' : `${-5 + (i % 5) * 12}%`,
            top: `${18 + (i % 8) * 9}%`,
            transform: `rotate(${isLeftToRight ? 5 - i * 3 : -5 + i * 3}deg)`,
          }}
          initial={{ opacity: 0, scaleX: 0 }}
          animate={{
            opacity: [0, 1, 0.9, 0],
            scaleX: [0, 1.8, 2, 1.5],
            x: isLeftToRight ? [0, 140 + i * 18] : [0, -140 - i * 18],
          }}
          transition={{
            duration: 0.45 + (i % 4) * 0.08,
            delay: i * 0.05,
            ease: 'easeOut',
          }}
        />
      ))}

      {/* Metal shards (25 spinning fragments) */}
      {Array.from({ length: 25 }).map((_, i) => (
        <motion.div
          key={`shard-${i}`}
          className="absolute"
          style={{
            width: 12 + (i % 4) * 6,
            height: 4 + (i % 3) * 3,
            background: `linear-gradient(135deg, ${i % 3 === 0 ? '#dcdce3' : i % 3 === 1 ? '#b8b8d0' : '#a0a0bb'} 0%, ${i % 2 === 0 ? '#f0f0f5' : '#c8c8dd'} 100%)`,
            boxShadow: '0 2px 8px rgba(0,0,0,0.3), inset 0 1px 2px rgba(255,255,255,0.5)',
            clipPath: 'polygon(0% 50%, 30% 0%, 100% 40%, 70% 100%)',
            left: isLeftToRight ? `${8 + (i % 8) * 11}%` : 'auto',
            right: isLeftToRight ? 'auto' : `${8 + (i % 8) * 11}%`,
            top: `${22 + (i % 7) * 10}%`,
          }}
          initial={{ opacity: 0, scale: 0, rotate: 0 }}
          animate={{
            opacity: [0, 1, 0.8, 0],
            scale: [0, 1.3, 1.5, 1.1],
            rotate: [0, (i % 2 === 0 ? 720 : -720)],
            x: isLeftToRight
              ? [0, 60 + i * 10, 120 + i * 14]
              : [0, -60 - i * 10, -120 - i * 14],
            y: [0, -25 + (i % 4) * 12, 15 + (i % 5) * 10],
          }}
          transition={{
            duration: 0.7 + (i % 5) * 0.12,
            delay: 0.08 + i * 0.03,
            ease: 'easeOut',
          }}
        />
      ))}

      {/* Iron rain (15 falling metal spikes) */}
      {Array.from({ length: 15 }).map((_, i) => (
        <motion.div
          key={`spike-${i}`}
          className="absolute"
          style={{
            width: 6 + (i % 2) * 3,
            height: 40 + (i % 4) * 20,
            background: 'linear-gradient(180deg, rgba(220,220,235,0.9) 0%, rgba(184,184,208,0.7) 70%, rgba(160,160,187,0.5) 100%)',
            clipPath: 'polygon(50% 0%, 100% 80%, 50% 100%, 0% 80%)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4), inset 0 1px 3px rgba(255,255,255,0.4)',
            left: isLeftToRight ? `${10 + (i % 6) * 14}%` : 'auto',
            right: isLeftToRight ? 'auto' : `${10 + (i % 6) * 14}%`,
            top: `${-10 + (i % 4) * 8}%`,
          }}
          initial={{ opacity: 0, y: -150, rotate: 0 }}
          animate={{
            opacity: [0, 1, 0.9, 0],
            y: [-150, 100 + (i % 6) * 50, 250 + (i % 5) * 60],
            rotate: [0, (i % 2 === 0 ? 180 : -180)],
            x: isLeftToRight ? [0, 40 + i * 8] : [0, -40 - i * 8],
          }}
          transition={{
            duration: 0.8 + (i % 5) * 0.1,
            delay: 0.1 + i * 0.05,
            ease: 'easeIn',
          }}
        />
      ))}

      {/* Metallic sparks (35 bright flashes) */}
      {Array.from({ length: 35 }).map((_, i) => (
        <motion.div
          key={`spark-${i}`}
          className="absolute rounded-full"
          style={{
            width: 3 + (i % 3) * 2,
            height: 3 + (i % 3) * 2,
            background: i % 3 === 0 ? '#ffffff' : i % 3 === 1 ? '#dcdce3' : '#b8b8d0',
            boxShadow: `0 0 12px ${i % 2 === 0 ? '#ffffff' : '#dcdce3'}`,
            left: isLeftToRight ? `${10 + (i % 10) * 9}%` : 'auto',
            right: isLeftToRight ? 'auto' : `${10 + (i % 10) * 9}%`,
            top: `${25 + (i % 9) * 8}%`,
          }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{
            opacity: [0, 1, 0.7, 0],
            scale: [0, 1.5, 1.8, 1],
            x: isLeftToRight
              ? [0, 35 + i * 5, 70 + i * 8]
              : [0, -35 - i * 5, -70 - i * 8],
            y: [0, (i % 2 === 0 ? -20 : 20) + (i % 3) * 7, (i % 2 === 0 ? -35 : 35)],
          }}
          transition={{
            duration: 0.5 + (i % 5) * 0.08,
            delay: i * 0.02,
            ease: 'easeOut',
          }}
        />
      ))}

      {/* Steel impact rings (4 metallic shockwaves) */}
      {Array.from({ length: 4 }).map((_, i) => (
        <motion.div
          key={`ring-${i}`}
          className="absolute rounded-full border-3"
          style={{
            width: 90,
            height: 90,
            borderColor: 'rgba(220,220,235,0.8)',
            borderWidth: 3,
            left: isLeftToRight ? 'auto' : '22%',
            right: isLeftToRight ? '22%' : 'auto',
            top: '32%',
            boxShadow: '0 0 30px rgba(220,220,235,0.7), inset 0 0 20px rgba(255,255,255,0.3)',
          }}
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{
            scale: [0.4, 2 + i * 0.4, 3.5 + i * 0.5],
            opacity: [0, 1, 0],
          }}
          transition={{
            duration: 0.8,
            delay: 0.15 + i * 0.12,
            ease: 'easeOut',
          }}
        />
      ))}

      {/* Chrome reflection sweep */}
      <motion.div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 45%, rgba(255,255,255,0.5) 50%, rgba(255,255,255,0.3) 55%, transparent 100%)',
        }}
        initial={{ x: isLeftToRight ? '-100%' : '100%', opacity: 0 }}
        animate={{
          x: isLeftToRight ? ['- 100%', '200%'] : ['100%', '-200%'],
          opacity: [0, 1, 0.8, 0],
        }}
        transition={{ duration: 0.9, ease: 'easeOut' }}
      />

      {/* Screen tint - silver metallic gleam */}
      <motion.div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(220,220,235,0.2) 0%, transparent 60%)',
          mixBlendMode: 'screen',
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.8, 0.5, 0] }}
        transition={{ duration: 1.1 }}
      />
    </div>
  )
}
