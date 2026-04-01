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
            <div style={{ position: 'absolute', inset: 0, background: 'white', animation: 'specialFlashWhite 0.25s ease-out forwards' }} />
            {/* Dark overlay */}
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.88)' }} />
            {/* Speed lines */}
            <div style={{
              position: 'absolute', inset: 0,
              background: 'repeating-conic-gradient(rgba(251,191,36,0.07) 0deg 3deg, transparent 3deg 9deg)',
              animation: 'specialImgPop 0.3s ease-out forwards',
            }} />
            {/* Centre glow */}
            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center, rgba(251,191,36,0.22) 0%, transparent 60%)' }} />

            {/* Content */}
            <div style={{ position: 'relative', zIndex: 2, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              {/* Torn edges */}
              <div style={{
                animation: 'specialImgPop 0.28s cubic-bezier(0.34,1.56,0.64,1) forwards',
                filter: 'drop-shadow(0 0 32px rgba(251,191,36,1)) drop-shadow(0 0 64px rgba(251,191,36,0.5)) drop-shadow(4px 4px 0px #000)',
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
                  src={trainer.file}
                  alt={trainer.name}
                  style={{ maxHeight: '60vh', maxWidth: '75vw', objectFit: 'contain', display: 'block' }}
                />
              </div>
              {/* Move name only — no "Use" */}
              <div style={{
                marginTop: 14,
                fontFamily: '"Impact","Arial Black",sans-serif',
                fontSize: 38, fontWeight: 900,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                background: 'linear-gradient(90deg,#fbbf24 0%,#fff 40%,#f97316 70%,#fbbf24 100%)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                filter: 'drop-shadow(0 0 20px rgba(251,191,36,1)) drop-shadow(2px 2px 0px #000)',
                animation: 'specialImgPop 0.3s 0.12s cubic-bezier(0.34,1.56,0.64,1) both',
              }}>
                {move}!
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
