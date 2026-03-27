'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useArenaStore } from '@/lib/store';
import { playMusic, resumeAudioContext } from '@/lib/audio/musicEngine';
import { getSession } from '@/lib/auth';
import type { PokemonType } from '@/types';

export default function HomePage() {
  const { setScreen, setTrainer, currentTrainer } = useArenaStore();

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

  const handleEnterArena = () => {
    if (currentTrainer) {
      setScreen('draft-mode-intro');
    } else {
      setScreen('signup');
    }
  };

  return (
    <div className="h-screen overflow-hidden relative bg-black">
      {/* Hero Image — covers the full screen */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/home-hero.png"
        alt="Arena 151 — Draft Battle Conquer"
        className="absolute inset-0 w-full h-full object-cover object-center select-none"
        draggable={false}
      />

      {/* Invisible clickable overlay over the "ENTER THE ARENA" button in the image */}
      <button
        onClick={handleEnterArena}
        aria-label="Enter the Arena"
        className="absolute group"
        style={{
          top: '77%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '32%',
          height: '10%',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        <span
          className="block w-full h-full rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          style={{ boxShadow: '0 0 0 3px rgba(255,255,255,0.45), 0 0 18px 4px rgba(59,130,246,0.5)' }}
        />
      </button>

      {/* Live Activity Feed — overlaid at bottom of screen */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.6 }}
        className="absolute bottom-4 left-1/2 -translate-x-1/2 w-full max-w-xl px-4"
      >
        <div className="rounded-xl px-3 py-2 overflow-hidden"
          style={{ background: 'rgba(10,15,30,0.75)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-xs font-bold text-green-400 uppercase tracking-wide">Live Activity</span>
            <span className="ml-auto text-xs text-slate-400">247 trainers online</span>
          </div>
          <div className="h-6 flex items-center overflow-hidden">
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
        </div>
      </motion.div>
    </div>
  );
}
