'use client';

import React, { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface Alert {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
}

interface AlertBannerProps {
  alerts: Alert[];
}

export function AlertBanner({ alerts }: AlertBannerProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const criticalAlerts = alerts.filter(a => a.severity === 'critical' && !dismissed.has(a.id));
  
  if (criticalAlerts.length === 0) return null;

  const severityColors = {
    critical: 'from-red-500/20 to-rose-500/20 border-red-500/30',
    high: 'from-amber-500/20 to-orange-500/20 border-amber-500/30',
    medium: 'from-blue-500/20 to-indigo-500/20 border-blue-500/30',
    low: 'from-gray-500/20 to-slate-500/20 border-gray-500/30',
  };

  return (
    <div className="mb-6 space-y-3">
      {criticalAlerts.map((alert) => (
        <div
          key={alert.id}
          className={`flex items-center justify-between rounded-xl border bg-gradient-to-r p-4 ${severityColors[alert.severity]}`}
        >
          <div className="flex items-center gap-3">
            <AlertTriangle className="text-red-400" size={20} />
            <p className="text-sm font-medium text-gray-100">{alert.message}</p>
          </div>
          <button
            onClick={() => setDismissed(prev => new Set(prev).add(alert.id))}
            className="text-gray-400 hover:text-gray-200 transition-colors"
          >
            <X size={18} />
          </button>
        </div>
      ))}
    </div>
  );
}
