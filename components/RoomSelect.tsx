'use client';

import { motion } from 'framer-motion';
import { Trophy, Coins, Users, ArrowLeft, Zap, RefreshCw } from 'lucide-react';
import { useArenaStore } from '@/lib/store';
import { ROOM_TIERS, usdToSol } from '@/lib/constants';
import { useSolPrice } from '@/lib/useSolPrice';
import type { BattleRoom } from '@/types';

export default function RoomSelect() {
  const { currentTrainer, setScreen, startQueue } = useArenaStore();
  const { solPrice, loading: priceLoading, lastUpdated } = useSolPrice();

  const getEntryFee = (tierUsd: number) => usdToSol(tierUsd, solPrice);
  const getPrizePool = (tierUsd: number) => usdToSol(tierUsd * 2 * 0.95, solPrice);

  const handleRoomSelect = (roomId: BattleRoom) => {
    if (!currentTrainer) return;

    const room = ROOM_TIERS[roomId];
    const entryFee = getEntryFee(room.tier);
    if (currentTrainer.balance < entryFee) {
      alert('Insufficient balance. Please deposit SOL to continue.');
      return;
    }

    // Play first 2s of Pokemon SFX on room/arena select
    try {
      const sfx = new Audio('/music/The Greatest Pokemon Sound Effects.mp3');
      sfx.currentTime = 0;
      sfx.volume = 0.8;
      sfx.play().catch(() => {});
      setTimeout(() => { sfx.pause(); sfx.currentTime = 0; }, 2500);
    } catch (e) {}

    startQueue(roomId, currentTrainer);
    setScreen('queue');
  };

  return (
    <div className="h-screen flex flex-col p-4 pokeball-pattern relative overflow-hidden">
      {/* Ambient effects */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-amber-500/8 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col h-full max-w-6xl mx-auto w-full">
        {/* Back + Header row */}
        <div className="flex items-center gap-4 mb-3">
          <motion.button
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={() => setScreen('draft-mode-intro')}
            className="flex items-center gap-2 glass-panel px-3 py-2 rounded-lg hover:border-blue-500/50 transition-all text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </motion.button>

          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex-1 flex items-center justify-between"
          >
            <div>
              <h1 className="text-2xl font-black arena-glow bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
                CHOOSE YOUR BATTLEFIELD
              </h1>
              <p className="text-xs text-slate-400">Select your stakes and face destiny</p>
            </div>
            <div className="flex items-center gap-3">
              {/* Live SOL price */}
              <div className="flex items-center gap-1.5 glass-panel px-3 py-1.5 rounded-full text-xs">
                <RefreshCw className={`w-3 h-3 text-green-400 ${priceLoading ? 'animate-spin' : ''}`} />
                <span className="text-green-400 font-bold">1 SOL = ${solPrice.toFixed(2)}</span>
                {lastUpdated && (
                  <span className="text-slate-500">{lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                )}
              </div>
              {currentTrainer && (
                <div className="flex items-center gap-2 glass-panel px-4 py-2 rounded-full text-sm">
                  <Coins className="w-4 h-4 text-purple-400" />
                  <span className="font-bold">{currentTrainer.balance.toFixed(4)} SOL</span>
                </div>
              )}
            </div>
          </motion.div>
        </div>

        {/* Room Grid — 4×2 compact */}
        <div className="grid grid-cols-4 gap-3 flex-1">
          {Object.values(ROOM_TIERS).map((room, i) => {
            const entryFee = getEntryFee(room.tier);
            const prizePool = getPrizePool(room.tier);
            const canAfford = currentTrainer && currentTrainer.balance >= entryFee;
            return (
              <motion.div
                key={room.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 + i * 0.05 }}
                whileHover={canAfford ? { scale: 1.02 } : {}}
                whileTap={canAfford ? { scale: 0.98 } : {}}
                onClick={() => canAfford && handleRoomSelect(room.id)}
                className={`room-card relative overflow-hidden cursor-pointer border rounded-xl p-4 flex flex-col justify-between ${
                  canAfford
                    ? 'border-slate-700 hover:border-opacity-100'
                    : 'border-slate-800 opacity-40 cursor-not-allowed'
                }`}
              >
                {/* Background gradient */}
                <div className={`absolute inset-0 bg-gradient-to-br ${room.color} opacity-10`} />
                <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 bg-gradient-to-r ${room.color} opacity-15 blur-2xl`} />

                <div className="relative z-10">
                  {/* Room name */}
                  <h2 className={`text-base font-black mb-0.5 bg-gradient-to-r ${room.color} bg-clip-text text-transparent`}>
                    {room.name}
                  </h2>

                  {/* Tier label */}
                  <p className="text-xs text-slate-500 font-semibold mb-2">${room.tier} Tier</p>

                  {/* Description */}
                  <p className="text-slate-400 text-xs italic mb-3 leading-tight">
                    "{room.description}"
                  </p>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-1.5 mb-3">
                    <div className="bg-black/30 rounded-lg p-2 text-center">
                      <div className="flex items-center justify-center gap-1 mb-0.5">
                        <Coins className="w-3 h-3 text-amber-400" />
                        <span className="text-xs text-amber-400 font-semibold">Entry</span>
                      </div>
                      <p className="text-sm font-black">{entryFee} SOL</p>
                    </div>
                    <div className="bg-black/30 rounded-lg p-2 text-center">
                      <div className="flex items-center justify-center gap-1 mb-0.5">
                        <Trophy className="w-3 h-3 text-green-400" />
                        <span className="text-xs text-green-400 font-semibold">Prize</span>
                      </div>
                      <p className="text-sm font-black">{prizePool} SOL</p>
                    </div>
                  </div>

                  {/* CTA */}
                  {canAfford ? (
                    <div className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg font-bold text-xs bg-gradient-to-r ${room.color} ${room.glow} shadow-md`}>
                      <Zap className="w-3.5 h-3.5" />
                      Enter Arena
                    </div>
                  ) : (
                    <div className="text-center text-xs text-slate-600 font-semibold py-2">
                      Insufficient Balance
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Footer ticker */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-3 glass-panel rounded-xl p-2"
        >
          <div className="flex items-center justify-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-slate-400">Live Now:</span>
            </div>
            <div className="flex items-center gap-1.5 text-green-400 font-bold">
              <Users className="w-3.5 h-3.5" />
              <span>247 Trainers Online</span>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
