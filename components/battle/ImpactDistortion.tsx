/**
 * Impact Distortion - Screen warping effect on heavy hits
 * Creates ripple/shockwave distortion at point of impact
 */

'use client'

import { motion, AnimatePresence } from 'framer-motion'

interface ImpactDistortionProps {
  isActive: boolean
  position?: { x: number; y: number }  // Percentage-based position
  intensity?: 'light' | 'medium' | 'heavy' | 'critical'
}

export default function ImpactDistortion({
  isActive,
  position = { x: 50, y: 50 },
  intensity = 'medium',
}: ImpactDistortionProps) {
  const getSize = () => {
    switch (intensity) {
      case 'light': return 120
      case 'medium': return 200
      case 'heavy': return 300
      case 'critical': return 500
      default: return 200
    }
  }

  const size = getSize()

  return (
    <AnimatePresence>
      {isActive && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-[9997]">
          {/* Primary shockwave ring */}
          <motion.div
            initial={{
              left: `${position.x}%`,
              top: `${position.y}%`,
              scale: 0,
              opacity: 0.8,
            }}
            animate={{
              scale: [0, 2, 3],
              opacity: [0.8, 0.4, 0],
            }}
            exit={{ opacity: 0 }}
            transition={{
              duration: 0.6,
              ease: 'easeOut',
            }}
            className="absolute rounded-full border-4 border-white"
            style={{
              width: size,
              height: size,
              transform: 'translate(-50%, -50%)',
              boxShadow: '0 0 40px rgba(255,255,255,0.8), inset 0 0 40px rgba(255,255,255,0.4)',
            }}
          />

          {/* Secondary shockwave */}
          <motion.div
            initial={{
              left: `${position.x}%`,
              top: `${position.y}%`,
              scale: 0,
              opacity: 0.6,
            }}
            animate={{
              scale: [0, 1.5, 2.5],
              opacity: [0.6, 0.3, 0],
            }}
            exit={{ opacity: 0 }}
            transition={{
              duration: 0.5,
              delay: 0.1,
              ease: 'easeOut',
            }}
            className="absolute rounded-full border-2 border-white"
            style={{
              width: size * 0.8,
              height: size * 0.8,
              transform: 'translate(-50%, -50%)',
              boxShadow: '0 0 30px rgba(255,255,255,0.6)',
            }}
          />

          {/* Radial blur lines (speed lines) */}
          {Array.from({ length: 16 }).map((_, i) => {
            const angle = (i / 16) * 360
            return (
              <motion.div
                key={i}
                initial={{
                  opacity: 0,
                  scaleY: 0,
                }}
                animate={{
                  opacity: [0, 0.6, 0],
                  scaleY: [0, 1, 1.5],
                }}
                transition={{
                  duration: 0.4,
                  ease: 'easeOut',
                }}
                className="absolute bg-white/40 blur-sm"
                style={{
                  left: `${position.x}%`,
                  top: `${position.y}%`,
                  width: '3px',
                  height: `${size / 2}px`,
                  transformOrigin: 'top center',
                  transform: `translate(-50%, 0) rotate(${angle}deg)`,
                }}
              />
            )
          })}

          {/* Impact flash bloom */}
          <motion.div
            initial={{
              left: `${position.x}%`,
              top: `${position.y}%`,
              scale: 0,
              opacity: 1,
            }}
            animate={{
              scale: [0, 1.5, 2],
              opacity: [1, 0.3, 0],
            }}
            transition={{
              duration: 0.3,
              ease: 'easeOut',
            }}
            className="absolute rounded-full"
            style={{
              width: size * 0.4,
              height: size * 0.4,
              transform: 'translate(-50%, -50%)',
              background: 'radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(255,255,255,0.3) 50%, transparent 100%)',
              filter: 'blur(20px)',
            }}
          />

          {/* Critical hit extra effects */}
          {intensity === 'critical' && (
            <>
              {/* Screen crack overlay */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.5, 0] }}
                transition={{ duration: 0.8 }}
                className="absolute inset-0"
                style={{
                  background: `
                    radial-gradient(circle at ${position.x}% ${position.y}%, transparent 20%, rgba(0,0,0,0.3) 100%),
                    linear-gradient(${Math.random() * 360}deg, transparent 48%, rgba(255,255,255,0.2) 50%, transparent 52%),
                    linear-gradient(${Math.random() * 360}deg, transparent 48%, rgba(255,255,255,0.2) 50%, transparent 52%)
                  `,
                }}
              />

              {/* Particle burst */}
              {Array.from({ length: 24 }).map((_, i) => {
                const angle = (i / 24) * 360
                const distance = 100 + Math.random() * 100
                return (
                  <motion.div
                    key={`particle-${i}`}
                    initial={{
                      left: `${position.x}%`,
                      top: `${position.y}%`,
                      scale: 1,
                      opacity: 1,
                    }}
                    animate={{
                      left: `${position.x + Math.cos(angle * Math.PI / 180) * distance / 10}%`,
                      top: `${position.y + Math.sin(angle * Math.PI / 180) * distance / 10}%`,
                      scale: 0,
                      opacity: 0,
                    }}
                    transition={{
                      duration: 0.6,
                      ease: 'easeOut',
                    }}
                    className="absolute w-3 h-3 bg-yellow-300 rounded-full"
                    style={{
                      boxShadow: '0 0 10px #FFD700',
                    }}
                  />
                )
              })}
            </>
          )}
        </div>
      )}
    </AnimatePresence>
  )
}
