/**
 * GET /api/admin/reconciliation
 * 
 * Run all reconciliation health checks and return summary.
 * Read-only diagnostic endpoint.
 * 
 * Auth: x-admin-token header
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { timingSafeEqual } from 'crypto'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export async function GET(req: NextRequest) {
  // ── Auth ─────────────────────────────────────────────────────
  const adminToken = req.headers.get('x-admin-token') ?? ''
  const expectedToken = process.env.ADMIN_SECRET ?? ''
  
  let authorized = false
  try {
    const a = Buffer.from(adminToken)
    const b = Buffer.from(expectedToken)
    authorized = a.length === b.length && timingSafeEqual(a, b)
  } catch { authorized = false }

  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const checks: Record<string, unknown> = {}

  // ── Check 1: Locked Balance Drift ───────────────────────────
  try {
    const { data, error } = await supabaseAdmin.rpc('check_locked_balance_drift')
    
    if (error) {
      // Fallback to manual query if RPC doesn't exist
      const activeQuery = await supabaseAdmin
        .from('matches')
        .select('entry_fee_sol')
        .in('status', ['forming','ready','funds_locked','battling','result_pending','settlement_pending','settling'])
      
      const expectedLocked = (activeQuery.data ?? []).reduce((sum, m) => sum + (Number(m.entry_fee_sol) * 2), 0)
      
      const profilesQuery = await supabaseAdmin
        .from('profiles')
        .select('locked_balance')
      
      const actualLocked = (profilesQuery.data ?? []).reduce((sum, p) => sum + Number(p.locked_balance), 0)
      
      const drift = actualLocked - expectedLocked
      
      checks.lockedBalanceDrift = {
        actualLocked,
        expectedLocked,
        drift,
        healthy: Math.abs(drift) < 0.000001,  // Allow floating-point tolerance
      }
    } else {
      checks.lockedBalanceDrift = {
        ...data,
        healthy: Math.abs(data.drift) < 0.000001,
      }
    }
  } catch (err) {
    checks.lockedBalanceDrift = { error: String(err), healthy: false }
  }

  // ── Check 2: Negative Balances ──────────────────────────────
  try {
    const { count } = await supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .or('balance.lt.0,locked_balance.lt.0')
    
    checks.negativeBalances = {
      count: count ?? 0,
      healthy: (count ?? 0) === 0,
    }
  } catch (err) {
    checks.negativeBalances = { error: String(err), healthy: false }
  }

  // ── Check 3: Locked > Balance ───────────────────────────────
  try {
    const { data } = await supabaseAdmin
      .from('profiles')
      .select('id, username, balance, locked_balance')
      .gt('locked_balance', 'balance')
    
    checks.lockedExceedsBalance = {
      count: data?.length ?? 0,
      users: data?.map(u => ({ username: u.username, balance: u.balance, locked: u.locked_balance })) ?? [],
      healthy: (data?.length ?? 0) === 0,
    }
  } catch (err) {
    checks.lockedExceedsBalance = { error: String(err), healthy: false }
  }

  // ── Check 4: Settled Matches Missing TX ─────────────────────
  try {
    const { data } = await supabaseAdmin
      .from('matches')
      .select('id, player_a_id, player_b_id, entry_fee_sol, created_at')
      .eq('status', 'settled')
      .is('settlement_tx', null)
    
    checks.settledWithoutTx = {
      count: data?.length ?? 0,
      matches: data ?? [],
      healthy: (data?.length ?? 0) === 0,
    }
  } catch (err) {
    checks.settledWithoutTx = { error: String(err), healthy: false }
  }

  // ── Check 5: Duplicate Settlements ──────────────────────────
  try {
    const { data } = await supabaseAdmin
      .from('audit_log')
      .select('match_id, event_type')
      .in('event_type', ['settlement_winner', 'settlement_loser'])
    
    const grouped = (data ?? []).reduce((acc, row) => {
      const key = `${row.match_id}:${row.event_type}`
      acc[key] = (acc[key] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    const duplicates = Object.entries(grouped).filter(([_, count]) => count > 1)
    
    checks.duplicateSettlements = {
      count: duplicates.length,
      duplicates: duplicates.map(([key, count]) => ({ key, count })),
      healthy: duplicates.length === 0,
    }
  } catch (err) {
    checks.duplicateSettlements = { error: String(err), healthy: false }
  }

  // ── Check 6: Key Version Summary ────────────────────────────
  try {
    const { data } = await supabaseAdmin.rpc('get_key_version_summary')
    
    checks.walletKeyVersions = {
      versions: data ?? [],
      allV2: (data ?? []).every((row: { key_version: number }) => row.key_version === 2),
      healthy: (data ?? []).every((row: { key_version: number }) => row.key_version === 2),
    }
  } catch (err) {
    checks.walletKeyVersions = { error: String(err), healthy: false }
  }

  // ── Overall Health ───────────────────────────────────────────
  const allHealthy = Object.values(checks).every(
    (check) => typeof check === 'object' && check !== null && 'healthy' in check && check.healthy
  )

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    healthy: allHealthy,
    checks,
  })
}
