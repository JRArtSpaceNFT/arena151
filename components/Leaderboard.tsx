'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Trophy } from 'lucide-react';
import { useArenaStore } from '@/lib/store';
import { getAllUsers } from '@/lib/auth';

type LeaderboardEntry = {
  rank: number;
  avatar: string;
  displayName: string;
  username: string;
  wins: number;
  losses: number;
  winRate: number;
};

function getRankMedal(rank: number) {
  if (rank === 1) return { medal: '🥇', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/40' };
  if (rank === 2) return { medal: '🥈', color: 'text-slate-300', bg: 'bg-slate-400/10 border-slate-400/40' };
  if (rank === 3) return { medal: '🥉', color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/30' };
  return { medal: `#${rank}`, color: 'text-slate-500', bg: 'bg-slate-900/30 border-slate-800/40' };
}

export default function Leaderboard() {
  const { setScreen } = useArenaStore();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    const users = getAllUsers();
    const sorted = users
      .map(u => ({
        avatar: u.avatar,
        displayName: u.displayName,
        username: u.username,
        wins: u.wins,
        losses: u.losses,
        joinedDate: u.joinedDate,
        total: u.wins + u.losses,
        winRate: u.wins + u.losses > 0 ? (u.wins / (u.wins + u.losses)) * 100 : 0,
      }))
      .sort((a, b) => {
        if (b.wins !== a.wins) return b.wins - a.wins;
        if (b.winRate !== a.winRate) return b.winRate - a.winRate;
        return new Date(a.joinedDate).getTime() - new Date(b.joinedDate).getTime();
      })
      .slice(0, 100)
      .map((u, i) => ({ ...u, rank: i + 1 }));
    setEntries(sorted);
  }, []);

  return (
    <div className="min-h-screen p-6 pokeball-pattern relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-amber-500/8 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-purple-500/8 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-3xl mx-auto">
        {/* Header */}
        <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-4 mb-6">
          <button
            onClick={() => setScreen('draft-mode-intro')}
            className="flex items-center gap-2 glass-panel px-3 py-2 rounded-lg hover:border-blue-500/50 transition-all text-sm"
          >
            <ArrowLeft className="w-4 h-4" />Back
          </button>
          <div>
            <h1 className="text-3xl font-black arena-glow bg-gradient-to-r from-amber-400 to-yellow-300 bg-clip-text text-transparent flex items-center gap-2">
              <Trophy className="w-7 h-7 text-amber-400" />
              Top 100 Trainers
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">Ranked by wins · Updated in real time</p>
          </div>
        </motion.div>

        {/* Table */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-slate-900/50 backdrop-blur-xl border border-slate-800/50 rounded-2xl overflow-hidden"
        >
          {/* Column headers */}
          <div className="grid grid-cols-[56px_1fr_80px_80px_80px] gap-2 px-4 py-3 border-b border-slate-800/60 text-xs text-slate-500 font-bold uppercase tracking-wider">
            <span>Rank</span>
            <span>Trainer</span>
            <span className="text-center">Wins</span>
            <span className="text-center">Losses</span>
            <span className="text-center">Win %</span>
          </div>

          {entries.length === 0 ? (
            <div className="py-20 text-center">
              <p className="text-4xl mb-4">🏆</p>
              <p className="text-xl font-bold text-slate-300 mb-2">No trainers have battled yet.</p>
              <p className="text-slate-500">Be the first legend!</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800/40">
              {entries.map((entry, i) => {
                const { medal, color, bg } = getRankMedal(entry.rank);
                const isTop3 = entry.rank <= 3;
                return (
                  <motion.div
                    key={entry.username}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(i * 0.02, 0.4) }}
                    className={`grid grid-cols-[56px_1fr_80px_80px_80px] gap-2 items-center px-4 py-3 ${isTop3 ? `border-l-2 ${entry.rank === 1 ? 'border-yellow-500/60' : entry.rank === 2 ? 'border-slate-400/60' : 'border-orange-500/40'}` : ''} hover:bg-slate-800/20 transition-colors`}
                  >
                    {/* Rank */}
                    <div className={`flex items-center justify-center w-10 h-10 rounded-xl border font-black text-sm ${isTop3 ? bg : 'border-slate-800/40'} ${color}`}>
                      {medal}
                    </div>

                    {/* Trainer info */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 overflow-hidden flex-shrink-0 flex items-center justify-center text-lg">
                        {entry.avatar?.startsWith('data:') || entry.avatar?.startsWith('/') ? (
                          <img src={entry.avatar} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span>{entry.avatar || '🧑'}</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className={`font-bold text-sm truncate ${isTop3 ? 'text-white' : 'text-slate-200'}`}>{entry.displayName}</p>
                        <p className="text-xs text-slate-500 truncate">@{entry.username}</p>
                      </div>
                    </div>

                    {/* Stats */}
                    <p className="text-center font-black text-green-400">{entry.wins}</p>
                    <p className="text-center font-bold text-red-400/80 text-sm">{entry.losses}</p>
                    <p className={`text-center font-bold text-sm ${entry.winRate >= 60 ? 'text-green-400' : entry.winRate >= 40 ? 'text-slate-300' : 'text-red-400/70'}`}>
                      {entry.winRate.toFixed(0)}%
                    </p>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>

        <p className="text-center text-xs text-slate-600 mt-4">Showing top {Math.min(entries.length, 100)} of {entries.length} trainers</p>
      </div>
    </div>
  );
}
