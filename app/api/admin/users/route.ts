/**
 * GET /api/admin/users
 * 
 * List all users with balance, wallet, and activity info.
 * Read-only endpoint for admin dashboard.
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

  // ── Query params ─────────────────────────────────────────────
  const url = new URL(req.url)
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50'), 200)
  const offset = parseInt(url.searchParams.get('offset') ?? '0')
  const search = url.searchParams.get('search') ?? ''

  // ── Load users ───────────────────────────────────────────────
  let query = supabaseAdmin
    .from('profiles')
    .select(`
      id,
      username,
      email,
      balance,
      locked_balance,
      earnings,
      wins,
      losses,
      sol_address,
      first_withdrawal_at,
      joined_date,
      key_version
    `, { count: 'exact' })
    .order('joined_date', { ascending: false })
    .range(offset, offset + limit - 1)

  if (search) {
    query = query.or(`username.ilike.%${search}%,email.ilike.%${search}%`)
  }

  const { data: users, error, count } = await query

  if (error) {
    console.error('[Admin Users] Query error:', error)
    return NextResponse.json({ error: 'Failed to load users' }, { status: 500 })
  }

  // ── Sanitize: remove encrypted_private_key ──────────────────
  // Never expose private keys in admin dashboard
  const sanitized = users?.map(u => ({
    ...u,
    available_balance: Number(u.balance) - Number(u.locked_balance),
  }))

  return NextResponse.json({
    users: sanitized,
    total: count,
    limit,
    offset,
  })
}
