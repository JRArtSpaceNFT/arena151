'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Trophy, X, Target, TrendingUp, TrendingDown, Heart } from 'lucide-react';
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

function getRankMedal(rank: number) {
  if (rank === 1) return { medal: '🥇', color: '#d97706', bg: 'rgba(251,191,36,0.15)', border: 'rgba(251,191,36,0.5)', leftBorder: '#f59e0b' };
  if (rank === 2) return { medal: '🥈', color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.4)', leftBorder: '#94a3b8' };
  if (rank === 3) return { medal: '🥉', color: '#f97316', bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.35)', leftBorder: '#f97316' };
  return { medal: `#${rank}`, color: '#94a3b8', bg: 'transparent', border: 'transparent', leftBorder: 'transparent' };
}

function TrainerModal({ entry, onClose }: { entry: LeaderboardEntry; onClose: () => void }) {
  const typeColor = TYPE_COLORS[entry.favoritePokemonTypes[0] as keyof typeof TYPE_COLORS] ?? '#6366f1';
  const isProfit = entry.earnings >= 0;
  const earnedBadges = GYM_BADGES.filter(b => entry.wins >= b.wins).length;
  const title = getTrainerTitle(entry.wins);
  const total = entry.wins + entry.losses;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 20 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="relative w-full max-w-md rounded-3xl overflow-hidden shadow-2xl border border-white/80"
        style={{ background: 'linear-gradient(150deg, #eff6ff 0%, #ede9fe 50%, #fce7f3 100%)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Close */}
        <button onClick={onClose}
          className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-white/70 border border-white flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors shadow-sm">
          <X className="w-4 h-4" />
        </button>

        {/* Type color header strip */}
        <div className="h-1.5 w-full" style={{ background: `linear-gradient(90deg, ${typeColor}, #a855f7)` }} />

        <div className="p-6">
          {/* Avatar + name */}
          <div className="flex items-center gap-4 mb-5">
            <div className="relative">
              <motion.div className="absolute inset-0 rounded-full"
                style={{ boxShadow: `0 0 16px 4px ${typeColor}55` }}
                animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 2.5, repeat: Infinity }} />
              <div className="w-20 h-20 rounded-full overflow-hidden border-4 shadow-lg relative"
                style={{ borderColor: typeColor }}>
                {entry.avatar?.startsWith('data:') || entry.avatar?.startsWith('/') ? (
                  <img src={entry.avatar} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center text-4xl">
                    {entry.avatar || '🧑'}
                  </div>
                )}
              </div>
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-black text-slate-800">{entry.displayName}</h2>
              <p className="text-xs font-bold mb-0.5" style={{ color: typeColor }}>{title}</p>
              <p className="text-xs text-slate-400">@{entry.username}</p>
              {entry.bio && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{entry.bio}</p>}
            </div>
            {/* Partner */}
            <div className="flex flex-col items-center shrink-0">
              <motion.img
                src={getPokemonSpriteUrl(entry.favoritePokemonId)}
                alt={entry.favoritePokemonName}
                className="w-14 h-14 object-contain"
                style={{ imageRendering: 'pixelated', filter: `drop-shadow(0 0 5px ${typeColor})` }}
                animate={{ y: [0, -4, 0] }} transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
              />
              <p className="text-xs font-bold text-slate-500 mt-0.5">{entry.favoritePokemonName}</p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="bg-white/70 rounded-xl p-3 text-center border border-green-100">
              <div className="flex items-center justify-center gap-1 mb-1"><Trophy className="w-3 h-3 text-green-500" /><span className="text-xs font-bold text-green-600">Wins</span></div>
              <p className="text-2xl font-black text-green-600">{entry.wins}</p>
            </div>
            <div className="bg-white/70 rounded-xl p-3 text-center border border-red-100">
              <div className="flex items-center justify-center gap-1 mb-1"><Target className="w-3 h-3 text-red-400" /><span className="text-xs font-bold text-red-500">Losses</span></div>
              <p className="text-2xl font-black text-red-500">{entry.losses}</p>
            </div>
            <div className={`bg-white/70 rounded-xl p-3 text-center border ${isProfit ? 'border-green-100' : 'border-red-100'}`}>
              <div className={`flex items-center justify-center gap-1 mb-1 ${isProfit ? 'text-green-500' : 'text-red-400'}`}>
                {isProfit ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                <span className="text-xs font-bold">P&L</span>
              </div>
              <p className={`text-lg font-black ${isProfit ? 'text-green-600' : 'text-red-500'}`}>
                {isProfit ? '+' : ''}{entry.earnings.toFixed(2)}
              </p>
              <p className="text-xs text-slate-400">SOL</p>
            </div>
          </div>

          {/* Win rate bar */}
          <div className="bg-white/70 rounded-xl p-3 border border-slate-100 mb-4">
            <div className="flex justify-between text-xs font-bold text-slate-500 mb-1.5">
              <span>Win Rate</span>
              <span style={{ color: typeColor }}>{entry.winRate.toFixed(0)}% ({total} battles)</span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden">
              <motion.div className="h-full rounded-full"
                style={{ background: `linear-gradient(90deg, ${typeColor}, #a855f7)` }}
                initial={{ width: 0 }}
                animate={{ width: `${entry.winRate}%` }}
                transition={{ duration: 0.7, ease: 'easeOut' }} />
            </div>
          </div>

          {/* Gym Badges */}
          <div className="bg-white/70 rounded-xl p-3 border border-purple-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-black text-slate-600">🏅 Gym Badges</span>
              <span className="text-xs font-bold text-purple-400">{earnedBadges}/8</span>
            </div>
            <div className="grid grid-cols-8 gap-1">
              {GYM_BADGES.map(badge => {
                const earned = entry.wins >= badge.wins;
                return (
                  <div key={badge.name} className="flex flex-col items-center" title={badge.name}>
                    <img src={badge.file} alt={badge.name} className="w-8 h-8 object-contain"
                      style={earned ? { filter: `drop-shadow(0 0 4px ${typeColor})` } : { filter: 'grayscale(100%) brightness(0.4)', opacity: 0.45 }} />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Joined */}
          <p className="text-center text-xs text-slate-400 mt-3">
            Trainer since {new Date(entry.joinedDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}

type SortMode = 'wins' | 'earnings';

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
      avatar: u.avatar,
      displayName: u.displayName,
      username: u.username,
      bio: u.bio,
      wins: u.wins,
      losses: u.losses,
      joinedDate: u.joinedDate,
      favoritePokemonId: u.favoritePokemonId,
      favoritePokemonName: u.favoritePokemonName,
      favoritePokemonTypes: u.favoritePokemonTypes,
      balance: u.balance,
      earnings: u.earnings ?? 0,
      total: u.wins + u.losses,
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
      style={{
        backgroundImage: 'url(/leaderboard-bg.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}>

      {/* Lighter overlay */}
      <div className="absolute inset-0 bg-black/35" />

      {/* Profile modal */}
      <AnimatePresence>
        {selected && <TrainerModal entry={selected} onClose={() => setSelected(null)} />}
      </AnimatePresence>

      <div className="relative z-10 flex flex-col h-full max-w-3xl mx-auto w-full px-4 pt-4 pb-4">

        {/* Header */}
        <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-4 mb-4 shrink-0">
          <button onClick={() => setScreen('draft-mode-intro')}
            className="flex items-center gap-2 bg-white/20 backdrop-blur border border-white/30 px-3 py-1.5 rounded-xl text-white text-sm font-bold shadow-sm hover:bg-white/30 transition-all">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-black flex items-center gap-2"
              style={{ background: 'linear-gradient(135deg, #d97706, #f59e0b, #fbbf24)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              <Trophy className="w-6 h-6 text-amber-400" style={{ WebkitTextFillColor: 'initial' }} />
              Top 25 Trainers
            </h1>
            <p className="text-xs text-white/70 mt-0.5">Click any trainer · {allUsers.length} total trainers</p>
          </div>
          {/* Sort tabs */}
          <div className="flex gap-1 bg-white/15 backdrop-blur rounded-xl p-1 border border-white/20">
            <button
              onClick={() => setSortMode('wins')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${sortMode === 'wins' ? 'bg-amber-400 text-slate-900 shadow' : 'text-white/70 hover:text-white'}`}
            >
              🏆 Most Wins
            </button>
            <button
              onClick={() => setSortMode('earnings')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${sortMode === 'earnings' ? 'bg-green-400 text-slate-900 shadow' : 'text-white/70 hover:text-white'}`}
            >
              💰 Most Earnings
            </button>
          </div>
        </motion.div>

        {/* Your rank strip — sits just above the table */}
        {myRank && (
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            className="flex items-center justify-end gap-2 mb-2 shrink-0">
            <div className="flex items-center gap-2 px-4 py-1.5 rounded-xl text-sm font-black"
              style={{ background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.3)', backdropFilter: 'blur(8px)' }}>
              <span className="text-white/60 font-bold text-xs">Your Rank</span>
              <span className="text-amber-300 text-base">#{myRank.rank}</span>
              <span className="text-white/30">/</span>
              <span className="text-white/80 text-xs">{myRank.total} trainers</span>
              {myRank.rank <= 25 && <span className="text-green-400 text-xs">👆 On the board!</span>}
            </div>
          </motion.div>
        )}

        {/* Table */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="flex-1 min-h-0 rounded-2xl overflow-hidden shadow-md border border-white/80 flex flex-col"
          style={{ background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(20px)', borderColor: 'rgba(255,255,255,0.35)' }}>

          <div className={`grid gap-2 px-4 py-2.5 border-b border-white/10 text-xs text-white/60 font-bold uppercase tracking-wider shrink-0 ${sortMode === 'earnings' ? 'grid-cols-[52px_1fr_100px_80px]' : 'grid-cols-[52px_1fr_80px_80px_80px]'}`}
            style={{ background: 'rgba(255,255,255,0.08)' }}>
            <span>Rank</span>
            <span>Trainer</span>
            {sortMode === 'earnings' ? (
              <>
                <span className="text-center text-green-300">💰 Earnings (SOL)</span>
                <span className="text-center">Win %</span>
              </>
            ) : (
              <>
                <span className="text-center">Wins</span>
                <span className="text-center">Losses</span>
                <span className="text-center">Win %</span>
              </>
            )}
          </div>

          {entries.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-20">
              <p className="text-5xl mb-4">🏆</p>
              <p className="text-xl font-bold text-slate-600 mb-2">No trainers have battled yet.</p>
              <p className="text-slate-400">Be the first legend!</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto divide-y divide-white/5">
              {entries.map((entry, i) => {
                const { medal, color, bg, border, leftBorder } = getRankMedal(entry.rank);
                const isTop3 = entry.rank <= 3;
                return (
                  <motion.button
                    key={entry.username}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(i * 0.02, 0.4) }}
                    onClick={() => setSelected(entry)}
                    className={`w-full grid gap-2 items-center px-4 py-2.5 hover:bg-white/10 active:bg-white/15 transition-colors text-left cursor-pointer ${sortMode === 'earnings' ? 'grid-cols-[52px_1fr_100px_80px]' : 'grid-cols-[52px_1fr_80px_80px_80px]'}`}
                    style={isTop3 ? { borderLeft: `3px solid ${leftBorder}` } : { borderLeft: '3px solid transparent' }}
                  >
                    <div className="flex items-center justify-center w-9 h-9 rounded-xl font-black text-sm border"
                      style={{ background: bg, borderColor: border, color }}>
                      {medal}
                    </div>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-white/30 border border-white/40 overflow-hidden flex-shrink-0 flex items-center justify-center text-base">
                        {entry.avatar?.startsWith('data:') || entry.avatar?.startsWith('/') ? (
                          <img src={entry.avatar} alt="" className="w-full h-full object-cover" />
                        ) : <span>{entry.avatar || '🧑'}</span>}
                      </div>
                      <div className="min-w-0">
                        <p className={`font-bold text-sm truncate ${isTop3 ? 'text-white' : 'text-slate-200'}`}>{entry.displayName}</p>
                        <p className="text-xs text-slate-400 truncate">@{entry.username}</p>
                      </div>
                    </div>
                    {sortMode === 'earnings' ? (
                      <>
                        <p className={`text-center font-black text-sm ${entry.earnings >= 0 ? 'text-green-300' : 'text-red-400'}`}>
                          {entry.earnings >= 0 ? '+' : ''}{entry.earnings.toFixed(3)} ◎
                        </p>
                        <p className={`text-center font-bold text-sm ${entry.winRate >= 60 ? 'text-green-300' : entry.winRate >= 40 ? 'text-white/70' : 'text-red-400'}`}>
                          {entry.winRate.toFixed(0)}%
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-center font-black text-green-400 text-sm">{entry.wins}</p>
                        <p className="text-center font-bold text-red-400 text-sm">{entry.losses}</p>
                        <p className={`text-center font-bold text-sm ${entry.winRate >= 60 ? 'text-green-300' : entry.winRate >= 40 ? 'text-white/70' : 'text-red-400'}`}>
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

        {!myRank && (
          <p className="text-center text-xs text-white/30 mt-2 shrink-0">Sign in to see your rank</p>
        )}
      </div>
    </div>
  );
}
