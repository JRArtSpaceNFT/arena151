'use client'

import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '@/lib/game-store'
import { useArenaStore } from '@/lib/store'
import { playMusic, resumeAudioContext, startCrowdAmbient } from '@/lib/audio/musicEngine'
import { ARENAS } from '@/lib/data/arenas'
import ArenaArtwork from '@/components/battle/ArenaArtwork'
import { supabase } from '@/lib/supabase'

const TYPE_COLORS: Record<string, string> = {
  normal: '#9ca3af', fire: '#f97316', water: '#3b82f6', electric: '#eab308',
  grass: '#22c55e', ice: '#67e8f9', fighting: '#dc2626', poison: '#a855f7',
  ground: '#a16207', flying: '#818cf8', psychic: '#ec4899', bug: '#84cc16',
  rock: '#78716c', ghost: '#6d28d9', dragon: '#7c3aed', dark: '#374151', steel: '#94a3b8',
}

// Slowdown schedule in ms — starts slower so all arenas are visible, then decelerates into the final pick
const SCHEDULE = [
  200, 220, 240, 260, 280,
  310, 350, 400, 460,
  530, 620, 730, 860,
]

// Mobile gets a slower schedule so the animation is visible
const MOBILE_SCHEDULE = [180, 200, 230, 270, 320, 380, 460, 560, 680, 820, 980, 1160, 1400]

function isMobileDevice() {
  if (typeof window === 'undefined') return false
  return window.innerWidth <= 1024 && ('ontouchstart' in window || navigator.maxTouchPoints > 0)
}

export default function ArenaReveal() {
  const { arena, proceedFromArenaReveal, lineupA, gameMode } = useGameStore()
  const { currentMatch, currentTrainer, serverMatchId, setServerMatch, isMatchJoiner, clearServerMatch } = useArenaStore()
  const [paidMatchError, setPaidMatchError] = useState<string | null>(null)
  const [isPaidMatchLoading, setIsPaidMatchLoading] = useState(false)
  const paidMatchCreated = useRef(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isLocked, setIsLocked] = useState(false)
  const [sequenceBuilt, setSequenceBuilt] = useState<number[]>([])
  const stepRef = useRef(0)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  
  // ════════════════════════════════════════════════════════════════
  // CRITICAL VALIDATION: Paid PVP must have server-assigned arena
  // ════════════════════════════════════════════════════════════════
  
  useEffect(() => {
    if (gameMode !== 'paid_pvp') return
    
    console.log('╔═══════════════════════════════════════════════════════════════╗')
    console.log('║ ARENA_SYNC: Paid PVP Arena Validation                   ║')
    console.log('╚═══════════════════════════════════════════════════════════════╝')
    console.log(`[ARENA_SYNC] matchId: ${serverMatchId ?? 'null'}`)
    console.log(`[ARENA_SYNC] myUserId: ${currentTrainer?.id ?? 'null'}`)
    console.log(`[ARENA_SYNC] arenaId: ${arena?.id ?? 'null'}`)
    console.log(`[ARENA_SYNC] arenaName: ${arena?.name ?? 'null'}`)
    console.log(`[ARENA_SYNC] source: ${arena ? 'server' : 'MISSING'}`)
    
    if (!arena) {
      console.error('[ARENA_SYNC] ❌ CRITICAL: No arena assigned - paid PvP cannot proceed')
      console.error('[ARENA_SYNC] This should be impossible - arena must be assigned by server')
      setPaidMatchError('Arena not assigned. Please contact support.')
      return
    }
    
    if (!serverMatchId) {
      console.error('[ARENA_SYNC] ❌ CRITICAL: No serverMatchId - cannot track match')
      setPaidMatchError('Match ID missing. Cannot proceed.')
      return
    }
    
    console.log('[ARENA_SYNC] ✅ Validation passed - arena loaded from server')
  }, [gameMode, arena, serverMatchId, currentTrainer])

  useEffect(() => {
    resumeAudioContext()
    playMusic('menu')
  }, [])

  useEffect(() => {
    if (!arena) return

    const targetIndex = ARENAS.findIndex(a => a.id === arena.id)
    const finalTarget = targetIndex >= 0 ? targetIndex : 0

    const seq: number[] = []
    for (let i = 0; i < SCHEDULE.length - 1; i++) {
      let rand = Math.floor(Math.random() * ARENAS.length)
      if (i >= SCHEDULE.length - 4) {
        while (rand === finalTarget) rand = Math.floor(Math.random() * ARENAS.length)
      }
      seq.push(rand)
    }
    seq.push(finalTarget)

    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    stepRef.current = 0
    setIsLocked(false)
    setSequenceBuilt(seq)
    setCurrentIndex(seq[0])

    function startSpin() {
      const sched = isMobileDevice() ? MOBILE_SCHEDULE : SCHEDULE
      let step = 0
      function advance() {
        if (step >= seq.length - 1) {
          setCurrentIndex(seq[seq.length - 1])
          setIsLocked(true)
          return
        }
        step += 1
        stepRef.current = step
        setCurrentIndex(seq[step])
        timeoutRef.current = setTimeout(advance, sched[step] ?? 1050)
      }
      timeoutRef.current = setTimeout(advance, sched[0])
    }

    // Start spin immediately — images cache naturally in the browser
    startSpin()

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [arena])

  // After locking, start battle music then proceed (4.5s so players can read the arena info)
  // For paid matches (wager > 0), create the server match record first before proceeding.
  useEffect(() => {
    if (!isLocked) return
    resumeAudioContext()
    setTimeout(() => resumeAudioContext(), 100)
    playMusic('battle')
    startCrowdAmbient() // very quiet crowd murmur under the battle music

    const entryFee = currentMatch?.room?.entryFee ?? 0
    const isPaidMatch = entryFee > 0

    // Friend battle: Let the animation play but don't call proceedFromArenaReveal.
    // FriendGameWrapper handles battle computation and screen transition via lineup_locked sync.
    const { useGameStore: gs } = require('@/lib/game-store') as { useGameStore: typeof import('@/lib/game-store').useGameStore }
    const isFriendBattle = gs.getState().gameMode === 'friend_battle'

    if (isFriendBattle) {
      // Animation plays normally, FriendGameWrapper will transition to battle when ready
      // (no 4.5s delay, no proceedFromArenaReveal call)
      return
    }

    if (!isPaidMatch || paidMatchCreated.current) {
      // Practice/AI or already handled — proceed immediately after delay
      const t = setTimeout(() => {
        proceedFromArenaReveal()
      }, 4500)
      return () => clearTimeout(t)
    }

    // Paid match: P2 joins (serverMatchId already set) or P1 creates (serverMatchId null)
    paidMatchCreated.current = true
    setIsPaidMatchLoading(true)

    // Poll for P2 joining (P1 waits here after creating match)
    const waitForP2 = async (mId: string, token: string): Promise<Record<string, unknown> | null> => {
      for (let i = 0; i < 150; i++) { // 5 min timeout (2s * 150)
        await new Promise(r => setTimeout(r, 2000))
        const r = await fetch(`/api/match/${mId}/status`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!r.ok) continue
        const d = await r.json()
        if (d.status === 'settlement_pending' && d.teamA && d.teamB) return d
        if (d.status === 'voided' || d.status === 'expired') return null
      }
      return null
    }


    // ── computeAndProceed: canonical battle compute + proceed ────
    // Called from all resume paths and the fresh flow.
    // matchData must contain: teamA, teamB, battleSeed (or these from outer scope)
    const computeAndProceed = async (matchData: Record<string, unknown>, useSeed: string | undefined, _tok: string) => {
      const tA = matchData.teamA
      const tB = matchData.teamB
      const effectiveSeed = useSeed ?? String(matchData.battleSeed ?? '')

      if (effectiveSeed && tA && tB) {
        const { resolveBattle, createActiveCreature } = await import('@/lib/engine/battle')
        const { mulberry32, seedFromMatchId } = await import('@/lib/engine/prng')
        const { ARENAS } = await import('@/lib/data/arenas')
        const { TRAINERS } = await import('@/lib/data/trainers')
        const gameStore = (await import('@/lib/game-store')).useGameStore

        const teamAIds: number[] = tA as number[]
        const teamBIds: number[] = tB as number[]
        const teamA = teamAIds.map((id: number) => createActiveCreature(id))
        const teamB = teamBIds.map((id: number) => createActiveCreature(id))

        const seedNum = Math.abs(effectiveSeed.split('').reduce((h: number, c: string) => Math.imul(h, 31) + c.charCodeAt(0) | 0, 0))
        const canonicalArena = ARENAS[seedNum % ARENAS.length]

        const trainerSeedA = Math.abs((seedNum * 7 + 3) % TRAINERS.length)
        const trainerSeedB = Math.abs((seedNum * 13 + 7) % TRAINERS.length)
        const trainerA = TRAINERS[trainerSeedA] ?? TRAINERS[0]
        const trainerB = TRAINERS[trainerSeedB !== trainerSeedA ? trainerSeedB : (trainerSeedB + 1) % TRAINERS.length] ?? TRAINERS[1]

        const rng = mulberry32(seedFromMatchId(effectiveSeed))
        const battleState = resolveBattle(teamA, teamB, canonicalArena, trainerA, trainerB, rng)

        gameStore.setState({ lineupA: teamA, lineupB: teamB, arena: canonicalArena, battleState })
        console.log('[ArenaReveal] Canonical battle computed. Winner:', battleState.winner, '| resuming from:', matchData.resumePhase ?? 'fresh')
      }

      setTimeout(() => proceedFromArenaReveal(), 1000)
    }

        const createAndProceed = async () => {
      try {
        // Use pre-configured Supabase client
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) {
          setPaidMatchError('Not authenticated. Please log in to play.')
          setIsPaidMatchLoading(false)
          return
        }

        const myLineupIds = lineupA.map((ac: { creature: { id: number } }) => ac.creature.id)
        const token = session.access_token

        // ── RESUME CHECK ──────────────────────────────────────────
        // If serverMatchId is already set (restored from sessionStorage on refresh),
        // call /resume to find out where we are WITHOUT calling join again.
        // This covers all refresh scenarios for both P1 and P2.
        if (serverMatchId) {
          console.log('[ArenaReveal] serverMatchId present — checking resume state:', serverMatchId)
          const resumeRes = await fetch(`/api/match/${serverMatchId}/resume`, {
            headers: { Authorization: `Bearer ${token}` },
          })
          if (resumeRes.ok) {
            const resumeData = await resumeRes.json()
            console.log('[ArenaReveal] Resume response:', resumeData.resumePhase, resumeData.status, 'role:', resumeData.myRole)
            setIsPaidMatchLoading(false)

            if (resumeData.resumePhase === 'abandoned') {
              sessionStorage.removeItem('arena_matchId')
              sessionStorage.removeItem('arena_seed')
              sessionStorage.removeItem('arena_isJoiner')
              setPaidMatchError('Match was cancelled or refunded.')
              return
            }

            if (resumeData.resumePhase === 'settled') {
              // Already settled — go to result screen
              sessionStorage.removeItem('arena_matchId')
              sessionStorage.removeItem('arena_seed')
              sessionStorage.removeItem('arena_isJoiner')
              proceedFromArenaReveal()
              return
            }

            if (resumeData.resumePhase === 'waiting_p2') {
              // P1 refreshed while waiting — resume the poll
              console.log('[ArenaReveal] Resuming P1 wait for P2...')
              const finalData = await waitForP2(serverMatchId, token)
              if (!finalData) {
                try {
                  await fetch(`/api/match/${serverMatchId}/abandon`, {
                    method: 'POST', headers: { Authorization: `Bearer ${token}` },
                  })
                } catch (_) {}
                sessionStorage.removeItem('arena_matchId')
                sessionStorage.removeItem('arena_seed')
                sessionStorage.removeItem('arena_isJoiner')
                setPaidMatchError('NO_OPPONENT')
                return
              }
              const seed = finalData.battleSeed ?? resumeData.battleSeed
              if (seed) setServerMatch(serverMatchId, seed)
              await computeAndProceed(finalData, seed, session.access_token)
              return
            }

            if (resumeData.resumePhase === 'battle_ready') {
              // Both players joined (either fresh or after refresh) — compute battle and go
              console.log('[ArenaReveal] Battle ready — computing canonical battle (role:', resumeData.myRole, ')')
              const seed = resumeData.battleSeed
              if (seed) setServerMatch(serverMatchId, seed)
              await computeAndProceed(resumeData, seed, session.access_token)
              return
            }
          }
          // Resume endpoint failed — fall through to normal flow
          console.warn('[ArenaReveal] Resume check failed, falling through to normal flow')
        }

        // ── FRESH MATCH FLOW (no serverMatchId yet) ───────────────
        const isP2 = isMatchJoiner // set by QueueScreen when P2 found open match

        let matchId: string
        let seed: string

        if (isP2) {
          // P2: join the match, server computes winner
          const res = await fetch(`/api/match/${serverMatchId}/join`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ teamB: myLineupIds }),
          })
          const data = await res.json()
          setIsPaidMatchLoading(false)
          if (!res.ok) {
            // 409 = already joined (concurrent join or refresh handled above) — try resume
            if (res.status === 409 && serverMatchId) {
              const retryResume = await fetch(`/api/match/${serverMatchId}/resume`, {
                headers: { Authorization: `Bearer ${token}` },
              })
              if (retryResume.ok) {
                const rd = await retryResume.json()
                if (rd.resumePhase === 'battle_ready') {
                  await computeAndProceed(rd, rd.battleSeed, token)
                  return
                }
              }
            }
            setPaidMatchError(data.code === 'INSUFFICIENT_FUNDS'
              ? 'Insufficient balance to enter this room.'
              : (data.error ?? 'Failed to join match. Please try again.'))
            return
          }
          matchId = serverMatchId!
          seed    = data.battleSeed
          setServerMatch(matchId, seed)
          await computeAndProceed(data, seed, token)
          return
        }

        // P1: create the match
        const res = await fetch('/api/match/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            roomId: currentMatch?.room?.id ?? 'pewter-city',
            entryFeeSol: entryFee,
            teamA: myLineupIds,
          }),
        })
        const data = await res.json()
        setIsPaidMatchLoading(false)
        if (!res.ok) {
          setPaidMatchError(data.code === 'INSUFFICIENT_FUNDS'
            ? 'Insufficient balance to enter this room.'
            : (data.error ?? 'Failed to create match. Please try again.'))
          return
        }
        matchId = data.matchId
        seed    = data.battleSeed
        setServerMatch(matchId, seed)

        // P1 waits for P2
        const finalData = await waitForP2(matchId, token)
        if (!finalData) {
          try {
            await fetch(`/api/match/${matchId}/abandon`, {
              method: 'POST', headers: { Authorization: `Bearer ${token}` },
            })
          } catch (_) {}
          sessionStorage.removeItem('arena_matchId')
          sessionStorage.removeItem('arena_seed')
          sessionStorage.removeItem('arena_isJoiner')
          setPaidMatchError('NO_OPPONENT')
          return
        }
        const finalSeed = (finalData.battleSeed as string | undefined) ?? seed
        if (finalData.battleSeed) setServerMatch(matchId, finalData.battleSeed as string)
        await computeAndProceed(finalData, finalSeed, token)
      } catch (err) {
        console.error('[ArenaReveal] Paid match error:', err)
        setPaidMatchError('Network error. Please check your connection.')
        setIsPaidMatchLoading(false)
      }
    }

    // Wait 3.5s for arena reveal to show, then create/join match and proceed
    const t = setTimeout(createAndProceed, 3500)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLocked])

  const displayArena = ARENAS[currentIndex]
  if (!arena || !displayArena) return null

  // All arena images to preload
  const allArenaImages = ARENAS.map(a => a.image).filter(Boolean)

  // Show error if paid match creation failed
  if (paidMatchError) {
    const isTimeout = paidMatchError === 'NO_OPPONENT'
    return (
      <div style={{
        height: '100dvh', maxHeight: '100dvh', background: '#0a0a0f',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: 16, color: '#fff',
        fontFamily: '"Courier New", monospace', padding: 32, textAlign: 'center',
      }}>
        <div style={{ fontSize: 48 }}>{isTimeout ? '⏱' : '⚠️'}</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: isTimeout ? '#fbbf24' : '#ef4444' }}>
          {isTimeout ? 'No opponent joined' : 'Match Creation Failed'}
        </div>
        <div style={{ fontSize: 15, color: '#94a3b8', maxWidth: 360 }}>
          {isTimeout
            ? 'Nobody joined your match in time. Your entry fee has been returned to your balance.'
            : paidMatchError}
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
          <button
            onClick={() => { window.location.href = '/' }}
            style={{
              padding: '12px 32px', background: '#7c3aed',
              border: 'none', borderRadius: 8, color: '#fff',
              fontSize: 16, fontWeight: 700, cursor: 'pointer',
            }}
          >
            Return Home
          </button>
          {isTimeout && (
            <button
              onClick={() => {
                setPaidMatchError(null)
                window.location.reload()
              }}
              style={{
                padding: '12px 32px', background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, color: '#e2e8f0',
                fontSize: 16, fontWeight: 700, cursor: 'pointer',
              }}
            >
              Try Again
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      onClick={() => resumeAudioContext()}
      style={{
        height: '100dvh',
        maxHeight: '100dvh',
        position: 'relative',
        overflow: 'hidden',
      }}>
      {/* Preload ALL arena images so browser caches them before the spin starts */}
      <div style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden', pointerEvents: 'none' }} aria-hidden="true">
        {allArenaImages.map(src => (
          <img key={src} src={src!} alt="" />
        ))}
      </div>

        <div
          style={{
            height: '100dvh',
            maxHeight: '100dvh',
            background: displayArena.bgGradient,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            overflow: 'hidden',
            transition: isLocked ? 'background 0.6s ease' : 'background 0.15s ease',
          }}
        >
          {/* Arena images — ALL rendered, only active one is visible. No key-destroy thrashing. */}
          {ARENAS.map((a, i) => (
            a.image ? (
              <img
                key={a.id}
                src={a.image}
                alt=""
                aria-hidden="true"
                style={{
                  position: 'absolute', inset: 0,
                  width: '100%', height: '100%',
                  objectFit: 'cover',
                  objectPosition: 'center',
                  opacity: i === currentIndex ? 0.45 : 0,
                  transition: i === currentIndex
                    ? (isLocked ? 'opacity 0.5s ease' : 'opacity 0.08s ease')
                    : 'opacity 0.08s ease',
                  pointerEvents: 'none',
                }}
              />
            ) : null
          ))}

          {/* Scanline overlay */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.06) 2px, rgba(0,0,0,0.06) 4px)',
            pointerEvents: 'none',
          }} />

          {/* Dark overlay */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(0,0,0,0.5)',
            pointerEvents: 'none',
          }} />

          {/* Lock glow border */}
          {isLocked && (
            <motion.div
              initial={{ opacity: 1 }}
              animate={{ opacity: 1 }}
              style={{
                position: 'absolute', inset: 0,
                pointerEvents: 'none',
                zIndex: 0,
              }}
            >
              <motion.div
                animate={{
                  boxShadow: [
                    'inset 0 0 30px rgba(251,191,36,0.2)',
                    'inset 0 0 80px rgba(251,191,36,0.5)',
                    'inset 0 0 50px rgba(251,191,36,0.35)',
                    'inset 0 0 80px rgba(251,191,36,0.5)',
                    'inset 0 0 30px rgba(251,191,36,0.2)',
                  ],
                }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                style={{ position: 'absolute', inset: 0 }}
              />
            </motion.div>
          )}

          <div style={{ textAlign: 'center', zIndex: 1, padding: '12px 24px', maxWidth: 800, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', maxHeight: '100dvh', overflowY: 'auto' }}>

            {/* "TONIGHT'S ARENA" label */}
            {isLocked ? (
              <motion.div
                initial={{ opacity: 1, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                style={{
                  fontSize: 16,
                  letterSpacing: '0.35em',
                  color: '#fbbf24',
                  marginBottom: 8,
                  textTransform: 'uppercase',
                  fontWeight: 700,
                  textShadow: '0 0 20px rgba(251,191,36,0.6)',
                }}
              >
                ⚔️ TONIGHT&apos;S ARENA
              </motion.div>
            ) : (
              <div style={{
                fontSize: 13,
                letterSpacing: '0.3em',
                color: '#64748b',
                marginBottom: 8,
                textTransform: 'uppercase',
              }}>
                Selecting arena...
              </div>
            )}

            {/* Arena image card — the main visual during the slot machine spin */}
            <div style={{
              width: '100%',
              maxWidth: 520,
              margin: '0 auto 12px',
              flexShrink: 0,
              borderRadius: 16,
              overflow: 'hidden',
              border: isLocked
                ? '2px solid rgba(251,191,36,0.6)'
                : '2px solid rgba(255,255,255,0.12)',
              boxShadow: isLocked
                ? '0 0 40px rgba(251,191,36,0.35), 0 8px 32px rgba(0,0,0,0.6)'
                : '0 4px 24px rgba(0,0,0,0.5)',
              aspectRatio: '16/9',
              position: 'relative',
              transition: 'border-color 0.4s ease, box-shadow 0.4s ease',
            }}>
              {ARENAS.map((a, i) => (
                a.image ? (
                  <img
                    key={a.id}
                    src={a.image}
                    alt={a.name}
                    style={{
                      position: 'absolute', inset: 0,
                      width: '100%', height: '100%',
                      objectFit: 'cover',
                      objectPosition: 'center',
                      opacity: i === currentIndex ? 1 : 0,
                      transition: i === currentIndex
                        ? (isLocked ? 'opacity 0.5s ease' : 'opacity 0.07s ease')
                        : 'opacity 0.07s ease',
                    }}
                  />
                ) : (
                  <div key={a.id} style={{
                    position: 'absolute', inset: 0,
                    background: a.bgGradient,
                    opacity: i === currentIndex ? 1 : 0,
                    transition: 'opacity 0.07s ease',
                  }} />
                )
              ))}
              {/* Scanline overlay on card */}
              <div style={{
                position: 'absolute', inset: 0, pointerEvents: 'none',
                background: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.07) 3px, rgba(0,0,0,0.07) 6px)',
              }} />
            </div>

            {/* Arena name */}
            <motion.h1
              style={{
                fontSize: 'clamp(22px, 5vw, 52px)',
                fontWeight: 900,
                margin: 0,
                marginBottom: 10,
                color: '#fff',
                lineHeight: 1.1,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '100%',
                textShadow: isLocked
                  ? '0 0 60px rgba(251,191,36,0.5), 0 0 30px rgba(255,255,255,0.3)'
                  : '0 0 20px rgba(255,255,255,0.3)',
              }}
            >
              {displayArena.name}
            </motion.h1>

            {/* Type badge */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
              <span style={{
                fontSize: 15, padding: '5px 18px', borderRadius: 20,
                background: `${TYPE_COLORS[displayArena.type] ?? '#9ca3af'}33`,
                color: TYPE_COLORS[displayArena.type] ?? '#9ca3af',
                border: `1px solid ${TYPE_COLORS[displayArena.type] ?? '#9ca3af'}66`,
                textTransform: 'capitalize', fontWeight: 700,
              }}>
                {displayArena.type} arena
              </span>
            </div>

            {/* Bonus types */}
            {isLocked ? (
              <motion.div
                initial={{ opacity: 1, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                style={{ marginBottom: 10 }}
              >
                <div style={{ fontSize: 14, color: '#94a3b8', marginBottom: 10 }}>
                  Type Bonuses (+{displayArena.bonusAmount * 100}% damage)
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                  {displayArena.bonusTypes.map(t => (
                    <span key={t} style={{
                      fontSize: 15, padding: '6px 18px', borderRadius: 20,
                      background: `${TYPE_COLORS[t] ?? '#9ca3af'}33`,
                      color: TYPE_COLORS[t] ?? '#9ca3af',
                      border: `1px solid ${TYPE_COLORS[t] ?? '#9ca3af'}55`,
                      fontWeight: 700, textTransform: 'capitalize',
                    }}>
                      {t}
                    </span>
                  ))}
                </div>
              </motion.div>
            ) : (
              <div style={{ marginBottom: 24, display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                {displayArena.bonusTypes.map(t => (
                  <span key={t} style={{
                    fontSize: 14, padding: '5px 14px', borderRadius: 20,
                    background: `${TYPE_COLORS[t] ?? '#9ca3af'}22`,
                    color: `${TYPE_COLORS[t] ?? '#9ca3af'}aa`,
                    border: `1px solid ${TYPE_COLORS[t] ?? '#9ca3af'}33`,
                    fontWeight: 600, textTransform: 'capitalize',
                  }}>
                    {t}
                  </span>
                ))}
              </div>
            )}

            {/* Arena event (locked only) */}
            {isLocked && displayArena.event && (
              <motion.div
                initial={{ opacity: 1, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                style={{
                  background: 'rgba(0,0,0,0.4)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: 12, padding: '10px 20px', marginBottom: 10,
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 700, color: '#fbbf24', marginBottom: 4 }}>
                  🌀 Arena Event: {displayArena.event.name}
                </div>
                <div style={{ fontSize: 13, color: '#94a3b8' }}>{displayArena.event.description}</div>
              </motion.div>
            )}

            {/* LOCKED IN banner */}
            {isLocked && (
              <motion.div
                initial={{ opacity: 1, scale: 1 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                style={{
                  fontSize: 24,
                  fontWeight: 900,
                  color: '#fbbf24',
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                  textShadow: '0 0 30px rgba(251,191,36,0.7)',
                  marginBottom: 10,
                }}
              >
                🔒 LOCKED IN
              </motion.div>
            )}

            {/* Progress bar */}
            {isLocked && (
              <motion.div
                initial={{ opacity: 1 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                style={{ marginTop: 4 }}
              >
                <div style={{ fontSize: 13, color: '#64748b', marginBottom: 8 }}>
                  Proceeding to battle...
                </div>
                <div style={{
                  width: 240, height: 3, background: 'rgba(255,255,255,0.1)',
                  borderRadius: 2, overflow: 'hidden', margin: '0 auto',
                }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: '100%' }}
                    transition={{ duration: 4, ease: 'linear', delay: 0.5 }}
                    style={{ height: '100%', background: '#fbbf24', borderRadius: 2 }}
                  />
                </div>
              </motion.div>
            )}

            {/* Spinning indicator */}
            {!isLocked && (
              <div style={{ marginTop: 20 }}>
                <motion.div
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 0.6, repeat: Infinity }}
                  style={{ fontSize: 13, color: '#64748b', letterSpacing: '0.1em' }}
                >
                  ◈ ◈ ◈
                </motion.div>
              </div>
            )}
          </div>
        </div>
    </div>
  )
}
