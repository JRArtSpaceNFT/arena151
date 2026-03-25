'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useGameStore } from '@/lib/game-store'
import { playMusic, resumeAudioContext } from '@/lib/audio/musicEngine'

const TYPE_COLORS: Record<string, string> = {
  normal: '#9ca3af', fire: '#f97316', water: '#3b82f6', electric: '#eab308',
  grass: '#22c55e', ice: '#67e8f9', fighting: '#dc2626', poison: '#a855f7',
  ground: '#a16207', flying: '#818cf8', psychic: '#ec4899', bug: '#84cc16',
  rock: '#78716c', ghost: '#6d28d9', dragon: '#7c3aed', dark: '#374151', steel: '#94a3b8',
}

export default function Lineup() {
  const {
    lineupA, lineupB, lineupPhase,
    p1Trainer, p2Trainer, gameMode,
    moveCreatureUp, moveCreatureDown, confirmLineup,
  } = useGameStore()

  useEffect(() => {
    resumeAudioContext()
    playMusic('menu')
  }, [])

  const [timeLeft, setTimeLeft] = useState(30)

  // Reset timer each time the phase changes (P1 → P2)
  useEffect(() => { setTimeLeft(30) }, [lineupPhase])

  // Countdown — auto-confirm when it hits 0
  useEffect(() => {
    if (lineupPhase === 'done' || lineupPhase === ('done' as string)) return
    if (timeLeft <= 0) {
      confirmLineup((lineupPhase as 'p1' | 'p2') === 'p1' ? 'p1' : 'p2')
      return
    }
    const t = setTimeout(() => setTimeLeft(prev => prev - 1), 1000)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, lineupPhase])

  const isP1Phase = lineupPhase === 'p1'
  const isP2Phase = lineupPhase === 'p2'
  const showP1 = isP1Phase
  const showP2 = isP2Phase

  const currentLabel = isP1Phase
    ? (p1Trainer?.name ?? 'Player 1')
    : (p2Trainer?.name ?? 'Player 2')
  const currentColor = isP1Phase ? '#7c3aed' : '#ef4444'

  if (lineupPhase === 'done') {
    return <div style={{ color: 'white', textAlign: 'center', paddingTop: 100 }}>Loading arena...</div>
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0f',
      padding: 32,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
    }}>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ textAlign: 'center', marginBottom: 32 }}
      >
        <h1 style={{ fontSize: 40, fontWeight: 900, margin: 0, color: currentColor }}>
          {currentLabel}: Set Your Lineup
        </h1>
        <p style={{ color: '#64748b', marginTop: 8 }}>
          The first creature enters battle first. Order matters!
        </p>

        {/* Timer */}
        {(lineupPhase as string) !== 'done' && !(gameMode === 'vs_ai' && isP2Phase) && (
          <div style={{
            marginTop: 12,
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: timeLeft <= 8 ? 'rgba(239,68,68,0.15)' : 'rgba(124,58,237,0.1)',
            border: `2px solid ${timeLeft <= 8 ? '#ef4444' : currentColor}`,
            borderRadius: 10, padding: '6px 16px',
          }}>
            <motion.span
              animate={timeLeft <= 8 ? { scale: [1, 1.25, 1] } : { scale: 1 }}
              transition={{ duration: 0.4, repeat: timeLeft <= 8 ? Infinity : 0 }}
              style={{ fontSize: 18 }}
            >⏱</motion.span>
            <span style={{
              fontSize: 24, fontWeight: 900,
              color: timeLeft <= 8 ? '#ef4444' : '#e2e8f0',
              fontVariantNumeric: 'tabular-nums',
              minWidth: 28, textAlign: 'center', display: 'inline-block',
            }}>{timeLeft}</span>
            <span style={{ fontSize: 12, color: '#64748b' }}>sec — lineup locks when it hits 0</span>
          </div>
        )}
        {gameMode === 'vs_ai' && isP2Phase && (
          <p style={{ color: '#fbbf24', fontWeight: 700 }}>AI is setting its lineup...</p>
        )}
      </motion.div>

      {(isP1Phase || isP2Phase) && (
        <div style={{ width: '100%', maxWidth: 480 }}>
          {(isP1Phase ? lineupA : lineupB).map((ac, i) => (
            <motion.div
              key={ac.creature.id}
              layout
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                background: '#1a1a2e',
                border: `1px solid ${currentColor}33`,
                borderRadius: 12,
                padding: '12px 16px',
                marginBottom: 8,
              }}
            >
              {/* Position number */}
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                background: currentColor,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, fontWeight: 900, color: 'white', flexShrink: 0,
              }}>
                {i + 1}
              </div>

              {/* Sprite */}
              <img
                src={ac.creature.spriteUrl}
                alt={ac.creature.name}
                style={{ width: 52, height: 52, imageRendering: 'pixelated' }}
              />

              {/* Info */}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 17, fontWeight: 700, color: '#f1f5f9' }}>
                  {ac.creature.name}
                </div>
                <div style={{ display: 'flex', gap: 4, marginTop: 2, flexWrap: 'wrap' }}>
                  {ac.creature.types.map(t => (
                    <span key={t} style={{
                      fontSize: 10, padding: '1px 6px', borderRadius: 8,
                      background: `${TYPE_COLORS[t]}33`, color: TYPE_COLORS[t],
                      fontWeight: 700, textTransform: 'uppercase',
                    }}>{t}</span>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 12, marginTop: 4, fontSize: 11, color: '#64748b' }}>
                  <span>ATK: <span style={{ color: '#ef4444' }}>{ac.creature.baseAtk}</span></span>
                  <span>DEF: <span style={{ color: '#3b82f6' }}>{ac.creature.baseDef}</span></span>
                  <span>SPE: <span style={{ color: '#fbbf24' }}>{ac.creature.baseSpe}</span></span>
                </div>
              </div>

              {/* Move buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <button
                  onClick={() => moveCreatureUp(i, isP1Phase ? 'p1' : 'p2')}
                  disabled={i === 0}
                  style={{
                    width: 32, height: 32,
                    background: i === 0 ? '#0f0f1a' : '#2d2d5e',
                    border: 'none', borderRadius: 6,
                    color: i === 0 ? '#2d2d5e' : '#e2e8f0',
                    fontSize: 14, cursor: i === 0 ? 'not-allowed' : 'pointer',
                  }}
                >
                  ↑
                </button>
                <button
                  onClick={() => moveCreatureDown(i, isP1Phase ? 'p1' : 'p2')}
                  disabled={i === (isP1Phase ? lineupA : lineupB).length - 1}
                  style={{
                    width: 32, height: 32,
                    background: i === (isP1Phase ? lineupA : lineupB).length - 1 ? '#0f0f1a' : '#2d2d5e',
                    border: 'none', borderRadius: 6,
                    color: i === (isP1Phase ? lineupA : lineupB).length - 1 ? '#2d2d5e' : '#e2e8f0',
                    fontSize: 14, cursor: i === (isP1Phase ? lineupA : lineupB).length - 1 ? 'not-allowed' : 'pointer',
                  }}
                >
                  ↓
                </button>
              </div>
            </motion.div>
          ))}

          <motion.button
            whileHover={{ scale: 1.03, boxShadow: `0 0 20px ${currentColor}66` }}
            whileTap={{ scale: 0.97 }}
            onClick={() => confirmLineup(isP1Phase ? 'p1' : 'p2')}
            style={{
              width: '100%',
              marginTop: 24,
              padding: '16px',
              background: `linear-gradient(135deg, ${currentColor}, ${currentColor}99)`,
              border: 'none', borderRadius: 12,
              color: 'white', fontSize: 18, fontWeight: 700, cursor: 'pointer',
            }}
          >
            ✅ Confirm Lineup {isP1Phase && gameMode !== 'vs_ai' ? '→ P2' : '→ Arena'}
          </motion.button>
        </div>
      )}
    </div>
  )
}
