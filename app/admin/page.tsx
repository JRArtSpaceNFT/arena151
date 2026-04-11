'use client';

import React, { useEffect, useState } from 'react';
import { 
  Users, 
  UserPlus, 
  Wallet, 
  Lock, 
  ArrowDownToLine, 
  ArrowUpFromLine,
  Swords,
  Play,
  Clock,
  AlertTriangle,
  TrendingUp,
  Activity
} from 'lucide-react';
import { StatCard } from '@/components/admin/StatCard';
import { AlertBanner } from '@/components/admin/AlertBanner';
import { CommandCard } from '@/components/admin/CommandCard';

interface DashboardStats {
  users: {
    total: number;
    today: number;
    thisWeek: number;
    activeToday: number;
    activeThisWeek: number;
    online: number;
  };
  financials: {
    totalBalance: number;
    totalLocked: number;
    pendingDeposits: number;
    pendingWithdrawals: number;
    withdrawalsToday: number;
  };
  matches: {
    totalToday: number;
    live: number;
    awaitingSettlement: number;
    failedSettlements: number;
  };
  risk: {
    flaggedUsers: number;
    manualReviewQueue: number;
    depositFailures: number;
    retryQueue: number;
  };
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/admin/stats/overview');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto mb-4" />
          <p className="text-gray-400">Loading command center...</p>
        </div>
      </div>
    );
  }

  const alerts = [
    ...(stats?.matches.failedSettlements ?? 0) > 0 
      ? [{
          id: 'failed-settlements',
          severity: 'critical' as const,
          message: `${stats?.matches.failedSettlements} failed settlements require attention`
        }]
      : [],
    ...(stats?.risk.manualReviewQueue ?? 0) > 5
      ? [{
          id: 'manual-review',
          severity: 'high' as const,
          message: `${stats?.risk.manualReviewQueue} items in manual review queue`
        }]
      : [],
  ];

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent mb-2">
          Command Center
        </h1>
        <p className="text-gray-500">Monitor and control Arena 151 operations</p>
      </div>

      {/* Critical Alerts */}
      <AlertBanner alerts={alerts} />

      {/* Overview Stats */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-200 mb-4">Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Users"
            value={stats?.users.total ?? 0}
            icon={Users}
            trend={stats?.users.today ? {
              value: `+${stats.users.today} today`,
              positive: true
            } : undefined}
          />
          <StatCard
            label="New Signups (7d)"
            value={stats?.users.thisWeek ?? 0}
            icon={UserPlus}
            severity="success"
          />
          <StatCard
            label="Active Today"
            value={stats?.users.activeToday ?? 0}
            icon={Activity}
            severity="success"
          />
          <StatCard
            label="Online Now"
            value={stats?.users.online ?? 0}
            icon={TrendingUp}
            severity="default"
          />
        </div>
      </div>

      {/* Financial Stats */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-200 mb-4">Financials</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Balance"
            value={`${(stats?.financials.totalBalance ?? 0).toFixed(4)} SOL`}
            icon={Wallet}
            severity="success"
          />
          <StatCard
            label="Locked in Matches"
            value={`${(stats?.financials.totalLocked ?? 0).toFixed(4)} SOL`}
            icon={Lock}
            severity="warning"
          />
          <StatCard
            label="Pending Deposits"
            value={`${(stats?.financials.pendingDeposits ?? 0).toFixed(4)} SOL`}
            icon={ArrowDownToLine}
          />
          <StatCard
            label="Pending Withdrawals"
            value={`${(stats?.financials.pendingWithdrawals ?? 0).toFixed(4)} SOL`}
            icon={ArrowUpFromLine}
            severity={(stats?.financials.pendingWithdrawals ?? 0) > 1 ? 'warning' : 'default'}
          />
        </div>
      </div>

      {/* Match Stats */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-200 mb-4">Matches</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Matches Today"
            value={stats?.matches.totalToday ?? 0}
            icon={Swords}
          />
          <StatCard
            label="Live Now"
            value={stats?.matches.live ?? 0}
            icon={Play}
            severity="success"
          />
          <StatCard
            label="Awaiting Settlement"
            value={stats?.matches.awaitingSettlement ?? 0}
            icon={Clock}
            severity={(stats?.matches.awaitingSettlement ?? 0) > 10 ? 'warning' : 'default'}
          />
          <StatCard
            label="Failed Settlements"
            value={stats?.matches.failedSettlements ?? 0}
            icon={AlertTriangle}
            severity={(stats?.matches.failedSettlements ?? 0) > 0 ? 'danger' : 'default'}
          />
        </div>
      </div>

      {/* Risk Overview */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-200 mb-4">Risk & Alerts</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Flagged Users"
            value={stats?.risk.flaggedUsers ?? 0}
            icon={AlertTriangle}
            severity={(stats?.risk.flaggedUsers ?? 0) > 0 ? 'warning' : 'default'}
          />
          <StatCard
            label="Manual Review Queue"
            value={stats?.risk.manualReviewQueue ?? 0}
            icon={Clock}
            severity={(stats?.risk.manualReviewQueue ?? 0) > 5 ? 'warning' : 'default'}
          />
          <StatCard
            label="Deposit Failures"
            value={stats?.risk.depositFailures ?? 0}
            icon={ArrowDownToLine}
            severity={(stats?.risk.depositFailures ?? 0) > 0 ? 'danger' : 'default'}
          />
          <StatCard
            label="Retry Queue"
            value={stats?.risk.retryQueue ?? 0}
            icon={Activity}
          />
        </div>
      </div>

      {/* Recent Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CommandCard title="Recent Activity">
          <div className="space-y-3">
            <ActivityItem 
              type="signup"
              description="New user registration"
              user="user_abc123"
              time="2 minutes ago"
            />
            <ActivityItem 
              type="deposit"
              description="Deposit processed"
              user="user_xyz789"
              amount="0.5 SOL"
              time="5 minutes ago"
            />
            <ActivityItem 
              type="match"
              description="Match started"
              user="user_def456"
              time="8 minutes ago"
            />
          </div>
        </CommandCard>

        <CommandCard title="Quick Actions">
          <div className="grid grid-cols-2 gap-3">
            <QuickActionButton href="/admin/users" label="View Users" />
            <QuickActionButton href="/admin/withdrawals" label="Withdrawals" />
            <QuickActionButton href="/admin/matches" label="Matches" />
            <QuickActionButton href="/admin/reconciliation" label="Reconcile" />
          </div>
        </CommandCard>
      </div>
    </div>
  );
}

function ActivityItem({ 
  type, 
  description, 
  user, 
  amount, 
  time 
}: { 
  type: string; 
  description: string; 
  user: string; 
  amount?: string; 
  time: string;
}) {
  const typeColors = {
    signup: 'bg-green-500/10 text-green-400',
    deposit: 'bg-blue-500/10 text-blue-400',
    withdrawal: 'bg-purple-500/10 text-purple-400',
    match: 'bg-amber-500/10 text-amber-400',
  };

  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
      <div className="flex items-center gap-3">
        <div className={`w-2 h-2 rounded-full ${typeColors[type as keyof typeof typeColors]}`} />
        <div>
          <p className="text-sm text-gray-200">{description}</p>
          <p className="text-xs text-gray-500">{user} {amount && `• ${amount}`}</p>
        </div>
      </div>
      <span className="text-xs text-gray-500">{time}</span>
    </div>
  );
}

function QuickActionButton({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="flex items-center justify-center px-4 py-3 rounded-lg bg-white/5 hover:bg-indigo-500/20 border border-white/10 hover:border-indigo-500/30 transition-all text-sm font-medium text-gray-300 hover:text-gray-100"
    >
      {label}
    </a>
  );
}
