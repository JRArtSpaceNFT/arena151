'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useArenaStore } from '@/lib/store';
import { useGameStore } from '@/lib/game-store';
import TeamLockFlow from '@/components/TeamLockFlow';

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
  const { p1Trainer, draftTeamA, lineupA } = useGameStore();
  
  // Team lock state
  const [showTeamLock, setShowTeamLock] = useState(false);
  const [isTeamLocked, setIsTeamLocked] = useState(false);
  
  // Real trainer and team data from game store
  const selectedTrainer = p1Trainer?.id || currentTrainer?.id || null;
  const selectedTeam = draftTeamA.length > 0 ? draftTeamA.map(c => c.id) : [];
  const lockedOrder = lineupA.length > 0 ? lineupA.map((_, idx) => idx) : [];

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
          onClick={() => {
            if (!currentTrainer) {
              setScreen('signup');
            } else {
              // Always go to team builder for paid PVP
              setScreen('team-builder');
            }
          }}
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
          href="https://discord.gg/tW8AqEJRE3"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          <img
            src="/discord-logo.svg"
            alt="Join Discord"
            style={{
              width: 56,
              height: 56,
              filter: 'drop-shadow(0 4px 12px rgba(88,101,242,0.6))',
            }}
          />
        </a>
      </div>

      {/* Team Lock Modal */}
      {showTeamLock && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
          }}
          onClick={() => setShowTeamLock(false)}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500, width: '90%' }}>
            <TeamLockFlow
              trainerId={selectedTrainer}
              team={selectedTeam}
              lockedOrder={lockedOrder}
              onLocked={() => {
                setIsTeamLocked(true);
                setShowTeamLock(false);
                setScreen('room-select');
              }}
            />
            <button
              onClick={() => setShowTeamLock(false)}
              style={{
                marginTop: 16,
                width: '100%',
                padding: 12,
                background: 'rgba(100,116,139,0.5)',
                border: '1px solid rgb(71,85,105)',
                borderRadius: 12,
                color: 'white',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
