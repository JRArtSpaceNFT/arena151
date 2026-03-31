'use client'

import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { useGameStore } from '@/lib/game-store'
import { playMusic } from '@/lib/audio/musicEngine'

export default function DefeatScreen() {
  const { navigateTo, gameMode, storyProgress, battleState, p1Trainer, p2Trainer, arena } = useGameStore()

  // Play victory/end music when defeat screen shows
  useEffect(() => { playMusic('victory') }, [])

  const handleContinue = () => {
    if (gameMode === 'story') {
      navigateTo('story_journey')
    } else {
      navigateTo('home')
    }
  }

  // Loser is whoever didn't win
  const loserTrainer = battleState?.winner === 'A' ? p2Trainer : p1Trainer
  const arenaImage = arena?.image ?? null

  return (
    <div style={{
      height: '100vh',
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px 24px',
      overflow: 'hidden',
    }}>

      {/* Arena background — very dark */}
      {arenaImage ? (
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `url(${arenaImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'brightness(0.18) saturate(0.6)',
          zIndex: 0,
        }} />
      ) : (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(135deg, #1c0a0a 0%, #0a0a0f 100%)',
          zIndex: 0,
        }} />
      )}

      {/* Subtle red vignette overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at center, transparent 30%, rgba(80,0,0,0.7) 100%)',
        zIndex: 1,
      }} />

      {/* Falling embers */}
      {[...Array(12)].map((_, i) => (
        <motion.div
          key={i}
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: '100vh', opacity: [0, 0.5, 0] }}
          transition={{ duration: 4 + Math.random() * 3, repeat: Infinity, delay: i * 0.4 }}
          style={{
            position: 'absolute',
            left: `${Math.random() * 100}%`,
            width: 3, height: 6,
            background: '#ef4444',
            borderRadius: 2,
            boxShadow: '0 0 6px #ef4444',
            zIndex: 2,
          }}
        />
      ))}

      <motion.div
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.45 }}
        style={{
          maxWidth: 640, width: '100%',
          textAlign: 'center',
          position: 'relative',
          zIndex: 10,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
        }}
      >
        {/* Loser trainer sprite */}
        {loserTrainer?.spriteUrl && (
          <motion.img
            src={loserTrainer.spriteUrl}
            alt={loserTrainer.name}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 0.55, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            style={{
              height: 140,
              width: 'auto',
              imageRendering: 'pixelated',
              filter: 'grayscale(100%) brightness(0.5)',
              marginBottom: 8,
            }}
          />
        )}

        {/* 💔 icon */}
        <motion.div
          initial={{ rotate: 0 }}
          animate={{ rotate: [0, -10, 10, -5, 5, 0] }}
          transition={{ duration: 0.6, delay: 0.2 }}
          style={{ fontSize: 52, marginBottom: 12, filter: 'grayscale(100%)', opacity: 0.7 }}
        >
          💔
        </motion.div>

        {/* DEFEAT title */}
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          style={{
            fontSize: 56, fontWeight: 900, margin: '0 0 12px',
            color: '#ef4444',
            textShadow: '0 0 32px rgba(239,68,68,0.8), 4px 4px 8px rgba(0,0,0,0.9)',
            letterSpacing: '0.1em',
          }}
        >
          DEFEAT
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          style={{
            fontSize: 15, color: '#fca5a5',
            marginBottom: 32, lineHeight: 1.5,
          }}
        >
          {gameMode === 'story'
            ? "Don't give up! Every Champion has lost before. Return to your journey and try again!"
            : "Your team fought bravely, but victory slipped away. Regroup and come back stronger!"}
        </motion.p>

        {/* Continue button */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleContinue}
          style={{
            background: 'linear-gradient(135deg, #dc2626, #991b1b)',
            border: '3px solid #ef4444',
            borderRadius: 12,
            padding: '16px 48px',
            color: '#fff', fontSize: 22, fontWeight: 900,
            cursor: 'pointer', letterSpacing: '0.1em',
            boxShadow: '0 0 32px rgba(239,68,68,0.5), 0 6px 18px rgba(0,0,0,0.4)',
          }}
        >
          {gameMode === 'story' ? 'RETURN TO JOURNEY' : 'BACK TO HOME'}
        </motion.button>

        {gameMode === 'story' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            style={{ marginTop: 24, fontSize: 14, color: '#fca5a5', opacity: 0.8 }}
          >
            Progress: {storyProgress?.earnedBadges.length ?? 0} / 8 Badges
          </motion.div>
        )}
      </motion.div>
    </div>
  )
}
