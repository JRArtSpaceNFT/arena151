/**
 * GET /api/admin/audit-log
 * 
 * Query audit log with filters.
 * Read-only endpoint for admin dashboard.
 * 
 * Query params:
 * - limit: max results (default 100)
 * - offset: pagination offset
 * - userId: filter by user
 * - matchId: filter by match
 * - eventType: filter by event type
 * - startDate: ISO timestamp (from)
 * - endDate: ISO timestamp (to)
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
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '100'), 500)
  const offset = parseInt(url.searchParams.get('offset') ?? '0')
  const userId = url.searchParams.get('userId')
  const matchId = url.searchParams.get('matchId')
  const eventType = url.searchParams.get('eventType')
  const startDate = url.searchParams.get('startDate')
  const endDate = url.searchParams.get('endDate')

  // ── Build query ──────────────────────────────────────────────
  let query = supabaseAdmin
    .from('audit_log')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (userId) query = query.eq('user_id', userId)
  if (matchId) query = query.eq('match_id', matchId)
  if (eventType) query = query.eq('event_type', eventType)
  if (startDate) query = query.gte('created_at', startDate)
  if (endDate) query = query.lte('created_at', endDate)

  const { data, error, count } = await query

  if (error) {
    console.error('[Admin Audit Log] Query error:', error)
    return NextResponse.json({ error: 'Failed to load audit log' }, { status: 500 })
  }

  return NextResponse.json({
    logs: data,
    total: count,
    limit,
    offset,
    filters: { userId, matchId, eventType, startDate, endDate },
  })
}
