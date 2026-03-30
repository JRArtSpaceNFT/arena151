'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sword, Users, Trophy, Coins, ArrowRight, Medal, Zap } from 'lucide-react';
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

  const steps = [
    { icon: Users, title: 'Choose Trainer', desc: 'Select your battle identity' },
    { icon: Sword, title: 'Build Team', desc: 'Draft your perfect squad' },
    { icon: Trophy, title: 'Select Room', desc: 'Pick your stakes' },
    { icon: Coins, title: 'Face A Rival', desc: 'Battle when matched' },
  ];

  const ev = LIVE_EVENTS[liveIdx];

  return (
    <div className="h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{
        backgroundImage: 'url(/road-to-victory-bg.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* Dark overlay for readability */}
      <div className="absolute inset-0 bg-black/55" />
      {/* Ambient effects */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-red-500/10 rounded-full blur-3xl" />

      <div className="relative z-10 max-w-3xl w-full">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-4">
          <div className="inline-flex items-center gap-2 glass-panel px-4 py-2 rounded-full mb-3">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="font-bold text-red-400 uppercase text-xs tracking-wide">Live Arena</span>
          </div>
          <h1 className="text-4xl font-black arena-glow bg-gradient-to-r from-red-400 via-pink-400 to-red-400 bg-clip-text text-transparent">
            ROAD TO VICTORY
          </h1>
          <p className="text-sm text-slate-400 mt-1">Build your team. Face real rivals. Write your legend.</p>
        </motion.div>

        {/* Steps */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-panel rounded-xl p-4 mb-3">
          <div className="grid grid-cols-4 gap-3">
            {steps.map((step, i) => (
              <motion.div key={step.title} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.07 }} className="flex flex-col items-center text-center gap-2">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/30">
                  <step.icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-bold text-sm">{step.title}</p>
                  <p className="text-slate-400 text-xs">{step.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* CTA Buttons */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="flex flex-col sm:flex-row gap-3 justify-center items-center mb-3">
          {currentTrainer ? (
            <>
              <button
                onClick={() => setScreen('room-select')}
                className="glass-panel px-10 py-4 rounded-lg font-bold tracking-wide uppercase text-base hover:border-blue-500/50 transition-all flex items-center gap-2 text-blue-300"
              >
                <Zap className="w-5 h-5" />
                Enter the Arena
              </button>
              <button
                onClick={() => setScreen('profile')}
                className="glass-panel px-10 py-4 rounded-lg font-bold tracking-wide uppercase text-base hover:border-blue-500/50 transition-all"
              >
                View Profile
              </button>
              <button
                onClick={() => setScreen('leaderboard')}
                className="glass-panel px-10 py-4 rounded-lg font-bold tracking-wide uppercase text-base hover:border-amber-500/50 transition-all flex items-center gap-2 text-amber-400"
              >
                <Medal className="w-5 h-5" />
                Leaderboard
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setScreen('signup')}
                className="glass-panel px-10 py-4 rounded-lg font-bold tracking-wide uppercase text-base hover:border-blue-500/50 transition-all flex items-center gap-2 text-blue-300"
              >
                <ArrowRight className="w-5 h-5" />
                Create Trainer Profile
              </button>
              <button
                onClick={() => setScreen('leaderboard')}
                className="glass-panel px-10 py-4 rounded-lg font-bold tracking-wide uppercase text-base hover:border-amber-500/50 transition-all flex items-center gap-2 text-amber-400"
              >
                <Medal className="w-5 h-5" />
                Leaderboard
              </button>
              <button
                onClick={() => setScreen('home')}
                className="glass-panel px-10 py-4 rounded-lg font-bold tracking-wide uppercase text-base hover:border-blue-500/50 transition-all"
              >
                Back to Home
              </button>
            </>
          )}
        </motion.div>

        {/* Live Activity Feed */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="glass-panel rounded-xl p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-xs font-bold text-green-400 uppercase tracking-wide">Live Activity</span>
            <span className="ml-auto text-xs text-slate-500">247 trainers online</span>
          </div>
          <div className="h-7 overflow-hidden">
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
                  <span className="text-base">{ev.emoji}</span>
                  <span className={`font-bold ${ev.color}`}>{ev.trainer}</span>
                  <span className="text-slate-400">{ev.action}</span>
                  <span className="font-semibold text-slate-200">{ev.detail}</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
