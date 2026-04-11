'use client';

import React, { useEffect, useState } from 'react';
import { Search, Filter, Eye, Flag, FileText, AlertTriangle } from 'lucide-react';
import { CommandCard } from '@/components/admin/CommandCard';

interface User {
  id: string;
  username: string;
  email: string;
  created_at: string;
  last_seen: string | null;
  wallet_address: string | null;
  available_balance: number;
  locked_balance: number;
  pending_withdrawal: number;
  lifetime_deposits: number;
  lifetime_withdrawals: number;
  match_count: number;
  account_status: string;
  is_flagged: boolean;
}

export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  useEffect(() => {
    fetchUsers();
  }, [filterStatus]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus !== 'all') params.set('filter', filterStatus);
      
      const res = await fetch(`/api/admin/users?${params}`);
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(user => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      user.username?.toLowerCase().includes(query) ||
      user.email?.toLowerCase().includes(query) ||
      user.wallet_address?.toLowerCase().includes(query) ||
      user.id.toLowerCase().includes(query)
    );
  });

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent mb-2">
          User Management
        </h1>
        <p className="text-gray-500">Search, filter, and manage platform users</p>
      </div>

      {/* Search & Filters */}
      <CommandCard className="mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
            <input
              type="text"
              placeholder="Search by username, email, wallet address, or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500/50 transition-colors"
            />
          </div>
          <div className="flex gap-2">
            <FilterButton 
              active={filterStatus === 'all'} 
              onClick={() => setFilterStatus('all')}
            >
              All
            </FilterButton>
            <FilterButton 
              active={filterStatus === 'flagged'} 
              onClick={() => setFilterStatus('flagged')}
            >
              Flagged
            </FilterButton>
            <FilterButton 
              active={filterStatus === 'has_balance'} 
              onClick={() => setFilterStatus('has_balance')}
            >
              Has Balance
            </FilterButton>
            <FilterButton 
              active={filterStatus === 'pending_withdrawal'} 
              onClick={() => setFilterStatus('pending_withdrawal')}
            >
              Pending WD
            </FilterButton>
            <FilterButton 
              active={filterStatus === 'inactive'} 
              onClick={() => setFilterStatus('inactive')}
            >
              Inactive
            </FilterButton>
          </div>
        </div>
      </CommandCard>

      {/* User Table */}
      <CommandCard>
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mx-auto mb-4" />
            <p className="text-gray-400">Loading users...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">User</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Created</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Last Seen</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-400">Balance</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-400">Locked</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-400">Matches</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-400">Status</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr 
                    key={user.id}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div>
                        <p className="text-sm font-medium text-gray-200">{user.username || 'Unknown'}</p>
                        <p className="text-xs text-gray-500">{user.email}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-400">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-400">
                      {user.last_seen 
                        ? new Date(user.last_seen).toLocaleDateString()
                        : 'Never'
                      }
                    </td>
                    <td className="py-3 px-4 text-sm text-right text-emerald-400">
                      {user.available_balance.toFixed(4)} SOL
                    </td>
                    <td className="py-3 px-4 text-sm text-right text-amber-400">
                      {user.locked_balance.toFixed(4)} SOL
                    </td>
                    <td className="py-3 px-4 text-sm text-right text-gray-300">
                      {user.match_count}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-2">
                        {user.is_flagged && (
                          <span className="px-2 py-1 rounded-full bg-red-500/20 text-red-400 text-xs">
                            Flagged
                          </span>
                        )}
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          user.account_status === 'active' 
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-gray-500/20 text-gray-400'
                        }`}>
                          {user.account_status}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setSelectedUser(user)}
                          className="p-2 rounded-lg bg-white/5 hover:bg-indigo-500/20 border border-white/10 hover:border-indigo-500/30 transition-all text-gray-400 hover:text-indigo-400"
                          title="View Details"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          className="p-2 rounded-lg bg-white/5 hover:bg-amber-500/20 border border-white/10 hover:border-amber-500/30 transition-all text-gray-400 hover:text-amber-400"
                          title="Flag User"
                        >
                          <Flag size={16} />
                        </button>
                        <button
                          className="p-2 rounded-lg bg-white/5 hover:bg-blue-500/20 border border-white/10 hover:border-blue-500/30 transition-all text-gray-400 hover:text-blue-400"
                          title="Add Note"
                        >
                          <FileText size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredUsers.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500">No users found</p>
              </div>
            )}
          </div>
        )}
      </CommandCard>

      {/* User Detail Drawer */}
      {selectedUser && (
        <UserDetailDrawer 
          user={selectedUser} 
          onClose={() => setSelectedUser(null)} 
        />
      )}
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

function UserDetailDrawer({ user, onClose }: { user: User; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-end">
      <div 
        className="absolute inset-0" 
        onClick={onClose}
      />
      <div className="relative w-full max-w-2xl h-full bg-[#0a0a0f] border-l border-white/10 overflow-y-auto">
        <div className="p-8">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-100">{user.username || 'Unknown'}</h2>
              <p className="text-sm text-gray-500 mt-1">{user.email}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Profile Info */}
          <div className="space-y-6">
            <InfoSection title="Account Details">
              <InfoRow label="User ID" value={user.id} />
              <InfoRow label="Username" value={user.username || 'Not set'} />
              <InfoRow label="Email" value={user.email} />
              <InfoRow label="Created" value={new Date(user.created_at).toLocaleString()} />
              <InfoRow label="Last Seen" value={user.last_seen ? new Date(user.last_seen).toLocaleString() : 'Never'} />
              <InfoRow label="Account Status" value={user.account_status} />
            </InfoSection>

            <InfoSection title="Wallet">
              <InfoRow label="Address" value={user.wallet_address || 'Not connected'} mono />
            </InfoSection>

            <InfoSection title="Balances">
              <InfoRow label="Available" value={`${user.available_balance.toFixed(4)} SOL`} />
              <InfoRow label="Locked in Matches" value={`${user.locked_balance.toFixed(4)} SOL`} />
              <InfoRow label="Pending Withdrawal" value={`${user.pending_withdrawal.toFixed(4)} SOL`} />
            </InfoSection>

            <InfoSection title="Activity">
              <InfoRow label="Lifetime Deposits" value={`${user.lifetime_deposits.toFixed(4)} SOL`} />
              <InfoRow label="Lifetime Withdrawals" value={`${user.lifetime_withdrawals.toFixed(4)} SOL`} />
              <InfoRow label="Total Matches" value={user.match_count.toString()} />
            </InfoSection>

            {user.is_flagged && (
              <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="text-red-400" size={18} />
                  <span className="text-sm font-semibold text-red-400">User Flagged</span>
                </div>
                <p className="text-sm text-gray-400">This user has been flagged for review.</p>
              </div>
            )}

            <div className="flex gap-3">
              <button className="flex-1 px-4 py-3 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 text-indigo-400 font-medium transition-all">
                View Transactions
              </button>
              <button className="flex-1 px-4 py-3 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-400 font-medium transition-all">
                View Matches
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-white/5 border border-white/10 p-4">
      <h3 className="text-sm font-semibold text-gray-400 mb-3">{title}</h3>
      <div className="space-y-2">
        {children}
      </div>
    </div>
  );
}

function InfoRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between items-center py-1">
      <span className="text-sm text-gray-500">{label}</span>
      <span className={`text-sm text-gray-200 ${mono ? 'font-mono' : ''}`}>
        {value}
      </span>
    </div>
  );
}
