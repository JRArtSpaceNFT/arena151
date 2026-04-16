/**
 * GET /api/admin/stuck-matches
 *
 * Admin endpoint to view all stuck matches
 * Returns matches that are likely in bad states
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

const ADMIN_SECRET = process.env.ADMIN_SECRET!

export async function GET(req: NextRequest) {
  try {
    // Verify admin secret
    const authHeader = req.headers.get('Authorization')
    if (authHeader !== `Bearer ${ADMIN_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString()
    const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000).toISOString()

    // Find stuck matches
    const { data: stuckForming } = await supabaseAdmin
      .from('matches')
      .select('id, player_a_id, room_id, status, entry_fee_sol, created_at, updated_at')
      .eq('status', 'forming')
      .lt('created_at', fiveMinAgo)

    const { data: stuckReady } = await supabaseAdmin
      .from('matches')
      .select('id, player_a_id, player_b_id, room_id, status, entry_fee_sol, created_at, updated_at')
      .eq('status', 'ready')
      .lt('created_at', oneHourAgo)

    const { data: stuckSettlement } = await supabaseAdmin
      .from('matches')
      .select('id, player_a_id, player_b_id, winner_id, status, entry_fee_sol, created_at, updated_at')
      .eq('status', 'settlement_pending')
      .lt('updated_at', oneHourAgo)

    const { data: failedSettlements } = await supabaseAdmin
      .from('matches')
      .select('id, player_a_id, player_b_id, winner_id, status, entry_fee_sol, error_message, created_at, updated_at')
      .eq('status', 'settlement_failed')

    const { data: failedUnlocks } = await supabaseAdmin
      .from('audit_log')
      .select('*')
      .eq('event_type', 'unlock_failed_after_join_race')
      .gte('created_at', oneHourAgo)

    return NextResponse.json({
      stuck_forming: stuckForming || [],
      stuck_ready: stuckReady || [],
      stuck_settlement: stuckSettlement || [],
      failed_settlements: failedSettlements || [],
      failed_unlocks: failedUnlocks || [],
      generated_at: now.toISOString(),
    })
  } catch (err) {
    console.error('[Admin Stuck Matches] Error:', err)
    return NextResponse.json({ error: 'Failed to fetch stuck matches' }, { status: 500 })
  }
}
