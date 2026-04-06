'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '@/lib/game-store'
import { playMusic, resumeAudioContext } from '@/lib/audio/musicEngine'
import { TRAINERS } from '@/lib/data/trainers'
import type { Trainer } from '@/lib/game-types'

// ── Dossier metadata ──────────────────────────────────────────────────────────
const DOSSIER: Record<string, {
  title: string
  location: string
  battleStyles: string[]
  signaturePokemon: number[]
}> = {
  red:         { title: 'Silent Champion',       location: 'Mt. Silver',         battleStyles: ['🏆 All-Rounder', '⚡ Speed Finisher', '🎯 Crit Specialist'], signaturePokemon: [6, 25, 143] },
  ash:         { title: 'Pokémon Trainer',        location: 'Pallet Town',        battleStyles: ['❤️ Heart Fighter', '🔥 Never Give Up', '💥 Comeback King'], signaturePokemon: [25, 6, 12] },
  gary:        { title: 'Rival Extraordinaire',   location: 'Pallet Town',        battleStyles: ['🧠 Tactical Mind', '📈 Momentum Play', '😏 Pressure Dealer'], signaturePokemon: [130, 103, 59] },
  oak:         { title: 'Pokémon Professor',      location: 'Pallet Town Lab',    battleStyles: ['🔬 Precision Play', '📊 Data Driven', '🎯 High Accuracy'], signaturePokemon: [7, 4, 1] },
  brock:       { title: 'Rock Gym Leader',        location: 'Pewter City',        battleStyles: ['🪨 Rock Specialist', '🛡️ Defense Trainer', '💥 Heavy Hitters'], signaturePokemon: [76, 95, 112] },
  misty:       { title: 'Water Gym Leader',       location: 'Cerulean City',      battleStyles: ['💧 Water Specialist', '⚡ Speed Trainer', '🧠 Tactical Control'], signaturePokemon: [121, 54, 131] },
  surge:       { title: 'Electric Gym Leader',    location: 'Vermilion City',     battleStyles: ['⚡ Electric Specialist', '💨 Speed Striker', '🪖 Military Tactics'], signaturePokemon: [26, 125, 101] },
  erika:       { title: 'Grass Gym Leader',       location: 'Celadon City',       battleStyles: ['🌿 Grass Specialist', '😴 Status Maestro', '♻️ Sustain Build'], signaturePokemon: [45, 71, 103] },
  koga:        { title: 'Poison Gym Leader',      location: 'Fuchsia City',       battleStyles: ['☠️ Poison Master', '🥷 Ninja Tactics', '🕐 Attrition Fighter'], signaturePokemon: [89, 110, 49] },
  sabrina:     { title: 'Psychic Gym Leader',     location: 'Saffron City',       battleStyles: ['🔮 Psychic Specialist', '🧠 Mind Games', '🎭 Utility Heavy'], signaturePokemon: [65, 97, 94] },
  blaine:      { title: 'Fire Gym Leader',        location: 'Cinnabar Island',    battleStyles: ['🔥 Fire Specialist', '💥 Signature Power', '🌋 All-In Aggro'], signaturePokemon: [59, 78, 126] },
  giovanni:    { title: 'Team Rocket Boss',       location: 'Viridian City',      battleStyles: ['🌍 Ground Commander', '💢 First-Strike Boss', '🕴️ Power Flex'], signaturePokemon: [112, 51, 53] },
  lorelei:     { title: 'Elite Four — Ice',       location: 'Indigo Plateau',     battleStyles: ['🧊 Ice & Water Hybrid', '🛡️ Arena Defense', '❄️ Freeze Control'], signaturePokemon: [131, 87, 124] },
  bruno:       { title: 'Elite Four — Fighting',  location: 'Indigo Plateau',     battleStyles: ['👊 Fighting Specialist', '💥 Crit Dealer', '🏋️ Pure Power'], signaturePokemon: [68, 107, 95] },
  agatha:      { title: 'Elite Four — Ghost',     location: 'Indigo Plateau',     battleStyles: ['👻 Ghost Specialist', '☠️ Poison Tricks', '🕯️ Hex Master'], signaturePokemon: [94, 93, 110] },
  fuji:        { title: 'Keeper of Lavender Town', location: 'Lavender Town',    battleStyles: ['👻 Ghost Warden', '🔮 Psychic Anchor', '🕊️ Calm Control'], signaturePokemon: [104, 113, 147] },
  'jessie-james': { title: 'Team Rocket Duo',    location: 'Everywhere',         battleStyles: ['😈 Spite Comeback', '🎭 Chaos Agents', '🐱 Meowth Approved'], signaturePokemon: [52, 110, 24] },
  lance:       { title: 'Dragon Master',          location: 'Dragon\'s Den',      battleStyles: ['🐉 Dragon Specialist', '🦅 Flying Force', '⚡ Speed + Power'], signaturePokemon: [149, 148, 142] },
}

// ── Crowd cheer SFX ───────────────────────────────────────────────────────────
function playCrowdCheer() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const duration = 1.2
    const bufferSize = ctx.sampleRate * duration
    const buffer = ctx.createBuffer(2, bufferSize, ctx.sampleRate)
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch)
      for (let i = 0; i < bufferSize; i++) {
        const env = i < bufferSize * 0.1
          ? i / (bufferSize * 0.1)
          : i > bufferSize * 0.7
            ? 1 - (i - bufferSize * 0.7) / (bufferSize * 0.3)
            : 1
        data[i] = (Math.random() * 2 - 1) * env * 0.18
      }
    }
    const source = ctx.createBufferSource()
    source.buffer = buffer
    // Band-pass to make it sound crowd-like
    const bp1 = ctx.createBiquadFilter(); bp1.type = 'bandpass'; bp1.frequency.value = 800; bp1.Q.value = 0.5
    const bp2 = ctx.createBiquadFilter(); bp2.type = 'bandpass'; bp2.frequency.value = 2200; bp2.Q.value = 0.8
    const gain = ctx.createGain(); gain.gain.value = 1.8
    source.connect(bp1); bp1.connect(gain)
    source.connect(bp2); bp2.connect(gain)
    gain.connect(ctx.destination)
    source.start()
    source.stop(ctx.currentTime + duration)
  } catch (_) {}
}

// ── Side card (non-center, minimal) with ability tooltip ─────────────────────
function SideCard({ trainer }: { trainer: Trainer }) {
  const [imgError, setImgError] = useState(false)
  const [showTooltip, setShowTooltip] = useState(false)
  const abilityPct = Math.min(100, Math.round(trainer.ability.value * 100))
  return (
    <div
      style={{ position: 'relative' }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div style={{
        background: '#111120',
        border: `1px solid ${showTooltip ? trainer.color + '88' : trainer.color + '33'}`,
        borderRadius: 12,
        padding: '12px 10px',
        textAlign: 'center',
        width: 130,
        overflow: 'hidden',
        transition: 'border-color 0.2s',
        cursor: 'default',
      }}>
        <div style={{
          width: 80, height: 90,
          margin: '0 auto 6px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {!imgError && trainer.spriteUrl ? (
            <img
              src={trainer.spriteUrl}
              alt={trainer.name}
              onError={() => setImgError(true)}
              style={{
                width: '100%', height: '100%',
                objectFit: 'contain',
                imageRendering: trainer.id === 'jessie-james' ? 'auto' : 'pixelated',
                opacity: 0.7,
              }}
            />
          ) : (
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: `${trainer.color}22`, border: `2px solid ${trainer.color}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 26, fontWeight: 900, color: trainer.color,
            }}>
              {trainer.name[0]}
            </div>
          )}
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: `${trainer.color}cc` }}>
          {trainer.name}
        </div>
        <div style={{ fontSize: 9, color: `${trainer.color}88`, marginTop: 3, fontStyle: 'italic' }}>
          ⚡ {trainer.ability.name}
        </div>
      </div>

      {/* Ability tooltip popup */}
      {showTooltip && (
        <div style={{
          position: 'absolute',
          bottom: '105%',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 999,
          width: 210,
          background: '#0d0d20',
          border: `2px solid ${trainer.color}88`,
          borderRadius: 10,
          padding: '12px 14px',
          boxShadow: `0 -4px 24px ${trainer.color}44, 0 8px 24px rgba(0,0,0,0.8)`,
          pointerEvents: 'none',
          fontFamily: '"Courier New", Courier, monospace',
        }}>
          {/* Arrow */}
          <div style={{
            position: 'absolute', bottom: -9, left: '50%', transform: 'translateX(-50%)',
            width: 0, height: 0,
            borderLeft: '8px solid transparent', borderRight: '8px solid transparent',
            borderTop: `9px solid ${trainer.color}88`,
          }} />
          <div style={{
            fontSize: 9, letterSpacing: '0.2em', color: `${trainer.color}88`,
            textTransform: 'uppercase', marginBottom: 6, textAlign: 'center',
          }}>⚡ ABILITY</div>
          <div style={{ fontSize: 13, fontWeight: 900, color: trainer.color, marginBottom: 4, textAlign: 'center' }}>
            {trainer.ability.name}
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.4, marginBottom: 8, textAlign: 'center' }}>
            {trainer.ability.description}
          </div>
          {/* Value bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ fontSize: 9, color: '#64748b', whiteSpace: 'nowrap' }}>BONUS</div>
            <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${abilityPct * 5}%`,
                background: trainer.color,
                borderRadius: 3,
                boxShadow: `0 0 6px ${trainer.color}`,
                maxWidth: '100%',
              }} />
            </div>
            <div style={{ fontSize: 10, color: trainer.color, fontWeight: 800, whiteSpace: 'nowrap' }}>
              +{abilityPct}%
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main dossier card — two-column layout: big sprite left, info right ────────
function DossierCard({ trainer, isTaken }: { trainer: Trainer; isTaken: boolean }) {
  const [imgError, setImgError] = useState(false)
  const dossier = DOSSIER[trainer.id] ?? {
    title: 'Trainer',
    location: 'Unknown',
    battleStyles: ['⚔️ Balanced'],
    signaturePokemon: [],
  }
  const abilityPct = Math.min(20, Math.round(trainer.ability.value * 100))

  return (
    <div style={{
      background: '#0a0a1a',
      border: `2px solid ${trainer.color}66`,
      borderRadius: 6,
      width: 440,
      overflow: 'hidden',
      boxShadow: `0 0 48px ${trainer.color}2a, inset 0 0 60px rgba(0,0,0,0.6)`,
      position: 'relative',
      fontFamily: "'Courier New', Courier, monospace",
    }}>

      {/* Top accent bar */}
      <div style={{ height: 3, background: `linear-gradient(90deg, transparent, ${trainer.color}, transparent)` }} />

      {/* TAKEN overlay */}
      {isTaken && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 20,
          background: 'rgba(0,0,0,0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(3px)',
        }}>
          <div style={{
            background: '#7c3aed', borderRadius: 8,
            padding: '10px 28px', fontSize: 20, fontWeight: 900,
            color: 'white', letterSpacing: '0.15em',
            boxShadow: '0 0 24px rgba(124,58,237,0.9)',
          }}>TAKEN</div>
        </div>
      )}

      {/* ── HEADER: dossier label + name + subtitle ── */}
      <div style={{
        padding: '8px 16px 6px',
        background: `linear-gradient(135deg, ${trainer.color}18 0%, transparent 70%)`,
        borderBottom: `1px solid ${trainer.color}22`,
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 8, letterSpacing: '0.3em', color: `${trainer.color}66`, textTransform: 'uppercase', marginBottom: 3 }}>
          ── TRAINER DOSSIER ──
        </div>
        <div style={{
          fontFamily: 'Impact, Arial Black, sans-serif',
          fontSize: 'clamp(32px, 4.8vh, 54px)',
          fontWeight: 900, color: trainer.color,
          lineHeight: 1, letterSpacing: '0.06em',
          textShadow: `0 0 32px ${trainer.color}aa`,
        }}>
          {trainer.name.toUpperCase()}
        </div>
        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3, fontStyle: 'italic' }}>
          {dossier.title}
        </div>
        <div style={{ fontSize: 9, color: '#475569', marginTop: 1 }}>
          📍 {dossier.location}
        </div>
      </div>

      {/* ── BODY: sprite left + info right ── */}
      <div style={{ display: 'flex', minHeight: 0 }}>

        {/* LEFT — big sprite */}
        <div style={{
          width: 220,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: `radial-gradient(ellipse at 50% 80%, ${trainer.color}33 0%, transparent 70%)`,
          borderRight: `1px solid ${trainer.color}22`,
          padding: '10px 6px',
          position: 'relative',
        }}>
          {/* Subtle corner accent */}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 32,
            background: `linear-gradient(to top, ${trainer.color}18, transparent)` }} />
          {!imgError && trainer.spriteUrl ? (
            <motion.img
              src={trainer.spriteUrl}
              alt={trainer.name}
              onError={() => setImgError(true)}
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              style={{
                width: 'clamp(180px, 28vh, 260px)',
                height: 'clamp(180px, 28vh, 260px)',
                objectFit: 'contain',
                imageRendering: 'auto',  // auto for all — jessie-james needs it and it looks fine on all
                filter: `drop-shadow(0 8px 20px ${trainer.color}88)`,
                position: 'relative', zIndex: 1,
              }}
            />
          ) : (
            <div style={{
              width: 120, height: 120, borderRadius: '50%',
              background: `${trainer.color}22`, border: `3px solid ${trainer.color}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 60, fontWeight: 900, color: trainer.color,
            }}>
              {trainer.name[0]}
            </div>
          )}
        </div>

        {/* RIGHT — all info */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', padding: '10px 12px', gap: 8 }}>

          {/* ABILITY */}
          <div style={{
            background: `${trainer.color}0d`,
            border: `1px solid ${trainer.color}2a`,
            borderRadius: 6,
            padding: '7px 10px',
          }}>
            <div style={{ fontSize: 8, letterSpacing: '0.2em', color: `${trainer.color}77`, textTransform: 'uppercase', marginBottom: 4 }}>
              ⚡ ABILITY
            </div>
            <div style={{ fontSize: 13, fontWeight: 900, color: trainer.color, letterSpacing: '0.03em', marginBottom: 3 }}>
              {trainer.ability.name}
            </div>
            <div style={{ fontSize: 10, color: '#94a3b8', lineHeight: 1.4, marginBottom: 5 }}>
              {trainer.ability.description}
            </div>
            {/* Bonus bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ fontSize: 8, color: '#475569', flexShrink: 0 }}>BONUS</div>
              <div style={{ flex: 1, height: 5, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${abilityPct * 5}%`,
                  maxWidth: '100%',
                  background: `linear-gradient(90deg, ${trainer.color}99, ${trainer.color})`,
                  borderRadius: 3,
                  boxShadow: `0 0 6px ${trainer.color}88`,
                }} />
              </div>
              <div style={{ fontSize: 10, color: trainer.color, fontWeight: 900, flexShrink: 0 }}>+{abilityPct}%</div>
            </div>
          </div>

          {/* STYLE */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 8, letterSpacing: '0.2em', color: `${trainer.color}77`, textTransform: 'uppercase', marginBottom: 5 }}>
              ── STYLE ──
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
              {dossier.battleStyles.map((style, i) => (
                <div key={i} style={{ fontSize: 11, color: '#94a3b8' }}>
                  {style}
                </div>
              ))}
            </div>
          </div>

          {/* SIG. POKÉMON */}
          {dossier.signaturePokemon.length > 0 && (
            <div style={{ marginTop: 'auto', textAlign: 'center' }}>
              <div style={{
                fontSize: 8, letterSpacing: '0.2em', color: `${trainer.color}77`,
                textTransform: 'uppercase', marginBottom: 6,
              }}>
                ── SIG. POKÉMON ──
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                {dossier.signaturePokemon.map(id => (
                  <div key={id} style={{
                    width: 50, height: 50,
                    background: `${trainer.color}0f`,
                    border: `1px solid ${trainer.color}44`,
                    borderRadius: 8,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <img
                      src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`}
                      alt={`#${id}`}
                      onError={e => {
                        const img = e.target as HTMLImageElement
                        if (!img.src.includes('official-artwork')) {
                          img.src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`
                          img.style.imageRendering = 'auto'
                        }
                      }}
                      style={{ width: 42, height: 42, imageRendering: 'pixelated', objectFit: 'contain' }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Bottom accent bar */}
      <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${trainer.color}44, transparent)` }} />
    </div>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function TrainerSelect() {
  const { selectTrainer, trainerSelectPhase, p1Trainer, gameMode } = useGameStore()

  useEffect(() => {
    resumeAudioContext()
    playMusic('menu')
  }, [])

  const [currentIndex, setCurrentIndex] = useState(0)
  const [direction, setDirection] = useState(0)
  const [timeLeft, setTimeLeft] = useState(90)
  const [lockedIn, setLockedIn] = useState<string | null>(null)

  const isP1Turn = trainerSelectPhase === 'p1'
  const playerColor = isP1Turn ? '#7c3aed' : '#ef4444'
  const trainer = TRAINERS[currentIndex]
  const isTaken = !isP1Turn && p1Trainer?.id === trainer.id

  const goNext = useCallback(() => {
    setDirection(1)
    setCurrentIndex(i => (i + 1) % TRAINERS.length)
  }, [])

  const goPrev = useCallback(() => {
    setDirection(-1)
    setCurrentIndex(i => (i - 1 + TRAINERS.length) % TRAINERS.length)
  }, [])

  useEffect(() => { setTimeLeft(90) }, [trainerSelectPhase])

  useEffect(() => {
    if (timeLeft <= 0) {
      if (!isTaken) selectTrainer(trainer)
      return
    }
    const t = setTimeout(() => setTimeLeft(prev => prev - 1), 1000)
    return () => clearTimeout(t)
  }, [timeLeft])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goNext()
      if (e.key === 'ArrowLeft') goPrev()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [goNext, goPrev])

  const handleSelect = () => {
    if (!isTaken && !lockedIn) {
      setLockedIn(trainer.id)
      // Play 2s–3.8s of the Pokemon SFX clip on trainer select
      try {
        const sfx = new Audio('/music/The Greatest Pokemon Sound Effects.mp3')
        sfx.currentTime = 2.8
        sfx.volume = 0.8
        sfx.play().catch(() => {})
        setTimeout(() => { sfx.pause(); sfx.currentTime = 0 }, 1200)
      } catch (e) {}
      setTimeout(() => selectTrainer(trainer), 900)
    }
  }

  return (
    <div style={{
      height: '100dvh',
      maxHeight: '100dvh',
      background: '#050510',
      padding: '8px 24px 8px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ textAlign: 'center', marginBottom: 6, width: '100%', maxWidth: 800, flexShrink: 0 }}
      >
        <div style={{
          fontSize: 11, letterSpacing: '0.35em', color: '#334155',
          textTransform: 'uppercase', marginBottom: 6,
        }}>
          ── SELECT YOUR TRAINER ──
        </div>
        <h1 style={{
          fontSize: 'clamp(16px, 2.5vh, 24px)', fontWeight: 900, margin: 0,
          color: playerColor, letterSpacing: '0.05em',
          fontFamily: 'Impact, Arial Black, sans-serif',
        }}>
          {isP1Turn ? 'PLAYER 1' : 'PLAYER 2'}: CHOOSE YOUR TRAINER
        </h1>
        <p style={{ color: '#475569', marginTop: 2, marginBottom: 0, fontSize: 11 }}>
          {(gameMode === 'vs_ai') && isP1Turn
            ? 'AI will pick automatically after you choose'
            : 'Your trainer ability activates in battle'}
        </p>

        {/* Timer + P1 chosen row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 4 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: timeLeft <= 10 ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${timeLeft <= 10 ? '#ef4444' : '#1e293b'}`,
            borderRadius: 8, padding: '5px 14px',
          }}>
            <motion.span
              animate={timeLeft <= 10 ? { scale: [1, 1.2, 1] } : { scale: 1 }}
              transition={{ duration: 0.5, repeat: timeLeft <= 10 ? Infinity : 0 }}
              style={{ fontSize: 14 }}
            >⏱</motion.span>
            <span style={{
              fontSize: 20, fontWeight: 900,
              color: timeLeft <= 10 ? '#ef4444' : '#94a3b8',
              fontVariantNumeric: 'tabular-nums',
              minWidth: 28, textAlign: 'center', display: 'inline-block',
            }}>
              {timeLeft}
            </span>
            <span style={{ fontSize: 11, color: '#475569' }}>sec</span>
          </div>

          {!isP1Turn && p1Trainer && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: '#0d0d20', borderRadius: 8, padding: '5px 12px',
              border: '1px solid #1e1e3e', fontSize: 12,
            }}>
              <span style={{ color: '#475569' }}>P1 chose:</span>
              <span style={{ color: '#7c3aed', fontWeight: 700 }}>{p1Trainer.name}</span>
            </div>
          )}
        </div>
      </motion.div>

      {/* Carousel */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        maxWidth: 960,
        flex: '1 1 auto',
        minHeight: 0,
        overflow: 'hidden',
      }}>
        {/* PREV */}
        <motion.button
          whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
          onClick={goPrev}
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: `1px solid ${trainer.color}44`,
            borderRadius: 10, padding: '12px 16px',
            color: trainer.color, fontSize: 22,
            cursor: 'pointer', flexShrink: 0, zIndex: 10,
          }}
        >←</motion.button>

        {/* 5-slot window */}
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center',
          justifyContent: 'center', gap: 12,
          overflow: 'hidden', padding: '0 4px',
        }}>
          {[-2, -1, 0, 1, 2].map(offset => {
            const idx = (currentIndex + offset + TRAINERS.length) % TRAINERS.length
            const t = TRAINERS[idx]
            const isCenter = offset === 0
            const isTakenCard = !isP1Turn && p1Trainer?.id === t.id
            const absOff = Math.abs(offset)
            const scale = isCenter ? 1 : absOff === 1 ? 0.78 : 0.62
            const opacity = isCenter ? 1 : absOff === 1 ? 0.45 : 0.2
            const blur = isCenter ? 0 : absOff === 1 ? 1.5 : 3
            const isLockedInCard = isCenter && lockedIn === t.id

            return (
              <motion.div
                key={t.id}
                animate={{
                  scale: isLockedInCard ? [1, 1.06, 1.03] : scale,
                  opacity,
                  filter: `blur(${blur}px)`,
                }}
                transition={{ type: 'tween', duration: 0.35, ease: 'easeOut' }}
                onClick={() => {
                  if (!isCenter) {
                    setDirection(offset > 0 ? 1 : -1)
                    setCurrentIndex(idx)
                  }
                }}
                style={{
                  flexShrink: 0,
                  cursor: isCenter ? 'default' : 'pointer',
                  transformOrigin: 'center',
                  position: 'relative',
                }}
              >
                {/* Aura behind center when locked */}
                {isLockedInCard && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: [0, 0.6, 0.4], scale: [0.8, 1.1, 1.05] }}
                    transition={{ duration: 0.4, ease: 'easeOut' }}
                    style={{
                      position: 'absolute', inset: -16, borderRadius: 20,
                      background: `radial-gradient(ellipse at center, ${t.color}55 0%, ${t.color}11 60%, transparent 80%)`,
                      pointerEvents: 'none', zIndex: 0,
                    }}
                  />
                )}

                <div style={{ position: 'relative', zIndex: 1 }}>
                  {isCenter
                    ? <DossierCard trainer={t} isTaken={isTakenCard} />
                    : <SideCard trainer={t} />
                  }
                </div>

                {/* LOCKED IN badge */}
                {isLockedInCard && (
                  <motion.div
                    initial={{ y: -50, opacity: 0, scale: 0.5 }}
                    animate={{ y: 0, opacity: 1, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 22, delay: 0.05 }}
                    style={{
                      position: 'absolute', top: -20, left: '50%',
                      transform: 'translateX(-50%)', zIndex: 20,
                      background: t.color, color: '#0a0a0f',
                      fontWeight: 900, fontSize: 12, letterSpacing: '0.12em',
                      padding: '5px 16px', borderRadius: 6,
                      whiteSpace: 'nowrap',
                      boxShadow: `0 0 24px ${t.color}cc`,
                      pointerEvents: 'none',
                      fontFamily: 'Impact, Arial Black, sans-serif',
                    }}
                  >
                    ✅ LOCKED IN!
                  </motion.div>
                )}
              </motion.div>
            )
          })}
        </div>

        {/* NEXT */}
        <motion.button
          whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
          onClick={goNext}
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: `1px solid ${trainer.color}44`,
            borderRadius: 10, padding: '12px 16px',
            color: trainer.color, fontSize: 22,
            cursor: 'pointer', flexShrink: 0, zIndex: 10,
          }}
        >→</motion.button>
      </div>

      {/* SELECT button + hints */}
      <div style={{
        marginTop: 6, width: '100%', flexShrink: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', gap: 5,
      }}>
        <motion.button
          whileHover={!isTaken && !lockedIn ? {
            scale: 1.04,
            boxShadow: `0 0 32px ${trainer.color}66`,
          } : {}}
          whileTap={!isTaken && !lockedIn ? { scale: 0.96 } : {}}
          animate={lockedIn ? {
            scale: [1, 1.06, 1.03],
            boxShadow: [`0 0 0px ${trainer.color}00`, `0 0 40px ${trainer.color}cc`, `0 0 20px ${trainer.color}88`],
          } : {}}
          transition={{ type: 'tween', duration: 0.4, ease: 'easeOut' }}
          onClick={handleSelect}
          disabled={isTaken || !!lockedIn}
          style={{
            padding: '13px 56px',
            background: lockedIn ? '#22c55e' : isTaken ? '#0d0d20' : trainer.color,
            border: `2px solid ${lockedIn ? '#22c55e' : trainer.color}`,
            borderRadius: 6,
            color: lockedIn ? '#0a0a0f' : isTaken ? trainer.color : '#0a0a0f',
            fontSize: 16, fontWeight: 900,
            cursor: isTaken || lockedIn ? 'not-allowed' : 'pointer',
            opacity: isTaken ? 0.45 : 1,
            letterSpacing: '0.1em',
            fontFamily: 'Impact, Arial Black, sans-serif',
          }}
        >
          {lockedIn
            ? '✅ LOCKED IN! ENTERING DRAFT...'
            : isTaken
              ? 'TAKEN — CHOOSE ANOTHER'
              : `I CHOOSE ${trainer.name.toUpperCase()}!`}
        </motion.button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <span style={{ color: '#334155', fontSize: 12 }}>← → arrow keys</span>
          <span style={{ color: '#334155', fontSize: 12 }}>{currentIndex + 1} / {TRAINERS.length}</span>
        </div>
      </div>
    </div>
  )
}
