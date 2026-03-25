'use client'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '@/lib/game-store'
import { playMusic } from '@/lib/audio/musicEngine'

function SpeedLines({ color }: { color: string }) {
  return (
    <svg
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      viewBox="0 0 800 600" preserveAspectRatio="xMidYMid slice"
    >
      {Array.from({ length: 32 }).map((_, i) => {
        const angle = (i / 32) * 360
        const rad = angle * Math.PI / 180
        const cx = 400, cy = 300
        const x1 = cx + Math.cos(rad) * 80
        const y1 = cy + Math.sin(rad) * 60
        const x2 = cx + Math.cos(rad) * 600
        const y2 = cy + Math.sin(rad) * 500
        return (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
            stroke={color}
            strokeWidth={i % 4 === 0 ? 4 : i % 2 === 0 ? 2 : 1}
            opacity={i % 4 === 0 ? 0.7 : 0.25}
          />
        )
      })}
    </svg>
  )
}

export default function VictoryScreen() {
  const { battleState, p1Trainer, p2Trainer, proceedToResults, gameMode, completeStoryBattle } = useGameStore()
  const [showQuote, setShowQuote] = useState(false)
  const [displayed, setDisplayed] = useState('')
  const [showButton, setShowButton] = useState(false)

  const isStoryMode = gameMode === 'story'

  const winner = battleState?.winner
  const winnerTrainer = winner === 'A' ? p1Trainer : p2Trainer
  const loserTrainer = winner === 'A' ? p2Trainer : p1Trainer
  const quote = winnerTrainer?.winQuote ?? '...'

  useEffect(() => { playMusic('victory') }, [])

  useEffect(() => {
    const t1 = setTimeout(() => setShowQuote(true), 1000)
    return () => clearTimeout(t1)
  }, [])

  useEffect(() => {
    if (!showQuote) return
    setDisplayed('')
    let i = 0
    const iv = setInterval(() => {
      i++
      setDisplayed(quote.slice(0, i))
      if (i >= quote.length) {
        clearInterval(iv)
        setTimeout(() => setShowButton(true), 500)
      }
    }, 28)
    return () => clearInterval(iv)
  }, [showQuote, quote])

  if (!winnerTrainer) return null
  const wColor = winnerTrainer.color

  return (
    <div style={{
      height: '100vh',
      background: '#0a0a0f',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Speed lines */}
      <motion.div
        initial={{ opacity: 1 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}
        style={{ position: 'absolute', inset: 0 }}
      >
        <SpeedLines color={wColor} />
      </motion.div>

      {/* Halftone dots */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `radial-gradient(${wColor}20 1.5px, transparent 1.5px)`,
        backgroundSize: '22px 22px',
      }} />

      {/* Radial vignette */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(ellipse 70% 70% at center, transparent 0%, rgba(0,0,0,0.75) 100%)`,
      }} />



      {/* Main content — centered column, compact to fit viewport */}
      <div style={{
        position: 'relative', zIndex: 2,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 0,
        maxHeight: '100vh',
        paddingTop: 8,
        paddingBottom: 8,
      }}>

        {/* BATTLE OVER label */}
        <motion.div
          initial={{ y: 0, opacity: 1 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          style={{
            fontFamily: '"Impact", "Arial Black", sans-serif',
            fontSize: 14, fontWeight: 900, letterSpacing: '0.45em',
            color: wColor, textTransform: 'uppercase',
            textShadow: `0 0 20px ${wColor}`,
            marginBottom: 10,
          }}
        >
          ⚔️ BATTLE OVER ⚔️
        </motion.div>

        {/* Trainer sprite — large, centered, no box */}
        <motion.div
          initial={{ scale: 1, opacity: 1, y: 0 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 22, delay: 0.05 }}
          style={{ position: 'relative' }}
        >
          {/* Glow ring behind trainer */}
          <div style={{
            position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)',
            width: 220, height: 80,
            background: `radial-gradient(ellipse, ${wColor}66 0%, transparent 70%)`,
            filter: 'blur(10px)',
            pointerEvents: 'none',
          }} />

          {winnerTrainer.spriteUrl ? (
            <img
              src={winnerTrainer.spriteUrl}
              alt={winnerTrainer.name}
              style={{
                width: winnerTrainer.id === 'jessie-james' ? 340 : 180,
                height: winnerTrainer.id === 'jessie-james' ? 420 : 240,
                objectFit: 'contain',
                objectPosition: 'center',
                imageRendering: 'pixelated',
                filter: `drop-shadow(0 0 20px ${wColor}) drop-shadow(0 0 40px ${wColor}88)`,
                display: 'block',
              }}
            />
          ) : (
            <div style={{
              width: 240, height: 320,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 120, color: wColor,
            }}>
              {winnerTrainer.name[0]}
            </div>
          )}
        </motion.div>

        {/* Name + WINS */}
        <motion.div
          initial={{ y: 0, opacity: 1 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 400, damping: 30 }}
          style={{ textAlign: 'center', marginTop: 4 }}
        >
          <div style={{
            fontFamily: '"Impact", "Arial Black", sans-serif',
            fontSize: 42, fontWeight: 900, lineHeight: 1,
            color: wColor,
            textShadow: `0 0 30px ${wColor}, 4px 4px 0 rgba(0,0,0,0.8)`,
            textTransform: 'uppercase', letterSpacing: '0.05em',
          }}>
            {winnerTrainer.name}
          </div>
          <div style={{
            fontFamily: '"Impact", "Arial Black", sans-serif',
            fontSize: 20, fontWeight: 900, color: '#fff',
            letterSpacing: '0.35em', textTransform: 'uppercase',
          }}>
            WINS!
          </div>
          <div style={{
            color: '#475569', fontSize: 12, fontWeight: 600,
            letterSpacing: '0.1em', marginTop: 2,
          }}>
            defeated {loserTrainer?.name ?? 'challenger'}
          </div>
        </motion.div>

        {/* Speech bubble — floats up from below */}
        <AnimatePresence>
          {showQuote && (
            <motion.div
              initial={{ opacity: 1, y: 0, scale: 1 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              style={{
                marginTop: 10,
                background: '#f8f8e0',
                border: '4px solid #181818',
                borderRadius: 4,
                padding: '14px 20px',
                position: 'relative',
                boxShadow: '4px 4px 0 #181818',
                maxWidth: 380,
              }}
            >
              {/* Bubble pointer pointing UP toward trainer */}
              <div style={{
                position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
                width: 0, height: 0,
                borderLeft: '12px solid transparent',
                borderRight: '12px solid transparent',
                borderBottom: '16px solid #181818',
              }} />
              <div style={{
                position: 'absolute', bottom: 'calc(100% - 5px)', left: '50%', transform: 'translateX(-50%)',
                width: 0, height: 0,
                borderLeft: '9px solid transparent',
                borderRight: '9px solid transparent',
                borderBottom: '12px solid #f8f8e0',
              }} />
              <div style={{
                fontFamily: '"Courier New", monospace',
                fontSize: 14, fontWeight: 700, color: '#181818',
                letterSpacing: '0.02em', lineHeight: 1.6,
                minHeight: 44,
                textAlign: 'center',
              }}>
                &ldquo;{displayed}
                <motion.span
                  animate={{ opacity: [1, 0, 1] }}
                  transition={{ duration: 0.55, repeat: Infinity }}
                  style={{ marginLeft: 1 }}
                >▎</motion.span>
                &rdquo;
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* View Results button / Continue Journey */}
        <AnimatePresence>
          {showButton && (
            <motion.button
              initial={{ opacity: 1, y: 0 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              whileHover={{ scale: 1.06, boxShadow: `0 0 28px ${wColor}88` }}
              whileTap={{ scale: 0.96 }}
              onClick={isStoryMode ? completeStoryBattle : proceedToResults}
              style={{
                marginTop: 12,
                padding: '13px 40px',
                background: wColor,
                border: '3px solid white',
                borderRadius: 4,
                color: '#fff',
                fontSize: 17, fontWeight: 900,
                fontFamily: '"Impact", "Arial Black", sans-serif',
                letterSpacing: '0.1em', textTransform: 'uppercase',
                cursor: 'pointer',
                boxShadow: `0 5px 0 rgba(0,0,0,0.4), 0 0 18px ${wColor}66`,
              }}
            >
              {isStoryMode ? '⚔️ CONTINUE JOURNEY →' : '📊 VIEW RESULTS →'}
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
