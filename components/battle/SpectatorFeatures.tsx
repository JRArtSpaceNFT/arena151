/**
 * Spectator Excitement Features
 * Makes battles streamable and social-clip worthy
 * Based on Section 8 of the battle VFX spec
 */

'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect } from 'react'

// ═══════════════════════════════════════════════════════════════
// CROWD HYPE METER
// ═══════════════════════════════════════════════════════════════

interface CrowdHypeMeterProps {
  level: number  // 0-100
  recentEvent?: 'critical' | 'super_effective' | 'ko' | 'comeback' | 'clutch'
}

export function CrowdHypeMeter({ level, recentEvent }: CrowdHypeMeterProps) {
  const [displayLevel, setDisplayLevel] = useState(level)

  useEffect(() => {
    // Smooth animation to new level
    const interval = setInterval(() => {
      setDisplayLevel((prev) => {
        const diff = level - prev
        if (Math.abs(diff) < 1) return level
        return prev + diff * 0.1
      })
    }, 50)

    return () => clearInterval(interval)
  }, [level])

  const getColor = () => {
    if (displayLevel < 30) return '#64748B'
    if (displayLevel < 60) return '#F59E0B'
    if (displayLevel < 90) return '#EF4444'
    return '#DC2626'
  }

  return (
    <div className="fixed top-4 left-4 z-[9990]">
      {/* Hype meter bar */}
      <div className="relative w-48 h-8 bg-black/60 border-2 border-white/20 rounded overflow-hidden">
        <motion.div
          animate={{ width: `${displayLevel}%` }}
          transition={{ type: 'spring', stiffness: 100 }}
          className="absolute inset-y-0 left-0"
          style={{
            backgroundColor: getColor(),
            boxShadow: `0 0 20px ${getColor()}`,
          }}
        />
        
        {/* Label */}
        <div className="absolute inset-0 flex items-center justify-center text-white text-sm font-bold uppercase tracking-wider pointer-events-none">
          CROWD HYPE
        </div>

        {/* Pulse on high hype */}
        {displayLevel > 80 && (
          <motion.div
            animate={{ opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 0.8, repeat: Infinity }}
            className="absolute inset-0 border-2"
            style={{
              borderColor: getColor(),
              boxShadow: `inset 0 0 20px ${getColor()}`,
            }}
          />
        )}
      </div>

      {/* Event callout */}
      <AnimatePresence>
        {recentEvent && (
          <motion.div
            initial={{ scale: 0, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 200 }}
            className="mt-2 px-4 py-2 bg-gradient-to-r from-yellow-500 to-orange-500 rounded text-white font-black text-center uppercase tracking-wide"
            style={{
              textShadow: '2px 2px 0px rgba(0,0,0,0.8)',
            }}
          >
            {recentEvent === 'critical' && '🔥 CRITICAL HIT!'}
            {recentEvent === 'super_effective' && '⚡ SUPER EFFECTIVE!'}
            {recentEvent === 'ko' && '💀 K.O.!'}
            {recentEvent === 'comeback' && '🔄 COMEBACK!'}
            {recentEvent === 'clutch' && '⭐ CLUTCH SAVE!'}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// ELEMENT CLASH VISUAL
// ═══════════════════════════════════════════════════════════════

interface ElementClashProps {
  element1: string
  element2: string
  position: { x: number; y: number }
}

export function ElementClash({ element1, element2, position }: ElementClashProps) {
  const getElementColor = (element: string) => {
    const colors: Record<string, string> = {
      fire: '#FF6600',
      water: '#0066CC',
      electric: '#FFFF00',
      grass: '#22C55E',
      ice: '#CCFFFF',
    }
    return colors[element] || '#FFFFFF'
  }

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Clash explosion */}
      <motion.div
        initial={{ scale: 0, opacity: 1 }}
        animate={{ scale: 3, opacity: 0 }}
        transition={{ duration: 0.8 }}
        className="absolute rounded-full"
        style={{
          left: `${position.x}%`,
          top: `${position.y}%`,
          width: '200px',
          height: '200px',
          transform: 'translate(-50%, -50%)',
          background: `
            radial-gradient(circle, 
              ${getElementColor(element1)}80 0%, 
              ${getElementColor(element2)}80 50%,
              transparent 100%
            )
          `,
        }}
      />

      {/* Shockwave rings */}
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          initial={{ scale: 0, opacity: 0.8 }}
          animate={{ scale: 4, opacity: 0 }}
          transition={{ duration: 1, delay: i * 0.15 }}
          className="absolute rounded-full border-4"
          style={{
            left: `${position.x}%`,
            top: `${position.y}%`,
            width: '100px',
            height: '100px',
            transform: 'translate(-50%, -50%)',
            borderColor: i % 2 === 0 ? getElementColor(element1) : getElementColor(element2),
          }}
        />
      ))}

      {/* Clash text */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1.5, opacity: [0, 1, 1, 0] }}
        transition={{ duration: 1.2 }}
        className="absolute text-6xl font-black uppercase"
        style={{
          left: `${position.x}%`,
          top: `${position.y}%`,
          transform: 'translate(-50%, -50%)',
          background: `linear-gradient(to right, ${getElementColor(element1)}, ${getElementColor(element2)})`,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          textShadow: '0 0 40px rgba(255,255,255,0.8)',
        }}
      >
        CLASH!
      </motion.div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// DRAMATIC FINISHER INTRO
// ═══════════════════════════════════════════════════════════════

interface FinisherIntroProps {
  attackerName: string
  moveName: string
  element: string
  onComplete: () => void
}

export function FinisherIntro({ attackerName, moveName, element, onComplete }: FinisherIntroProps) {
  useEffect(() => {
    const timer = setTimeout(onComplete, 2500)
    return () => clearTimeout(timer)
  }, [onComplete])

  const getElementColor = (element: string) => {
    const colors: Record<string, string> = {
      fire: '#FF6600',
      water: '#0066CC',
      electric: '#FFFF00',
      ice: '#CCFFFF',
    }
    return colors[element] || '#FFFFFF'
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center pointer-events-none"
    >
      {/* Black background */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.85 }}
        className="absolute inset-0 bg-black"
      />

      {/* Attacker name */}
      <motion.div
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="relative text-4xl font-bold text-white mb-4"
      >
        {attackerName}
      </motion.div>

      {/* Move name */}
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.5, type: 'spring', stiffness: 150 }}
        className="relative text-8xl font-black uppercase tracking-wider"
        style={{
          color: getElementColor(element),
          textShadow: `
            0 0 30px ${getElementColor(element)},
            0 0 60px ${getElementColor(element)},
            4px 4px 0px rgba(0,0,0,0.8)
          `,
          WebkitTextStroke: '3px rgba(0,0,0,0.9)',
        }}
      >
        {moveName}
      </motion.div>

      {/* Decorative lines */}
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: '60%' }}
        transition={{ delay: 0.8, duration: 0.4 }}
        className="h-1 mt-8"
        style={{
          backgroundColor: getElementColor(element),
          boxShadow: `0 0 20px ${getElementColor(element)}`,
        }}
      />

      {/* Radial burst */}
      {Array.from({ length: 24 }).map((_, i) => {
        const angle = (i / 24) * 360
        return (
          <motion.div
            key={i}
            initial={{ scaleY: 0, opacity: 0 }}
            animate={{ scaleY: 1, opacity: 0.6 }}
            transition={{ delay: 1 + i * 0.02, duration: 0.3 }}
            className="absolute top-1/2 left-1/2 w-1 h-32 origin-bottom"
            style={{
              backgroundColor: getElementColor(element),
              transform: `translate(-50%, -100%) rotate(${angle}deg)`,
              boxShadow: `0 0 10px ${getElementColor(element)}`,
            }}
          />
        )
      })}
    </motion.div>
  )
}

// ═══════════════════════════════════════════════════════════════
// CLUTCH SURVIVAL MOMENT
// ═══════════════════════════════════════════════════════════════

export function ClutchSurvival() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ type: 'spring', stiffness: 200 }}
      className="fixed inset-0 z-[9998] flex items-center justify-center pointer-events-none"
    >
      {/* Flash */}
      <motion.div
        animate={{ opacity: [0, 0.6, 0] }}
        transition={{ duration: 0.5 }}
        className="absolute inset-0 bg-yellow-400"
      />

      {/* Text */}
      <motion.div
        initial={{ y: 50 }}
        animate={{ y: 0 }}
        className="relative text-9xl font-black uppercase text-yellow-400"
        style={{
          textShadow: `
            0 0 30px #FFD700,
            0 0 60px #FFD700,
            6px 6px 0px rgba(0,0,0,0.9)
          `,
          WebkitTextStroke: '4px rgba(0,0,0,0.9)',
        }}
      >
        CLUTCH!
      </motion.div>

      {/* Sparkles */}
      {Array.from({ length: 30 }).map((_, i) => (
        <motion.div
          key={i}
          initial={{
            x: '50vw',
            y: '50vh',
            scale: 0,
          }}
          animate={{
            x: `${Math.random() * 100}vw`,
            y: `${Math.random() * 100}vh`,
            scale: [0, 1.5, 0],
          }}
          transition={{
            duration: 1,
            delay: Math.random() * 0.3,
          }}
          className="absolute w-4 h-4"
          style={{
            backgroundColor: '#FFD700',
            clipPath: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)',
          }}
        />
      ))}
    </motion.div>
  )
}

// ═══════════════════════════════════════════════════════════════
// COMBO COUNTER
// ═══════════════════════════════════════════════════════════════

interface ComboCounterProps {
  count: number
}

export function ComboCounter({ count }: ComboCounterProps) {
  if (count < 2) return null

  const getColor = () => {
    if (count < 3) return '#F59E0B'
    if (count < 5) return '#EF4444'
    return '#DC2626'
  }

  return (
    <motion.div
      initial={{ scale: 0, rotate: -180 }}
      animate={{ scale: 1, rotate: 0 }}
      exit={{ scale: 0, rotate: 180 }}
      transition={{ type: 'spring', stiffness: 200 }}
      className="fixed top-1/4 right-12 z-[9997] flex flex-col items-center"
    >
      {/* Combo number */}
      <div
        className="text-9xl font-black"
        style={{
          color: getColor(),
          textShadow: `
            0 0 30px ${getColor()},
            0 0 60px ${getColor()},
            6px 6px 0px rgba(0,0,0,0.9)
          `,
          WebkitTextStroke: '4px rgba(0,0,0,0.9)',
        }}
      >
        {count}
      </div>

      {/* "COMBO" text */}
      <div
        className="text-4xl font-black uppercase tracking-widest -mt-4"
        style={{
          color: getColor(),
          textShadow: `0 0 20px ${getColor()}, 3px 3px 0px rgba(0,0,0,0.8)`,
        }}
      >
        COMBO!
      </div>

      {/* Burst lines */}
      {Array.from({ length: 12 }).map((_, i) => {
        const angle = (i / 12) * 360
        return (
          <motion.div
            key={i}
            initial={{ scaleY: 0 }}
            animate={{ scaleY: [0, 1, 0] }}
            transition={{ duration: 0.6, delay: i * 0.03 }}
            className="absolute w-2 h-24"
            style={{
              backgroundColor: getColor(),
              transformOrigin: 'center',
              transform: `rotate(${angle}deg) translateY(-80px)`,
              boxShadow: `0 0 15px ${getColor()}`,
            }}
          />
        )
      })}
    </motion.div>
  )
}
