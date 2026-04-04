/**
 * GET /api/admin/matches
 *
 * Admin dashboard feed — list matches by status with player info and audit summary.
 * Use this to monitor manual_review, settlement_failed, and stuck matches.
 *
 * Query params:
 *   status   — filter by match status (default: manual_review,settlement_failed)
 *   limit    — max results (default: 50)
 *   offset   — pagination offset
 *
 * Auth: x-admin-token header matching ADMIN_SECRET
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
  const adminToken    = req.headers.get('x-admin-token') ?? ''
  const expectedToken = process.env.ADMIN_SECRET ?? ''
  let authorized = false
  try {
    const a = Buffer.from(adminToken)
    const b = Buffer.from(expectedToken)
    authorized = a.length > 0 && a.length === b.length && timingSafeEqual(a, b)
  } catch { authorized = false }
  if (!authorized) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url    = new URL(req.url)
  const status = url.searchParams.get('status') ?? 'manual_review,settlement_failed'
  const limit  = Math.min(parseInt(url.searchParams.get('limit') ?? '50'), 200)
  const offset = parseInt(url.searchParams.get('offset') ?? '0')

  const statuses = status.split(',').map(s => s.trim())

  const { data: matches, error, count } = await supabaseAdmin
    .from('matches')
    .select(`
      id, status, entry_fee_sol, winner_id, settlement_tx,
      player_a_id, player_b_id, error_message,
      retry_count, result_claim_a, result_claim_b,
      created_at, updated_at
    `, { count: 'exact' })
    .in('status', statuses)
    .order('updated_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ total: count, matches, statuses, limit, offset })
}
