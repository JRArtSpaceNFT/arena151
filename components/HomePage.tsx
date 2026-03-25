'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Zap, Users, Sword } from 'lucide-react';
import { useArenaStore } from '@/lib/store';
import { playMusic, resumeAudioContext } from '@/lib/audio/musicEngine';
import { getSession } from '@/lib/auth';
import { POKEMON_DATABASE } from '@/lib/pokemon-data';
import type { PokemonType } from '@/types';

export default function HomePage() {
  const { setScreen, setTrainer, currentTrainer } = useArenaStore();

  // Simulated live activity feed (same style as RoomSelect)
  const LIVE_EVENTS = [
    { trainer: 'AshKetchum99', action: 'just won', detail: 'Pallet Town Arena', emoji: '🏆' },
    { trainer: 'MistyWaterflower', action: 'is battling in', detail: 'Cerulean City', emoji: '⚔️' },
    { trainer: 'BrockRocks', action: 'drafted', detail: 'Onix + Geodude team', emoji: '🪨' },
    { trainer: 'GaryOakFan', action: 'just lost in', detail: 'Victory Road', emoji: '💫' },
    { trainer: 'TrainerRed', action: 'joined the queue for', detail: 'Indigo Plateau', emoji: '🔥' },
    { trainer: 'PikaMaster', action: 'won 3 in a row at', detail: 'Vermilion City', emoji: '⚡' },
    { trainer: 'EeveeLover', action: 'is climbing', detail: 'Celadon City ranks', emoji: '🌟' },
    { trainer: 'DragonTamer', action: 'challenged', detail: 'Victory Road', emoji: '🐉' },
  ];
  const [liveIdx, setLiveIdx] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setLiveIdx(i => (i + 1) % LIVE_EVENTS.length), 2800);
    return () => clearInterval(iv);
  }, []);

  // Restore session on load
  useEffect(() => {
    const session = getSession();
    if (session) {
      setTrainer({
        id: session.id,
        email: session.email,
        username: session.username,
        displayName: session.displayName,
        bio: session.bio,
        avatar: session.avatar,
        favoritePokemon: {
          id: session.favoritePokemonId,
          name: session.favoritePokemonName,
          sprite: '',
          types: session.favoritePokemonTypes as PokemonType[],
          stats: { hp: 100, attack: 100, defense: 100, spAttack: 100, spDefense: 100, speed: 100 },
        },
        joinedDate: new Date(session.joinedDate),
        record: { wins: session.wins, losses: session.losses },
        internalWalletId: session.internalWalletId,
        balance: session.balance,
        earnings: session.earnings ?? 0,
      });
    }
  }, [setTrainer]);

  // Start intro music on first interaction
  useEffect(() => {
    const startMusic = () => {
      resumeAudioContext();
      playMusic('menu');
      document.removeEventListener('click', startMusic);
      document.removeEventListener('keydown', startMusic);
    };
    document.addEventListener('click', startMusic);
    document.addEventListener('keydown', startMusic);
    return () => {
      document.removeEventListener('click', startMusic);
      document.removeEventListener('keydown', startMusic);
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 pokeball-pattern relative overflow-hidden">
      {/* Ambient light effects */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-blue-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-red-500/10 rounded-full blur-3xl" />

      <div className="relative z-10 max-w-6xl w-full">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="mb-6"
          >
            <h1 className="text-8xl font-black mb-4 arena-glow bg-gradient-to-r from-blue-400 via-cyan-300 to-blue-400 bg-clip-text text-transparent">
              ARENA 151
            </h1>
            <div className="h-1 w-48 mx-auto bg-gradient-to-r from-transparent via-cyan-500 to-transparent" />
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="text-3xl font-bold text-blue-300 mb-4"
          >
            Build Your Legend
          </motion.p>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="text-xl text-slate-400 max-w-2xl mx-auto"
          >
            Enter the arena. Face real rivals. Every battle tells your story.
          </motion.p>
        </motion.div>

        {/* Feature Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.6 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16"
        >
          {[
            { icon: Trophy, title: 'Competitive Draft', desc: 'Strategic team building' },
            { icon: Sword, title: 'Real Stakes', desc: 'SOL-backed battles' },
            { icon: Users, title: 'Build Your Identity', desc: 'Public trainer records' },
            { icon: Zap, title: 'Live Arena', desc: 'Face rivals in real-time' },
          ].map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 + i * 0.1, duration: 0.5 }}
              className="glass-panel p-6 rounded-xl text-center group hover:border-blue-500/50 transition-all"
            >
              <feature.icon className="w-12 h-12 mx-auto mb-4 text-blue-400 group-hover:text-cyan-400 transition-colors" />
              <h3 className="font-bold text-lg mb-2">{feature.title}</h3>
              <p className="text-slate-400 text-sm">{feature.desc}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1, duration: 0.6 }}
          className="flex flex-col sm:flex-row gap-6 justify-center items-center"
        >
          {currentTrainer ? (
            <>
              <button onClick={() => setScreen('draft-mode-intro')}
                className="text-lg px-12 py-5 rounded-lg font-bold tracking-wide uppercase bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 shadow-lg shadow-blue-500/50 flex items-center gap-3 transition-all hover:scale-105 active:scale-95">
                <Zap className="w-6 h-6" />
                Road to Victory
              </button>
              <button onClick={() => setScreen('profile')}
                className="glass-panel px-12 py-5 rounded-lg font-bold tracking-wide uppercase text-lg hover:border-blue-500/50 transition-all hover:shadow-lg hover:shadow-blue-500/20">
                My Profile
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setScreen('signup')}
                className="text-lg px-12 py-5 rounded-lg font-bold tracking-wide uppercase bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 shadow-lg shadow-blue-500/50 flex items-center gap-3 transition-all hover:scale-105 active:scale-95">
                <Zap className="w-6 h-6" />
                Enter the Arena
              </button>
              <button onClick={() => setScreen('draft-mode-intro')}
                className="glass-panel px-12 py-5 rounded-lg font-bold tracking-wide uppercase text-lg hover:border-blue-500/50 transition-all hover:shadow-lg hover:shadow-blue-500/20">
                Learn More
              </button>
            </>
          )}
        </motion.div>

        {/* SOL Notice */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.6 }}
          className="mt-12 text-center"
        >
          <div className="inline-flex items-center gap-3 glass-panel px-6 py-3 rounded-full">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
            <p className="text-sm font-semibold text-slate-300">
              Powered by <span className="text-purple-400 font-bold">Solana</span> • SOL only
            </p>
          </div>
        </motion.div>

        {/* Live Activity Feed */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.4, duration: 0.6 }}
          className="mt-6 glass-panel rounded-xl p-3 max-w-xl mx-auto overflow-hidden"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-xs font-bold text-green-400 uppercase tracking-wide">Live Activity</span>
            <span className="ml-auto text-xs text-slate-500">247 trainers online</span>
          </div>
          <div className="h-8 flex items-center overflow-hidden">
            <motion.div
              key={liveIdx}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35 }}
              className="flex items-center gap-2 text-sm w-full"
            >
              <span className="text-base">{LIVE_EVENTS[liveIdx].emoji}</span>
              <span className="font-bold text-blue-300">{LIVE_EVENTS[liveIdx].trainer}</span>
              <span className="text-slate-400">{LIVE_EVENTS[liveIdx].action}</span>
              <span className="font-semibold text-slate-200">{LIVE_EVENTS[liveIdx].detail}</span>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
