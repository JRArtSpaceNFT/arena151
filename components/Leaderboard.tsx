'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Trophy, X, Target, TrendingUp, TrendingDown } from 'lucide-react';
import { useArenaStore } from '@/lib/store';
import { getAllUsers } from '@/lib/auth';
import { TYPE_COLORS } from '@/lib/constants';
import { getPokemonSpriteUrl } from '@/lib/pokemon-data';

type LeaderboardEntry = {
  rank: number;
  avatar: string;
  displayName: string;
  username: string;
  bio: string;
  wins: number;
  losses: number;
  winRate: number;
  favoritePokemonId: number;
  favoritePokemonName: string;
  favoritePokemonTypes: string[];
  balance: number;
  earnings: number;
  joinedDate: string;
  badges: string[];
};

const GYM_BADGES = [
  { name: 'Boulder Badge', file: '/BoulderBadge.png', wins: 5   },
  { name: 'Cascade Badge', file: '/CascadeBadge.png', wins: 19  },
  { name: 'Thunder Badge', file: '/ThunderBadge.png', wins: 33  },
  { name: 'Rainbow Badge', file: '/RainbowBadge.png', wins: 47  },
  { name: 'Soul Badge',    file: '/SoulBadge.png',    wins: 61  },
  { name: 'Marsh Badge',   file: '/MarshBadge.png',   wins: 75  },
  { name: 'Volcano Badge', file: '/VolcanoBadge.png', wins: 89  },
  { name: 'Earth Badge',   file: '/EarthBadge.png',   wins: 100 },
];

function getTrainerTitle(wins: number) {
  if (wins >= 30) return 'Champion';
  if (wins >= 15) return 'Elite Contender';
  if (wins >= 5) return 'Gym Challenger';
  return 'Rookie Trainer';
}

const RANK_STYLES = {
  1: { label: '1', color: '#FFD700', glow: 'rgba(255,215,0,0.6)',  bg: 'linear-gradient(135deg,rgba(255,215,0,0.18),rgba(255,180,0,0.08))',  border: 'rgba(255,215,0,0.5)',  rowBg: 'linear-gradient(90deg,rgba(255,215,0,0.10),rgba(255,215,0,0.03),transparent)', crown: '👑' },
  2: { label: '2', color: '#C0C8D8', glow: 'rgba(192,200,216,0.5)', bg: 'linear-gradient(135deg,rgba(192,200,216,0.15),rgba(148,163,184,0.06))', border: 'rgba(192,200,216,0.4)', rowBg: 'linear-gradient(90deg,rgba(192,200,216,0.08),rgba(192,200,216,0.02),transparent)', crown: '🥈' },
  3: { label: '3', color: '#CD7F32', glow: 'rgba(205,127,50,0.5)',  bg: 'linear-gradient(135deg,rgba(205,127,50,0.15),rgba(249,115,22,0.06))',  border: 'rgba(205,127,50,0.4)',  rowBg: 'linear-gradient(90deg,rgba(205,127,50,0.08),rgba(205,127,50,0.02),transparent)', crown: '🥉' },
} as Record<number, { label: string; color: string; glow: string; bg: string; border: string; rowBg: string; crown: string }>;

// ── Trainer Profile Modal ──
function TrainerModal({ entry, onClose }: { entry: LeaderboardEntry; onClose: () => void }) {
  const typeColor = TYPE_COLORS[entry.favoritePokemonTypes[0] as keyof typeof TYPE_COLORS] ?? '#6366f1';
  const isProfit = entry.earnings >= 0;
  const earnedBadges = GYM_BADGES.filter(b => entry.wins >= b.wins).length;
  const title = getTrainerTitle(entry.wins);
  const total = entry.wins + entry.losses;
  const rs = RANK_STYLES[entry.rank];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 24 }}
        transition={{ type: 'spring', stiffness: 300, damping: 26 }}
        className="relative w-full max-w-md rounded-3xl overflow-hidden shadow-2xl"
        style={{ background: 'linear-gradient(160deg,#1a1040,#0d1a3e,#1a0a2e)', border: `1px solid ${typeColor}44` }}
        onClick={e => e.stopPropagation()}>

        {/* Shimmer stripe at top */}
        <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${typeColor}, #a855f7, ${typeColor})` }} />

        {rs && (
          <motion.div className="absolute inset-0 pointer-events-none rounded-3xl"
            style={{ boxShadow: `inset 0 0 40px ${rs.glow}` }}
            animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 2.5, repeat: Infinity }} />
        )}

        <button onClick={onClose}
          className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full flex items-center justify-center transition-colors"
          style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.5)' }}>
          <X className="w-4 h-4" />
        </button>

        <div className="p-6">
          {/* Rank badge if top 3 */}
          {rs && (
            <div className="flex justify-center mb-3">
              <motion.div className="text-4xl" animate={{ scale: [1, 1.1, 1], rotate: [0, 4, -4, 0] }} transition={{ duration: 2, repeat: Infinity }}>
                {rs.crown}
              </motion.div>
            </div>
          )}

          {/* Avatar + name */}
          <div className="flex items-center gap-4 mb-5">
            <div className="relative">
              <motion.div className="absolute -inset-1 rounded-full blur-md"
                style={{ background: typeColor, opacity: 0.3 }}
                animate={{ opacity: [0.2, 0.45, 0.2] }} transition={{ duration: 2.5, repeat: Infinity }} />
              <div className="w-20 h-20 rounded-full overflow-hidden relative z-10"
                style={{ border: `3px solid ${typeColor}`, boxShadow: `0 0 20px ${typeColor}55` }}>
                {entry.avatar?.startsWith('data:') || entry.avatar?.startsWith('/') ? (
                  <img src={entry.avatar} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-4xl"
                    style={{ background: `linear-gradient(135deg, ${typeColor}33, #7c3aed33)` }}>
                    {entry.avatar || '🧑'}
                  </div>
                )}
              </div>
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-black text-white">{entry.displayName}</h2>
              <p className="text-xs font-bold mb-0.5" style={{ color: typeColor }}>{title}</p>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>@{entry.username}</p>
              {entry.bio && <p className="text-xs mt-1 line-clamp-2" style={{ color: 'rgba(255,255,255,0.45)' }}>{entry.bio}</p>}
            </div>
            <div className="flex flex-col items-center shrink-0">
              <motion.img src={getPokemonSpriteUrl(entry.favoritePokemonId)} alt={entry.favoritePokemonName}
                className="w-14 h-14 object-contain"
                style={{ imageRendering: 'pixelated', filter: `drop-shadow(0 0 6px ${typeColor})` }}
                animate={{ y: [0, -4, 0] }} transition={{ duration: 2.5, repeat: Infinity }} />
              <p className="text-xs font-bold mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>{entry.favoritePokemonName}</p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="rounded-xl p-3 text-center relative overflow-hidden"
              style={{ background: 'linear-gradient(160deg,#052e16,#0a1a10)', border: '1px solid rgba(74,222,128,0.2)' }}>
              <div className="flex items-center justify-center gap-1 mb-1">
                <Trophy className="w-3 h-3 text-green-400" />
                <span className="text-xs font-black text-green-400 uppercase">Wins</span>
              </div>
              <p className="text-2xl font-black text-green-400" style={{ textShadow: '0 0 14px rgba(74,222,128,0.5)' }}>{entry.wins}</p>
            </div>
            <div className="rounded-xl p-3 text-center"
              style={{ background: 'linear-gradient(160deg,#2d0a0a,#1a0a0a)', border: '1px solid rgba(248,113,113,0.2)' }}>
              <div className="flex items-center justify-center gap-1 mb-1">
                <Target className="w-3 h-3 text-red-400" />
                <span className="text-xs font-black text-red-400 uppercase">Losses</span>
              </div>
              <p className="text-2xl font-black text-red-400">{entry.losses}</p>
            </div>
            <div className="rounded-xl p-3 text-center"
              style={{ background: isProfit ? 'linear-gradient(160deg,#052e16,#0a1a10)' : 'linear-gradient(160deg,#2d0a0a,#1a0a0a)', border: `1px solid ${isProfit ? 'rgba(74,222,128,0.2)' : 'rgba(248,113,113,0.2)'}` }}>
              <div className={`flex items-center justify-center gap-1 mb-1 ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
                {isProfit ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                <span className="text-xs font-black uppercase">P&L</span>
              </div>
              <p className={`text-lg font-black ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
                {isProfit ? '+' : ''}{entry.earnings.toFixed(2)}
              </p>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>SOL</p>
            </div>
          </div>

          {/* Win rate bar */}
          <div className="rounded-xl p-3 border mb-4" style={{ background: 'rgba(255,255,255,0.04)', borderColor: `${typeColor}22` }}>
            <div className="flex justify-between text-xs font-bold mb-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
              <span>Win Rate</span>
              <span style={{ color: typeColor }}>{entry.winRate.toFixed(0)}% ({total} battles)</span>
            </div>
            <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <motion.div className="h-full rounded-full" style={{ background: `linear-gradient(90deg, ${typeColor}, #a855f7)` }}
                initial={{ width: 0 }} animate={{ width: `${entry.winRate}%` }} transition={{ duration: 0.7, ease: 'easeOut' }} />
            </div>
          </div>

          {/* Gym Badges */}
          <div className="rounded-xl p-3 border" style={{ background: 'rgba(168,85,247,0.06)', borderColor: 'rgba(168,85,247,0.2)' }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-black text-white/60">🏅 Gym Badges</span>
              <span className="text-xs font-black" style={{ color: '#c084fc' }}>{earnedBadges}/8</span>
            </div>
            <div className="grid grid-cols-8 gap-1">
              {GYM_BADGES.map(badge => {
                const earned = entry.wins >= badge.wins;
                return (
                  <div key={badge.name} className="flex flex-col items-center" title={badge.name}>
                    <img src={badge.file} alt={badge.name} className="w-8 h-8 object-contain"
                      style={earned ? { filter: `drop-shadow(0 0 5px ${typeColor})` } : { filter: 'grayscale(100%) brightness(0.3)', opacity: 0.4 }} />
                  </div>
                );
              })}
            </div>
          </div>

          <p className="text-center text-xs mt-3" style={{ color: 'rgba(255,255,255,0.25)' }}>
            Trainer since {new Date(entry.joinedDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}

type SortMode = 'wins' | 'earnings' | 'hallOfFame';

export default function Leaderboard() {
  const { setScreen, currentTrainer } = useArenaStore();
  const [allUsers, setAllUsers] = useState<LeaderboardEntry[]>([]);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [selected, setSelected] = useState<LeaderboardEntry | null>(null);
  const [myRank, setMyRank] = useState<{ rank: number; total: number } | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>('wins');

  useEffect(() => {
    const users = getAllUsers();
    const mapped = users.map(u => ({
      avatar: u.avatar, displayName: u.displayName, username: u.username, bio: u.bio,
      wins: u.wins, losses: u.losses, joinedDate: u.joinedDate,
      favoritePokemonId: u.favoritePokemonId, favoritePokemonName: u.favoritePokemonName,
      favoritePokemonTypes: u.favoritePokemonTypes, balance: u.balance, earnings: u.earnings ?? 0,
      badges: u.badges ?? [],
      winRate: u.wins + u.losses > 0 ? (u.wins / (u.wins + u.losses)) * 100 : 0,
    }));
    setAllUsers(mapped.map((u, i) => ({ ...u, rank: i + 1 })));
  }, []);

  useEffect(() => {
    if (!allUsers.length) return;
    const sorted = [...allUsers].sort((a, b) => {
      if (sortMode === 'earnings') return b.earnings - a.earnings;
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (b.winRate !== a.winRate) return b.winRate - a.winRate;
      return new Date(a.joinedDate).getTime() - new Date(b.joinedDate).getTime();
    }).map((u, i) => ({ ...u, rank: i + 1 }));
    if (currentTrainer) {
      const me = sorted.find(u => u.username === currentTrainer.username);
      if (me) setMyRank({ rank: me.rank, total: allUsers.length });
    }
    setEntries(sorted.slice(0, 25));
  }, [allUsers, sortMode, currentTrainer]);

  return (
    <div className="h-screen overflow-hidden flex flex-col relative"
      style={{ backgroundImage: 'url(/leaderboard-bg.png)', backgroundSize: 'cover', backgroundPosition: 'center' }}>

      {/* Darker arena overlay */}
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.60)' }} />
      {/* Extra blur + vignette around the board area */}
      <div className="absolute inset-0 pointer-events-none" style={{ backdropFilter: 'blur(2px)' }} />
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 80% 80% at center, transparent 30%, rgba(0,0,0,0.55) 100%)' }} />

      <AnimatePresence>
        {selected && <TrainerModal entry={selected} onClose={() => setSelected(null)} />}
      </AnimatePresence>

      <div className="relative z-10 flex flex-col h-full max-w-3xl mx-auto w-full px-4 pt-5 pb-4">

        {/* ── Header ── */}
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="mb-5 shrink-0">
          {/* Back button row */}
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => setScreen('draft-mode-intro')}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-bold transition-all border"
              style={{ background: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.7)' }}>
              <ArrowLeft className="w-4 h-4" /> Back
            </button>

            {/* Sort tabs */}
            <div className="flex gap-1 rounded-xl p-1 border" style={{ background: 'rgba(0,0,0,0.35)', borderColor: 'rgba(255,255,255,0.12)' }}>
              <button onClick={() => setSortMode('wins')}
                className="px-4 py-1.5 rounded-lg text-xs font-black transition-all"
                style={sortMode === 'wins'
                  ? { background: 'linear-gradient(135deg,#d97706,#f59e0b)', color: '#000' }
                  : { color: 'rgba(255,255,255,0.5)' }}>
                🏆 Most Wins
              </button>
              <button onClick={() => setSortMode('earnings')}
                className="px-4 py-1.5 rounded-lg text-xs font-black transition-all"
                style={sortMode === 'earnings'
                  ? { background: 'linear-gradient(135deg,#15803d,#22c55e)', color: '#000' }
                  : { color: 'rgba(255,255,255,0.5)' }}>
                💰 Earnings
              </button>
              <button onClick={() => setSortMode('hallOfFame')}
                className="px-4 py-1.5 rounded-lg text-xs font-black transition-all"
                style={sortMode === 'hallOfFame'
                  ? { background: 'linear-gradient(135deg,#92400e,#fbbf24)', color: '#000' }
                  : { color: 'rgba(255,255,255,0.5)' }}>
                🏛️ Hall of Fame
              </button>
            </div>
          </div>

          {/* Title block */}
          <div className="flex items-end justify-between">
            <div>
              <h1 className="font-black leading-none mb-1"
                style={{ fontSize: 38, background: 'linear-gradient(135deg,#FFD700,#FFA500,#FFD700)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', textShadow: 'none', letterSpacing: '-0.01em' }}>
                Top 25 Trainers
              </h1>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)', letterSpacing: '0.06em' }}>
                {allUsers.length} trainers registered · click any row to view profile
              </p>
            </div>
            {myRank && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl shrink-0 border"
                style={{ background: 'rgba(0,0,0,0.4)', borderColor: 'rgba(255,215,0,0.25)' }}>
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Your Rank</span>
                <span className="font-black text-amber-400 text-lg">#{myRank.rank}</span>
                <span style={{ color: 'rgba(255,255,255,0.2)' }}>/</span>
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{myRank.total}</span>
                {myRank.rank <= 25 && <span className="text-green-400 text-xs font-black">↑ ON BOARD</span>}
              </div>
            )}
          </div>
        </motion.div>

        {/* ── Hall of Fame Tab ── */}
        {sortMode === 'hallOfFame' && (
          <motion.div key="hof" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="flex-1 min-h-0 rounded-2xl overflow-hidden flex flex-col"
            style={{ background: 'linear-gradient(160deg,rgba(120,80,0,0.45),rgba(30,15,0,0.75))', backdropFilter: 'blur(24px)', border: '1px solid rgba(251,191,36,0.4)', boxShadow: '0 0 60px rgba(251,191,36,0.15)' }}>
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b shrink-0" style={{ borderColor: 'rgba(251,191,36,0.2)' }}>
              <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ duration: 3, repeat: Infinity }}>
                <span style={{ fontSize: 28 }}>🏆</span>
              </motion.div>
              <div>
                <h2 className="font-black text-lg uppercase tracking-widest" style={{ background: 'linear-gradient(90deg,#fbbf24,#fff,#fbbf24)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', filter: 'drop-shadow(0 0 8px rgba(251,191,36,0.6))' }}>
                  Hall of Fame
                </h2>
                <p className="text-xs" style={{ color: 'rgba(251,191,36,0.6)' }}>Trainers who conquered all 8 Kanto Gyms</p>
              </div>
            </div>
            {/* Champions */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {allUsers.filter(u => u.badges?.length >= 8).length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-20 gap-3">
                  <span style={{ fontSize: 56 }}>🏛️</span>
                  <p className="text-lg font-black text-white/40">No champions yet</p>
                  <p className="text-sm text-white/25">Collect all 8 Gym Badges to enter the Hall of Fame</p>
                  <div className="flex gap-1.5 mt-2">
                    {['/BoulderBadge.png','/CascadeBadge.png','/ThunderBadge.png','/RainbowBadge.png','/SoulBadge.png','/MarshBadge.png','/VolcanoBadge.png','/EarthBadge.png'].map((b, bi) => (
                      <img key={bi} src={b} alt="" className="w-8 h-8 object-contain" style={{ imageRendering: 'pixelated', filter: 'grayscale(100%) brightness(0.4)', opacity: 0.5 }} />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {allUsers.filter(u => u.badges?.length >= 8).map((u, i) => (
                    <motion.div key={u.username}
                      initial={{ opacity: 0, x: -16 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.07 }}
                      className="flex items-center gap-4 px-4 py-3 rounded-2xl cursor-pointer"
                      onClick={() => setSelected({ ...u, rank: i + 1 })}
                      style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.35)', boxShadow: '0 0 20px rgba(251,191,36,0.12)' }}>
                      {/* Rank */}
                      <div className="flex items-center justify-center w-9 h-9 rounded-xl shrink-0 font-black text-lg"
                        style={{ background: 'rgba(251,191,36,0.18)', border: '1px solid rgba(251,191,36,0.4)', color: '#fbbf24' }}>
                        {i === 0 ? '👑' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}
                      </div>
                      {/* Avatar */}
                      <div className="w-12 h-12 rounded-full overflow-hidden border-2 shrink-0" style={{ borderColor: '#fbbf24', boxShadow: '0 0 12px rgba(251,191,36,0.5)' }}>
                        {u.avatar?.startsWith('/') || u.avatar?.startsWith('data:') ? (
                          <img src={u.avatar} alt={u.displayName} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-2xl" style={{ background: 'rgba(251,191,36,0.2)' }}>{u.avatar || '🧑'}</div>
                        )}
                      </div>
                      {/* Name + stats */}
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-base text-white leading-none truncate">{u.displayName}</p>
                        <p className="text-xs mt-0.5 truncate" style={{ color: 'rgba(251,191,36,0.7)' }}>@{u.username} · {u.wins}W · {u.losses}L</p>
                      </div>
                      {/* All 8 badges */}
                      <div className="flex gap-1 shrink-0">
                        {['/BoulderBadge.png','/CascadeBadge.png','/ThunderBadge.png','/RainbowBadge.png','/SoulBadge.png','/MarshBadge.png','/VolcanoBadge.png','/EarthBadge.png'].map((b, bi) => (
                          <img key={bi} src={b} alt="" className="w-5 h-5 object-contain" style={{ imageRendering: 'pixelated', filter: 'drop-shadow(0 0 4px rgba(251,191,36,0.9))' }} />
                        ))}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ── Table ── */}
        {sortMode !== 'hallOfFame' && (
        <motion.div key="table" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="flex-1 min-h-0 rounded-2xl overflow-hidden flex flex-col"
          style={{ background: 'rgba(10,8,24,0.82)', backdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 0 60px rgba(0,0,0,0.6)' }}>

          {/* Column headers */}
          <div className={`grid gap-2 px-4 py-2.5 shrink-0 text-xs font-black uppercase tracking-widest ${sortMode === 'earnings' ? 'grid-cols-[52px_1fr_110px_72px]' : 'grid-cols-[52px_1fr_72px_72px_72px]'}`}
            style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.35)' }}>
            <span>Rank</span>
            <span>Trainer</span>
            {sortMode === 'earnings' ? (
              <><span className="text-center text-green-500/70">Earnings</span><span className="text-center">Win %</span></>
            ) : (
              <><span className="text-center text-green-500/70">Wins</span><span className="text-center text-red-500/70">Losses</span><span className="text-center">Win %</span></>
            )}
          </div>

          {entries.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-20">
              <p className="text-5xl mb-4">🏆</p>
              <p className="text-xl font-bold text-white/50 mb-2">No trainers have battled yet.</p>
              <p className="text-white/30">Be the first legend!</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              {entries.map((entry, i) => {
                const rs = RANK_STYLES[entry.rank];
                const isTop3 = entry.rank <= 3;
                return (
                  <motion.button key={entry.username}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(i * 0.025, 0.45) }}
                    onClick={() => setSelected(entry)}
                    whileHover={{ backgroundColor: 'rgba(255,255,255,0.04)' }}
                    className={`w-full grid gap-2 items-center px-4 cursor-pointer text-left relative overflow-hidden transition-colors ${sortMode === 'earnings' ? 'grid-cols-[52px_1fr_110px_72px]' : 'grid-cols-[52px_1fr_72px_72px_72px]'} ${isTop3 ? 'py-3.5' : 'py-2.5'}`}
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                  >
                    {/* Top 3 row background */}
                    {rs && (
                      <>
                        <div className="absolute inset-0 pointer-events-none" style={{ background: rs.rowBg }} />
                        {/* animated shimmer for top 3 */}
                        <motion.div className="absolute inset-0 pointer-events-none"
                          style={{ background: `linear-gradient(105deg,transparent 30%,${rs.glow.replace('0.', '0.08,').split(',')[0]},0.08) 50%,transparent 70%)` }}
                          animate={{ x: ['-100%', '200%'] }}
                          transition={{ duration: 3, repeat: Infinity, repeatDelay: 4 + i }}
                        />
                        {/* left accent bar */}
                        <div className="absolute left-0 top-0 bottom-0 w-0.5" style={{ background: rs.color, boxShadow: `0 0 8px ${rs.glow}` }} />
                      </>
                    )}

                    {/* Rank badge */}
                    <div className="flex items-center justify-center w-10 h-10 rounded-xl font-black text-sm relative z-10"
                      style={rs
                        ? { background: rs.bg, border: `1px solid ${rs.border}`, color: rs.color, boxShadow: `0 0 12px ${rs.glow}` }
                        : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.35)' }}>
                      {rs ? rs.crown : `#${entry.rank}`}
                    </div>

                    {/* Trainer info */}
                    <div className="flex items-center gap-3 min-w-0 relative z-10">
                      <div className="flex-shrink-0 overflow-hidden flex items-center justify-center"
                        style={{
                          width: isTop3 ? 36 : 30, height: isTop3 ? 36 : 30,
                          borderRadius: 10,
                          border: `1.5px solid ${rs ? rs.border : 'rgba(255,255,255,0.1)'}`,
                          boxShadow: rs ? `0 0 8px ${rs.glow}` : 'none',
                          background: 'rgba(255,255,255,0.06)',
                        }}>
                        {entry.avatar?.startsWith('data:') || entry.avatar?.startsWith('/') ? (
                          <img src={entry.avatar} alt="" className="w-full h-full object-cover" />
                        ) : <span style={{ fontSize: isTop3 ? 18 : 14 }}>{entry.avatar || '🧑'}</span>}
                      </div>
                      <div className="min-w-0">
                        <p className="font-black truncate"
                          style={{ fontSize: isTop3 ? 15 : 13, color: rs ? rs.color : 'rgba(255,255,255,0.85)', textShadow: rs ? `0 0 10px ${rs.glow}` : 'none' }}>
                          {entry.displayName}
                        </p>
                        <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.3)' }}>@{entry.username}</p>
                      </div>
                    </div>

                    {/* Stats */}
                    {sortMode === 'earnings' ? (
                      <>
                        <p className={`text-center font-black relative z-10 ${isTop3 ? 'text-sm' : 'text-xs'} ${entry.earnings >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {entry.earnings >= 0 ? '+' : ''}{entry.earnings.toFixed(3)} ◎
                        </p>
                        <p className={`text-center font-bold relative z-10 ${isTop3 ? 'text-sm' : 'text-xs'} ${entry.winRate >= 60 ? 'text-green-400' : entry.winRate >= 40 ? 'text-white/60' : 'text-red-400'}`}>
                          {entry.winRate.toFixed(0)}%
                        </p>
                      </>
                    ) : (
                      <>
                        <p className={`text-center font-black text-green-400 relative z-10 ${isTop3 ? 'text-base' : 'text-sm'}`}
                          style={isTop3 ? { textShadow: '0 0 10px rgba(74,222,128,0.5)' } : {}}>
                          {entry.wins}
                        </p>
                        <p className={`text-center font-bold text-red-400 relative z-10 ${isTop3 ? 'text-sm' : 'text-xs'}`}>{entry.losses}</p>
                        <p className={`text-center font-bold relative z-10 ${isTop3 ? 'text-sm' : 'text-xs'} ${entry.winRate >= 60 ? 'text-green-400' : entry.winRate >= 40 ? 'text-white/60' : 'text-red-400'}`}>
                          {entry.winRate.toFixed(0)}%
                        </p>
                      </>
                    )}
                  </motion.button>
                );
              })}
            </div>
          )}
        </motion.div>

        )}

        {sortMode !== 'hallOfFame' && !myRank && (
          <p className="text-center text-xs mt-2 shrink-0" style={{ color: 'rgba(255,255,255,0.25)' }}>Sign in to see your rank</p>
        )}
      </div>
    </div>
  );
}
