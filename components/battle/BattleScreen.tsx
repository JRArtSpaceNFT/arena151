'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { motion, AnimatePresence, useAnimation } from 'framer-motion'
import { useGameStore } from '@/lib/game-store'
import { MOVES } from '@/lib/data/moves'
import type { BattleLogEntry } from '@/lib/game-types'
import ArenaArtwork from '@/components/battle/ArenaArtwork'
import type { MoveAnimState } from '@/components/battle/MoveAnimation'
import { playMusic, resumeAudioContext, stopCrowdAmbient } from '@/lib/audio/musicEngine'
import { playKOSound, playRandomCrowdReaction, playRealCrowdCheer, playAttackSound, playStatusSound } from '@/lib/audio/sfx'


// ── TYPE STYLING ────────────────────────────────────────────────
const TYPE_COLORS: Record<string, string> = {
  normal: '#9ca3af', fire: '#f97316', water: '#3b82f6', electric: '#eab308',
  grass: '#22c55e', ice: '#67e8f9', fighting: '#dc2626', poison: '#a855f7',
  ground: '#a16207', flying: '#818cf8', psychic: '#ec4899', bug: '#84cc16',
  rock: '#78716c', ghost: '#6d28d9', dragon: '#7c3aed', dark: '#374151', steel: '#94a3b8',
}

const TYPE_GLOW: Record<string, string> = {
  fire:     'brightness(2) drop-shadow(0 0 12px #f97316)',
  water:    'brightness(2) drop-shadow(0 0 12px #3b82f6)',
  electric: 'brightness(2) drop-shadow(0 0 12px #eab308)',
  psychic:  'brightness(2) drop-shadow(0 0 12px #ec4899)',
  ghost:    'brightness(2) drop-shadow(0 0 12px #6d28d9)',
  ice:      'brightness(2) drop-shadow(0 0 12px #67e8f9)',
  fighting: 'brightness(2) drop-shadow(0 0 12px #dc2626)',
  grass:    'brightness(2) drop-shadow(0 0 12px #22c55e)',
  dragon:   'brightness(2) drop-shadow(0 0 12px #7c3aed)',
  poison:   'brightness(2) drop-shadow(0 0 12px #a855f7)',
}

// Lookup move type by name
function getMoveType(moveName: string | undefined): string | null {
  if (!moveName) return null
  return MOVES.find(m => m.name === moveName)?.type ?? null
}

// ── MAIN COMPONENT ──────────────────────────────────────────────
function getHpColor(pct: number) {
  return pct > 50 ? '#22c55e' : pct > 25 ? '#eab308' : '#ef4444'
}

export default function BattleScreen() {
  const {
    battleState,
    arena, p1Trainer, p2Trainer,
    showVictoryScreen,
    showDefeatScreen,
    showBattleDialogue, clearBattleDialogue,
    battleDialogue, battleDialogueSide, battleDialogueKey,
  } = useGameStore()

  useEffect(() => {
    // Music + crowd already started in ArenaReveal when arena locks in
    return () => {
      setMoveAnim(null) // safety: always clear animation on unmount
      stopCrowdAmbient()
      // Flush dialogue queue — prevents callbacks from running after unmount
      dialogueQueueRef.current = []
      dialogueBusyRef.current = false
      if (busyTimeoutRef.current) clearTimeout(busyTimeoutRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── LOCAL PLAYBACK SPEED ─────────────────────────────────────
  // Client-only. Never touches battle state, results, or server.
  // 1 = normal, 3 = fast. Each player sets this independently.
  const [playbackSpeed, setPlaybackSpeed] = useState<1 | 3>(1)
  const playbackSpeedRef = useRef<1 | 3>(1)
  useEffect(() => { playbackSpeedRef.current = playbackSpeed }, [playbackSpeed])
  // Unmount guard — prevents state updates from fire-and-forget animation timeouts firing after unmount
  const isMountedRef = useRef(true)
  useEffect(() => { isMountedRef.current = true; return () => { isMountedRef.current = false } }, [])

  // ── Core playback state ─────────────────────────────────────
  const [visibleLog, setVisibleLog] = useState<BattleLogEntry[]>([])
  const [logIndex, setLogIndex] = useState(0)
  const [currentHpA, setCurrentHpA] = useState(0)
  const [currentHpB, setCurrentHpB] = useState(0)
  const [statusA, setStatusA] = useState<string>('none')
  const [statusB, setStatusB] = useState<string>('none')
  const prevStatusA = useRef('none')
  const prevStatusB = useRef('none')
  const [activeA, setActiveA] = useState(0)
  const [activeB, setActiveB] = useState(0)
  const [isDone, setIsDone] = useState(false)
  const [crowdMeter, setCrowdMeter] = useState(0)
  const logRef = useRef<HTMLDivElement>(null)
  const currentAnimId = useRef<string | null>(null)  // tracks active anim so stale timeouts don't clobber newer ones

  // ── Animation state ─────────────────────────────────────────
  const [attackingSide, setAttackingSide] = useState<'A' | 'B' | null>(null)
  const lastAttackSideRef = useRef<'A' | 'B' | null>(null) // display-layer double-attack guard
  const [flashingSide, setFlashingSide] = useState<'A' | 'B' | null>(null)
  const [flashMoveType, setFlashMoveType] = useState<string | null>(null)
  const [shakeActive, setShakeActive] = useState(false)
  const [bigShake, setBigShake] = useState(false)
  const [koSide, setKoSide] = useState<'A' | 'B' | null>(null)
  const [ultimateActive, setUltimateActive] = useState<{ side: 'A' | 'B'; name: string } | null>(null)
  const [specialFlash, setSpecialFlash] = useState<{ trainerId: string; moveName: string; creatureName: string } | null>(null)
  const [redFlash, setRedFlash] = useState(0) // incremented each time — unique key for CSS animation
  const [crowdRoarActive, setCrowdRoarActive] = useState(false)
  const [sparkleA, setSparkleA] = useState(false)
  const [sparkleB, setSparkleB] = useState(false)
  const [arenaEventActive, setArenaEventActive] = useState<string | null>(null)
  const [electricFlash, setElectricFlash] = useState(0) // counter — each thunder gets unique key
  const [swappingA, setSwappingA] = useState(false)
  const [swappingB, setSwappingB] = useState(false)
  const [crowdGlow, setCrowdGlow] = useState(false)
  const [missPopup, setMissPopup] = useState<{ side: 'A' | 'B'; key: number } | null>(null)
  // announcer display removed — data preserved in lib/data/announcer.ts for future use
  // Dialogue queue — ensures messages never overlap
  const dialogueQueueRef = useRef<Array<{ text: string; side: 'A' | 'B' }>>([])
  const dialogueBusyRef = useRef(false)

  // Track KOs as they happen during animation (NOT from pre-computed final state)
  const [koSetA, setKoSetA] = useState<Set<number>>(new Set())
  const [koSetB, setKoSetB] = useState<Set<number>>(new Set())

  // Hit stop effect
  const [hitStop, setHitStop] = useState(false)
  // Type advantage burst
  const [typeBurst, setTypeBurst] = useState<{ color: string; side: 'A' | 'B' } | null>(null)

  // Track which opponent Pokémon slots have been revealed (appeared in battle)
  // Slot 0 is always revealed from the start (the first fighter)
  const [revealedA, setRevealedA] = useState<Set<number>>(new Set([0]))
  const [revealedB, setRevealedB] = useState<Set<number>>(new Set([0]))

  // Ditto transform: show Ditto's original sprite until the reveal log entry fires
  // Maps slot index → override sprite URL. Cleared per-slot when transform reveal fires.
  const [spriteOverridesA, setSpriteOverridesA] = useState<Record<number, string>>({})
  const [spriteOverridesB, setSpriteOverridesB] = useState<Record<number, string>>({})
  // Convenience: current active slot override
  const spriteOverrideA = spriteOverridesA[activeA] ?? null
  const spriteOverrideB = spriteOverridesB[activeB] ?? null

  // Crowd burst — increments on each KO to trigger emoji explosion


  // GB dialogue box (state lives in store, rendered in page.tsx outside all overflow:hidden)
  const gbDialogue = battleDialogue
  const gbDialogueKey = battleDialogueKey
  const gbDialogueSide = battleDialogueSide

  // Move animation
  const setMoveAnim = useGameStore(s => s.setMoveAnim)

  // Anime face zoom


  // Screen shake controls
  const shakeControls = useAnimation()



  // ── Dialogue queue — prevents any two messages showing simultaneously ──
  const busyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const drainDialogueQueue = useCallback(() => {
    if (dialogueBusyRef.current) return
    const next = dialogueQueueRef.current.shift()
    if (!next) return
    dialogueBusyRef.current = true
    showBattleDialogue(next.text, next.side)

    // Safety: if queue never drains (e.g. React timing edge case), force-unlock after 3s
    if (busyTimeoutRef.current) clearTimeout(busyTimeoutRef.current)
    const spd = playbackSpeedRef.current
    busyTimeoutRef.current = setTimeout(() => {
      clearBattleDialogue()
      dialogueBusyRef.current = false
      setTimeout(drainDialogueQueue, Math.max(40, Math.round(400 / spd)))
    }, Math.max(80, Math.round(2200 / spd)))
  }, [showBattleDialogue, clearBattleDialogue])

  const queueDialogue = useCallback((text: string, side: 'A' | 'B') => {
    dialogueQueueRef.current.push({ text, side })
    drainDialogueQueue()
  }, [drainDialogueQueue])

  // ── Shake animation ─────────────────────────────────────────
  useEffect(() => {
    if (bigShake) {
      shakeControls.start({
        x: [0, -22, 20, -18, 16, -12, 10, -8, 6, -4, 2, 0],
        transition: { duration: 0.8, ease: 'easeOut' },
      }).then(() => shakeControls.set({ x: 0 }))
    } else if (shakeActive) {
      shakeControls.start({
        x: [0, -8, 8, -8, 8, -4, 4, 0],
        transition: { duration: 0.4, ease: 'easeOut' },
      }).then(() => shakeControls.set({ x: 0 }))
    }
  }, [shakeActive, bigShake, shakeControls])

  // NOTE: GB dialogue is cleared ONLY by the queue drainer (2.2s per message).
  // Do NOT add a separate auto-clear here — it races with the queue and causes stuck boxes.

  // ── Reset all local animation state on new battle ──────────
  useEffect(() => {
    if (battleState) {
      setVisibleLog([])
      setLogIndex(0)
      setIsDone(false)
      setCurrentHpA(battleState.teamA[0]?.maxHp ?? 0)
      setCurrentHpB(battleState.teamB[0]?.maxHp ?? 0)
      setStatusA('none')
      setStatusB('none')
      setActiveA(0)
      setActiveB(0)
      setKoSetA(new Set())
      setKoSetB(new Set())
      // Ditto: scan ALL slots — any Ditto with _dittoPreTransformSprite gets an override
      // so we show the real Ditto sprite until the transform log entry fires
      const dittoOverridesA: Record<number, string> = {}
      const dittoOverridesB: Record<number, string> = {}
      battleState.teamA.forEach((ac, i) => {
        const pre = (ac.creature as any)._dittoPreTransformSprite
        if (pre) dittoOverridesA[i] = pre
      })
      battleState.teamB.forEach((ac, i) => {
        const pre = (ac.creature as any)._dittoPreTransformSprite
        if (pre) dittoOverridesB[i] = pre
      })
      setSpriteOverridesA(dittoOverridesA)
      setSpriteOverridesB(dittoOverridesB)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [battleState?.teamA[0]?.creature.id, battleState?.teamB[0]?.creature.id])

  // ── Log playback ────────────────────────────────────────────
  useEffect(() => {
    if (!battleState || isDone) return
    if (logIndex >= battleState.log.length && logIndex > 0) {
      // Flush dialogue queue and clear any lingering messages when battle ends
      dialogueQueueRef.current = []
      dialogueBusyRef.current = false
      clearBattleDialogue()
      setTimeout(() => setIsDone(true), Math.max(80, Math.round(1500 / playbackSpeedRef.current)))
      return
    }
    if (logIndex === 0 && visibleLog.length > 0) return // stale state guard

    // ── Block log advancement while special flash is playing ──
    // This prevents the opponent's attack from animating during the cinematic
    if (specialFlash) {
      const retryTimer = setTimeout(() => {
        // re-trigger by doing nothing — the effect re-runs when specialFlash clears
      }, 200)
      return () => clearTimeout(retryTimer)
    }

    const timer = setTimeout(() => {
      const entry = battleState.log[logIndex]
      setVisibleLog(prev => [...prev, entry])

      // HP update: for attack entries, delayed via animation triggers block below
      // For non-attack entries (swap, etc.), apply immediately
      const isAttackEntry = entry.type === 'damage' || entry.type === 'critical' || entry.type === 'ultimate'
      if (entry.hpAfter && !isAttackEntry) {
        setCurrentHpA(entry.hpAfter.A)
        setCurrentHpB(entry.hpAfter.B)
      }
      if (entry.statusAfter && !isAttackEntry) {
        setStatusA(entry.statusAfter.A)
        setStatusB(entry.statusAfter.B)
        if (entry.statusAfter.A !== 'none' && entry.statusAfter.A !== prevStatusA.current) {
          const s = entry.statusAfter.A; setTimeout(() => playStatusSound(s), Math.max(20, Math.round(100 / playbackSpeedRef.current)))
          prevStatusA.current = entry.statusAfter.A
        }
        if (entry.statusAfter.B !== 'none' && entry.statusAfter.B !== prevStatusB.current) {
          const s = entry.statusAfter.B; setTimeout(() => playStatusSound(s), Math.max(20, Math.round(100 / playbackSpeedRef.current)))
          prevStatusB.current = entry.statusAfter.B
        }
      }
      if (entry.crowdMeterAfter !== undefined) {
        setCrowdMeter(entry.crowdMeterAfter)
      }
      if (entry.type === 'swap') {
        if (entry.side === 'A') {
          const idx = battleState.teamA.findIndex(ac => ac.creature.name === entry.creatureName)
          if (idx !== -1) setActiveA(idx)
        } else if (entry.side === 'B') {
          const idx = battleState.teamB.findIndex(ac => ac.creature.name === entry.creatureName)
          if (idx !== -1) setActiveB(idx)
        }
      }

      setLogIndex(prev => prev + 1)
    }, getDelay(battleState.log[logIndex], playbackSpeedRef.current))

    return () => clearTimeout(timer)
  }, [battleState, logIndex, isDone, specialFlash, playbackSpeed])

  // ── Animation triggers ──────────────────────────────────────
  useEffect(() => {
    if (visibleLog.length === 0 || !battleState) return
    const entry = visibleLog[visibleLog.length - 1]

    // ── ATTACK SEQUENCE: dialogue first, then animation after 1s ──

    // GB dialogue fires IMMEDIATELY (trainer calls the move before it happens)
    // Skip dialogue for ultimates — the special flash handles the drama
    if ((entry.type === 'damage' || entry.type === 'critical') && entry.moveName && entry.creatureName && entry.side) {
      queueDialogue(`${entry.creatureName.toUpperCase()}, USE ${entry.moveName.toUpperCase()}!`, entry.side as 'A' | 'B')
    }
    // Status moves + misses show move call
    if (entry.type === 'move' && entry.moveName && entry.creatureName && entry.side) {
      queueDialogue(`${entry.creatureName.toUpperCase()}, USE ${entry.moveName.toUpperCase()}!`, entry.side as 'A' | 'B')
    }
    // Status-blocked turns (sleep/flinch/paralysis/freeze) — always show what happened
    // so both pokemon visibly act each turn instead of one seeming to skip silently
    if (entry.type === 'move' && !entry.moveName && entry.creatureName && entry.side) {
      const t = entry.text ?? ''
      let statusMsg = ''
      if (t.includes('asleep'))     statusMsg = `${entry.creatureName.toUpperCase()} IS FAST ASLEEP!`
      else if (t.includes('flinched'))   statusMsg = `${entry.creatureName.toUpperCase()} FLINCHED!`
      else if (t.includes("paralyzed") && t.includes("can't"))  statusMsg = `${entry.creatureName.toUpperCase()} IS PARALYZED!`
      else if (t.includes('frozen'))     statusMsg = `${entry.creatureName.toUpperCase()} IS FROZEN SOLID!`
      else if (t.includes('confused') && t.includes("can't"))   statusMsg = `${entry.creatureName.toUpperCase()} IS CONFUSED!`
      if (statusMsg) queueDialogue(statusMsg, entry.side as 'A' | 'B')
    }

    // Comic book MISS popup — fires on the defender's side, but NOT for sleep/status skips
    const isStatusSkip = entry.text?.includes('asleep') || entry.text?.includes('flinched') ||
      entry.text?.includes('paralyzed') || entry.text?.includes('frozen') || entry.text?.includes('confused')
    if (entry.type === 'move' && entry.text?.includes('missed') && entry.side && !isStatusSkip) {
      const defenderSide = entry.side === 'A' ? 'B' : 'A'
      setTimeout(() => {
        setMissPopup({ side: defenderSide, key: Date.now() })
        setTimeout(() => setMissPopup(null), Math.max(40, Math.round(950 / playbackSpeedRef.current)))
      }, Math.max(40, Math.round(600 / playbackSpeedRef.current)))
    }

    // Attack animations fire AFTER dialogue has had time to show
    // Scale animation delays by playback speed (local, client-only)
    const spd = playbackSpeedRef.current
    const ATTACK_DELAY = Math.max(40, Math.round(1400 / spd))
    // For ultimates: all attack visuals fire AFTER the special flash ends (~3.9s)
    // At 3x speed the special flash itself is skipped, so we use a shorter delay
    const ULTIMATE_ATTACK_DELAY = Math.max(80, Math.round(3900 / spd))

    // ── ATTACK VISUAL GATE ──────────────────────────────────────────────────────
    // Hard rule: same side NEVER animates twice in a row.
    // Reset on swap/ko so the new Pokémon always gets their first attack.
    if (entry.type === 'swap' || entry.type === 'ko') {
      lastAttackSideRef.current = null
    }
    const isAttackVisual = (entry.type === 'damage' || entry.type === 'critical' || entry.type === 'ultimate') && !!entry.side
    const sameAsLast = isAttackVisual && lastAttackSideRef.current === entry.side
    if (isAttackVisual && !sameAsLast) {
      lastAttackSideRef.current = entry.side as 'A' | 'B'
    }

    // Attack lunge — skip if same side attacked last
    if ((entry.type === 'damage' || entry.type === 'critical') && entry.side && !sameAsLast) {
      const side = entry.side
      setTimeout(() => {
        setAttackingSide(side)
        setTimeout(() => setAttackingSide(null), Math.max(40, Math.round(350 / spd)))
      }, ATTACK_DELAY)
    }
    if (entry.type === 'ultimate' && entry.side && !sameAsLast) {
      const side = entry.side
      setTimeout(() => {
        setAttackingSide(side)
        setTimeout(() => setAttackingSide(null), Math.max(40, Math.round(350 / spd)))
      }, ULTIMATE_ATTACK_DELAY)
    }

    // Hit flash + type glow on damage — skip if same side attacked last
    if (entry.type === 'damage' && entry.side && !sameAsLast) {
      const defenderSide = entry.side === 'A' ? 'B' : 'A'
      const mType = getMoveType(entry.moveName)
      setTimeout(() => {
        setFlashMoveType(mType)
        setFlashingSide(defenderSide)
        setTimeout(() => {
          setFlashingSide(null)
          setFlashMoveType(null)
        }, Math.max(40, Math.round(200 / spd)))
      }, ATTACK_DELAY)
    }

    // Hit stop on strong attacks — skip if same side attacked last
    if ((entry.type === 'damage' || entry.type === 'critical') && entry.damage && entry.damage > 60 && !sameAsLast) {
      setTimeout(() => {
        setHitStop(true)
        setTimeout(() => setHitStop(false), Math.max(20, Math.round((entry.type === 'critical' ? 180 : 80) / spd)))
      }, ATTACK_DELAY + Math.max(20, Math.round(200 / spd)))
    }

    // Type advantage burst — skip if same side attacked last
    if (entry.type === 'damage' && entry.text?.toLowerCase().includes('super effective') && entry.side && !sameAsLast) {
      const defenderSide = entry.side === 'A' ? 'B' : 'A'
      const moveType = getMoveType(entry.moveName)
      const burstColors: Record<string, string> = {
        fire: '#f97316', water: '#3b82f6', electric: '#eab308',
        grass: '#22c55e', ice: '#67e8f9', psychic: '#ec4899',
        fighting: '#dc2626', dragon: '#7c3aed', ghost: '#6d28d9',
      }
      const color = (moveType && burstColors[moveType]) ?? '#fff'
      setTimeout(() => {
        setTypeBurst({ color, side: defenderSide })
        setTimeout(() => setTypeBurst(null), Math.max(40, Math.round(500 / spd)))
      }, ATTACK_DELAY + Math.max(20, Math.round(100 / spd)))
    }

    // Screen shake on crit — skip if same side attacked last
    if (entry.type === 'critical' && !sameAsLast) {
      setTimeout(() => {
        setShakeActive(true)
        setTimeout(() => setShakeActive(false), Math.max(40, Math.round(450 / spd)))
      }, ATTACK_DELAY)
    }

    // Special flash — skip if same side attacked last (ultimates only)
    if (entry.type === 'ultimate' && entry.side && !sameAsLast) {
      const attackingTrainer = entry.side === 'A' ? p1Trainer : p2Trainer
      if (attackingTrainer?.id) {
        setTimeout(() => {
          setSpecialFlash({ trainerId: attackingTrainer.id, moveName: entry.moveName ?? 'SPECIAL MOVE', creatureName: entry.creatureName ?? '' })
          setTimeout(() => {
            setSpecialFlash(null)
            setRedFlash(n => n + 1) // trigger red flash as special image disappears
          }, Math.max(200, Math.round(4600 / spd)))
        }, ATTACK_DELAY)
      }
    }

    // Move animation particles — skip for ultimates (flash IS the visual) and same-side blocks
    if ((entry.type === 'damage' || entry.type === 'critical') && entry.moveName && entry.side && !sameAsLast) {
      const move = MOVES.find(m => m.name === entry.moveName)
      if (move) {
        const isExplosion = move.animationKey === 'explosion'
        const isUltimateAnim = false
        const particleDelay = ATTACK_DELAY
        setTimeout(() => {
          const animId = String(Date.now()) + String(Math.floor(Math.random() * 10000))
          currentAnimId.current = animId
          setMoveAnim({
            animKey: move.animationKey,
            side: entry.side as 'A' | 'B',
            id: animId,
          })
          playAttackSound(move.animationKey)
          const longAnims = new Set([
            'fire','fire_stream','fire_blast','fire_spin','fire_small','mega_fire',
            'thunder','lightning','electric','mega_thunder',
            'ice','blizzard','ice_beam',
            'psychic','psychic_pulse','mind_break',
            'dragon','dragon_breath',
            'dark','ghost','ghost_ball','ghost_wave','nightmare',
            'quake','tsunami','waterfall','surf_wave',
          ])
          const clearDelay = Math.max(40, Math.round((isExplosion ? 2200 : isUltimateAnim ? 2000 : longAnims.has(move.animationKey) ? 1800 : 1400) / spd))
          setTimeout(() => {
            if (currentAnimId.current === animId) {
              setMoveAnim(null)
              currentAnimId.current = null
            }
          }, clearDelay)
          if (isExplosion) {
            setBigShake(true)
            setTimeout(() => setBigShake(false), Math.max(40, Math.round(850 / spd)))
          }
        }, particleDelay)
      }
    }

    // HP drop — after attack animation fires (ultimates drop HP after the flash + particles)
    if ((entry.type === 'damage' || entry.type === 'critical' || entry.type === 'ultimate' || entry.type === 'status_damage') && entry.hpAfter) {
      const hpAfter = entry.hpAfter
      const statusAfterSnap = entry.statusAfter
      // Ultimate: if flash fires (not sameAsLast), drop HP after flash ends + 500ms pause + red flash
      // If sameAsLast blocked the flash, still drop HP at normal delay so damage always registers
      const hpDelay = (entry.type === 'ultimate' && !sameAsLast) ? ATTACK_DELAY + Math.max(200, Math.round(4600 / spd)) + Math.max(20, Math.round(500 / spd)) : ATTACK_DELAY + Math.max(20, Math.round(400 / spd))
      setTimeout(() => {
        // For ultimates that showed the flash: defender red flash first, then HP drops
        if (entry.type === 'ultimate' && !sameAsLast && entry.side) {
          const defenderSide = entry.side === 'A' ? 'B' : 'A'
          setFlashingSide(defenderSide)
          setFlashMoveType('fire')
          setTimeout(() => { setFlashingSide(null); setFlashMoveType(null) }, Math.max(40, Math.round(400 / spd)))
          setTimeout(() => {
            setCurrentHpA(hpAfter.A)
            setCurrentHpB(hpAfter.B)
          }, Math.max(40, Math.round(400 / spd)))
        } else {
          setCurrentHpA(hpAfter.A)
          setCurrentHpB(hpAfter.B)
        }
        if (statusAfterSnap) {
          setStatusA(statusAfterSnap.A)
          setStatusB(statusAfterSnap.B)
          if (statusAfterSnap.A !== 'none' && statusAfterSnap.A !== prevStatusA.current) {
            playStatusSound(statusAfterSnap.A); prevStatusA.current = statusAfterSnap.A
          }
          if (statusAfterSnap.B !== 'none' && statusAfterSnap.B !== prevStatusB.current) {
            playStatusSound(statusAfterSnap.B); prevStatusB.current = statusAfterSnap.B
          }
        }
      }, hpDelay)
    }

    // KO faint — track which creature slot got KO'd for side panel display
    if (entry.type === 'ko' && entry.side) {
      setKoSide(entry.side)

      // Mark the currently active slot as KO'd in the animated tracker
      if (entry.side === 'A') {
        setKoSetA(prev => {
          const next = new Set(prev)
          next.add(activeA)
          return next
        })
      } else {
        setKoSetB(prev => {
          const next = new Set(prev)
          next.add(activeB)
          return next
        })
      }
      // KO sound effects
      playKOSound()
      setTimeout(() => playRealCrowdCheer(), Math.max(20, Math.round(300 / spd)))
      setTimeout(() => playRandomCrowdReaction(), Math.max(40, Math.round(1200 / spd)))
    }

    // KO phrase — winning trainer taunts
    if (entry.type === 'ko' && entry.side) {
      const winningSide: 'A' | 'B' = entry.side === 'A' ? 'B' : 'A'
      const winningTrainer = winningSide === 'A' ? p1Trainer : p2Trainer
      if (winningTrainer?.koPhrases?.length) {
        const phrase = winningTrainer.koPhrases[Math.floor(Math.random() * winningTrainer.koPhrases.length)]
        setTimeout(() => queueDialogue(phrase, winningSide), Math.max(40, Math.round(900 / spd)))
      }
    }

    // Crowd roar flash
    if (entry.type === 'crowd_roar') {
      setCrowdRoarActive(true)
      setCrowdGlow(true)
      setTimeout(() => {
        setCrowdRoarActive(false)
        setCrowdGlow(false)
      }, Math.max(40, Math.round(700 / spd)))
    }

    // Ditto transform reveal — clear the override for the active slot to reveal new form
    if ((entry as any).dittoRevealSide) {
      const revealSide = (entry as any).dittoRevealSide as 'A' | 'B'
      if (revealSide === 'A') {
        setSpriteOverridesA(prev => { const n = { ...prev }; delete n[activeA]; return n })
      } else {
        setSpriteOverridesB(prev => { const n = { ...prev }; delete n[activeB]; return n })
      }
    }

    // Swap / entry animation
    if (entry.type === 'swap' && entry.side) {
      const side = entry.side
      setKoSide(null)
      // New creature comes in fresh — clear its status badge + sound ref
      if (side === 'A') { setStatusA('none'); prevStatusA.current = 'none' }
      if (side === 'B') { setStatusB('none'); prevStatusB.current = 'none' }

      if (side === 'A') {
        setSwappingA(true)
        setTimeout(() => setSwappingA(false), Math.max(40, Math.round(500 / spd)))
        const idx = battleState.teamA.findIndex(ac => ac.creature.name === entry.creatureName)
        if (idx !== -1) {
          // Reveal this slot
          setRevealedA(prev => { const n = new Set(prev); n.add(idx); return n })
          if (battleState.teamA[idx].shiny) {
            setSparkleA(true)
            setTimeout(() => setSparkleA(false), Math.max(40, Math.round(1200 / spd)))
          }
        }
      } else {
        setSwappingB(true)
        setTimeout(() => setSwappingB(false), Math.max(40, Math.round(500 / spd)))
        const idx = battleState.teamB.findIndex(ac => ac.creature.name === entry.creatureName)
        if (idx !== -1) {
          // Reveal this slot
          setRevealedB(prev => { const n = new Set(prev); n.add(idx); return n })
          if (battleState.teamB[idx].shiny) {
            setSparkleB(true)
            setTimeout(() => setSparkleB(false), Math.max(40, Math.round(1200 / spd)))
          }
        }
      }
    }

    // Arena event flash
    if (entry.type === 'arena_event') {
      // Don't interrupt a special flash — delay arena event until flash is done
      const arenaDelay = specialFlash ? Math.max(80, Math.round(3400 / spd)) : 0
      setTimeout(() => {
        setArenaEventActive(entry.text)
        setTimeout(() => setArenaEventActive(null), Math.max(80, Math.round(4000 / spd)))
      }, arenaDelay)
    }

    // Announcer lines — removed from display (instant-skipped in log)

    // Trainer reactions — removed from display (were cluttering the center panel)
    // trainer_react entries are still in the log but instant-skipped (delay=0)

    // Arena telegraph — reuse arenaEventActive state with different style
    if (entry.type === 'arena_telegraph') {
      const telegraphDelay = specialFlash ? Math.max(80, Math.round(3400 / spd)) : 0
      setTimeout(() => {
        setArenaEventActive(entry.text)
        setTimeout(() => setArenaEventActive(null), Math.max(80, Math.round(2800 / spd)))
      }, telegraphDelay)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleLog.length])

  // ── Auto-scroll log ─────────────────────────────────────────
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [visibleLog])

  // ── Loading screen ──────────────────────────────────────────
  if (!battleState) {
    return (
      <div style={{
        height: '100dvh', maxHeight: '100dvh', background: '#0a0a0f',
        display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
      }}>
        <motion.div
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1, repeat: Infinity }}
          style={{ color: '#7c3aed', fontSize: 24, fontWeight: 700 }}
        >
          ⚔️ Preparing battle...
        </motion.div>
      </div>
    )
  }

  const teamA = battleState.teamA
  const teamB = battleState.teamB
  const creatureA = teamA[activeA]
  const creatureB = teamB[activeB]

    const maxHpA = creatureA?.maxHp ?? 1
  const maxHpB = creatureB?.maxHp ?? 1
  const hpPercentA = Math.max(0, (currentHpA / maxHpA) * 100)
  const hpPercentB = Math.max(0, (currentHpB / maxHpB) * 100)

  return (
    <div key={battleState?.teamA[0]?.creature.id} style={{
      height: '100dvh',
      maxHeight: '100dvh',
      background: arena?.bgGradient ?? '#0a0a0f',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Arena image background */}
      {arena && (
        <img
          src={arena.image ?? `/arenas/${arena.id}.png`}
          alt=""
          aria-hidden="true"
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            objectFit: 'cover',
            // Per-arena vertical positioning so Pokémon appear to stand on the ground
            objectPosition: arena.id === 'sabrinas_gym' ? 'center 5%'
              : arena.id === 'giovannis_gym' ? 'center 90%'
              : 'center 75%',
            imageRendering: 'pixelated',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />
      )}
      {/* Dark overlay on arena bg */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'rgba(0,0,0,0.55)',
        pointerEvents: 'none',
        zIndex: 0,
      }} />

      {/* Electric screen flash removed — was causing persistent yellow overlay */}

      {/* ── Type advantage burst ── */}
      <AnimatePresence>
        {typeBurst && (
          <motion.div
            key={`type-burst-${typeBurst.side}`}
            initial={{ opacity: 1, scale: 1 }}
            animate={{ opacity: [0, 0.6, 0], scale: [0.5, 1.8, 2.5] }}
            transition={{ duration: 0.5, times: [0, 0.3, 1] }}
            style={{
              position: 'absolute',
              left: typeBurst.side === 'A' ? '15%' : '55%',
              top: '20%',
              width: 300, height: 300,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${typeBurst.color}88 0%, ${typeBurst.color}33 50%, transparent 75%)`,
              pointerEvents: 'none',
              zIndex: 15,
              transform: 'translate(-50%, -50%)',
            }}
          />
        )}
      </AnimatePresence>

      {/* ── Crowd roar golden pulse ── */}
      <AnimatePresence>
        {crowdRoarActive && (
          <motion.div
            key="crowd-roar"
            initial={{ opacity: 1 }}
            animate={{ opacity: [0, 0.35, 0] }}
            transition={{ duration: 0.6, times: [0, 0.4, 1] }}
            style={{
              position: 'absolute', inset: 0, zIndex: 5,
              background: 'radial-gradient(ellipse at center, rgba(251,191,36,0.55) 0%, rgba(251,191,36,0.15) 50%, transparent 75%)',
              pointerEvents: 'none',
            }}
          />
        )}
      </AnimatePresence>

      {/* ── Arena event background pulse ── */}
      <AnimatePresence>
        {arenaEventActive && arena?.bgGradient && (
          <motion.div
            key="arena-pulse"
            initial={{ opacity: 1 }}
            animate={{ opacity: 0.35 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, type: 'tween' }}
            style={{
              position: 'absolute', inset: 0, zIndex: 125,
              background: arena.bgGradient,
              pointerEvents: 'none',
            }}
          />
        )}
      </AnimatePresence>

      {/* ── Arena event banner — prominent lower-center ── */}
      <AnimatePresence>
        {arenaEventActive && (
          <motion.div
            key={`arena-banner-${arenaEventActive}`}
            initial={{ opacity: 0, scaleY: 0.4 }}
            animate={{ opacity: 1, scaleY: 1 }}
            exit={{ opacity: 0, scaleY: 0.4 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            style={{
              position: 'absolute',
              top: '50%',
              left: 0,
              right: 0,
              transform: 'translateY(-50%)',
              zIndex: 130,
              pointerEvents: 'none',
            }}
          >
            {/* Outer alert bar — full width like an emergency broadcast */}
            <div style={{
              background: 'rgba(0,0,0,0.92)',
              borderTop: '3px solid #f97316',
              borderBottom: '3px solid #f97316',
              padding: '10px 0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 14,
              boxShadow: '0 0 40px rgba(249,115,22,0.5), inset 0 0 60px rgba(0,0,0,0.6)',
            }}>
              {/* Flashing alert icon */}
              <motion.div
                animate={{ opacity: [1, 0.2, 1] }}
                transition={{ duration: 0.6, repeat: Infinity }}
                style={{ fontSize: 22, lineHeight: 1 }}
              >
                ⚠️
              </motion.div>
              {/* ARENA EVENT label */}
              <div style={{
                fontFamily: '"Impact", "Arial Black", sans-serif',
                fontSize: 11,
                fontWeight: 900,
                letterSpacing: '0.3em',
                textTransform: 'uppercase',
                color: '#f97316',
              }}>
                ARENA EVENT
              </div>
              {/* Divider */}
              <div style={{ width: 2, height: 22, background: '#f97316', opacity: 0.6 }} />
              {/* Event name */}
              <div style={{
                fontFamily: '"Impact", "Arial Black", sans-serif',
                fontSize: 24,
                fontWeight: 900,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: '#fff',
                textShadow: '0 0 20px rgba(249,115,22,0.9)',
              }}>
                {arenaEventActive}
              </div>
              {/* Flashing alert icon right */}
              <motion.div
                animate={{ opacity: [1, 0.2, 1] }}
                transition={{ duration: 0.6, repeat: Infinity, delay: 0.3 }}
                style={{ fontSize: 22, lineHeight: 1 }}
              >
                ⚠️
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Ultimate overlay — plain CSS to avoid framer-motion exit-stuck black screen ── */}
      {/* Backdrop: always mounted, CSS transition opacity to avoid getting stuck */}
      <div
        style={{
          position: 'absolute', inset: 0, zIndex: 20,
          background: 'black',
          opacity: ultimateActive && !specialFlash ? 0.75 : 0,
          transition: 'opacity 0.3s ease',
          pointerEvents: 'none',
        }}
      />
      {/* Ultimate text: CSS keyframe pop-in, fades out when ultimateActive clears */}
      {/* Suppressed when a special flash image is showing for this trainer */}
      {ultimateActive && !specialFlash && (
        <div
          style={{
            position: 'absolute', zIndex: 30,
            top: '42%', left: '50%', transform: 'translateX(-50%)',
            textAlign: 'center',
            pointerEvents: 'none',
            animation: 'pokeballPop 0.35s ease-out forwards',
          }}
        >
          <div style={{
            fontSize: 52, fontWeight: 900,
            background: 'linear-gradient(90deg, #fbbf24, #f97316, #fbbf24)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            textShadow: 'none',
            filter: 'drop-shadow(0 0 20px rgba(251,191,36,0.8))',
            letterSpacing: '0.05em',
            whiteSpace: 'nowrap',
          }}>
            ⚡ ULTIMATE MOVE!
          </div>
          <div style={{
            fontSize: 22, color: '#fde68a', marginTop: 8, fontWeight: 700,
            textShadow: '0 0 12px rgba(251,191,36,0.6)',
          }}>
            {ultimateActive.name}
          </div>
        </div>
      )}

      {/* ── Preload ALL trainer special images so they're cached before the flash fires ── */}
      <div style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden', pointerEvents: 'none' }} aria-hidden="true">
        {[p1Trainer, p2Trainer].filter(Boolean).map(t => {
          const capitalized = t!.id.charAt(0).toUpperCase() + t!.id.slice(1)
          return <img key={t!.id} src={`/trainer-specials/${capitalized}.png`} alt="" />
        })}
      </div>

      {/* ── Trainer Special Flash — anime image fullscreen dramatic overlay ── */}
      {specialFlash && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 50,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
          animation: 'specialFlashFadeOut 4.6s ease-in-out forwards',
        }}>
          {/* Hard white flash */}
          <div style={{ position: 'absolute', inset: 0, background: 'white', animation: 'specialFlashWhite 0.25s ease-out forwards' }} />
          {/* Pure black for the dramatic pause */}
          <div style={{ position: 'absolute', inset: 0, background: '#000' }} />
          {/* Speed lines — expand outward */}
          <div style={{
            position: 'absolute', inset: '-20%',
            background: 'repeating-conic-gradient(rgba(251,191,36,0.09) 0deg 2deg, transparent 2deg 8deg)',
            animation: 'specialSpeedLines 0.6s 1.15s ease-out forwards',
            opacity: 0,
          }} />
          {/* Radial gold glow */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'radial-gradient(ellipse at center, rgba(251,191,36,0.28) 0%, rgba(251,100,36,0.08) 45%, transparent 70%)',
            animation: 'specialImgPop 0.4s 1.1s ease-out both',
            opacity: 0,
          }} />
          {/* Halftone dot pattern */}
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: 'radial-gradient(circle, rgba(251,191,36,0.12) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
            animation: 'specialImgPop 0.5s 1.15s ease-out both',
            opacity: 0,
          }} />

          {/* Content — delayed so it appears AFTER the black pause */}
          <div style={{
            position: 'relative', zIndex: 2, textAlign: 'center',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            animation: 'specialScreenShake 0.45s 1.22s ease-out',
          }}>
            {/* Torn / jagged image */}
            <div style={{
              animation: 'specialImgPop 0.32s 1.2s cubic-bezier(0.34,1.56,0.64,1) both',

              filter: 'drop-shadow(0 0 40px rgba(251,191,36,1)) drop-shadow(0 0 80px rgba(251,191,36,0.6)) drop-shadow(0 0 120px rgba(251,100,36,0.4)) drop-shadow(4px 4px 0px #000)',
              clipPath: `polygon(
                0% 6%, 3% 0%, 7% 4%, 12% 0%, 16% 5%, 22% 0%, 27% 3%, 33% 0%, 38% 4%, 44% 0%,
                50% 3%, 56% 0%, 61% 4%, 67% 0%, 72% 3%, 78% 0%, 83% 5%, 88% 0%, 93% 4%, 97% 0%, 100% 5%,
                98% 18%, 100% 30%, 97% 42%, 100% 55%, 98% 68%, 100% 80%, 97% 92%, 100% 100%,
                95% 96%, 90% 100%, 85% 95%, 80% 100%, 75% 96%, 70% 100%, 64% 95%, 58% 100%,
                52% 96%, 46% 100%, 40% 95%, 34% 100%, 28% 96%, 22% 100%, 16% 95%, 10% 100%, 4% 96%, 0% 100%,
                2% 88%, 0% 75%, 3% 62%, 0% 48%, 2% 35%, 0% 22%, 2% 10%
              )`,
            }}>
              <img
                src={`/trainer-specials/${specialFlash.trainerId.charAt(0).toUpperCase() + specialFlash.trainerId.slice(1)}.png`}
                alt="Special attack"
                style={{ maxHeight: '60vh', maxWidth: '75vw', objectFit: 'contain', display: 'block' }}
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            </div>

            {/* Move name — slides up from below */}
            <div style={{
              marginTop: 16,
              fontFamily: '"Impact","Arial Black",sans-serif',
              fontSize: 42, fontWeight: 900,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              background: 'linear-gradient(90deg, #fbbf24 0%, #fff 35%, #f97316 65%, #fbbf24 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              filter: 'drop-shadow(0 0 24px rgba(251,191,36,1)) drop-shadow(0 0 48px rgba(251,191,36,0.6)) drop-shadow(3px 3px 0px #000)',
              animation: 'specialMoveNameIn 0.4s 1.38s cubic-bezier(0.34,1.56,0.64,1) both',
              WebkitTextStroke: '1px rgba(0,0,0,0.5)',
            }}>
              {specialFlash.creatureName ? `${specialFlash.creatureName.toUpperCase()}, USE ${specialFlash.moveName.toUpperCase()}!` : `${specialFlash.moveName.toUpperCase()}!`}
            </div>
          </div>
        </div>
      )}

      {/* ── Red impact flash — fires as special attack image disappears ── */}
      {redFlash > 0 && (
        <div
          key={redFlash}
          style={{
            position: 'absolute', inset: 0, zIndex: 49, pointerEvents: 'none',
            background: 'radial-gradient(ellipse at center, rgba(220,30,30,0.95) 0%, rgba(180,0,0,0.85) 40%, rgba(120,0,0,0.6) 100%)',
            animation: 'redImpactFlash 0.5s ease-out forwards',
          }}
        />
      )}

      {/* ── Comic Book MISS popup — plain CSS (framer-motion initial opacity:0 breaks this) ── */}
      {missPopup && (
        <div
          key={missPopup.key}
          style={{
            position: 'absolute',
            left: missPopup.side === 'B' ? '65%' : '18%',
            top: '30%',
            zIndex: 40,
            pointerEvents: 'none',
            // CSS does the transform-based animation via @keyframes missPopIn
            animation: 'missPopIn 0.9s ease-out forwards',
            // translate(-50%,-50%) is baked into the keyframe
          }}
        >
          {/* Starburst SVG background */}
          <svg width="200" height="200" viewBox="0 0 200 200" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 0 }}>
            {Array.from({ length: 16 }).map((_, i) => {
              const angle = (i / 16) * 360
              const r = Math.PI / 180 * angle
              const r2 = Math.PI / 180 * (angle + 360 / 32)
              const x1 = 100 + Math.cos(r) * 95, y1 = 100 + Math.sin(r) * 95
              const x2 = 100 + Math.cos(r2) * 60, y2 = 100 + Math.sin(r2) * 60
              return <polygon key={i} points={`100,100 ${x1},${y1} ${x2},${y2}`} fill="#fbbf24" />
            })}
            <circle cx="100" cy="100" r="60" fill="#fbbf24" />
          </svg>
          {/* MISS text */}
          <div style={{
            position: 'relative', zIndex: 1,
            fontFamily: '"Impact", "Arial Black", sans-serif',
            fontSize: 58, fontWeight: 900,
            color: '#1e1b4b',
            letterSpacing: '-0.02em',
            textTransform: 'uppercase',
            lineHeight: 1,
            textShadow: '3px 3px 0 #fff, -2px -2px 0 #fff, 2px -2px 0 #fff, -2px 2px 0 #fff, 5px 5px 0 rgba(0,0,0,0.3)',
            whiteSpace: 'nowrap',
            padding: '12px 20px',
          }}>
            MISS!
          </div>
        </div>
      )}

      {/* ── Hit stop flash overlay ── */}
      {hitStop && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 25,
          background: 'rgba(255,255,255,0.18)',
          pointerEvents: 'none',
        }} />
      )}

      {/* ── Content ── */}
      <motion.div
        animate={shakeControls}
        style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', flex: 1 }}
      >
        {/* Top bar */}
        <div style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.35)' }}>
          <div style={{ color: '#94a3b8', fontSize: 13, fontWeight: 600 }}>⚔️ {arena?.name ?? 'Arena'}</div>
          <div style={{ color: '#334155', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700 }}>{arena?.name ?? 'BATTLE ARENA'}</div>
          <div style={{ color: '#64748b', fontSize: 13 }}>Turn {visibleLog.filter(e => e.type === 'move' || e.type === 'damage' || e.type === 'critical').length}</div>
        </div>

        {/* Main battle area */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Side A — team list + trainer below */}
          <div style={{ width: 155, display: 'flex', flexDirection: 'column', padding: '10px 6px 0 10px', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ color: '#7c3aed', fontSize: 11, fontWeight: 700, marginBottom: 6, letterSpacing: '0.05em' }}>{p1Trainer?.name ?? 'P1'}</div>
            {teamA.map((ac, i) => {
              const isActive = i === activeA
              const isKOd = koSetA.has(i)
              const isRevealed = revealedA.has(i)
              if (!isRevealed) {
                return (
                  <div key={`a-hidden-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'transparent', borderRadius: 6, padding: '3px 5px', marginBottom: 3, border: '1px solid transparent' }}>
                    <div style={{ width: 26, height: 26, borderRadius: 4, background: '#1a1a2e', border: '1px dashed #2d2d5e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#334155', fontWeight: 900 }}>?</div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#334155' }}>???</div>
                  </div>
                )
              }
              return (
                <div key={ac.creature.id} style={{ display: 'flex', alignItems: 'center', gap: 5, background: isActive ? 'rgba(124,58,237,0.18)' : 'transparent', borderRadius: 6, padding: '3px 5px', marginBottom: 3, border: isActive ? '1px solid rgba(124,58,237,0.35)' : '1px solid transparent', opacity: isKOd ? 0.3 : 1, filter: isKOd ? 'grayscale(1)' : 'none' }}>
                  <img src={ac.creature.spriteUrl} alt={ac.creature.name} style={{ width: 26, height: 26, imageRendering: 'pixelated' }} />
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: isKOd ? '#475569' : '#e2e8f0' }}>{ac.creature.name}</div>
                    {isKOd ? (
                      <div style={{ fontSize: 9, color: '#ef4444' }}>KO</div>
                    ) : (
                      <div style={{ width: 55, height: 3, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ width: `${isActive ? Math.max(0, (currentHpA / ac.maxHp) * 100) : 100}%`, height: '100%', background: isActive ? getHpColor((currentHpA / ac.maxHp) * 100) : '#22c55e', transition: 'width 0.4s ease' }} />
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Center battle view */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', padding: '40px 0 0', position: 'relative' }}>
            {/* Matchup display */}
            <div 
              data-battle-container 
              style={{ display: 'flex', alignItems: 'flex-start', gap: 24, width: '100%', justifyContent: 'center', position: 'relative', zIndex: 1 }}
            >
              {/* Creature A */}
              <CreatureDisplay
                key={`creature-a-${creatureA?.creature.id ?? 'none'}`}
                ac={creatureA}
                currentHp={currentHpA}
                isLeft
                trainerName={p1Trainer?.name ?? 'P1'}
                trainerColor="#7c3aed"
                isAttacking={attackingSide === 'A'}
                isFlashing={flashingSide === 'A'}
                flashMoveType={flashingSide === 'A' ? flashMoveType : null}
                isKO={koSide === 'A'}
                isSwapping={swappingA}
                hasSparkle={sparkleA}
                isUltimate={ultimateActive?.side === 'A'}
                isLastStand={false}
                status={statusA}
                spriteOverride={spriteOverrideA}
              />

              {/* VS divider */}
              <motion.div
                animate={{
                  rotate: [0, 5, -5, 0],
                  scale: [1, 1.1],
                }}
                transition={{ duration: 1.5, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut', type: 'tween' }}
                style={{
                  fontSize: 40, fontWeight: 900, color: '#fbbf24',
                  textShadow: '0 0 20px rgba(251,191,36,0.6)',
                  userSelect: 'none',
                }}
              >
                VS
              </motion.div>

              {/* Creature B */}
              <CreatureDisplay
                key={`creature-b-${creatureB?.creature.id ?? 'none'}`}
                ac={creatureB}
                currentHp={currentHpB}
                isLeft={false}
                trainerName={p2Trainer?.name ?? 'P2'}
                trainerColor="#ef4444"
                isAttacking={attackingSide === 'B'}
                isFlashing={flashingSide === 'B'}
                flashMoveType={flashingSide === 'B' ? flashMoveType : null}
                isKO={koSide === 'B'}
                isSwapping={swappingB}
                hasSparkle={sparkleB}
                isUltimate={ultimateActive?.side === 'B'}
                isLastStand={false}
                status={statusB}
                spriteOverride={spriteOverrideB}
              />
            </div>


          </div>

          {/* Side B — team list + trainer below */}
          <div style={{ width: 155, display: 'flex', flexDirection: 'column', padding: '10px 10px 0 6px', borderLeft: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ color: '#ef4444', fontSize: 11, fontWeight: 700, marginBottom: 6, letterSpacing: '0.05em', textAlign: 'right' }}>{p2Trainer?.name ?? 'P2'}</div>
            {teamB.map((ac, i) => {
              const isActive = i === activeB
              const isKOd = koSetB.has(i)
              const isRevealed = revealedB.has(i)
              if (!isRevealed) {
                return (
                  <div key={`b-hidden-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'transparent', borderRadius: 6, padding: '3px 5px', marginBottom: 3, border: '1px solid transparent' }}>
                    <div style={{ width: 26, height: 26, borderRadius: 4, background: '#1a1a2e', border: '1px dashed #2d2d5e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#334155', fontWeight: 900 }}>?</div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#334155' }}>???</div>
                  </div>
                )
              }
              return (
                <div key={ac.creature.id} style={{ display: 'flex', alignItems: 'center', gap: 5, background: isActive ? 'rgba(239,68,68,0.18)' : 'transparent', borderRadius: 6, padding: '3px 5px', marginBottom: 3, border: isActive ? '1px solid rgba(239,68,68,0.35)' : '1px solid transparent', opacity: isKOd ? 0.3 : 1, filter: isKOd ? 'grayscale(1)' : 'none' }}>
                  <img src={ac.creature.spriteUrl} alt={ac.creature.name} style={{ width: 26, height: 26, imageRendering: 'pixelated' }} />
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: isKOd ? '#475569' : '#e2e8f0' }}>{ac.creature.name}</div>
                    {isKOd ? (
                      <div style={{ fontSize: 9, color: '#ef4444' }}>KO</div>
                    ) : (
                      <div style={{ width: 55, height: 3, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ width: `${isActive ? Math.max(0, (currentHpB / ac.maxHp) * 100) : 100}%`, height: '100%', background: isActive ? getHpColor((currentHpB / ac.maxHp) * 100) : '#22c55e', transition: 'width 0.4s ease' }} />
                      </div>
                    )}
                  </div>
                </div>
              )
            })}

          </div>
        </div>

      </motion.div>



      {/* Crowd burst emoji explosion on KO */}


      {/* Winner banner — plain CSS to guarantee visibility */}
      {/* ── SPEED TOGGLE — fixed floating button, always visible during battle ── */}
      {!isDone && (
        <button
          onClick={() => setPlaybackSpeed(s => s === 1 ? 3 : 1)}
          title={playbackSpeed === 1 ? 'Switch to 3× speed' : 'Switch to normal speed'}
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 9999,
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '10px 18px',
            borderRadius: 12,
            border: playbackSpeed === 3
              ? '2px solid #fbbf24'
              : '2px solid rgba(255,255,255,0.4)',
            background: playbackSpeed === 3
              ? 'linear-gradient(135deg, rgba(251,191,36,0.35), rgba(249,115,22,0.25))'
              : 'rgba(10,10,20,0.85)',
            color: playbackSpeed === 3 ? '#fbbf24' : '#e2e8f0',
            fontSize: 14,
            fontWeight: 900,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            letterSpacing: '0.08em',
            boxShadow: playbackSpeed === 3
              ? '0 0 20px rgba(251,191,36,0.6), 0 4px 16px rgba(0,0,0,0.6)'
              : '0 4px 16px rgba(0,0,0,0.6)',
            backdropFilter: 'blur(8px)',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
          }}
        >
          <span style={{ fontSize: 16 }}>{playbackSpeed === 3 ? '⚡' : '▶'}</span>
          {playbackSpeed === 3 ? '3× FAST' : '1× SPEED'}
        </button>
      )}

      {isDone && battleState.winner && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 50,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.85)',
          animation: 'fadeIn 0.4s ease forwards',
        }}>
          <div style={{ textAlign: 'center', padding: 40 }}>
            <div style={{ fontSize: 80, marginBottom: 16, animation: 'pokeballPop 0.5s ease-out forwards' }}>
              🏆
            </div>
            <div style={{
              fontSize: 52, fontWeight: 900,
              color: battleState.winner === 'A' ? '#7c3aed' : '#ef4444',
              textShadow: `0 0 30px ${battleState.winner === 'A' ? 'rgba(124,58,237,0.8)' : 'rgba(239,68,68,0.8)'}`,
              marginBottom: 8,
            }}>
              {battleState.winner === 'A' ? p1Trainer?.name : p2Trainer?.name} WINS!
            </div>
            <div style={{ color: '#94a3b8', fontSize: 18, marginBottom: 32 }}>
              A legendary battle has concluded!
            </div>
            <button
              onClick={() => battleState.winner === 'A' ? showVictoryScreen() : showDefeatScreen()}
              style={{
                padding: '16px 48px',
                background: battleState.winner === 'A' 
                  ? 'linear-gradient(135deg, #7c3aed, #5b21b6)' 
                  : 'linear-gradient(135deg, #dc2626, #991b1b)',
                border: 'none', borderRadius: 12,
                color: 'white', fontSize: 20, fontWeight: 700, cursor: 'pointer',
                boxShadow: '0 0 20px rgba(124,58,237,0.5)',
              }}
            >
              View Results →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── CREATURE DISPLAY ────────────────────────────────────────────
interface CreatureDisplayProps {
  ac: import('@/lib/game-types').ActiveCreature | undefined
  currentHp: number
  isLeft: boolean
  trainerName: string
  trainerColor: string
  isAttacking: boolean
  isFlashing: boolean
  flashMoveType: string | null
  isKO: boolean
  isSwapping: boolean
  hasSparkle: boolean
  isUltimate: boolean
  isLastStand: boolean
  status?: string
  spriteOverride?: string | null
}

function CreatureDisplay({
  ac, currentHp, isLeft, trainerName, trainerColor,
  isAttacking, isFlashing, flashMoveType, isKO, isSwapping, hasSparkle, isUltimate, isLastStand, status,
  spriteOverride,
}: CreatureDisplayProps) {
  const [koFlashOn, setKoFlashOn] = useState(false)
  // Plain CSS-driven sprite transform state (no framer-motion on sprite)
  const [spriteStyle, setSpriteStyle] = useState<React.CSSProperties>({
    transform: isSwapping ? `translateX(${isLeft ? -120 : 120}px) scale(0.7)` : 'scale(1)',
    opacity: 1,
    animation: isSwapping ? 'none' : 'pokeballPop 0.45s ease-out forwards',
  })

  // Swap slide-in
  useEffect(() => {
    if (isSwapping) {
      const t = setTimeout(() => setSpriteStyle({ transform: 'none', opacity: 1, transition: 'transform 0.4s cubic-bezier(0.34,1.56,0.64,1)' }), 20)
      return () => clearTimeout(t)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Lunge animation
  useEffect(() => {
    if (isAttacking) {
      const x = isLeft ? 40 : -40
      setSpriteStyle({ transform: `translateX(${x}px)`, opacity: 1, transition: 'transform 0.15s ease-out' })
      const t = setTimeout(() => setSpriteStyle({ transform: 'none', opacity: 1, transition: 'transform 0.2s ease-in' }), 150)
      return () => clearTimeout(t)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAttacking])

  // Ultimate scale up
  useEffect(() => {
    setSpriteStyle(prev => ({
      ...prev,
      transform: isUltimate ? 'scale(1.4)' : 'none',
      transition: isUltimate ? 'transform 0.3s ease' : 'transform 0.4s ease',
    }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isUltimate])

  // KO faint animation: flash red, launch backward, slam down
  useEffect(() => {
    if (isKO) {
      let count = 0
      const iv = setInterval(() => {
        setKoFlashOn(v => !v)
        count++
        if (count >= 6) {
          clearInterval(iv)
          setKoFlashOn(false)
          // Launch backward (away from center)
          const launchX = isLeft ? -60 : 60
          const launchRot = isLeft ? -25 : 25
          setSpriteStyle({
            transform: 'translateX(' + launchX + 'px) translateY(-20px) rotate(' + launchRot + 'deg) scale(0.9)',
            opacity: 1,
            transition: 'transform 0.15s ease-out',
          })
          setTimeout(() => setSpriteStyle({
            transform: 'translateX(' + (launchX * 0.5) + 'px) translateY(100px) rotate(' + (-launchRot) + 'deg) scale(0.7)',
            opacity: 0,
            transition: 'transform 0.5s ease-in, opacity 0.5s ease-in',
          }), 150)
        }
      }, 50)
      return () => clearInterval(iv)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isKO])

  if (!ac) return <div style={{ width: 340 }} />

  const primaryType = ac.creature.types[0] as string
  const typeColor = TYPE_COLORS[primaryType] ?? '#9ca3af'
  const hpPct = Math.max(0, Math.min(100, (currentHp / ac.maxHp) * 100))
  const hpColor = getHpColor(hpPct)

  // Compute sprite filter
  let spriteFilter = ac.shiny ? 'drop-shadow(0 0 8px #fbbf24)' : 'none'
  if (koFlashOn) {
    spriteFilter = 'drop-shadow(0 0 14px #ef4444) brightness(2.5) saturate(3)'
  } else if (isFlashing) {
    const typeGlow = flashMoveType ? TYPE_GLOW[flashMoveType] : null
    spriteFilter = typeGlow ?? 'brightness(3)'
  } else if (isUltimate) {
    spriteFilter = 'drop-shadow(0 0 20px #fbbf24) brightness(1.8)'
  }

  // Determine side for data attribute
  const side = isLeft ? 'A' : 'B'
  
  return (
    <div 
      data-creature-display 
      data-side={side}
      style={{ textAlign: 'center', width: 340, position: 'relative' }}
    >

      {/* ── Name + HP bar ABOVE the sprite ── */}
      <div style={{ marginBottom: 8, padding: '0 4px', position: 'relative' }}>

        {/* Name row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 5 }}>
          <span style={{ fontSize: 18, fontWeight: 800, color: '#f1f5f9', letterSpacing: '0.02em' }}>
            {ac.creature.name}
          </span>
          {ac.shiny && (
            <motion.span
              animate={{ opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 1.2, repeat: Infinity }}
              style={{ fontSize: 13, color: '#fbbf24' }}
            >✨</motion.span>
          )}
          {/* Type badges inline */}
          {ac.creature.types.map((t: string) => (
            <span key={t} style={{
              fontSize: 9, padding: '2px 6px', borderRadius: 8,
              background: `${TYPE_COLORS[t] ?? '#9ca3af'}33`,
              color: TYPE_COLORS[t] ?? '#9ca3af',
              fontWeight: 700, textTransform: 'uppercase',
            }}>{t}</span>
          ))}
        </div>

        {/* HP bar — plain CSS transition (guaranteed smooth drain) */}
        <div style={{ position: 'relative', height: 10, background: 'rgba(255,255,255,0.1)', borderRadius: 5, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.15)' }}>
          <div
            style={{
              height: '100%',
              width: `${hpPct}%`,
              background: hpColor,
              boxShadow: `0 0 8px ${hpColor}99`,
              borderRadius: 5,
              transition: 'width 0.5s ease-out, background 0.3s ease',
              animation: hpPct < 20 ? 'hpFlash 0.6s ease-in-out infinite' : 'none',
            }}
          />
        </div>
        {/* Status badge — absolutely positioned so it never shifts the sprite */}
        {status && status !== 'none' && (
          <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', bottom: -18, whiteSpace: 'nowrap', zIndex: 10 }}>
            {{
              poisoned:   <span style={{ fontSize: 10, fontWeight: 800, background: '#7c3aed', color: '#fff', padding: '1px 6px', borderRadius: 4, letterSpacing: '0.05em' }}>☠️ PSN</span>,
              burned:     <span style={{ fontSize: 10, fontWeight: 800, background: '#dc2626', color: '#fff', padding: '1px 6px', borderRadius: 4, letterSpacing: '0.05em' }}>🔥 BRN</span>,
              paralyzed:  <span style={{ fontSize: 10, fontWeight: 800, background: '#ca8a04', color: '#fff', padding: '1px 6px', borderRadius: 4, letterSpacing: '0.05em' }}>⚡ PAR</span>,
              sleep:      <span style={{ fontSize: 10, fontWeight: 800, background: '#334155', color: '#fff', padding: '1px 6px', borderRadius: 4, letterSpacing: '0.05em' }}>💤 SLP</span>,
              frozen:     <span style={{ fontSize: 10, fontWeight: 800, background: '#38bdf8', color: '#0c0c1a', padding: '1px 6px', borderRadius: 4, letterSpacing: '0.05em' }}>🧊 FRZ</span>,
              confused:   <span style={{ fontSize: 10, fontWeight: 800, background: '#ec4899', color: '#fff', padding: '1px 6px', borderRadius: 4, letterSpacing: '0.05em' }}>😵 CNF</span>,
            }[status] ?? null}
          </div>
        )}

        {/* HP numbers */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
          <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>HP</span>
          <motion.span
            animate={{ x: hpPct < 20 ? [0, -2, 2, -1, 1, 0] : 0 }}
            transition={hpPct < 20 ? { duration: 0.5, repeat: Infinity } : {}}
            style={{ fontSize: 11, color: hpPct < 25 ? '#ef4444' : '#94a3b8', fontWeight: 700 }}
          >
            {Math.max(0, currentHp)} / {ac.maxHp}
          </motion.span>
        </div>
      </div>

      {/* ── Sprite ── */}
      <div style={{ position: 'relative', display: 'inline-block' }}>
        {/* Sparkle particles for shiny entry */}
        {hasSparkle && [0, 1, 2, 3, 4, 5, 6, 7].map(i => (
          <SparkleParticle key={i} index={i} />
        ))}

        <div style={{ display: 'inline-block', ...spriteStyle }}>
          {(() => {
            const src = spriteOverride ?? ac.creature.spriteUrl
            // Illustrated sprites (ash cap, squirtle squad) are large PNGs —
            // render them smaller so they match the scale of pixel art sprites
            const isIllustrated = src.includes('pikachu_ash_cap') || src.includes('squirtle_squad') || src.includes('Charmander_Fuji') || src.includes('Psyduck_Special') || src.includes('jessie-james')
            const isJessieJames = src.includes('jessie-james')
            const illustratedSize = src.includes('Psyduck_Special') ? 220 : isJessieJames ? 260 : 155
            return (
              <img
                src={src}
                alt={`${ac.creature.name} sprite`}
                onError={e => {
                  const img = e.target as HTMLImageElement;
                  if (!img.src.includes('official-artwork') && !img.src.includes('/public/')) {
                    const idMatch = img.src.match(/\/pokemon\/(\d+)\.png/);
                    if (idMatch) {
                      img.src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${idMatch[1]}.png`;
                      img.style.imageRendering = 'auto';
                      img.style.width = '260px';
                      img.style.height = '260px';
                    }
                  }
                }}
                style={{
                  width: isIllustrated ? illustratedSize : 340,
                  height: isIllustrated ? illustratedSize : 340,
                  marginTop: isJessieJames ? -180 : isIllustrated ? 60 : 0,
                  imageRendering: 'pixelated',
                  // Illustrated sprites face right by default — flip logic is inverted vs pixel art
                  transform: isIllustrated
                    ? (isLeft ? 'none' : 'scaleX(-1)')
                    : (isLeft ? 'scaleX(-1)' : 'none'),
                  filter: spriteFilter,
                  transition: koFlashOn ? 'none' : isFlashing ? 'none' : 'filter 0.15s ease',
                  display: 'block',
                  objectFit: 'contain',
                }}
              />
            )
          })()}
        </div>
      </div>


    </div>
  )
}

// ── SPARKLE PARTICLE ────────────────────────────────────────────
const SPARKLE_DIRS = [
  { x: 50, y: -60 }, { x: -50, y: -60 }, { x: 70, y: 0 }, { x: -70, y: 0 },
  { x: 50, y: 60 }, { x: -50, y: 60 }, { x: 0, y: 70 }, { x: 0, y: -70 },
]

function SparkleParticle({ index }: { index: number }) {
  const dir = SPARKLE_DIRS[index % SPARKLE_DIRS.length]
  return (
    <motion.div
      initial={{ opacity: 1, x: 0, y: 0, scale: 1 }}
      animate={{ opacity: 0, x: dir.x, y: dir.y, scale: 0.3 }}
      transition={{ duration: 0.8 + (index * 0.08), delay: index * 0.06, ease: 'easeOut' }}
      style={{
        position: 'absolute',
        top: '50%', left: '50%',
        fontSize: 16,
        pointerEvents: 'none',
        zIndex: 10,
        transform: 'translate(-50%, -50%)',
      }}
    >
      ✨
    </motion.div>
  )
}

// ── HP BAR ──────────────────────────────────────────────────────
function HpBar({ name, currentHp, maxHp, color }: {
  name: string; currentHp: number; maxHp: number; color: string
}) {
  const pct = Math.max(0, Math.min(100, (currentHp / maxHp) * 100))
  const hpColor = pct > 50 ? '#22c55e' : pct > 25 ? '#eab308' : '#ef4444'
  const isCritical = pct <= 25 && pct > 0

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color }}>{name}</span>
        <span style={{ fontSize: 11, color: '#64748b' }}>{Math.max(0, currentHp)} / {maxHp}</span>
      </div>
      <div style={{ height: 8, background: 'rgba(255,255,255,0.1)', borderRadius: 4, overflow: 'hidden' }}>
        <motion.div
          animate={{
            width: `${pct}%`,
            opacity: isCritical ? [0.6, 1, 0.6] : 1,
          }}
          transition={{
            width: { duration: 0.4, ease: 'easeInOut' },
            opacity: isCritical ? { duration: 0.8, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.2 },
          }}
          style={{ height: '100%', background: hpColor, borderRadius: 4 }}
        />
      </div>
    </div>
  )
}

// ── LOG ENTRY COLORS ────────────────────────────────────────────
const LOG_TYPE_COLORS: Record<string, string> = {
  intro: '#7c3aed',
  move: '#94a3b8',
  damage: '#f97316',
  status_damage: '#ef4444',
  ko: '#ef4444',
  swap: '#22c55e',
  critical: '#fbbf24',
  ultimate: '#ec4899',
  shiny: '#fbbf24',
  arena_event: '#67e8f9',
  crowd_roar: '#fbbf24',
  trainer_passive: '#a855f7',
  win: '#fbbf24',
  clutch: '#ef4444',
  arena_telegraph: '#8b5cf6',
  trainer_react: '#fbbf24',
  announcer: '#67e8f9',
}

function LogEntry({ entry, isNew }: { entry: BattleLogEntry; isNew: boolean }) {
  const color = LOG_TYPE_COLORS[entry.type] ?? '#94a3b8'

  // Type-specific extra content
  let prefix = ''
  let extra: React.ReactNode = null
  let extraStyle: React.CSSProperties = {}

  if (entry.type === 'ko') {
    prefix = '💀 '
    extraStyle = { paddingTop: 4, paddingBottom: 4 }
  } else if (entry.type === 'critical') {
    extra = (
      <span style={{
        color: '#fbbf24',
        fontWeight: 800, fontSize: 13,
        marginLeft: 6,
        textShadow: '0 0 8px rgba(251,191,36,0.7)',
      }}>
        ⚡ CRITICAL!
      </span>
    )
  } else if (entry.type === 'ultimate') {
    extra = null
    extraStyle = {
      background: 'linear-gradient(90deg, #f97316, #ec4899, #7c3aed, #3b82f6, #22c55e, #eab308)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      backgroundClip: 'text',
      fontWeight: 800, fontSize: 13,
    }
  } else if (entry.type === 'shiny') {
    extraStyle = {
      color: '#fbbf24',
      fontWeight: 700,
      textShadow: '0 0 8px rgba(251,191,36,0.6)',
    }
  } else if (entry.type === 'win') {
    extraStyle = {
      fontSize: 14, fontWeight: 800,
    }
  }

  return (
    <motion.div
      initial={isNew ? { opacity: 0, x: -10 } : false}
      animate={
        entry.type === 'win'
          ? { opacity: [0.6, 1, 0.6], x: 0 }
          : { opacity: 1, x: 0 }
      }
      transition={
        entry.type === 'win'
          ? { duration: 1.2, repeat: Infinity, ease: 'easeInOut' }
          : { duration: 0.2 }
      }
      style={{
        fontSize: 12,
        color,
        padding: `3px 0`,
        borderLeft: isNew ? `2px solid ${color}` : '2px solid transparent',
        paddingLeft: 8,
        marginBottom: 2,
        ...extraStyle,
      }}
    >
      <span style={entry.type === 'ultimate' ? extraStyle : {}}>
        {prefix}{entry.text}
      </span>
      {extra}
      {entry.commentary && (
        <span style={{ color: '#475569', marginLeft: 8, fontStyle: 'italic', fontSize: 11 }}>
          {entry.commentary}
        </span>
      )}
    </motion.div>
  )
}

// ── GB DIALOGUE BOX ────────────────────────────────────────────
function GbDialogueBubble({ text, dialogueKey }: { text: string; dialogueKey: number }) {
  const [displayed, setDisplayed] = useState('')

  useEffect(() => {
    setDisplayed('')
    let i = 0
    const iv = setInterval(() => {
      i++
      setDisplayed(text.slice(0, i))
      if (i >= text.length) clearInterval(iv)
    }, 28)
    return () => clearInterval(iv)
  }, [dialogueKey, text])

  return (
    <motion.div
      key={dialogueKey}
      initial={{ opacity: 0, scale: 0.9, y: 4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.13 }}
      style={{
        position: 'absolute',
        top: 'calc(100% + 8px)',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 190,
        background: '#f8f8e0',
        border: '3px solid #181818',
        boxShadow: '3px 3px 0 #181818',
        borderRadius: 3,
        padding: '8px 10px 10px',
        pointerEvents: 'none',
        zIndex: 40,
      }}
    >
      {/* Notch pointing up */}
      <div style={{ position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '8px solid transparent', borderRight: '8px solid transparent', borderBottom: '10px solid #181818' }} />
      <div style={{ position: 'absolute', top: -6, left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderBottom: '8px solid #f8f8e0' }} />
      <div style={{
        fontFamily: '"Courier New", "Lucida Console", monospace',
        fontSize: 12, fontWeight: 700, color: '#181818',
        letterSpacing: '0.05em', lineHeight: 1.5,
        minHeight: 18, textAlign: 'center',
      }}>
        {displayed}
        <motion.span animate={{ opacity: [1, 0, 1] }} transition={{ duration: 0.7, repeat: Infinity }} style={{ marginLeft: 2, fontSize: 9 }}>▼</motion.span>
      </div>
    </motion.div>
  )
}



// ── DELAY FUNCTION ──────────────────────────────────────────────
// speed: 1 = normal, 3 = fast. Instant-skip entries (trainer_react, announcer)
// are always 0 regardless of speed. A minimum floor of 80ms is kept at 3x
// so React state updates don't collapse into a single render frame.
const BASE_DELAYS: Record<string, number> = {
  intro:           1000,
  move:            2400,
  damage:          2600,
  critical:        2800,
  ultimate:        5200,
  ko:              2400,
  swap:            1400,
  win:             1000,
  shiny:           1800,
  crowd_roar:       900,
  arena_event:     2800,
  trainer_passive:  900,
  clutch:          1200,
  arena_telegraph: 2000,
  status_damage:   1400,
  // always instant:
  trainer_react:      0,
  announcer:          0,
}

function getDelay(entry: BattleLogEntry, speed: number = 1): number {
  const base = BASE_DELAYS[entry.type] ?? 1000
  if (base === 0) return 0  // instant entries never slow down or speed up
  return Math.max(80, Math.round(base / speed))
}
