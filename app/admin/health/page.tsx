'use client';

import React, { useEffect, useState } from 'react';
import { Activity, Database, Zap, Webhook, Clock, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { CommandCard } from '@/components/admin/CommandCard';
import { StatCard } from '@/components/admin/StatCard';

interface HealthStatus {
  overall: 'healthy' | 'degraded' | 'down';
  services: {
    database: ServiceHealth;
    rpc: ServiceHealth;
    webhooks: ServiceHealth;
    cron: ServiceHealth;
  };
  metrics: {
    lastSuccessfulDeposit: string | null;
    lastSuccessfulWithdrawal: string | null;
    lastSuccessfulSettlement: string | null;
    errorCount24h: number;
    failedJobs: number;
  };
}

interface ServiceHealth {
  status: 'up' | 'degraded' | 'down';
  latency: number | null;
  lastCheck: string;
  error: string | null;
}

export default function AdminHealth() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const fetchHealth = async () => {
    try {
      const res = await fetch('/api/admin/health/status');
      if (res.ok) {
        const data = await res.json();
        setHealth(data);
      }
    } catch (error) {
      console.error('Failed to fetch health status:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto mb-4" />
          <p className="text-gray-400">Checking system health...</p>
        </div>
      </div>
    );
  }

  const overallColor = health?.overall === 'healthy' 
    ? 'emerald' 
    : health?.overall === 'degraded' 
    ? 'amber' 
    : 'red';

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent mb-2">
          System Health
        </h1>
        <p className="text-gray-500">Monitor platform infrastructure and services</p>
      </div>

      {/* Overall Status */}
      <div className="mb-8">
        <CommandCard>
          <div className="flex items-center gap-6">
            <div className={`p-6 rounded-2xl bg-${overallColor}-500/20`}>
              {health?.overall === 'healthy' ? (
                <CheckCircle className={`text-${overallColor}-400`} size={48} />
              ) : (
                <AlertTriangle className={`text-${overallColor}-400`} size={48} />
              )}
            </div>
            <div>
              <h2 className="text-3xl font-bold text-gray-100 capitalize mb-2">
                {health?.overall || 'Unknown'}
              </h2>
              <p className="text-gray-500">
                All systems {health?.overall === 'healthy' ? 'operational' : 'experiencing issues'}
              </p>
            </div>
          </div>
        </CommandCard>
      </div>

      {/* Service Status */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-200 mb-4">Services</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <ServiceCard
            name="Database"
            icon={Database}
            status={health?.services.database.status || 'down'}
            latency={health?.services.database.latency}
            lastCheck={health?.services.database.lastCheck}
            error={health?.services.database.error}
          />
          <ServiceCard
            name="RPC Provider"
            icon={Zap}
            status={health?.services.rpc.status || 'down'}
            latency={health?.services.rpc.latency}
            lastCheck={health?.services.rpc.lastCheck}
            error={health?.services.rpc.error}
          />
          <ServiceCard
            name="Webhooks"
            icon={Webhook}
            status={health?.services.webhooks.status || 'down'}
            latency={health?.services.webhooks.latency}
            lastCheck={health?.services.webhooks.lastCheck}
            error={health?.services.webhooks.error}
          />
          <ServiceCard
            name="Cron Jobs"
            icon={Clock}
            status={health?.services.cron.status || 'down'}
            latency={health?.services.cron.latency}
            lastCheck={health?.services.cron.lastCheck}
            error={health?.services.cron.error}
          />
        </div>
      </div>

      {/* Metrics */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-200 mb-4">Recent Activity</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Last Deposit"
            value={health?.metrics.lastSuccessfulDeposit 
              ? new Date(health.metrics.lastSuccessfulDeposit).toLocaleTimeString()
              : 'Never'
            }
            icon={Activity}
            severity="success"
          />
          <StatCard
            label="Last Withdrawal"
            value={health?.metrics.lastSuccessfulWithdrawal 
              ? new Date(health.metrics.lastSuccessfulWithdrawal).toLocaleTimeString()
              : 'Never'
            }
            icon={Activity}
            severity="success"
          />
          <StatCard
            label="Last Settlement"
            value={health?.metrics.lastSuccessfulSettlement 
              ? new Date(health.metrics.lastSuccessfulSettlement).toLocaleTimeString()
              : 'Never'
            }
            icon={Activity}
            severity="success"
          />
          <StatCard
            label="Errors (24h)"
            value={health?.metrics.errorCount24h || 0}
            icon={XCircle}
            severity={(health?.metrics.errorCount24h || 0) > 10 ? 'danger' : 'default'}
          />
        </div>
      </div>

      {/* System Info */}
      <div>
        <h2 className="text-xl font-semibold text-gray-200 mb-4">System Information</h2>
        <CommandCard>
          <div className="space-y-4">
            <InfoRow label="Environment" value="Production" />
            <InfoRow label="Deployment" value="Vercel (arena151.xyz)" />
            <InfoRow label="Region" value="US-West" />
            <InfoRow label="Database" value="Supabase (PostgreSQL)" />
            <InfoRow label="Blockchain" value="Solana Mainnet" />
            <InfoRow label="RPC Provider" value="Helius" />
          </div>
        </CommandCard>
      </div>
    </div>
  );
}

function ServiceCard({ 
  name, 
  icon: Icon, 
  status, 
  latency, 
  lastCheck, 
  error 
}: { 
  name: string; 
  icon: any; 
  status: 'up' | 'degraded' | 'down'; 
  latency: number | null; 
  lastCheck: string | undefined; 
  error: string | null | undefined;
}) {
  const statusConfig = {
    up: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', icon: CheckCircle },
    degraded: { bg: 'bg-amber-500/20', text: 'text-amber-400', icon: AlertTriangle },
    down: { bg: 'bg-red-500/20', text: 'text-red-400', icon: XCircle },
  };

  const config = statusConfig[status];
  const StatusIcon = config.icon;

  return (
    <div className="rounded-2xl bg-gradient-to-br from-[#1a1a21] to-[#1f1f28] border border-white/5 p-6">
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-xl ${config.bg}`}>
          <Icon className={config.text} size={24} />
        </div>
        <StatusIcon className={config.text} size={20} />
      </div>
      <h3 className="text-lg font-semibold text-gray-100 mb-2">{name}</h3>
      <p className={`text-sm ${config.text} capitalize mb-1`}>{status}</p>
      {latency !== null && (
        <p className="text-xs text-gray-500">Latency: {latency}ms</p>
      )}
      {lastCheck && (
        <p className="text-xs text-gray-500">
          Checked: {new Date(lastCheck).toLocaleTimeString()}
        </p>
      )}
      {error && (
        <p className="text-xs text-red-400 mt-2">{error}</p>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm text-gray-200 font-medium">{value}</span>
    </div>
  );
}
