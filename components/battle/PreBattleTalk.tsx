'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '@/lib/game-store'

// ── Typewriter hook ────────────────────────────────────────────
function useTypewriter(text: string, speed: number, enabled: boolean): string {
  const [displayed, setDisplayed] = useState('')

  useEffect(() => {
    if (!enabled) {
      setDisplayed('')
      return
    }
    setDisplayed('')
    let i = 0
    const iv = setInterval(() => {
      i++
      setDisplayed(text.slice(0, i))
      if (i >= text.length) clearInterval(iv)
    }, speed)
    return () => clearInterval(iv)
  }, [text, speed, enabled])

  return displayed
}

// ── Main component ─────────────────────────────────────────────
export default function PreBattleTalk() {
  const p1Trainer = useGameStore(s => s.p1Trainer)
  const p2Trainer = useGameStore(s => s.p2Trainer)
  const proceedFromPretalk = useGameStore(s => s.proceedFromPretalk)

  // 0 = p1 phase (0–3s), 1 = p2 phase (3–6s), 2 = battle start flash (6–7s)
  const [phase, setPhase] = useState<0 | 1 | 2>(0)

  // Pick random lines on mount (stable refs)
  const p1Line = useRef(
    p1Trainer?.talkLines?.length
      ? p1Trainer.talkLines[Math.floor(Math.random() * p1Trainer.talkLines.length)]
      : '...'
  ).current

  const p2Line = useRef(
    p2Trainer?.talkLines?.length
      ? p2Trainer.talkLines[Math.floor(Math.random() * p2Trainer.talkLines.length)]
      : '...'
  ).current

  // Typewriter text for each trainer
  const p1Text = useTypewriter(p1Line, 30, phase >= 0)
  const p2Text = useTypewriter(p2Line, 30, phase >= 1)

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 3000)   // p2 enters at 3s
    const t2 = setTimeout(() => setPhase(2), 6000)   // battle start flash at 6s
    const t3 = setTimeout(() => proceedFromPretalk(), 7000) // proceed at 7s
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!p1Trainer || !p2Trainer) return null

  const p1Color = p1Trainer.color
  const p2Color = p2Trainer.color

  return (
    <div style={{
      height: '100dvh',
      maxHeight: '100dvh',
      background: '#06060a',
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      {/* Subtle dual-trainer color vignette */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: `radial-gradient(ellipse at 20% 80%, ${p1Color}22 0%, transparent 55%),
                     radial-gradient(ellipse at 80% 80%, ${p2Color}22 0%, transparent 55%)`,
        pointerEvents: 'none',
      }} />

      {/* Scanline texture */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.08) 2px, rgba(0,0,0,0.08) 4px)',
        pointerEvents: 'none',
        zIndex: 1,
      }} />

      {/* ── P1 Trainer — slides in from LEFT ── */}
      <motion.div
        key="p1-trainer"
        initial={{ x: -500, opacity: 0 }}
        animate={{ x: 0, opacity: phase === 0 ? 1 : 0.35 }}
        transition={{ type: 'spring', stiffness: 180, damping: 22, delay: 0.1 }}
        style={{
          position: 'absolute',
          left: '6%',
          bottom: '8%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          zIndex: 3,
          filter: phase === 0 ? 'none' : 'grayscale(0.6) brightness(0.5)',
          transition: 'filter 0.4s ease, opacity 0.4s ease',
        }}
      >
        {/* Glow blob behind sprite */}
        <motion.div
          animate={{ opacity: phase === 0 ? [0.25, 0.55, 0.25] : 0, scale: [1, 1.1, 1] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'absolute',
            width: 180,
            height: 180,
            borderRadius: '50%',
            background: p1Color,
            filter: 'blur(55px)',
            top: '10%',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 0,
          }}
        />
        {p1Trainer.spriteUrl && (
          <motion.img
            src={p1Trainer.spriteUrl}
            alt={p1Trainer.name}
            style={{
              width: 220,
              height: 220,
              imageRendering: 'pixelated',
              position: 'relative',
              zIndex: 1,
              filter: phase === 0 ? `drop-shadow(0 0 16px ${p1Color}99)` : 'none',
            }}
          />
        )}
        <div style={{
          fontSize: 15,
          fontWeight: 800,
          color: phase === 0 ? p1Color : '#475569',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          textShadow: phase === 0 ? `0 0 14px ${p1Color}99` : 'none',
          marginTop: 8,
          position: 'relative',
          zIndex: 1,
          transition: 'color 0.4s ease',
        }}>
          {p1Trainer.name}
        </div>
      </motion.div>

      {/* ── P1 Talk bubble ── */}
      <AnimatePresence>
        {phase <= 1 && p1Text && (
          <motion.div
            key="p1-talk"
            initial={{ opacity: 0, y: 12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.25 }}
            style={{
              position: 'absolute',
              left: '28%',
              bottom: '32%',
              maxWidth: 320,
              background: 'rgba(8,8,16,0.92)',
              border: `2px solid ${p1Color}66`,
              borderRadius: 10,
              padding: '14px 20px',
              zIndex: 6,
              boxShadow: `0 0 24px ${p1Color}33, 0 4px 20px rgba(0,0,0,0.6)`,
            }}
          >
            {/* Arrow pointing left toward trainer */}
            <div style={{
              position: 'absolute',
              left: -10,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 0,
              height: 0,
              borderTop: '8px solid transparent',
              borderBottom: '8px solid transparent',
              borderRight: `10px solid ${p1Color}66`,
            }} />
            <div style={{
              fontFamily: '"Courier New", "Lucida Console", monospace',
              fontSize: 15,
              fontWeight: 700,
              color: '#f1f5f9',
              lineHeight: 1.65,
            }}>
              {p1Text}
              <motion.span
                animate={{ opacity: [1, 0, 1] }}
                transition={{ duration: 0.55, repeat: Infinity }}
                style={{ color: p1Color, marginLeft: 2 }}
              >|</motion.span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── P2 Trainer — slides in from RIGHT ── */}
      <AnimatePresence>
        {phase >= 1 && (
          <motion.div
            key="p2-trainer"
            initial={{ x: 500, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 180, damping: 22 }}
            style={{
              position: 'absolute',
              right: '6%',
              bottom: '8%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              zIndex: 3,
              filter: 'none',
              transition: 'filter 0.4s ease',
            }}
          >
            {/* Glow blob */}
            <motion.div
              animate={{ opacity: [0.25, 0.55, 0.25], scale: [1, 1.1, 1] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
              style={{
                position: 'absolute',
                width: 180,
                height: 180,
                borderRadius: '50%',
                background: p2Color,
                filter: 'blur(55px)',
                top: '10%',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 0,
              }}
            />
            {p2Trainer.spriteUrl && (
              <motion.img
                src={p2Trainer.spriteUrl}
                alt={p2Trainer.name}
                style={{
                  width: 220,
                  height: 220,
                  imageRendering: 'pixelated',
                  transform: 'scaleX(-1)',
                  position: 'relative',
                  zIndex: 1,
                  filter: `drop-shadow(0 0 16px ${p2Color}99)`,
                }}
              />
            )}
            <div style={{
              fontSize: 15,
              fontWeight: 800,
              color: p2Color,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              textShadow: `0 0 14px ${p2Color}99`,
              marginTop: 8,
              position: 'relative',
              zIndex: 1,
            }}>
              {p2Trainer.name}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── P2 Talk bubble ── */}
      <AnimatePresence>
        {phase >= 1 && phase < 2 && p2Text && (
          <motion.div
            key="p2-talk"
            initial={{ opacity: 0, y: 12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.25 }}
            style={{
              position: 'absolute',
              right: '28%',
              bottom: '32%',
              maxWidth: 320,
              background: 'rgba(8,8,16,0.92)',
              border: `2px solid ${p2Color}66`,
              borderRadius: 10,
              padding: '14px 20px',
              zIndex: 6,
              boxShadow: `0 0 24px ${p2Color}33, 0 4px 20px rgba(0,0,0,0.6)`,
            }}
          >
            {/* Arrow pointing right toward trainer */}
            <div style={{
              position: 'absolute',
              right: -10,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 0,
              height: 0,
              borderTop: '8px solid transparent',
              borderBottom: '8px solid transparent',
              borderLeft: `10px solid ${p2Color}66`,
            }} />
            <div style={{
              fontFamily: '"Courier New", "Lucida Console", monospace',
              fontSize: 15,
              fontWeight: 700,
              color: '#f1f5f9',
              lineHeight: 1.65,
            }}>
              {p2Text}
              <motion.span
                animate={{ opacity: [1, 0, 1] }}
                transition={{ duration: 0.55, repeat: Infinity }}
                style={{ color: p2Color, marginLeft: 2 }}
              >|</motion.span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── VS divider line ── */}
      <motion.div
        animate={{ opacity: [0.3, 0.7, 0.3] }}
        transition={{ duration: 2, repeat: Infinity }}
        style={{
          position: 'absolute',
          top: '30%',
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: 44,
          fontWeight: 900,
          color: '#fbbf24',
          textShadow: '0 0 30px rgba(251,191,36,0.7)',
          zIndex: 4,
          userSelect: 'none',
        }}
      >
        VS
      </motion.div>

      {/* ── BATTLE START! flash ── */}
      <AnimatePresence>
        {phase === 2 && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 15,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none',
          }}>
            <motion.div
              key="battle-start"
              initial={{ opacity: 0, scale: 0.4 }}
              animate={{ opacity: [0, 1, 1, 0], scale: [0.4, 1.15, 1.05, 1.6] }}
              transition={{ duration: 1.1, times: [0, 0.2, 0.65, 1], ease: 'easeOut' }}
              style={{
                textAlign: 'center',
                fontFamily: '"Impact", "Arial Black", sans-serif',
                fontSize: 72,
                fontWeight: 900,
                color: '#fbbf24',
                textShadow: '0 0 50px rgba(251,191,36,1), 0 0 100px rgba(251,191,36,0.6), 0 4px 0 rgba(0,0,0,0.8)',
                letterSpacing: '0.04em',
                whiteSpace: 'nowrap',
              }}
            >
              BATTLE START!
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* White flash on battle start */}
      <AnimatePresence>
        {phase === 2 && (
          <motion.div
            key="battle-flash"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.5, 0] }}
            transition={{ duration: 0.4 }}
            style={{
              position: 'absolute',
              inset: 0,
              background: 'white',
              zIndex: 12,
              pointerEvents: 'none',
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
