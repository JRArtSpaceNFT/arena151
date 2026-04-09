'use client'
import { motion } from 'framer-motion'
import { useState } from 'react'

interface HypeControlPanelProps {
  side: 'A' | 'B'
  onTrigger: (side: 'A' | 'B', type: 'emote' | 'phrase' | 'gg', content?: string) => void
}

const EMOTES = [
  { emoji: '🔥', label: 'Fire' },
  { emoji: '💀', label: 'Skull' },
  { emoji: '😤', label: 'Hype' },
  { emoji: '👑', label: 'King' },
  { emoji: '⚡', label: 'Shock' },
  { emoji: '💪', label: 'Flex' },
  { emoji: '😱', label: 'Wow' },
  { emoji: '💯', label: '100' },
]

const QUICK_PHRASES_A = [
  "Let's go!",
  "Too easy!",
  "Calculated!",
  "Outplayed!",
]

const QUICK_PHRASES_B = [
  "Nice try!",
  "Not done yet!",
  "Comeback time!",
  "Still standing!",
]

export default function HypeControlPanel({ side, onTrigger }: HypeControlPanelProps) {
  const [expanded, setExpanded] = useState(false)
  const [cooldown, setCooldown] = useState(false)

  const phrases = side === 'A' ? QUICK_PHRASES_A : QUICK_PHRASES_B

  const handleTrigger = (type: 'emote' | 'phrase' | 'gg', content?: string) => {
    if (cooldown) return
    
    onTrigger(side, type, content)
    
    // 2 second cooldown to prevent spam
    setCooldown(true)
    setTimeout(() => setCooldown(false), 2000)
  }

  const sideColor = side === 'A' ? '#ef4444' : '#3b82f6'

  return (
    <div
      style={{
        position: 'relative',
        display: 'inline-block',
      }}
    >
      {/* Main toggle button - Pokéball icon */}
      <motion.button
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        onClick={() => setExpanded(!expanded)}
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          background: expanded ? `linear-gradient(135deg, ${sideColor}, ${side === 'A' ? '#dc2626' : '#2563eb'})` : 'rgba(255,255,255,0.15)',
          border: '2px solid rgba(255,255,255,0.3)',
          boxShadow: expanded ? `0 2px 8px ${sideColor}66, inset 0 1px 0 rgba(255,255,255,0.2)` : 'none',
          fontSize: 16,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s ease',
        }}
      >
        {expanded ? '✕' : '🟥'}
      </motion.button>

      {/* Expanded panel */}
      {expanded && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 10 }}
          transition={{ duration: 0.2 }}
          style={{
            position: 'absolute',
            top: 40,
            left: -10,
            width: 240,
            background: 'rgba(15, 23, 42, 0.95)',
            backdropFilter: 'blur(12px)',
            border: '2px solid rgba(255,255,255,0.15)',
            borderRadius: 16,
            padding: 16,
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          }}
        >
          {/* Header */}
          <div
            style={{
              fontSize: 12,
              fontWeight: 900,
              color: sideColor,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginBottom: 12,
              textAlign: 'center',
            }}
          >
            Hype Reactions
          </div>

          {/* Emotes grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 8,
              marginBottom: 12,
            }}
          >
            {EMOTES.map(({ emoji, label }) => (
              <motion.button
                key={emoji}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => handleTrigger('emote', emoji)}
                disabled={cooldown}
                style={{
                  padding: 8,
                  background: cooldown 
                    ? 'rgba(100,116,139,0.3)' 
                    : 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: 8,
                  fontSize: 24,
                  cursor: cooldown ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                  opacity: cooldown ? 0.5 : 1,
                }}
                title={label}
              >
                {emoji}
              </motion.button>
            ))}
          </div>

          {/* Quick phrases */}
          <div style={{ marginBottom: 12 }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: '#94a3b8',
                marginBottom: 6,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
              Quick Phrases
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {phrases.map(phrase => (
                <motion.button
                  key={phrase}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleTrigger('phrase', phrase)}
                  disabled={cooldown}
                  style={{
                    padding: '6px 10px',
                    background: cooldown 
                      ? 'rgba(100,116,139,0.3)' 
                      : `linear-gradient(135deg, ${sideColor}40, ${sideColor}20)`,
                    border: `1px solid ${cooldown ? 'rgba(255,255,255,0.1)' : `${sideColor}60`}`,
                    borderRadius: 8,
                    fontSize: 11,
                    fontWeight: 700,
                    color: cooldown ? '#64748b' : '#fff',
                    cursor: cooldown ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s ease',
                    textAlign: 'left',
                    opacity: cooldown ? 0.5 : 1,
                  }}
                >
                  {phrase}
                </motion.button>
              ))}
            </div>
          </div>

          {/* GG Button */}
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => handleTrigger('gg')}
            disabled={cooldown}
            style={{
              width: '100%',
              padding: 10,
              background: cooldown 
                ? 'rgba(100,116,139,0.3)' 
                : 'linear-gradient(135deg, #fbbf24, #f59e0b)',
              border: '2px solid rgba(255,255,255,0.3)',
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 900,
              color: '#000',
              cursor: cooldown ? 'not-allowed' : 'pointer',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              boxShadow: cooldown 
                ? 'none' 
                : '0 4px 12px rgba(251,191,36,0.4), inset 0 1px 0 rgba(255,255,255,0.3)',
              opacity: cooldown ? 0.5 : 1,
              transition: 'all 0.2s ease',
            }}
          >
            GG! 🎮
          </motion.button>

          {cooldown && (
            <div
              style={{
                marginTop: 8,
                fontSize: 9,
                color: '#64748b',
                textAlign: 'center',
                fontStyle: 'italic',
              }}
            >
              Cooldown active...
            </div>
          )}
        </motion.div>
      )}
    </div>
  )
}
