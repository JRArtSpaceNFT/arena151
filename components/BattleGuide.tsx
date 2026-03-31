'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { useArenaStore } from '@/lib/store';
import { ARENA_BADGES } from '@/lib/constants';

// Drop screenshots into /public/guide/ with these exact filenames
// Each should be a screenshot of that step in the game
const STEPS = [
  {
    num: '01',
    title: 'Pick Your Trainer',
    desc: 'Choose from 18 legendary trainers, each with a unique ability that fires in battle. Ash, Giovanni, Misty and more are waiting. Who are you?',
    img: '/guide/trainer-select.png',
  },
  {
    num: '02',
    title: 'Draft Your Team',
    desc: 'Build a squad of 5 Pokémon from all 151 Gen 1 originals. Real stats, real types, real moves. Type matchups can change everything.',
    img: '/guide/draft.png',
  },
  {
    num: '03',
    title: 'Choose Your Battlefield',
    desc: 'Pick one of 8 Kanto Gym arenas. Entry fees range from $5 at Pewter City to $1,000 at Viridian City. Higher stakes means bigger prizes!',
    img: '/guide/room-select.png',
  },
  {
    num: '04',
    title: 'Set Your Battle Order',
    desc: 'Lock in the order your 5 Pokémon will fight. This is your last chance to strategize before the battle begins. Choose well!',
    img: '/guide/battle-order.png',
  },
  {
    num: '05',
    title: 'Battle!',
    desc: 'Your team fights using real Pokémon mechanics: type advantages, status effects, crits, trainer abilities. Watch your squad dominate!',
    img: '/guide/battle.png',
  },
  {
    num: '06',
    title: 'Collect Your Prize',
    desc: 'Winner takes the pot. Your balance updates instantly. Keep climbing arenas, stacking badges, and banking wins!',
    img: '/guide/victory.png',
  },
];

const BADGES = Object.entries(ARENA_BADGES);

export default function BattleGuide() {
  const { setScreen } = useArenaStore();
  const [hoveredStep, setHoveredStep] = useState<number | null>(null);

  return (
    <div
      className="h-screen flex flex-col overflow-hidden relative"
      style={{ background: 'linear-gradient(160deg,#06040f 0%,#0d0a1e 50%,#060608 100%)' }}
    >
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] opacity-8 blur-3xl rounded-full"
          style={{ background: 'radial-gradient(ellipse, #fbbf24, transparent 70%)' }} />
      </div>

      <div className="relative z-10 flex flex-row h-full w-full pt-4 pb-4 gap-3 px-3">

        {/* ── Left badges ── */}
        <div className="flex flex-col items-center justify-evenly shrink-0" style={{ width: 52 }}>
          {BADGES.slice(0, 4).map(([arenaId, badge]) => (
            <div key={arenaId} className="relative flex items-center justify-center">
              <motion.div className="absolute inset-0 rounded-full blur-lg" style={{ background: badge.color }}
                animate={{ opacity: [0.3, 0.7, 0.3] }}
                transition={{ duration: 2.2, repeat: Infinity, delay: Math.random() * 1.5 }} />
              <img src={badge.file} alt={badge.name} style={{
                width: 48, height: 48, objectFit: 'contain', imageRendering: 'pixelated',
                filter: `drop-shadow(0 0 8px ${badge.color})`, position: 'relative', zIndex: 1,
              }} />
            </div>
          ))}
        </div>

        {/* ── Center content ── */}
        <div className="flex flex-col flex-1 min-w-0">

        {/* Header */}
        <div className="flex items-center justify-between mb-3 shrink-0">
          <motion.button
            initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
            onClick={() => setScreen('draft-mode-intro')}
            whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-bold border"
            style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' }}
          >
            ← Back
          </motion.button>

          <div className="text-center">
            <h1 style={{
              fontFamily: '"Impact", "Arial Black", sans-serif',
              fontSize: 32,
              fontWeight: 900,
              letterSpacing: '0.08em',
              lineHeight: 1,
              background: 'linear-gradient(135deg, #fbbf24 0%, #f97316 50%, #fbbf24 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              filter: 'drop-shadow(0 0 16px rgba(251,191,36,0.4))',
            }}>
              BATTLE GUIDE
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', marginTop: 2 }}>
              How to play Arena 151
            </p>
          </div>

          <div style={{ width: 80 }} />
        </div>

        {/* Steps — 3×2 grid */}
        <div className="grid grid-cols-3 grid-rows-2 gap-2.5 flex-1 min-h-0">
          {STEPS.map((step, i) => (
            <motion.div
              key={step.num}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.03 + i * 0.05 }}
              className="rounded-xl flex flex-col overflow-hidden min-h-0 cursor-pointer"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: hoveredStep === i ? '1px solid rgba(251,191,36,0.5)' : '1px solid rgba(255,255,255,0.08)',
                boxShadow: hoveredStep === i ? '0 0 20px rgba(251,191,36,0.15)' : 'none',
                transition: 'border-color 0.2s, box-shadow 0.2s',
              }}
              onMouseEnter={() => setHoveredStep(i)}
              onMouseLeave={() => setHoveredStep(null)}
            >
              {/* Screenshot — takes most of the card */}
              <div className="relative flex-1 min-h-0" style={{ background: 'rgba(0,0,0,0.4)' }}>
                <img
                  src={step.img}
                  alt={step.title}
                  className="w-full h-full object-cover"
                  style={{ opacity: 0.92, transition: 'opacity 0.2s' }}
                  onError={e => { (e.target as HTMLImageElement).style.opacity = '0'; }}
                />
                {/* Step number pill */}
                <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md font-black"
                  style={{
                    fontFamily: '"Impact", "Arial Black", sans-serif',
                    fontSize: 13, background: 'rgba(0,0,0,0.8)',
                    color: '#fbbf24', letterSpacing: '0.05em',
                  }}>
                  {step.num}
                </div>
                {/* Hover hint */}
                <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded text-xs font-bold"
                  style={{ background: 'rgba(0,0,0,0.6)', color: 'rgba(255,255,255,0.4)', fontSize: 9 }}>
                  hover to zoom
                </div>
              </div>

              {/* Text — compact strip at bottom */}
              <div className="px-3 py-2 shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <p className="font-black text-white leading-tight mb-0.5" style={{ fontSize: 11 }}>{step.title}</p>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, lineHeight: 1.4 }}>{step.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* ── Zoom lightbox ── */}
        <AnimatePresence>
          {hoveredStep !== null && (
            <div
              className="fixed z-50 pointer-events-none"
              style={{ inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
            <motion.div
              key={hoveredStep}
              initial={{ opacity: 0, scale: 0.88 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              style={{ width: '62vw', maxWidth: 900 }}
            >


              <div style={{
                borderRadius: 16,
                overflow: 'hidden',
                border: '2px solid rgba(251,191,36,0.4)',
                boxShadow: '0 0 60px rgba(0,0,0,0.8), 0 0 30px rgba(251,191,36,0.15)',
                background: '#0a0812',
              }}>
                {/* Title bar */}
                <div style={{
                  padding: '8px 16px',
                  background: 'rgba(0,0,0,0.7)',
                  borderBottom: '1px solid rgba(251,191,36,0.2)',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <span style={{
                    fontFamily: '"Impact", "Arial Black", sans-serif',
                    fontSize: 13, color: '#fbbf24', letterSpacing: '0.08em',
                  }}>
                    STEP {STEPS[hoveredStep].num}
                  </span>
                  <span style={{ color: 'white', fontWeight: 900, fontSize: 13 }}>
                    {STEPS[hoveredStep].title}
                  </span>
                </div>

                {/* Full screenshot */}
                <img
                  src={STEPS[hoveredStep].img}
                  alt={STEPS[hoveredStep].title}
                  style={{ width: '100%', display: 'block', maxHeight: '55vh', objectFit: 'cover' }}
                />
              </div>
            </motion.div>
            </div>
          )}
        </AnimatePresence>



        {/* CTA */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.55 }}
          className="flex justify-center shrink-0"
        >
          <motion.button
            whileHover={{ scale: 1.04, boxShadow: '0 0 32px rgba(251,191,36,0.4)' }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setScreen('draft-mode-intro')}
            className="px-10 py-2.5 rounded-xl font-black text-sm uppercase tracking-widest"
            style={{
              fontFamily: '"Impact", "Arial Black", sans-serif',
              background: 'linear-gradient(135deg, rgba(251,191,36,0.2), rgba(249,115,22,0.2))',
              border: '1px solid rgba(251,191,36,0.4)',
              color: '#fbbf24',
              letterSpacing: '0.12em',
            }}
          >
← Back
          </motion.button>
        </motion.div>

        </div>{/* end center content */}

        {/* ── Right badges ── */}
        <div className="flex flex-col items-center justify-evenly shrink-0" style={{ width: 52 }}>
          {BADGES.slice(4, 8).map(([arenaId, badge]) => (
            <div key={arenaId} className="relative flex items-center justify-center">
              <motion.div className="absolute inset-0 rounded-full blur-lg" style={{ background: badge.color }}
                animate={{ opacity: [0.3, 0.7, 0.3] }}
                transition={{ duration: 2.2, repeat: Infinity, delay: Math.random() * 1.5 }} />
              <img src={badge.file} alt={badge.name} style={{
                width: 48, height: 48, objectFit: 'contain', imageRendering: 'pixelated',
                filter: `drop-shadow(0 0 8px ${badge.color})`, position: 'relative', zIndex: 1,
              }} />
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
