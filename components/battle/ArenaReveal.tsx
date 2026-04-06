'use client'

import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '@/lib/game-store'
import { useArenaStore } from '@/lib/store'
import { playMusic, resumeAudioContext, startCrowdAmbient } from '@/lib/audio/musicEngine'
import { ARENAS } from '@/lib/data/arenas'
import ArenaArtwork from '@/components/battle/ArenaArtwork'
import { createClient } from '@supabase/supabase-js'

const TYPE_COLORS: Record<string, string> = {
  normal: '#9ca3af', fire: '#f97316', water: '#3b82f6', electric: '#eab308',
  grass: '#22c55e', ice: '#67e8f9', fighting: '#dc2626', poison: '#a855f7',
  ground: '#a16207', flying: '#818cf8', psychic: '#ec4899', bug: '#84cc16',
  rock: '#78716c', ghost: '#6d28d9', dragon: '#7c3aed', dark: '#374151', steel: '#94a3b8',
}

// Slowdown schedule in ms
const SCHEDULE = [
  50, 50, 60, 70, 90,
  120, 160, 210, 280,
  370, 470, 590, 720,
]

export default function ArenaReveal() {
  const { arena, proceedFromArenaReveal, lineupA } = useGameStore()
  const { currentMatch, currentTrainer, serverMatchId, setServerMatch, isMatchJoiner } = useArenaStore()
  const [paidMatchError, setPaidMatchError] = useState<string | null>(null)
  const [isPaidMatchLoading, setIsPaidMatchLoading] = useState(false)
  const paidMatchCreated = useRef(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isLocked, setIsLocked] = useState(false)
  const [sequenceBuilt, setSequenceBuilt] = useState<number[]>([])
  const stepRef = useRef(0)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
        timeoutRef.current = setTimeout(advance, SCHEDULE[step] ?? 1050)
      }
      timeoutRef.current = setTimeout(advance, SCHEDULE[0])
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
    playMusic('battle')
    startCrowdAmbient() // very quiet crowd murmur under the battle music

    const entryFee = currentMatch?.room?.entryFee ?? 0
    const isPaidMatch = entryFee > 0

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

    const createAndProceed = async () => {
      try {
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        )
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) {
          setPaidMatchError('Not authenticated. Please log in to play.')
          setIsPaidMatchLoading(false)
          return
        }

        const myLineupIds = lineupA.map((ac: { creature: { id: number } }) => ac.creature.id)

        let res: Response
        const isP2 = !!serverMatchId

        if (isP2) {
          // P2 joining — sends their lineup; server computes winner immediately
          res = await fetch(`/api/match/${serverMatchId}/join`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
            body: JSON.stringify({ teamB: myLineupIds }),
          })
        } else {
          // P1 creating — sends their lineup; waits for P2 to join
          res = await fetch('/api/match/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
            body: JSON.stringify({
              roomId: currentMatch?.room?.id ?? 'pewter-city',
              entryFeeSol: entryFee,
              teamA: myLineupIds,
            }),
          })
        }

        const data = await res.json()
        setIsPaidMatchLoading(false)

        if (!res.ok) {
          const msg = data.code === 'INSUFFICIENT_FUNDS'
            ? 'Insufficient balance to enter this room.'
            : (data.error ?? 'Failed to join/create match. Please try again.')
          setPaidMatchError(msg)
          return
        }

        // Store match ID + seed
        const matchId   = isP2 ? serverMatchId! : data.matchId
        const seed      = data.battleSeed
        if (!isP2 && data.matchId) setServerMatch(data.matchId, seed)
        else if (isP2 && seed)     setServerMatch(serverMatchId!, seed)

        // P1: poll for P2 to join before computing canonical battle
        // P2: server already computed winner — teamA + teamB both present in response
        const finalData = isP2 ? data : await waitForP2(matchId, session.access_token)
        if (!finalData) {
          setPaidMatchError('Opponent did not join in time. Funds returned.')
          return
        }
        const finalSeed  = finalData.battleSeed ?? seed
        if (finalData.battleSeed) setServerMatch(matchId, finalData.battleSeed)

        // ── Compute identical battle display on both devices ──────
        if (finalSeed && finalData.teamA && finalData.teamB) {
          const tA = finalData.teamA
          const tB = finalData.teamB
          const { resolveBattle, createActiveCreature } = await import('@/lib/engine/battle')
          const { mulberry32, seedFromMatchId } = await import('@/lib/engine/prng')
          const { ARENAS } = await import('@/lib/data/arenas')
          const { TRAINERS } = await import('@/lib/data/trainers')
          const gameStore = (await import('@/lib/game-store')).useGameStore

          const teamAIds: number[] = tA as number[]
          const teamBIds: number[] = tB as number[]
          const teamA = teamAIds.map((id: number) => createActiveCreature(id))
          const teamB = teamBIds.map((id: number) => createActiveCreature(id))

          // Seed-based arena — same on both devices
          const seedNum = Math.abs(seed.split('').reduce((h: number, c: string) => Math.imul(h, 31) + c.charCodeAt(0) | 0, 0))
          const canonicalArena = ARENAS[seedNum % ARENAS.length]

          // Canonical trainers — use current store trainers (P1/P2 already selected)
          const state = gameStore.getState()
          const trainerA = state.p1Trainer ?? TRAINERS[0]
          const trainerB = state.p2Trainer ?? TRAINERS[1]

          const rng = mulberry32(seedFromMatchId(seed))
          const battleState = resolveBattle(teamA, teamB, canonicalArena, trainerA, trainerB, rng)

          gameStore.setState({ lineupA: teamA, lineupB: teamB, arena: canonicalArena, battleState })
          console.log('[ArenaReveal] Canonical battle computed. Winner:', battleState.winner)
        }

        // Proceed to battle immediately
        setTimeout(() => {
          proceedFromArenaReveal()
        }, 1000)
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

  // Show error if paid match creation failed
  if (paidMatchError) {
    return (
      <div style={{
        minHeight: '100vh', background: '#0a0a0f',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: 16, color: '#fff',
        fontFamily: '"Courier New", monospace', padding: 32, textAlign: 'center',
      }}>
        <div style={{ fontSize: 48 }}>⚠️</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#ef4444' }}>Match Creation Failed</div>
        <div style={{ fontSize: 15, color: '#94a3b8', maxWidth: 360 }}>{paidMatchError}</div>
        <button
          onClick={() => { window.location.href = '/' }}
          style={{
            marginTop: 16, padding: '12px 32px', background: '#7c3aed',
            border: 'none', borderRadius: 8, color: '#fff',
            fontSize: 16, fontWeight: 700, cursor: 'pointer',
          }}
        >
          Return Home
        </button>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      position: 'relative',
      overflow: 'hidden',
    }}>
        <div
          style={{
            minHeight: '100vh',
            background: displayArena.bgGradient,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            overflow: 'hidden',
            transition: isLocked ? 'background 0.4s ease' : 'none',
            animation: isLocked ? 'fadeIn 0.3s ease forwards' : 'none',
          }}
        >
          {/* Arena image background — keyed so React fully replaces it on every index change */}
          {displayArena.image && (
            <img
              key={`arena-bg-${currentIndex}`}
              src={displayArena.image}
              alt=""
              aria-hidden="true"
              style={{
                position: 'absolute', inset: 0,
                width: '100%', height: '100%',
                objectFit: 'cover',
                objectPosition: 'center',
                opacity: 0.55,
                pointerEvents: 'none',
              }}
            />
          )}

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

          <div style={{ textAlign: 'center', zIndex: 1, padding: 24, maxWidth: 800, width: '100%' }}>

            {/* "TONIGHT'S ARENA" label */}
            {isLocked ? (
              <motion.div
                initial={{ opacity: 1, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                style={{
                  fontSize: 18,
                  letterSpacing: '0.35em',
                  color: '#fbbf24',
                  marginBottom: 16,
                  textTransform: 'uppercase',
                  fontWeight: 700,
                  textShadow: '0 0 20px rgba(251,191,36,0.6)',
                }}
              >
                ⚔️ TONIGHT&apos;S ARENA
              </motion.div>
            ) : (
              <div style={{
                fontSize: 14,
                letterSpacing: '0.3em',
                color: '#64748b',
                marginBottom: 16,
                textTransform: 'uppercase',
              }}>
                Selecting arena...
              </div>
            )}

            {/* Arena artwork */}


            {/* Arena name */}
            <motion.h1
              style={{
                fontSize: 72,
                fontWeight: 900,
                margin: 0,
                marginBottom: 20,
                color: '#fff',
                lineHeight: 1.1,
                textShadow: isLocked
                  ? '0 0 60px rgba(251,191,36,0.5), 0 0 30px rgba(255,255,255,0.3)'
                  : '0 0 20px rgba(255,255,255,0.3)',
              }}
            >
              {displayArena.name}
            </motion.h1>

            {/* Type badge */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 20 }}>
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
                style={{ marginBottom: 24 }}
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
                  borderRadius: 12, padding: '12px 24px', marginBottom: 20,
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
                  fontSize: 28,
                  fontWeight: 900,
                  color: '#fbbf24',
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                  textShadow: '0 0 30px rgba(251,191,36,0.7)',
                  marginBottom: 24,
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
                style={{ marginTop: 8 }}
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
