/**
 * Psychic Attack Animation
 * Mind waves, rippling reality, psionic energy, hypnotic spirals
 */

'use client'

import { motion } from 'framer-motion'

interface PsychicAttackProps {
  from: 'left' | 'right'
  onComplete?: () => void
}

export function PsychicAttack({ from, onComplete }: PsychicAttackProps) {
  const startX = from === 'left' ? 15 : 85
  const endX = from === 'left' ? 70 : 30

  return (
    <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
      {/* Psionic wave distortion */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ 
          scale: [0, 2, 3],
          opacity: [0, 0.8, 0],
        }}
        transition={{ duration: 1, ease: 'easeOut' }}
        onAnimationComplete={onComplete}
        className="absolute"
        style={{
          left: `${startX}%`,
          top: '45%',
          width: 200,
          height: 200,
          background: 'radial-gradient(circle, rgba(236, 72, 153, 0.6) 0%, rgba(168, 85, 247, 0.4) 40%, transparent 70%)',
          transform: 'translate(-50%, -50%)',
          filter: 'blur(20px)',
        }}
      />

      {/* Expanding ripple rings */}
      {Array.from({ length: 5 }).map((_, i) => (
        <motion.div
          key={`ripple-${i}`}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ 
            scale: [0, 3 + i * 0.5],
            opacity: [0, 0.6, 0],
          }}
          transition={{ 
            duration: 1.2,
            delay: i * 0.15,
            ease: 'easeOut',
          }}
          className="absolute rounded-full border-4"
          style={{
            left: `${endX}%`,
            top: '45%',
            width: 100,
            height: 100,
            borderColor: i % 2 === 0 ? '#EC4899' : '#A855F7',
            transform: 'translate(-50%, -50%)',
            boxShadow: `0 0 20px ${i % 2 === 0 ? '#EC4899' : '#A855F7'}`,
          }}
        />
      ))}

      {/* Hypnotic spiral */}
      <motion.div
        initial={{ scale: 0, opacity: 0, rotate: 0 }}
        animate={{ 
          scale: [0, 1.5, 2],
          opacity: [0, 0.9, 0],
          rotate: [0, 360 * 3],
        }}
        transition={{ duration: 1.5, ease: 'linear' }}
        className="absolute"
        style={{
          left: `${endX}%`,
          top: '45%',
          width: 150,
          height: 150,
          transform: 'translate(-50%, -50%)',
        }}
      >
        <svg width="150" height="150" viewBox="0 0 150 150">
          <defs>
            <radialGradient id="psychicGradient">
              <stop offset="0%" stopColor="#EC4899" stopOpacity="0.8" />
              <stop offset="50%" stopColor="#A855F7" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#7C3AED" stopOpacity="0" />
            </radialGradient>
          </defs>
          {/* Spiral path */}
          {Array.from({ length: 3 }).map((_, i) => (
            <motion.circle
              key={i}
              cx="75"
              cy="75"
              r={30 + i * 20}
              fill="none"
              stroke="url(#psychicGradient)"
              strokeWidth="3"
              strokeDasharray="10 5"
              style={{
                filter: 'drop-shadow(0 0 8px #EC4899)',
              }}
            />
          ))}
        </svg>
      </motion.div>

      {/* Floating psionic orbs */}
      {Array.from({ length: 10 }).map((_, i) => {
        const pathX = startX + ((endX - startX) * i) / 10
        const waveY = 45 + Math.sin(i * 0.8) * 8
        
        return (
          <motion.div
            key={`orb-${i}`}
            initial={{
              x: `${startX}%`,
              y: '45%',
              scale: 0,
              opacity: 0,
            }}
            animate={{
              x: `${pathX}%`,
              y: `${waveY}%`,
              scale: [0, 1, 0.8],
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: 0.8,
              delay: i * 0.06,
              ease: 'easeOut',
            }}
            className="absolute w-4 h-4 rounded-full"
            style={{
              background: i % 2 === 0 
                ? 'radial-gradient(circle, #EC4899 0%, #F472B6 100%)'
                : 'radial-gradient(circle, #A855F7 0%, #C084FC 100%)',
              boxShadow: i % 2 === 0 
                ? '0 0 12px #EC4899'
                : '0 0 12px #A855F7',
            }}
          />
        )
      })}

      {/* Mind wave particles */}
      {Array.from({ length: 20 }).map((_, i) => {
        const angle = (i / 20) * 360
        const radius = 40 + Math.random() * 30
        const destX = endX + Math.cos((angle * Math.PI) / 180) * (radius / 10)
        const destY = 45 + Math.sin((angle * Math.PI) / 180) * (radius / 10)
        
        return (
          <motion.div
            key={`particle-${i}`}
            initial={{
              x: `${endX}%`,
              y: '45%',
              scale: 0,
              opacity: 0,
            }}
            animate={{
              x: `${destX}%`,
              y: `${destY}%`,
              scale: [0, 1.2, 0],
              opacity: [0, 0.8, 0],
            }}
            transition={{
              duration: 0.9,
              delay: 0.6 + i * 0.02,
              ease: 'easeOut',
            }}
            className="absolute"
          >
            {/* Star particle */}
            <svg width="12" height="12" viewBox="0 0 12 12">
              <path
                d="M6 0 L7.5 4.5 L12 6 L7.5 7.5 L6 12 L4.5 7.5 L0 6 L4.5 4.5 Z"
                fill={i % 3 === 0 ? '#EC4899' : i % 3 === 1 ? '#A855F7' : '#F472B6'}
                style={{
                  filter: 'drop-shadow(0 0 3px #EC4899)',
                }}
              />
            </svg>
          </motion.div>
        )
      })}

      {/* Reality warp effect */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ 
          opacity: [0, 0.3, 0],
        }}
        transition={{ duration: 1, delay: 0.3 }}
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at 50% 45%, rgba(168, 85, 247, 0.2) 0%, transparent 60%)',
          backdropFilter: 'blur(2px)',
        }}
      />
    </div>
  )
}
