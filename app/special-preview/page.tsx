'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const TRAINERS = [
  { id: 'ash',         name: 'Ash',           file: '/trainer-specials/Ash.png' },
  { id: 'brock',       name: 'Brock',         file: '/trainer-specials/Brock.png' },
  { id: 'misty',       name: 'Misty',         file: '/trainer-specials/Misty.png' },
  { id: 'oak',         name: 'Professor Oak', file: '/trainer-specials/ProfessorOak.png' },
];

const EXAMPLE_MOVES = ['Thunderbolt', 'Hydro Pump', 'Hyper Beam', 'Psychic'];

export default function SpecialPreview() {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [flashKey, setFlashKey] = useState(0);

  const trigger = (idx: number) => {
    setActiveIdx(idx);
    setFlashKey(k => k + 1);
    setTimeout(() => setActiveIdx(null), 1800);
  };

  const trainer = activeIdx !== null ? TRAINERS[activeIdx] : null;
  const move = activeIdx !== null ? EXAMPLE_MOVES[activeIdx] : '';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8 relative overflow-hidden"
      style={{ background: 'linear-gradient(160deg, #06040f 0%, #0d0a1e 60%, #060608 100%)' }}>

      <h1 style={{
        fontFamily: '"Impact","Arial Black",sans-serif',
        fontSize: 36, fontWeight: 900, letterSpacing: '0.1em',
        background: 'linear-gradient(135deg,#fbbf24,#f97316,#fbbf24)',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
        filter: 'drop-shadow(0 0 16px rgba(251,191,36,0.5))',
      }}>
        SPECIAL MOVE FLASH — PREVIEW
      </h1>

      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>Click a trainer to trigger their special move flash</p>

      {/* Trainer buttons */}
      <div className="flex gap-5 flex-wrap justify-center">
        {TRAINERS.map((t, i) => (
          <motion.button
            key={t.id}
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => trigger(i)}
            className="flex flex-col items-center gap-3 rounded-2xl px-6 py-5 border"
            style={{
              background: 'rgba(255,255,255,0.05)',
              borderColor: 'rgba(251,191,36,0.25)',
              cursor: 'pointer',
              minWidth: 120,
            }}
          >
            <img src={t.file} alt={t.name}
              className="w-24 h-24 object-contain rounded-xl"
              style={{ imageRendering: 'pixelated' }}
              onError={e => { (e.target as HTMLImageElement).style.opacity = '0.2'; }}
            />
            <span className="font-black text-white text-sm">{t.name}</span>
            <span style={{ color: '#fbbf24', fontSize: 11, fontWeight: 700 }}>{EXAMPLE_MOVES[i]}</span>
          </motion.button>
        ))}
      </div>

      {/* Flash overlay */}
      <AnimatePresence>
        {trainer && (
          <motion.div
            key={flashKey}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 50,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              pointerEvents: 'none',
              animation: 'specialFlashFadeOut 1.8s ease-in-out forwards',
            }}
          >
            {/* White hit flash */}
            <div style={{
              position: 'absolute', inset: 0,
              background: 'white',
              animation: 'specialFlashWhite 0.18s ease-out forwards',
            }} />
            {/* Dark overlay */}
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.85)' }} />
            {/* Radial glow behind image */}
            <div style={{
              position: 'absolute', inset: 0,
              background: 'radial-gradient(ellipse at center, rgba(251,191,36,0.18) 0%, transparent 65%)',
            }} />
            {/* Content */}
            <div style={{ position: 'relative', zIndex: 2, textAlign: 'center' }}>
              <img
                src={trainer.file}
                alt={trainer.name}
                style={{
                  maxHeight: '68vh',
                  maxWidth: '80vw',
                  objectFit: 'contain',
                  filter: 'drop-shadow(0 0 40px rgba(251,191,36,0.9)) drop-shadow(0 0 80px rgba(251,191,36,0.4))',
                  animation: 'specialImgPop 0.28s cubic-bezier(0.34,1.56,0.64,1) forwards',
                }}
              />
              <div style={{
                marginTop: 18,
                fontSize: 28, fontWeight: 900,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                background: 'linear-gradient(90deg,#fbbf24,#f97316,#fbbf24)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                filter: 'drop-shadow(0 0 16px rgba(251,191,36,0.8))',
                animation: 'specialImgPop 0.3s 0.1s cubic-bezier(0.34,1.56,0.64,1) both',
              }}>
                Use {move}!
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
