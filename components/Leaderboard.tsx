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
  if (rank === 1) return { medal: '🥇', color: '#d97706', bg: 'rgba(251,191,36,0.15)', border: 'rgba(251,191,36,0.5)', leftBorder: '#f59e0b' };
  if (rank === 2) return { medal: '🥈', color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.4)', leftBorder: '#94a3b8' };
  if (rank === 3) return { medal: '🥉', color: '#f97316', bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.35)', leftBorder: '#f97316' };
  return { medal: `#${rank}`, color: '#94a3b8', bg: 'transparent', border: 'transparent', leftBorder: 'transparent' };
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
    <div className="h-screen overflow-hidden flex flex-col"
      style={{ background: 'linear-gradient(135deg, #dbeafe 0%, #ede9fe 40%, #fce7f3 70%, #fef3c7 100%)' }}>

      {/* Soft ambient blobs */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full blur-3xl pointer-events-none opacity-30"
        style={{ background: 'radial-gradient(circle, #fde68a, transparent)' }} />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full blur-3xl pointer-events-none opacity-20"
        style={{ background: 'radial-gradient(circle, #c4b5fd, transparent)' }} />

      <div className="relative z-10 flex flex-col h-full max-w-3xl mx-auto w-full px-4 pt-4 pb-4">

        {/* Header */}
        <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-4 mb-4 shrink-0">
          <button onClick={() => setScreen('draft-mode-intro')}
            className="flex items-center gap-2 bg-white/60 backdrop-blur border border-white/80 px-3 py-1.5 rounded-xl text-slate-600 text-sm font-bold shadow-sm hover:bg-white transition-all">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <div>
            <h1 className="text-2xl font-black flex items-center gap-2"
              style={{ background: 'linear-gradient(135deg, #d97706, #f59e0b, #fbbf24)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              <Trophy className="w-6 h-6 text-amber-400" style={{ WebkitTextFillColor: 'initial' }} />
              Top 100 Trainers
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">Ranked by wins · Updated in real time</p>
          </div>
        </motion.div>

        {/* Table card */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="flex-1 min-h-0 rounded-2xl overflow-hidden shadow-md border border-white/80 flex flex-col"
          style={{ background: 'rgba(255,255,255,0.65)', backdropFilter: 'blur(16px)' }}>

          {/* Column headers */}
          <div className="grid grid-cols-[52px_1fr_72px_72px_72px] gap-2 px-4 py-2.5 border-b border-slate-100 text-xs text-slate-400 font-bold uppercase tracking-wider shrink-0"
            style={{ background: 'rgba(255,255,255,0.8)' }}>
            <span>Rank</span>
            <span>Trainer</span>
            <span className="text-center">Wins</span>
            <span className="text-center">Losses</span>
            <span className="text-center">Win %</span>
          </div>

          {entries.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-20">
              <p className="text-5xl mb-4">🏆</p>
              <p className="text-xl font-bold text-slate-600 mb-2">No trainers have battled yet.</p>
              <p className="text-slate-400">Be the first legend!</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100/80">
              {entries.map((entry, i) => {
                const { medal, color, bg, border, leftBorder } = getRankMedal(entry.rank);
                const isTop3 = entry.rank <= 3;
                return (
                  <motion.div
                    key={entry.username}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(i * 0.02, 0.4) }}
                    className="grid grid-cols-[52px_1fr_72px_72px_72px] gap-2 items-center px-4 py-2.5 hover:bg-white/60 transition-colors"
                    style={isTop3 ? { borderLeft: `3px solid ${leftBorder}` } : { borderLeft: '3px solid transparent' }}
                  >
                    {/* Rank */}
                    <div className="flex items-center justify-center w-9 h-9 rounded-xl font-black text-sm border"
                      style={{ background: bg, borderColor: border, color }}>
                      {medal}
                    </div>

                    {/* Trainer */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden flex-shrink-0 flex items-center justify-center text-base">
                        {entry.avatar?.startsWith('data:') || entry.avatar?.startsWith('/') ? (
                          <img src={entry.avatar} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span>{entry.avatar || '🧑'}</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className={`font-bold text-sm truncate ${isTop3 ? 'text-slate-800' : 'text-slate-700'}`}>{entry.displayName}</p>
                        <p className="text-xs text-slate-400 truncate">@{entry.username}</p>
                      </div>
                    </div>

                    {/* Stats */}
                    <p className="text-center font-black text-green-500 text-sm">{entry.wins}</p>
                    <p className="text-center font-bold text-red-400 text-sm">{entry.losses}</p>
                    <p className={`text-center font-bold text-sm ${entry.winRate >= 60 ? 'text-green-500' : entry.winRate >= 40 ? 'text-slate-500' : 'text-red-400'}`}>
                      {entry.winRate.toFixed(0)}%
                    </p>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>

        <p className="text-center text-xs text-slate-400 mt-2 shrink-0">
          Showing top {Math.min(entries.length, 100)} of {entries.length} trainers
        </p>
      </div>
    </div>
  );
}
