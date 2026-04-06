'use client'

/**
 * FriendGameWrapper — Synchronized step-by-step PvP friend battle.
 *
 * Neither player advances to the next screen until BOTH have completed
 * the current step. Server confirms sync via /api/match/friend sync_state.
 *
 * Steps:
 *   trainer_select → draft_locked → lineup_locked → battle
 *
 * No AI paths. No local-only decisions. Fully server-authoritative sync.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useGameStore } from '@/lib/game-store'
import { useArenaStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { TRAINERS } from '@/lib/data/trainers'
import { createActiveCreature, resolveBattle } from '@/lib/engine/battle'
import { mulberry32, seedFromMatchId } from '@/lib/engine/prng'
import { getRandomArena, ARENAS } from '@/lib/data/arenas'
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

// ── Overlays ──────────────────────────────────────────────────────────────────

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
      borderRadius: 4, padding: '12px 16px 14px', zIndex: 9999, pointerEvents: 'none',
      fontFamily: '"Courier New", Courier, monospace', fontSize: 15, fontWeight: 700, color: '#181818',
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
        transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }}
        style={{ width: 64, height: 64 }}
      >
        <svg width="64" height="64" viewBox="0 0 56 56" fill="none">
          <circle cx="28" cy="28" r="27" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="2"/>
          <path d="M1 28 Q1 1 28 1 Q55 1 55 28" fill="#ef4444"/>
          <rect x="0" y="25" width="56" height="6" fill="#1e293b"/>
          <circle cx="28" cy="28" r="8" fill="#1e293b" stroke="#1e293b" strokeWidth="2"/>
          <circle cx="28" cy="28" r="5" fill="#f8fafc"/>
        </svg>
      </motion.div>
      <div style={{
        fontSize: 20, fontWeight: 900, color: '#818cf8',
        fontFamily: '"Impact","Arial Black",sans-serif', letterSpacing: '0.05em',
      }}>
        {message}{dots}
      </div>
      <div style={{ fontSize: 12, color: '#475569', maxWidth: 280, textAlign: 'center' }}>
        Both players must complete this step before advancing
      </div>
      <button onClick={onCancel} style={{
        marginTop: 8, padding: '9px 24px',
        background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
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
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      console.error('[FriendBattle] syncStep HTTP error:', res.status, err)
      return null
    }
    return await res.json()
  } catch (e) {
    console.error('[FriendBattle] syncStep exception:', e)
    return null
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

type WaitStep = 'trainer_select' | 'draft_locked' | 'lineup_locked' | null

export default function FriendGameWrapper() {
  const gameScreen  = useGameStore(s => s.screen)
  const setGameMode = useGameStore(s => s.setGameMode)
  const playAgain   = useGameStore(s => s.playAgain)
  const p1Trainer   = useGameStore(s => s.p1Trainer)
  const draftTeamA  = useGameStore(s => s.draftTeamA)
  const lineupA     = useGameStore(s => s.lineupA)

  const { setScreen, clearServerMatch, serverMatchId, battleSeed: storeSeed } = useArenaStore()

  const [waitStep,  setWaitStep]  = useState<WaitStep>(null)
  const [syncError, setSyncError] = useState<string | null>(null)

  const initialized     = useRef(false)
  const pollRef         = useRef<ReturnType<typeof setInterval> | null>(null)
  // useState guards so they reset correctly if component remounts
  const [trainerSynced, setTrainerSynced] = useState(false)
  const [draftSynced,   setDraftSynced]   = useState(false)
  const [lineupSynced,  setLineupSynced]  = useState(false)

  const stopPoll = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
  }, [])

  const getToken = useCallback(async (): Promise<string | null> => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ?? null
  }, [])

  // ── Init ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    playAgain()
    setGameMode('friend_battle')
    console.log('[FriendBattle] ✅ Initialized. matchId:', serverMatchId, 'seed:', storeSeed)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Return to lobby on game end
  const prevScreen = useRef(gameScreen)
  useEffect(() => {
    if (prevScreen.current !== 'home' && gameScreen === 'home' && initialized.current) {
      stopPoll(); clearServerMatch(); setScreen('draft-mode-intro')
    }
    prevScreen.current = gameScreen
  }, [gameScreen, setScreen, clearServerMatch, stopPoll])

  useEffect(() => () => stopPoll(), [stopPoll])

  // ── Generic wait-for-opponent ─────────────────────────────────────────────
  const waitForOpponent = useCallback(async (
    step: WaitStep,
    myData: Record<string, unknown>,
    onReady: (opponentData: Record<string, unknown>, seed: string, role: 'a'|'b', pAId: string, pBId: string) => void
  ) => {
    const token = await getToken()
    if (!token)         { setSyncError('Not logged in'); return }
    if (!serverMatchId) { setSyncError('Match ID missing — go back and reconnect'); return }

    setWaitStep(step)
    console.log(`[FriendBattle] 📤 Step "${step}" — submitting:`, myData)

    const trySync = async (): Promise<boolean> => {
      const result = await syncStep(serverMatchId, token, step!, myData)
      if (!result) return false
      console.log(`[FriendBattle] 🔄 Sync "${step}": bothReady=${result.bothReady}`, result.opponentData ? '✅ opponent data received' : '⏳ waiting')
      if (result.bothReady && result.opponentData) {
        stopPoll()
        setWaitStep(null)
        onReady(result.opponentData, result.battleSeed ?? storeSeed ?? '', result.myRole, result.playerAId, result.playerBId)
        return true
      }
      return false
    }

    const done = await trySync()
    if (done) return

    pollRef.current = setInterval(async () => {
      await trySync()
    }, 2000)
  }, [getToken, serverMatchId, storeSeed, stopPoll])

  const handleCancel = useCallback(() => {
    stopPoll(); clearServerMatch(); setScreen('friend-battle')
  }, [stopPoll, clearServerMatch, setScreen])

  // ── Step 1: Trainer picked → screen becomes 'draft' ──────────────────────
  useEffect(() => {
    if (gameScreen !== 'draft') return
    if (trainerSynced) return
    if (!p1Trainer) { console.warn('[FriendBattle] draft screen but no p1Trainer — retrying'); return }
    setTrainerSynced(true)

    console.log('[FriendBattle] 🧑 Trainer picked:', p1Trainer.id, p1Trainer.name)
    waitForOpponent('trainer_select', { trainerId: p1Trainer.id }, (oppData) => {
      const oppId = (oppData as { trainerId: string }).trainerId
      const oppTrainer = TRAINERS.find(t => t.id === oppId) ?? TRAINERS[0]
      console.log('[FriendBattle] 🧑 Opponent trainer set:', oppId)
      useGameStore.setState({ p2Trainer: oppTrainer })
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameScreen])

  // ── Step 2: Draft locked → screen becomes 'lineup' ───────────────────────
  useEffect(() => {
    if (gameScreen !== 'lineup') return
    if (draftSynced) return
    if (draftTeamA.length === 0) { console.warn('[FriendBattle] lineup screen but draftTeamA empty'); return }
    setDraftSynced(true)

    const teamIds = draftTeamA.map(c => c.id)
    const trainerId = p1Trainer?.id ?? ''
    console.log('[FriendBattle] 📋 Draft locked. Team:', teamIds)

    waitForOpponent('draft_locked', { teamIds, trainerId }, (oppData) => {
      const oppTeamIds = (oppData as { teamIds: number[] }).teamIds ?? []
      const oppTrainerId = (oppData as { trainerId: string }).trainerId
      const oppTrainer = TRAINERS.find(t => t.id === oppTrainerId) ?? useGameStore.getState().p2Trainer ?? TRAINERS[0]
      const oppLineup = oppTeamIds.map((id: number) => createActiveCreature(id))
      console.log('[FriendBattle] 📋 Opponent draft received. Team:', oppTeamIds)
      useGameStore.setState({ p2Trainer: oppTrainer, lineupB: oppLineup })
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameScreen])

  // ── Step 3: Lineup locked → screen becomes 'arena_reveal' ────────────────
  useEffect(() => {
    if (gameScreen !== 'arena_reveal') return
    if (lineupSynced) return
    if (lineupA.length === 0) { console.warn('[FriendBattle] arena_reveal but lineupA empty'); return }
    setLineupSynced(true)

    const lineupIds = lineupA.map(ac => ac.creature.id)
    const trainerId = p1Trainer?.id ?? ''
    console.log('[FriendBattle] 🗂️ Lineup locked. Order:', lineupIds)

    waitForOpponent('lineup_locked', { lineupIds, trainerId }, (oppData, seed, myRole, playerAId, playerBId) => {
      const oppLineupIds = (oppData as { lineupIds: number[] }).lineupIds ?? []
      const oppTrainerId = (oppData as { trainerId: string }).trainerId
      const oppTrainer   = TRAINERS.find(t => t.id === oppTrainerId) ?? useGameStore.getState().p2Trainer ?? TRAINERS[0]
      const myTrainer    = useGameStore.getState().p1Trainer!
      const myLineup     = useGameStore.getState().lineupA
      const oppLineup    = oppLineupIds.map((id: number) => createActiveCreature(id))

      // CANONICAL ORDER: always compute resolveBattle(player_a_team, player_b_team)
      // regardless of which player is viewing. This ensures BOTH devices produce
      // the IDENTICAL battle sequence with the same seed.
      const amPlayerA    = myRole === 'a'
      const teamA        = amPlayerA ? myLineup  : oppLineup
      const teamB        = amPlayerA ? oppLineup : myLineup
      const trainerA     = amPlayerA ? myTrainer  : oppTrainer
      const trainerB     = amPlayerA ? oppTrainer : myTrainer

      // Arena derived from seed — same seed = same arena on both devices.
      const seedNum     = seed ? Math.abs(seed.split('').reduce((h: number, c: string) => Math.imul(h, 31) + c.charCodeAt(0) | 0, 0)) : 0
      const arena       = ARENAS[seedNum % ARENAS.length]

      console.log('[FriendBattle] ⚔️ Computing battle. seed:', seed, 'role:', myRole,
        'teamA:', teamA.map(a => a.creature.id), 'teamB:', teamB.map(a => a.creature.id),
        'arena:', arena?.id)

      // Shared deterministic RNG — same inputs + same seed = identical battle on both screens
      const rng         = seed ? mulberry32(seedFromMatchId(seed)) : undefined
      const battleState = resolveBattle(teamA, teamB, arena, trainerA, trainerB, rng)

      // Winner 'A' always means player_a won. Each device shows victory/defeat accordingly.
      const iWon = (battleState.winner === 'A' && amPlayerA) || (battleState.winner === 'B' && !amPlayerA)
      console.log('[FriendBattle] ✅ Battle computed. Winner side:', battleState.winner, '| I won:', iWon)

      useGameStore.setState({
        p1Trainer: amPlayerA ? myTrainer  : oppTrainer,
        p2Trainer: amPlayerA ? oppTrainer : myTrainer,
        lineupA:   teamA,
        lineupB:   teamB,
        arena,
        battleState,
        screen: 'battle',
      })
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameScreen])

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

  const waitMessages: Record<string, string> = {
    trainer_select: 'Waiting for opponent to pick trainer',
    draft_locked:   'Waiting for opponent to lock in their team',
    lineup_locked:  'Waiting for opponent to set their lineup',
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

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', position: 'relative' }}>
      {/* Banner */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9990,
        background: 'rgba(129,140,248,0.1)', borderBottom: '1px solid rgba(129,140,248,0.25)',
        padding: '4px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        backdropFilter: 'blur(4px)', pointerEvents: 'none',
      }}>
        <div style={{ fontSize: 10, fontWeight: 900, color: '#818cf8', letterSpacing: '0.25em', textTransform: 'uppercase' }}>
          ⚔️ FRIEND BATTLE — Live PvP
        </div>
        <div style={{ fontSize: 10, color: 'rgba(129,140,248,0.5)' }}>
          {waitStep ? '⏳ Syncing…' : '🟢 In sync'}
        </div>
      </div>

      <div style={{ paddingTop: 26 }}>
        {screens[gameScreen] ?? <TrainerSelect />}
      </div>

      {waitStep && (
        <WaitingOverlay message={waitMessages[waitStep] ?? 'Waiting for opponent'} onCancel={handleCancel} />
      )}

      {gameScreen === 'battle' && <BattleDialogueBubble />}
      {gameScreen === 'battle' && <BattleTrainerBusts />}
      {gameScreen === 'battle' && <BattleAnimOverlay />}
    </div>
  )
}
