'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Zap, Trophy } from 'lucide-react';
import { useArenaStore } from '@/lib/store';
import { ROOM_TIERS } from '@/lib/constants';
import { TYPE_COLORS } from '@/lib/constants';
import { POKEMON_DATABASE, getPokemonSpriteUrl } from '@/lib/pokemon-data';
import type { Trainer } from '@/types';

export default function MatchFound() {
  const { queueState, setScreen, setMatch, currentTrainer: liveTrainer } = useArenaStore();
  // Always use the live trainer so the current avatar is reflected
  const currentTrainer = liveTrainer ?? queueState.currentTrainer;
  const [revealed, setRevealed] = useState(false);

  // Create AI bot opponent
  const botNames = ['Elite Four Bruno', 'Gym Leader Brock', 'Rival Blue', 'Champion Lance', 'Ace Trainer Red'];
  const opponent: Trainer = {
    id: 'bot_' + Date.now(),
    username: 'ai_bot_' + Math.floor(Math.random() * 1000),
    displayName: botNames[Math.floor(Math.random() * botNames.length)],
    email: 'bot@arena151.gg',
    avatar: '/avatars/trainer-2.png',
    favoritePokemon: (() => {
      const p = POKEMON_DATABASE[Math.floor(Math.random() * POKEMON_DATABASE.length)];
      return { id: p.id, name: p.name, sprite: '', types: p.types as any, stats: { hp: 100, attack: 100, defense: 100, spAttack: 100, spDefense: 100, speed: 100 } };
    })(),
    joinedDate: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000),
    record: {
      wins: Math.floor(Math.random() * 50),
      losses: Math.floor(Math.random() * 30),
    },
    internalWalletId: 'wallet_opp',
    balance: 1,
    earnings: 0,
  };

  const room = queueState.roomId ? ROOM_TIERS[queueState.roomId] : ROOM_TIERS['pallet-pot'];

  useEffect(() => {
    // Initial flash
    const flashTimeout = setTimeout(() => {
      setRevealed(true);
    }, 500);

    // Auto-advance to versus screen
    const advanceTimeout = setTimeout(() => {
      if (currentTrainer) {
        setMatch({
          player1: currentTrainer,
          player2: opponent,
          room: room,
          matchId: `match_${Date.now()}`,
        });
      }
      setScreen('versus');
    }, 5000);

    return () => {
      clearTimeout(flashTimeout);
      clearTimeout(advanceTimeout);
    };
  }, [setScreen, setMatch, currentTrainer, opponent, room]);

  if (!currentTrainer) return null;

  return (
    <div className="min-h-screen flex items-center justify-center pokeball-pattern relative overflow-hidden">
      {/* Energy flash effect */}
      <motion.div
        initial={{ scale: 0, opacity: 1 }}
        animate={{ scale: 3, opacity: 0 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="absolute inset-0 bg-gradient-to-r from-blue-500 via-cyan-500 to-blue-500"
      />

      {/* Ambient light effects */}
      <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-blue-500/30 rounded-full blur-3xl animate-pulse" />
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-red-500/30 rounded-full blur-3xl animate-pulse" />

      <div className="relative z-10 max-w-6xl w-full px-8">
        {/* Match Found Alert */}
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: revealed ? 1 : 0, opacity: revealed ? 1 : 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          className="text-center mb-16"
        >
          <h1 className="text-7xl font-black mb-4 arena-glow bg-gradient-to-r from-yellow-400 via-orange-400 to-yellow-400 bg-clip-text text-transparent">
            RIVAL FOUND!
          </h1>
          <p className="text-2xl text-cyan-300 font-bold">
            Prepare for battle
          </p>
        </motion.div>

        {/* Versus Layout */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: revealed ? 1 : 0, y: revealed ? 0 : 30 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="grid grid-cols-3 gap-8 items-center"
        >
          {/* Player 1 */}
          <motion.div
            initial={{ x: -100, opacity: 0 }}
            animate={{ x: revealed ? 0 : -100, opacity: revealed ? 1 : 0 }}
            transition={{ delay: 0.5, type: 'spring', stiffness: 100 }}
            className="glass-panel p-8 rounded-2xl border-2 border-blue-500 relative overflow-hidden"
          >
            <div
              className="absolute inset-0 opacity-10"
              style={{
                background: `radial-gradient(circle at 50% 50%, ${TYPE_COLORS[currentTrainer.favoritePokemon.types[0]]}, transparent)`,
              }}
            />
            <div className="relative z-10">
              <div className="w-32 h-32 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-800 border-4 border-blue-500 shadow-xl shadow-blue-500/50 overflow-hidden flex items-center justify-center">
                {currentTrainer.avatar ? (
                  <img src={currentTrainer.avatar} alt={currentTrainer.displayName} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-6xl">🧑‍🦱</span>
                )}
              </div>
              <h3 className="text-2xl font-black text-center mb-2">{currentTrainer.displayName}</h3>
              <p className="text-blue-400 text-center font-bold">@{currentTrainer.username}</p>
              <div className="mt-4 text-center">
                <p className="text-sm text-slate-400 mb-2">Record</p>
                <p className="font-mono font-bold text-lg">
                  {currentTrainer.record.wins}W - {currentTrainer.record.losses}L
                </p>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-700">
                <p className="text-xs text-slate-500 mb-2 text-center">Partner Pokémon</p>
                <div className="flex flex-col items-center gap-2">
                  <img
                    src={getPokemonSpriteUrl(currentTrainer.favoritePokemon.id)}
                    alt={currentTrainer.favoritePokemon.name}
                    className="w-16 h-16 object-contain"
                    style={{ imageRendering: 'pixelated' }}
                  />
                  <span className="font-bold">{currentTrainer.favoritePokemon.name}</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* VS Badge */}
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: revealed ? 1 : 0, rotate: revealed ? 0 : -180 }}
            transition={{ delay: 0.7, type: 'spring', stiffness: 150, damping: 15 }}
            className="text-center"
          >
            <div className="relative">
              <motion.div
                animate={{
                  scale: [1, 1.2, 1],
                  rotate: [0, 10, -10, 0],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
                className={`w-32 h-32 mx-auto rounded-full bg-gradient-to-r ${room.color} flex items-center justify-center ${room.glow} shadow-2xl relative`}
              >
                <span className="text-5xl font-black text-white">VS</span>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                  className="absolute inset-0 rounded-full border-4 border-transparent border-t-white/30"
                />
              </motion.div>
              <div className="mt-6">
                <div className={`inline-flex items-center gap-2 glass-panel px-6 py-3 rounded-full border ${room.glow}`}>
                  <Trophy className="w-5 h-5 text-amber-400" />
                  <span className="font-bold">{room.name}</span>
                </div>
                <p className="text-sm text-slate-400 mt-3">
                  Prize: <span className="text-green-400 font-bold">{room.prizePool} SOL</span>
                </p>
              </div>
            </div>
          </motion.div>

          {/* Player 2 (Opponent) */}
          <motion.div
            initial={{ x: 100, opacity: 0 }}
            animate={{ x: revealed ? 0 : 100, opacity: revealed ? 1 : 0 }}
            transition={{ delay: 0.5, type: 'spring', stiffness: 100 }}
            className="glass-panel p-8 rounded-2xl border-2 border-red-500 relative overflow-hidden"
          >
            <div
              className="absolute inset-0 opacity-10"
              style={{
                background: `radial-gradient(circle at 50% 50%, ${TYPE_COLORS[opponent.favoritePokemon.types[0]]}, transparent)`,
              }}
            />
            <div className="relative z-10">
              <div className="w-32 h-32 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-6xl border-4 border-red-500 shadow-xl shadow-red-500/50">
                😎
              </div>
              <h3 className="text-2xl font-black text-center mb-2">{opponent.displayName}</h3>
              <p className="text-red-400 text-center font-bold">@{opponent.username}</p>
              <div className="mt-4 text-center">
                <p className="text-sm text-slate-400 mb-2">Record</p>
                <p className="font-mono font-bold text-lg">
                  {opponent.record.wins}W - {opponent.record.losses}L
                </p>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-700">
                <p className="text-xs text-slate-500 mb-2 text-center">Partner Pokémon</p>
                <div className="flex flex-col items-center gap-2">
                  <img
                    src={getPokemonSpriteUrl(opponent.favoritePokemon.id)}
                    alt={opponent.favoritePokemon.name}
                    className="w-16 h-16 object-contain"
                    style={{ imageRendering: 'pixelated' }}
                  />
                  <span className="font-bold">{opponent.favoritePokemon.name}</span>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* Countdown */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: revealed ? 1 : 0 }}
          transition={{ delay: 1 }}
          className="text-center mt-12"
        >
          <p className="text-slate-400 text-lg">
            Battle begins soon...
          </p>
        </motion.div>
      </div>
    </div>
  );
}
