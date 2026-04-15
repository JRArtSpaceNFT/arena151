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
          Hit zones — pixel-accurate from image analysis of ttt.png (2605×1080)
          All % = px / design dimension

          PROFILE:          x18-350,    y12-90    → left:0.7%  top:1.1%  w:12.7% h:7.2%
          LEADERBOARD:      x0-320,     y600-680  → left:0.0%  top:55.6% w:12.3% h:7.4%
          ENTER THE ARENA:  x820-1720,  y455-510  → left:31.5% top:42.1% w:34.6% h:5.1%
          BATTLE GUIDE:     x2340-2605, y380-660  → left:89.8% top:35.2% w:10.2% h:25.9%
        */}

        {/* PROFILE */}
        <button
          onClick={() => setScreen(currentTrainer ? 'profile' : 'signup')}
          aria-label="View Profile"
          style={{ position: 'absolute', left: '0.7%', top: '1.1%', width: '12.7%', height: '7.2%',
            background: 'transparent', border: 'none', cursor: 'pointer' }}
        />

        {/* LEADERBOARD — nudged right */}
        <button
          onClick={() => setScreen('leaderboard')}
          aria-label="Leaderboard"
          style={{ position: 'absolute', left: '1.5%', top: '55.6%', width: '12.3%', height: '7.4%',
            background: 'transparent', border: 'none', cursor: 'pointer' }}
        />

        {/* ENTER THE ARENA — nudged lower */}
        <button
          onClick={() => currentTrainer ? setScreen('room-select') : setScreen('signup')}
          aria-label="Enter the Arena"
          style={{ position: 'absolute', left: '31.5%', top: '73%', width: '34.6%', height: '5.1%',
            background: 'transparent', border: 'none', cursor: 'pointer' }}
        />

        {/* BATTLE GUIDE — lower and more to the left */}
        <button
          onClick={() => setScreen('battle-guide')}
          aria-label="Battle Guide"
          style={{ position: 'absolute', left: '87.0%', top: '48%', width: '10.2%', height: '25.9%',
            background: 'transparent', border: 'none', cursor: 'pointer' }}
        />

      </div>

      {/* Discord link with animated yellow arrow — fixed to viewport bottom-LEFT (like all other pages) */}
      <div style={{
        position: 'fixed',
        bottom: 20,
        left: 12,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
      }}>
        {/* Animated yellow arrow pointing down */}
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            fontSize: 32,
            filter: 'drop-shadow(0 2px 8px rgba(250, 204, 21, 0.8))',
          }}
        >
          👇
        </motion.div>

        <a
          href="https://discord.gg/QxZJUCzT"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 18px',
            background: 'rgba(88, 101, 242, 0.95)',
            border: '2px solid rgba(255,255,255,0.2)',
            borderRadius: 10,
            color: '#fff',
            fontSize: 14,
            fontWeight: 700,
            textDecoration: 'none',
            boxShadow: '0 4px 16px rgba(88,101,242,0.5)',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 6px 20px rgba(88,101,242,0.7)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 16px rgba(88,101,242,0.5)';
          }}
        >
          <svg width="20" height="20" viewBox="0 0 71 55" fill="none" xmlns="http://www.w3.org/2000/svg">
            <g clipPath="url(#clip0)">
              <path d="M60.1045 4.8978C55.5792 2.8214 50.7265 1.2916 45.6527 0.41542C45.5603 0.39851 45.468 0.440769 45.4204 0.525289C44.7963 1.6353 44.105 3.0834 43.6209 4.2216C38.1637 3.4046 32.7345 3.4046 27.3892 4.2216C26.905 3.0581 26.1886 1.6353 25.5617 0.525289C25.5141 0.443589 25.4218 0.40133 25.3294 0.41542C20.2584 1.2888 15.4057 2.8186 10.8776 4.8978C10.8384 4.9147 10.8048 4.9429 10.7825 4.9795C1.57795 18.7309 -0.943561 32.1443 0.293408 45.3914C0.299005 45.4562 0.335386 45.5182 0.385761 45.5576C6.45866 50.0174 12.3413 52.7249 18.1147 54.5195C18.2071 54.5477 18.305 54.5139 18.3638 54.4378C19.7295 52.5728 20.9469 50.6063 21.9907 48.5383C22.0523 48.4172 21.9935 48.2735 21.8676 48.2256C19.9366 47.4931 18.0979 46.6 16.3292 45.5858C16.1893 45.5041 16.1781 45.304 16.3068 45.2082C16.679 44.9293 17.0513 44.6391 17.4067 44.3461C17.471 44.2926 17.5606 44.2813 17.6362 44.3151C29.2558 49.6202 41.8354 49.6202 53.3179 44.3151C53.3935 44.2785 53.4831 44.2898 53.5502 44.3433C53.9057 44.6363 54.2779 44.9293 54.6529 45.2082C54.7816 45.304 54.7732 45.5041 54.6333 45.5858C52.8646 46.6197 51.0259 47.4931 49.0921 48.2228C48.9662 48.2707 48.9102 48.4172 48.9718 48.5383C50.038 50.6034 51.2554 52.5699 52.5959 54.435C52.6519 54.5139 52.7526 54.5477 52.845 54.5195C58.6464 52.7249 64.529 50.0174 70.6019 45.5576C70.6551 45.5182 70.6887 45.459 70.6943 45.3942C72.1747 30.0791 68.2147 16.7757 60.1968 4.9823C60.1772 4.9429 60.1437 4.9147 60.1045 4.8978ZM23.7259 37.3253C20.2276 37.3253 17.3451 34.1136 17.3451 30.1693C17.3451 26.225 20.1717 23.0133 23.7259 23.0133C27.308 23.0133 30.1626 26.2532 30.1066 30.1693C30.1066 34.1136 27.28 37.3253 23.7259 37.3253ZM47.3178 37.3253C43.8196 37.3253 40.9371 34.1136 40.9371 30.1693C40.9371 26.225 43.7636 23.0133 47.3178 23.0133C50.9 23.0133 53.7545 26.2532 53.6986 30.1693C53.6986 34.1136 50.9 37.3253 47.3178 37.3253Z" fill="white"/>
            </g>
            <defs>
              <clipPath id="clip0">
                <rect width="71" height="55" fill="white"/>
              </clipPath>
            </defs>
          </svg>
          <span>Join Discord</span>
        </a>
      </div>
    </div>
  );
}
