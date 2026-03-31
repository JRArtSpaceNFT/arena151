'use client'

import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { useGameStore } from '@/lib/game-store'
import { playMusic } from '@/lib/audio/musicEngine'

const AWARD_CONFIG = [
  { key: 'mvp',            label: '👑 MVP',            sub: 'Most Valuable Fighter',  statFn: (c: any) => `${c.kos} KOs · ${c.damageDealt} dmg`,   color: '#fbbf24' },
  { key: 'mostDamage',     label: '⚔️ Most Damage',    sub: 'Highest damage output',  statFn: (c: any) => `${c.damageDealt} total dmg`,              color: '#ef4444' },
  { key: 'mostKOs',        label: '💀 Most KOs',        sub: 'Best knockdown artist',  statFn: (c: any) => `${c.kos} knockouts`,                      color: '#f97316' },
  { key: 'longestSurvival',label: '⏱️ Longest Survival',sub: 'Last one standing',      statFn: (c: any) => `${c.turnsAlive} turns`,                   color: '#22c55e' },
  { key: 'bestValue',      label: '💎 Best Value',      sub: 'Most efficient pick',    statFn: (c: any) => `${c.creature?.pointCost ?? '?'} pts cost`, color: '#a855f7' },
]

export default function DefeatScreen() {
  const { navigateTo, gameMode, storyProgress, battleState, p1Trainer, p2Trainer, arena, matchResults } = useGameStore()

  // Play end-game music — but only if not already playing (don't restart)
  useEffect(() => { playMusic('victory') }, [])

  const handleContinue = () => {
    if (gameMode === 'story') navigateTo('story_journey')
    else navigateTo('home')
  }

  const loserTrainer = battleState?.winner === 'A' ? p2Trainer : p1Trainer
  const arenaImage = arena?.image ?? null

  return (
    <div style={{
      minHeight: '100vh',
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '24px 20px 32px',
      overflow: 'auto',
    }}>

      {/* Arena background */}
      {arenaImage ? (
        <div style={{ position: 'fixed', inset: 0, backgroundImage: `url(${arenaImage})`, backgroundSize: 'cover', backgroundPosition: 'center', filter: 'brightness(0.18) saturate(0.6)', zIndex: 0 }} />
      ) : (
        <div style={{ position: 'fixed', inset: 0, background: 'linear-gradient(135deg, #1c0a0a 0%, #0a0a0f 100%)', zIndex: 0 }} />
      )}
      <div style={{ position: 'fixed', inset: 0, background: 'radial-gradient(ellipse at center, transparent 30%, rgba(80,0,0,0.7) 100%)', zIndex: 1 }} />

      {/* Falling embers */}
      {[...Array(12)].map((_, i) => (
        <motion.div key={i}
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: '100vh', opacity: [0, 0.5, 0] }}
          transition={{ duration: 4 + Math.random() * 3, repeat: Infinity, delay: i * 0.4 }}
          style={{ position: 'fixed', left: `${(i * 8.3) % 100}%`, width: 3, height: 6, background: '#ef4444', borderRadius: 2, boxShadow: '0 0 6px #ef4444', zIndex: 2 }}
        />
      ))}

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: 800, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

        {/* Loser trainer sprite */}
        {loserTrainer?.spriteUrl && (
          <motion.img src={loserTrainer.spriteUrl} alt={loserTrainer.name}
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 0.55, y: 0 }} transition={{ delay: 0.2, duration: 0.5 }}
            style={{ height: 120, width: 'auto', imageRendering: 'pixelated', filter: 'grayscale(100%) brightness(0.5)', marginBottom: 4 }}
          />
        )}

        <motion.div initial={{ rotate: 0 }} animate={{ rotate: [0, -10, 10, -5, 5, 0] }} transition={{ duration: 0.6, delay: 0.2 }}
          style={{ fontSize: 44, marginBottom: 8, filter: 'grayscale(100%)', opacity: 0.7 }}>💔</motion.div>

        <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          style={{ fontSize: 52, fontWeight: 900, margin: '0 0 8px', color: '#ef4444', textShadow: '0 0 32px rgba(239,68,68,0.8), 4px 4px 8px rgba(0,0,0,0.9)', letterSpacing: '0.1em' }}>
          DEFEAT
        </motion.h1>

        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
          style={{ fontSize: 14, color: '#fca5a5', marginBottom: 24, lineHeight: 1.5, textAlign: 'center' }}>
          {gameMode === 'story'
            ? "Don't give up! Every Champion has lost before. Return to your journey and try again!"
            : "Your team fought bravely, but victory slipped away. Regroup and come back stronger!"}
        </motion.p>

        {/* ── Match Awards ── */}
        {matchResults && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}
            style={{ width: '100%', marginBottom: 24 }}>
            <p style={{ textAlign: 'center', fontSize: 11, fontWeight: 900, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', marginBottom: 12 }}>
              Battle Awards
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
              {AWARD_CONFIG.map((award, i) => {
                const creature = (matchResults as any)[award.key]
                if (!creature) return null
                return (
                  <motion.div key={award.key}
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 + i * 0.07 }}
                    style={{
                      background: 'rgba(0,0,0,0.55)',
                      border: `1px solid ${award.color}33`,
                      borderRadius: 10, padding: '10px 8px',
                      textAlign: 'center', position: 'relative', overflow: 'hidden',
                    }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: award.color }} />
                    <div style={{ fontSize: 12, fontWeight: 800, color: award.color, marginBottom: 2 }}>{award.label}</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginBottom: 8 }}>{award.sub}</div>
                    <motion.img
                      src={creature.creature?.spriteUrl}
                      alt={creature.creature?.name}
                      animate={{ y: [0, -3, 0] }} transition={{ duration: 2, repeat: Infinity, delay: i * 0.2 }}
                      style={{ width: 48, height: 48, imageRendering: 'pixelated', display: 'block', margin: '0 auto' }}
                    />
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9', marginTop: 6 }}>{creature.creature?.name}</div>
                    <div style={{ fontSize: 11, color: award.color, marginTop: 3, fontWeight: 600 }}>{award.statFn(creature)}</div>
                  </motion.div>
                )
              })}
            </div>
          </motion.div>
        )}

        {/* Battle summary */}
        {battleState && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }}
            style={{ display: 'flex', gap: 16, marginBottom: 24, justifyContent: 'center' }}>
            {[
              { label: 'Turns', value: battleState.turn, color: '#7c3aed' },
              { label: 'Your KOs', value: battleState.teamA.reduce((s: number, c: any) => s + (c.kos ?? 0), 0), color: '#7c3aed' },
              { label: 'Enemy KOs', value: battleState.teamB.reduce((s: number, c: any) => s + (c.kos ?? 0), 0), color: '#ef4444' },
            ].map(stat => (
              <div key={stat.label} style={{ textAlign: 'center', background: 'rgba(0,0,0,0.4)', padding: '8px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.07)' }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: stat.color }}>{stat.value}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{stat.label}</div>
              </div>
            ))}
          </motion.div>
        )}

        {/* Button */}
        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          onClick={handleContinue}
          style={{
            background: 'linear-gradient(135deg, #dc2626, #991b1b)',
            border: '3px solid #ef4444', borderRadius: 12,
            padding: '14px 48px', color: '#fff', fontSize: 20, fontWeight: 900,
            cursor: 'pointer', letterSpacing: '0.1em',
            boxShadow: '0 0 32px rgba(239,68,68,0.5), 0 6px 18px rgba(0,0,0,0.4)',
          }}>
          {gameMode === 'story' ? 'RETURN TO JOURNEY' : 'BACK TO HOME'}
        </motion.button>

        {gameMode === 'story' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}
            style={{ marginTop: 16, fontSize: 13, color: '#fca5a5', opacity: 0.8 }}>
            Progress: {storyProgress?.earnedBadges.length ?? 0} / 8 Badges
          </motion.div>
        )}
      </div>
    </div>
  )
}
