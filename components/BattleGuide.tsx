'use client';

import { motion } from 'framer-motion';
import { useArenaStore } from '@/lib/store';
import { ARENA_BADGES } from '@/lib/constants';

const STEPS = [
  {
    num: '01',
    icon: '🧑‍💻',
    title: 'Create Your Account',
    desc: 'Sign up and choose your trainer avatar. Your profile tracks your wins, losses, earnings, and every gym badge you earn.',
  },
  {
    num: '02',
    icon: '⚔️',
    title: 'Pick Your Trainer',
    desc: 'Browse 18 legendary trainers — each with a unique ability that activates in battle. Ash, Giovanni, Misty, and more. Choose wisely.',
  },
  {
    num: '03',
    icon: '🎯',
    title: 'Draft Your Team',
    desc: 'Build a team of 6 Pokémon from all 151 Gen 1 originals. Each Pokémon has real stats, types, and moves. Draft smart — type matchups matter.',
  },
  {
    num: '04',
    icon: '🏟️',
    title: 'Choose Your Battlefield',
    desc: 'Pick one of 8 Kanto Gym arenas, each with a different entry fee — from $5 at Pewter City up to $1,000 at Viridian City. Higher stakes, bigger prizes.',
  },
  {
    num: '05',
    icon: '🪙',
    title: 'Set Your Battle Order',
    desc: 'Arrange your 6 Pokémon in the order they\'ll fight. Your lineup is locked in — plan your strategy before the battle begins.',
  },
  {
    num: '06',
    icon: '⚡',
    title: 'Battle!',
    desc: 'Your team fights automatically using real Pokémon mechanics — type advantages, status effects, crits, and trainer abilities. Watch it all play out.',
  },
  {
    num: '07',
    icon: '🏅',
    title: 'Win the Gym Badge',
    desc: 'Beat an opponent in any arena and you earn that gym\'s badge — first time only. Collect all 8 Kanto badges to prove you\'re the greatest trainer.',
  },
  {
    num: '08',
    icon: '💰',
    title: 'Collect Your Prize',
    desc: 'Winner takes 95% of the pot. Your balance updates instantly. Keep climbing arenas, keep earning badges, keep winning.',
  },
];

const BADGES = Object.entries(ARENA_BADGES);

export default function BattleGuide() {
  const { setScreen } = useArenaStore();

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

      <div className="relative z-10 flex flex-col h-full max-w-6xl mx-auto w-full px-6 pt-4 pb-4">

        {/* Header */}
        <div className="flex items-center justify-between mb-4 shrink-0">
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
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', marginTop: 2 }}>
              How to play Arena 151
            </p>
          </div>

          <div style={{ width: 80 }} />
        </div>

        {/* Steps grid — 4 across, 2 rows */}
        <div className="grid grid-cols-4 gap-2.5 mb-3 shrink-0">
          {STEPS.map((step, i) => (
            <motion.div
              key={step.num}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.03 + i * 0.04 }}
              className="rounded-xl p-3 flex flex-col gap-1.5"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <div className="flex items-center gap-2">
                <span style={{
                  fontFamily: '"Impact", "Arial Black", sans-serif',
                  fontSize: 22, color: 'rgba(251,191,36,0.25)', lineHeight: 1, fontWeight: 900,
                }}>
                  {step.num}
                </span>
                <span style={{ fontSize: 18 }}>{step.icon}</span>
              </div>
              <p className="font-black text-white text-xs leading-none">{step.title}</p>
              <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10.5, lineHeight: 1.45 }}>{step.desc}</p>
            </motion.div>
          ))}
        </div>

        {/* Badge section */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="rounded-xl p-3 shrink-0"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <p className="text-center font-black text-white text-xs uppercase tracking-widest mb-2.5" style={{ letterSpacing: '0.2em' }}>
            The 8 Kanto Gym Badges — Win Once to Earn Forever
          </p>
          <div className="flex items-center justify-center gap-4">
            {BADGES.map(([arenaId, badge]) => (
              <div key={arenaId} className="flex flex-col items-center gap-1">
                <div className="relative flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full blur-md" style={{ background: badge.color, opacity: 0.35 }} />
                  <img
                    src={badge.file}
                    alt={badge.name}
                    style={{
                      width: 36, height: 36, objectFit: 'contain',
                      imageRendering: 'pixelated',
                      filter: `drop-shadow(0 0 5px ${badge.color})`,
                      position: 'relative', zIndex: 1,
                    }}
                  />
                </div>
                <p style={{ fontSize: 9, color: badge.color, fontWeight: 900, textAlign: 'center', letterSpacing: '0.03em' }}>
                  {badge.city}
                </p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Footer CTA */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.55 }}
          className="mt-3 flex justify-center shrink-0"
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
            Enter the Arena →
          </motion.button>
        </motion.div>

      </div>
    </div>
  );
}
