/**
 * GET /api/cron/match-cleanup
 *
 * Cleanup stale matches that are stuck in 'forming' status.
 * Runs every 5 minutes via Vercel Cron.
 *
 * Criteria:
 * - status = 'forming'
 * - created_at > 5 minutes ago
 * - no player_b
 *
 * Action:
 * - Unlock player_a funds
 * - Set status = 'expired'
 * - Log to audit_log
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

const CRON_SECRET = process.env.CRON_SECRET!
const MATCH_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes

export async function GET(req: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = req.headers.get('Authorization')
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[Match Cleanup Cron] Starting cleanup run')

    // Find stale forming matches
    const cutoffTime = new Date(Date.now() - MATCH_TIMEOUT_MS).toISOString()
    
    const { data: staleMatches, error: fetchError } = await supabaseAdmin
      .from('matches')
      .select('id, player_a_id, entry_fee_sol, room_id, created_at')
      .eq('status', 'forming')
      .is('player_b_id', null)
      .lt('created_at', cutoffTime)

    if (fetchError) {
      console.error('[Match Cleanup] Query error:', fetchError)
      return NextResponse.json({ error: 'Failed to query matches' }, { status: 500 })
    }

    if (!staleMatches || staleMatches.length === 0) {
      console.log('[Match Cleanup] No stale matches found')
      return NextResponse.json({ cleaned: 0 })
    }

    console.log(`[Match Cleanup] Found ${staleMatches.length} stale matches`)

    let cleaned = 0
    let failed = 0

    for (const match of staleMatches) {
      try {
        // Unlock funds
        const { data: unlockResult, error: unlockError } = await supabaseAdmin.rpc(
          'unlock_player_funds',
          {
            p_user_id: match.player_a_id,
            p_amount: match.entry_fee_sol,
          }
        )

        if (unlockError || !unlockResult?.success) {
          console.error('[Match Cleanup] Failed to unlock funds for match:', match.id, unlockError)
          failed++
          continue
        }

        // Update match status
        await supabaseAdmin
          .from('matches')
          .update({
            status: 'expired',
            error_message: 'Match expired - no opponent found within 5 minutes',
            updated_at: new Date().toISOString(),
          })
          .eq('id', match.id)

        // Audit log
        await supabaseAdmin.from('audit_log').insert({
          user_id: match.player_a_id,
          match_id: match.id,
          event_type: 'match_expired_refund',
          amount_sol: match.entry_fee_sol,
          metadata: {
            reason: 'no_opponent_timeout',
            room_id: match.room_id,
            created_at: match.created_at,
          },
        })

        console.log('[Match Cleanup] Cleaned up match:', match.id)
        cleaned++
      } catch (err) {
        console.error('[Match Cleanup] Error processing match:', match.id, err)
        failed++
      }
    }

    console.log(`[Match Cleanup] Complete: ${cleaned} cleaned, ${failed} failed`)

    return NextResponse.json({
      cleaned,
      failed,
      total: staleMatches.length,
    })
  } catch (err) {
    console.error('[Match Cleanup] Unexpected error:', err)
    return NextResponse.json({ error: 'Cleanup failed' }, { status: 500 })
  }
}
