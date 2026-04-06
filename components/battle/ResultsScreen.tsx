'use client'

import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { useGameStore } from '@/lib/game-store'
import { useArenaStore } from '@/lib/store'
import { stopMusic } from '@/lib/audio/musicEngine'

export default function ResultsScreen() {
  const {
    matchResults, battleState,
    p1Trainer, p2Trainer,
    p1Coins, p2Coins,
    playAgain,
  } = useGameStore()
  const setLastMatchWinner = useArenaStore(s => s.setLastMatchWinner)

  // Music continues from VictoryScreen/DefeatScreen — do not restart it here

  if (!matchResults || !battleState) {
    return (
      <div style={{
        height: '100dvh', maxHeight: '100dvh', background: '#0a0a0f',
        display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
        color: '#94a3b8', fontSize: 20,
      }}>
        Loading results...
      </div>
    )
  }

  const winnerName = matchResults.winner === 1
    ? (p1Trainer?.name ?? 'Player 1')
    : (p2Trainer?.name ?? 'Player 2')
  const winnerColor = matchResults.winner === 1 ? '#7c3aed' : '#ef4444'

  const awards = [
    {
      title: '👑 MVP',
      subtitle: 'Most Valuable Fighter',
      creature: matchResults.mvp,
      stat: `${matchResults.mvp.kos} KOs · ${matchResults.mvp.damageDealt} dmg`,
      color: '#fbbf24',
    },
    {
      title: '⚔️ Most Damage',
      subtitle: 'Highest damage output',
      creature: matchResults.mostDamage,
      stat: `${matchResults.mostDamage.damageDealt} total damage`,
      color: '#ef4444',
    },
    {
      title: '💀 Most KOs',
      subtitle: 'Best knockdown artist',
      creature: matchResults.mostKOs,
      stat: `${matchResults.mostKOs.kos} knockouts`,
      color: '#f97316',
    },
    {
      title: '⏱️ Longest Survival',
      subtitle: 'Last one standing',
      creature: matchResults.longestSurvival,
      stat: `${matchResults.longestSurvival.turnsAlive} turns survived`,
      color: '#22c55e',
    },
    {
      title: '💎 Best Value',
      subtitle: 'Most efficient pick',
      creature: matchResults.bestValue,
      stat: `${matchResults.bestValue.creature.pointCost} pts cost`,
      color: '#a855f7',
    },
  ]

  return (
    <div style={{
      height: '100dvh',
      maxHeight: '100dvh',
      background: '#0a0a0f',
      padding: '20px 24px',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Winner announcement */}
      <motion.div
        initial={{ opacity: 1, scale: 1 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6 }}
        style={{ textAlign: 'center', marginBottom: 16 }}
      >
        <motion.div
          animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
          transition={{ duration: 0.8, delay: 0.3 }}
          style={{ fontSize: 48, marginBottom: 8 }}
        >
          🏆
        </motion.div>
        <h1 style={{
          fontSize: 44, fontWeight: 900, margin: 0,
          color: winnerColor,
          textShadow: `0 0 30px ${winnerColor}66`,
        }}>
          {winnerName} WINS!
        </h1>
        <p style={{ color: '#64748b', fontSize: 14, marginTop: 4 }}>
          {matchResults.winner === 1 ? p2Trainer?.name : p1Trainer?.name} fought valiantly but fell short.
        </p>
      </motion.div>

      {/* Award cards — all 5 in one row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        gap: 10,
        maxWidth: 1200,
        margin: '0 auto 12px',
        width: '100%',
      }}>
        {awards.map((award, i) => (
          <motion.div
            key={award.title}
            initial={{ opacity: 1, y: 0 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 + i * 0.1 }}
            style={{
              background: '#1a1a2e',
              border: `1px solid ${award.color}44`,
              borderRadius: 12, padding: 12,
              textAlign: 'center',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: 3,
              background: award.color,
            }} />

            <div style={{ fontSize: 16, fontWeight: 800, color: award.color, marginBottom: 4 }}>
              {award.title}
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 12 }}>
              {award.subtitle}
            </div>

            <motion.div
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 2, repeat: Infinity, delay: i * 0.2 }}
            >
              <img
                src={award.creature.creature.spriteUrl}
                alt={award.creature.creature.name}
                style={{ width: 56, height: 56, imageRendering: 'pixelated', display: 'block', margin: '0 auto' }}
              />
            </motion.div>

            <div style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9', marginTop: 8 }}>
              {award.creature.creature.name}
            </div>
            <div style={{ fontSize: 12, color: award.color, marginTop: 4, fontWeight: 600 }}>
              {award.stat}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Battle summary + Continue — compact row */}
      <motion.div
        initial={{ opacity: 1 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.0 }}
        style={{
          maxWidth: 1100, margin: '0 auto',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 24, flexWrap: 'wrap',
        }}
      >
        <div style={{
          flex: 1, minWidth: 300,
          background: '#1a1a2e', border: '1px solid #2d2d5e', borderRadius: 12, padding: '12px 20px',
          display: 'flex', justifyContent: 'space-around', gap: 16, flexWrap: 'wrap',
        }}>
          <StatDisplay label="Turns" value={battleState.turn} color="#7c3aed" />
          <StatDisplay label="P1 KOs" value={battleState.teamA.reduce((s, c) => s + c.kos, 0)} color="#7c3aed" />
          <StatDisplay label="P2 KOs" value={battleState.teamB.reduce((s, c) => s + c.kos, 0)} color="#ef4444" />
        </div>

        <motion.button
          whileHover={{ scale: 1.05, boxShadow: '0 0 30px rgba(124,58,237,0.5)' }}
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            stopMusic()
            // Capture winner BEFORE playAgain() wipes matchResults to null
            setLastMatchWinner(matchResults?.winner ?? null)
            playAgain()
          }}
          style={{
            padding: '16px 48px',
            background: 'linear-gradient(135deg, #7c3aed, #5b21b6)',
            border: 'none', borderRadius: 14,
            color: 'white', fontSize: 20, fontWeight: 900, cursor: 'pointer',
            letterSpacing: '0.05em',
            whiteSpace: 'nowrap',
          }}
        >
          ▶ Continue
        </motion.button>
      </motion.div>
    </div>
  )
}

function CoinDisplay({
  label, coins, betResult, color,
}: {
  label: string; coins: number; betResult?: number; color: string
}) {
  const gained = betResult && betResult > 0
  const lost = betResult && betResult < 0

  return (
    <motion.div
      initial={{ scale: 0.9 }}
      animate={{ scale: 1 }}
      style={{
        background: '#1a1a2e',
        border: `1px solid ${color}44`,
        borderRadius: 12, padding: '16px 24px', textAlign: 'center',
        minWidth: 180,
      }}
    >
      <div style={{ color, fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 900, color: '#fbbf24' }}>
        💰 {coins}
      </div>
      {betResult !== undefined && betResult !== 0 && (
        <div style={{
          marginTop: 6, fontSize: 14, fontWeight: 700,
          color: gained ? '#22c55e' : '#ef4444',
        }}>
          {gained ? `+${betResult}` : `${betResult}`} from bet
        </div>
      )}
      {betResult === 0 && (
        <div style={{ marginTop: 6, fontSize: 12, color: '#475569' }}>No bet placed</div>
      )}
    </motion.div>
  )
}

function StatDisplay({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 24, fontWeight: 900, color }}>{value}</div>
      <div style={{ fontSize: 12, color: '#64748b' }}>{label}</div>
    </div>
  )
}
