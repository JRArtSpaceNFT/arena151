'use client';

import { motion } from 'framer-motion';
import { Wallet, ArrowLeft, RefreshCw, TrendingUp } from 'lucide-react';
import { useArenaStore } from '@/lib/store';
import { ROOM_TIERS, ARENA_BADGES, usdToSol } from '@/lib/constants';
import { useSolPrice } from '@/lib/useSolPrice';
import type { BattleRoom } from '@/types';

// Per-arena identity config — background images are drop-in from /public/arenas/gyms/
// To replace a background: drop a new image into /public/arenas/gyms/<arena-id>.png
const ARENA_IDENTITY: Record<string, {
  flavor: string;
  bgImage: string;       // drop-in path: /public/arenas/gyms/<id>.png
  accent: string;
  accentDark: string;
  stakeTier: 'low' | 'mid' | 'high';
  btnLabel: string;
}> = {
  'pewter-city':    { flavor: 'Built on grit, stone, and resolve',     bgImage: '/arenas/gyms/pewter-city.png',    accent: '#a8a29e', accentDark: '#292524', stakeTier: 'low',  btnLabel: 'Break the Rock →' },
  'cerulean-city':  { flavor: 'Calm waters hide fierce rivals',        bgImage: '/arenas/gyms/cerulean-city.png',  accent: '#38bdf8', accentDark: '#075985', stakeTier: 'low',  btnLabel: 'Dive In →' },
  'vermilion-city': { flavor: 'Fast hands and electric nerves',        bgImage: '/arenas/gyms/vermilion-city.png', accent: '#facc15', accentDark: '#713f12', stakeTier: 'mid',  btnLabel: 'Charge Up →' },
  'celadon-city':   { flavor: 'Fortunes bloom where skill survives',   bgImage: '/arenas/gyms/celadon-city.png',   accent: '#86efac', accentDark: '#14532d', stakeTier: 'mid',  btnLabel: 'Claim Fortune →' },
  'fuchsia-city':   { flavor: 'Where poison and precision meet',       bgImage: '/arenas/gyms/fuchsia-city.png',   accent: '#c084fc', accentDark: '#3b0764', stakeTier: 'mid',  btnLabel: 'Enter the Dojo →' },
  'saffron-city':   { flavor: 'Only the mind can pierce this veil',    bgImage: '/arenas/gyms/saffron-city.png',   accent: '#f0abfc', accentDark: '#4a044e', stakeTier: 'high', btnLabel: 'Test Your Mind →' },
  'cinnabar-island':{ flavor: 'Forged in fire, tempered by fury',      bgImage: '/arenas/gyms/cinnabar-island.png',accent: '#fb923c', accentDark: '#7c2d12', stakeTier: 'high', btnLabel: 'Brave the Flames →' },
  'viridian-city':  { flavor: 'The final test. Legends are born here.',bgImage: '/arenas/gyms/viridian-city.png',  accent: '#fbbf24', accentDark: '#451a03', stakeTier: 'high', btnLabel: 'Claim the Throne →' },
};

const STAKE_BAND = {
  low:  { label: 'LOW STAKES',  labelColor: '#4ade80', borderOpacity: 0.2, glowStrength: 12 },
  mid:  { label: 'MID STAKES',  labelColor: '#38bdf8', borderOpacity: 0.3, glowStrength: 20 },
  high: { label: 'HIGH STAKES', labelColor: '#fbbf24', borderOpacity: 0.45, glowStrength: 32 },
};

export default function RoomSelect() {
  const { currentTrainer, setScreen, startQueue } = useArenaStore();
  const { solPrice, loading: priceLoading } = useSolPrice();

  const getEntryFee = (tierUsd: number) => usdToSol(tierUsd, solPrice);
  const getPrizePool = (tierUsd: number) => usdToSol(tierUsd * 2 * 0.95, solPrice);

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
              <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Conquer all 8 Kanto Gyms — earn every badge</p>
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

        {/* ── Arena Grid ── */}
        <div className="grid grid-cols-4 gap-2.5 flex-1 min-h-0">
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
                {/* Images are B&W Game Boy style — no saturation filter applied */}
                <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
                  <div style={{
                    position: 'absolute', inset: 0,
                    backgroundImage: `url(${identity.bgImage})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    opacity: isHigh ? 0.45 : 0.38,
                    imageRendering: 'pixelated',
                  }} />
                  {/* Dark overlay — keeps text readable over B&W art */}
                  <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(160deg, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.78) 100%)` }} />
                  {/* Accent color tint — gives each card its identity even on B&W */}
                  <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(160deg, ${identity.accentDark}66 0%, transparent 55%)` }} />
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

                <div className="relative z-10 flex flex-col h-full p-3">

                  {/* ── Badge + arena header row ── */}
                  <div className="flex items-start gap-2 mb-1.5">
                    {/* Gym badge icon */}
                    {badge && (
                      <div className="relative shrink-0 flex items-center justify-center w-10 h-10">
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
                          className="w-9 h-9 object-contain relative z-10"
                          style={hasBadge
                            ? { filter: `drop-shadow(0 0 5px ${badge.color})`, imageRendering: 'pixelated' }
                            : { filter: 'grayscale(100%) brightness(0.4)', opacity: 0.5, imageRendering: 'pixelated' }
                          }
                        />
                        {hasBadge && (
                          <div className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-yellow-400 border-2 border-white flex items-center justify-center z-20"
                            style={{ fontSize: 7 }}>✓</div>
                        )}
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <h2 className="font-black text-sm leading-none truncate" style={{ color: identity.accent }}>
                          {room.name}
                        </h2>
                        <span className="text-xs font-black px-1.5 py-0.5 rounded-md shrink-0"
                          style={{ background: `${identity.accent}18`, color: identity.accent, border: `1px solid ${identity.accent}33`, fontSize: 9 }}>
                          {band.label}
                        </span>
                      </div>
                      {badge && (
                        <p className="text-xs leading-none font-semibold" style={{ color: `${badge.color}cc`, fontSize: 10 }}>
                          {badge.leader} · {badge.name}
                        </p>
                      )}
                      <p className="text-xs leading-tight mt-0.5" style={{ color: 'rgba(255,255,255,0.35)', fontStyle: 'italic', fontSize: 10 }}>
                        {identity.flavor}
                      </p>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="h-px mb-2" style={{ background: `linear-gradient(90deg,transparent,${identity.accent}33,transparent)` }} />

                  {/* ── Stakes (SOL + USD) ── */}
                  <div className="grid grid-cols-3 gap-1.5 mb-2">
                    <div className="text-center rounded-lg py-1.5"
                      style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <p className="font-bold uppercase tracking-wide mb-0.5" style={{ color: 'rgba(255,255,255,0.3)', fontSize: 9 }}>Entry</p>
                      <p className="font-black text-xs text-white">{entryFee} ◎</p>
                      <p className="font-bold" style={{ color: 'rgba(255,255,255,0.35)', fontSize: 9 }}>${room.tier}</p>
                    </div>
                    <div className="text-center rounded-lg py-1.5"
                      style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <p className="font-bold uppercase tracking-wide mb-0.5" style={{ color: 'rgba(255,255,255,0.3)', fontSize: 9 }}>Pot</p>
                      <p className="font-black text-xs text-white">{getPrizePool(room.tier)} ◎</p>
                      <p className="font-bold" style={{ color: 'rgba(255,255,255,0.35)', fontSize: 9 }}>${(room.tier * 2 * 0.95).toFixed(0)}</p>
                    </div>
                    <div className="text-center rounded-lg py-1.5"
                      style={{ background: `${identity.accent}14`, border: `1px solid ${identity.accent}33` }}>
                      <p className="font-black uppercase tracking-wide mb-0.5" style={{ color: `${identity.accent}99`, fontSize: 9 }}>You Win</p>
                      <p className="font-black text-xs" style={{ color: identity.accent, textShadow: `0 0 8px ${identity.accent}66` }}>
                        {getPrizePool(room.tier)} ◎
                      </p>
                      <p className="font-bold" style={{ color: `${identity.accent}88`, fontSize: 9 }}>${(room.tier * 2 * 0.95).toFixed(0)}</p>
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
        </motion.div>
      </div>
    </div>
  );
}
