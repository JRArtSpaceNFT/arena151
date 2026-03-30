'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sword, Users, Trophy, Coins, ArrowRight, Medal, Zap, ChevronRight } from 'lucide-react';
import { useArenaStore } from '@/lib/store';

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

const STEP_CARDS = [
  {
    icon: Users,
    emoji: '👤',
    title: 'Choose Trainer',
    desc: 'Select your battle identity',
    bg: 'from-blue-700 to-blue-900',
    border: 'border-blue-400/60',
    iconBg: 'bg-blue-500',
    glow: 'shadow-blue-500/40',
  },
  {
    icon: Sword,
    emoji: '⚔️',
    title: 'Build Team',
    desc: 'Draft your perfect squad',
    bg: 'from-red-700 to-red-900',
    border: 'border-red-400/60',
    iconBg: 'bg-red-500',
    glow: 'shadow-red-500/40',
  },
  {
    icon: Trophy,
    emoji: '⭐',
    title: 'Select Room',
    desc: 'Pick your stakes',
    bg: 'from-amber-600 to-yellow-900',
    border: 'border-yellow-400/60',
    iconBg: 'bg-amber-500',
    glow: 'shadow-amber-500/40',
  },
  {
    icon: Coins,
    emoji: '🆚',
    title: 'Face A Rival',
    desc: 'Battle when matched',
    bg: 'from-blue-700 to-indigo-900',
    border: 'border-indigo-400/60',
    iconBg: 'bg-indigo-500',
    glow: 'shadow-indigo-500/40',
  },
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

  const ev = LIVE_EVENTS[liveIdx];

  return (
    <div
      className="h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{
        backgroundImage: 'url(/road-to-victory-bg.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/50" />

      <div className="relative z-10 w-full max-w-4xl flex flex-col items-center gap-5">

        {/* LIVE ARENA badge */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <div
            className="inline-flex items-center gap-2 px-5 py-1.5 rounded-full text-xs font-black uppercase tracking-widest"
            style={{
              background: 'linear-gradient(135deg, #7b0000 0%, #c0392b 50%, #7b0000 100%)',
              border: '1px solid rgba(255,80,80,0.5)',
              boxShadow: '0 0 20px rgba(200,0,0,0.4)',
            }}
          >
            <span className="w-2 h-2 bg-red-400 rounded-full animate-pulse" />
            <span className="text-red-100">Live Arena</span>
          </div>
        </motion.div>

        {/* ROAD TO VICTORY title */}
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.05 }} className="text-center">
          <h1
            className="text-5xl sm:text-6xl font-black uppercase tracking-tight leading-none"
            style={{
              background: 'linear-gradient(180deg, #ffe066 0%, #fbbf24 40%, #d97706 70%, #92400e 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              textShadow: 'none',
              filter: 'drop-shadow(0 2px 8px rgba(251,191,36,0.5)) drop-shadow(0 0 30px rgba(251,191,36,0.3))',
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
          >
            ROAD TO VICTORY
          </h1>
          {/* Gold rule lines */}
          <div className="flex items-center gap-3 mt-2 justify-center">
            <div className="h-px w-16 bg-gradient-to-r from-transparent to-amber-400/60" />
            <p className="text-sm text-slate-300 font-medium tracking-wide">Build your team. Face real rivals. Write your legend.</p>
            <div className="h-px w-16 bg-gradient-to-l from-transparent to-amber-400/60" />
          </div>
        </motion.div>

        {/* Step Cards */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-4 gap-2 w-full"
        >
          {STEP_CARDS.map((step, i) => (
            <div key={step.title} className="flex items-center gap-1">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.07 }}
                className={`flex-1 flex flex-col items-center text-center p-4 rounded-xl border ${step.border} bg-gradient-to-b ${step.bg} shadow-xl ${step.glow}`}
                style={{
                  boxShadow: `0 4px 24px var(--tw-shadow-color), inset 0 1px 0 rgba(255,255,255,0.1)`,
                }}
              >
                {/* Icon circle */}
                <div className={`w-12 h-12 rounded-full ${step.iconBg} flex items-center justify-center text-2xl mb-2 shadow-lg`}>
                  {step.emoji}
                </div>
                <p className="font-black text-sm text-white uppercase tracking-wide leading-tight">{step.title}</p>
                <p className="text-xs text-white/60 mt-0.5 leading-tight">{step.desc}</p>
              </motion.div>
              {/* Arrow between cards */}
              {i < STEP_CARDS.length - 1 && (
                <div className="flex flex-col gap-0.5 shrink-0">
                  <ChevronRight className="w-4 h-4 text-amber-400/70" />
                  <ChevronRight className="w-4 h-4 text-amber-400/40" />
                </div>
              )}
            </div>
          ))}
        </motion.div>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex flex-col sm:flex-row gap-3 w-full justify-center"
        >
          {currentTrainer ? (
            <>
              {/* Green — Enter the Arena */}
              <button
                onClick={() => setScreen('room-select')}
                className="flex items-center justify-center gap-2 px-8 py-3.5 rounded-lg font-black uppercase tracking-widest text-sm text-white transition-all hover:brightness-110 active:scale-95"
                style={{
                  background: 'linear-gradient(180deg, #22c55e 0%, #16a34a 50%, #15803d 100%)',
                  border: '2px solid rgba(134,239,172,0.5)',
                  boxShadow: '0 4px 20px rgba(34,197,94,0.4), inset 0 1px 0 rgba(255,255,255,0.2)',
                }}
              >
                <Zap className="w-4 h-4" />
                Enter the Arena
              </button>

              {/* Blue — View Profile */}
              <button
                onClick={() => setScreen('profile')}
                className="flex items-center justify-center gap-2 px-8 py-3.5 rounded-lg font-black uppercase tracking-widest text-sm text-white transition-all hover:brightness-110 active:scale-95"
                style={{
                  background: 'linear-gradient(180deg, #3b82f6 0%, #2563eb 50%, #1d4ed8 100%)',
                  border: '2px solid rgba(147,197,253,0.5)',
                  boxShadow: '0 4px 20px rgba(59,130,246,0.4), inset 0 1px 0 rgba(255,255,255,0.2)',
                }}
              >
                View Profile
              </button>

              {/* Gold — Leaderboard */}
              <button
                onClick={() => setScreen('leaderboard')}
                className="flex items-center justify-center gap-2 px-8 py-3.5 rounded-lg font-black uppercase tracking-widest text-sm text-white transition-all hover:brightness-110 active:scale-95"
                style={{
                  background: 'linear-gradient(180deg, #fbbf24 0%, #d97706 50%, #b45309 100%)',
                  border: '2px solid rgba(253,230,138,0.5)',
                  boxShadow: '0 4px 20px rgba(251,191,36,0.4), inset 0 1px 0 rgba(255,255,255,0.2)',
                  color: '#1c1000',
                }}
              >
                <Medal className="w-4 h-4" />
                Leaderboard
              </button>
            </>
          ) : (
            <>
              {/* Green — Create Trainer */}
              <button
                onClick={() => setScreen('signup')}
                className="flex items-center justify-center gap-2 px-8 py-3.5 rounded-lg font-black uppercase tracking-widest text-sm text-white transition-all hover:brightness-110 active:scale-95"
                style={{
                  background: 'linear-gradient(180deg, #22c55e 0%, #16a34a 50%, #15803d 100%)',
                  border: '2px solid rgba(134,239,172,0.5)',
                  boxShadow: '0 4px 20px rgba(34,197,94,0.4), inset 0 1px 0 rgba(255,255,255,0.2)',
                }}
              >
                <ArrowRight className="w-4 h-4" />
                Create Trainer Profile
              </button>

              {/* Gold — Leaderboard */}
              <button
                onClick={() => setScreen('leaderboard')}
                className="flex items-center justify-center gap-2 px-8 py-3.5 rounded-lg font-black uppercase tracking-widest text-sm transition-all hover:brightness-110 active:scale-95"
                style={{
                  background: 'linear-gradient(180deg, #fbbf24 0%, #d97706 50%, #b45309 100%)',
                  border: '2px solid rgba(253,230,138,0.5)',
                  boxShadow: '0 4px 20px rgba(251,191,36,0.4), inset 0 1px 0 rgba(255,255,255,0.2)',
                  color: '#1c1000',
                }}
              >
                <Medal className="w-4 h-4" />
                Leaderboard
              </button>

              {/* Blue — Back */}
              <button
                onClick={() => setScreen('home')}
                className="flex items-center justify-center gap-2 px-8 py-3.5 rounded-lg font-black uppercase tracking-widest text-sm text-white transition-all hover:brightness-110 active:scale-95"
                style={{
                  background: 'linear-gradient(180deg, #3b82f6 0%, #2563eb 50%, #1d4ed8 100%)',
                  border: '2px solid rgba(147,197,253,0.5)',
                  boxShadow: '0 4px 20px rgba(59,130,246,0.4), inset 0 1px 0 rgba(255,255,255,0.2)',
                }}
              >
                Back to Home
              </button>
            </>
          )}
        </motion.div>

        {/* Live Activity Feed */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="w-full rounded-xl p-3 px-4"
          style={{
            background: 'rgba(0,0,0,0.55)',
            border: '1px solid rgba(255,255,255,0.1)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-xs font-black text-green-400 uppercase tracking-widest">Live Activity</span>
            <span className="ml-auto text-xs text-slate-400 font-medium">247 trainers online</span>
          </div>
          <div className="h-6 overflow-hidden">
            <AnimatePresence mode="wait">
              {visible && (
                <motion.div
                  key={liveIdx}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25 }}
                  className="flex items-center gap-2 text-sm"
                >
                  <span>{ev.emoji}</span>
                  <span className={`font-black ${ev.color}`}>{ev.trainer}</span>
                  <span className="text-slate-400">{ev.action}</span>
                  <span className="font-bold text-white">{ev.detail}</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

      </div>
    </div>
  );
}
