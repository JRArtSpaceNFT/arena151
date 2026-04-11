'use client';

import React, { useEffect, useState } from 'react';
import { Swords, Play, Clock, CheckCircle, XCircle, RefreshCw, Eye } from 'lucide-react';
import { CommandCard } from '@/components/admin/CommandCard';
import { StatCard } from '@/components/admin/StatCard';

interface Match {
  id: string;
  player_a_username: string;
  player_b_username: string;
  entry_fee: number;
  platform_fee: number;
  status: string;
  funds_locked: boolean;
  winner_id: string | null;
  settlement_status: string | null;
  retry_count: number;
  created_at: string;
  battle_started_at: string | null;
  settled_at: string | null;
  error_message: string | null;
}

export default function AdminMatches() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'live' | 'settlement_pending' | 'completed' | 'failed'>('live');
  const [stats, setStats] = useState({
    live: 0,
    forming: 0,
    awaitingSettlement: 0,
    failedSettlements: 0,
    totalToday: 0,
    largestWager: 0,
  });

  useEffect(() => {
    fetchMatches();
    fetchStats();
  }, [tab]);

  const fetchMatches = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/matches?status=${tab}`);
      if (res.ok) {
        const data = await res.json();
        setMatches(data.matches);
      }
    } catch (error) {
      console.error('Failed to fetch matches:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/admin/matches/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch match stats:', error);
    }
  };

  const handleRetrySettlement = async (id: string) => {
    if (!confirm('Retry settlement for this match?')) return;
    
    try {
      const res = await fetch(`/api/admin/matches/${id}/retry-settlement`, {
        method: 'POST',
      });
      if (res.ok) {
        alert('Settlement retry initiated');
        fetchMatches();
        fetchStats();
      }
    } catch (error) {
      console.error('Failed to retry settlement:', error);
      alert('Failed to retry settlement');
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent mb-2">
          Match Control Center
        </h1>
        <p className="text-gray-500">Monitor battles and settlement processing</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Live Matches"
          value={stats.live}
          icon={Play}
          severity="success"
        />
        <StatCard
          label="Forming"
          value={stats.forming}
          icon={Clock}
        />
        <StatCard
          label="Awaiting Settlement"
          value={stats.awaitingSettlement}
          icon={Clock}
          severity={stats.awaitingSettlement > 10 ? 'warning' : 'default'}
        />
        <StatCard
          label="Failed Settlements"
          value={stats.failedSettlements}
          icon={XCircle}
          severity={stats.failedSettlements > 0 ? 'danger' : 'default'}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <StatCard
          label="Matches Today"
          value={stats.totalToday}
          icon={Swords}
        />
        <StatCard
          label="Largest Wager Today"
          value={`${stats.largestWager.toFixed(4)} SOL`}
          icon={Swords}
          severity="success"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <TabButton active={tab === 'live'} onClick={() => setTab('live')}>
          Live
        </TabButton>
        <TabButton active={tab === 'settlement_pending'} onClick={() => setTab('settlement_pending')}>
          Settlement Pending
        </TabButton>
        <TabButton active={tab === 'completed'} onClick={() => setTab('completed')}>
          Completed
        </TabButton>
        <TabButton active={tab === 'failed'} onClick={() => setTab('failed')}>
          Failed
        </TabButton>
      </div>

      {/* Table */}
      <CommandCard>
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mx-auto mb-4" />
            <p className="text-gray-400">Loading matches...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Match</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-400">Entry Fee</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Created</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-400">Funds</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-400">Status</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Winner</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {matches.map((m) => (
                  <tr 
                    key={m.id}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div>
                        <p className="text-sm font-medium text-gray-200">
                          {m.player_a_username} vs {m.player_b_username}
                        </p>
                        <p className="text-xs text-gray-500 font-mono">
                          {m.id.slice(0, 8)}...
                        </p>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="text-sm font-semibold text-purple-400">
                        {m.entry_fee.toFixed(4)} SOL
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-400">
                      {new Date(m.created_at).toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex justify-center">
                        {m.funds_locked ? (
                          <span className="px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs">
                            Locked
                          </span>
                        ) : (
                          <span className="px-2 py-1 rounded-full bg-red-500/20 text-red-400 text-xs">
                            Not Locked
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-col items-center gap-1">
                        <StatusBadge status={m.status} />
                        {m.settlement_status && (
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            m.settlement_status === 'completed'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : m.settlement_status === 'failed'
                              ? 'bg-red-500/20 text-red-400'
                              : 'bg-amber-500/20 text-amber-400'
                          }`}>
                            {m.settlement_status}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-300">
                      {m.winner_id 
                        ? (m.winner_id === 'player_a' ? m.player_a_username : m.player_b_username)
                        : 'TBD'
                      }
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          className="p-2 rounded-lg bg-white/5 hover:bg-blue-500/20 border border-white/10 hover:border-blue-500/30 transition-all text-gray-400 hover:text-blue-400"
                          title="View Details"
                        >
                          <Eye size={16} />
                        </button>
                        {m.settlement_status === 'failed' && (
                          <button
                            onClick={() => handleRetrySettlement(m.id)}
                            className="p-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-400 transition-all"
                            title="Retry Settlement"
                          >
                            <RefreshCw size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {matches.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500">No matches found</p>
              </div>
            )}
          </div>
        )}
      </CommandCard>

      {/* Error Messages */}
      {matches.some(m => m.error_message) && (
        <div className="mt-6">
          <CommandCard title="Settlement Errors">
            <div className="space-y-3">
              {matches.filter(m => m.error_message).map((m) => (
                <div 
                  key={m.id}
                  className="p-3 rounded-lg bg-red-500/10 border border-red-500/30"
                >
                  <p className="text-sm font-medium text-gray-200 mb-1">
                    Match: {m.player_a_username} vs {m.player_b_username}
                  </p>
                  <p className="text-xs text-red-400">{m.error_message}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Retry count: {m.retry_count}
                  </p>
                </div>
              ))}
            </div>
          </CommandCard>
        </div>
      )}
    </div>
  );
}

function TabButton({ 
  active, 
  onClick, 
  children 
}: { 
  active: boolean; 
  onClick: () => void; 
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
        active
          ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
          : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
      }`}
    >
      {children}
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config = {
    forming: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'Forming' },
    ready: { bg: 'bg-amber-500/20', text: 'text-amber-400', label: 'Ready' },
    battling: { bg: 'bg-purple-500/20', text: 'text-purple-400', label: 'Battling' },
    settlement_pending: { bg: 'bg-amber-500/20', text: 'text-amber-400', label: 'Settling' },
    completed: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: 'Completed' },
    settlement_failed: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Failed' },
  };

  const { bg, text, label } = config[status as keyof typeof config] || { 
    bg: 'bg-gray-500/20', 
    text: 'text-gray-400', 
    label: status 
  };

  return (
    <span className={`px-2 py-1 rounded-full ${bg} ${text} text-xs`}>
      {label}
    </span>
  );
}
