'use client';

import { motion } from 'framer-motion';
import { Trophy, Wallet, ArrowLeft, RefreshCw, TrendingUp } from 'lucide-react';
import { useArenaStore } from '@/lib/store';
import { ROOM_TIERS, usdToSol } from '@/lib/constants';
import { useSolPrice } from '@/lib/useSolPrice';
import type { BattleRoom } from '@/types';

// Per-arena identity config
const ARENA_IDENTITY: Record<string, {
  flavor: string;
  bgImage: string;
  accent: string;
  accentDark: string;
  stakeTier: 'low' | 'mid' | 'high';
  btnLabel: string;
}> = {
  'pallet-town':    { flavor: 'Where every journey begins',          bgImage: '/arenas/Ash Pallet Town.png',    accent: '#4ade80', accentDark: '#166534', stakeTier: 'low',  btnLabel: 'Begin Your Journey →' },
  'viridian-city':  { flavor: 'Step beyond the safety of home',      bgImage: '/arenas/Ash Pallet Town.png',    accent: '#34d399', accentDark: '#065f46', stakeTier: 'low',  btnLabel: 'Enter the Forest →' },
  'pewter-city':    { flavor: 'Built on grit, stone, and resolve',   bgImage: '/arenas/Brocks Gym.png',         accent: '#a8a29e', accentDark: '#292524', stakeTier: 'low',  btnLabel: 'Break the Rock →' },
  'cerulean-city':  { flavor: 'Calm waters hide fierce rivals',      bgImage: '/arenas/MistysGym.png',          accent: '#38bdf8', accentDark: '#075985', stakeTier: 'mid',  btnLabel: 'Dive In →' },
  'vermilion-city': { flavor: 'Fast hands and electric nerves',      bgImage: '/arenas/LtSurgeGym.png',         accent: '#facc15', accentDark: '#713f12', stakeTier: 'mid',  btnLabel: 'Charge Up →' },
  'celadon-city':   { flavor: 'Fortunes bloom where skill survives', bgImage: '/arenas/Erikas Gym.png',         accent: '#c084fc', accentDark: '#4c1d95', stakeTier: 'mid',  btnLabel: 'Claim Your Fortune →' },
  'victory-road':   { flavor: 'Only the strongest endure the climb', bgImage: '/arenas/Brunos Stone Arenea.png',accent: '#fb923c', accentDark: '#7c2d12', stakeTier: 'high', btnLabel: 'Brave the Road →' },
  'indigo-plateau': { flavor: 'Where champions are remembered',      bgImage: '/arenas/MewTwos Lab.png',        accent: '#fbbf24', accentDark: '#451a03', stakeTier: 'high', btnLabel: 'Claim the Throne →' },
}

const STAKE_BAND = {
  low:  { label: 'LOW STAKES',  labelColor: '#4ade80', borderOpacity: 0.2, glowStrength: 12 },
  mid:  { label: 'MID STAKES',  labelColor: '#38bdf8', borderOpacity: 0.3, glowStrength: 20 },
  high: { label: 'HIGH STAKES', labelColor: '#fbbf24', borderOpacity: 0.45, glowStrength: 32 },
}

export default function RoomSelect() {
  const { currentTrainer, setScreen, startQueue } = useArenaStore();
  const { solPrice, loading: priceLoading, lastUpdated } = useSolPrice();

  const getEntryFee = (tierUsd: number) => usdToSol(tierUsd, solPrice);
  const getPrizePool = (tierUsd: number) => usdToSol(tierUsd * 2 * 0.95, solPrice);
  const getProfit = (tierUsd: number) => usdToSol(tierUsd * 2 * 0.95 - tierUsd, solPrice);

  const handleRoomSelect = (roomId: BattleRoom) => {
    if (!currentTrainer) return;
    const room = ROOM_TIERS[roomId];
    const entryFee = getEntryFee(room.tier);
    if (currentTrainer.balance < entryFee) return;
    try {
      const sfx = new Audio('/music/The Greatest Pokemon Sound Effects.mp3');
      sfx.currentTime = 0; sfx.volume = 0.8;
      sfx.play().catch(() => {});
      setTimeout(() => { sfx.pause(); sfx.currentTime = 0; }, 2800);
    } catch (e) {}
    startQueue(roomId, currentTrainer);
    setScreen('queue');
  };

  const rooms = Object.values(ROOM_TIERS);
  // Find highest affordable arena
  const highestAffordable = currentTrainer
    ? [...rooms].reverse().find(r => currentTrainer.balance >= getEntryFee(r.tier))
    : null;

  return (
    <div className="h-screen flex flex-col overflow-hidden relative"
      style={{ background: 'linear-gradient(160deg,#08060f 0%,#0d0a1e 40%,#0a0d18 80%,#060608 100%)' }}>

      {/* Background ambient */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] opacity-10 blur-3xl rounded-full"
          style={{ background: 'radial-gradient(ellipse, #f59e0b, transparent 70%)' }} />
        <div className="absolute bottom-0 left-1/4 w-[400px] h-[300px] opacity-6 blur-3xl rounded-full"
          style={{ background: 'radial-gradient(ellipse, #3b82f6, transparent 70%)' }} />
      </div>

      <div className="relative z-10 flex flex-col h-full max-w-6xl mx-auto w-full px-4 pt-3 pb-3">

        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-3 shrink-0">
          <div className="flex items-center gap-3">
            <motion.button initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
              onClick={() => setScreen('draft-mode-intro')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-bold border transition-all"
              style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' }}>
              <ArrowLeft className="w-4 h-4" /> Back
            </motion.button>
            <div>
              <motion.h1 initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                className="text-2xl font-black leading-none"
                style={{ background: 'linear-gradient(135deg,#fbbf24,#f97316,#fbbf24)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                CHOOSE YOUR BATTLEFIELD
              </motion.h1>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Select your stakes and face destiny</p>
            </div>
          </div>

          {/* Wallet + price */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs"
              style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.3)' }}>
              <RefreshCw className={`w-3 h-3 text-green-400 ${priceLoading ? 'animate-spin' : ''}`} />
              <span className="text-green-400 font-bold">◎ = ${solPrice.toFixed(0)}</span>
            </div>
            {currentTrainer && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border"
                style={{ background: 'rgba(168,85,247,0.08)', borderColor: 'rgba(168,85,247,0.25)' }}>
                <Wallet className="w-3.5 h-3.5 text-purple-400" />
                <span className="text-xs font-black text-white">Battle Funds</span>
                <span className="text-sm font-black text-purple-300" style={{ textShadow: '0 0 10px rgba(168,85,247,0.5)' }}>
                  {currentTrainer.balance.toFixed(4)} ◎
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ── Arena Grid ── */}
        <div className="grid grid-cols-4 gap-2.5 flex-1 min-h-0">
          {rooms.map((room, i) => {
            const id = room.id as string;
            const identity = ARENA_IDENTITY[id] ?? { flavor: '', bgImage: '', accent: '#6366f1', accentDark: '#1e1b4b', stakeTier: 'mid' as const, btnLabel: 'Enter Arena →' };
            const band = STAKE_BAND[identity.stakeTier];
            const entryFee = getEntryFee(room.tier);
            const prizePool = getPrizePool(room.tier);
            const profit = getProfit(room.tier);
            const canAfford = currentTrainer ? currentTrainer.balance >= entryFee : false;
            const isRecommended = highestAffordable?.id === id;
            const isHigh = identity.stakeTier === 'high';

            return (
              <motion.div key={room.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.04 + i * 0.05 }}
                onClick={() => canAfford && handleRoomSelect(room.id as BattleRoom)}
                whileHover={canAfford ? { scale: 1.02, y: -2 } : {}}
                whileTap={canAfford ? { scale: 0.98 } : {}}
                className="relative rounded-xl flex flex-col overflow-hidden"
                style={{
                  background: `linear-gradient(160deg, ${identity.accentDark}44 0%, rgba(8,6,20,0.95) 100%)`,
                  border: `1px solid ${identity.accent}${Math.round(band.borderOpacity * 255).toString(16).padStart(2,'0')}`,
                  boxShadow: canAfford ? `0 0 ${band.glowStrength}px ${identity.accent}${isHigh ? '22' : '14'}` : 'none',
                  cursor: canAfford ? 'pointer' : 'not-allowed',
                  opacity: canAfford ? 1 : 0.38,
                }}
              >
                {/* Arena background image — faint silhouette */}
                <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
                  <div
                    style={{
                      position: 'absolute', inset: 0,
                      backgroundImage: `url(${identity.bgImage})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      opacity: isHigh ? 0.12 : 0.07,
                      filter: 'saturate(0.6)',
                    }}
                  />
                  {/* Gradient over image so text stays readable */}
                  <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(160deg, ${identity.accentDark}cc 0%, rgba(6,4,16,0.92) 60%)` }} />
                </div>

                {/* Badge-inspired corner accents */}
                <div className="absolute top-0 left-0 w-3 h-3 pointer-events-none"
                  style={{ borderTop: `2px solid ${identity.accent}77`, borderLeft: `2px solid ${identity.accent}77`, borderTopLeftRadius: 10 }} />
                <div className="absolute top-0 right-0 w-3 h-3 pointer-events-none"
                  style={{ borderTop: `2px solid ${identity.accent}77`, borderRight: `2px solid ${identity.accent}77`, borderTopRightRadius: 10 }} />
                <div className="absolute bottom-0 left-0 w-3 h-3 pointer-events-none"
                  style={{ borderBottom: `2px solid ${identity.accent}77`, borderLeft: `2px solid ${identity.accent}77`, borderBottomLeftRadius: 10 }} />
                <div className="absolute bottom-0 right-0 w-3 h-3 pointer-events-none"
                  style={{ borderBottom: `2px solid ${identity.accent}77`, borderRight: `2px solid ${identity.accent}77`, borderBottomRightRadius: 10 }} />

                {/* Escalating glow intensity — bottom edge */}
                <div className="absolute bottom-0 left-0 right-0 h-1 pointer-events-none rounded-b-xl"
                  style={{ background: `linear-gradient(90deg, transparent, ${identity.accent}${identity.stakeTier === 'high' ? '88' : identity.stakeTier === 'mid' ? '55' : '33'}, transparent)` }} />

                {/* Animated shimmer for high stakes */}
                {isHigh && canAfford && (
                  <motion.div className="absolute inset-0 pointer-events-none rounded-xl"
                    style={{ background: `linear-gradient(105deg,transparent 30%,${identity.accent}12 50%,transparent 70%)` }}
                    animate={{ x: ['-100%', '200%'] }}
                    transition={{ duration: 3, repeat: Infinity, repeatDelay: 4 }}
                  />
                )}

                {/* Recommended badge */}
                {isRecommended && (
                  <div className="absolute top-1.5 right-1.5 z-20 px-1.5 py-0.5 rounded-md text-xs font-black"
                    style={{ background: identity.accent, color: '#000', fontSize: 9, letterSpacing: '0.05em' }}>
                    ✓ BEST FIT
                  </div>
                )}

                {/* Stake band label */}
                <div className="absolute top-0 left-0 right-0 h-0.5 pointer-events-none"
                  style={{ background: `linear-gradient(90deg, transparent, ${identity.accent}, transparent)` }} />

                <div className="relative z-10 flex flex-col h-full p-3">
                  {/* Arena header */}
                  <div className="flex items-start justify-between mb-1.5">
                    <div>
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <h2 className="font-black text-sm leading-none" style={{ color: identity.accent }}>
                          {room.name}
                        </h2>
                      </div>
                      <p className="text-xs leading-tight" style={{ color: 'rgba(255,255,255,0.35)', fontStyle: 'italic' }}>
                        {identity.flavor}
                      </p>
                    </div>
                    <span className="text-xs font-black px-1.5 py-0.5 rounded-md shrink-0 ml-1"
                      style={{ background: `${identity.accent}18`, color: identity.accent, border: `1px solid ${identity.accent}33`, fontSize: 10 }}>
                      {band.label}
                    </span>
                  </div>

                  {/* Divider */}
                  <div className="h-px mb-2" style={{ background: `linear-gradient(90deg,transparent,${identity.accent}33,transparent)` }} />

                  {/* Stakes */}
                  <div className="grid grid-cols-3 gap-1.5 mb-2">
                    <div className="text-center rounded-lg py-1.5"
                      style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <p className="text-xs font-bold uppercase tracking-wide mb-0.5" style={{ color: 'rgba(255,255,255,0.3)', fontSize: 9 }}>Entry</p>
                      <p className="font-black text-xs text-white">{entryFee} ◎</p>
                    </div>
                    <div className="text-center rounded-lg py-1.5"
                      style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <p className="text-xs font-bold uppercase tracking-wide mb-0.5" style={{ color: 'rgba(255,255,255,0.3)', fontSize: 9 }}>Pot</p>
                      <p className="font-black text-xs text-white">{prizePool} ◎</p>
                    </div>
                    <div className="text-center rounded-lg py-1.5"
                      style={{ background: `${identity.accent}14`, border: `1px solid ${identity.accent}33` }}>
                      <p className="text-xs font-black uppercase tracking-wide mb-0.5" style={{ color: `${identity.accent}99`, fontSize: 9 }}>You Win</p>
                      <p className="font-black text-xs" style={{ color: identity.accent, textShadow: `0 0 8px ${identity.accent}66` }}>{prizePool} ◎</p>
                    </div>
                  </div>

                  {/* CTA button */}
                  <div className="mt-auto">
                    {canAfford ? (
                      <motion.div
                        className="flex items-center justify-center gap-1.5 py-2 rounded-lg font-black text-xs relative overflow-hidden"
                        style={{
                          background: `linear-gradient(135deg, ${identity.accent}33, ${identity.accent}22)`,
                          border: `1px solid ${identity.accent}55`,
                          color: identity.accent,
                          letterSpacing: '0.04em',
                        }}
                        whileHover={{ background: `linear-gradient(135deg, ${identity.accent}55, ${identity.accent}33)` } as any}
                      >
                        <TrendingUp className="w-3 h-3" />
                        {identity.btnLabel}
                      </motion.div>
                    ) : (
                      <div className="flex items-center justify-center py-2 rounded-lg text-xs font-bold"
                        style={{ background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        Insufficient Funds
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Footer */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
          className="mt-2 shrink-0 flex items-center justify-center gap-6 text-xs"
          style={{ color: 'rgba(255,255,255,0.2)' }}>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
            <span>247 Trainers Online</span>
          </div>
          <span>·</span>
          <span>95% of pot paid to winner</span>
          <span>·</span>
          <span>Results are final</span>
        </motion.div>
      </div>
    </div>
  );
}
