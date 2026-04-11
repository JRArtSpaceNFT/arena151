'use client'

import { useEffect, useState } from 'react'

interface ReconciliationData {
  timestamp: string
  healthy: boolean
  checks: Record<string, { healthy: boolean; [key: string]: unknown }>
}

export default function AdminDashboard() {
  const [reconciliation, setReconciliation] = useState<ReconciliationData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadReconciliation()
    const interval = setInterval(loadReconciliation, 30000) // Refresh every 30s
    return () => clearInterval(interval)
  }, [])

  const loadReconciliation = async () => {
    try {
      const token = localStorage.getItem('admin_token')
      const res = await fetch('/api/admin/reconciliation', {
        headers: { 'x-admin-token': token ?? '' },
      })
      if (res.ok) {
        const data = await res.json()
        setReconciliation(data)
      }
    } catch (err) {
      console.error('Failed to load reconciliation:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="text-white">Loading...</div>
  }

  const healthyCount = reconciliation
    ? Object.values(reconciliation.checks).filter((c) => c.healthy).length
    : 0
  const totalCount = reconciliation ? Object.keys(reconciliation.checks).length : 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white">Dashboard</h1>
        <div className={`px-4 py-2 rounded-lg font-medium ${
          reconciliation?.healthy
            ? 'bg-green-900/50 text-green-400 border border-green-700'
            : 'bg-red-900/50 text-red-400 border border-red-700'
        }`}>
          {reconciliation?.healthy ? '✅ All Systems Healthy' : '⚠️ Issues Detected'}
        </div>
      </div>

      {/* Health Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="text-gray-400 text-sm font-medium mb-2">Health Checks</div>
          <div className="text-3xl font-bold text-white">
            {healthyCount}/{totalCount}
          </div>
          <div className="text-sm text-gray-400 mt-1">Passing</div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="text-gray-400 text-sm font-medium mb-2">Last Check</div>
          <div className="text-xl font-medium text-white">
            {reconciliation
              ? new Date(reconciliation.timestamp).toLocaleTimeString()
              : '—'}
          </div>
          <div className="text-sm text-gray-400 mt-1">Auto-refresh every 30s</div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="text-gray-400 text-sm font-medium mb-2">Quick Actions</div>
          <div className="space-y-2">
            <a
              href="/admin/reconciliation"
              className="block text-sm text-blue-400 hover:text-blue-300 transition"
            >
              → View Full Reconciliation
            </a>
            <a
              href="/admin/audit"
              className="block text-sm text-blue-400 hover:text-blue-300 transition"
            >
              → Audit Log
            </a>
          </div>
        </div>
      </div>

      {/* Check Details */}
      {reconciliation && (
        <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-700">
            <h2 className="text-xl font-bold text-white">System Checks</h2>
          </div>
          <div className="divide-y divide-gray-700">
            {Object.entries(reconciliation.checks).map(([name, check]) => (
              <div key={name} className="px-6 py-4 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full ${
                    check.healthy ? 'bg-green-500' : 'bg-red-500'
                  }`} />
                  <div className="font-medium text-white capitalize">
                    {name.replace(/([A-Z])/g, ' $1').trim()}
                  </div>
                </div>
                <div className="text-sm text-gray-400">
                  {'count' in check && typeof check.count === 'number'
                    ? `${check.count} items`
                    : check.healthy
                    ? 'OK'
                    : 'Issue detected'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
