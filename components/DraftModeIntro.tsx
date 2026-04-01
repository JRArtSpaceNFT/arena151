'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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

const LIVE_EVENTS = [
  { trainer: 'TrainerRed', action: 'just won', detail: 'Indigo Plateau', emoji: '🏆', color: 'text-green-400' },
  { trainer: 'MistyFan99', action: 'is on a 5-win streak at', detail: 'Cerulean City Arena', emoji: '🔥', color: 'text-orange-400' },
  { trainer: 'DragonMaster', action: 'defeated', detail: 'Lance with a 3-0 sweep', emoji: '⚔️', color: 'text-red-400' },
  { trainer: 'PikaMaster', action: 'just lost at', detail: 'Viridian Ground Arena', emoji: '💫', color: 'text-slate-400' },
  { trainer: 'AshKetchum99', action: 'is battling in', detail: 'Final Four Ice Arena', emoji: '❄️', color: 'text-cyan-400' },
  { trainer: 'GaryOakFan', action: 'won 3 in a row at', detail: 'Vermilion Electric Arena', emoji: '⚡', color: 'text-yellow-400' },
  { trainer: 'EeveeLover', action: 'just joined the queue for', detail: 'Master Ball Room', emoji: '👑', color: 'text-purple-400' },
  { trainer: 'ChaosAgent', action: 'pulled off a comeback win at', detail: 'Team Rocket Hideout', emoji: '😈', color: 'text-red-400' },
  { trainer: 'IceQueenFan', action: 'is on a 8-win streak in', detail: 'Elite Clash', emoji: '🌟', color: 'text-amber-400' },
  { trainer: 'BrockArmy', action: 'just lost to', detail: 'Mewtwo at the Underground Lab', emoji: '💀', color: 'text-slate-400' },
  { trainer: 'SabrinaMain', action: 'swept with Alakazam at', detail: 'Saffron Psychic Chamber', emoji: '🔮', color: 'text-fuchsia-400' },
  { trainer: 'BlazeMaster', action: 'won with a last-second Charizard at', detail: 'Cinnabar Volcano', emoji: '🌋', color: 'text-orange-400' },
  { trainer: 'GhostWhisperer', action: 'poisoned their way to victory at', detail: 'Fuchsia Poison Dojo', emoji: '☠️', color: 'text-purple-400' },
  { trainer: 'LaprasRider', action: 'just claimed first place on', detail: 'the Leaderboard', emoji: '🥇', color: 'text-yellow-400' },
  { trainer: 'DragonTamer', action: 'challenged', detail: 'Victory Road for the 10th time', emoji: '🐉', color: 'text-green-400' },
  { trainer: 'RocketAgent47', action: 'lost a close one at', detail: 'Pewter City Rock Arena', emoji: '🪨', color: 'text-slate-400' },
  { trainer: 'NidokingMain', action: 'is dominating', detail: 'Gym Challenger tier', emoji: '👊', color: 'text-green-400' },
  { trainer: 'StarmieGod', action: 'just swept 4-0 at', detail: 'Cerulean Water Arena', emoji: '💧', color: 'text-blue-400' },
];

export default function DraftModeIntro() {
  const { currentTrainer, setScreen } = useArenaStore();
  const [liveIdx, setLiveIdx] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const iv = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setLiveIdx(i => (i + 1) % LIVE_EVENTS.length);
        setVisible(true);
      }, 300);
    }, 2600);
    return () => clearInterval(iv);
  }, []);

  // Crowd cheer is now managed at app level (page.tsx) to persist across screens

  const ev = LIVE_EVENTS[liveIdx];

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

      {/* Live Activity Feed — floats at very bottom */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="absolute bottom-0 left-0 right-0 px-4 py-2 flex items-center gap-3"
        style={{
          background: 'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(8px)',
          borderTop: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse shrink-0" />
        <span className="text-xs font-black text-green-400 uppercase tracking-widest shrink-0">Live</span>
        <div className="flex-1 overflow-hidden h-5">
          <AnimatePresence mode="wait">
            {visible && (
              <motion.div
                key={liveIdx}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
                className="flex items-center gap-2 text-xs"
              >
                <span>{ev.emoji}</span>
                <span className={`font-black ${ev.color}`}>{ev.trainer}</span>
                <span className="text-slate-400">{ev.action}</span>
                <span className="font-bold text-white">{ev.detail}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <span className="text-xs text-slate-500 shrink-0">247 online</span>
      </motion.div>

    </div>
  );
}
