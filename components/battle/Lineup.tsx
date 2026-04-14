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

  const lineup = isP1Phase ? lineupA : lineupB

  return (
    <div className="lineup-outer" style={{
      height: '100dvh',
      maxHeight: '100dvh',
      background: '#0a0a0f',
      padding: 'clamp(10px, 2vh, 24px) clamp(12px, 3vw, 32px)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      overflow: 'hidden',
    }}>
      <style>{`
        @media (max-width: 1024px) {
          .lineup-outer { overflow-y: auto !important; }
          .lineup-list { overflow-y: visible !important; flex: none !important; }
          .lineup-confirm { position: sticky; bottom: 0; background: #0a0a0f; padding-bottom: env(safe-area-inset-bottom, 8px); }
        }
      `}</style>

      {/* ── Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ textAlign: 'center', marginBottom: 'clamp(6px, 1.5vh, 18px)', flexShrink: 0 }}
      >
        <h1 style={{ fontSize: 'clamp(20px, 3.5vh, 36px)', fontWeight: 900, margin: 0, color: currentColor, lineHeight: 1.1 }}>
          {currentLabel}: Set Your Lineup
        </h1>
        <p style={{ color: '#64748b', marginTop: 4, fontSize: 'clamp(11px, 1.6vh, 14px)' }}>
          First creature enters battle first. Order matters!
        </p>

        {/* Timer — compact inline row */}
        {(lineupPhase as string) !== 'done' && !((gameMode === 'vs_ai' || gameMode === 'paid_pvp') && isP2Phase) && (
          <div style={{ marginTop: 'clamp(4px, 1vh, 10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <motion.div
              animate={timeLeft <= 8 ? { scale: [1, 1.15, 1] } : { scale: 1 }}
              transition={{ duration: 0.5, repeat: timeLeft <= 8 ? Infinity : 0 }}
              style={{
                fontSize: 'clamp(28px, 4.5vh, 48px)', fontWeight: 900, lineHeight: 1,
                color: timeLeft <= 5 ? '#ef4444' : timeLeft <= 10 ? '#f97316' : '#e2e8f0',
                textShadow: timeLeft <= 5 ? '0 0 24px rgba(239,68,68,0.8)' : timeLeft <= 10 ? '0 0 16px rgba(249,115,22,0.6)' : `0 0 12px ${currentColor}66`,
                fontVariantNumeric: 'tabular-nums', minWidth: 48, textAlign: 'center',
              }}
            >
              {timeLeft}
            </motion.div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div style={{ width: 'clamp(140px, 20vw, 220px)', height: 5, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
                <motion.div
                  style={{ height: '100%', borderRadius: 3, background: timeLeft <= 5 ? '#ef4444' : timeLeft <= 10 ? '#f97316' : currentColor }}
                  animate={{ width: `${(timeLeft / 30) * 100}%` }}
                  transition={{ duration: 0.9, ease: 'linear' }}
                />
              </div>
              <span style={{ fontSize: 10, color: '#475569', letterSpacing: '0.08em' }}>LOCKS IN {timeLeft}s</span>
            </div>
          </div>
        )}
        {(gameMode === 'vs_ai' || gameMode === 'paid_pvp') && isP2Phase && (
          <p style={{ color: '#fbbf24', fontWeight: 700, fontSize: 13, margin: '4px 0 0' }}>AI is setting its lineup...</p>
        )}
      </motion.div>

      {/* ── Creature list + confirm button — fills remaining height ── */}
      {(isP1Phase || isP2Phase) && (
        <div style={{ width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>

          {/* Scrollable list — but sized so it never needs to scroll at normal heights */}
          <div className="lineup-list" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 'clamp(4px, 0.8vh, 8px)' }}>
            {lineup.map((ac, i) => (
              <motion.div
                key={ac.creature.id}
                layout
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                style={{
                  display: 'flex', alignItems: 'center',
                  gap: 'clamp(8px, 1.5vw, 14px)',
                  background: '#1a1a2e',
                  border: `1px solid ${currentColor}33`,
                  borderRadius: 10,
                  padding: 'clamp(6px, 1.2vh, 11px) clamp(10px, 1.5vw, 14px)',
                  flex: 1, minHeight: 0,
                }}
              >
                {/* Position badge */}
                <div style={{
                  width: 'clamp(26px, 3.5vh, 34px)', height: 'clamp(26px, 3.5vh, 34px)',
                  borderRadius: '50%', background: currentColor, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 'clamp(13px, 2vh, 17px)', fontWeight: 900, color: 'white',
                }}>
                  {i + 1}
                </div>

                {/* Sprite — 2x larger */}
                <img
                  src={ac.creature.spriteUrl}
                  alt={ac.creature.name}
                  style={{ width: 'clamp(72px, 11vh, 100px)', height: 'clamp(72px, 11vh, 100px)', imageRendering: 'pixelated', flexShrink: 0 }}
                />

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 'clamp(13px, 2vh, 16px)', fontWeight: 700, color: '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {ac.creature.name}
                  </div>
                  <div style={{ display: 'flex', gap: 3, marginTop: 2, flexWrap: 'wrap' }}>
                    {ac.creature.types.map(t => (
                      <span key={t} style={{
                        fontSize: 9, padding: '1px 5px', borderRadius: 6,
                        background: `${TYPE_COLORS[t]}33`, color: TYPE_COLORS[t],
                        fontWeight: 700, textTransform: 'uppercase',
                      }}>{t}</span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 10, marginTop: 2, fontSize: 10, color: '#64748b' }}>
                    <span>ATK <span style={{ color: '#ef4444' }}>{ac.creature.baseAtk}</span></span>
                    <span>DEF <span style={{ color: '#3b82f6' }}>{ac.creature.baseDef}</span></span>
                    <span>SPE <span style={{ color: '#fbbf24' }}>{ac.creature.baseSpe}</span></span>
                  </div>
                </div>

                {/* Move buttons */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
                  <button
                    onClick={() => moveCreatureUp(i, isP1Phase ? 'p1' : 'p2')}
                    disabled={i === 0}
                    style={{
                      width: 'clamp(26px, 3.5vh, 30px)', height: 'clamp(26px, 3.5vh, 30px)',
                      background: i === 0 ? '#0f0f1a' : '#2d2d5e',
                      border: 'none', borderRadius: 6,
                      color: i === 0 ? '#2d2d5e' : '#e2e8f0',
                      fontSize: 13, cursor: i === 0 ? 'not-allowed' : 'pointer',
                    }}
                  >↑</button>
                  <button
                    onClick={() => moveCreatureDown(i, isP1Phase ? 'p1' : 'p2')}
                    disabled={i === lineup.length - 1}
                    style={{
                      width: 'clamp(26px, 3.5vh, 30px)', height: 'clamp(26px, 3.5vh, 30px)',
                      background: i === lineup.length - 1 ? '#0f0f1a' : '#2d2d5e',
                      border: 'none', borderRadius: 6,
                      color: i === lineup.length - 1 ? '#2d2d5e' : '#e2e8f0',
                      fontSize: 13, cursor: i === lineup.length - 1 ? 'not-allowed' : 'pointer',
                    }}
                  >↓</button>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Confirm button — pinned below list */}
          <div className="lineup-confirm">
          <motion.button
            whileHover={{ scale: 1.02, boxShadow: `0 0 20px ${currentColor}66` }}
            whileTap={{ scale: 0.97 }}
            onClick={() => confirmLineup(isP1Phase ? 'p1' : 'p2')}
            style={{
              width: '100%',
              marginTop: 'clamp(6px, 1.2vh, 14px)',
              padding: 'clamp(10px, 1.8vh, 15px)',
              background: `linear-gradient(135deg, ${currentColor}, ${currentColor}99)`,
              border: 'none', borderRadius: 12, flexShrink: 0,
              color: 'white', fontSize: 'clamp(14px, 2vh, 17px)', fontWeight: 700, cursor: 'pointer',
            }}
          >
            ✅ Lock In Order {isP1Phase && gameMode !== 'vs_ai' && gameMode !== 'paid_pvp' ? '→ P2' : '→ Arena'}
          </motion.button>
          </div>
        </div>
      )}
    </div>
  )
}
