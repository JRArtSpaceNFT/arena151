'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
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

  // 20 clever Pokémon-inspired bot names — no "AI" in sight
  const BOT_NAMES = [
    'PokéMaster Reds Ghost',
    'Youngster Joey',
    'Lass Copycat',
    'Bug Catcher Winston',
    'Channeler Celeste',
    'Rocket Grunt Hex',
    'Psychic Kazuki',
    'Hiker Granite',
    'Sailor Dewdrop',
    'Juggler Phantom',
    'Gambler Lucky',
    'Super Nerd Cipher',
    'Tamer Volt',
    'Bird Keeper Skylar',
    'Cooltrainer Frost',
    'Gentleman Onix',
    'Blackbelt Cobalt',
    'Picnicker Blaze',
    'Fisherman Surge Jr.',
    'Rival Copycat',
  ];

  const BOT_AVATARS = [
    '/trainer-avatars/ProfessorOak.png',
    '/trainer-avatars/Ash.png',
    '/trainer-avatars/Gary.png',
    '/trainer-avatars/Brock.png',
    '/trainer-avatars/Misty.png',
    '/trainer-avatars/Giovanni.png',
    '/trainer-avatars/Bulbasaur.png',
    '/trainer-avatars/Charmander.png',
    '/trainer-avatars/Squirtle.png',
    '/trainer-avatars/Pikachu.png',
    '/trainer-avatars/Eevee.png',
    '/trainer-avatars/Snorlax.png',
  ];

  const sfxPlayed = useRef(false);

  const opponent: Trainer = useMemo(() => {
    const botName = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
    const botAvatar = BOT_AVATARS[Math.floor(Math.random() * BOT_AVATARS.length)];
    const botHandle = botName.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/__+/g, '_');
    const p = POKEMON_DATABASE[Math.floor(Math.random() * POKEMON_DATABASE.length)];
    return {
      id: 'bot_' + Date.now(),
      username: botHandle,
      displayName: botName,
      email: 'bot@arena151.gg',
      avatar: botAvatar,
      favoritePokemon: { id: p.id, name: p.name, sprite: '', types: p.types as any, stats: { hp: 100, attack: 100, defense: 100, spAttack: 100, spDefense: 100, speed: 100 } },
      joinedDate: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000),
      record: {
        wins: Math.floor(Math.random() * 50),
        losses: Math.floor(Math.random() * 30),
      },
      internalWalletId: 'wallet_opp',
      balance: 1,
      earnings: 0,
      badges: [],
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const room = queueState.roomId ? ROOM_TIERS[queueState.roomId] : ROOM_TIERS['pallet-pot'];

  useEffect(() => {
    // Initial flash
    const flashTimeout = setTimeout(() => {
      setRevealed(true);
      // Play SFX when RIVAL FOUND! reveals (once only)
      if (!sfxPlayed.current) {
        sfxPlayed.current = true;
        try {
          const sfx = new Audio('/music/The Greatest Pokemon Sound Effects.mp3');
          sfx.currentTime = 0; sfx.volume = 0.8;
          sfx.play().catch(() => {});
          setTimeout(() => { sfx.pause(); sfx.currentTime = 0; }, 2800);
        } catch (e) {}
      }
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
    <div className="h-screen flex items-center justify-center pokeball-pattern relative overflow-hidden">
      {/* Energy flash effect */}
      <motion.div
        initial={{ scale: 0, opacity: 1 }}
        animate={{ scale: 3, opacity: 0 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="absolute inset-0 bg-gradient-to-r from-blue-500 via-cyan-500 to-blue-500"
      />

      {/* Ambient light effects */}
      <div className="absolute w-[480px] h-[480px] bg-blue-500/35 rounded-full blur-3xl animate-pulse" style={{ top: '50%', left: '16%', transform: 'translate(-50%, -50%)' }} />
      <div className="absolute w-[480px] h-[480px] bg-red-500/35 rounded-full blur-3xl animate-pulse" style={{ top: '50%', left: '84%', transform: 'translate(-50%, -50%)' }} />

      <div className="relative z-10 max-w-6xl w-full px-8">
        {/* Match Found Alert */}
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: revealed ? 1 : 0, opacity: revealed ? 1 : 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          className="text-center mb-6"
        >
          <h1 className="mb-2" style={{
            fontFamily: '"Impact", "Arial Black", sans-serif',
            fontSize: 56,
            fontWeight: 900,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            lineHeight: 1,
            background: 'linear-gradient(135deg, #ef4444 0%, #fbbf24 40%, #ef4444 70%, #fff 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            filter: 'drop-shadow(0 0 24px rgba(239,68,68,0.6)) drop-shadow(0 2px 0 rgba(0,0,0,0.8))',
          }}>
            RIVAL FOUND!
          </h1>
          <p className="text-lg text-cyan-300 font-bold">
            Prepare for battle
          </p>
        </motion.div>

        {/* Versus Layout */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: revealed ? 1 : 0, y: revealed ? 0 : 30 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="grid grid-cols-3 gap-5 items-center"
        >
          {/* Player 1 */}
          <motion.div
            initial={{ x: -100, opacity: 0 }}
            animate={{ x: revealed ? 0 : -100, opacity: revealed ? 1 : 0 }}
            transition={{ delay: 0.5, type: 'spring', stiffness: 100 }}
            className="glass-panel p-5 rounded-2xl border-2 border-blue-500 relative overflow-hidden"
          >
            <div
              className="absolute inset-0 opacity-10"
              style={{
                background: `radial-gradient(circle at 50% 50%, ${TYPE_COLORS[currentTrainer.favoritePokemon.types[0]]}, transparent)`,
              }}
            />
            <div className="relative z-10">
              <div className="w-20 h-20 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-800 border-4 border-blue-500 shadow-xl shadow-blue-500/50 overflow-hidden flex items-center justify-center">
                {currentTrainer.avatar ? (
                  <img src={currentTrainer.avatar} alt={currentTrainer.displayName} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-4xl">🧑‍🦱</span>
                )}
              </div>
              <h3 className="text-xl font-black text-center mb-1">{currentTrainer.displayName}</h3>
              <p className="text-blue-400 text-center font-bold text-sm">@{currentTrainer.username}</p>
              <div className="mt-3 text-center">
                <p className="text-xs text-slate-400 mb-1">Record</p>
                <p className="font-mono font-bold">
                  {currentTrainer.record.wins}W - {currentTrainer.record.losses}L
                </p>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-700">
                <p className="text-xs text-slate-500 mb-1 text-center">Partner Pokémon</p>
                <div className="flex flex-col items-center gap-1">
                  <img
                    src={getPokemonSpriteUrl(currentTrainer.favoritePokemon.id)}
                    alt={currentTrainer.favoritePokemon.name}
                    className="w-12 h-12 object-contain"
                    style={{ imageRendering: 'pixelated' }}
                  />
                  <span className="font-bold text-sm">{currentTrainer.favoritePokemon.name}</span>
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
                className={`w-24 h-24 mx-auto rounded-full bg-gradient-to-r ${room.color} flex items-center justify-center ${room.glow} shadow-2xl relative`}
              >
                <span className="text-4xl font-black text-white">VS</span>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                  className="absolute inset-0 rounded-full border-4 border-transparent border-t-white/30"
                />
              </motion.div>
              <div className="mt-4">
                <div className={`inline-flex items-center gap-2 glass-panel px-4 py-2 rounded-full border ${room.glow}`}>
                  <Trophy className="w-4 h-4 text-amber-400" />
                  <span className="font-bold text-sm">{room.name}</span>
                </div>
                <p className="text-xs text-slate-400 mt-2">
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
            className="glass-panel p-5 rounded-2xl border-2 border-red-500 relative overflow-hidden"
          >
            <div
              className="absolute inset-0 opacity-10"
              style={{
                background: `radial-gradient(circle at 50% 50%, ${TYPE_COLORS[opponent.favoritePokemon.types[0]]}, transparent)`,
              }}
            />
            <div className="relative z-10">
              <div className="w-20 h-20 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-800 border-4 border-red-500 shadow-xl shadow-red-500/50 overflow-hidden flex items-center justify-center">
                <img src={opponent.avatar} alt={opponent.displayName} className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).src = '/trainer-avatars/Pikachu.png'; }} />
              </div>
              <h3 className="text-xl font-black text-center mb-1">{opponent.displayName}</h3>
              <p className="text-red-400 text-center font-bold text-sm">@{opponent.username}</p>
              <div className="mt-3 text-center">
                <p className="text-xs text-slate-400 mb-1">Record</p>
                <p className="font-mono font-bold">
                  {opponent.record.wins}W - {opponent.record.losses}L
                </p>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-700">
                <p className="text-xs text-slate-500 mb-1 text-center">Partner Pokémon</p>
                <div className="flex flex-col items-center gap-1">
                  <img
                    src={getPokemonSpriteUrl(opponent.favoritePokemon.id)}
                    alt={opponent.favoritePokemon.name}
                    className="w-12 h-12 object-contain"
                    style={{ imageRendering: 'pixelated' }}
                  />
                  <span className="font-bold text-sm">{opponent.favoritePokemon.name}</span>
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
          className="text-center mt-6"
        >
          <p className="text-slate-400">
            Battle begins soon...
          </p>
        </motion.div>
      </div>
    </div>
  );
}
