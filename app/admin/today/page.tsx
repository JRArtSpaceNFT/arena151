'use client';

import React, { useEffect, useState } from 'react';
import { Calendar, Users, DollarSign, AlertTriangle, TrendingUp, Star } from 'lucide-react';
import { CommandCard } from '@/components/admin/CommandCard';
import { StatCard } from '@/components/admin/StatCard';

interface DailyDigest {
  newSignups: number;
  activeUsers: number;
  depositsTotal: number;
  withdrawalsTotal: number;
  matchesPlayed: number;
  revenue: number;
  actionRequired: ActionItem[];
  whales: WhaleActivity[];
  churnRisk: ChurnRiskUser[];
}

interface ActionItem {
  id: string;
  type: string;
  priority: 'urgent' | 'high' | 'normal';
  description: string;
  link: string;
}

interface WhaleActivity {
  user_id: string;
  username: string;
  totalVolume: number;
  matchCount: number;
  netChange: number;
}

interface ChurnRiskUser {
  user_id: string;
  username: string;
  lastSeen: string;
  balance: number;
  matchCount: number;
  riskScore: number;
}

export default function AdminToday() {
  const [digest, setDigest] = useState<DailyDigest | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDigest();
  }, []);

  const fetchDigest = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/today/digest');
      if (res.ok) {
        const data = await res.json();
        setDigest(data);
      }
    } catch (error) {
      console.error('Failed to fetch daily digest:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto mb-4" />
          <p className="text-gray-400">Loading today's digest...</p>
        </div>
      </div>
    );
  }

  const today = new Date().toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent mb-2">
          Today's Overview
        </h1>
        <p className="text-gray-500">{today}</p>
      </div>

      {/* Today's Stats */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-200 mb-4">Today's Activity</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard
            label="New Signups"
            value={digest?.newSignups || 0}
            icon={Users}
            severity="success"
            trend={digest?.newSignups ? {
              value: `+${digest.newSignups} today`,
              positive: true
            } : undefined}
          />
          <StatCard
            label="Active Users"
            value={digest?.activeUsers || 0}
            icon={TrendingUp}
            severity="success"
          />
          <StatCard
            label="Matches Played"
            value={digest?.matchesPlayed || 0}
            icon={Calendar}
          />
          <StatCard
            label="Total Deposits"
            value={`${(digest?.depositsTotal || 0).toFixed(4)} SOL`}
            icon={DollarSign}
            severity="success"
          />
          <StatCard
            label="Total Withdrawals"
            value={`${(digest?.withdrawalsTotal || 0).toFixed(4)} SOL`}
            icon={DollarSign}
          />
          <StatCard
            label="Platform Revenue"
            value={`${(digest?.revenue || 0).toFixed(4)} SOL`}
            icon={Star}
            severity="success"
          />
        </div>
      </div>

      {/* Action Required */}
      {digest?.actionRequired && digest.actionRequired.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-200 mb-4">Needs Your Attention</h2>
          <CommandCard>
            <div className="space-y-3">
              {digest.actionRequired.map((item) => (
                <ActionItemCard key={item.id} item={item} />
              ))}
            </div>
          </CommandCard>
        </div>
      )}

      {/* Whale Activity */}
      {digest?.whales && digest.whales.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-200 mb-4">Whale Activity</h2>
          <CommandCard>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">User</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-400">Volume</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-400">Matches</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-400">Net Change</th>
                  </tr>
                </thead>
                <tbody>
                  {digest.whales.map((whale) => (
                    <tr 
                      key={whale.user_id}
                      className="border-b border-white/5 hover:bg-white/5 transition-colors"
                    >
                      <td className="py-3 px-4 text-sm text-gray-200 font-medium">
                        {whale.username}
                      </td>
                      <td className="py-3 px-4 text-sm text-right text-purple-400 font-semibold">
                        {whale.totalVolume.toFixed(4)} SOL
                      </td>
                      <td className="py-3 px-4 text-sm text-right text-gray-300">
                        {whale.matchCount}
                      </td>
                      <td className={`py-3 px-4 text-sm text-right font-semibold ${
                        whale.netChange > 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}>
                        {whale.netChange > 0 ? '+' : ''}{whale.netChange.toFixed(4)} SOL
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CommandCard>
        </div>
      )}

      {/* Churn Risk */}
      {digest?.churnRisk && digest.churnRisk.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-200 mb-4">Churn Risk</h2>
          <CommandCard>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">User</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Last Seen</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-400">Balance</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-400">Matches</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-400">Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {digest.churnRisk.map((user) => (
                    <tr 
                      key={user.user_id}
                      className="border-b border-white/5 hover:bg-white/5 transition-colors"
                    >
                      <td className="py-3 px-4 text-sm text-gray-200 font-medium">
                        {user.username}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-400">
                        {new Date(user.lastSeen).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-sm text-right text-gray-300">
                        {user.balance.toFixed(4)} SOL
                      </td>
                      <td className="py-3 px-4 text-sm text-right text-gray-300">
                        {user.matchCount}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex justify-center">
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            user.riskScore > 0.7
                              ? 'bg-red-500/20 text-red-400'
                              : user.riskScore > 0.4
                              ? 'bg-amber-500/20 text-amber-400'
                              : 'bg-blue-500/20 text-blue-400'
                          }`}>
                            {(user.riskScore * 100).toFixed(0)}%
                          </span>
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

      {/* Summary */}
      <CommandCard>
        <h3 className="text-lg font-semibold text-gray-200 mb-3">Quick Summary</h3>
        <div className="space-y-2 text-sm text-gray-400">
          <p>• {digest?.newSignups || 0} new users joined today</p>
          <p>• {digest?.activeUsers || 0} users were active</p>
          <p>• {digest?.matchesPlayed || 0} matches were played</p>
          <p>• {(digest?.depositsTotal || 0).toFixed(4)} SOL deposited</p>
          <p>• {(digest?.withdrawalsTotal || 0).toFixed(4)} SOL withdrawn</p>
          <p>• {(digest?.revenue || 0).toFixed(4)} SOL earned in platform fees</p>
        </div>
      </CommandCard>
    </div>
  );
}

function ActionItemCard({ item }: { item: ActionItem }) {
  const priorityColors = {
    urgent: 'border-red-500/30 bg-red-500/10',
    high: 'border-amber-500/30 bg-amber-500/10',
    normal: 'border-blue-500/30 bg-blue-500/10',
  };

  const priorityBadges = {
    urgent: 'bg-red-500/20 text-red-400',
    high: 'bg-amber-500/20 text-amber-400',
    normal: 'bg-blue-500/20 text-blue-400',
  };

  return (
    <div className={`p-4 rounded-lg border ${priorityColors[item.priority]}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${priorityBadges[item.priority]}`}>
              {item.priority}
            </span>
            <span className="text-sm font-semibold text-gray-300">{item.type}</span>
          </div>
          <p className="text-sm text-gray-400">{item.description}</p>
        </div>
        <a
          href={item.link}
          className="ml-4 px-3 py-1 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 text-indigo-400 text-xs font-medium transition-all"
        >
          View
        </a>
      </div>
    </div>
  );
}
