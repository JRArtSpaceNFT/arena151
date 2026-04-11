'use client';

import React, { useEffect, useState } from 'react';
import { Clock, CheckCircle, XCircle, AlertTriangle, ExternalLink } from 'lucide-react';
import { CommandCard } from '@/components/admin/CommandCard';
import { StatCard } from '@/components/admin/StatCard';

interface Withdrawal {
  id: string;
  user_id: string;
  username: string;
  email: string;
  amount: number;
  status: string;
  destination_address: string;
  transaction_signature: string | null;
  risk_score: number | null;
  manual_review: boolean;
  held: boolean;
  created_at: string;
  completed_at: string | null;
  retry_count: number;
}

export default function AdminWithdrawals() {
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'pending' | 'completed' | 'failed' | 'manual_review'>('pending');
  const [stats, setStats] = useState({
    pending: 0,
    pendingAmount: 0,
    completed: 0,
    failed: 0,
    manualReview: 0,
  });

  useEffect(() => {
    fetchWithdrawals();
    fetchStats();
  }, [tab]);

  const fetchWithdrawals = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/withdrawals?status=${tab}`);
      if (res.ok) {
        const data = await res.json();
        setWithdrawals(data.withdrawals);
      }
    } catch (error) {
      console.error('Failed to fetch withdrawals:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/admin/withdrawals/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch withdrawal stats:', error);
    }
  };

  const handleApprove = async (id: string) => {
    if (!confirm('Approve this withdrawal? This will process the transaction.')) return;
    
    try {
      const res = await fetch(`/api/admin/withdrawals/${id}/approve`, {
        method: 'POST',
      });
      if (res.ok) {
        alert('Withdrawal approved and processing');
        fetchWithdrawals();
        fetchStats();
      }
    } catch (error) {
      console.error('Failed to approve withdrawal:', error);
      alert('Failed to approve withdrawal');
    }
  };

  const handleReject = async (id: string) => {
    const reason = prompt('Reason for rejection:');
    if (!reason) return;

    try {
      const res = await fetch(`/api/admin/withdrawals/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      if (res.ok) {
        alert('Withdrawal rejected');
        fetchWithdrawals();
        fetchStats();
      }
    } catch (error) {
      console.error('Failed to reject withdrawal:', error);
      alert('Failed to reject withdrawal');
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent mb-2">
          Withdrawal Monitor
        </h1>
        <p className="text-gray-500">Track and approve user withdrawals</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Pending Withdrawals"
          value={stats.pending}
          icon={Clock}
          severity={stats.pending > 5 ? 'warning' : 'default'}
        />
        <StatCard
          label="Pending Amount"
          value={`${stats.pendingAmount.toFixed(4)} SOL`}
          icon={Clock}
          severity={stats.pendingAmount > 10 ? 'warning' : 'default'}
        />
        <StatCard
          label="Manual Review"
          value={stats.manualReview}
          icon={AlertTriangle}
          severity={stats.manualReview > 0 ? 'warning' : 'default'}
        />
        <StatCard
          label="Failed (24h)"
          value={stats.failed}
          icon={XCircle}
          severity={stats.failed > 0 ? 'danger' : 'default'}
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <TabButton active={tab === 'pending'} onClick={() => setTab('pending')}>
          Pending
        </TabButton>
        <TabButton active={tab === 'manual_review'} onClick={() => setTab('manual_review')}>
          Manual Review
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
            <p className="text-gray-400">Loading withdrawals...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">User</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-400">Amount</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Destination</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Created</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-400">Risk</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-400">Status</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {withdrawals.map((w) => (
                  <tr 
                    key={w.id}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div>
                        <p className="text-sm font-medium text-gray-200">{w.username || 'Unknown'}</p>
                        <p className="text-xs text-gray-500">{w.email}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="text-sm font-semibold text-purple-400">
                        {w.amount.toFixed(4)} SOL
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-xs font-mono text-gray-500">
                        {w.destination_address.slice(0, 6)}...{w.destination_address.slice(-4)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-400">
                      {new Date(w.created_at).toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex justify-center">
                        {w.risk_score !== null && (
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            w.risk_score > 0.7 
                              ? 'bg-red-500/20 text-red-400'
                              : w.risk_score > 0.4
                              ? 'bg-amber-500/20 text-amber-400'
                              : 'bg-emerald-500/20 text-emerald-400'
                          }`}>
                            {(w.risk_score * 100).toFixed(0)}%
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-2">
                        {w.manual_review && (
                          <span className="px-2 py-1 rounded-full bg-amber-500/20 text-amber-400 text-xs">
                            Review
                          </span>
                        )}
                        {w.held && (
                          <span className="px-2 py-1 rounded-full bg-red-500/20 text-red-400 text-xs">
                            Held
                          </span>
                        )}
                        <StatusBadge status={w.status} />
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-2">
                        {w.transaction_signature && (
                          <a
                            href={`https://solscan.io/tx/${w.transaction_signature}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded-lg bg-white/5 hover:bg-blue-500/20 border border-white/10 hover:border-blue-500/30 transition-all text-gray-400 hover:text-blue-400"
                            title="View on Solscan"
                          >
                            <ExternalLink size={16} />
                          </a>
                        )}
                        {(w.status === 'pending' || w.manual_review) && (
                          <>
                            <button
                              onClick={() => handleApprove(w.id)}
                              className="p-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-400 transition-all"
                              title="Approve"
                            >
                              <CheckCircle size={16} />
                            </button>
                            <button
                              onClick={() => handleReject(w.id)}
                              className="p-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 transition-all"
                              title="Reject"
                            >
                              <XCircle size={16} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {withdrawals.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500">No withdrawals found</p>
              </div>
            )}
          </div>
        )}
      </CommandCard>
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
    pending: { bg: 'bg-amber-500/20', text: 'text-amber-400', label: 'Pending' },
    processing: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'Processing' },
    completed: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: 'Completed' },
    failed: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Failed' },
    rejected: { bg: 'bg-gray-500/20', text: 'text-gray-400', label: 'Rejected' },
  };

  const { bg, text, label } = config[status as keyof typeof config] || config.pending;

  return (
    <span className={`px-2 py-1 rounded-full ${bg} ${text} text-xs`}>
      {label}
    </span>
  );
}
