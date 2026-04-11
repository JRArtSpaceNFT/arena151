'use client';

import React, { useEffect, useState } from 'react';
import { Scale, CheckCircle, AlertTriangle, TrendingUp, Play } from 'lucide-react';
import { CommandCard } from '@/components/admin/CommandCard';
import { StatCard } from '@/components/admin/StatCard';

interface ReconciliationStatus {
  status: 'healthy' | 'warning' | 'critical';
  totalBalance: number;
  totalLocked: number;
  pendingWithdrawals: number;
  pendingDeposits: number;
  platformFees: number;
  mismatchCount: number;
  driftAmount: number;
  lastRun: string | null;
}

interface Mismatch {
  user_id: string;
  username: string;
  expected_balance: number;
  actual_balance: number;
  difference: number;
}

export default function AdminReconciliation() {
  const [status, setStatus] = useState<ReconciliationStatus | null>(null);
  const [mismatches, setMismatches] = useState<Mismatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/reconciliation/status');
      if (res.ok) {
        const data = await res.json();
        setStatus(data.status);
        setMismatches(data.mismatches || []);
      }
    } catch (error) {
      console.error('Failed to fetch reconciliation status:', error);
    } finally {
      setLoading(false);
    }
  };

  const runReconciliation = async () => {
    if (!confirm('Run reconciliation? This will verify all balances and locked funds.')) return;

    setRunning(true);
    try {
      const res = await fetch('/api/admin/reconciliation/run', {
        method: 'POST',
      });
      if (res.ok) {
        alert('Reconciliation complete');
        fetchStatus();
      }
    } catch (error) {
      console.error('Failed to run reconciliation:', error);
      alert('Reconciliation failed');
    } finally {
      setRunning(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto mb-4" />
          <p className="text-gray-400">Loading reconciliation status...</p>
        </div>
      </div>
    );
  }

  const healthColor = status?.status === 'healthy' 
    ? 'emerald' 
    : status?.status === 'warning' 
    ? 'amber' 
    : 'red';

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent mb-2">
          Reconciliation
        </h1>
        <p className="text-gray-500">Financial health and balance verification</p>
      </div>

      {/* Health Status */}
      <div className="mb-6">
        <CommandCard>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`p-4 rounded-2xl bg-${healthColor}-500/20`}>
                {status?.status === 'healthy' ? (
                  <CheckCircle className={`text-${healthColor}-400`} size={32} />
                ) : (
                  <AlertTriangle className={`text-${healthColor}-400`} size={32} />
                )}
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-100 capitalize">
                  {status?.status || 'Unknown'}
                </h2>
                <p className="text-sm text-gray-500">
                  Last run: {status?.lastRun 
                    ? new Date(status.lastRun).toLocaleString()
                    : 'Never'
                  }
                </p>
              </div>
            </div>
            <button
              onClick={runReconciliation}
              disabled={running}
              className="flex items-center gap-2 px-6 py-3 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 text-indigo-400 font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play size={18} />
              {running ? 'Running...' : 'Run Reconciliation'}
            </button>
          </div>
        </CommandCard>
      </div>

      {/* Financial Overview */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-200 mb-4">Financial Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard
            label="Total User Balance"
            value={`${(status?.totalBalance || 0).toFixed(4)} SOL`}
            icon={TrendingUp}
            severity="success"
          />
          <StatCard
            label="Locked in Matches"
            value={`${(status?.totalLocked || 0).toFixed(4)} SOL`}
            icon={Scale}
            severity="warning"
          />
          <StatCard
            label="Platform Fees"
            value={`${(status?.platformFees || 0).toFixed(4)} SOL`}
            icon={TrendingUp}
            severity="success"
          />
          <StatCard
            label="Pending Withdrawals"
            value={`${(status?.pendingWithdrawals || 0).toFixed(4)} SOL`}
            icon={AlertTriangle}
            severity={(status?.pendingWithdrawals || 0) > 1 ? 'warning' : 'default'}
          />
          <StatCard
            label="Pending Deposits"
            value={`${(status?.pendingDeposits || 0).toFixed(4)} SOL`}
            icon={TrendingUp}
          />
          <StatCard
            label="Total Drift"
            value={`${Math.abs(status?.driftAmount || 0).toFixed(4)} SOL`}
            icon={AlertTriangle}
            severity={Math.abs(status?.driftAmount || 0) > 0.01 ? 'danger' : 'success'}
          />
        </div>
      </div>

      {/* Mismatches */}
      {mismatches.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-200 mb-4">
            Balance Mismatches ({mismatches.length})
          </h2>
          <CommandCard>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">User</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-400">Expected</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-400">Actual</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-400">Difference</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-400">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {mismatches.map((m) => (
                    <tr 
                      key={m.user_id}
                      className="border-b border-white/5 hover:bg-white/5 transition-colors"
                    >
                      <td className="py-3 px-4 text-sm text-gray-200">{m.username}</td>
                      <td className="py-3 px-4 text-sm text-right text-gray-300">
                        {m.expected_balance.toFixed(4)} SOL
                      </td>
                      <td className="py-3 px-4 text-sm text-right text-gray-300">
                        {m.actual_balance.toFixed(4)} SOL
                      </td>
                      <td className={`py-3 px-4 text-sm text-right font-semibold ${
                        m.difference > 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}>
                        {m.difference > 0 ? '+' : ''}{m.difference.toFixed(4)} SOL
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-2">
                          <button className="px-3 py-1 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 text-indigo-400 text-xs font-medium transition-all">
                            Investigate
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CommandCard>
        </div>
      )}

      {/* Quick Actions */}
      <div>
        <h2 className="text-xl font-semibold text-gray-200 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <QuickAction
            title="Export Report"
            description="Download full reconciliation report"
            buttonLabel="Export CSV"
            onClick={() => alert('Export functionality coming soon')}
          />
          <QuickAction
            title="View History"
            description="See past reconciliation runs"
            buttonLabel="View History"
            onClick={() => alert('History view coming soon')}
          />
          <QuickAction
            title="Stuck Funds"
            description="Identify funds in limbo"
            buttonLabel="View Report"
            onClick={() => alert('Stuck funds report coming soon')}
          />
        </div>
      </div>
    </div>
  );
}

function QuickAction({ 
  title, 
  description, 
  buttonLabel, 
  onClick 
}: { 
  title: string; 
  description: string; 
  buttonLabel: string;
  onClick: () => void;
}) {
  return (
    <CommandCard>
      <h3 className="text-lg font-semibold text-gray-200 mb-2">{title}</h3>
      <p className="text-sm text-gray-500 mb-4">{description}</p>
      <button
        onClick={onClick}
        className="w-full px-4 py-2 rounded-lg bg-white/5 hover:bg-indigo-500/20 border border-white/10 hover:border-indigo-500/30 text-sm font-medium text-gray-300 hover:text-gray-100 transition-all"
      >
        {buttonLabel}
      </button>
    </CommandCard>
  );
}
