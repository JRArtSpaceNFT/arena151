'use client'

/**
 * FriendGameWrapper — True server-authoritative PvP friend battle.
 *
 * ROOT CAUSE OF PREVIOUS BUG:
 *   setGameMode('practice') was called, which caused selectTrainer() and
 *   confirmLineup() to immediately run AI logic for P2 — auto-picking a
 *   random opponent and skipping P2's entire draft. Both devices ended up
 *   fighting unrelated AI opponents sharing only the battle seed.
 *
 * FIX:
 *   1. Use gameMode='friend_battle' (new mode, no AI fallback paths)
 *   2. Player drafts their own team on their device (P1 slot only)
 *   3. After draft+lineup, submit { trainerId, teamIds } to /api/match/friend (submit_team)
 *   4. Poll /api/match/friend (get_opponent_team) until opponent submits theirs
 *   5. Set opponent team in game store (setOpponentTeamForFriendBattle)
 *   6. THEN proceed to arena reveal — now both lineupA and lineupB are real human choices
 *   7. Shared battleSeed ensures deterministic RNG so both devices compute same winner
 *
 * AI FALLBACK: Completely disabled. If opponent never submits, player sees
 *   "Waiting for opponent to draft..." with a cancel option. No AI spawning.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
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
import { supabase } from '@/lib/supabase'

// ── Dialogue + Animation overlays (copied from PracticeGameWrapper) ──────────

function BattleDialogueBubble() {
  const battleDialogue     = useGameStore(s => s.battleDialogue)
  const battleDialogueSide = useGameStore(s => s.battleDialogueSide)
  const battleDialogueKey  = useGameStore(s => s.battleDialogueKey)
  if (!battleDialogue) return null
  return (
    <div key={battleDialogueKey} style={{
      position: 'fixed', bottom: '18%',
      ...(battleDialogueSide === 'A' ? { left: '18%' } : { right: '18%' }),
      width: 260, background: '#f8f8e0',
      border: '3px solid #181818', boxShadow: '4px 4px 0 #181818',
      borderRadius: 4, padding: '12px 16px 14px',
      zIndex: 9999, pointerEvents: 'none',
      fontFamily: '"Courier New", Courier, monospace',
      fontSize: 15, fontWeight: 700, color: '#181818',
    }}>
      {battleDialogue}
    </div>
  )
}

function BattleAnimOverlay() {
  const moveAnim = useGameStore(s => s.moveAnim)
  return (
    <AnimatePresence>
      {moveAnim && (
        <motion.div key={moveAnim.id}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          style={{ position: 'fixed', inset: 0, zIndex: 120, pointerEvents: 'none' }}
        >
          <MoveAnimation anim={moveAnim} />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ── Waiting-for-opponent overlay ──────────────────────────────────────────────

function WaitingForOpponent({ onCancel }: { onCancel: () => void }) {
  const [dots, setDots] = useState('.')
  useEffect(() => {
    const iv = setInterval(() => setDots(d => d.length >= 3 ? '.' : d + '.'), 600)
    return () => clearInterval(iv)
  }, [])
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(8,6,15,0.96)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 20,
    }}>
      <motion.div
        animate={{ scale: [1, 1.1, 1], opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 1.5, repeat: Infinity }}
        style={{ fontSize: 56 }}
      >⚔️</motion.div>
      <div style={{
        fontSize: 22, fontWeight: 900, color: '#818cf8',
        fontFamily: '"Impact","Arial Black",sans-serif',
        letterSpacing: '0.05em',
      }}>
        Waiting for opponent{dots}
      </div>
      <div style={{ fontSize: 13, color: '#64748b', maxWidth: 280, textAlign: 'center' }}>
        Your team is locked in. Waiting for your friend to finish their draft.
      </div>
      <button onClick={onCancel} style={{
        marginTop: 8, padding: '10px 28px',
        background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: 10, color: 'rgba(255,255,255,0.5)',
        fontSize: 13, fontWeight: 700, cursor: 'pointer',
      }}>
        Cancel Battle
      </button>
    </div>
  )
}

// ── Main FriendGameWrapper ────────────────────────────────────────────────────

type FriendPhase = 'drafting' | 'waiting_opponent' | 'ready' | 'cancelled'

export default function FriendGameWrapper() {
  const gameScreen   = useGameStore(s => s.screen)
  const setGameMode  = useGameStore(s => s.setGameMode)
  const playAgain    = useGameStore(s => s.playAgain)
  const draftTeamA   = useGameStore(s => s.draftTeamA)
  const lineupA      = useGameStore(s => s.lineupA)
  const p1Trainer    = useGameStore(s => s.p1Trainer)
  const setOpponentTeam = useGameStore(s => s.setOpponentTeamForFriendBattle)
  const proceedFromArenaReveal = useGameStore(s => s.proceedFromArenaReveal)

  const { setScreen, clearServerMatch, serverMatchId } = useArenaStore()

  const [friendPhase, setFriendPhase] = useState<FriendPhase>('drafting')
  const [pollError, setPollError]     = useState<string | null>(null)

  const initialized = useRef(false)
  const pollRef     = useRef<ReturnType<typeof setInterval> | null>(null)
  const submittedRef = useRef(false)

  const stopPoll = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
  }, [])

  // ── Init: set friend_battle mode ─────────────────────────────────────────
  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    playAgain()
    // CRITICAL: Use 'friend_battle' mode, NOT 'practice' or 'vs_ai'.
    // This prevents selectTrainer() and confirmLineup() from running AI logic.
    setGameMode('friend_battle')
    console.log('[FriendBattle] Game initialized in friend_battle mode. serverMatchId:', serverMatchId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Return to lobby when game ends ───────────────────────────────────────
  const prevScreen = useRef(gameScreen)
  useEffect(() => {
    if (prevScreen.current !== 'home' && gameScreen === 'home' && initialized.current) {
      clearServerMatch()
      setScreen('draft-mode-intro')
    }
    prevScreen.current = gameScreen
  }, [gameScreen, setScreen, clearServerMatch])

  // Cleanup
  useEffect(() => () => stopPoll(), [stopPoll])

  // ── Detect when player reaches arena_reveal → submit team + poll ─────────
  // arena_reveal is triggered by confirmLineup. At this point lineupA is set.
  // We intercept here: instead of proceeding, submit the team and wait for opponent.
  useEffect(() => {
    if (gameScreen !== 'arena_reveal') return
    if (submittedRef.current) return
    if (friendPhase !== 'drafting') return
    if (!serverMatchId) {
      console.error('[FriendBattle] No serverMatchId at arena_reveal — cannot submit team')
      setPollError('Match ID missing. Please restart.')
      return
    }
    if (!p1Trainer || lineupA.length === 0) {
      console.error('[FriendBattle] No trainer or lineup at arena_reveal')
      return
    }

    submittedRef.current = true
    submitAndPoll()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameScreen])

  const submitAndPoll = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    if (!token) { setPollError('Not logged in'); return }
    if (!serverMatchId || !p1Trainer) return

    const teamIds = lineupA.map(ac => ac.creature.id)
    console.log('[FriendBattle] Submitting team to server. matchId:', serverMatchId, 'trainer:', p1Trainer.id, 'team:', teamIds)

    // Submit this player's team
    const submitRes = await fetch('/api/match/friend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: 'submit_team', matchId: serverMatchId, trainerId: p1Trainer.id, teamIds }),
    })
    const submitData = await submitRes.json()

    if (!submitRes.ok) {
      console.error('[FriendBattle] Team submit failed:', submitData)
      setPollError(submitData.error ?? 'Failed to submit team')
      return
    }

    console.log('[FriendBattle] Team submitted. Waiting for opponent...', submitData)
    setFriendPhase('waiting_opponent')

    // Poll every 2 seconds for opponent's team
    pollRef.current = setInterval(async () => {
      try {
        const pollRes = await fetch('/api/match/friend', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ action: 'get_opponent_team', matchId: serverMatchId }),
        })
        const pollData = await pollRes.json()

        console.log('[FriendBattle] Polling for opponent team:', pollData)

        if (pollData.ready && pollData.opponentTrainerId && pollData.opponentTeamIds?.length > 0) {
          stopPoll()
          console.log('[FriendBattle] Opponent team received! Trainer:', pollData.opponentTrainerId, 'Team:', pollData.opponentTeamIds)

          // Set opponent data in game store — overwrites the placeholder P2
          setOpponentTeam(pollData.opponentTrainerId, pollData.opponentTeamIds)
          setFriendPhase('ready')
          // Now that lineupB is populated, call proceedFromArenaReveal directly.
          // ArenaReveal already tried to call it (was blocked by the guard since lineupB was empty).
          // We call it here with a small delay to let React re-render the new lineupB state first.
          setTimeout(() => {
            console.log('[FriendBattle] Both teams ready — calling proceedFromArenaReveal')
            proceedFromArenaReveal()
          }, 300)
        }
      } catch (err) {
        console.error('[FriendBattle] Poll error:', err)
      }
    }, 2000)
  }

  const handleCancel = () => {
    stopPoll()
    clearServerMatch()
    setFriendPhase('cancelled')
    setScreen('friend-battle')
  }

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

  // Poll error — show instead of game
  if (pollError) {
    return (
      <div style={{
        minHeight: '100vh', background: '#0a0a0f',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 16, color: '#fff', textAlign: 'center', padding: 32,
      }}>
        <div style={{ fontSize: 48 }}>❌</div>
        <div style={{ fontSize: 18, color: '#ef4444', fontWeight: 700 }}>{pollError}</div>
        <button onClick={handleCancel} style={{
          padding: '12px 32px', background: '#6366f1', border: 'none',
          borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
        }}>Back to Lobby</button>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', position: 'relative' }}>

      {/* Friend Battle banner */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9990,
        background: 'rgba(129,140,248,0.12)',
        borderBottom: '1px solid rgba(129,140,248,0.3)',
        padding: '4px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        backdropFilter: 'blur(4px)', pointerEvents: 'none',
      }}>
        <div style={{
          fontSize: 10, fontWeight: 900, color: '#818cf8',
          letterSpacing: '0.25em', textTransform: 'uppercase',
        }}>
          ⚔️ FRIEND BATTLE — Live PvP
        </div>
        <div style={{ fontSize: 10, color: 'rgba(129,140,248,0.5)' }}>
          {friendPhase === 'waiting_opponent' ? '⏳ Waiting for opponent draft…' :
           friendPhase === 'ready'            ? '✅ Both teams ready' :
           'Seeded battle · No SOL'}
        </div>
      </div>

      <div style={{ paddingTop: 26 }}>
        {screens[gameScreen] ?? <TrainerSelect />}
      </div>

      {/* Overlay: waiting for opponent to draft — shown on top of arena_reveal */}
      {friendPhase === 'waiting_opponent' && gameScreen === 'arena_reveal' && (
        <WaitingForOpponent onCancel={handleCancel} />
      )}

      {gameScreen === 'battle' && <BattleDialogueBubble />}
      {gameScreen === 'battle' && <BattleTrainerBusts />}
      {gameScreen === 'battle' && <BattleAnimOverlay />}
    </div>
  )
}
