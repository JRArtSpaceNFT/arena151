'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useGameStore } from '@/lib/game-store'
import { playMusic } from '@/lib/audio/musicEngine'

const DEFEAT_LINES = [
  "Your team fought bravely, but this battle was not yours.",
  "Victory slipped away this time. Train harder and return stronger.",
  "Even great trainers fall. What matters is how you rise.",
  "Defeat is only the beginning of your comeback.",
]


// Deterministic ember positions — no Math.random() during render
const EMBERS = Array.from({ length: 18 }, (_, i) => ({
  left: `${(i * 17 + 5) % 100}%`,
  delay: i * 0.35,
  duration: 3.5 + (i % 5) * 0.6,
  size: 2 + (i % 3),
}))

export default function DefeatScreen() {
  const { navigateTo, gameMode, storyProgress, battleState, p1Trainer, p2Trainer, arena, matchResults } = useGameStore()
  const [defeatLine] = useState(() => DEFEAT_LINES[Math.floor(Math.random() * DEFEAT_LINES.length)])

  useEffect(() => { playMusic('battle') }, [])

  const handleContinue = () => {
    if (gameMode === 'story') navigateTo('story_journey')
    else navigateTo('results')
  }

  const loserTrainer = battleState?.winner === 'A' ? p2Trainer : p1Trainer
  const arenaImage = arena?.image ?? null

  return (
    <div style={{ height: '100dvh', maxHeight: '100dvh', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '28px 20px 40px', overflow: 'hidden' }}>

      {/* ── Battlefield at 8% opacity — loser stood here ── */}
      {arenaImage && (
        <div style={{
          position: 'fixed', inset: 0,
          backgroundImage: `url(${arenaImage})`,
          backgroundSize: 'cover', backgroundPosition: 'center',
          opacity: 0.08,
          zIndex: 0,
        }} />
      )}

      {/* Dark red base */}
      <div style={{ position: 'fixed', inset: 0, background: 'linear-gradient(160deg,#12000a 0%,#0a000f 50%,#060006 100%)', zIndex: 1 }} />

      {/* Pulsing vignette */}
      <motion.div
        style={{ position: 'fixed', inset: 0, zIndex: 2, pointerEvents: 'none',
          background: 'radial-gradient(ellipse at center, transparent 20%, rgba(100,0,0,0.65) 100%)' }}
        animate={{ opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Deep red glow behind center */}
      <motion.div style={{
        position: 'fixed', top: '30%', left: '50%', transform: 'translateX(-50%)',
        width: 500, height: 500, borderRadius: '50%', pointerEvents: 'none', zIndex: 2,
        background: 'radial-gradient(circle, rgba(180,0,0,0.25) 0%, transparent 70%)',
        filter: 'blur(30px)',
      }}
        animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.9, 0.5] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Falling embers */}
      {EMBERS.map((e, i) => (
        <motion.div key={i}
          initial={{ y: -30, opacity: 0 }}
          animate={{ y: '105vh', opacity: [0, 0.7, 0] }}
          transition={{ duration: e.duration, repeat: Infinity, delay: e.delay, ease: 'easeIn' }}
          style={{
            position: 'fixed', left: e.left, top: 0,
            width: e.size, height: e.size * 2.5,
            background: '#ef4444', borderRadius: 2,
            boxShadow: '0 0 6px #ef4444, 0 0 12px #ef444488',
            zIndex: 3,
          }}
        />
      ))}

      {/* ── Content ── */}
      <div style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: 820, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

        {/* Fallen trainer — large, center, greyscale */}
        {loserTrainer?.spriteUrl && (
          <motion.div style={{ position: 'relative', marginBottom: 12 }}>
            {/* Red halo behind trainer */}
            <motion.div style={{
              position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)',
              width: 200, height: 80,
              background: 'radial-gradient(ellipse, rgba(220,38,38,0.4) 0%, transparent 70%)',
              filter: 'blur(16px)', pointerEvents: 'none',
            }}
              animate={{ opacity: [0.4, 0.8, 0.4] }} transition={{ duration: 2.5, repeat: Infinity }}
            />
            <motion.img
              src={loserTrainer.spriteUrl}
              alt={loserTrainer.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 0.65, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
              style={{
                height: 160, width: 'auto',
                imageRendering: 'pixelated',
                filter: 'grayscale(100%) brightness(0.45) drop-shadow(0 0 20px rgba(239,68,68,0.4))',
                display: 'block', position: 'relative', zIndex: 1,
              }}
            />
          </motion.div>
        )}

        {/* DEFEAT */}
        <motion.h1
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, type: 'spring', stiffness: 200, damping: 18 }}
          style={{
            fontSize: 72, fontWeight: 900, margin: '0 0 10px',
            color: '#ef4444',
            textShadow: '0 0 60px rgba(239,68,68,0.9), 0 0 120px rgba(180,0,0,0.6), 4px 4px 12px rgba(0,0,0,0.95)',
            letterSpacing: '0.12em', lineHeight: 1,
          }}
        >
          DEFEAT
        </motion.h1>

        {/* Cracked line divider */}
        <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.5, duration: 0.5 }}
          style={{ width: 280, height: 1, background: 'linear-gradient(90deg,transparent,rgba(239,68,68,0.6),transparent)', marginBottom: 14 }} />

        {/* Defeat message */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.55 }}
          style={{ fontSize: 15, color: '#fca5a5', marginBottom: 28, lineHeight: 1.6, textAlign: 'center', maxWidth: 480, opacity: 0.85 }}
        >
          {gameMode === 'story' ? "Don't give up! Every Champion has lost before. Return to your journey and try again!" : defeatLine}
        </motion.p>



        {/* Battle summary */}
        {battleState && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }}
            style={{ display: 'flex', gap: 14, marginBottom: 28, justifyContent: 'center' }}>
            {[
              { label: 'Turns', value: battleState.turn, color: '#7c3aed' },
              { label: 'Your KOs', value: battleState.teamA.reduce((s: number, c: any) => s + (c.kos ?? 0), 0), color: '#7c3aed' },
              { label: 'Enemy KOs', value: battleState.teamB.reduce((s: number, c: any) => s + (c.kos ?? 0), 0), color: '#ef4444' },
            ].map(stat => (
              <div key={stat.label} style={{ textAlign: 'center', background: 'rgba(0,0,0,0.45)', padding: '8px 18px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.07)' }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: stat.color }}>{stat.value}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{stat.label}</div>
              </div>
            ))}
          </motion.div>
        )}

        {/* Button */}
        <motion.button
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1 }}
          whileHover={{ scale: 1.05, boxShadow: '0 0 40px rgba(239,68,68,0.7)' }}
          whileTap={{ scale: 0.97 }}
          onClick={handleContinue}
          style={{
            background: 'linear-gradient(135deg, #dc2626, #7f1d1d)',
            border: '2px solid rgba(239,68,68,0.6)', borderRadius: 12,
            padding: '14px 52px', color: '#fff', fontSize: 19, fontWeight: 900,
            cursor: 'pointer', letterSpacing: '0.1em',
            boxShadow: '0 0 30px rgba(239,68,68,0.4), 0 6px 18px rgba(0,0,0,0.5)',
          }}>
          {gameMode === 'story' ? 'RETURN TO JOURNEY' : 'BATTLE RESULTS'}
        </motion.button>

        {gameMode === 'story' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1 }}
            style={{ marginTop: 16, fontSize: 13, color: '#fca5a5', opacity: 0.7 }}>
            Progress: {storyProgress?.earnedBadges.length ?? 0} / 8 Badges
          </motion.div>
        )}
      </div>
    </div>
  )
}
