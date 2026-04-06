'use client'

import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '@/lib/game-store'
import { useArenaStore } from '@/lib/store'
import TrainerSelect from '@/components/battle/TrainerSelect'
import { BattleTrainerBusts } from '@/components/battle/GameWrapper'
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

// Re-uses the same sub-components as GameWrapper, but initializes in 'practice' mode

function BattleDialogueBubble() {
  const battleDialogue = useGameStore(s => s.battleDialogue)
  const battleDialogueSide = useGameStore(s => s.battleDialogueSide)
  const battleDialogueKey = useGameStore(s => s.battleDialogueKey)

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
        fontFamily: '"Courier New", Courier, monospace',
        fontSize: 15, fontWeight: 700, color: '#181818',
      }}
    >
      {battleDialogue}
    </div>
  )
}

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
          style={{ position: 'fixed', inset: 0, zIndex: 120, pointerEvents: 'none' }}
        >
          <MoveAnimation anim={moveAnim} />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default function PracticeGameWrapper() {
  const gameScreen = useGameStore(s => s.screen)
  const setGameMode = useGameStore(s => s.setGameMode)
  const playAgain = useGameStore(s => s.playAgain)
  const matchResults = useGameStore(s => s.matchResults)
  const { setScreen } = useArenaStore()

  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    playAgain()
    setGameMode('practice')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const prevScreen = useRef(gameScreen)
  const lastMatchResultsRef = useRef(matchResults)
  useEffect(() => {
    if (matchResults) lastMatchResultsRef.current = matchResults
  }, [matchResults])

  useEffect(() => {
    if (prevScreen.current !== 'home' && gameScreen === 'home' && initialized.current) {
      setScreen('draft-mode-intro')
    }
    prevScreen.current = gameScreen
  }, [gameScreen, setScreen])

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
    <div style={{ height: '100dvh', maxHeight: '100dvh', background: '#0a0a0f', position: 'relative', overflow: 'hidden' }}>
      {/* PRACTICE MODE banner */}
      <div style={{
        position: 'fixed',
        top: 0, left: 0, right: 0,
        zIndex: 9990,
        background: 'rgba(34,197,94,0.15)',
        borderBottom: '1px solid rgba(34,197,94,0.3)',
        padding: '4px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backdropFilter: 'blur(4px)',
        pointerEvents: 'none',
      }}>
        <div style={{
          fontSize: 10, fontWeight: 900, color: '#4ade80',
          letterSpacing: '0.25em', textTransform: 'uppercase',
        }}>
          🎯 PRACTICE MODE — No stakes, no SOL deducted
        </div>
        <div style={{ fontSize: 10, color: 'rgba(74,222,128,0.5)' }}>
          vs AI • Free
        </div>
      </div>

      <div style={{ paddingTop: 26 }}>
        {screens[gameScreen] ?? <TrainerSelect />}
      </div>
      {gameScreen === 'battle' && <BattleDialogueBubble />}
      {gameScreen === 'battle' && <BattleTrainerBusts />}
      {gameScreen === 'battle' && <BattleAnimOverlay />}
    </div>
  )
}
