'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useArenaStore } from '@/lib/store';

export default function VersusScreen() {
  const { currentMatch, setScreen } = useArenaStore();

  useEffect(() => {
    // Auto-advance to game after dramatic pause
    const timeout = setTimeout(() => {
      setScreen('game'); // Enter the full battle game flow
    }, 4000);

    return () => clearTimeout(timeout);
  }, [setScreen]);

  if (!currentMatch) return null;

  return (
    <div className="h-screen flex items-center justify-center relative overflow-hidden bg-black">
      {/* Split screen effect */}
      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="absolute inset-0 origin-left bg-gradient-to-r from-blue-600 to-cyan-600"
      />
      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="absolute inset-0 origin-right bg-gradient-to-l from-red-600 to-rose-600"
      />

      {/* Diagonal split lightning */}
      <motion.div
        initial={{ scaleY: 0 }}
        animate={{ scaleY: 1 }}
        transition={{ delay: 0.5, duration: 0.3 }}
        className="absolute inset-0 flex items-center justify-center"
      >
        <div className="w-1 h-full bg-white shadow-[0_0_50px_rgba(255,255,255,1)]" />
      </motion.div>

      {/* Player 1 side */}
      <motion.div
        initial={{ x: -100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ delay: 0.8, duration: 0.5 }}
        className="absolute left-0 top-1/2 -translate-y-1/2 w-1/2 flex flex-col items-center"
      >
        <div className="w-48 h-48 rounded-full bg-slate-900 border-8 border-white shadow-2xl mb-6 overflow-hidden flex items-center justify-center">
          {currentMatch.player1.avatar ? (
            <img src={currentMatch.player1.avatar} alt={currentMatch.player1.displayName} className="w-full h-full object-cover" />
          ) : (
            <span className="text-8xl">🧑‍🦱</span>
          )}
        </div>
        <h2 className="text-5xl font-black text-white mb-2 text-shadow">
          {currentMatch.player1.displayName}
        </h2>
        <p className="text-2xl text-cyan-200 font-bold">@{currentMatch.player1.username}</p>
      </motion.div>

      {/* Player 2 side */}
      <motion.div
        initial={{ x: 100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ delay: 0.8, duration: 0.5 }}
        className="absolute right-0 top-1/2 -translate-y-1/2 w-1/2 flex flex-col items-center"
      >
        <div className="w-48 h-48 rounded-full bg-slate-900 border-8 border-white shadow-2xl mb-6 overflow-hidden flex items-center justify-center">
          {currentMatch.player2.avatar ? (
            <img src={currentMatch.player2.avatar} alt={currentMatch.player2.displayName} className="w-full h-full object-cover" />
          ) : (
            <span className="text-8xl">😎</span>
          )}
        </div>
        <h2 className="text-5xl font-black text-white mb-2 text-shadow">
          {currentMatch.player2.displayName}
        </h2>
        <p className="text-2xl text-rose-200 font-bold">@{currentMatch.player2.username}</p>
      </motion.div>

      {/* Center VS */}
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ delay: 1.2, type: 'spring', stiffness: 200, damping: 20 }}
        className="relative z-20"
      >
        <div className="relative">
          <motion.div
            animate={{
              scale: [1, 1.15, 1],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            className="w-40 h-40 rounded-full bg-white flex items-center justify-center shadow-2xl shadow-white/50"
          >
            <span className="text-7xl font-black bg-gradient-to-r from-blue-600 to-red-600 bg-clip-text text-transparent">
              VS
            </span>
          </motion.div>

          {/* Energy rings */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
            className="absolute inset-0 rounded-full border-8 border-transparent border-t-yellow-400 border-r-yellow-400"
          />
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            className="absolute inset-0 rounded-full border-4 border-transparent border-b-cyan-400 border-l-cyan-400"
          />
        </div>
      </motion.div>


    </div>
  );
}
