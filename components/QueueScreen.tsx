'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useArenaStore } from '@/lib/store';
import { ROOM_TIERS } from '@/lib/constants';

export default function QueueScreen() {
  const { queueState, cancelQueue, setScreen, testingMode, currentTrainer: liveTrainer } = useArenaStore();
  const [elapsed, setElapsed] = useState(0);

  // Use live trainer so avatar changes are always current
  const trainer = liveTrainer ?? queueState.currentTrainer;

  useEffect(() => {
    if (!queueState.searchStartTime) return;

    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - queueState.searchStartTime!) / 1000));
    }, 1000);

    // Simulate match found after 8-15 seconds
    const matchTimeout = setTimeout(() => {
      setScreen('match-found');
    }, Math.random() * 7000 + 8000);

    return () => {
      clearInterval(interval);
      clearTimeout(matchTimeout);
    };
  }, [queueState.searchStartTime, setScreen]);

  const handleCancel = () => {
    cancelQueue();
    setScreen('room-select');
  };

  const room = queueState.roomId ? ROOM_TIERS[queueState.roomId] : null;

  return (
    <div className="min-h-screen flex items-center justify-center p-8 pokeball-pattern relative overflow-hidden">
      {/* Ambient pulsing effect */}
      <motion.div
        animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.15, 0.1] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-500 rounded-full blur-3xl pointer-events-none"
      />

      <div className="relative z-10 max-w-lg w-full">
        {/* Room badge */}
        {room && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <div className={`inline-flex items-center gap-3 glass-panel px-8 py-4 rounded-2xl border-2 bg-gradient-to-r ${room.color} bg-opacity-10`}>
              <div className="text-left">
                <p className="text-sm text-slate-400 uppercase font-semibold">Entering</p>
                <p className="text-2xl font-black">{room.name}</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Searching panel */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-panel rounded-2xl p-12 text-center"
        >
          {/* Radar */}
          <div className="relative w-48 h-48 mx-auto mb-8">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              className="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-500 border-r-cyan-500"
            />
            <motion.div
              animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute inset-0 rounded-full bg-blue-500/20"
            />
            <div className="absolute inset-0 flex items-center justify-center text-6xl">🎯</div>
          </div>

          <h2 className="text-3xl font-black mb-3 text-blue-300" style={{ textShadow: '0 0 10px currentColor, 0 0 20px currentColor' }}>
            Searching for Rival...
          </h2>
          {testingMode && (
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-950/30 border border-green-500/50 rounded-full mb-3">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-sm font-bold text-green-400">Testing Mode: AI Bot</span>
            </div>
          )}
          <p className="text-slate-400 mb-6">
            {testingMode ? 'Finding an AI opponent for testing' : 'The arena is finding you a worthy opponent'}
          </p>

          {/* Timer */}
          <div className="inline-flex items-center gap-3 glass-panel px-6 py-3 rounded-full mb-8">
            <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse" />
            <span className="font-mono text-2xl font-bold">
              {Math.floor(elapsed / 60)}:{(elapsed % 60).toString().padStart(2, '0')}
            </span>
          </div>

          {/* Trainer card */}
          {trainer && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="glass-panel p-6 rounded-xl max-w-sm mx-auto mb-8"
            >
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 border-2 border-blue-500 overflow-hidden flex-shrink-0">
                  {trainer.avatar ? (
                    <img src={trainer.avatar} alt={trainer.displayName} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-3xl">🧑‍🦱</div>
                  )}
                </div>
                <div className="text-left flex-1">
                  <p className="font-bold text-lg">{trainer.displayName}</p>
                  <p className="text-sm text-blue-400">@{trainer.username}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {trainer.record.wins}W - {trainer.record.losses}L
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Cancel */}
          <button
            onClick={handleCancel}
            className="arena-button-danger flex items-center gap-2 mx-auto"
          >
            <X className="w-5 h-5" />
            Cancel Search
          </button>
        </motion.div>
      </div>
    </div>
  );
}
