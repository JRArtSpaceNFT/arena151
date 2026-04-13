'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '@/lib/game-store'
import { playMusic, resumeAudioContext } from '@/lib/audio/musicEngine'
import { CREATURES } from '@/lib/data/creatures'
import { MOVES } from '@/lib/data/moves'
import type { PokemonType, Creature } from '@/lib/game-types'

// ─── Constants ───────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  normal: '#9ca3af', fire: '#f97316', water: '#3b82f6', electric: '#eab308',
  grass: '#22c55e', ice: '#67e8f9', fighting: '#dc2626', poison: '#a855f7',
  ground: '#a16207', flying: '#818cf8', psychic: '#ec4899', bug: '#84cc16',
  rock: '#78716c', ghost: '#6d28d9', dragon: '#7c3aed', dark: '#374151', steel: '#94a3b8',
}

const ALL_TYPES: PokemonType[] = [
  'normal', 'fire', 'water', 'electric', 'grass', 'ice',
  'fighting', 'poison', 'ground', 'flying', 'psychic', 'bug',
  'rock', 'ghost', 'dragon',
]

const TEAM_SIZE = 5
const BUDGET = 75
const TOTAL_DRAFT_TIME = 120

// ─── CSS keyframes injected once ─────────────────────────────────────────────

const GLOBAL_CSS = `
@media (max-width: 1024px) {
  .draft-root { 
    overflow-y: scroll !important;
    -webkit-overflow-scrolling: touch !important;
    padding-bottom: 140px !important;
    height: 100dvh !important;
    max-height: 100dvh !important;
  }
  .draft-zone2 { 
    flex: 0 0 auto !important; 
    max-height: none !important;
    overflow: visible !important;
    min-height: 0 !important;
  }
  .draft-zone3 { display: none !important; }
  .draft-grid { 
    overflow: visible !important;
    -webkit-overflow-scrolling: touch !important;
    max-height: none !important;
    overscroll-behavior: auto !important;
    min-height: 600px !important;
    padding-bottom: 40px !important;
  }
  .draft-mobile-team { display: flex !important; }
  .draft-battlefield-mobile { display: flex !important; }
  .draft-bottom-battlefield {
    background-image: url('/BD1.png') !important;
    background-size: cover !important;
    background-position: center bottom !important;
    height: 140px !important;
    padding: 16px 8px !important;
  }
  .draft-bottom-pokemon {
    width: 96px !important;
    height: 96px !important;
  }
  .draft-bottom-pokeball {
    width: 24px !important;
    height: 24px !important;
  }
  .draft-bottom-name {
    font-size: 10px !important;
  }
  /* Order overlay: left = pokemon slots, right = confirm button */
  .draft-order-overlay {
    flex-direction: row !important;
    align-items: center !important;
    justify-content: center !important;
    padding: 8px 12px !important;
    gap: 12px !important;
    overflow: hidden !important;
  }
  .draft-order-header { display: none !important; }
  .draft-order-body {
    display: flex !important;
    flex-direction: row !important;
    align-items: center !important;
    gap: 12px !important;
    width: 100% !important;
    justify-content: center !important;
  }
  .draft-order-slots {
    flex-wrap: nowrap !important;
    gap: 6px !important;
    justify-content: flex-start !important;
    padding: 0 !important;
    flex: 1 !important;
    overflow-x: auto !important;
  }
  .draft-order-card { width: 60px !important; height: 60px !important; border-radius: 10px !important; }
  .draft-order-card-sprite { width: 50px !important; height: 50px !important; }
  .draft-order-card-num { font-size: 14px !important; margin-bottom: 2px !important; }
  .draft-order-right {
    display: flex !important;
    flex-direction: column !important;
    align-items: center !important;
    gap: 8px !important;
    flex-shrink: 0 !important;
  }
  .draft-order-confirm {
    margin-top: 0 !important;
    padding: 14px 12px !important;
    font-size: 12px !important;
    white-space: normal !important;
    max-width: 90px !important;
    text-align: center !important;
    line-height: 1.3 !important;
  }
  .draft-order-hint { display: none !important; }
}
@media (max-width: 640px) {
  .draft-root { flex-direction: column !important; }
  .draft-header { flex-wrap: wrap !important; height: auto !important; min-height: 56px !important; padding: 8px 10px !important; gap: 6px !important; }
  .draft-header-title { font-size: 16px !important; }
  .draft-budgets { gap: 4px !important; }
  .draft-budget-card { min-width: 80px !important; padding: 4px 8px !important; }
  .draft-budget-pts { font-size: 16px !important; }
  .draft-zone2 { flex: 0 0 60% !important; }
  .draft-zone3 { flex: 0 0 40% !important; }
  .draft-grid { grid-template-columns: repeat(auto-fill, minmax(72px, 1fr)) !important; }
  .draft-timer { font-size: 18px !important; }
  .draft-lock-btn { font-size: 12px !important; padding: 8px 12px !important; }
}
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes orderSlotPulse {
  0%, 100% { box-shadow: 0 0 10px 2px rgba(251,191,36,0.3); }
  50%       { box-shadow: 0 0 22px 6px rgba(251,191,36,0.6); }
}
@keyframes orderBannerIn {
  from { transform: translateY(30px); opacity: 0; }
  to   { transform: translateY(0);    opacity: 1; }
}
@keyframes orderOverlayIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes orderCardIn {
  from { transform: translateY(60px) scale(0.92); opacity: 0; }
  to   { transform: translateY(0) scale(1); opacity: 1; }
}
@keyframes scanline {
  0%   { background-position: 0 0; }
  100% { background-position: 0 100px; }
}
@keyframes slideInRight {
  from { transform: translateX(100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}
@keyframes pokeballPop {
  0%   { transform: scale(0) rotate(-20deg); opacity: 0; }
  60%  { transform: scale(1.2) rotate(5deg);  opacity: 1; }
  100% { transform: scale(1) rotate(0deg);   opacity: 1; }
}
@keyframes pokemonEnter {
  0%   { transform: scale(0) translateY(20px); opacity: 0; }
  65%  { transform: scale(1.15) translateY(-4px); opacity: 1; }
  100% { transform: scale(1) translateY(0); opacity: 1; }
}
@keyframes shadowPulse {
  0%   { transform: scaleX(0.3); opacity: 0; }
  60%  { transform: scaleX(1.1); opacity: 0.55; }
  100% { transform: scaleX(1); opacity: 0.35; }
}
@keyframes timerPulse {
  0%, 100% { transform: scale(1); }
  50%       { transform: scale(1.18); }
}
@keyframes cloudDrift {
  from { transform: translateX(0); }
  to   { transform: translateX(60px); }
}
@keyframes grassSway {
  0%, 100% { transform: skewX(0deg) scaleY(1); }
  50%       { transform: skewX(1.5deg) scaleY(1.01); }
}
@keyframes glowPulse {
  0%, 100% { box-shadow: 0 0 12px 3px currentColor; }
  50%       { box-shadow: 0 0 24px 8px currentColor; }
}
@keyframes autoPickFlash {
  0%,100% { background: rgba(251,191,36,0.15); }
  50%      { background: rgba(251,191,36,0.35); }
}
@keyframes statFill {
  from { width: 0%; }
  to   { width: var(--pct); }
}
`

// ─── Draft tick audio cue ─────────────────────────────────────────────────────
function playDraftTick(secondsLeft: number) {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    // Pitch and volume rise as urgency increases: 15s→1.0vol/600Hz, 1s→1.5vol/1200Hz
    const urgency = (16 - secondsLeft) / 15  // 0 at 15s, 1 at 1s
    const freq = 600 + urgency * 600
    const gainVal = 0.15 + urgency * 0.25

    const osc = ctx.createOscillator()
    osc.type = 'square'
    osc.frequency.setValueAtTime(freq, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(freq * 1.5, ctx.currentTime + 0.04)

    const gainNode = ctx.createGain()
    gainNode.gain.setValueAtTime(gainVal, ctx.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12)

    osc.connect(gainNode)
    gainNode.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.12)
  } catch (_) {}
}

function injectCSS() {
  if (typeof document === 'undefined') return
  if (document.getElementById('draft-styles')) return
  const s = document.createElement('style')
  s.id = 'draft-styles'
  s.textContent = GLOBAL_CSS
  document.head.appendChild(s)
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Draft() {
  injectCSS()

  const {
    draftTeamA, draftTeamB, draftCurrentPicker,
    draftBudgetA, draftBudgetB, gameMode,
    p1Trainer, p2Trainer,
    draftCreature, removeDraftCreature, proceedFromDraft, confirmVsAiDraft,
    redraftTeam, redraftingPlayer, autoFillDraft, pickAITeamInstantly,
    setDraftTeamOrder,
  } = useGameStore()

  useEffect(() => {
    resumeAudioContext()
    playMusic('menu')
  }, [])

  // vs_ai / practice: AI picks full team instantly at draft mount.
  // paid_pvp / friend_battle: NEVER. P2 team comes from server.
  useEffect(() => {
    if ((gameMode === 'vs_ai' || gameMode === 'practice') && draftTeamB.length === 0) {
      pickAITeamInstantly()
    }
    // paid_pvp and friend_battle: intentionally skip — no AI draft
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [typeFilter, setTypeFilter] = useState<PokemonType | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortByCost, setSortByCost] = useState(false)
  const [timeLeft, setTimeLeft] = useState(TOTAL_DRAFT_TIME)
  const [autoPickFlash, setAutoPickFlash] = useState(false)
  const lastTickSecRef = useRef<number>(-1)
  const [infoCreature, setInfoCreature] = useState<Creature | null>(null)
  const [draftReveal, setDraftReveal] = useState<{ creatureId: number; creatureName: string; trainerName: string } | null>(null)
  const [hoveredId, setHoveredId] = useState<number | null>(null)
  const typeBarRef = useRef<HTMLDivElement>(null)

  // Ordering phase
  const [isOrdering, setIsOrdering] = useState(false)
  const [selectedOrderIdx, setSelectedOrderIdx] = useState<number | null>(null)
  const [orderTimeLeft, setOrderTimeLeft] = useState(30)
  const [showBudgetTooltip, setShowBudgetTooltip] = useState(false)

  const isP1Turn = (gameMode === 'vs_ai' || gameMode === 'practice' || gameMode === 'friend_battle' || gameMode === 'paid_pvp') ? true : draftCurrentPicker === 'p1'
  const myDrafted = new Set(draftTeamA.map(c => c.id))
  const currentBudget = draftBudgetA

  const bothDone = draftTeamA.length >= TEAM_SIZE && draftTeamB.length >= TEAM_SIZE
  const isRedrafting = redraftingPlayer !== null
  const redraftDone = isRedrafting && (
    (redraftingPlayer === 'p1' && draftTeamA.length >= TEAM_SIZE) ||
    (redraftingPlayer === 'p2' && draftTeamB.length >= TEAM_SIZE)
  )

  const filteredCreatures = (() => {
    let list = CREATURES.filter(c => {
      if (typeFilter && !c.types.includes(typeFilter)) return false
      if (searchQuery && !c.name.toLowerCase().includes(searchQuery.toLowerCase())) return false
      return true
    })
    if (sortByCost) list = [...list].sort((a, b) => a.pointCost - b.pointCost)
    return list
  })()

  // Reset timer on picker change
  useEffect(() => {
    if (bothDone) return
    setTimeLeft(TOTAL_DRAFT_TIME)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftCurrentPicker])

  // Countdown + auto-fill + urgency ticks
  useEffect(() => {
    if (bothDone) return
    if (timeLeft <= 0) {
      setAutoPickFlash(true)
      setTimeout(() => {
        autoFillDraft(isP1Turn ? 'p1' : 'p2')
        setAutoPickFlash(false)
      }, 600)
      return
    }
    // Play tick sound in last 15 seconds (once per second, no duplicates)
    if (timeLeft <= 15 && timeLeft !== lastTickSecRef.current) {
      lastTickSecRef.current = timeLeft
      playDraftTick(timeLeft)
    }
    const t = setTimeout(() => setTimeLeft(prev => prev - 1), 1000)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, bothDone])

  const timerColor =
    timeLeft > 60 ? '#22c55e' :
    timeLeft > 20 ? '#eab308' : '#ef4444'

  const timerStr = `${Math.floor(timeLeft / 60)}:${String(timeLeft % 60).padStart(2, '0')}`

  const handleDraftCreature = (creature: Creature) => {
    const trainer = draftCurrentPicker === 'p1' ? p1Trainer : p2Trainer
    setDraftReveal({ creatureId: creature.id, creatureName: creature.name, trainerName: trainer?.name ?? 'Trainer' })
    setTimeout(() => setDraftReveal(null), 1200)
    draftCreature(creature)
  }

  // Trigger ordering phase when team is full
  useEffect(() => {
    if (draftTeamA.length >= TEAM_SIZE && !isRedrafting && !isOrdering) {
      setIsOrdering(true)
      setSelectedOrderIdx(null)
      setOrderTimeLeft(30)
    }
    // Reset ordering if they redo the draft
    if (draftTeamA.length < TEAM_SIZE) {
      setIsOrdering(false)
      setSelectedOrderIdx(null)
      setOrderTimeLeft(30)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftTeamA.length, isRedrafting])

  // 30-second order timer — auto-lock when it hits 0
  useEffect(() => {
    if (!isOrdering) return
    if (orderTimeLeft <= 0) {
      lockInAction()
      return
    }
    const iv = setInterval(() => setOrderTimeLeft(t => t - 1), 1000)
    return () => clearInterval(iv)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOrdering, orderTimeLeft])

  const handleOrderSlotClick = (idx: number) => {
    if (selectedOrderIdx === null) {
      setSelectedOrderIdx(idx)
    } else if (selectedOrderIdx === idx) {
      setSelectedOrderIdx(null)
    } else {
      // Swap
      const newTeam = [...draftTeamA]
      ;[newTeam[selectedOrderIdx], newTeam[idx]] = [newTeam[idx], newTeam[selectedOrderIdx]]
      setDraftTeamOrder(newTeam, 'p1')
      setSelectedOrderIdx(null)
    }
  }

  // paid_pvp / friend_battle: single-player draft — P1 only, no AI team.
  // confirmVsAiDraft handles this path (goes to lineup without generating P2 team).
  const isAiMode = gameMode === 'vs_ai' || gameMode === 'practice' || gameMode === 'friend_battle' || gameMode === 'paid_pvp'
  const canLockIn = isOrdering
    ? true // can always lock in once ordering phase starts
    : isAiMode
    ? draftTeamA.length >= TEAM_SIZE && !isRedrafting
    : bothDone && !isRedrafting
  const lockInAction = isAiMode ? confirmVsAiDraft : proceedFromDraft

  return (
    <>
      {/* ── Root container ── */}
      <div className="draft-root" style={{
        height: '100dvh',
        maxHeight: '100dvh',
        background: '#06060a',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        color: '#e2e8f0',
      }}>

        {/* ══════════════ ZONE 1 — HEADER ══════════════ */}
        <div style={{
          height: 80,
          minHeight: 80,
          background: '#0a0a14',
          borderBottom: '2px solid #1a1a3a',
          display: 'flex',
          alignItems: 'center',
          padding: '0 20px',
          gap: 16,
          boxShadow: '0 2px 24px rgba(0,0,0,0.6)',
          zIndex: 10,
          flexShrink: 0,
        }}>
          {/* Left: Title */}
          <div style={{ flex: '0 0 auto' }}>
            <div style={{
              fontFamily: 'Impact, Arial Black, sans-serif',
              fontSize: 22,
              letterSpacing: '0.12em',
              color: '#f1f5f9',
              lineHeight: 1,
            }}>
              CHOOSE YOUR TEAM
            </div>
            <div style={{ fontSize: 11, color: '#4a5568', letterSpacing: '0.08em', marginTop: 2 }}>
              DRAFT · SEASON {new Date().getFullYear()}
            </div>
          </div>

          {/* Center: Player budgets */}
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}>
            {/* P1 */}
            <div style={{ position: 'relative' }}>
              <div style={{
                background: isP1Turn ? 'rgba(124,58,237,0.18)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${isP1Turn ? '#7c3aed' : '#1e1e3a'}`,
                borderRadius: 10,
                padding: '6px 16px',
                textAlign: 'center',
                minWidth: 120,
                transition: 'all 0.3s',
              }}>
                <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                  {p1Trainer?.name ?? 'Player 1'}
                  {/* Budget info button */}
                  <button
                    onClick={() => setShowBudgetTooltip(v => !v)}
                    style={{
                      width: 14, height: 14, borderRadius: '50%',
                      background: 'rgba(100,116,139,0.35)',
                      border: '1px solid rgba(148,163,184,0.25)',
                      color: '#94a3b8', fontSize: 8, fontWeight: 900,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      lineHeight: 1, padding: 0,
                    }}
                  >ℹ</button>
                </div>
                <div style={{ fontFamily: 'Impact, Arial Black, sans-serif', fontSize: 20, color: '#7c3aed', lineHeight: 1 }}>
                  {draftBudgetA} <span style={{ fontSize: 11, fontFamily: 'system-ui', fontWeight: 400 }}>pts</span>
                </div>
                <div style={{ fontSize: 10, color: '#64748b', marginTop: 1 }}>{draftTeamA.length}/{TEAM_SIZE} picked</div>
              </div>

              {/* Budget tooltip popup */}
              {showBudgetTooltip && (
                <div style={{
                  position: 'absolute',
                  top: '110%',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  zIndex: 9999,
                  width: 240,
                  background: '#0d0d20',
                  border: '1px solid #7c3aed88',
                  borderRadius: 10,
                  padding: '14px 16px',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.8), 0 0 24px rgba(124,58,237,0.3)',
                }}>
                  {/* Close */}
                  <button
                    onClick={() => setShowBudgetTooltip(false)}
                    style={{
                      position: 'absolute', top: 8, right: 10,
                      background: 'none', border: 'none', color: '#64748b',
                      fontSize: 14, cursor: 'pointer', lineHeight: 1, padding: 0,
                    }}
                  >✕</button>
                  {/* Arrow up */}
                  <div style={{
                    position: 'absolute', top: -8, left: '50%', transform: 'translateX(-50%)',
                    width: 0, height: 0,
                    borderLeft: '7px solid transparent', borderRight: '7px solid transparent',
                    borderBottom: '8px solid #7c3aed88',
                  }} />
                  <div style={{ fontSize: 11, fontWeight: 900, color: '#7c3aed', marginBottom: 10, textAlign: 'center', letterSpacing: '0.06em' }}>
                    💰 DRAFT BUDGET
                  </div>
                  {[
                    { icon: '💎', text: `You have ${BUDGET} draft points to spend` },
                    { icon: '⚖️', text: 'Each Pokémon costs 7–25 points based on strength' },
                    { icon: '🎯', text: `Build a team of ${TEAM_SIZE} within your budget` },
                    { icon: '⚡', text: 'Stronger Pokémon cost more — balance power vs. variety' },
                  ].map((item, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 7, alignItems: 'flex-start' }}>
                      <span style={{ fontSize: 13, flexShrink: 0 }}>{item.icon}</span>
                      <span style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.4 }}>{item.text}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* VS divider */}
            <div style={{ color: '#2d2d5e', fontFamily: 'Impact, sans-serif', fontSize: 18, padding: '0 4px' }}>VS</div>

            {/* P2 */}
            <div style={{
              background: !isP1Turn ? 'rgba(239,68,68,0.18)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${!isP1Turn ? '#ef4444' : '#1e1e3a'}`,
              borderRadius: 10,
              padding: '6px 16px',
              textAlign: 'center',
              minWidth: 120,
              transition: 'all 0.3s',
            }}>
              <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 1 }}>{p2Trainer?.name ?? 'Player 2'}</div>
              <div style={{ fontFamily: 'Impact, Arial Black, sans-serif', fontSize: 20, color: '#ef4444', lineHeight: 1 }}>
                {isAiMode ? '?' : draftBudgetB} <span style={{ fontSize: 11, fontFamily: 'system-ui', fontWeight: 400 }}>pts</span>
              </div>
              <div style={{ fontSize: 10, color: '#64748b', marginTop: 1 }}>
                {isAiMode ? 'AI' : `${draftTeamB.length}/${TEAM_SIZE} picked`}
              </div>
            </div>
          </div>

          {/* Right: Count + Timer + Lock In */}
          <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Team count badge */}
            <div style={{
              background: '#12122a',
              border: '1px solid #2d2d5e',
              borderRadius: 8,
              padding: '6px 12px',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 10, color: '#64748b' }}>TEAM</div>
              <div style={{ fontFamily: 'Impact, sans-serif', fontSize: 18, color: '#f1f5f9', lineHeight: 1 }}>
                {draftTeamA.length}
                <span style={{ color: '#2d2d5e' }}>/5</span>
              </div>
            </div>

            {/* Timer */}
            {!bothDone && (
              <div style={{
                background: '#12122a',
                border: `1px solid ${timerColor}55`,
                borderRadius: 8,
                padding: '6px 12px',
                textAlign: 'center',
                animation: autoPickFlash ? 'autoPickFlash 0.4s linear infinite' : 'none',
              }}>
                <div style={{ fontSize: 10, color: '#64748b' }}>TIME</div>
                <div style={{
                  fontFamily: 'Impact, monospace, sans-serif',
                  fontSize: 22,
                  color: timerColor,
                  lineHeight: 1,
                  animation: timeLeft <= 20 && !bothDone ? 'timerPulse 0.6s ease infinite' : 'none',
                }}>
                  {timerStr}
                </div>
              </div>
            )}

            {/* Redo buttons */}
            {bothDone && !isRedrafting && !isAiMode && (
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => redraftTeam('p1')} style={{
                  padding: '6px 10px', background: 'rgba(124,58,237,0.15)',
                  border: '1px solid #7c3aed55', borderRadius: 7,
                  color: '#7c3aed', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                }}>🔄 {p1Trainer?.name ?? 'P1'}</button>
                <button onClick={() => redraftTeam('p2')} style={{
                  padding: '6px 10px', background: 'rgba(239,68,68,0.15)',
                  border: '1px solid #ef444455', borderRadius: 7,
                  color: '#ef4444', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                }}>🔄 {p2Trainer?.name ?? 'P2'}</button>
              </div>
            )}
            {isAiMode && draftTeamA.length >= TEAM_SIZE && !isRedrafting && (
              <button onClick={() => redraftTeam('p1')} style={{
                padding: '6px 10px', background: 'rgba(124,58,237,0.15)',
                border: '1px solid #7c3aed55', borderRadius: 7,
                color: '#7c3aed', fontSize: 11, fontWeight: 700, cursor: 'pointer',
              }}>🔄 Redo</button>
            )}
            {redraftDone && (
              <button onClick={proceedFromDraft} style={{
                padding: '10px 20px', background: 'linear-gradient(135deg,#7c3aed,#5b21b6)',
                border: 'none', borderRadius: 9, color: 'white',
                fontSize: 14, fontWeight: 800, cursor: 'pointer',
                boxShadow: '0 0 16px rgba(124,58,237,0.5)',
              }}>✅ Done Re-drafting →</button>
            )}

            {/* Choose for Me */}
            {!bothDone && (
              <button
                onClick={() => autoFillDraft(isP1Turn ? 'p1' : 'p2')}
                style={{
                  padding: '8px 14px',
                  background: 'rgba(251,191,36,0.1)',
                  border: '1px solid rgba(251,191,36,0.4)',
                  borderRadius: 8,
                  color: '#fbbf24',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                🎲 Auto
              </button>
            )}

            {/* Lock In button — hidden during ordering (overlay has its own) */}
            {!isOrdering && (
              <button
                disabled={!canLockIn}
                onClick={canLockIn ? lockInAction : undefined}
                style={{
                  padding: '10px 20px',
                  background: canLockIn
                    ? 'linear-gradient(135deg, #22c55e, #16a34a)'
                    : '#1a1a2e',
                  border: canLockIn ? 'none' : '1px solid #2d2d5e',
                  borderRadius: 10,
                  color: canLockIn ? 'white' : '#334155',
                  fontSize: 14,
                  fontWeight: 900,
                  cursor: canLockIn ? 'pointer' : 'not-allowed',
                  letterSpacing: '0.04em',
                  boxShadow: canLockIn ? '0 0 20px rgba(34,197,94,0.45)' : 'none',
                  animation: canLockIn ? 'glowPulse 1.5s ease infinite' : 'none',
                  transition: 'all 0.3s',
                  whiteSpace: 'nowrap',
                }}
              >
                LOCK IN TEAM →
              </button>
            )}
          </div>
        </div>

        {/* Mobile team bar — hidden on desktop, visible on mobile */}
        <div className="draft-mobile-team" style={{
          display: 'none',
          alignItems: 'center',
          gap: 6,
          padding: '4px 12px',
          background: '#0a0a14',
          borderBottom: '1px solid #1a1a2e',
          flexShrink: 0,
          overflowX: 'auto',
          minHeight: 52,
        }}>
          <span style={{ fontSize: 9, color: '#475569', letterSpacing: '0.1em', flexShrink: 0, textTransform: 'uppercase' }}>
            TEAM ({draftTeamA.length}/{TEAM_SIZE}):
          </span>
          {draftTeamA.map((c) => (
            <div key={c.id} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0,
            }}>
              <img
                src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${c.id}.png`}
                alt={c.name}
                style={{ width: 32, height: 32, imageRendering: 'pixelated' as const }}
              />
            </div>
          ))}
          {Array.from({ length: TEAM_SIZE - draftTeamA.length }).map((_, i) => (
            <div key={`empty-${i}`} style={{
              width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
              border: '1px dashed rgba(255,255,255,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'rgba(255,255,255,0.15)', fontSize: 14,
            }}>?</div>
          ))}
        </div>

        {/* ══════════════ ZONES 2+3 — BODY ══════════════ */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        }}>

          {/* ══ ZONE 2 — ROSTER (55%) ══ */}
          <div className="draft-zone2" style={{
            flex: '0 0 55%',
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            borderBottom: '2px solid #0f0f1a',
            position: 'relative',
            transition: 'opacity 0.4s',
          }}>
            {/* Filter bar */}
            <div style={{
              padding: '8px 16px',
              background: '#08080f',
              borderBottom: '1px solid #12122a',
              display: 'flex',
              gap: 10,
              alignItems: 'center',
              flexShrink: 0,
            }}>
              {/* Search */}
              <input
                type="text"
                placeholder="🔍 Search..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  background: '#12122a',
                  border: '1px solid #1e1e3a',
                  borderRadius: 8,
                  color: '#e2e8f0',
                  padding: '5px 10px',
                  fontSize: 12,
                  outline: 'none',
                  width: 130,
                  flexShrink: 0,
                }}
              />

              {/* Sort by cost toggle */}
              <button
                onClick={() => setSortByCost(v => !v)}
                style={{
                  background: sortByCost ? '#7c3aed' : '#12122a',
                  border: `1px solid ${sortByCost ? '#7c3aed' : '#1e1e3a'}`,
                  borderRadius: 8,
                  color: sortByCost ? '#fff' : '#94a3b8',
                  padding: '5px 10px',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  flexShrink: 0,
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s',
                }}
                title="Sort by point cost (low to high)"
              >
                {sortByCost ? '💰 Cost ↑' : '💰 Sort'}
              </button>

              {/* Type pills — horizontally scrollable */}
              <div
                ref={typeBarRef}
                style={{
                  display: 'flex',
                  gap: 6,
                  overflowX: 'auto',
                  flex: 1,
                  scrollbarWidth: 'none',
                  paddingBottom: 2,
                }}
              >
                <TypePill label="ALL" active={typeFilter === null} color="#7c3aed" onClick={() => setTypeFilter(null)} />
                {ALL_TYPES.map(t => (
                  <TypePill
                    key={t}
                    label={t}
                    active={typeFilter === t}
                    color={TYPE_COLORS[t] ?? '#666'}
                    onClick={() => setTypeFilter(typeFilter === t ? null : t)}
                  />
                ))}
              </div>
            </div>

            {/* No inline ordering overlay — handled by full-screen overlay below */}

            {/* Card grid — scrollable */}
            <div className="draft-grid" style={{
              flex: 1,
              overflow: 'auto',
              WebkitOverflowScrolling: 'touch',
              overscrollBehavior: 'contain',
              padding: '12px 16px',
              paddingBottom: '24px',
              marginRight: infoCreature ? 320 : 0,
              transition: 'margin-right 0.2s ease',
              minHeight: 0,
            }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))',
                gap: 8,
                alignContent: 'start',
              }}>
                {filteredCreatures.map(creature => {
                  const isDrafted = myDrafted.has(creature.id)
                  const isOverBudget = !isDrafted && creature.pointCost > currentBudget
                  const isRedraftLocked = isRedrafting && (
                    (redraftingPlayer === 'p1' && !isP1Turn) ||
                    (redraftingPlayer === 'p2' && isP1Turn)
                  )
                  const isDisabled = (isOverBudget && !isDrafted) || (bothDone && !isRedrafting) || isRedraftLocked
                  const isHovered = hoveredId === creature.id

                  // Find first type color for border
                  const typeColor = TYPE_COLORS[creature.types[0]] ?? '#7c3aed'

                  return (
                    <div
                      key={creature.id}
                      onMouseEnter={() => !isDisabled && setHoveredId(creature.id)}
                      onMouseLeave={() => setHoveredId(null)}
                      onClick={() => {
                        if (isDisabled) return
                        if (isDrafted) {
                          removeDraftCreature(creature)
                        } else {
                          handleDraftCreature(creature)
                        }
                      }}
                      style={{
                        width: '100%',
                        height: 110,
                        background: isDrafted ? '#0a0a12' : isHovered ? '#1a1a2e' : '#0f0f1a',
                        border: isDrafted
                          ? `2px solid ${typeColor}`
                          : isOverBudget
                          ? '1px solid #3f1515'
                          : isHovered
                          ? `1px solid ${typeColor}aa`
                          : '1px solid #1a1a2e',
                        borderRadius: 8,
                        cursor: isDisabled ? 'not-allowed' : 'pointer',
                        opacity: isDrafted ? 0.7 : isOverBudget ? 0.42 : 1,
                        position: 'relative',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        padding: '6px 4px 4px',
                        transform: isHovered && !isDisabled ? 'translateY(-3px) scale(1.04)' : 'none',
                        boxShadow: isHovered && !isDisabled ? `0 6px 20px ${typeColor}44, 0 2px 8px rgba(0,0,0,0.5)` : '0 1px 4px rgba(0,0,0,0.3)',
                        transition: 'transform 0.15s, box-shadow 0.15s, border-color 0.15s, background 0.15s',
                        overflow: 'hidden',
                        flexShrink: 0,
                      }}
                    >
                      {/* Cost badge — top right */}
                      <div style={{
                        position: 'absolute',
                        top: 4,
                        right: 4,
                        background: creature.pointCost > currentBudget ? 'rgba(239,68,68,0.2)' : 'rgba(251,191,36,0.15)',
                        border: `1px solid ${creature.pointCost > currentBudget ? '#ef444488' : '#fbbf2488'}`,
                        borderRadius: 4,
                        padding: '1px 4px',
                        fontSize: 9,
                        fontWeight: 800,
                        color: creature.pointCost > currentBudget ? '#ef4444' : '#fbbf24',
                        lineHeight: 1.4,
                      }}>
                        {creature.pointCost}
                      </div>

                      {/* Info button — top left */}
                      <button
                        onClick={e => { e.stopPropagation(); setInfoCreature(creature) }}
                        style={{
                          position: 'absolute',
                          top: 4,
                          left: 4,
                          width: 16,
                          height: 16,
                          borderRadius: '50%',
                          background: 'rgba(100,116,139,0.35)',
                          border: '1px solid rgba(148,163,184,0.25)',
                          color: '#94a3b8',
                          fontSize: 9,
                          fontWeight: 900,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          lineHeight: 1,
                          padding: 0,
                          zIndex: 2,
                        }}
                      >ⓘ</button>

                      {/* Sprite */}
                      <div style={{
                        width: 56,
                        height: 56,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginTop: 4,
                        position: 'relative',
                      }}>
                        <img
                          src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${creature.id}.png`}
                          alt={creature.name}
                          onError={e => {
                            const img = e.target as HTMLImageElement;
                            if (!img.src.includes('official-artwork')) {
                              img.src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${creature.id}.png`;
                              img.style.imageRendering = 'auto';
                            }
                          }}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'contain',
                            imageRendering: 'pixelated',
                            filter: isDrafted ? 'brightness(1.2)' : isOverBudget ? 'grayscale(0.8) brightness(0.6)' : 'none',
                          }}
                        />
                        {/* Checkmark overlay for drafted */}
                        {isDrafted && (
                          <div style={{
                            position: 'absolute',
                            inset: 0,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: isHovered ? 'rgba(239,68,68,0.45)' : 'rgba(124,58,237,0.25)',
                            borderRadius: 4,
                            fontSize: isHovered ? 14 : 22,
                            transition: 'background 0.15s',
                          }}>
                            {isHovered ? (
                              <>
                                <span style={{ fontSize: 18 }}>✕</span>
                                <span style={{ fontSize: 8, color: '#fca5a5', fontWeight: 700, marginTop: 2 }}>REMOVE</span>
                              </>
                            ) : '✓'}
                          </div>
                        )}
                        {/* Lock overlay for unaffordable */}
                        {isOverBudget && !isDrafted && (
                          <div style={{
                            position: 'absolute',
                            inset: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 16,
                          }}>🔒</div>
                        )}
                      </div>

                      {/* Name */}
                      <div style={{
                        fontSize: 9,
                        fontWeight: 700,
                        color: '#c7d0dd',
                        textAlign: 'center',
                        lineHeight: 1.2,
                        marginTop: 2,
                        maxWidth: '90%',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {creature.name}
                      </div>

                      {/* Type badges */}
                      <div style={{
                        display: 'flex',
                        gap: 2,
                        marginTop: 3,
                        justifyContent: 'center',
                        flexWrap: 'wrap',
                      }}>
                        {creature.types.map(t => (
                          <span key={t} style={{
                            fontSize: 7,
                            padding: '1px 4px',
                            borderRadius: 4,
                            background: `${TYPE_COLORS[t] ?? '#666'}33`,
                            color: TYPE_COLORS[t] ?? '#aaa',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.03em',
                          }}>
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* ══ ZONE 3 — BATTLEFIELD (45%) ══ */}
          <div className="draft-zone3" style={{
            flex: '0 0 45%',
            minHeight: 0,
            position: 'relative',
            overflow: 'hidden',
          }}>
            {/* Battlefield background image */}
            <img
              src="/BD1.png"
              alt=""
              aria-hidden="true"
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: 'center bottom',
                zIndex: 0,
                pointerEvents: 'none',
              }}
            />
            {/* Subtle dark overlay so Pokémon pop */}
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0,0,0,0.15)',
              zIndex: 1,
              pointerEvents: 'none',
            }} />



            {/* Pokémon lineup or placeholder */}
            <div style={{
              position: 'absolute',
              inset: 0,
              bottom: 12,
              zIndex: 4,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'flex-end',
            }}>
              {draftTeamA.length === 0 ? null : (
                /* ── NORMAL DRAFT MODE: standard lineup ── */
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-end',
                  gap: 0,
                  paddingBottom: 4,
                  paddingLeft: 0,
                  paddingRight: 0,
                  width: '100%',
                  justifyContent: 'space-around',
                }}>
                  {/* Filled slots */}
                  {draftTeamA.map((c, i) => (
                    <BattlefieldPokemon key={c.id} creature={c} index={i} />
                  ))}
                  {/* Empty slots */}
                  {Array.from({ length: TEAM_SIZE - draftTeamA.length }).map((_, i) => (
                    <div key={`empty-${i}`} style={{
                      width: 64,
                      height: 64,
                      border: '2px dashed rgba(255,255,255,0.12)',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'rgba(255,255,255,0.12)',
                      fontSize: 20,
                      flexShrink: 0,
                    }}>?</div>
                  ))}
                </div>
              )}
            </div>

            {/* Player name label */}
            <div style={{
              position: 'absolute',
              top: 10,
              left: 16,
              zIndex: 5,
            }}>
              <div style={{
                background: 'rgba(0,0,0,0.45)',
                border: '1px solid rgba(124,58,237,0.4)',
                borderRadius: 6,
                padding: '4px 10px',
                fontSize: 11,
                fontWeight: 700,
                color: '#b39dfa',
                letterSpacing: '0.06em',
              }}>
                ⚔ {p1Trainer?.name ?? 'YOUR TEAM'}
              </div>
            </div>
          </div>
        </div>

        {/* ══ BOTTOM BATTLEFIELD — Selected Pokemon lineup ══ */}
        <div className="draft-bottom-battlefield" style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          background: 'linear-gradient(to top, rgba(10,10,20,0.98) 0%, rgba(10,10,20,0.95) 100%)',
          borderTop: '2px solid #7c3aed',
          padding: '12px 8px',
          boxShadow: '0 -4px 20px rgba(0,0,0,0.6)',
          overflow: 'hidden',
          backgroundImage: 'url("/BD1.png")',
          backgroundSize: 'cover',
          backgroundPosition: 'center bottom',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
            paddingBottom: '4px',
          }}>
            {draftTeamA.map((creature, idx) => (
              <div key={creature.id} style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                flexShrink: 0,
                position: 'relative',
              }}>
                {/* Pokemon sprite */}
                <img
                  className="draft-bottom-pokemon"
                  src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${creature.id}.png`}
                  alt={creature.name}
                  style={{
                    width: 96,
                    height: 96,
                    imageRendering: 'pixelated' as const,
                    filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.6))',
                  }}
                />
                {/* Pokeball under Pokemon */}
                <div className="draft-bottom-pokeball" style={{
                  marginTop: -12,
                  position: 'relative',
                  zIndex: 2,
                }}>
                  <svg width="24" height="24" viewBox="0 0 22 22">
                    <path d="M2,11 A9,9 0 0,1 20,11 Z" fill="#e53e3e" stroke="#1a1a1a" strokeWidth="1.2"/>
                    <path d="M2,11 A9,9 0 0,0 20,11 Z" fill="#f7f7f7" stroke="#1a1a1a" strokeWidth="1.2"/>
                    <line x1="2" y1="11" x2="20" y2="11" stroke="#1a1a1a" strokeWidth="1.5"/>
                    <circle cx="11" cy="11" r="3.2" fill="#f7f7f7" stroke="#1a1a1a" strokeWidth="1.2"/>
                    <circle cx="11" cy="11" r="1.4" fill={TYPE_COLORS[creature.types[0]] ?? '#7c3aed'} />
                  </svg>
                </div>
                {/* Name */}
                <div className="draft-bottom-name" style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: 'rgba(255,255,255,0.85)',
                  marginTop: 3,
                  textTransform: 'uppercase' as const,
                  letterSpacing: '0.05em',
                  textShadow: '0 1px 3px rgba(0,0,0,0.8)',
                }}>
                  {creature.name}
                </div>
              </div>
            ))}
            {/* Empty slots */}
            {Array.from({ length: TEAM_SIZE - draftTeamA.length }).map((_, i) => (
              <div key={`empty-${i}`} className="draft-bottom-pokemon" style={{
                width: 96,
                height: 96,
                borderRadius: '50%',
                border: '2px dashed rgba(124,58,237,0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'rgba(124,58,237,0.4)',
                fontSize: 32,
                fontWeight: 300,
                flexShrink: 0,
              }}>?</div>
            ))}
          </div>
        </div>
      </div>

      {/* ── FULL-SCREEN BATTLE ORDER OVERLAY ── */}
      {isOrdering && (
        <div className="draft-order-overlay" style={{
          position: 'fixed',
          inset: 0,
          zIndex: 200,
          background: 'rgba(0,0,0,0.93)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'orderOverlayIn 0.35s ease forwards',
          overflowY: 'auto',
          padding: '40px 20px',
        }}>
          {/* Scanline texture */}
          <div style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,255,255,0.018) 3px, rgba(255,255,255,0.018) 4px)',
            pointerEvents: 'none',
          }} />



          {/* Header */}
          <div className="draft-order-header" style={{
            textAlign: 'center',
            marginBottom: 12,
            animation: 'orderCardIn 0.4s cubic-bezier(0.22,1,0.36,1) 0.05s both',
          }}>
            <div style={{
              fontFamily: 'Impact, Arial Black, sans-serif',
              fontSize: 13,
              letterSpacing: '0.3em',
              color: '#fbbf24',
              textTransform: 'uppercase',
              marginBottom: 6,
            }}>Set Your Battle Order</div>
            <div style={{
              fontFamily: 'Impact, Arial Black, sans-serif',
              fontSize: 38,
              letterSpacing: '0.06em',
              color: '#f1f5f9',
              lineHeight: 1,
              textShadow: '0 0 40px rgba(251,191,36,0.4)',
            }}>WHO GOES FIRST?</div>

            {/* 30-second countdown */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              marginTop: 10,
              padding: '4px 16px', borderRadius: 20,
              background: orderTimeLeft <= 10 ? 'rgba(239,68,68,0.15)' : 'rgba(251,191,36,0.1)',
              border: `1px solid ${orderTimeLeft <= 10 ? 'rgba(239,68,68,0.4)' : 'rgba(251,191,36,0.3)'}`,
              transition: 'all 0.3s',
            }}>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>⏱</span>
              <span style={{
                fontFamily: 'monospace', fontSize: 18, fontWeight: 900,
                color: orderTimeLeft <= 10 ? '#ef4444' : '#fbbf24',
                animation: orderTimeLeft <= 10 ? 'timerPulse 0.6s ease infinite' : 'none',
              }}>{orderTimeLeft}s</span>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', fontWeight: 600 }}>to lock in</span>
            </div>

            <div style={{
              marginTop: 8,
              fontSize: 13,
              color: selectedOrderIdx !== null ? '#fbbf24' : '#64748b',
              fontWeight: 600,
              transition: 'color 0.2s',
            }}>
              {selectedOrderIdx !== null
                ? `Slot ${selectedOrderIdx + 1} selected — tap another to swap positions`
                : 'Tap a Pokémon to select it · Tap another to swap · Use arrows to nudge'}
            </div>
          </div>

          {/* Body: slots left + confirm right on mobile */}
          <div className="draft-order-body" style={{ display: 'contents' }}>
          {/* Pokemon order slots */}
          <div className="draft-order-slots" style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 16,
            padding: '0 24px',
            animation: 'orderCardIn 0.45s cubic-bezier(0.22,1,0.36,1) 0.12s both',
          }}>
            {draftTeamA.map((c, i) => {
              const isSelected = selectedOrderIdx === i
              const typeColor = TYPE_COLORS[c.types[0]] ?? '#7c3aed'
              const positionLabels = ['1ST', '2ND', '3RD', '4TH', '5TH']
              const positionColors = ['#22c55e', '#3b82f6', '#f97316', '#a855f7', '#ef4444']
              return (
                <div
                  key={c.id}
                  onClick={() => handleOrderSlotClick(i)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    cursor: 'pointer',
                    position: 'relative',
                    flexShrink: 0,
                  }}
                >
                  {/* Position number — big */}
                  <div className="draft-order-card-num" style={{
                    fontFamily: 'Impact, Arial Black, sans-serif',
                    fontSize: 32,
                    lineHeight: 1,
                    color: isSelected ? '#fbbf24' : positionColors[i],
                    textShadow: isSelected ? '0 0 20px rgba(251,191,36,0.8)' : `0 0 12px ${positionColors[i]}88`,
                    marginBottom: 6,
                    transition: 'all 0.15s',
                  }}>{i + 1}</div>

                  {/* Sprite card */}
                  <div className="draft-order-card" style={{
                    position: 'relative',
                    width: 140,
                    height: 140,
                    borderRadius: 16,
                    background: isSelected
                      ? `radial-gradient(circle at center, ${typeColor}40 0%, #0a0a14 100%)`
                      : 'rgba(255,255,255,0.04)',
                    border: `2px solid ${isSelected ? typeColor : 'rgba(255,255,255,0.12)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.15s',
                    animation: isSelected ? 'orderSlotPulse 1s ease infinite' : 'none',
                    transform: isSelected ? 'scale(1.08) translateY(-6px)' : 'scale(1)',
                    boxShadow: isSelected
                      ? `0 0 30px 6px ${typeColor}55, 0 8px 24px rgba(0,0,0,0.6)`
                      : '0 4px 16px rgba(0,0,0,0.4)',
                  }}>
                    <img
                      className="draft-order-card-sprite"
                      src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${c.id}.png`}
                      alt={c.name}
                      style={{
                        width: 110,
                        height: 110,
                        imageRendering: 'pixelated',
                        objectFit: 'contain',
                        filter: isSelected
                          ? `drop-shadow(0 0 12px ${typeColor}) brightness(1.15)`
                          : 'brightness(0.9)',
                        transition: 'filter 0.15s',
                      }}
                    />
                    {/* Selected checkmark */}
                    {isSelected && (
                      <div style={{
                        position: 'absolute',
                        top: 6,
                        right: 6,
                        width: 22,
                        height: 22,
                        borderRadius: '50%',
                        background: '#fbbf24',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 12,
                        fontWeight: 900,
                        color: '#000',
                        boxShadow: '0 0 8px rgba(251,191,36,0.8)',
                      }}>✓</div>
                    )}
                  </div>

                  {/* Badge label */}
                  <div style={{
                    marginTop: 8,
                    background: isSelected ? '#fbbf24' : positionColors[i] + '22',
                    border: `1px solid ${isSelected ? '#fbbf24' : positionColors[i] + '55'}`,
                    borderRadius: 5,
                    padding: '3px 12px',
                    fontSize: 10,
                    fontWeight: 900,
                    color: isSelected ? '#000' : positionColors[i],
                    letterSpacing: '0.12em',
                    transition: 'all 0.15s',
                  }}>
                    {positionLabels[i]}
                  </div>

                  {/* Name */}
                  <div style={{
                    marginTop: 5,
                    fontSize: 11,
                    fontWeight: 700,
                    color: isSelected ? '#f1f5f9' : '#64748b',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    transition: 'color 0.15s',
                  }}>
                    {c.name}
                  </div>

                  {/* Arrow nudge buttons */}
                  <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                    <button
                      disabled={i === 0}
                      onClick={e => {
                        e.stopPropagation()
                        const newTeam = [...draftTeamA]
                        ;[newTeam[i - 1], newTeam[i]] = [newTeam[i], newTeam[i - 1]]
                        setDraftTeamOrder(newTeam, 'p1')
                        setSelectedOrderIdx(null)
                      }}
                      style={{
                        background: i === 0 ? 'transparent' : 'rgba(255,255,255,0.06)',
                        border: `1px solid ${i === 0 ? 'transparent' : 'rgba(255,255,255,0.15)'}`,
                        borderRadius: 6,
                        color: i === 0 ? 'transparent' : '#94a3b8',
                        fontSize: 12,
                        cursor: i === 0 ? 'default' : 'pointer',
                        padding: '4px 10px',
                        lineHeight: 1,
                        transition: 'all 0.1s',
                      }}
                    >◀</button>
                    <button
                      disabled={i === draftTeamA.length - 1}
                      onClick={e => {
                        e.stopPropagation()
                        const newTeam = [...draftTeamA]
                        ;[newTeam[i], newTeam[i + 1]] = [newTeam[i + 1], newTeam[i]]
                        setDraftTeamOrder(newTeam, 'p1')
                        setSelectedOrderIdx(null)
                      }}
                      style={{
                        background: i === draftTeamA.length - 1 ? 'transparent' : 'rgba(255,255,255,0.06)',
                        border: `1px solid ${i === draftTeamA.length - 1 ? 'transparent' : 'rgba(255,255,255,0.15)'}`,
                        borderRadius: 6,
                        color: i === draftTeamA.length - 1 ? 'transparent' : '#94a3b8',
                        fontSize: 12,
                        cursor: i === draftTeamA.length - 1 ? 'default' : 'pointer',
                        padding: '4px 10px',
                        lineHeight: 1,
                        transition: 'all 0.1s',
                      }}
                    >▶</button>
                  </div>
                </div>
              )
            })}
          </div>

          </div>{/* end draft-order-body */}

          {/* Direction hint */}
          <div className="draft-order-hint" style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginTop: 20,
            animation: 'orderCardIn 0.5s cubic-bezier(0.22,1,0.36,1) 0.2s both',
          }}>
            <div style={{ color: '#22c55e', fontSize: 11, fontWeight: 700 }}>⚔ FIRST STRIKE</div>
            <div style={{
              flex: 1,
              height: 1,
              width: 300,
              background: 'linear-gradient(90deg, #22c55e55, #ef444455)',
            }} />
            <div style={{ color: '#ef4444', fontSize: 11, fontWeight: 700 }}>FINAL STAND ⚔</div>
          </div>

          {/* Confirm button */}
          <button
            className="draft-order-confirm"
            onClick={lockInAction}
            style={{
              marginTop: 28,
              padding: '14px 48px',
              background: 'linear-gradient(135deg, #fbbf24, #d97706)',
              border: 'none',
              borderRadius: 12,
              color: '#000',
              fontSize: 16,
              fontWeight: 900,
              cursor: 'pointer',
              letterSpacing: '0.08em',
              boxShadow: '0 0 32px rgba(251,191,36,0.55), 0 4px 16px rgba(0,0,0,0.5)',
              animation: 'orderCardIn 0.5s cubic-bezier(0.22,1,0.36,1) 0.25s both, glowPulse 2s ease infinite 0.75s',
              transition: 'transform 0.1s',
            }}
            onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.04)')}
            onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
          >
            LOCK IN ORDER — LET'S BATTLE
          </button>
        </div>
      )}

      {/* ── Draft Pick Reveal Overlay ── */}
      {draftReveal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 100,
          background: 'rgba(0,0,0,0.8)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
          animation: 'fadeIn 0.1s ease forwards',
        }}>
          <img
            src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${draftReveal.creatureId}.png`}
            alt={draftReveal.creatureName}
            style={{
              width: 192,
              height: 192,
              imageRendering: 'pixelated',
              animation: 'pokeballPop 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards',
              filter: 'drop-shadow(0 0 30px rgba(255,255,255,0.6))',
            }}
          />
          <div style={{
            fontSize: 26,
            fontWeight: 900,
            color: '#fff',
            textShadow: '0 0 20px rgba(255,255,255,0.5)',
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            marginTop: 8,
            fontFamily: 'Impact, Arial Black, sans-serif',
            animation: 'fadeIn 0.2s ease 0.15s both',
          }}>
            {draftReveal.trainerName} chose {draftReveal.creatureName}!
          </div>
        </div>
      )}

      {/* ── Info Panel (slide in from right) ── */}
      {infoCreature && (
        <div
          onClick={() => setInfoCreature(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            zIndex: 9000,
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'stretch',
            justifyContent: 'flex-end',
            animation: 'fadeIn 0.15s ease forwards',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: 320,
              background: '#0d0d20',
              borderLeft: `3px solid ${TYPE_COLORS[infoCreature.types[0]] ?? '#7c3aed'}`,
              padding: '24px 20px',
              overflowY: 'auto',
              animation: 'slideInRight 0.2s cubic-bezier(0.22,1,0.36,1) forwards',
              boxShadow: `-8px 0 48px rgba(0,0,0,0.8), 0 0 60px ${TYPE_COLORS[infoCreature.types[0]] ?? '#7c3aed'}33`,
            }}
          >
            {/* Close */}
            <button
              onClick={() => setInfoCreature(null)}
              style={{
                position: 'absolute',
                top: 14,
                right: 16,
                background: 'none',
                border: 'none',
                color: '#64748b',
                fontSize: 20,
                cursor: 'pointer',
                lineHeight: 1,
              }}
            >✕</button>

            {/* Big sprite */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
              <img
                src={infoCreature.spriteUrl}
                alt={infoCreature.name}
                style={{
                  width: 160,
                  height: 160,
                  imageRendering: 'pixelated',
                  objectFit: 'contain',
                  objectPosition: 'center',
                  marginLeft: 24,
                  filter: `drop-shadow(0 0 16px ${TYPE_COLORS[infoCreature.types[0]] ?? '#7c3aed'}88)`,
                }}
              />
            </div>

            {/* Name + types */}
            <div style={{ textAlign: 'center', marginBottom: 18 }}>
              <div style={{
                fontFamily: 'Impact, Arial Black, sans-serif',
                fontSize: 24,
                color: '#f1f5f9',
                marginBottom: 8,
                letterSpacing: '0.06em',
              }}>
                {infoCreature.name.toUpperCase()}
              </div>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                {infoCreature.types.map(t => (
                  <span key={t} style={{
                    fontSize: 11,
                    padding: '3px 10px',
                    borderRadius: 10,
                    background: `${TYPE_COLORS[t] ?? '#666'}33`,
                    color: TYPE_COLORS[t] ?? '#aaa',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    border: `1px solid ${TYPE_COLORS[t] ?? '#666'}55`,
                  }}>{t}</span>
                ))}
              </div>
              <div style={{
                marginTop: 10,
                fontSize: 16,
                fontWeight: 800,
                color: '#fbbf24',
              }}>
                {infoCreature.pointCost} pts
              </div>
            </div>

            {/* Stats */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 10, color: '#475569', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                BASE STATS
              </div>
              {[
                { label: 'HP',  value: infoCreature.baseHp,  max: 106, color: '#22c55e' },
                { label: 'ATK', value: infoCreature.baseAtk, max: 134, color: '#f97316' },
                { label: 'DEF', value: infoCreature.baseDef, max: 130, color: '#3b82f6' },
                { label: 'SPE', value: infoCreature.baseSpe, max: 130, color: '#a855f7' },
              ].map(stat => {
                const pct = Math.min(100, (stat.value / stat.max) * 100)
                return (
                  <div key={stat.label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
                    <div style={{ width: 36, fontSize: 10, color: '#94a3b8', fontWeight: 700 }}>{stat.label}</div>
                    <div style={{
                      flex: 1,
                      height: 7,
                      background: 'rgba(255,255,255,0.06)',
                      borderRadius: 4,
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        height: '100%',
                        width: `${pct}%`,
                        background: stat.color,
                        borderRadius: 4,
                        boxShadow: `0 0 6px ${stat.color}88`,
                        transition: 'width 0.5s ease',
                      }} />
                    </div>
                    <div style={{ width: 28, fontSize: 11, color: '#e2e8f0', fontWeight: 700, textAlign: 'right' }}>
                      {stat.value}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Moves */}
            <div>
              <div style={{ fontSize: 10, color: '#475569', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                MOVE POOL
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {infoCreature.movePool.map(moveId => {
                  const move = MOVES.find(m => m.id === moveId)
                  if (!move) return null
                  const tc = TYPE_COLORS[move.type] ?? '#9ca3af'
                  return (
                    <div key={moveId} style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'rgba(255,255,255,0.03)',
                      borderRadius: 8,
                      padding: '6px 10px',
                      border: `1px solid ${tc}22`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <span style={{
                          fontSize: 8,
                          padding: '2px 6px',
                          borderRadius: 5,
                          background: `${tc}33`,
                          color: tc,
                          fontWeight: 700,
                          textTransform: 'uppercase',
                        }}>{move.type}</span>
                        <span style={{ fontSize: 12, color: '#e2e8f0', fontWeight: 600 }}>{move.name}</span>
                        {(move as { ultimateFlag?: boolean }).ultimateFlag && (
                          <span style={{ fontSize: 8, color: '#fbbf24', fontWeight: 800 }}>★ ULT</span>
                        )}
                      </div>
                      <span style={{ fontSize: 11, color: move.power > 0 ? '#f97316' : '#64748b', fontWeight: 700 }}>
                        {move.power > 0 ? `${move.power}` : 'STATUS'}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TypePill({ label, active, color, onClick }: {
  label: string; active: boolean; color: string; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '4px 10px',
        background: active ? color : `${color}22`,
        border: `1px solid ${active ? color : `${color}55`}`,
        borderRadius: 20,
        color: active ? '#fff' : '#c7d0dd',
        fontSize: 10,
        cursor: 'pointer',
        fontWeight: active ? 800 : 500,
        textTransform: 'capitalize' as const,
        letterSpacing: '0.04em',
        whiteSpace: 'nowrap' as const,
        boxShadow: active ? `0 0 8px ${color}66` : 'none',
        flexShrink: 0,
        transition: 'all 0.15s',
      }}
    >
      {label}
    </button>
  )
}

function BattlefieldPokemon({ creature, index }: { creature: Creature; index: number }) {
  const typeColor = TYPE_COLORS[creature.types[0]] ?? '#7c3aed'
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        flexShrink: 0,
        animation: `pokemonEnter 0.45s cubic-bezier(0.34,1.56,0.64,1) ${index * 0.1}s both`,
        position: 'relative',
      }}
    >
      {/* Pokémon sprite — big, no drop shadow */}
      <img
        src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${creature.id}.png`}
        alt={creature.name}
        style={{
          width: 360,
          height: 360,
          imageRendering: 'pixelated' as const,
          objectFit: 'contain',
        }}
      />
      {/* Pokéball on the ground */}
      <div style={{
        position: 'relative',
        marginTop: -16,
        zIndex: 2,
      }}>
        {/* Pokéball SVG */}
        <svg width="44" height="44" viewBox="0 0 22 22" style={{ display: 'block' }}>
          {/* Top half — red */}
          <path d="M2,11 A9,9 0 0,1 20,11 Z" fill="#e53e3e" stroke="#1a1a1a" strokeWidth="1.2"/>
          {/* Bottom half — white */}
          <path d="M2,11 A9,9 0 0,0 20,11 Z" fill="#f7f7f7" stroke="#1a1a1a" strokeWidth="1.2"/>
          {/* Center line */}
          <line x1="2" y1="11" x2="20" y2="11" stroke="#1a1a1a" strokeWidth="1.5"/>
          {/* Center circle outer */}
          <circle cx="11" cy="11" r="3.2" fill="#f7f7f7" stroke="#1a1a1a" strokeWidth="1.2"/>
          {/* Center circle inner */}
          <circle cx="11" cy="11" r="1.4" fill={typeColor} />
        </svg>
      </div>
      {/* Name label */}
      <div style={{
        fontSize: 18,
        fontWeight: 700,
        color: 'rgba(255,255,255,0.85)',
        marginTop: 6,
        letterSpacing: '0.05em',
        textShadow: '0 2px 8px rgba(0,0,0,0.9)',
        textTransform: 'uppercase' as const,
      }}>
        {creature.name}
      </div>
    </div>
  )
}

function PixelCloud() {
  return (
    <div style={{ position: 'relative', width: 80, height: 30 }}>
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 10,
        right: 10,
        height: 14,
        background: 'rgba(200,210,255,0.9)',
        borderRadius: 3,
      }} />
      <div style={{
        position: 'absolute',
        bottom: 10,
        left: 20,
        width: 24,
        height: 18,
        background: 'rgba(200,210,255,0.9)',
        borderRadius: 3,
      }} />
      <div style={{
        position: 'absolute',
        bottom: 10,
        left: 36,
        width: 18,
        height: 14,
        background: 'rgba(200,210,255,0.9)',
        borderRadius: 3,
      }} />
    </div>
  )
}
