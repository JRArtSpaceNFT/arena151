'use client';

import React, { useEffect, useState } from 'react';
import { FileText, Search, Filter } from 'lucide-react';
import { CommandCard } from '@/components/admin/CommandCard';

interface AuditLog {
  id: string;
  admin_username: string;
  action: string;
  entity_type: string;
  entity_id: string;
  summary: string;
  status: string;
  created_at: string;
  metadata: any;
}

export default function AdminAudit() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAction, setFilterAction] = useState<string>('all');

  useEffect(() => {
    fetchLogs();
  }, [filterAction]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterAction !== 'all') params.set('action', filterAction);
      
      const res = await fetch(`/api/admin/audit/logs?${params}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs);
      }
    } catch (error) {
      console.error('Failed to fetch audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter(log => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      log.summary?.toLowerCase().includes(query) ||
      log.action?.toLowerCase().includes(query) ||
      log.admin_username?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent mb-2">
          Audit Log
        </h1>
        <p className="text-gray-500">Track all admin actions and system events</p>
      </div>

      {/* Search & Filters */}
      <CommandCard className="mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
            <input
              type="text"
              placeholder="Search logs by action, summary, or admin..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500/50 transition-colors"
            />
          </div>
          <div className="flex gap-2">
            <FilterButton active={filterAction === 'all'} onClick={() => setFilterAction('all')}>
              All
            </FilterButton>
            <FilterButton active={filterAction === 'withdrawal'} onClick={() => setFilterAction('withdrawal')}>
              Withdrawals
            </FilterButton>
            <FilterButton active={filterAction === 'user'} onClick={() => setFilterAction('user')}>
              Users
            </FilterButton>
            <FilterButton active={filterAction === 'match'} onClick={() => setFilterAction('match')}>
              Matches
            </FilterButton>
          </div>
        </div>
      </CommandCard>

      {/* Log Table */}
      <CommandCard>
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mx-auto mb-4" />
            <p className="text-gray-400">Loading audit logs...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Timestamp</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Admin</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Action</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Summary</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-400">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => (
                  <tr 
                    key={log.id}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors"
                  >
                    <td className="py-3 px-4 text-sm text-gray-400">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-300">
                      {log.admin_username || 'System'}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-1 rounded-full bg-indigo-500/20 text-indigo-400 text-xs font-mono">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-300">
                      {log.summary}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex justify-center">
                        <StatusBadge status={log.status} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredLogs.length === 0 && (
              <div className="text-center py-12">
                <FileText className="mx-auto mb-4 text-gray-600" size={48} />
                <p className="text-gray-500">No audit logs found</p>
              </div>
            )}
          </div>
        )}
      </CommandCard>
    </div>
  );
}

function FilterButton({ 
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
    success: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: 'Success' },
    failed: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Failed' },
    pending: { bg: 'bg-amber-500/20', text: 'text-amber-400', label: 'Pending' },
  };

  const { bg, text, label } = config[status as keyof typeof config] || config.pending;

  return (
    <span className={`px-2 py-1 rounded-full ${bg} ${text} text-xs`}>
      {label}
    </span>
  );
}
