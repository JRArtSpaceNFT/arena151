'use client'

/**
 * FriendGameWrapper — Synchronized step-by-step PvP friend battle.
 *
 * Every step is gated: a player cannot advance until BOTH players
 * have completed that step and the server confirms both are ready.
 *
 * Steps:
 *   1. trainer_select  → each picks their trainer → wait for opponent → both see opponent's trainer
 *   2. draft_locked    → each drafts team + locks in → wait for opponent → both advance
 *   3. lineup_locked   → each orders lineup → wait for opponent → both compute battle with shared seed
 *
 * Sync mechanism: /api/match/friend { action: 'sync_state', step, data }
 *   - Player submits their data for the current step
 *   - Polls every 2s until bothReady=true
 *   - When bothReady, receives opponent's data and advances
 *
 * AI fallback: impossible. No AI paths execute. If opponent disconnects,
 * player sees "Waiting for opponent…" with a Cancel button.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useGameStore } from '@/lib/game-store'
import { useArenaStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { TRAINERS } from '@/lib/data/trainers'
import { createActiveCreature } from '@/lib/engine/battle'
import { mulberry32, seedFromMatchId } from '@/lib/engine/prng'
import { getRandomArena, getArenaById } from '@/lib/data/arenas'
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

// ── Overlay components ────────────────────────────────────────────────────────

function BattleDialogueBubble() {
  const d  = useGameStore(s => s.battleDialogue)
  const sd = useGameStore(s => s.battleDialogueSide)
  const k  = useGameStore(s => s.battleDialogueKey)
  if (!d) return null
  return (
    <div key={k} style={{
      position: 'fixed', bottom: '18%',
      ...(sd === 'A' ? { left: '18%' } : { right: '18%' }),
      width: 260, background: '#f8f8e0',
      border: '3px solid #181818', boxShadow: '4px 4px 0 #181818',
      borderRadius: 4, padding: '12px 16px 14px',
      zIndex: 9999, pointerEvents: 'none',
      fontFamily: '"Courier New", Courier, monospace',
      fontSize: 15, fontWeight: 700, color: '#181818',
    }}>{d}</div>
  )
}

function BattleAnimOverlay() {
  const m = useGameStore(s => s.moveAnim)
  return (
    <AnimatePresence>
      {m && (
        <motion.div key={m.id}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          style={{ position: 'fixed', inset: 0, zIndex: 120, pointerEvents: 'none' }}
        >
          <MoveAnimation anim={m} />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function WaitingOverlay({ message, onCancel }: { message: string; onCancel: () => void }) {
  const [dots, setDots] = useState('.')
  useEffect(() => {
    const iv = setInterval(() => setDots(d => d.length >= 3 ? '.' : d + '.'), 500)
    return () => clearInterval(iv)
  }, [])
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300,
      background: 'rgba(6,6,10,0.95)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 20,
    }}>
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        style={{ fontSize: 48 }}
      >⚔️</motion.div>
      <div style={{
        fontSize: 20, fontWeight: 900, color: '#818cf8',
        fontFamily: '"Impact","Arial Black",sans-serif',
        letterSpacing: '0.05em',
      }}>
        {message}{dots}
      </div>
      <div style={{ fontSize: 12, color: '#475569' }}>
        Both players must complete this step before advancing
      </div>
      <button onClick={onCancel} style={{
        marginTop: 8, padding: '9px 24px',
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 8, color: 'rgba(255,255,255,0.45)',
        fontSize: 12, fontWeight: 700, cursor: 'pointer',
      }}>Cancel Battle</button>
    </div>
  )
}

// ── Sync helper ───────────────────────────────────────────────────────────────

async function syncStep(
  matchId: string,
  token: string,
  step: string,
  data: Record<string, unknown>
): Promise<{
  bothReady: boolean
  opponentData: Record<string, unknown> | null
  battleSeed: string | null
  myRole: 'a' | 'b'
  playerAId: string
  playerBId: string
} | null> {
  try {
    const res = await fetch('/api/match/friend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: 'sync_state', matchId, step, data }),
    })
    if (!res.ok) return null
    return await res.json()
  } catch { return null }
}

// ── Main Component ────────────────────────────────────────────────────────────

type SyncStep = 'trainer_select' | 'draft_locked' | 'lineup_locked' | null

export default function FriendGameWrapper() {
  const gameScreen    = useGameStore(s => s.screen)
  const setGameMode   = useGameStore(s => s.setGameMode)
  const playAgain     = useGameStore(s => s.playAgain)
  const p1Trainer     = useGameStore(s => s.p1Trainer)
  const draftTeamA    = useGameStore(s => s.draftTeamA)
  const lineupA       = useGameStore(s => s.lineupA)
  const navigateTo    = useGameStore(s => s.navigateTo)

  const { setScreen, clearServerMatch, serverMatchId, battleSeed: storeSeed } = useArenaStore()

  // Which step we're currently waiting for the opponent on
  const [waitingStep, setWaitingStep] = useState<SyncStep>(null)
  const [syncError,   setSyncError]   = useState<string | null>(null)

  const initialized   = useRef(false)
  const pollRef       = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPoll = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
  }, [])

  const getToken = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ?? null
  }, [])

  // ── Init ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    playAgain()
    setGameMode('friend_battle')
    console.log('[FriendBattle] Initialized. matchId:', serverMatchId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Return to lobby when game ends
  const prevScreen = useRef(gameScreen)
  useEffect(() => {
    if (prevScreen.current !== 'home' && gameScreen === 'home' && initialized.current) {
      stopPoll()
      clearServerMatch()
      setScreen('draft-mode-intro')
    }
    prevScreen.current = gameScreen
  }, [gameScreen, setScreen, clearServerMatch, stopPoll])

  useEffect(() => () => stopPoll(), [stopPoll])

  // ── Generic: submit step data, poll until opponent also submits ───────────
  const waitForOpponent = useCallback(async (
    step: SyncStep,
    myData: Record<string, unknown>,
    onBothReady: (opponentData: Record<string, unknown>, battleSeed: string, myRole: 'a' | 'b', playerAId: string, playerBId: string) => void
  ) => {
    const token = await getToken()
    if (!token || !serverMatchId) { setSyncError('Not logged in or match ID missing'); return }

    setWaitingStep(step)
    console.log(`[FriendBattle] Step "${step}" submitted. Waiting for opponent...`)

    // Submit our data immediately
    const first = await syncStep(serverMatchId, token, step!, myData)
    if (!first) { setSyncError('Failed to sync with server'); return }

    if (first.bothReady && first.opponentData) {
      setWaitingStep(null)
      console.log(`[FriendBattle] Both ready at step "${step}" immediately`)
      onBothReady(
        first.opponentData as Record<string, unknown>,
        first.battleSeed ?? storeSeed ?? '',
        first.myRole,
        first.playerAId,
        first.playerBId
      )
      return
    }

    // Poll every 2s
    pollRef.current = setInterval(async () => {
      const result = await syncStep(serverMatchId!, token, step!, myData)
      if (!result) return

      if (result.bothReady && result.opponentData) {
        stopPoll()
        setWaitingStep(null)
        console.log(`[FriendBattle] Both ready at step "${step}" after polling`)
        onBothReady(
          result.opponentData as Record<string, unknown>,
          result.battleSeed ?? storeSeed ?? '',
          result.myRole,
          result.playerAId,
          result.playerBId
        )
      }
    }, 2000)
  }, [getToken, serverMatchId, storeSeed, stopPoll])

  const handleCancel = useCallback(() => {
    stopPoll()
    clearServerMatch()
    setScreen('friend-battle')
  }, [stopPoll, clearServerMatch, setScreen])

  // ── Step 1: Trainer selected ──────────────────────────────────────────────
  // TrainerSelect calls selectTrainer() in game-store, which in friend_battle mode
  // advances screen to 'draft'. We intercept by watching screen change to 'draft'.
  const trainerSyncDone = useRef(false)
  useEffect(() => {
    if (gameScreen !== 'draft') return
    if (trainerSyncDone.current) return
    if (!p1Trainer) return
    trainerSyncDone.current = true

    const myData = { trainerId: p1Trainer.id, trainerName: p1Trainer.name }
    console.log('[FriendBattle] Trainer selected:', p1Trainer.id, '— syncing...')

    waitForOpponent('trainer_select', myData, (opponentData, _seed, _role, _pAId, _pBId) => {
      const opId = (opponentData as { trainerId: string }).trainerId
      const opTrainer = TRAINERS.find(t => t.id === opId) ?? TRAINERS[0]
      console.log('[FriendBattle] Opponent trainer:', opId)
      // Set the real opponent trainer in the game store
      useGameStore.setState({ p2Trainer: opTrainer })
      // Now both trainers are set — proceed to draft (already on draft screen)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameScreen, p1Trainer])

  // ── Step 2: Draft locked in ───────────────────────────────────────────────
  // confirmVsAiDraft moves screen to 'lineup'. We intercept.
  const draftSyncDone = useRef(false)
  useEffect(() => {
    if (gameScreen !== 'lineup') return
    if (draftSyncDone.current) return
    if (draftTeamA.length === 0) return
    draftSyncDone.current = true

    const teamIds = draftTeamA.map(c => c.id)
    const myData = { teamIds, trainerId: p1Trainer?.id }
    console.log('[FriendBattle] Draft locked. Team:', teamIds, '— syncing...')

    waitForOpponent('draft_locked', myData, (opponentData, _seed, _role, _pAId, _pBId) => {
      const opTeamIds = (opponentData as { teamIds: number[] }).teamIds ?? []
      const opTrainerId = (opponentData as { trainerId: string }).trainerId
      const opTrainer = TRAINERS.find(t => t.id === opTrainerId) ?? useGameStore.getState().p2Trainer ?? TRAINERS[0]
      console.log('[FriendBattle] Opponent draft received:', opTeamIds)
      // Set opponent team in store so lineupB is populated
      const opLineup = opTeamIds.map((id: number) => createActiveCreature(id))
      useGameStore.setState({ p2Trainer: opTrainer, lineupB: opLineup })
      // Both lineups now set — proceed to lineup ordering
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameScreen, draftTeamA])

  // ── Step 3: Lineup locked in ──────────────────────────────────────────────
  // confirmLineup moves screen to 'arena_reveal'. We intercept.
  const lineupSyncDone = useRef(false)
  useEffect(() => {
    if (gameScreen !== 'arena_reveal') return
    if (lineupSyncDone.current) return
    if (lineupA.length === 0) return
    lineupSyncDone.current = true

    const lineupIds = lineupA.map(ac => ac.creature.id)
    const myData = { lineupIds, trainerId: p1Trainer?.id }
    console.log('[FriendBattle] Lineup locked. Order:', lineupIds, '— syncing...')

    waitForOpponent('lineup_locked', myData, (opponentData, seed, _role, _pAId, _pBId) => {
      const opLineupIds = (opponentData as { lineupIds: number[] }).lineupIds ?? []
      const opTrainerId = (opponentData as { trainerId: string }).trainerId
      const opTrainer = TRAINERS.find(t => t.id === opTrainerId) ?? useGameStore.getState().p2Trainer ?? TRAINERS[0]
      console.log('[FriendBattle] Opponent lineup received:', opLineupIds, 'seed:', seed)

      // Set final opponent lineup
      const opLineup = opLineupIds.map((id: number) => createActiveCreature(id))
      const myLineup = lineupA

      // Compute battle with shared seed — deterministic, same result on both devices
      const rng = seed ? mulberry32(seedFromMatchId(seed)) : undefined
      const { resolveBattle } = require('@/lib/engine/battle')
      const arena = useGameStore.getState().arena ?? getRandomArena()
      const myTrainer = useGameStore.getState().p1Trainer!
      const theirTrainer = TRAINERS.find(t => t.id === opTrainerId) ?? opTrainer

      const battleState = resolveBattle(myLineup, opLineup, arena, myTrainer, theirTrainer, rng)
      console.log('[FriendBattle] Battle computed. Winner:', battleState.winner)

      useGameStore.setState({
        p2Trainer: theirTrainer,
        lineupB: opLineup,
        battleState,
        screen: 'battle',
      })
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameScreen, lineupA])

  // ── Render ────────────────────────────────────────────────────────────────
  const screens: Record<string, React.ReactNode> = {
    trainer_select: <TrainerSelect />,
    draft:          <Draft />,
    coin_toss:      <CoinToss />,
    lineup:         <Lineup />,
    arena_reveal:   <ArenaReveal />,
    pretalk:        <PreBattleTalk />,
    battle:         <BattleScreen />,
    victory:        <VictoryScreen />,
    defeat:         <DefeatScreen />,
    results:        <ResultsScreen />,
  }

  if (syncError) {
    return (
      <div style={{
        minHeight: '100vh', background: '#0a0a0f', color: '#fff',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: 16, padding: 32, textAlign: 'center',
      }}>
        <div style={{ fontSize: 48 }}>❌</div>
        <div style={{ fontSize: 16, color: '#ef4444', fontWeight: 700 }}>{syncError}</div>
        <button onClick={handleCancel} style={{
          padding: '12px 32px', background: '#6366f1', border: 'none',
          borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
        }}>Back to Lobby</button>
      </div>
    )
  }

  const waitingMessages: Record<string, string> = {
    trainer_select: 'Waiting for opponent to pick their trainer',
    draft_locked:   'Waiting for opponent to lock in their team',
    lineup_locked:  'Waiting for opponent to set their lineup',
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', position: 'relative' }}>

      {/* Banner */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9990,
        background: 'rgba(129,140,248,0.1)',
        borderBottom: '1px solid rgba(129,140,248,0.25)',
        padding: '4px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        backdropFilter: 'blur(4px)', pointerEvents: 'none',
      }}>
        <div style={{ fontSize: 10, fontWeight: 900, color: '#818cf8', letterSpacing: '0.25em', textTransform: 'uppercase' }}>
          ⚔️ FRIEND BATTLE — Live PvP
        </div>
        <div style={{ fontSize: 10, color: 'rgba(129,140,248,0.5)' }}>
          {waitingStep ? '⏳ Syncing with opponent…' : '🟢 Both players in sync'}
        </div>
      </div>

      <div style={{ paddingTop: 26 }}>
        {screens[gameScreen] ?? <TrainerSelect />}
      </div>

      {/* Waiting overlay — shown whenever we're waiting for opponent */}
      {waitingStep && (
        <WaitingOverlay
          message={waitingMessages[waitingStep] ?? 'Waiting for opponent'}
          onCancel={handleCancel}
        />
      )}

      {gameScreen === 'battle' && <BattleDialogueBubble />}
      {gameScreen === 'battle' && <BattleTrainerBusts />}
      {gameScreen === 'battle' && <BattleAnimOverlay />}
    </div>
  )
}
