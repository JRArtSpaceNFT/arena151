'use client'

import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '@/lib/game-store'
import { useArenaStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { preloadResultBackgrounds } from '@/lib/resultBackgrounds'
import TrainerSelect from '@/components/battle/TrainerSelect'
import Draft from '@/components/battle/Draft'
import CoinToss from '@/components/battle/CoinToss'
import PreBattleTalk from '@/components/battle/PreBattleTalk'
import ArenaReveal from '@/components/battle/ArenaReveal'
import Lineup from '@/components/battle/Lineup'
import BattleScreen from '@/components/battle/BattleScreen'
import EnhancedBattleWrapper from '@/components/battle/EnhancedBattleWrapper'
import FinalResultsScreen from '@/components/battle/FinalResultsScreen'
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
export function BattleTrainerBusts() {
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
  const battleState = useGameStore(s => s.battleState)
  const lineupA = useGameStore(s => s.lineupA)
  const p1Trainer = useGameStore(s => s.p1Trainer)
  const p2Trainer = useGameStore(s => s.p2Trainer)

  const {
    setScreen, setLastMatchWinner,
    currentMatch, currentTrainer,
    serverMatchId,
    setServerMatch, clearServerMatch,
  } = useArenaStore()

  const [matchCreateError, setMatchCreateError] = useState<string | null>(null)
  const [isCreatingMatch, setIsCreatingMatch] = useState(false)
  const [resultSubmitted, setResultSubmitted] = useState(false)

  // Track whether we've initialized this session
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    // ── Refresh-during-battle resume ──────────────────────────────
    // If serverMatchId is already set (restored from sessionStorage) and the match
    // is already in a battle-ready or settled state, skip the entire draft/lineup flow
    // and jump directly to the battle screen. This handles the case where a player
    // refreshes mid-battle-animation without having to redo their draft.
    if (serverMatchId) {
      ;(async () => {
        try {
          // Use pre-configured Supabase client
          const sb = supabase
          const { data: { session } } = await sb.auth.getSession()
          if (!session?.access_token) {
            playAgain(); setGameMode('paid_pvp'); return
          }
          const res = await fetch(`/api/match/${serverMatchId}/resume`, {
            headers: { Authorization: `Bearer ${session.access_token}` }
          })
          if (!res.ok) {
            playAgain(); setGameMode('paid_pvp'); return
          }
          const rd = await res.json()
          console.log('[GameWrapper] Refresh resume check:', rd.resumePhase, rd.status)

          if (rd.resumePhase === 'battle_ready' && rd.teamA && rd.teamB && rd.battleSeed) {
            // Both players joined — set game mode and show arena reveal.
            // ArenaReveal will handle all hydration, battle computation, and transition.
            const seed = rd.battleSeed as string
            setServerMatch(serverMatchId, seed)

            const gameStore = (await import('@/lib/game-store')).useGameStore
            gameStore.setState({
              gameMode: 'paid_pvp',
              screen: 'arena_reveal',  // ✅ ArenaReveal handles everything from here!
            })
            console.log('[GameWrapper] Match ready — showing arena reveal ceremony')
            return
          }

          if (rd.resumePhase === 'settled') {
            // Already settled — hydrate result state from server payload, THEN navigate.
            // Clearing sessionStorage before hydration would create a blank ResultScreen.
            if (rd.resultPayload) {
              const { setSettledMatchResult, setLastMatchWinner } = (await import('@/lib/store')).useArenaStore.getState()
              setSettledMatchResult(rd.resultPayload)
              // lastMatchWinner: 1 = iWon (player perspective), 2 = opponent won
              setLastMatchWinner(rd.resultPayload.iWon ? 1 : 2)
            }
            // Only clear sessionStorage AFTER hydration so ResultScreen has data.
            sessionStorage.removeItem('arena_matchId')
            sessionStorage.removeItem('arena_seed')
            sessionStorage.removeItem('arena_isJoiner')
            setScreen('result')
            return
          }

          if (rd.resumePhase === 'abandoned') {
            sessionStorage.removeItem('arena_matchId')
            sessionStorage.removeItem('arena_seed')
            sessionStorage.removeItem('arena_isJoiner')
          }

          // waiting_p2 or abandoned — fall through to normal paid_pvp flow
          playAgain(); setGameMode('paid_pvp')
        } catch {
          playAgain(); setGameMode('paid_pvp')
        }
      })()
      return
    }

    // ── Fresh match (no serverMatchId restored) ───────────────────
    // Paid PvP match — use paid_pvp mode, never vs_ai.
    // paid_pvp mode blocks ALL AI paths: no random trainer, no AI draft, no AI lineup shuffle.
    // Server provides canonical teams/arena/seed at ArenaReveal after both players join.
    playAgain()
    setGameMode('paid_pvp')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Preload result backgrounds when trainers are selected
  useEffect(() => {
    const trainerIds = [p1Trainer?.id, p2Trainer?.id].filter(Boolean) as string[]
    if (trainerIds.length > 0) {
      preloadResultBackgrounds(trainerIds)
    }
  }, [p1Trainer, p2Trainer])

  // Watch for game returning to 'home' (playAgain was called from ResultsScreen)
  // At that point, redirect to arena151's result screen.
  // NOTE: setLastMatchWinner is now called in ResultsScreen BEFORE playAgain() clears matchResults.
  // GameWrapper just needs to detect the screen transition and navigate.
  const prevScreen = useRef(gameScreen)

  useEffect(() => {
    if (prevScreen.current !== 'home' && gameScreen === 'home' && initialized.current) {
      // Winner was already set by ResultsScreen before playAgain() wiped matchResults
      clearServerMatch()
      setResultSubmitted(false)
      setMatchCreateError(null)
      setScreen('result')
    }
    prevScreen.current = gameScreen
  }, [gameScreen, setScreen, setLastMatchWinner, clearServerMatch])

  // ── PAID MATCH: Auto-settle after battle animation completes ──
  // Server computed winner when P2 joined — no client result submission needed.
  // Just call /api/settle when battle finishes. Server already knows the winner.
  useEffect(() => {
    if (!battleState || battleState.phase !== 'finished') return
    if (!serverMatchId || resultSubmitted) return

    const entryFee = currentMatch?.room?.entryFee ?? 0
    if (entryFee <= 0) return // practice — no settlement

    setResultSubmitted(true)
    console.log('[GameWrapper] Battle finished — scheduling auto-settle for match:', serverMatchId)

    ;(async () => {
      // Wait for battle animation to reach a reasonable point before settling.
      // battleState.phase is 'finished' immediately on mount (pre-computed).
      // Delay ensures we don't hit the API on the very first render before
      // the player has seen a single move. Settle is safe at any time but
      // this prevents confusing error toasts during the opening moves.
      await new Promise(r => setTimeout(r, 8000)) // wait ~8s into animation
      try {
        // Use pre-configured Supabase client
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) return

        // Server already has winner_id — just trigger settlement.
        // Retry up to 3 times with 2s delay (handles transient network blips).
        let settled = false
        for (let attempt = 0; attempt < 3 && !settled; attempt++) {
          if (attempt > 0) await new Promise(r => setTimeout(r, 2000))
          const res = await fetch('/api/settle', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ matchId: serverMatchId }),
          })
          const data = await res.json()
          if (res.ok || data.alreadySettled) {
            console.log('[GameWrapper] Settled successfully:', data)
            settled = true
          } else if (res.status === 409) {
            // Another player already triggered settlement — that's fine
            console.log('[GameWrapper] Settlement already in progress or done:', data)
            settled = true
          } else {
            console.error(`[GameWrapper] Settlement attempt ${attempt + 1}/3 failed:`, data)
          }
        }
        if (!settled) {
          console.error('[GameWrapper] Settlement failed after 3 attempts. Cron will retry automatically.')
        }
      } catch (err) {
        console.error('[GameWrapper] Auto-settle error:', err)
      }
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [battleState?.phase, serverMatchId, resultSubmitted])

  // ── PAID MATCH: Create server match when arena_reveal starts ──
  // Intercept the arena_reveal → battle transition for paid matches only.
  // For practice/AI (wager = 0), we let ArenaReveal call proceedFromArenaReveal() directly.
  // This effect fires when the user would normally transition to battle.
  // The actual intercepted call happens in ArenaReveal — here we just detect if
  // a paid match needs to pre-register before battle begins.
  // NOTE: This is called from ArenaReveal via a custom hook pattern; the matchCreateError
  // state is displayed in the UI below if creation fails.

  // Show error overlay if match creation failed
  if (matchCreateError) {
    return (
      <div style={{
        height: '100dvh',
        maxHeight: '100dvh',
        background: '#0a0a0f',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        flexDirection: 'column',
        gap: 16,
        color: '#fff',
        fontFamily: '"Courier New", monospace',
        padding: 32,
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 48 }}>⚠️</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#ef4444' }}>Match Creation Failed</div>
        <div style={{ fontSize: 15, color: '#94a3b8', maxWidth: 360 }}>{matchCreateError}</div>
        <button
          onClick={() => {
            setMatchCreateError(null)
            setScreen('room-select')
          }}
          style={{
            marginTop: 16,
            padding: '12px 32px',
            background: '#7c3aed',
            border: 'none',
            borderRadius: 8,
            color: '#fff',
            fontSize: 16,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Back to Room Select
        </button>
      </div>
    )
  }

  const screens: Record<string, React.ReactNode> = {
    trainer_select: <TrainerSelect />,
    draft: <Draft />,
    coin_toss: <CoinToss />,
    lineup: <Lineup />,
    arena_reveal: <ArenaReveal />,
    pretalk: <PreBattleTalk />,
    battle: <EnhancedBattleWrapper><BattleScreen /></EnhancedBattleWrapper>,
    victory: <VictoryScreen />,
    defeat: <DefeatScreen />,
    result: <FinalResultsScreen />,
  }

  return (
    <div style={{ height: '100dvh', maxHeight: '100dvh', background: '#0a0a0f', position: 'relative', overflow: 'hidden' }}>
      {screens[gameScreen] ?? <TrainerSelect />}
      {gameScreen === 'battle' && <BattleDialogueBubble />}
      {gameScreen === 'battle' && <BattleTrainerBusts />}
      {/* Old sprite-based animations disabled - replaced by EnhancedBattleWrapper VFX system */}
      {/* {gameScreen === 'battle' && <BattleAnimOverlay />} */}
    </div>
  )
}
