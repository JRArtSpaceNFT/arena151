'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useCallback, useEffect } from 'react';
import { useArenaStore } from '@/lib/store';
import { ARENA_BADGES } from '@/lib/constants';

const STEPS = [
  {
    num: '01',
    title: 'Choose Your Stakes',
    desc: 'Pick one of 8 Kanto Gym arenas. Entry fees range from $5 at Pewter City to $1,000 at Viridian City. Higher stakes means bigger prizes — but tougher competition.',
    img: '/guide/room-select.png',
    tip: 'Start with Pewter City to get your bearings.',
  },
  {
    num: '02',
    title: 'Pick Your Trainer',
    desc: 'Choose from 18 legendary trainers, each with a unique ability that activates in battle. Ash, Giovanni, Misty and more are waiting. Your trainer ability can be the difference between a win and a loss.',
    img: '/guide/trainer-select.png',
    tip: 'Trainer abilities stack with your Pokémon\'s natural strengths.',
  },
  {
    num: '03',
    title: 'Draft Your Team',
    desc: 'Build a squad of 5 Pokémon from all 151 Gen 1 originals. Real stats, real types, real moves. Each Pokémon has a cost — manage your budget wisely to build the strongest team.',
    img: '/guide/draft.png',
    tip: 'Type coverage beats raw power. Diversify your team.',
  },
  {
    num: '04',
    title: 'Set Your Battle Order',
    desc: 'Lock in the order your 5 Pokémon will fight. This is your last chance to strategize before the battle begins — lead with your opener, save your closer for last.',
    img: '/guide/battle-order.png',
    tip: 'Put a fast Pokémon first to set the tempo early.',
  },
  {
    num: '05',
    title: 'Battle!',
    desc: 'Your team fights using real Pokémon mechanics: type advantages, status effects, crits, and trainer abilities all play out automatically. Watch your squad dominate — or learn from the defeat.',
    img: '/guide/battle.png',
    tip: 'Use the 3× speed button to fast-forward through battles.',
  },
  {
    num: '06',
    title: 'Collect Your Prize',
    desc: 'Winner takes 95% of the combined pot. Your balance updates instantly on-chain. Keep climbing arenas, stacking badges, and building your legend.',
    img: '/guide/victory.png',
    tip: 'Win all 8 Gym arenas to earn every Kanto badge.',
  },
];

const BADGES = Object.entries(ARENA_BADGES);

export default function BattleGuide() {
  const { setScreen, currentTrainer } = useArenaStore();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);

  const step = STEPS[currentIndex];

  const goNext = useCallback(() => {
    if (currentIndex < STEPS.length - 1) {
      setDirection(1);
      setCurrentIndex(i => i + 1);
    }
  }, [currentIndex]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      setDirection(-1);
      setCurrentIndex(i => i - 1);
    }
  }, [currentIndex]);

  // Keyboard nav
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'Escape') setScreen('draft-mode-intro');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goNext, goPrev, setScreen]);

  const variants = {
    enter: (dir: number) => ({ x: dir > 0 ? 80 : -80, opacity: 0, scale: 0.96 }),
    center: { x: 0, opacity: 1, scale: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -80 : 80, opacity: 0, scale: 0.96 }),
  };

  return (
    <div
      className="h-screen flex flex-col overflow-hidden relative"
      style={{ background: 'linear-gradient(160deg,#06040f 0%,#0d0a1e 50%,#060608 100%)' }}
    >
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] opacity-10 blur-3xl rounded-full"
          style={{ background: 'radial-gradient(ellipse, #fbbf24, transparent 70%)' }} />
      </div>

      <div className="relative z-10 flex flex-row h-full w-full pt-4 pb-4 gap-3 px-4">

        {/* ── Left badges ── */}
        <div className="flex flex-col items-center justify-evenly shrink-0" style={{ width: 52 }}>
          {BADGES.slice(0, 4).map(([arenaId, badge]) => (
            <div key={arenaId} className="relative flex items-center justify-center">
              <motion.div className="absolute inset-0 rounded-full blur-lg" style={{ background: badge.color }}
                animate={{ opacity: [0.3, 0.7, 0.3] }}
                transition={{ duration: 2.2, repeat: Infinity }} />
              <img src={badge.file} alt={badge.name} style={{
                width: 44, height: 44, objectFit: 'contain', imageRendering: 'pixelated',
                filter: `drop-shadow(0 0 8px ${badge.color})`, position: 'relative', zIndex: 1,
              }} />
            </div>
          ))}
        </div>

        {/* ── Center ── */}
        <div className="flex flex-col flex-1 min-w-0 items-center">

          {/* Header */}
          <div className="flex items-center justify-between w-full mb-4 shrink-0">
            <motion.button
              initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
              onClick={() => setScreen('draft-mode-intro')}
              whileHover={{ scale: 1.04, boxShadow: '0 0 16px rgba(251,191,36,0.4)' }}
              whileTap={{ scale: 0.96 }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-bold border"
              style={{ background: 'rgba(251,191,36,0.12)', borderColor: 'rgba(251,191,36,0.5)', color: '#fbbf24' }}
            >
              ← Back
            </motion.button>

            <div className="text-center">
              <h1 style={{
                fontFamily: '"Impact", "Arial Black", sans-serif',
                fontSize: 'clamp(22px, 3vw, 32px)',
                fontWeight: 900, letterSpacing: '0.08em', lineHeight: 1,
                background: 'linear-gradient(135deg, #fbbf24 0%, #f97316 50%, #fbbf24 100%)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                filter: 'drop-shadow(0 0 16px rgba(251,191,36,0.4))',
              }}>
                BATTLE GUIDE
              </h1>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', marginTop: 2 }}>
                How to play Arena 151
              </p>
            </div>

            <div style={{ width: 80 }} />
          </div>

          {/* Step counter */}
          <div className="shrink-0 mb-3" style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
            STEP {currentIndex + 1} OF {STEPS.length}
          </div>

          {/* Carousel row */}
          <div className="flex items-center gap-4 w-full flex-1 min-h-0" style={{ maxWidth: 860 }}>

            {/* PREV */}
            <motion.button
              whileHover={currentIndex > 0 ? { scale: 1.1 } : {}}
              whileTap={currentIndex > 0 ? { scale: 0.92 } : {}}
              onClick={goPrev}
              style={{
                flexShrink: 0,
                width: 44, height: 44,
                borderRadius: 10,
                border: `1px solid ${currentIndex > 0 ? 'rgba(251,191,36,0.4)' : 'rgba(255,255,255,0.06)'}`,
                background: currentIndex > 0 ? 'rgba(251,191,36,0.08)' : 'rgba(255,255,255,0.02)',
                color: currentIndex > 0 ? '#fbbf24' : 'rgba(255,255,255,0.15)',
                fontSize: 20, cursor: currentIndex > 0 ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >←</motion.button>

            {/* Step card */}
            <div className="flex-1 min-w-0" style={{ overflow: 'hidden' }}>
              <AnimatePresence custom={direction} mode="wait">
                <motion.div
                  key={step.num}
                  custom={direction}
                  variants={variants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.28, ease: 'easeOut' }}
                  style={{
                    background: 'rgba(12,10,28,0.95)',
                    border: '1px solid rgba(251,191,36,0.25)',
                    borderRadius: 16,
                    overflow: 'hidden',
                    boxShadow: '0 0 60px rgba(251,191,36,0.12), 0 24px 64px rgba(0,0,0,0.6)',
                  }}
                >
                  {/* Top accent bar */}
                  <div style={{ height: 3, background: 'linear-gradient(90deg, transparent, #fbbf24, #f97316, transparent)' }} />

                  {/* Screenshot area — fixed height so it always shows */}
                  <div style={{
                    position: 'relative',
                    height: 'clamp(200px, 35vh, 380px)',
                    background: 'rgba(0,0,0,0.5)',
                    overflow: 'hidden',
                  }}>
                    {/* Step number pill */}
                    <div style={{
                      position: 'absolute', top: 12, left: 12, zIndex: 10,
                      padding: '4px 12px', borderRadius: 8,
                      fontFamily: '"Impact","Arial Black",sans-serif',
                      fontSize: 16, fontWeight: 900, letterSpacing: '0.08em',
                      background: 'rgba(0,0,0,0.85)',
                      color: '#fbbf24',
                      border: '1px solid rgba(251,191,36,0.4)',
                    }}>
                      {step.num} / {STEPS.length}
                    </div>

                    {/* Placeholder shown only when screenshot hasn't loaded */}

                    <img
                      src={step.img}
                      alt={step.title}
                      style={{
                        position: 'absolute', inset: 0,
                        width: '100%', height: '100%',
                        objectFit: 'cover',
                        objectPosition: step.img.includes('draft') ? 'center 80%' : 'center top',
                        opacity: 0.92,
                      }}
                      onError={e => { (e.target as HTMLImageElement).style.opacity = '0'; }}
                    />

                    {/* Bottom fade into info section */}
                    <div style={{
                      position: 'absolute', bottom: 0, left: 0, right: 0, height: 48,
                      background: 'linear-gradient(to bottom, transparent, rgba(12,10,28,0.97))',
                    }} />
                  </div>

                  {/* Info section */}
                  <div style={{ padding: '18px 24px 20px', flexShrink: 0 }}>
                    <h2 style={{
                      fontFamily: '"Impact","Arial Black",sans-serif',
                      fontSize: 'clamp(20px, 2.8vw, 30px)',
                      fontWeight: 900, letterSpacing: '0.06em',
                      lineHeight: 1, marginBottom: 10,
                      background: 'linear-gradient(135deg, #fbbf24 0%, #f97316 60%, #fbbf24 100%)',
                      WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                    }}>
                      {step.title}
                    </h2>
                    <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 14, lineHeight: 1.65, marginBottom: 12 }}>
                      {step.desc}
                    </p>
                    {/* Pro tip */}
                    <div style={{
                      display: 'flex', alignItems: 'flex-start', gap: 8,
                      background: 'rgba(251,191,36,0.06)',
                      border: '1px solid rgba(251,191,36,0.18)',
                      borderRadius: 8, padding: '8px 12px',
                    }}>
                      <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>💡</span>
                      <span style={{ fontSize: 12, color: 'rgba(251,191,36,0.8)', lineHeight: 1.5 }}>
                        <strong style={{ color: '#fbbf24' }}>TIP:</strong> {step.tip}
                      </span>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* NEXT */}
            <motion.button
              whileHover={currentIndex < STEPS.length - 1 ? { scale: 1.1 } : {}}
              whileTap={currentIndex < STEPS.length - 1 ? { scale: 0.92 } : {}}
              onClick={goNext}
              style={{
                flexShrink: 0,
                width: 44, height: 44,
                borderRadius: 10,
                border: `1px solid ${currentIndex < STEPS.length - 1 ? 'rgba(251,191,36,0.4)' : 'rgba(255,255,255,0.06)'}`,
                background: currentIndex < STEPS.length - 1 ? 'rgba(251,191,36,0.08)' : 'rgba(255,255,255,0.02)',
                color: currentIndex < STEPS.length - 1 ? '#fbbf24' : 'rgba(255,255,255,0.15)',
                fontSize: 20, cursor: currentIndex < STEPS.length - 1 ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >→</motion.button>

          </div>

          {/* Dot indicators */}
          <div className="flex items-center gap-2 mt-3 shrink-0">
            {STEPS.map((s, i) => (
              <motion.button
                key={s.num}
                onClick={() => { setDirection(i > currentIndex ? 1 : -1); setCurrentIndex(i); }}
                animate={{ scale: i === currentIndex ? 1 : 0.7, opacity: i === currentIndex ? 1 : 0.35 }}
                transition={{ duration: 0.2 }}
                style={{
                  width: i === currentIndex ? 24 : 8,
                  height: 8,
                  borderRadius: 4,
                  border: 'none',
                  background: i === currentIndex ? '#fbbf24' : 'rgba(255,255,255,0.3)',
                  cursor: 'pointer',
                  padding: 0,
                  transition: 'width 0.25s ease',
                }}
              />
            ))}
          </div>

          {/* Last step CTA */}
          {currentIndex === STEPS.length - 1 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mt-3 shrink-0"
            >
              <motion.button
                whileHover={{ scale: 1.04, boxShadow: '0 0 28px rgba(251,191,36,0.5)' }}
                whileTap={{ scale: 0.97 }}
                onClick={() => currentTrainer ? setScreen('room-select') : setScreen('signup')}
                style={{
                  padding: '11px 40px',
                  background: 'linear-gradient(135deg, #fbbf24, #f97316)',
                  border: 'none', borderRadius: 10,
                  color: '#0a0a0f', fontSize: 15, fontWeight: 900,
                  fontFamily: '"Impact","Arial Black",sans-serif',
                  letterSpacing: '0.1em', cursor: 'pointer',
                  boxShadow: '0 0 20px rgba(251,191,36,0.3)',
                }}
              >
                ENTER THE ARENA →
              </motion.button>
            </motion.div>
          )}

        </div>{/* end center */}

        {/* ── Right badges ── */}
        <div className="flex flex-col items-center justify-evenly shrink-0" style={{ width: 52 }}>
          {BADGES.slice(4, 8).map(([arenaId, badge]) => (
            <div key={arenaId} className="relative flex items-center justify-center">
              <motion.div className="absolute inset-0 rounded-full blur-lg" style={{ background: badge.color }}
                animate={{ opacity: [0.3, 0.7, 0.3] }}
                transition={{ duration: 2.2, repeat: Infinity }} />
              <img src={badge.file} alt={badge.name} style={{
                width: 44, height: 44, objectFit: 'contain', imageRendering: 'pixelated',
                filter: `drop-shadow(0 0 8px ${badge.color})`, position: 'relative', zIndex: 1,
              }} />
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
