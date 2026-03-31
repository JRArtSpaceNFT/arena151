'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useArenaStore } from '@/lib/store';
import { ROOM_TIERS } from '@/lib/constants';

// Pokéball SVG that slowly rotates
function SpinningPokeball() {
  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
      style={{ width: 120, height: 120, position: 'relative' }}
    >
      <svg viewBox="0 0 120 120" width="120" height="120">
        {/* Outer glow */}
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Top half — red */}
        <path d="M 10,60 A 50,50 0 0,1 110,60 Z" fill="#ef4444" filter="url(#glow)" />
        {/* Bottom half — white */}
        <path d="M 10,60 A 50,50 0 0,0 110,60 Z" fill="#f8fafc" />
        {/* Outer circle */}
        <circle cx="60" cy="60" r="50" fill="none" stroke="#1e293b" strokeWidth="4" />
        {/* Center divider line */}
        <line x1="10" y1="60" x2="110" y2="60" stroke="#1e293b" strokeWidth="4" />
        {/* Center button ring */}
        <circle cx="60" cy="60" r="14" fill="#1e293b" />
        <circle cx="60" cy="60" r="9" fill="#f8fafc" />
        <circle cx="60" cy="60" r="4" fill="#e2e8f0" />
      </svg>
    </motion.div>
  );
}

export default function QueueScreen() {
  const { queueState, cancelQueue, setScreen, testingMode, currentTrainer: liveTrainer } = useArenaStore();
  const [elapsed, setElapsed] = useState(0);

  const trainer = liveTrainer ?? queueState.currentTrainer;

  useEffect(() => {
    if (!queueState.searchStartTime) return;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - queueState.searchStartTime!) / 1000));
    }, 1000);
    const matchTimeout = setTimeout(() => {
      setScreen('match-found');
    }, Math.random() * 7000 + 8000);
    return () => { clearInterval(interval); clearTimeout(matchTimeout); };
  }, [queueState.searchStartTime, setScreen]);

  const handleCancel = () => { cancelQueue(); setScreen('room-select'); };
  const room = queueState.roomId ? ROOM_TIERS[queueState.roomId] : null;

  return (
    <div className="h-screen flex flex-col items-center justify-center overflow-hidden relative"
      style={{ background: 'linear-gradient(160deg,#0f0c24 0%,#151030 40%,#0d1a2e 80%,#0a0a1a 100%)' }}>

      {/* Ambient pulse */}
      <motion.div
        animate={{ scale: [1, 1.3, 1], opacity: [0.06, 0.12, 0.06] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, #3b82f6, transparent 70%)' }}
      />

      <div className="relative z-10 w-full max-w-md px-4 flex flex-col items-center gap-4">

        {/* Room badge */}
        {room && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-center gap-3 px-6 py-3 rounded-2xl border"
              style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(12px)' }}>
              <div className="text-left">
                <p className="text-xs uppercase font-bold tracking-widest" style={{ color: 'rgba(255,255,255,0.35)' }}>Entering</p>
                <p className="text-xl font-black text-white">{room.name}</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Main panel */}
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="w-full rounded-2xl px-8 py-6 flex flex-col items-center gap-4 border"
          style={{ background: 'rgba(10,8,30,0.85)', borderColor: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(20px)' }}>

          {/* Pokéball */}
          <div className="relative flex items-center justify-center">
            {/* Outer rotating ring */}
            <motion.div
              animate={{ rotate: -360 }}
              transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
              className="absolute rounded-full"
              style={{ width: 148, height: 148, border: '2px dashed rgba(59,130,246,0.25)' }}
            />
            {/* Second ring */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
              className="absolute rounded-full"
              style={{ width: 168, height: 168, border: '1px solid rgba(59,130,246,0.12)' }}
            />
            {/* Glow behind ball */}
            <motion.div
              animate={{ opacity: [0.3, 0.7, 0.3] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute rounded-full"
              style={{ width: 100, height: 100, background: 'radial-gradient(circle, rgba(239,68,68,0.3), transparent 70%)', filter: 'blur(8px)' }}
            />
            <SpinningPokeball />
          </div>

          {/* Searching text */}
          <div className="text-center">
            <h2 className="text-2xl font-black text-white mb-1" style={{ letterSpacing: '0.02em' }}>
              Searching for Rival
              <motion.span animate={{ opacity: [1, 0, 1] }} transition={{ duration: 1.2, repeat: Infinity }}>...</motion.span>
            </h2>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
              {testingMode ? 'Finding an AI opponent for testing' : 'The arena is finding you a worthy opponent'}
            </p>
            {testingMode && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mt-2 border"
                style={{ background: 'rgba(74,222,128,0.06)', borderColor: 'rgba(74,222,128,0.2)' }}>
                <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                <span className="text-xs font-bold text-green-400">Testing Mode: AI Bot</span>
              </div>
            )}
          </div>

          {/* Timer */}
          <div className="flex items-center gap-2 px-5 py-2 rounded-full border"
            style={{ background: 'rgba(59,130,246,0.08)', borderColor: 'rgba(59,130,246,0.2)' }}>
            <motion.div className="w-2 h-2 bg-blue-400 rounded-full"
              animate={{ opacity: [1, 0.2, 1] }} transition={{ duration: 1, repeat: Infinity }} />
            <span className="font-mono text-xl font-black text-blue-300">
              {Math.floor(elapsed / 60)}:{(elapsed % 60).toString().padStart(2, '0')}
            </span>
          </div>

          {/* Trainer card */}
          {trainer && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
              className="w-full rounded-xl p-3 border flex items-center gap-3"
              style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)' }}>
              <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center border"
                style={{ borderColor: 'rgba(59,130,246,0.3)', background: 'rgba(59,130,246,0.1)' }}>
                {trainer.avatar ? (
                  <img src={trainer.avatar} alt={trainer.displayName} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl">🧑</span>
                )}
              </div>
              <div className="text-left">
                <p className="font-black text-white text-sm">{trainer.displayName}</p>
                <p className="text-xs text-blue-400">@{trainer.username}</p>
                <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  {trainer.record.wins}W · {trainer.record.losses}L
                </p>
              </div>
            </motion.div>
          )}

          {/* Cancel */}
          <button onClick={handleCancel}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-black text-sm transition-all border"
            style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.25)', color: '#f87171' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.15)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.08)')}>
            <X className="w-4 h-4" /> Cancel Search
          </button>
        </motion.div>
      </div>
    </div>
  );
}
