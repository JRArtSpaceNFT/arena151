'use client';

import React, { useEffect, useState } from 'react';
import { AlertTriangle, Shield, Flag, Activity, TrendingUp } from 'lucide-react';
import { CommandCard } from '@/components/admin/CommandCard';
import { StatCard } from '@/components/admin/StatCard';

interface RiskAlert {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  type: string;
  description: string;
  user_id: string | null;
  username: string | null;
  created_at: string;
  resolved: boolean;
}

interface FlaggedUser {
  id: string;
  username: string;
  email: string;
  flag_type: string;
  severity: string;
  description: string;
  flagged_at: string;
  resolved: boolean;
}

export default function AdminRiskCenter() {
  const [alerts, setAlerts] = useState<RiskAlert[]>([]);
  const [flaggedUsers, setFlaggedUsers] = useState<FlaggedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    criticalAlerts: 0,
    flaggedUsers: 0,
    rateLimitHits: 0,
    suspiciousActivity: 0,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [alertsRes, flaggedRes, statsRes] = await Promise.all([
        fetch('/api/admin/risk/alerts'),
        fetch('/api/admin/risk/flagged-users'),
        fetch('/api/admin/risk/stats'),
      ]);

      if (alertsRes.ok) {
        const data = await alertsRes.json();
        setAlerts(data.alerts);
      }

      if (flaggedRes.ok) {
        const data = await flaggedRes.json();
        setFlaggedUsers(data.users);
      }

      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch risk data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResolveAlert = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/risk/alerts/${id}/resolve`, {
        method: 'POST',
      });
      if (res.ok) {
        fetchData();
      }
    } catch (error) {
      console.error('Failed to resolve alert:', error);
    }
  };

  const handleUnflagUser = async (userId: string) => {
    if (!confirm('Remove flag from this user?')) return;
    
    try {
      const res = await fetch(`/api/admin/users/${userId}/unflag`, {
        method: 'POST',
      });
      if (res.ok) {
        fetchData();
      }
    } catch (error) {
      console.error('Failed to unflag user:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto mb-4" />
          <p className="text-gray-400">Loading risk data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent mb-2">
          Risk & Anomaly Center
        </h1>
        <p className="text-gray-500">Monitor threats and suspicious activity</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Critical Alerts"
          value={stats.criticalAlerts}
          icon={AlertTriangle}
          severity={stats.criticalAlerts > 0 ? 'danger' : 'default'}
        />
        <StatCard
          label="Flagged Users"
          value={stats.flaggedUsers}
          icon={Flag}
          severity={stats.flaggedUsers > 0 ? 'warning' : 'default'}
        />
        <StatCard
          label="Rate Limit Hits"
          value={stats.rateLimitHits}
          icon={Activity}
          severity={stats.rateLimitHits > 100 ? 'warning' : 'default'}
        />
        <StatCard
          label="Suspicious Activity"
          value={stats.suspiciousActivity}
          icon={Shield}
          severity={stats.suspiciousActivity > 0 ? 'warning' : 'default'}
        />
      </div>

      {/* Active Alerts */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-200 mb-4">Active Alerts</h2>
        <CommandCard>
          {alerts.filter(a => !a.resolved).length === 0 ? (
            <div className="text-center py-12">
              <Shield className="mx-auto mb-4 text-emerald-400" size={48} />
              <p className="text-emerald-400 font-semibold mb-2">All Clear</p>
              <p className="text-gray-500 text-sm">No active risk alerts</p>
            </div>
          ) : (
            <div className="space-y-3">
              {alerts
                .filter(a => !a.resolved)
                .sort((a, b) => {
                  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
                  return severityOrder[a.severity] - severityOrder[b.severity];
                })
                .map((alert) => (
                  <AlertCard 
                    key={alert.id} 
                    alert={alert} 
                    onResolve={() => handleResolveAlert(alert.id)}
                  />
                ))}
            </div>
          )}
        </CommandCard>
      </div>

      {/* Flagged Users */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-200 mb-4">Flagged Users</h2>
        <CommandCard>
          {flaggedUsers.filter(u => !u.resolved).length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">No flagged users</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">User</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Flag Type</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-400">Severity</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Description</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Flagged</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-400">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {flaggedUsers
                    .filter(u => !u.resolved)
                    .map((user) => (
                      <tr 
                        key={user.id}
                        className="border-b border-white/5 hover:bg-white/5 transition-colors"
                      >
                        <td className="py-3 px-4">
                          <div>
                            <p className="text-sm font-medium text-gray-200">{user.username}</p>
                            <p className="text-xs text-gray-500">{user.email}</p>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-300">{user.flag_type}</td>
                        <td className="py-3 px-4">
                          <div className="flex justify-center">
                            <SeverityBadge severity={user.severity as any} />
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-400">{user.description}</td>
                        <td className="py-3 px-4 text-sm text-gray-400">
                          {new Date(user.flagged_at).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleUnflagUser(user.id)}
                              className="px-3 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-400 text-xs font-medium transition-all"
                            >
                              Unflag
                            </button>
                            <button
                              className="px-3 py-1 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 text-indigo-400 text-xs font-medium transition-all"
                            >
                              View Profile
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </CommandCard>
      </div>

      {/* Resolved Alerts */}
      {alerts.filter(a => a.resolved).length > 0 && (
        <div>
          <h2 className="text-xl font-semibold text-gray-200 mb-4">Recently Resolved</h2>
          <CommandCard>
            <div className="space-y-2">
              {alerts
                .filter(a => a.resolved)
                .slice(0, 5)
                .map((alert) => (
                  <div 
                    key={alert.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-white/5 opacity-60"
                  >
                    <div className="flex items-center gap-3">
                      <SeverityBadge severity={alert.severity} />
                      <span className="text-sm text-gray-400">{alert.description}</span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {new Date(alert.created_at).toLocaleDateString()}
                    </span>
                  </div>
                ))}
            </div>
          </CommandCard>
        </div>
      )}
    </div>
  );
}

function AlertCard({ 
  alert, 
  onResolve 
}: { 
  alert: RiskAlert; 
  onResolve: () => void;
}) {
  const severityColors = {
    critical: 'border-red-500/30 bg-red-500/10',
    high: 'border-amber-500/30 bg-amber-500/10',
    medium: 'border-blue-500/30 bg-blue-500/10',
    low: 'border-gray-500/30 bg-gray-500/10',
  };

  return (
    <div className={`p-4 rounded-lg border ${severityColors[alert.severity]}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <SeverityBadge severity={alert.severity} />
            <span className="text-sm font-semibold text-gray-300">{alert.type}</span>
          </div>
          <p className="text-sm text-gray-400 mb-2">{alert.description}</p>
          {alert.username && (
            <p className="text-xs text-gray-500">User: {alert.username}</p>
          )}
          <p className="text-xs text-gray-500">
            {new Date(alert.created_at).toLocaleString()}
          </p>
        </div>
        <button
          onClick={onResolve}
          className="px-3 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-400 text-xs font-medium transition-all"
        >
          Resolve
        </button>
      </div>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: 'critical' | 'high' | 'medium' | 'low' }) {
  const config = {
    critical: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Critical' },
    high: { bg: 'bg-amber-500/20', text: 'text-amber-400', label: 'High' },
    medium: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'Medium' },
    low: { bg: 'bg-gray-500/20', text: 'text-gray-400', label: 'Low' },
  };

  const { bg, text, label } = config[severity];

  return (
    <span className={`px-2 py-1 rounded-full ${bg} ${text} text-xs font-medium`}>
      {label}
    </span>
  );
}
