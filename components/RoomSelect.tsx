'use client';

import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { Wallet, ArrowLeft, RefreshCw, TrendingUp } from 'lucide-react';
import { useArenaStore } from '@/lib/store';
import { ROOM_TIERS, ARENA_BADGES, usdToSol } from '@/lib/constants';
import { useSolPrice } from '@/lib/useSolPrice';
import { getBattlesTotal, getSessionsToday } from '@/lib/battleStats';
import type { BattleRoom } from '@/types';

// Per-arena identity config — background images are drop-in from /public/arenas/gyms/
// To replace a background: drop a new image into /public/arenas/gyms/<arena-id>.png
const ARENA_IDENTITY: Record<string, {
  bgImage: string;       // drop-in path: /public/arenas/gyms/<id>.png
  accent: string;
  accentDark: string;
  stakeTier: 'low' | 'mid' | 'high';
  btnLabel: string;
}> = {
  'pewter-city':    { bgImage: '/arenas/gyms/pewter-city.png',    accent: '#a8a29e', accentDark: '#292524', stakeTier: 'low',  btnLabel: 'Pound the Rock →' },
  'cerulean-city':  { bgImage: '/arenas/gyms/cerulean-city.png',  accent: '#38bdf8', accentDark: '#075985', stakeTier: 'low',  btnLabel: 'Dive in Deep →' },
  'vermilion-city': { bgImage: '/arenas/gyms/vermilion-city.png', accent: '#facc15', accentDark: '#713f12', stakeTier: 'low',  btnLabel: 'Charge Up Fast →' },
  'celadon-city':   { bgImage: '/arenas/gyms/celadon-city.png',   accent: '#86efac', accentDark: '#14532d', stakeTier: 'mid',  btnLabel: 'Explore the Garden →' },
  'fuchsia-city':   { bgImage: '/arenas/gyms/fuchsia-city.png',   accent: '#c084fc', accentDark: '#3b0764', stakeTier: 'mid',  btnLabel: 'Enter the Dojo →' },
  'saffron-city':   { bgImage: '/arenas/gyms/saffron-city.png',   accent: '#f0abfc', accentDark: '#4a044e', stakeTier: 'high', btnLabel: 'Test Your Mind →' },
  'cinnabar-island':{ bgImage: '/arenas/gyms/cinnabar-island.png',accent: '#fb923c', accentDark: '#7c2d12', stakeTier: 'high', btnLabel: 'Brave the Flames →' },
  'viridian-city':  { bgImage: '/arenas/gyms/viridian-city.png',  accent: '#fbbf24', accentDark: '#451a03', stakeTier: 'high', btnLabel: 'Claim the Throne →' },
};

const STAKE_BAND = {
  low:  { label: 'LOW STAKES',  labelColor: '#4ade80', borderOpacity: 0.2, glowStrength: 12 },
  mid:  { label: 'MID STAKES',  labelColor: '#38bdf8', borderOpacity: 0.3, glowStrength: 20 },
  high: { label: 'HIGH STAKES', labelColor: '#fbbf24', borderOpacity: 0.45, glowStrength: 32 },
};

export default function RoomSelect() {
  const { currentTrainer, setScreen, startQueue } = useArenaStore();
  const { solPrice, loading: priceLoading } = useSolPrice();
  const [battlesTotal, setBattlesTotal] = useState(0);
  const [sessionsToday, setSessionsToday] = useState(0);
  useEffect(() => {
    setBattlesTotal(getBattlesTotal());
    setSessionsToday(getSessionsToday());
  }, []);

  const getEntryFee = (tierUsd: number) => usdToSol(tierUsd, solPrice);
  const getPrizePool = (tierUsd: number) => usdToSol(tierUsd * 2 * 0.95, solPrice);

  const handleRoomSelect = (roomId: BattleRoom) => {
    if (!currentTrainer) return;
    const room = ROOM_TIERS[roomId];
    const entryFee = getEntryFee(room.tier);
    if (currentTrainer.balance < entryFee) return;
    startQueue(roomId, currentTrainer);
    setScreen('queue');
  };

  const rooms = Object.values(ROOM_TIERS);
  const highestAffordable = currentTrainer
    ? [...rooms].reverse().find(r => currentTrainer.balance >= getEntryFee(r.tier))
    : null;

  return (
    <div className="h-screen flex flex-col overflow-hidden relative roomselect-outer"
      style={{ background: 'linear-gradient(160deg,#08060f 0%,#0d0a1e 40%,#0a0d18 80%,#060608 100%)' }}>

      {/* Kanto map background — very low opacity */}
      <div className="absolute inset-0 pointer-events-none">
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'url(/kanto-map.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          opacity: 0.08,
          imageRendering: 'pixelated',
        }} />
      </div>

      {/* Background ambient */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] opacity-10 blur-3xl rounded-full"
          style={{ background: 'radial-gradient(ellipse, #f59e0b, transparent 70%)' }} />
        <div className="absolute bottom-0 left-1/4 w-[400px] h-[300px] opacity-6 blur-3xl rounded-full"
          style={{ background: 'radial-gradient(ellipse, #3b82f6, transparent 70%)' }} />
      </div>

      <style>{`
        @media (max-width: 1024px) {
          .roomselect-outer { height: 100dvh !important; overflow-y: auto !important; }
          .roomselect-inner { height: auto !important; max-height: none !important; overflow: visible !important; }
          .roomselect-grid { overflow: visible !important; max-height: none !important; height: auto !important; }
          .roomselect-toprow { height: auto !important; min-height: 80px !important; max-height: none !important; }
        }
      `}</style>
      <div className="relative z-10 flex flex-col h-full max-w-6xl mx-auto w-full px-4 pt-3 pb-3 roomselect-inner">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 shrink-0 gap-2">
          <div className="flex items-center gap-3">
            <motion.button initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
              onClick={() => setScreen('draft-mode-intro')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-bold border transition-all"
              style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' }}>
              <ArrowLeft className="w-4 h-4" /> Back
            </motion.button>
            <div>
              <motion.h1 initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                style={{
                  fontFamily: '"Impact", "Arial Black", sans-serif',
                  fontSize: 'clamp(20px, 4vw, 36px)',
                  fontWeight: 900,
                  letterSpacing: '0.08em',
                  lineHeight: 1,
                  textTransform: 'uppercase',
                  background: 'linear-gradient(135deg, #4ade80 0%, #16a34a 40%, #86efac 70%, #fff 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  textShadow: 'none',
                  filter: 'drop-shadow(0 0 18px rgba(74,222,128,0.6))',
                }}>
                CHOOSE YOUR STAKES
              </motion.h1>
              <p className="text-xs mt-1 hidden sm:block" style={{ color: 'rgba(255,255,255,0.85)', letterSpacing: '0.18em', textTransform: 'uppercase', fontSize: 10 }}>Conquer all 8 Kanto Gyms to earn every badge</p>
            </div>
          </div>

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

        {/* ── Top row: Practice + Play a Friend (2 wide cards) ── */}
        <div className="grid grid-cols-2 gap-2.5 shrink-0 roomselect-toprow" style={{ minHeight: 80 }}>

          {/* Practice Arena */}
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }}
            onClick={() => setScreen('practice-game')}
            whileHover={{ scale: 1.015, y: -2 }} whileTap={{ scale: 0.98 }}
            className="relative rounded-xl flex flex-col overflow-hidden cursor-pointer"
            style={{ background: 'linear-gradient(135deg, #14532d55 0%, rgba(8,6,20,0.97) 100%)', border: '1px solid #4ade8044', boxShadow: '0 0 18px #4ade8018' }}
          >
            <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: 'linear-gradient(90deg, transparent, #4ade80, transparent)' }} />
            <div className="absolute top-1.5 right-1.5 z-20 px-1.5 py-0.5 rounded-md font-black" style={{ background: '#4ade80', color: '#000', fontSize: 9, letterSpacing: '0.05em' }}>FREE</div>
            <div className="relative z-10 flex items-center h-full px-4 gap-4">
              <div className="text-3xl shrink-0">🔴</div>
              <div className="flex-1 min-w-0">
                <h2 className="font-black leading-none" style={{ fontFamily: '"Impact","Arial Black",sans-serif', fontSize: 18, letterSpacing: '0.05em', color: '#fff', textShadow: '0 0 14px #4ade8066' }}>PRACTICE ARENA</h2>
                <p className="mt-1 text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Trainer Battle vs AI • No SOL needed • Put your team to the test</p>
              </div>
              <motion.div
                className="shrink-0 px-4 py-2 rounded-xl font-black text-xs relative overflow-hidden"
                style={{ background: 'linear-gradient(135deg,#4ade8044,#4ade8022)', border: '1px solid #4ade8066', color: '#fff', letterSpacing: '0.05em', textShadow: '0 0 8px #4ade8088', whiteSpace: 'nowrap' }}
                whileHover={{ boxShadow: '0 0 20px #4ade8055' } as any}
              >
                <motion.div className="absolute inset-0" style={{ background: 'linear-gradient(105deg,transparent 30%,#4ade8022 50%,transparent 70%)' }} animate={{ x: ['-100%','200%'] }} transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 2 }} />
                <span className="relative z-10">Enter Practice →</span>
              </motion.div>
            </div>
          </motion.div>

          {/* Play a Friend */}
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
            onClick={() => setScreen('friend-battle')}
            whileHover={{ scale: 1.015, y: -2 }} whileTap={{ scale: 0.98 }}
            className="relative rounded-xl flex flex-col overflow-hidden cursor-pointer"
            style={{ background: 'linear-gradient(135deg, #1e1b4b55 0%, rgba(8,6,20,0.97) 100%)', border: '1px solid #818cf844', boxShadow: '0 0 18px #818cf818' }}
          >
            <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: 'linear-gradient(90deg, transparent, #818cf8, transparent)' }} />
            <div className="absolute top-1.5 right-1.5 z-20 flex items-center gap-1 px-1.5 py-0.5 rounded-md font-black" style={{ background: '#818cf8', color: '#000', fontSize: 9, letterSpacing: '0.05em' }}>
              <div className="w-1.5 h-1.5 bg-black rounded-full animate-pulse" />LIVE
            </div>
            <div className="relative z-10 flex items-center h-full px-4 gap-4">
              <div className="text-3xl shrink-0">🎮</div>
              <div className="flex-1 min-w-0">
                <h2 className="font-black leading-none" style={{ fontFamily: '"Impact","Arial Black",sans-serif', fontSize: 18, letterSpacing: '0.05em', color: '#fff', textShadow: '0 0 14px #818cf866' }}>PLAY A FRIEND</h2>
                <p className="mt-1 text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Challenge a friend • Share a battle code • Settle the score</p>
              </div>
              <motion.div
                className="shrink-0 px-4 py-2 rounded-xl font-black text-xs relative overflow-hidden"
                style={{ background: 'linear-gradient(135deg,#818cf844,#818cf822)', border: '1px solid #818cf866', color: '#fff', letterSpacing: '0.05em', textShadow: '0 0 8px #818cf888', whiteSpace: 'nowrap' }}
                whileHover={{ boxShadow: '0 0 20px #818cf855' } as any}
              >
                <motion.div className="absolute inset-0" style={{ background: 'linear-gradient(105deg,transparent 30%,#818cf822 50%,transparent 70%)' }} animate={{ x: ['-100%','200%'] }} transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 2 }} />
                <span className="relative z-10">Challenge Friend →</span>
              </motion.div>
            </div>
          </motion.div>
        </div>

        {/* ── 8 Gym Arenas — 4×2 grid fills remaining space ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 flex-1 min-h-0 overflow-hidden roomselect-grid">
          {rooms.map((room, i) => {
            const id = room.id as string;
            const identity = ARENA_IDENTITY[id] ?? { flavor: '', bgImage: '', accent: '#6366f1', accentDark: '#1e1b4b', stakeTier: 'mid' as const, btnLabel: 'Enter Arena →' };
            const badge = ARENA_BADGES[id];
            const band = STAKE_BAND[identity.stakeTier];
            const entryFee = getEntryFee(room.tier);
            const prizePool = getPrizePool(room.tier);
            const canAfford = currentTrainer ? currentTrainer.balance >= entryFee : false;
            const isRecommended = highestAffordable?.id === id;
            const isHigh = identity.stakeTier === 'high';

            // Check if trainer has earned this badge
            const earnedBadges: string[] = (currentTrainer as any)?.badges ?? [];
            const hasBadge = earnedBadges.includes(id);

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
                {/* ── Arena background image ── */}
                {/* To replace: drop new PNG into /public/arenas/gyms/<arena-id>.png */}
                <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
                  <div style={{
                    position: 'absolute', inset: 0,
                    backgroundImage: `url(${identity.bgImage})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    opacity: isHigh ? 0.65 : 0.55,
                    imageRendering: 'pixelated',
                    filter: 'blur(1.5px)',
                  }} />
                  {/* Even dark overlay for clean readability */}
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.68) 100%)' }} />
                  {/* Subtle accent bottom glow */}
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '40%', background: `linear-gradient(to top, ${identity.accentDark}55, transparent)` }} />
                </div>

                {/* Corner accents */}
                <div className="absolute top-0 left-0 w-3 h-3 pointer-events-none"
                  style={{ borderTop: `2px solid ${identity.accent}77`, borderLeft: `2px solid ${identity.accent}77`, borderTopLeftRadius: 10 }} />
                <div className="absolute top-0 right-0 w-3 h-3 pointer-events-none"
                  style={{ borderTop: `2px solid ${identity.accent}77`, borderRight: `2px solid ${identity.accent}77`, borderTopRightRadius: 10 }} />
                <div className="absolute bottom-0 left-0 w-3 h-3 pointer-events-none"
                  style={{ borderBottom: `2px solid ${identity.accent}77`, borderLeft: `2px solid ${identity.accent}77`, borderBottomLeftRadius: 10 }} />
                <div className="absolute bottom-0 right-0 w-3 h-3 pointer-events-none"
                  style={{ borderBottom: `2px solid ${identity.accent}77`, borderRight: `2px solid ${identity.accent}77`, borderBottomRightRadius: 10 }} />

                {/* Bottom edge glow */}
                <div className="absolute bottom-0 left-0 right-0 h-1 pointer-events-none rounded-b-xl"
                  style={{ background: `linear-gradient(90deg, transparent, ${identity.accent}${identity.stakeTier === 'high' ? '88' : identity.stakeTier === 'mid' ? '55' : '33'}, transparent)` }} />

                {/* High stakes shimmer */}
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

                {/* Top edge line */}
                <div className="absolute top-0 left-0 right-0 h-0.5 pointer-events-none"
                  style={{ background: `linear-gradient(90deg, transparent, ${identity.accent}, transparent)` }} />

                <div className="relative z-10 flex flex-col h-full px-2.5 pt-2 pb-2">

                  {/* ── TOP ROW: badge icon + city name + stake pill ── */}
                  <div className="flex items-start justify-between gap-1.5 mb-1.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {/* Gym badge */}
                      {badge && (
                        <div className="relative shrink-0 flex items-center justify-center w-7 h-7">
                          {hasBadge && (
                            <motion.div className="absolute inset-0 rounded-full blur-md"
                              style={{ background: badge.color }}
                              animate={{ opacity: [0.4, 0.8, 0.4] }}
                              transition={{ duration: 2, repeat: Infinity }}
                            />
                          )}
                          <img
                            src={badge.file}
                            alt={badge.name}
                            className="w-6 h-6 object-contain relative z-10"
                            style={{
                              imageRendering: 'pixelated',
                              filter: hasBadge
                                ? `drop-shadow(0 0 6px ${badge.color}) drop-shadow(0 0 12px ${badge.color}88)`
                                : `drop-shadow(0 0 3px ${badge.color}66)`,
                            }}
                          />
                        </div>
                      )}
                      <div className="min-w-0">
                        <h2 className="font-black leading-none truncate" style={{
                          fontFamily: '"Impact", "Arial Black", sans-serif',
                          fontSize: ['cerulean-city','vermilion-city','cinnabar-island'].includes(id) ? 13 : 17,
                          letterSpacing: '0.04em',
                          color: '#fff',
                          textShadow: `0 0 12px ${identity.accent}66`,
                        }}>
                          {room.name.toUpperCase()}
                        </h2>
                        {badge && (
                          <p className="leading-none mt-0.5 font-semibold truncate" style={{ color: `${identity.accent}cc`, fontSize: 10 }}>
                            {badge.name}
                          </p>
                        )}
                      </div>
                    </div>
                    {/* Stake pill */}
                    <span className="shrink-0 px-2 py-0.5 rounded-full font-black"
                      style={{
                        fontSize: 8,
                        letterSpacing: '0.08em',
                        background: `${identity.accent}20`,
                        color: band.labelColor,
                        border: `1px solid ${band.labelColor}44`,
                      }}>
                      {band.label}
                    </span>
                  </div>

                  {/* Divider */}
                  <div className="h-px mb-1.5" style={{ background: `linear-gradient(90deg, transparent, ${identity.accent}44, transparent)` }} />

                  {/* ── STAT PANELS: stacked vertically ── */}
                  <div className="flex flex-col gap-1 mb-1.5 flex-1 min-h-0">
                    {/* Entry — slightly muted */}
                    <motion.div className="flex items-center justify-between rounded-lg px-2.5 py-1.5 flex-1"
                      whileHover={{ scale: 1.03, boxShadow: `0 0 16px ${identity.accent}55` }}
                      transition={{ duration: 0.15 }}
                      style={{
                        background: `linear-gradient(160deg, ${identity.accent}18 0%, ${identity.accent}0a 100%)`,
                        border: `1px solid ${identity.accent}33`,
                      }}>
                      <p className="font-black uppercase tracking-widest" style={{ color: `${identity.accent}99`, fontSize: 9 }}>ENTRY</p>
                      <div className="text-right">
                        <p className="font-black text-white leading-none" style={{ fontSize: 15 }}>{entryFee} <span style={{ fontSize: 10, opacity: 0.6 }}>SOL</span></p>
                        <p className="font-bold mt-0.5" style={{ color: `${identity.accent}88`, fontSize: 10 }}>${room.tier}</p>
                      </div>
                    </motion.div>
                    {/* You Win — more saturated + outer glow */}
                    <motion.div className="flex items-center justify-between rounded-lg px-2.5 py-1.5 flex-1 relative overflow-hidden"
                      whileHover={{ scale: 1.03, boxShadow: `0 0 24px ${identity.accent}88, 0 0 8px ${identity.accent}55 inset` }}
                      transition={{ duration: 0.15 }}
                      style={{
                        background: `linear-gradient(160deg, ${identity.accent}38 0%, ${identity.accent}20 100%)`,
                        border: `1px solid ${identity.accent}66`,
                        boxShadow: `0 0 18px ${identity.accent}55, 0 0 6px ${identity.accent}33 inset`,
                      }}>
                      <p className="font-black uppercase tracking-widest" style={{ color: `${identity.accent}bb`, fontSize: 9 }}>YOU WIN</p>
                      <div className="text-right">
                        <p className="font-black leading-none" style={{
                          fontSize: 15,
                          color: identity.accent,
                          textShadow: `0 0 10px ${identity.accent}88`,
                        }}>
                          {getPrizePool(room.tier)} <span style={{ fontSize: 10, opacity: 0.7 }}>SOL</span>
                        </p>
                        <p className="font-bold mt-0.5" style={{ color: `${identity.accent}99`, fontSize: 10 }}>${(room.tier * 2 * 0.95).toFixed(0)}</p>
                      </div>
                    </motion.div>
                  </div>

                  {/* CTA button — pinned to bottom */}
                  <div className="mt-auto shrink-0">
                    {canAfford ? (
                      <motion.div
                        className="relative flex items-center justify-center py-2 rounded-xl font-black overflow-hidden"
                        style={{
                          background: `linear-gradient(135deg, ${identity.accent}44 0%, ${identity.accent}28 100%)`,
                          border: `1px solid ${identity.accent}66`,
                          color: '#fff',
                          fontSize: 11,
                          letterSpacing: '0.06em',
                          boxShadow: `0 2px 16px ${identity.accent}22`,
                          textShadow: `0 0 10px ${identity.accent}88`,
                        }}
                        whileHover={{
                          background: `linear-gradient(135deg, ${identity.accent}66 0%, ${identity.accent}44 100%)`,
                          boxShadow: `0 4px 24px ${identity.accent}44`,
                        } as any}
                        whileTap={{ scale: 0.97 }}
                      >
                        {/* Shimmer sweep on hover */}
                        <motion.div
                          className="absolute inset-0"
                          style={{ background: `linear-gradient(105deg, transparent 30%, ${identity.accent}22 50%, transparent 70%)` }}
                          animate={{ x: ['-100%', '200%'] }}
                          transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 2 }}
                        />
                        <span className="relative z-10">{identity.btnLabel}</span>
                      </motion.div>
                    ) : (
                      <div className="flex items-center justify-center py-2 rounded-xl text-xs font-bold"
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
          className="mt-2 shrink-0 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-6 text-xs"
          style={{ color: 'rgba(255,255,255,0.2)' }}>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
            {battlesTotal > 0 || sessionsToday > 0 ? (
              <span>🎮 {battlesTotal} battles played • {sessionsToday} trainers today</span>
            ) : (
              <span>Be the first to battle today!</span>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
