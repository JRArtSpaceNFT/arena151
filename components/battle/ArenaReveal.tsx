'use client'

import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '@/lib/game-store'
import { playMusic, resumeAudioContext, startCrowdAmbient } from '@/lib/audio/musicEngine'
import { ARENAS } from '@/lib/data/arenas'
import ArenaArtwork from '@/components/battle/ArenaArtwork'

const TYPE_COLORS: Record<string, string> = {
  normal: '#9ca3af', fire: '#f97316', water: '#3b82f6', electric: '#eab308',
  grass: '#22c55e', ice: '#67e8f9', fighting: '#dc2626', poison: '#a855f7',
  ground: '#a16207', flying: '#818cf8', psychic: '#ec4899', bug: '#84cc16',
  rock: '#78716c', ghost: '#6d28d9', dragon: '#7c3aed', dark: '#374151', steel: '#94a3b8',
}

// Slowdown schedule in ms
const SCHEDULE = [
  50, 50, 60, 70, 90,
  120, 160, 210, 280,
  370, 470, 590, 720,
]

export default function ArenaReveal() {
  const { arena, proceedFromArenaReveal } = useGameStore()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isLocked, setIsLocked] = useState(false)
  const [sequenceBuilt, setSequenceBuilt] = useState<number[]>([])
  const stepRef = useRef(0)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    resumeAudioContext()
    playMusic('menu')
  }, [])

  useEffect(() => {
    if (!arena) return

    // Build the spin sequence
    const targetIndex = ARENAS.findIndex(a => a.id === arena.id)
    const finalTarget = targetIndex >= 0 ? targetIndex : 0

    // Fill with random arenas for the spin, then end on target
    const seq: number[] = []
    for (let i = 0; i < SCHEDULE.length - 1; i++) {
      let rand = Math.floor(Math.random() * ARENAS.length)
      // Avoid showing the target too early (last 3 slots)
      if (i >= SCHEDULE.length - 4) {
        while (rand === finalTarget) {
          rand = Math.floor(Math.random() * ARENAS.length)
        }
      }
      seq.push(rand)
    }
    seq.push(finalTarget) // last step is always the selected arena

    setSequenceBuilt(seq)
    setCurrentIndex(seq[0])
    stepRef.current = 0

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [arena])

  useEffect(() => {
    if (sequenceBuilt.length === 0) return

    function advance() {
      const step = stepRef.current
      if (step >= sequenceBuilt.length - 1) {
        // Last step — lock in
        setCurrentIndex(sequenceBuilt[sequenceBuilt.length - 1])
        setIsLocked(true)
        return
      }

      const nextStep = step + 1
      stepRef.current = nextStep
      setCurrentIndex(sequenceBuilt[nextStep])

      timeoutRef.current = setTimeout(advance, SCHEDULE[nextStep] ?? 1050)
    }

    // Start the carousel
    timeoutRef.current = setTimeout(advance, SCHEDULE[0])

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [sequenceBuilt])

  // After locking, start battle music then proceed (4.5s so players can read the arena info)
  useEffect(() => {
    if (!isLocked) return
    resumeAudioContext()
    playMusic('battle')
    startCrowdAmbient() // very quiet crowd murmur under the battle music
    const t = setTimeout(() => {
      proceedFromArenaReveal()
    }, 4500)
    return () => clearTimeout(t)
  }, [isLocked, proceedFromArenaReveal])

  const displayArena = ARENAS[currentIndex]
  if (!arena || !displayArena) return null

  return (
    <div style={{
      minHeight: '100vh',
      position: 'relative',
      overflow: 'hidden',
    }}>
        <div
          style={{
            minHeight: '100vh',
            background: displayArena.bgGradient,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            overflow: 'hidden',
            // snap-change during spin; smooth reveal on lock
            transition: isLocked ? 'background 0.4s ease' : 'none',
            animation: isLocked ? 'fadeIn 0.3s ease forwards' : 'none',
          }}
        >
          {/* Arena image background */}
          {displayArena.image && (
            <img
              src={displayArena.image}
              alt=""
              aria-hidden="true"
              style={{
                position: 'absolute', inset: 0,
                width: '100%', height: '100%',
                objectFit: 'cover',
                opacity: 0.55,
                pointerEvents: 'none',
              }}
            />
          )}

          {/* Scanline overlay */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.06) 2px, rgba(0,0,0,0.06) 4px)',
            pointerEvents: 'none',
          }} />

          {/* Dark overlay */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(0,0,0,0.5)',
            pointerEvents: 'none',
          }} />

          {/* Lock glow border */}
          {isLocked && (
            <motion.div
              initial={{ opacity: 1 }}
              animate={{ opacity: 1 }}
              style={{
                position: 'absolute', inset: 0,
                pointerEvents: 'none',
                zIndex: 0,
              }}
            >
              <motion.div
                animate={{
                  boxShadow: [
                    'inset 0 0 30px rgba(251,191,36,0.2)',
                    'inset 0 0 80px rgba(251,191,36,0.5)',
                    'inset 0 0 50px rgba(251,191,36,0.35)',
                    'inset 0 0 80px rgba(251,191,36,0.5)',
                    'inset 0 0 30px rgba(251,191,36,0.2)',
                  ],
                }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                style={{ position: 'absolute', inset: 0 }}
              />
            </motion.div>
          )}

          <div style={{ textAlign: 'center', zIndex: 1, padding: 24, maxWidth: 800, width: '100%' }}>

            {/* "TONIGHT'S ARENA" label */}
            {isLocked ? (
              <motion.div
                initial={{ opacity: 1, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                style={{
                  fontSize: 18,
                  letterSpacing: '0.35em',
                  color: '#fbbf24',
                  marginBottom: 16,
                  textTransform: 'uppercase',
                  fontWeight: 700,
                  textShadow: '0 0 20px rgba(251,191,36,0.6)',
                }}
              >
                ⚔️ TONIGHT&apos;S ARENA
              </motion.div>
            ) : (
              <div style={{
                fontSize: 14,
                letterSpacing: '0.3em',
                color: '#64748b',
                marginBottom: 16,
                textTransform: 'uppercase',
              }}>
                Selecting arena...
              </div>
            )}

            {/* Arena artwork */}


            {/* Arena name */}
            <motion.h1
              style={{
                fontSize: 72,
                fontWeight: 900,
                margin: 0,
                marginBottom: 20,
                color: '#fff',
                lineHeight: 1.1,
                textShadow: isLocked
                  ? '0 0 60px rgba(251,191,36,0.5), 0 0 30px rgba(255,255,255,0.3)'
                  : '0 0 20px rgba(255,255,255,0.3)',
              }}
            >
              {displayArena.name}
            </motion.h1>

            {/* Type badge */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 20 }}>
              <span style={{
                fontSize: 15, padding: '5px 18px', borderRadius: 20,
                background: `${TYPE_COLORS[displayArena.type] ?? '#9ca3af'}33`,
                color: TYPE_COLORS[displayArena.type] ?? '#9ca3af',
                border: `1px solid ${TYPE_COLORS[displayArena.type] ?? '#9ca3af'}66`,
                textTransform: 'capitalize', fontWeight: 700,
              }}>
                {displayArena.type} arena
              </span>
            </div>

            {/* Bonus types */}
            {isLocked ? (
              <motion.div
                initial={{ opacity: 1, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                style={{ marginBottom: 24 }}
              >
                <div style={{ fontSize: 14, color: '#94a3b8', marginBottom: 10 }}>
                  Type Bonuses (+{displayArena.bonusAmount * 100}% damage)
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                  {displayArena.bonusTypes.map(t => (
                    <span key={t} style={{
                      fontSize: 15, padding: '6px 18px', borderRadius: 20,
                      background: `${TYPE_COLORS[t] ?? '#9ca3af'}33`,
                      color: TYPE_COLORS[t] ?? '#9ca3af',
                      border: `1px solid ${TYPE_COLORS[t] ?? '#9ca3af'}55`,
                      fontWeight: 700, textTransform: 'capitalize',
                    }}>
                      {t}
                    </span>
                  ))}
                </div>
              </motion.div>
            ) : (
              <div style={{ marginBottom: 24, display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                {displayArena.bonusTypes.map(t => (
                  <span key={t} style={{
                    fontSize: 14, padding: '5px 14px', borderRadius: 20,
                    background: `${TYPE_COLORS[t] ?? '#9ca3af'}22`,
                    color: `${TYPE_COLORS[t] ?? '#9ca3af'}aa`,
                    border: `1px solid ${TYPE_COLORS[t] ?? '#9ca3af'}33`,
                    fontWeight: 600, textTransform: 'capitalize',
                  }}>
                    {t}
                  </span>
                ))}
              </div>
            )}

            {/* Arena event (locked only) */}
            {isLocked && displayArena.event && (
              <motion.div
                initial={{ opacity: 1, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                style={{
                  background: 'rgba(0,0,0,0.4)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: 12, padding: '12px 24px', marginBottom: 20,
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 700, color: '#fbbf24', marginBottom: 4 }}>
                  🌀 Arena Event: {displayArena.event.name}
                </div>
                <div style={{ fontSize: 13, color: '#94a3b8' }}>{displayArena.event.description}</div>
              </motion.div>
            )}

            {/* LOCKED IN banner */}
            {isLocked && (
              <motion.div
                initial={{ opacity: 1, scale: 1 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                style={{
                  fontSize: 28,
                  fontWeight: 900,
                  color: '#fbbf24',
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                  textShadow: '0 0 30px rgba(251,191,36,0.7)',
                  marginBottom: 24,
                }}
              >
                🔒 LOCKED IN
              </motion.div>
            )}

            {/* Progress bar */}
            {isLocked && (
              <motion.div
                initial={{ opacity: 1 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                style={{ marginTop: 8 }}
              >
                <div style={{ fontSize: 13, color: '#64748b', marginBottom: 8 }}>
                  Proceeding to battle...
                </div>
                <div style={{
                  width: 240, height: 3, background: 'rgba(255,255,255,0.1)',
                  borderRadius: 2, overflow: 'hidden', margin: '0 auto',
                }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: '100%' }}
                    transition={{ duration: 4, ease: 'linear', delay: 0.5 }}
                    style={{ height: '100%', background: '#fbbf24', borderRadius: 2 }}
                  />
                </div>
              </motion.div>
            )}

            {/* Spinning indicator */}
            {!isLocked && (
              <div style={{ marginTop: 20 }}>
                <motion.div
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 0.6, repeat: Infinity }}
                  style={{ fontSize: 13, color: '#64748b', letterSpacing: '0.1em' }}
                >
                  ◈ ◈ ◈
                </motion.div>
              </div>
            )}
          </div>
        </div>
    </div>
  )
}
