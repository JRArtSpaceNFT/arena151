'use client'
import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect } from 'react'

interface MomentumMeterProps {
  currentHpA: number
  maxHpA: number
  currentHpB: number
  maxHpB: number
  activeA: number
  activeB: number
  koSetA: Set<number>
  koSetB: Set<number>
  teamSizeA: number
  teamSizeB: number
  attackingSide: 'A' | 'B' | null
}

export default function MomentumMeter({
  currentHpA,
  maxHpA,
  currentHpB,
  maxHpB,
  activeA,
  activeB,
  koSetA,
  koSetB,
  teamSizeA,
  teamSizeB,
  attackingSide,
}: MomentumMeterProps) {
  const [momentum, setMomentum] = useState(0) // -100 (B dominating) to +100 (A dominating)
  const [momentumState, setMomentumState] = useState<string | null>(null)
  const [stateKey, setStateKey] = useState(0)

  useEffect(() => {
    // Calculate momentum based on:
    // 1. HP advantage
    // 2. Team alive count
    // 3. Who's attacking (slight boost)

    const hpPctA = maxHpA > 0 ? (currentHpA / maxHpA) * 100 : 0
    const hpPctB = maxHpB > 0 ? (currentHpB / maxHpB) * 100 : 0

    const aliveA = teamSizeA - koSetA.size
    const aliveB = teamSizeB - koSetB.size

    // Team alive count is PRIMARY driver (-60 to +60)
    const aliveDiff = (aliveA - aliveB) * 30

    // HP difference contribution (-30 to +30)
    const hpDiff = (hpPctA - hpPctB) * 0.3

    // Attacker bonus (±10)
    const attackBonus = attackingSide === 'A' ? 10 : attackingSide === 'B' ? -10 : 0

    let total = aliveDiff + hpDiff + attackBonus

    // Clamp to -100 to +100
    total = Math.max(-100, Math.min(100, total))

    setMomentum(total)

    // Determine state label
    let newState: string | null = null

    if (hpPctA <= 15 && hpPctA > 0 && aliveA === 1) {
      newState = 'FINAL STAND'
    } else if (hpPctB <= 15 && hpPctB > 0 && aliveB === 1) {
      newState = 'FINAL STAND'
    } else if (hpPctA <= 25 && hpPctA > 0) {
      newState = 'DANGER STATE'
    } else if (hpPctB <= 25 && hpPctB > 0) {
      newState = 'DANGER STATE'
    } else if (total >= 60) {
      newState = 'RED DOMINANT'
    } else if (total <= -60) {
      newState = 'BLUE DOMINANT'
    } else if (total >= 30 && total < 60) {
      newState = 'MOMENTUM → RED'
    } else if (total <= -30 && total > -60) {
      newState = 'MOMENTUM → BLUE'
    } else if (total >= 10 && total < 30) {
      newState = 'RED RALLYING'
    } else if (total <= -10 && total > -30) {
      newState = 'BLUE RALLYING'
    } else {
      newState = 'EVEN FIGHT'
    }

    if (newState !== momentumState) {
      setMomentumState(newState)
      setStateKey(k => k + 1)
    }
  }, [currentHpA, maxHpA, currentHpB, maxHpB, koSetA.size, koSetB.size, teamSizeA, teamSizeB, attackingSide, momentumState])

  // Visual bar position: -100 = far left (blue), 0 = center, +100 = far right (red)
  const barPosition = 50 + (momentum / 2) // converts -100..100 → 0..100%

  // Color gradient based on momentum
  const getColor = () => {
    if (momentum >= 40) return '#ef4444' // red
    if (momentum <= -40) return '#3b82f6' // blue
    return '#94a3b8' // gray neutral
  }

  const getStateColor = () => {
    if (momentumState?.includes('RED') || momentumState?.includes('FINAL STAND') || momentumState?.includes('DANGER')) return '#ef4444'
    if (momentumState?.includes('BLUE')) return '#3b82f6'
    return '#fbbf24'
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: '4%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 320,
        pointerEvents: 'none',
        zIndex: 15,
      }}
    >
      {/* State label */}
      <AnimatePresence mode="wait">
        {momentumState && (
          <motion.div
            key={stateKey}
            initial={{ opacity: 0, scale: 0.8, y: -5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: -5 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            style={{
              textAlign: 'center',
              fontSize: 11,
              fontWeight: 900,
              color: getStateColor(),
              textShadow: `0 0 12px ${getStateColor()}`,
              letterSpacing: '0.12em',
              marginBottom: 6,
              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))',
            }}
          >
            {momentumState}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Meter bar track */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: 8,
          background: 'linear-gradient(90deg, rgba(59,130,246,0.3) 0%, rgba(148,163,184,0.2) 50%, rgba(239,68,68,0.3) 100%)',
          borderRadius: 20,
          border: '1px solid rgba(255,255,255,0.15)',
          overflow: 'visible',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3), inset 0 1px 2px rgba(0,0,0,0.3)',
        }}
      >
        {/* Center tick */}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: -2,
            width: 2,
            height: 12,
            background: '#fff',
            transform: 'translateX(-50%)',
            borderRadius: 1,
            boxShadow: '0 0 4px rgba(255,255,255,0.6)',
          }}
        />

        {/* Moving indicator */}
        <motion.div
          animate={{ left: `${barPosition}%` }}
          transition={{ type: 'spring', stiffness: 200, damping: 25 }}
          style={{
            position: 'absolute',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: getColor(),
            border: '2px solid #fff',
            boxShadow: `0 0 12px ${getColor()}, 0 2px 6px rgba(0,0,0,0.4)`,
          }}
        />
      </div>

      {/* Labels */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 4,
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: '0.08em',
        }}
      >
        <span style={{ color: '#3b82f6', textShadow: '0 0 6px rgba(59,130,246,0.6)' }}>BLUE</span>
        <span style={{ color: '#ef4444', textShadow: '0 0 6px rgba(239,68,68,0.6)' }}>RED</span>
      </div>
    </div>
  )
}
