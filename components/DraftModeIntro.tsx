'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useArenaStore } from '@/lib/store';

// Design canvas — matches ttt.png dimensions exactly
const DESIGN_W = 2605;
const DESIGN_H = 1080;

// Fixed sparkle positions to avoid hydration mismatch
const SPARKLES = [
  { x: '12%',  y: '18%', size: 3,   duration: 2.2, delay: 0    },
  { x: '28%',  y: '8%',  size: 2,   duration: 3.1, delay: 0.7  },
  { x: '45%',  y: '22%', size: 4,   duration: 2.6, delay: 1.4  },
  { x: '62%',  y: '12%', size: 2.5, duration: 3.4, delay: 0.3  },
  { x: '78%',  y: '25%', size: 3,   duration: 2.0, delay: 1.9  },
  { x: '88%',  y: '10%', size: 2,   duration: 2.8, delay: 0.9  },
  { x: '7%',   y: '55%', size: 2.5, duration: 3.2, delay: 2.1  },
  { x: '20%',  y: '70%', size: 2,   duration: 2.5, delay: 0.5  },
  { x: '35%',  y: '60%', size: 3.5, duration: 3.0, delay: 1.2  },
  { x: '55%',  y: '75%', size: 2,   duration: 2.3, delay: 1.7  },
  { x: '72%',  y: '65%', size: 3,   duration: 2.9, delay: 0.4  },
  { x: '85%',  y: '78%', size: 2,   duration: 3.3, delay: 2.3  },
  { x: '93%',  y: '45%', size: 2.5, duration: 2.1, delay: 1.0  },
  { x: '50%',  y: '42%', size: 2,   duration: 3.5, delay: 0.8  },
  { x: '15%',  y: '38%', size: 3,   duration: 2.4, delay: 1.6  },
];

// Star/cross sparkle shape
function SparkleIcon({ size, color = 'white' }: { size: number; color?: string }) {
  return (
    <svg width={size * 3} height={size * 3} viewBox="0 0 12 12" fill="none">
      <path d="M6 0 L6.5 5 L12 6 L6.5 6.5 L6 12 L5.5 6.5 L0 6 L5.5 5 Z" fill={color} />
    </svg>
  );
}



export default function DraftModeIntro() {
  const { currentTrainer, setScreen } = useArenaStore();
  // Crowd cheer is now managed at app level (page.tsx) to persist across screens

  // ── Viewport-fit uniform scale (same pattern as HomePage) ─────────────────
  const [scale, setScale] = useState(1);
  const computeScale = useCallback(() => {
    setScale(Math.min(window.innerWidth / DESIGN_W, window.innerHeight / DESIGN_H));
  }, []);
  useEffect(() => {
    computeScale();
    window.addEventListener('resize', computeScale);
    return () => window.removeEventListener('resize', computeScale);
  }, [computeScale]);

  return (
    // Outer shell: fixed viewport, black letterbox, centers the stage
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', background: '#000' }}>

      {/* Inner stage: DESIGN_W×DESIGN_H, scaled uniformly to fit viewport */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        width: DESIGN_W,
        height: DESIGN_H,
        transform: `translate(-50%, -50%) scale(${scale})`,
        transformOrigin: 'center center',
      }}>

        {/* Background image fills the stage exactly — no cover/crop needed */}
        <img
          src="/ttt.png"
          alt=""
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'fill',
            pointerEvents: 'none',
            userSelect: 'none',
            display: 'block',
          }}
        />

        {/* Shimmer sweep */}
        <motion.div
          style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: 'linear-gradient(105deg, transparent 20%, rgba(255,255,255,0.055) 50%, transparent 80%)',
            backgroundSize: '300% 100%',
          }}
          animate={{ backgroundPosition: ['200% 0%', '-100% 0%'] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'linear', repeatDelay: 3 }}
        />

        {/* Floating sparkles */}
        {SPARKLES.map((s, i) => (
          <motion.div
            key={i}
            style={{ position: 'absolute', left: s.x, top: s.y, pointerEvents: 'none' }}
            animate={{ opacity: [0, 1, 0], scale: [0.3, 1, 0.3], rotate: [0, 35, 0] }}
            transition={{ duration: s.duration, delay: s.delay, repeat: Infinity, ease: 'easeInOut', repeatDelay: s.duration }}
          >
            <SparkleIcon size={s.size} color="rgba(255,240,160,0.85)" />
          </motion.div>
        ))}

        {/*
          Hit zones — all % coordinates are relative to the DESIGN canvas (2605×1080).
          Because the stage is always DESIGN_W×DESIGN_H before scaling,
          these percentages are pixel-perfect regardless of viewport size.

          PROFILE:          x30-240,    y10-68
          LEADERBOARD:      x0-220,     y370-460
          ENTER THE ARENA:  x1050-1380, y840-930  (centered ~x1215)
          BATTLE GUIDE:     x2385-2605, y640-775
        */}

        {/* PROFILE — top-left tab, shifted right per feedback */}
        <button
          onClick={() => setScreen(currentTrainer ? 'profile' : 'signup')}
          aria-label="View Profile"
          style={{ position: 'absolute', left: '1.2%', top: '0.9%', width: '8.1%', height: '5.4%',
            background: 'transparent', border: 'none', cursor: 'pointer' }}
        />

        {/* LEADERBOARD — left side tab, shifted down+right per feedback */}
        <button
          onClick={() => setScreen('leaderboard')}
          aria-label="Leaderboard"
          style={{ position: 'absolute', left: '0.0%', top: '34.3%', width: '8.4%', height: '8.3%',
            background: 'transparent', border: 'none', cursor: 'pointer' }}
        />

        {/* ENTER THE ARENA — centered button, shifted down+right per feedback */}
        <button
          onClick={() => currentTrainer ? setScreen('room-select') : setScreen('signup')}
          aria-label="Enter the Arena"
          style={{ position: 'absolute', left: '40.3%', top: '77.8%', width: '12.7%', height: '8.3%',
            background: 'transparent', border: 'none', cursor: 'pointer' }}
        />

        {/* BATTLE GUIDE — far-right tab, shifted down+left per feedback */}
        <button
          onClick={() => setScreen('battle-guide')}
          aria-label="Battle Guide"
          style={{ position: 'absolute', left: '91.6%', top: '59.3%', width: '8.4%', height: '12.5%',
            background: 'transparent', border: 'none', cursor: 'pointer' }}
        />

      </div>
    </div>
  );
}
