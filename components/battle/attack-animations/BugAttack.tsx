/**
 * Bug Attack Animation
 * Swarm, stinging, chittering, relentless
 * Visual language: Bug swarm, stinger strikes, web strands, compound eye gleam
 */

'use client'

import { motion } from 'framer-motion'

interface BugAttackProps {
  direction: 'left-to-right' | 'right-to-left'
  onComplete?: () => void
}

export function BugAttack({ direction, onComplete }: BugAttackProps) {
  const isLeftToRight = direction === 'left-to-right'

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {/* Swarm cloud */}
      <motion.div
        className="absolute w-96 h-80 rounded-full blur-2xl"
        style={{
          background: 'radial-gradient(ellipse, rgba(168,184,32,0.5) 0%, rgba(138,154,22,0.3) 50%, transparent 80%)',
          left: isLeftToRight ? '-10%' : 'auto',
          right: isLeftToRight ? 'auto' : '-10%',
          top: '25%',
        }}
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{
          opacity: [0, 0.8, 0.6, 0],
          scale: [0.6, 1.1, 1.3, 1.5],
          x: isLeftToRight ? ['0%', '110%'] : ['0%', '-110%'],
        }}
        transition={{ duration: 1.0, ease: 'easeOut' }}
        onAnimationComplete={onComplete}
      />

      {/* Individual bugs (40 small insects) */}
      {Array.from({ length: 40 }).map((_, i) => (
        <motion.div
          key={`bug-${i}`}
          className="absolute"
          style={{
            width: 6 + (i % 3) * 3,
            height: 4 + (i % 2) * 2,
            background: i % 4 === 0 ? '#a8b820' : i % 4 === 1 ? '#8a9a16' : i % 4 === 2 ? '#6d7d12' : '#4a5508',
            borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%',
            boxShadow: `0 0 6px ${i % 3 === 0 ? '#a8b820' : '#8a9a16'}`,
            left: isLeftToRight ? `${-5 + (i % 10) * 10}%` : 'auto',
            right: isLeftToRight ? 'auto' : `${-5 + (i % 10) * 10}%`,
            top: `${10 + (i % 12) * 7}%`,
          }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{
            opacity: [0, 1, 0.8, 0],
            scale: [0, 1, 1.2, 0.8],
            x: isLeftToRight
              ? [0, 50 + i * 5, 100 + i * 8, 150 + i * 10]
              : [0, -50 - i * 5, -100 - i * 8, -150 - i * 10],
            y: [
              0,
              (i % 2 === 0 ? -15 : 15) + Math.sin(i) * 8,
              (i % 2 === 0 ? 10 : -10) + Math.cos(i) * 12,
              (i % 2 === 0 ? -5 : 5),
            ],
          }}
          transition={{
            duration: 0.8 + (i % 6) * 0.08,
            delay: i * 0.02,
            ease: 'easeInOut',
          }}
        />
      ))}

      {/* Stinger strikes (6 sharp darts) */}
      {Array.from({ length: 6 }).map((_, i) => (
        <motion.div
          key={`stinger-${i}`}
          className="absolute"
          style={{
            width: 30 + (i % 3) * 10,
            height: 3,
            background: 'linear-gradient(90deg, rgba(168,184,32,0.9) 0%, rgba(250,204,21,0.7) 50%, transparent 100%)',
            boxShadow: '0 0 15px rgba(168,184,32,0.8)',
            left: isLeftToRight ? `${5 + (i % 4) * 15}%` : 'auto',
            right: isLeftToRight ? 'auto' : `${5 + (i % 4) * 15}%`,
            top: `${20 + (i % 5) * 13}%`,
            transform: `rotate(${isLeftToRight ? i * 7 : -i * 7}deg)`,
          }}
          initial={{ opacity: 0, scaleX: 0 }}
          animate={{
            opacity: [0, 1, 0.8, 0],
            scaleX: [0, 1.5, 1.8, 1],
            x: isLeftToRight ? [0, 100 + i * 15] : [0, -100 - i * 15],
          }}
          transition={{
            duration: 0.4 + (i % 3) * 0.08,
            delay: 0.15 + i * 0.07,
            ease: 'easeOut',
          }}
        />
      ))}

      {/* Web strands (5 sticky threads) */}
      {Array.from({ length: 5 }).map((_, i) => (
        <motion.svg
          key={`web-${i}`}
          className="absolute"
          style={{
            left: isLeftToRight ? `${15 + i * 18}%` : 'auto',
            right: isLeftToRight ? 'auto' : `${15 + i * 18}%`,
            top: `${10 + i * 15}%`,
            width: 100,
            height: 150,
            filter: 'drop-shadow(0 0 8px rgba(168,184,32,0.6))',
          }}
          viewBox="0 0 100 150"
          initial={{ opacity: 0, pathLength: 0 }}
          animate={{
            opacity: [0, 0.8, 0.6, 0],
            pathLength: [0, 1, 1, 0.7],
          }}
          transition={{
            duration: 0.7,
            delay: 0.1 + i * 0.08,
            ease: 'easeInOut',
          }}
        >
          <motion.path
            d={`M${isLeftToRight ? 0 : 100},0 Q${50 + (i % 2 === 0 ? 20 : -20)},${60 + i * 10} ${isLeftToRight ? 100 : 0},150`}
            stroke="rgba(168,184,32,0.8)"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
          />
        </motion.svg>
      ))}

      {/* Compound eye gleam (3 flashes) */}
      {Array.from({ length: 3 }).map((_, i) => (
        <motion.div
          key={`gleam-${i}`}
          className="absolute rounded-full"
          style={{
            width: 60 + i * 20,
            height: 60 + i * 20,
            background: 'radial-gradient(circle, rgba(250,204,21,0.8) 0%, rgba(168,184,32,0.4) 40%, transparent 70%)',
            left: isLeftToRight ? `${25 + i * 20}%` : 'auto',
            right: isLeftToRight ? 'auto' : `${25 + i * 20}%`,
            top: `${30 + i * 15}%`,
          }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{
            opacity: [0, 1, 0, 0.6, 0],
            scale: [0, 1.2, 0.8, 1.4, 0],
          }}
          transition={{
            duration: 0.5,
            delay: 0.2 + i * 0.15,
            ease: 'easeInOut',
          }}
        />
      ))}

      {/* Chitin particles (20 small fragments) */}
      {Array.from({ length: 20 }).map((_, i) => (
        <motion.div
          key={`chitin-${i}`}
          className="absolute rounded-sm"
          style={{
            width: 4 + (i % 3) * 2,
            height: 4 + (i % 3) * 2,
            background: i % 2 === 0 ? '#a8b820' : '#8a9a16',
            boxShadow: `0 0 8px ${i % 2 === 0 ? '#a8b820' : '#8a9a16'}`,
            left: isLeftToRight ? `${8 + (i % 8) * 11}%` : 'auto',
            right: isLeftToRight ? 'auto' : `${8 + (i % 8) * 11}%`,
            top: `${20 + (i % 7) * 9}%`,
          }}
          initial={{ opacity: 0, scale: 0, rotate: 0 }}
          animate={{
            opacity: [0, 1, 0.7, 0],
            scale: [0, 1, 1.2, 0.8],
            rotate: [0, (i % 2 === 0 ? 180 : -180)],
            x: isLeftToRight
              ? [0, 40 + i * 6, 80 + i * 9]
              : [0, -40 - i * 6, -80 - i * 9],
            y: [0, -10 + (i % 3) * 8, 15 + (i % 4) * 6],
          }}
          transition={{
            duration: 0.6 + (i % 5) * 0.1,
            delay: 0.12 + i * 0.03,
            ease: 'easeOut',
          }}
        />
      ))}

      {/* Screen tint - yellow-green swarm haze */}
      <motion.div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(168,184,32,0.2) 0%, transparent 60%)',
          mixBlendMode: 'screen',
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.6, 0.4, 0] }}
        transition={{ duration: 1.0 }}
      />
    </div>
  )
}
