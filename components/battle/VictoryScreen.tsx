'use client'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '@/lib/game-store'
import { useArenaStore } from '@/lib/store'
import { playMusic } from '@/lib/audio/musicEngine'
import { incrementBattlesTotal, addBattleToLog } from '@/lib/battleStats'

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
            opacity={i % 4 === 0 ? 0.6 : 0.2}
          />
        )
      })}
    </svg>
  )
}

export default function VictoryScreen() {
  const { battleState, p1Trainer, p2Trainer, proceedToResults, gameMode, completeStoryBattle, arena } = useGameStore()
  const { currentTrainer } = useArenaStore()
  const [showQuote, setShowQuote] = useState(false)
  const [displayed, setDisplayed] = useState('')
  const [showButton, setShowButton] = useState(false)

  const isStoryMode = gameMode === 'story'
  const winner = battleState?.winner
  const winnerTrainer = winner === 'A' ? p1Trainer : p2Trainer
  const loserTrainer  = winner === 'A' ? p2Trainer : p1Trainer
  const quote = winnerTrainer?.winQuote ?? '...'

  useEffect(() => {
    playMusic('victory')
    // Track stats
    incrementBattlesTotal()
    if (winnerTrainer && loserTrainer) {
      const TYPE_EMOJI: Record<string, string> = {
        fire: '🔥', water: '💧', electric: '⚡', grass: '🌿', ice: '❄️',
        fighting: '👊', poison: '☠️', ground: '🌍', flying: '🦅', psychic: '🔮',
        bug: '🐛', rock: '🪨', ghost: '👻', dragon: '🐉', dark: '🌑', steel: '⚙️', normal: '⭐',
      }
      const arenaEmoji = arena?.type ? (TYPE_EMOJI[arena.type] ?? '⚔️') : '⚔️'
      addBattleToLog({
        winner: winnerTrainer.name,
        loser: loserTrainer.name,
        arena: arena?.name ?? 'Unknown Arena',
        arenaEmoji,
        timestamp: Date.now(),
        userId: currentTrainer?.id, // Associate battle with current user
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    // Show button immediately after quote starts (don't wait for full typewriter)
    const t1 = setTimeout(() => setShowQuote(true), 400)
    const t2 = setTimeout(() => setShowButton(true), 800)
    return () => { clearTimeout(t1); clearTimeout(t2) }
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
      }
    }, 28)
    return () => clearInterval(iv)
  }, [showQuote, quote])

  if (!winnerTrainer) return null
  const wColor = winnerTrainer.color

  const OVERRIDES: Record<string, { height?: string; left?: string; bottom?: string }> = {
    'gary':        { height: '50vh', left: '41%' },
    'surge':       { height: '50vh', left: '41%' },
    'koga':        { left: '42%' },
    'sabrina':     { height: '48vh', left: '42%' },
    'blaine':      { height: '50vh' },
    'giovanni':    { height: '50vh', left: '41%' },
    'lorelei':     { height: '52vh', left: '40%' },
    'bruno':       { height: '50vh', left: '41%' },
    'lance':       { height: '52vh' },
    'jessie-james':{ height: '72vh', bottom: '30%', left: '38%' },
  }
  const ov = OVERRIDES[winnerTrainer.id] ?? {}
  const trainerH = ov.height ?? '58vh'
  const trainerLeft = ov.left ?? '39%'
  const trainerBottom = ov.bottom ?? '28%'

  return (
    <>
    <style>{`
      @media (max-width: 1024px) {
        .victory-trainer-img { height: 35dvh !important; }
        .victory-name { font-size: clamp(28px, 7dvh, 52px) !important; }
        .victory-speech { max-width: 55% !important; top: 18% !important; left: 55% !important; }
        .victory-speech-text { font-size: 12px !important; padding: 10px 12px !important; }
        .victory-btns { bottom: 2% !important; }
      }
    `}</style>
    <div style={{
      width: '100vw', height: '100dvh', maxHeight: '100dvh',
      overflow: 'hidden', position: 'relative',
      background: '#000',
    }}>

      {/* ── Background image ── */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'url(/victory-bg.webp)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }} />

      {/* Dark overlay for legibility */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} />

      {/* Speed lines */}
      <div style={{ position: 'absolute', inset: 0, opacity: 0.5 }}>
        <SpeedLines color={wColor} />
      </div>

      {/* Halftone dots */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `radial-gradient(${wColor}18 1.5px, transparent 1.5px)`,
        backgroundSize: '22px 22px',
      }} />

      {/* ── Trainer name + WINS — top center ── */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, type: 'spring', stiffness: 300, damping: 28 }}
        style={{
          position: 'absolute', top: '4%', left: 0, right: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          zIndex: 10,
        }}
      >
        <div className="victory-name" style={{
          fontFamily: '"Impact", "Arial Black", sans-serif',
          fontSize: 64, fontWeight: 900, lineHeight: 0.95,
          color: wColor,
          textShadow: `0 0 40px ${wColor}, 4px 4px 0 rgba(0,0,0,0.9)`,
          textTransform: 'uppercase', letterSpacing: '0.04em',
          textAlign: 'center',
        }}>
          {winnerTrainer.name}
        </div>
        <div style={{
          fontFamily: '"Impact", "Arial Black", sans-serif',
          fontSize: 28, fontWeight: 900, color: '#ffffff',
          letterSpacing: '0.5em', textTransform: 'uppercase',
          textShadow: '2px 2px 0 rgba(0,0,0,0.8)',
        }}>
          WINS!
        </div>
        <div style={{
          color: '#94a3b8', fontSize: 12, fontWeight: 600,
          letterSpacing: '0.15em', marginTop: 4,
          textTransform: 'uppercase',
        }}>
          defeated {loserTrainer?.name ?? 'challenger'}
        </div>
      </motion.div>

      {/* ── TRAINER SPRITE — centered on pokeball spotlight ── */}
      {/* Pokeball spotlight is ~55% from left, feet at ~30% from bottom */}
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 22, delay: 0.05 }}
        style={{
          position: 'absolute',
          bottom: trainerBottom,
          left: trainerLeft,
          transform: 'translateX(-50%)',
          zIndex: 5,
        }}
      >
        {/* Ground glow under feet */}
        <div style={{
          position: 'absolute', bottom: -8, left: '50%',
          transform: 'translateX(-50%)',
          width: 260, height: 60,
          background: `radial-gradient(ellipse, ${wColor}77 0%, transparent 70%)`,
          filter: 'blur(12px)',
          pointerEvents: 'none',
        }} />

        {winnerTrainer.spriteUrl ? (
          <img
            className="victory-trainer-img"
            src={winnerTrainer.spriteUrl}
            alt={winnerTrainer.name}
            style={{
              height: trainerH,
              width: 'auto',
              objectFit: 'contain',
              objectPosition: 'bottom center',
              imageRendering: 'pixelated',
              filter: `drop-shadow(0 0 28px ${wColor}) drop-shadow(0 0 56px ${wColor}88)`,
              display: 'block',
            }}
          />
        ) : (
          <div style={{
            height: trainerH, width: '20vw',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 160, color: wColor,
          }}>
            {winnerTrainer.name[0]}
          </div>
        )}
      </motion.div>

      {/* ── SPEECH BUBBLE — right side, at mouth height ── */}
      {/* Mouth is roughly 85% up the sprite = near top of sprite */}
      {/* Trainer top ≈ (100 - 28 - 68) = ~4% from top → mouth ~4% + 8% = ~12% from top */}
      <AnimatePresence>
        {showQuote && (
          <motion.div
            initial={{ opacity: 0, x: 20, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: 'spring', stiffness: 280, damping: 26 }}
            className="victory-speech"
            style={{
              position: 'absolute',
              top: '26%',
              left: '63%',
              maxWidth: '30%',
              zIndex: 10,
            }}
          >
            {/* Bubble arrow pointing LEFT toward trainer */}
            <div style={{ position: 'relative' }}>
              {/* Arrow shadow */}
              <div style={{
                position: 'absolute',
                top: 22,
                left: -20,
                width: 0, height: 0,
                borderTop: '12px solid transparent',
                borderBottom: '12px solid transparent',
                borderRight: '20px solid #181818',
              }} />
              {/* Arrow fill */}
              <div style={{
                position: 'absolute',
                top: 24,
                left: -15,
                width: 0, height: 0,
                borderTop: '10px solid transparent',
                borderBottom: '10px solid transparent',
                borderRight: '16px solid #f8f8e0',
              }} />

              {/* Bubble body */}
              <div style={{
                background: '#f8f8e0',
                border: '4px solid #181818',
                borderRadius: 6,
                padding: '16px 20px',
                boxShadow: '5px 5px 0 #181818',
              }}>
                <div className="victory-speech-text" style={{
                  fontFamily: '"Courier New", monospace',
                  fontSize: 15, fontWeight: 700, color: '#181818',
                  letterSpacing: '0.02em', lineHeight: 1.6,
                  minHeight: 48,
                }}>
                  &ldquo;{displayed}
                  <motion.span
                    animate={{ opacity: [1, 0, 1] }}
                    transition={{ duration: 0.55, repeat: Infinity }}
                    style={{ marginLeft: 1 }}
                  >▎</motion.span>
                  &rdquo;
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Bottom buttons ── */}
      <AnimatePresence>
        {showButton && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="victory-btns"
            style={{
              position: 'absolute',
              bottom: '3%',
              left: 0, right: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 10,
              zIndex: 20,
            }}
          >
            {/* VIEW RESULTS */}
            <motion.button
              whileHover={{ scale: 1.06, boxShadow: `0 0 32px ${wColor}aa` }}
              whileTap={{ scale: 0.96 }}
              onClick={isStoryMode ? completeStoryBattle : proceedToResults}
              style={{
                padding: '14px 48px',
                background: wColor,
                border: '3px solid white',
                borderRadius: 4,
                color: '#fff',
                fontSize: 18, fontWeight: 900,
                fontFamily: '"Impact", "Arial Black", sans-serif',
                letterSpacing: '0.1em', textTransform: 'uppercase',
                cursor: 'pointer',
                boxShadow: `0 5px 0 rgba(0,0,0,0.5), 0 0 22px ${wColor}77`,
                whiteSpace: 'nowrap',
              }}
            >
              {isStoryMode ? '⚔️ CONTINUE JOURNEY →' : 'VIEW RESULTS →'}
            </motion.button>

            {/* Share on X button */}
            {!isStoryMode && (
              <motion.button
                whileHover={{ scale: 1.04, background: '#1a1a1a' }}
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  const text = encodeURIComponent(
                    `Just won a battle on Arena 151! 🏆 My trainer ${winnerTrainer.name} crushed it! Play at https://arena151.xyz #Arena151 #Pokemon`
                  )
                  window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank', 'noopener,noreferrer')
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 24px',
                  background: '#000',
                  border: '2px solid rgba(255,255,255,0.2)',
                  borderRadius: 6,
                  color: '#fff',
                  fontSize: 14, fontWeight: 700,
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  letterSpacing: '0.03em',
                  cursor: 'pointer',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
                  whiteSpace: 'nowrap',
                }}
              >
                {/* X logo SVG */}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.74l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
                Share on X
              </motion.button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

    </div>
    </>
  )
}
