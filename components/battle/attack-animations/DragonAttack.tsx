/**
 * Dragon Attack Animation
 * Mythical, devastating, ancient power, overwhelming
 * Visual language: Dragon breath fire, scale shimmer, claw rend, ancient energy
 */

'use client'

import { motion } from 'framer-motion'

interface DragonAttackProps {
  direction: 'left-to-right' | 'right-to-left'
  onComplete?: () => void
}

export function DragonAttack({ direction, onComplete }: DragonAttackProps) {
  const isLeftToRight = direction === 'left-to-right'

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {/* Dragon breath cone (massive energy blast) */}
      <motion.div
        className="absolute blur-3xl"
        style={{
          width: 500,
          height: 400,
          background: 'conic-gradient(from 90deg at 0% 50%, rgba(112,56,248,0.9) 0%, rgba(160,80,255,0.7) 15%, rgba(200,120,255,0.5) 30%, transparent 35%)',
          left: isLeftToRight ? '-15%' : 'auto',
          right: isLeftToRight ? 'auto' : '-15%',
          top: '20%',
          transformOrigin: isLeftToRight ? 'left center' : 'right center',
        }}
        initial={{ opacity: 0, scaleX: 0, scaleY: 0.5 }}
        animate={{
          opacity: [0, 1, 0.8, 0],
          scaleX: [0, 1.8, 2.2, 2.5],
          scaleY: [0.5, 1, 1.2, 1.3],
        }}
        transition={{ duration: 1.4, ease: 'easeOut' }}
        onAnimationComplete={onComplete}
      />

      {/* Dragon energy orbs (20 massive glowing spheres) */}
      {Array.from({ length: 20 }).map((_, i) => (
        <motion.div
          key={`orb-${i}`}
          className="absolute rounded-full"
          style={{
            width: 25 + (i % 5) * 15,
            height: 25 + (i % 5) * 15,
            background: `radial-gradient(circle, ${i % 3 === 0 ? 'rgba(112,56,248,1)' : i % 3 === 1 ? 'rgba(160,80,255,0.9)' : 'rgba(200,120,255,0.8)'} 0%, rgba(70,30,180,0.5) 60%, transparent 100%)`,
            boxShadow: `0 0 40px ${i % 2 === 0 ? 'rgba(112,56,248,0.9)' : 'rgba(160,80,255,0.8)'}, 0 0 80px rgba(200,120,255,0.5)`,
            left: isLeftToRight ? `${-10 + (i % 6) * 15}%` : 'auto',
            right: isLeftToRight ? 'auto' : `${-10 + (i % 6) * 15}%`,
            top: `${15 + (i % 8) * 9}%`,
          }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{
            opacity: [0, 1, 0.8, 0],
            scale: [0, 1.4, 1.6, 1.2],
            x: isLeftToRight
              ? [0, 80 + i * 15, 160 + i * 25]
              : [0, -80 - i * 15, -160 - i * 25],
            y: [0, -20 + (i % 4) * 15, 10 + (i % 5) * 12],
          }}
          transition={{
            duration: 1.0 + (i % 5) * 0.15,
            delay: i * 0.04,
            ease: 'easeOut',
          }}
        />
      ))}

      {/* Ancient runes/glyphs (8 mystical symbols) */}
      {Array.from({ length: 8 }).map((_, i) => (
        <motion.div
          key={`rune-${i}`}
          className="absolute rounded-sm"
          style={{
            width: 30 + (i % 3) * 15,
            height: 30 + (i % 3) * 15,
            background: 'transparent',
            border: '3px solid rgba(112,56,248,0.8)',
            boxShadow: '0 0 25px rgba(112,56,248,0.7), inset 0 0 15px rgba(160,80,255,0.5)',
            left: isLeftToRight ? `${10 + (i % 5) * 16}%` : 'auto',
            right: isLeftToRight ? 'auto' : `${10 + (i % 5) * 16}%`,
            top: `${20 + (i % 6) * 12}%`,
          }}
          initial={{ opacity: 0, scale: 0, rotate: 0 }}
          animate={{
            opacity: [0, 1, 0.8, 0],
            scale: [0, 1.2, 1, 0.8],
            rotate: [0, (i % 2 === 0 ? 360 : -360)],
            x: isLeftToRight ? [0, 60 + i * 12] : [0, -60 - i * 12],
          }}
          transition={{
            duration: 0.9,
            delay: 0.1 + i * 0.08,
            ease: 'easeOut',
          }}
        >
          {/* Inner diamond */}
          <motion.div
            className="absolute inset-2 bg-transparent border-2 border-purple-400"
            style={{
              clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
              boxShadow: 'inset 0 0 10px rgba(200,120,255,0.6)',
            }}
            animate={{ rotate: i % 2 === 0 ? [0, -180, -360] : [0, 180, 360] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
          />
        </motion.div>
      ))}

      {/* Claw slash marks (6 devastating rends) */}
      {Array.from({ length: 6 }).map((_, i) => (
        <motion.div
          key={`claw-${i}`}
          className="absolute"
          style={{
            width: 140 + (i % 3) * 40,
            height: 10 + (i % 2) * 6,
            background: 'linear-gradient(90deg, transparent 0%, rgba(112,56,248,0.95) 20%, rgba(160,80,255,0.8) 50%, rgba(112,56,248,0.95) 80%, transparent 100%)',
            boxShadow: '0 0 30px rgba(112,56,248,0.9), 0 0 60px rgba(160,80,255,0.6)',
            left: isLeftToRight ? `${5 + (i % 4) * 12}%` : 'auto',
            right: isLeftToRight ? 'auto' : `${5 + (i % 4) * 12}%`,
            top: `${25 + (i % 7) * 10}%`,
            transform: `rotate(${isLeftToRight ? 8 - i * 4 : -8 + i * 4}deg)`,
          }}
          initial={{ opacity: 0, scaleX: 0 }}
          animate={{
            opacity: [0, 1, 0.9, 0],
            scaleX: [0, 1.5, 1.8, 1.2],
            x: isLeftToRight ? [0, 120 + i * 20] : [0, -120 - i * 20],
          }}
          transition={{
            duration: 0.6 + (i % 4) * 0.1,
            delay: 0.15 + i * 0.07,
            ease: 'easeOut',
          }}
        />
      ))}

      {/* Scale shimmer particles (30 reflective scales) */}
      {Array.from({ length: 30 }).map((_, i) => (
        <motion.div
          key={`scale-${i}`}
          className="absolute"
          style={{
            width: 10 + (i % 4) * 5,
            height: 10 + (i % 4) * 5,
            background: i % 4 === 0 
              ? 'linear-gradient(135deg, #7038f8 0%, #a050ff 100%)'
              : i % 4 === 1
              ? 'linear-gradient(135deg, #a050ff 0%, #c878ff 100%)'
              : i % 4 === 2
              ? 'linear-gradient(135deg, #8040f0 0%, #b060ff 100%)'
              : 'linear-gradient(135deg, #9048f8 0%, #d090ff 100%)',
            clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
            boxShadow: `0 0 15px ${i % 2 === 0 ? 'rgba(112,56,248,0.8)' : 'rgba(160,80,255,0.7)'}`,
            left: isLeftToRight ? `${8 + (i % 10) * 9}%` : 'auto',
            right: isLeftToRight ? 'auto' : `${8 + (i % 10) * 9}%`,
            top: `${20 + (i % 8) * 8}%`,
          }}
          initial={{ opacity: 0, scale: 0, rotate: 0 }}
          animate={{
            opacity: [0, 1, 0.8, 0],
            scale: [0, 1.2, 1.4, 1],
            rotate: [0, (i % 2 === 0 ? 180 : -180), (i % 2 === 0 ? 360 : -360)],
            x: isLeftToRight
              ? [0, 50 + i * 8, 100 + i * 12]
              : [0, -50 - i * 8, -100 - i * 12],
            y: [0, -15 + (i % 3) * 10, 10 + (i % 4) * 8],
          }}
          transition={{
            duration: 0.8 + (i % 5) * 0.1,
            delay: 0.1 + i * 0.03,
            ease: 'easeOut',
          }}
        />
      ))}

      {/* Mythical aura explosion (5 expanding energy rings) */}
      {Array.from({ length: 5 }).map((_, i) => (
        <motion.div
          key={`aura-${i}`}
          className="absolute rounded-full border-4"
          style={{
            width: 120,
            height: 120,
            borderColor: i % 2 === 0 ? 'rgba(112,56,248,0.7)' : 'rgba(160,80,255,0.6)',
            left: isLeftToRight ? 'auto' : '20%',
            right: isLeftToRight ? '20%' : 'auto',
            top: '30%',
            boxShadow: `0 0 40px ${i % 2 === 0 ? 'rgba(112,56,248,0.8)' : 'rgba(160,80,255,0.7)'}`,
          }}
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{
            scale: [0.4, 2.5 + i * 0.4, 4 + i * 0.5],
            opacity: [0, 1, 0],
          }}
          transition={{
            duration: 1.0,
            delay: 0.2 + i * 0.15,
            ease: 'easeOut',
          }}
        />
      ))}

      {/* Screen tint - deep purple dragon energy */}
      <motion.div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(112,56,248,0.35) 0%, rgba(70,30,180,0.2) 50%, transparent 75%)',
          mixBlendMode: 'screen',
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0.7, 0] }}
        transition={{ duration: 1.4 }}
      />
    </div>
  )
}
