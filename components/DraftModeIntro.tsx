'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useArenaStore } from '@/lib/store';

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

  return (
    <div className="h-screen flex flex-col relative overflow-hidden bg-black">

      {/* Background image — left-anchored so Profile/Leaderboard signs stay visible */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: 'url(/ttt.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'left top',
          backgroundRepeat: 'no-repeat',
        }}
      />

      {/* Shimmer sweep — slow diagonal light pass */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{
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
          className="absolute pointer-events-none"
          style={{ left: s.x, top: s.y }}
          animate={{ opacity: [0, 1, 0], scale: [0.3, 1, 0.3], rotate: [0, 35, 0] }}
          transition={{ duration: s.duration, delay: s.delay, repeat: Infinity, ease: 'easeInOut', repeatDelay: s.duration }}
        >
          <SparkleIcon size={s.size} color="rgba(255,240,160,0.85)" />
        </motion.div>
      ))}

      {/* ── Hit zones — image 2605×1080, backgroundPosition: left top, cover ──
          scale = screenH/1080, no left crop
          ENTER:        x600-920, y468-523 → left≈34.7% top≈43.3%
          PROFILE:      x22-177,  y5-40   → left≈1.3%  top≈0.5%
          LEADERBOARD:  x10-210,  y338-403 → left≈0.6%  top≈31.3%
          GUIDE:        x1330-1530,y345-445→ left≈77%   top≈31.9%
      */}

      {/* ENTER THE ARENA — center */}
      <button
        onClick={() => currentTrainer ? setScreen('room-select') : setScreen('signup')}
        aria-label="Enter the Arena"
        className="absolute cursor-pointer focus:outline-none"
        style={{ left: '43%', top: '72%', width: '18.5%', height: '8%' }}
      />


      {/* PROFILE — top left */}
      <button
        onClick={() => setScreen(currentTrainer ? 'profile' : 'signup')}
        aria-label="View Profile"
        className="absolute cursor-pointer focus:outline-none"
        style={{ left: '4.5%', top: '0.5%', width: '9%', height: '5%' }}
      />

      {/* LEADERBOARD — left side */}
      <button
        onClick={() => setScreen('leaderboard')}
        aria-label="Leaderboard"
        className="absolute cursor-pointer focus:outline-none"
        style={{ left: '3%', top: '55%', width: '11.6%', height: '8%' }}
      />

      {/* BATTLE GUIDE — right side */}
      <button
        onClick={() => setScreen('battle-guide')}
        aria-label="Battle Guide"
        className="absolute cursor-pointer focus:outline-none"
        style={{ left: '86%', top: '54%', width: '11.6%', height: '9.3%' }}
      />

      {/* Fair Gaming & Legal link */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        onClick={() => setScreen('fair-gaming')}
        className="absolute bottom-12 right-4 text-xs font-bold px-3 py-1.5 rounded-lg border transition-all hover:border-purple-500/40 hover:text-purple-300"
        style={{
          background: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(6px)',
          borderColor: 'rgba(255,255,255,0.1)',
          color: 'rgba(255,255,255,0.4)',
        }}
      >
        🛡️ Fair Gaming &amp; Legal
      </motion.button>



    </div>
  );
}
