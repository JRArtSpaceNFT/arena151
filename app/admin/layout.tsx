import React from 'react';
import Link from 'next/link';
import { 
  LayoutDashboard, 
  Users, 
  ArrowDownToLine, 
  ArrowUpFromLine, 
  Swords,
  Shield,
  Scale,
  FileText,
  Activity,
  Calendar
} from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-gray-100">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-screen w-64 border-r border-gray-800 bg-[#0f0f14] p-6">
        <div className="mb-8">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
            Arena 151
          </h1>
          <p className="text-sm text-gray-500 mt-1">Command Center</p>
        </div>

        <nav className="space-y-2">
          <NavLink href="/admin" icon={<LayoutDashboard size={18} />}>
            Dashboard
          </NavLink>
          <NavLink href="/admin/users" icon={<Users size={18} />}>
            Users
          </NavLink>
          <NavLink href="/admin/deposits" icon={<ArrowDownToLine size={18} />}>
            Deposits
          </NavLink>
          <NavLink href="/admin/withdrawals" icon={<ArrowUpFromLine size={18} />}>
            Withdrawals
          </NavLink>
          <NavLink href="/admin/matches" icon={<Swords size={18} />}>
            Matches
          </NavLink>
          <NavLink href="/admin/risk" icon={<Shield size={18} />}>
            Risk Center
          </NavLink>
          <NavLink href="/admin/reconciliation" icon={<Scale size={18} />}>
            Reconciliation
          </NavLink>
          <NavLink href="/admin/audit" icon={<FileText size={18} />}>
            Audit Log
          </NavLink>
          <NavLink href="/admin/health" icon={<Activity size={18} />}>
            System Health
          </NavLink>
          <NavLink href="/admin/today" icon={<Calendar size={18} />}>
            Today
          </NavLink>
        </nav>

        <div className="absolute bottom-6 left-6 right-6">
          <Link 
            href="/" 
            className="block text-sm text-gray-500 hover:text-gray-300 transition-colors"
          >
            ← Back to Arena
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="ml-64 h-screen overflow-y-auto">
        {children}
      </main>
    </div>
  );
}

function NavLink({ 
  href, 
  icon, 
  children 
}: { 
  href: string; 
  icon: React.ReactNode; 
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-400 hover:text-gray-100 hover:bg-white/5 transition-all group"
    >
      <span className="text-gray-500 group-hover:text-indigo-400 transition-colors">
        {icon}
      </span>
      <span className="text-sm font-medium">{children}</span>
    </Link>
  );
}
