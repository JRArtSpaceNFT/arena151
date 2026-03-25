'use client'

import { motion } from 'framer-motion'
import { useGameStore } from '@/lib/game-store'

export default function DefeatScreen() {
  const { navigateTo, gameMode, storyProgress } = useGameStore()

  const handleContinue = () => {
    if (gameMode === 'story') {
      navigateTo('story_journey')
    } else {
      navigateTo('home')
    }
  }

  return (
    <div style={{
      height: '100vh',
      background: 'linear-gradient(135deg, #7f1d1d 0%, #450a0a 50%, #1c1917 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px 24px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Falling embers */}
      {[...Array(12)].map((_, i) => (
        <motion.div
          key={i}
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: '100vh', opacity: [0, 0.6, 0] }}
          transition={{ duration: 4 + Math.random() * 3, repeat: Infinity, delay: i * 0.4 }}
          style={{
            position: 'absolute',
            left: `${Math.random() * 100}%`,
            width: 3,
            height: 6,
            background: '#ef4444',
            borderRadius: 2,
            boxShadow: '0 0 6px #ef4444',
          }}
        />
      ))}

      <motion.div
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.45 }}
        style={{
          maxWidth: 640,
          width: '100%',
          textAlign: 'center',
          position: 'relative',
          zIndex: 10,
        }}
      >
        {/* Broken Pokéball icon */}
        <motion.div
          initial={{ rotate: 0 }}
          animate={{ rotate: [0, -10, 10, -5, 5, 0] }}
          transition={{ duration: 0.6, delay: 0.2 }}
          style={{ fontSize: 72, marginBottom: 20, filter: 'grayscale(100%)', opacity: 0.7 }}
        >
          💔
        </motion.div>

        {/* DEFEAT title */}
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          style={{
            fontSize: 56,
            fontWeight: 900,
            color: '#ef4444',
            textShadow: '0 0 32px rgba(239,68,68,0.8), 4px 4px 8px rgba(0,0,0,0.9)',
            marginBottom: 16,
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
            fontSize: 15,
            color: '#fca5a5',
            marginBottom: 36,
            lineHeight: 1.5,
            whiteSpace: 'nowrap',
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
            color: '#fff',
            fontSize: 22,
            fontWeight: 900,
            cursor: 'pointer',
            letterSpacing: '0.1em',
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
