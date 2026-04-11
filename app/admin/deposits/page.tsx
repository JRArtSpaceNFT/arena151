'use client';

import React, { useEffect, useState } from 'react';
import { Clock, CheckCircle, XCircle, AlertTriangle, ExternalLink, RefreshCw } from 'lucide-react';
import { CommandCard } from '@/components/admin/CommandCard';
import { StatCard } from '@/components/admin/StatCard';

interface Deposit {
  id: string;
  user_id: string;
  username: string;
  email: string;
  amount: number;
  status: string;
  transaction_signature: string;
  created_at: string;
  completed_at: string | null;
  webhook_attempts: number;
}

export default function AdminDeposits() {
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'pending' | 'completed' | 'failed'>('pending');
  const [stats, setStats] = useState({
    pending: 0,
    pendingAmount: 0,
    completedToday: 0,
    failed: 0,
    webhookFailures: 0,
  });

  useEffect(() => {
    fetchDeposits();
    fetchStats();
  }, [tab]);

  const fetchDeposits = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/deposits?status=${tab}`);
      if (res.ok) {
        const data = await res.json();
        setDeposits(data.deposits);
      }
    } catch (error) {
      console.error('Failed to fetch deposits:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/admin/deposits/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch deposit stats:', error);
    }
  };

  const handleRetry = async (id: string) => {
    if (!confirm('Retry processing this deposit?')) return;
    
    try {
      const res = await fetch(`/api/admin/deposits/${id}/retry`, {
        method: 'POST',
      });
      if (res.ok) {
        alert('Deposit retry initiated');
        fetchDeposits();
        fetchStats();
      }
    } catch (error) {
      console.error('Failed to retry deposit:', error);
      alert('Failed to retry deposit');
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent mb-2">
          Deposit Monitor
        </h1>
        <p className="text-gray-500">Track incoming deposits and webhook processing</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Pending Deposits"
          value={stats.pending}
          icon={Clock}
          severity={stats.pending > 5 ? 'warning' : 'default'}
        />
        <StatCard
          label="Pending Amount"
          value={`${stats.pendingAmount.toFixed(4)} SOL`}
          icon={Clock}
        />
        <StatCard
          label="Completed Today"
          value={stats.completedToday}
          icon={CheckCircle}
          severity="success"
        />
        <StatCard
          label="Webhook Failures"
          value={stats.webhookFailures}
          icon={AlertTriangle}
          severity={stats.webhookFailures > 0 ? 'danger' : 'default'}
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <TabButton active={tab === 'pending'} onClick={() => setTab('pending')}>
          Pending
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
            <p className="text-gray-400">Loading deposits...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">User</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-400">Amount</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Transaction</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Created</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-400">Webhook</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-400">Status</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {deposits.map((d) => (
                  <tr 
                    key={d.id}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div>
                        <p className="text-sm font-medium text-gray-200">{d.username || 'Unknown'}</p>
                        <p className="text-xs text-gray-500">{d.email}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="text-sm font-semibold text-emerald-400">
                        +{d.amount.toFixed(4)} SOL
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-xs font-mono text-gray-500">
                        {d.transaction_signature.slice(0, 8)}...{d.transaction_signature.slice(-6)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-400">
                      {new Date(d.created_at).toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex justify-center">
                        {d.webhook_attempts > 0 && (
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            d.webhook_attempts > 3
                              ? 'bg-red-500/20 text-red-400'
                              : 'bg-amber-500/20 text-amber-400'
                          }`}>
                            {d.webhook_attempts} attempts
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex justify-center">
                        <StatusBadge status={d.status} />
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-2">
                        <a
                          href={`https://solscan.io/tx/${d.transaction_signature}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 rounded-lg bg-white/5 hover:bg-blue-500/20 border border-white/10 hover:border-blue-500/30 transition-all text-gray-400 hover:text-blue-400"
                          title="View on Solscan"
                        >
                          <ExternalLink size={16} />
                        </a>
                        {d.status === 'failed' && (
                          <button
                            onClick={() => handleRetry(d.id)}
                            className="p-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-400 transition-all"
                            title="Retry Processing"
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

            {deposits.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500">No deposits found</p>
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
  };

  const { bg, text, label } = config[status as keyof typeof config] || config.pending;

  return (
    <span className={`px-2 py-1 rounded-full ${bg} ${text} text-xs`}>
      {label}
    </span>
  );
}
