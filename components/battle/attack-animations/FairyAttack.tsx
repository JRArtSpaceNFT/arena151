/**
 * Fairy Attack Animation
 * Magical, sparkling, whimsical, enchanting
 * Visual language: Pixie dust, moonbeam, rainbow shimmer, fairy lights
 */

'use client'

import { motion } from 'framer-motion'

interface FairyAttackProps {
  direction: 'left-to-right' | 'right-to-left'
  onComplete?: () => void
}

export function FairyAttack({ direction, onComplete }: FairyAttackProps) {
  const isLeftToRight = direction === 'left-to-right'

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {/* Moonbeam glow */}
      <motion.div
        className="absolute w-96 h-full blur-3xl"
        style={{
          background: 'linear-gradient(180deg, rgba(238,153,172,0.6) 0%, rgba(255,200,220,0.4) 50%, transparent 100%)',
          left: isLeftToRight ? '0%' : 'auto',
          right: isLeftToRight ? 'auto' : '0%',
          top: '-10%',
          width: 300,
        }}
        initial={{ opacity: 0, scaleY: 0 }}
        animate={{
          opacity: [0, 0.9, 0.7, 0],
          scaleY: [0, 1.2, 1.4, 1.6],
          x: isLeftToRight ? ['0%', '300%'] : ['0%', '-300%'],
        }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
        onAnimationComplete={onComplete}
      />

      {/* Rainbow shimmer arc */}
      <motion.div
        className="absolute w-full h-80"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, rgba(238,153,172,0.4) 15%, rgba(255,180,200,0.5) 25%, rgba(255,220,240,0.4) 35%, rgba(200,180,255,0.5) 45%, rgba(180,200,255,0.4) 55%, transparent 70%)',
          top: '25%',
          left: isLeftToRight ? '-20%' : 'auto',
          right: isLeftToRight ? 'auto' : '-20%',
          filter: 'blur(20px)',
        }}
        initial={{ opacity: 0, scaleX: 0 }}
        animate={{
          opacity: [0, 0.8, 0.6, 0],
          scaleX: [0, 1.3, 1.6, 1.8],
          x: isLeftToRight ? ['0%', '100%'] : ['0%', '-100%'],
        }}
        transition={{ duration: 1.1, ease: 'easeOut' }}
      />

      {/* Pixie dust sparkles (50 magical particles) */}
      {Array.from({ length: 50 }).map((_, i) => {
        const colors = ['#ee99ac', '#ffb4c8', '#ffc8dc', '#c8b4ff', '#b4c8ff', '#ffe4f0'];
        const color = colors[i % colors.length];
        return (
          <motion.div
            key={`pixie-${i}`}
            className="absolute"
            style={{
              width: 4 + (i % 4) * 3,
              height: 4 + (i % 4) * 3,
              background: `radial-gradient(circle, ${color} 0%, rgba(255,255,255,0.8) 40%, transparent 100%)`,
              boxShadow: `0 0 15px ${color}, 0 0 30px ${color}`,
              borderRadius: i % 3 === 0 ? '50%' : i % 3 === 1 ? '30% 70% 70% 30% / 30% 30% 70% 70%' : '40% 60% 60% 40% / 50% 50% 50% 50%',
              left: isLeftToRight ? `${-5 + (i % 11) * 9}%` : 'auto',
              right: isLeftToRight ? 'auto' : `${-5 + (i % 11) * 9}%`,
              top: `${10 + (i % 12) * 7}%`,
            }}
            initial={{ opacity: 0, scale: 0 }}
            animate={{
              opacity: [0, 1, 0.8, 0],
              scale: [0, 1.5, 1.8, 1.2],
              x: isLeftToRight
                ? [0, 50 + i * 6, 100 + i * 10, 150 + i * 12]
                : [0, -50 - i * 6, -100 - i * 10, -150 - i * 12],
              y: [
                0,
                (i % 2 === 0 ? -20 : 20) + Math.sin(i) * 10,
                (i % 2 === 0 ? 15 : -15) + Math.cos(i) * 8,
                (i % 2 === 0 ? -10 : 10),
              ],
            }}
            transition={{
              duration: 0.9 + (i % 6) * 0.12,
              delay: i * 0.02,
              ease: 'easeInOut',
            }}
          />
        );
      })}

      {/* Fairy lights (20 glowing orbs) */}
      {Array.from({ length: 20 }).map((_, i) => (
        <motion.div
          key={`light-${i}`}
          className="absolute rounded-full"
          style={{
            width: 12 + (i % 5) * 6,
            height: 12 + (i % 5) * 6,
            background: `radial-gradient(circle, ${i % 4 === 0 ? 'rgba(238,153,172,0.9)' : i % 4 === 1 ? 'rgba(255,180,200,0.8)' : i % 4 === 2 ? 'rgba(200,180,255,0.8)' : 'rgba(255,220,240,0.9)'} 0%, transparent 70%)`,
            boxShadow: `0 0 25px ${i % 2 === 0 ? '#ee99ac' : '#ffb4c8'}, 0 0 50px rgba(255,200,220,0.4)`,
            left: isLeftToRight ? `${8 + (i % 8) * 11}%` : 'auto',
            right: isLeftToRight ? 'auto' : `${8 + (i % 8) * 11}%`,
            top: `${18 + (i % 7) * 10}%`,
          }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{
            opacity: [0, 1, 0.7, 0],
            scale: [0, 1.4, 1.6, 1.2],
            x: isLeftToRight
              ? [0, 60 + i * 10, 120 + i * 15]
              : [0, -60 - i * 10, -120 - i * 15],
            y: [0, -15 + (i % 3) * 10, 10 + (i % 4) * 8],
          }}
          transition={{
            duration: 0.8 + (i % 5) * 0.14,
            delay: 0.05 + i * 0.04,
            ease: 'easeOut',
          }}
        />
      ))}

      {/* Enchanted hearts (8 floating hearts) */}
      {Array.from({ length: 8 }).map((_, i) => (
        <motion.div
          key={`heart-${i}`}
          className="absolute"
          style={{
            width: 20 + (i % 3) * 10,
            height: 18 + (i % 3) * 9,
            left: isLeftToRight ? `${12 + (i % 5) * 16}%` : 'auto',
            right: isLeftToRight ? 'auto' : `${12 + (i % 5) * 16}%`,
            top: `${22 + (i % 6) * 12}%`,
          }}
          initial={{ opacity: 0, scale: 0, rotate: 0 }}
          animate={{
            opacity: [0, 1, 0.8, 0],
            scale: [0, 1.3, 1.5, 1.2],
            rotate: [0, (i % 2 === 0 ? 15 : -15)],
            x: isLeftToRight ? [0, 70 + i * 12] : [0, -70 - i * 12],
            y: [0, -20 + (i % 3) * 10, 5 + (i % 4) * 8],
          }}
          transition={{
            duration: 0.9,
            delay: 0.08 + i * 0.09,
            ease: 'easeOut',
          }}
        >
          <svg viewBox="0 0 32 32" fill="none" className="w-full h-full">
            <path
              d="M16 28C16 28 4 20 4 12C4 8.5 6.5 6 10 6C12.5 6 14.5 7.5 16 9.5C17.5 7.5 19.5 6 22 6C25.5 6 28 8.5 28 12C28 20 16 28 16 28Z"
              fill={i % 3 === 0 ? '#ee99ac' : i % 3 === 1 ? '#ffb4c8' : '#ffc8dc'}
              stroke={i % 2 === 0 ? '#ff8fab' : '#ffa0bb'}
              strokeWidth="1.5"
              filter={`drop-shadow(0 0 10px ${i % 2 === 0 ? '#ee99ac' : '#ffb4c8'})`}
            />
          </svg>
        </motion.div>
      ))}

      {/* Star twinkles (25 tiny stars) */}
      {Array.from({ length: 25 }).map((_, i) => (
        <motion.div
          key={`star-${i}`}
          className="absolute"
          style={{
            width: 8 + (i % 3) * 4,
            height: 8 + (i % 3) * 4,
            left: isLeftToRight ? `${10 + (i % 9) * 10}%` : 'auto',
            right: isLeftToRight ? 'auto' : `${10 + (i % 9) * 10}%`,
            top: `${20 + (i % 8) * 9}%`,
          }}
          initial={{ opacity: 0, scale: 0, rotate: 0 }}
          animate={{
            opacity: [0, 1, 0.7, 0],
            scale: [0, 1.2, 1.4, 1],
            rotate: [0, (i % 2 === 0 ? 180 : -180)],
            x: isLeftToRight
              ? [0, 50 + i * 8, 100 + i * 12]
              : [0, -50 - i * 8, -100 - i * 12],
            y: [0, -12 + (i % 3) * 8, 8 + (i % 4) * 6],
          }}
          transition={{
            duration: 0.7 + (i % 5) * 0.1,
            delay: 0.1 + i * 0.03,
            ease: 'easeOut',
          }}
        >
          <svg viewBox="0 0 32 32" fill="none" className="w-full h-full">
            <path
              d="M16 2L18 14L16 16L14 14L16 2Z M16 30L18 18L16 16L14 18L16 30Z M2 16L14 18L16 16L14 14L2 16Z M30 16L18 18L16 16L18 14L30 16Z"
              fill={i % 3 === 0 ? '#ffffff' : i % 3 === 1 ? '#ffe4f0' : '#ffc8dc'}
              filter={`drop-shadow(0 0 8px ${i % 2 === 0 ? '#ffffff' : '#ee99ac'})`}
            />
          </svg>
        </motion.div>
      ))}

      {/* Magical ripples (5 expanding rings) */}
      {Array.from({ length: 5 }).map((_, i) => (
        <motion.div
          key={`ripple-${i}`}
          className="absolute rounded-full border-2"
          style={{
            width: 100,
            height: 100,
            borderColor: i % 2 === 0 ? 'rgba(238,153,172,0.6)' : 'rgba(255,180,200,0.5)',
            left: isLeftToRight ? `${20 + i * 15}%` : 'auto',
            right: isLeftToRight ? 'auto' : `${20 + i * 15}%`,
            top: '30%',
            boxShadow: `0 0 25px ${i % 2 === 0 ? 'rgba(238,153,172,0.5)' : 'rgba(255,180,200,0.4)'}`,
          }}
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{
            scale: [0.5, 2.2 + i * 0.3, 3.5 + i * 0.4],
            opacity: [0, 0.9, 0],
          }}
          transition={{
            duration: 0.9,
            delay: i * 0.14,
            ease: 'easeOut',
          }}
        />
      ))}

      {/* Screen tint - soft pink magical glow */}
      <motion.div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(238,153,172,0.25) 0%, rgba(255,220,240,0.15) 40%, transparent 70%)',
          mixBlendMode: 'screen',
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.9, 0.6, 0] }}
        transition={{ duration: 1.2 }}
      />
    </div>
  )
}
