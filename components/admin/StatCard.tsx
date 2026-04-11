'use client';

import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: string;
    positive: boolean;
  };
  severity?: 'default' | 'success' | 'warning' | 'danger';
}

export function StatCard({ label, value, icon: Icon, trend, severity = 'default' }: StatCardProps) {
  const severityColors = {
    default: 'from-indigo-500/20 to-purple-500/20',
    success: 'from-emerald-500/20 to-green-500/20',
    warning: 'from-amber-500/20 to-orange-500/20',
    danger: 'from-red-500/20 to-rose-500/20',
  };

  const iconColors = {
    default: 'text-indigo-400',
    success: 'text-emerald-400',
    warning: 'text-amber-400',
    danger: 'text-red-400',
  };

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1a1a21] to-[#1f1f28] border border-white/5 p-6 transition-all hover:border-indigo-500/20 hover:shadow-lg hover:shadow-indigo-500/10 hover:-translate-y-1">
      {/* Top gradient bar */}
      <div className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r ${severityColors[severity]}`} />

      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-gray-500 font-medium mb-2">{label}</p>
          <p className="text-3xl font-bold bg-gradient-to-br from-gray-100 to-gray-400 bg-clip-text text-transparent">
            {value}
          </p>
          {trend && (
            <p className={`text-xs mt-2 ${trend.positive ? 'text-emerald-400' : 'text-red-400'}`}>
              {trend.positive ? '↑' : '↓'} {trend.value}
            </p>
          )}
        </div>
        <div className={`p-3 rounded-xl bg-white/5 ${iconColors[severity]}`}>
          <Icon size={24} />
        </div>
      </div>
    </div>
  );
}
