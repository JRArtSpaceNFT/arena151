'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '@/lib/game-store'
import type { CoinSide } from '@/lib/game-types'

// Inline Pokéball SVG — red top half, white bottom half, black band, center button
function PokeBall({ size = 120 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      {/* Bottom white half */}
      <path d="M 5 50 A 45 45 0 0 0 95 50 Z" fill="#f1f5f9" />
      {/* Top red half */}
      <path d="M 5 50 A 45 45 0 0 1 95 50 Z" fill="#ef4444" />
      {/* Outer circle border */}
      <circle cx="50" cy="50" r="45" fill="none" stroke="#1f2937" strokeWidth="4" />
      {/* Middle band */}
      <rect x="5" y="46" width="90" height="8" fill="#1f2937" />
      {/* Center button outer */}
      <circle cx="50" cy="50" r="10" fill="white" stroke="#1f2937" strokeWidth="3" />
      {/* Center button inner */}
      <circle cx="50" cy="50" r="5" fill="#e2e8f0" />
    </svg>
  )
}

export default function CoinToss() {
  const {
    p1CoinChoice, coinResult, coinTossWinner,
    setP1CoinChoice, setP2CoinChoice, resolveCoinToss,
    p1Trainer, p2Trainer,
  } = useGameStore()

  const [phase, setPhase] = useState<'p1_pick' | 'flipping' | 'result'>('p1_pick')

  // Ball animation state — driven manually so we control timing precisely
  const [ballY, setBallY] = useState(0)
  const [ballRotate, setBallRotate] = useState(0)
  const [ballScale, setBallScale] = useState(1)
  const [ballX, setBallX] = useState(0)
  const [finalRotate, setFinalRotate] = useState<number | null>(null)

  const handleP1Pick = (side: CoinSide) => {
    setP1CoinChoice(side)
    const opposite: CoinSide = side === 'red' ? 'white' : 'red'
    setP2CoinChoice(opposite)
    setPhase('flipping')
  }

  // Run flip animation after phase becomes 'flipping'
  // We use setTimeout chains so we control every keyframe precisely
  useEffect(() => {
    if (phase !== 'flipping') return

    resolveCoinToss()
    const result = useGameStore.getState().coinResult

    // Reset
    setBallY(0)
    setBallRotate(0)
    setBallScale(1)
    setBallX(0)
    setFinalRotate(null)

    // Phase 1: fly UP (700ms)
    const t1 = setTimeout(() => {
      setBallY(-280)
      setBallRotate(540)
      setBallScale(1.4)
      setBallX(20)
    }, 50) // tiny delay so state resets render first

    // Phase 2: fall DOWN (start at 750ms, duration 650ms)
    const t2 = setTimeout(() => {
      setBallY(0)
      setBallRotate(1260)
      setBallScale(1)
      setBallX(0)
    }, 750)

    // Phase 3: bounce + settle (1400ms)
    const t3 = setTimeout(() => {
      setBallY(-12)
      setBallScale(0.85)
    }, 1400)

    const t4 = setTimeout(() => {
      setBallY(0)
      setBallScale(1.1)
    }, 1500)

    const t5 = setTimeout(() => {
      setBallScale(1)
      // Settle to correct side: red=multiple of 360, white=180+multiple of 360
      const settle = result === 'red' ? 1440 : 1620
      setFinalRotate(settle)
      setBallRotate(settle)
    }, 1600)

    // Phase 4: show result (2000ms)
    const t6 = setTimeout(() => {
      setPhase('result')
    }, 2200)

    return () => {
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3)
      clearTimeout(t4); clearTimeout(t5); clearTimeout(t6)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  // Auto-advance to draft
  useEffect(() => {
    if (phase === 'result') {
      const t = setTimeout(() => {
        useGameStore.setState({ screen: 'draft' })
      }, 3000)
      return () => clearTimeout(t)
    }
  }, [phase])

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0f',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      gap: 0,
    }}>
      <motion.h1
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          fontSize: 48, fontWeight: 900, color: '#ef4444',
          margin: 0, marginBottom: 8,
          textShadow: '0 0 24px rgba(239,68,68,0.6)',
          letterSpacing: '0.05em',
        }}
      >
        POKÉ TOSS
      </motion.h1>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        style={{ color: '#64748b', marginBottom: 8, fontSize: 15 }}
      >
        Winner picks first in the draft
      </motion.p>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        style={{ color: '#475569', fontSize: 12, marginBottom: 48 }}
      >
        🔴 Red = top half &nbsp;|&nbsp; ⚪ White = bottom half
      </motion.p>

      {/* Pokéball — always visible, animates on flip */}
      <div style={{
        position: 'relative',
        marginBottom: 40,
        height: 200,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}>
        <motion.div
          animate={{
            y: ballY,
            rotate: ballRotate,
            scale: ballScale,
            x: ballX,
          }}
          transition={phase === 'flipping' ? {
            duration: ballY === -280 ? 0.65 : 0.6,
            ease: ballY === -280 ? [0.25, 0.46, 0.45, 0.94] : [0.55, 0.06, 0.68, 0.19],
          } : { duration: 0.25, ease: 'easeOut' }}
          style={{
            display: 'inline-block',
            filter: phase === 'result'
              ? `drop-shadow(0 0 24px ${coinResult === 'red' ? 'rgba(239,68,68,0.8)' : 'rgba(200,220,255,0.8)'})`
              : 'drop-shadow(0 4px 12px rgba(0,0,0,0.5))',
          }}
        >
          <PokeBall size={160} />
        </motion.div>
      </div>

      {/* Phase content */}
      <AnimatePresence mode="wait">
        {phase === 'p1_pick' && (
          <motion.div
            key="p1_pick"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            style={{ textAlign: 'center' }}
          >
            <div style={{ color: '#7c3aed', fontSize: 22, fontWeight: 700, marginBottom: 28 }}>
              {p1Trainer?.name ?? 'Player 1'} — choose your side
            </div>
            <div style={{ display: 'flex', gap: 24, justifyContent: 'center' }}>
              <CoinButton label="🔴 RED" sublabel="(top half)" onClick={() => handleP1Pick('red')} color="#ef4444" />
              <CoinButton label="⚪ WHITE" sublabel="(bottom half)" onClick={() => handleP1Pick('white')} color="#94a3b8" />
            </div>
          </motion.div>
        )}

        {phase === 'flipping' && (
          <motion.div
            key="flipping"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ textAlign: 'center' }}
          >
            <motion.div
              animate={{ opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 0.6, repeat: Infinity }}
              style={{ color: '#fbbf24', fontSize: 22, fontWeight: 700, letterSpacing: '0.15em' }}
            >
              ⬆ UP IT GOES...
            </motion.div>
          </motion.div>
        )}

        {phase === 'result' && coinResult && (
          <motion.div
            key="result"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            style={{ textAlign: 'center' }}
          >
            <div style={{ color: '#fbbf24', fontSize: 28, fontWeight: 900, marginBottom: 12 }}>
              {coinResult === 'red' ? '🔴 RED' : '⚪ WHITE'} wins!
            </div>
            <motion.div
              animate={{ scale: [1, 1.06, 1] }}
              transition={{ repeat: 3, duration: 0.5 }}
              style={{
                fontSize: 30, fontWeight: 900,
                color: coinTossWinner === 'p1' ? '#7c3aed' : '#ef4444',
                textShadow: `0 0 20px ${coinTossWinner === 'p1' ? 'rgba(124,58,237,0.7)' : 'rgba(239,68,68,0.7)'}`,
              }}
            >
              {coinTossWinner === 'p1' ? p1Trainer?.name : p2Trainer?.name} picks first!
            </motion.div>
            <div style={{ color: '#475569', marginTop: 16, fontSize: 13 }}>
              Heading to the draft...
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function CoinButton({ label, sublabel, onClick, color }: {
  label: string
  sublabel: string
  onClick: () => void
  color: string
}) {
  return (
    <motion.button
      whileHover={{ scale: 1.06, boxShadow: `0 0 24px ${color}66` }}
      whileTap={{ scale: 0.94 }}
      onClick={onClick}
      style={{
        padding: '22px 44px',
        background: '#1a1a2e',
        border: `2px solid ${color}`,
        borderRadius: 14,
        color,
        fontSize: 22,
        fontWeight: 800,
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
      }}
    >
      {label}
      <span style={{ fontSize: 12, fontWeight: 400, opacity: 0.6 }}>{sublabel}</span>
    </motion.button>
  )
}
