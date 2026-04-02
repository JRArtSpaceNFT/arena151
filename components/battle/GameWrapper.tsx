'use client'

import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '@/lib/game-store'
import { useArenaStore } from '@/lib/store'
import TrainerSelect from '@/components/battle/TrainerSelect'
import Draft from '@/components/battle/Draft'
import CoinToss from '@/components/battle/CoinToss'
import PreBattleTalk from '@/components/battle/PreBattleTalk'
import ArenaReveal from '@/components/battle/ArenaReveal'
import Lineup from '@/components/battle/Lineup'
import BattleScreen from '@/components/battle/BattleScreen'
import VictoryScreen from '@/components/battle/VictoryScreen'
import DefeatScreen from '@/components/battle/DefeatScreen'
import ResultsScreen from '@/components/battle/ResultsScreen'
import MoveAnimation from '@/components/battle/MoveAnimation'

// ── Dialogue bubble ───────────────────────────────────────────
function BattleDialogueBubble() {
  const battleDialogue = useGameStore(s => s.battleDialogue)
  const battleDialogueSide = useGameStore(s => s.battleDialogueSide)
  const battleDialogueKey = useGameStore(s => s.battleDialogueKey)
  const [displayed, setDisplayed] = useState('')

  useEffect(() => {
    if (!battleDialogue) { setDisplayed(''); return }
    setDisplayed('')
    let i = 0
    const iv = setInterval(() => {
      i++
      setDisplayed(battleDialogue.slice(0, i))
      if (i >= battleDialogue.length) clearInterval(iv)
    }, 28)
    return () => clearInterval(iv)
  }, [battleDialogueKey, battleDialogue])

  if (!battleDialogue) return null

  return (
    <div
      key={battleDialogueKey}
      style={{
        position: 'fixed',
        bottom: '18%',
        ...(battleDialogueSide === 'A' ? { left: '18%' } : { right: '18%' }),
        width: 260,
        background: '#f8f8e0',
        border: '3px solid #181818',
        boxShadow: '4px 4px 0 #181818',
        borderRadius: 4,
        padding: '12px 16px 14px',
        zIndex: 9999,
        pointerEvents: 'none',
      }}
    >
      {battleDialogueSide === 'A' ? (
        <>
          <div style={{ position: 'absolute', top: '50%', left: -12, transform: 'translateY(-50%)', width: 0, height: 0, borderTop: '9px solid transparent', borderBottom: '9px solid transparent', borderRight: '12px solid #181818' }} />
          <div style={{ position: 'absolute', top: '50%', left: -8, transform: 'translateY(-50%)', width: 0, height: 0, borderTop: '7px solid transparent', borderBottom: '7px solid transparent', borderRight: '9px solid #f8f8e0' }} />
        </>
      ) : (
        <>
          <div style={{ position: 'absolute', top: '50%', right: -12, transform: 'translateY(-50%)', width: 0, height: 0, borderTop: '9px solid transparent', borderBottom: '9px solid transparent', borderLeft: '12px solid #181818' }} />
          <div style={{ position: 'absolute', top: '50%', right: -8, transform: 'translateY(-50%)', width: 0, height: 0, borderTop: '7px solid transparent', borderBottom: '7px solid transparent', borderLeft: '9px solid #f8f8e0' }} />
        </>
      )}
      <div style={{
        fontFamily: '"Courier New", "Lucida Console", monospace',
        fontSize: 15, fontWeight: 700, color: '#181818',
        letterSpacing: '0.05em', lineHeight: 1.55,
        minHeight: 20, textAlign: 'center',
      }}>
        {displayed}
        <motion.span
          animate={{ opacity: [1, 0, 1] }}
          transition={{ duration: 0.7, repeat: Infinity }}
          style={{ marginLeft: 2, fontSize: 10 }}
        >▼</motion.span>
      </div>
    </div>
  )
}

// ── Trainer busts ─────────────────────────────────────────────
function BattleTrainerBusts() {
  const p1Trainer = useGameStore(s => s.p1Trainer)
  const p2Trainer = useGameStore(s => s.p2Trainer)
  const battleDialogue = useGameStore(s => s.battleDialogue)
  const battleDialogueSide = useGameStore(s => s.battleDialogueSide)

  const p1Active = !!battleDialogue && battleDialogueSide === 'A'
  const p2Active = !!battleDialogue && battleDialogueSide === 'B'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bustStyle = (side: 'left' | 'right', flip?: boolean, active?: boolean, trainerId?: string): any => {
    const isRocket = trainerId === 'jessie-james'
    return {
      position: 'fixed',
      bottom: isRocket ? -120 : -60,
      [side]: isRocket ? -20 : -20,
      width: isRocket ? 480 : 340,
      height: isRocket ? 480 : 420,
      objectFit: 'contain',
      objectPosition: 'top center',
      imageRendering: isRocket ? 'auto' : 'pixelated',
      opacity: active ? 0.95 : 0.35,
      filter: active ? 'none' : 'saturate(0.4) brightness(0.7)',
      transform: flip ? 'scaleX(-1)' : 'none',
      pointerEvents: 'none',
      zIndex: 2,
      transition: 'opacity 0.3s ease, filter 0.3s ease',
    }
  }

  return (
    <>
      {p1Trainer?.spriteUrl && (
        <img src={p1Trainer.spriteUrl} alt="" style={bustStyle('left', true, p1Active, p1Trainer.id)} />
      )}
      {p2Trainer?.spriteUrl && (
        <img src={p2Trainer.spriteUrl} alt="" style={bustStyle('right', false, p2Active, p2Trainer.id)} />
      )}
      {p1Trainer && (
        <div style={{
          position: 'fixed', bottom: 70, left: '12%',
          zIndex: 10, pointerEvents: 'none',
          fontFamily: '"Impact", "Arial Black", sans-serif',
          fontSize: 26, fontWeight: 900,
          color: p1Trainer.color ?? '#7c3aed',
          textShadow: `0 0 16px ${p1Trainer.color ?? '#7c3aed'}99, 2px 2px 0 rgba(0,0,0,0.8)`,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
        }}>{p1Trainer.name}</div>
      )}
      {p2Trainer && (
        <div style={{
          position: 'fixed', bottom: 70, right: '12%',
          zIndex: 10, pointerEvents: 'none',
          fontFamily: '"Impact", "Arial Black", sans-serif',
          fontSize: 26, fontWeight: 900,
          color: p2Trainer.color ?? '#ef4444',
          textShadow: `0 0 16px ${p2Trainer.color ?? '#ef4444'}99, 2px 2px 0 rgba(0,0,0,0.8)`,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          textAlign: 'right',
        }}>{p2Trainer.name}</div>
      )}
    </>
  )
}

// ── Move animation overlay ────────────────────────────────────
function BattleAnimOverlay() {
  const moveAnim = useGameStore(s => s.moveAnim)
  return (
    <AnimatePresence>
      {moveAnim && (
        <motion.div
          key={moveAnim.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15, type: 'tween' }}
          style={{
            position: 'fixed', inset: 0,
            zIndex: 120,
            pointerEvents: 'none',
          }}
        >
          <MoveAnimation anim={moveAnim} />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ── Main GameWrapper ──────────────────────────────────────────
export default function GameWrapper() {
  const gameScreen = useGameStore(s => s.screen)
  const setGameMode = useGameStore(s => s.setGameMode)
  const playAgain = useGameStore(s => s.playAgain)
  const matchResults = useGameStore(s => s.matchResults)
  const gameMode = useGameStore(s => s.gameMode)
  const { setScreen, setLastMatchWinner } = useArenaStore()

  // Track whether we've initialized this session
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    // Reset game and start at trainer_select in vs_ai mode
    playAgain()
    setGameMode('vs_ai')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Watch for game returning to 'home' (playAgain was called from ResultsScreen)
  // At that point, redirect to arena151's result screen
  const prevScreen = useRef(gameScreen)
  const lastMatchResultsRef = useRef(matchResults)
  useEffect(() => {
    // Keep a ref to the latest matchResults so we can read it when the screen transitions to 'home'
    if (matchResults) lastMatchResultsRef.current = matchResults
  }, [matchResults])

  useEffect(() => {
    if (prevScreen.current !== 'home' && gameScreen === 'home' && initialized.current) {
      // Capture winner before playAgain clears matchResults
      const winner = lastMatchResultsRef.current?.winner ?? null
      setLastMatchWinner(winner)
      // Game finished and "Play Again" was clicked — go to arena151 result screen
      setScreen('result')
    }
    prevScreen.current = gameScreen
  }, [gameScreen, setScreen, setLastMatchWinner])

  const screens: Record<string, React.ReactNode> = {
    trainer_select: <TrainerSelect />,
    draft: <Draft />,
    coin_toss: <CoinToss />,
    lineup: <Lineup />,
    arena_reveal: <ArenaReveal />,
    pretalk: <PreBattleTalk />,
    battle: <BattleScreen />,
    victory: <VictoryScreen />,
    defeat: <DefeatScreen />,
    results: <ResultsScreen />,
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', position: 'relative' }}>
      {screens[gameScreen] ?? <TrainerSelect />}
      {gameScreen === 'battle' && <BattleDialogueBubble />}
      {gameScreen === 'battle' && <BattleTrainerBusts />}
      {gameScreen === 'battle' && <BattleAnimOverlay />}
    </div>
  )
}
