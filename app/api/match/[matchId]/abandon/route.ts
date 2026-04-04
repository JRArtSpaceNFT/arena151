/**
 * POST /api/match/[matchId]/abandon
 *
 * Handles abandoned or timed-out matches.
 * Can be called by either player or a background job.
 *
 * - forming/funds_locked/ready: refund both, void match
 * - battling > 10 min with no result: manual_review
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

const supabaseAnon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const BATTLE_TIMEOUT_MS = 10 * 60 * 1000 // 10 minutes

export async function POST(
  req: NextRequest,
  { params }: { params: { matchId: string } }
) {
  try {
    // ── Auth ─────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const token = authHeader.slice(7)
    const { data: { user: authUser }, error: authError } = await supabaseAnon.auth.getUser(token)
    if (authError || !authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { matchId } = params
    const userId = authUser.id

    // ── Load match ───────────────────────────────────────────────
    const { data: match, error: matchError } = await supabaseAdmin
      .from('matches')
      .select('id, player_a_id, player_b_id, entry_fee_sol, status, created_at, updated_at')
      .eq('id', matchId)
      .single()

    if (matchError || !match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 })
    }

    // Must be a player in the match
    const isPlayer = match.player_a_id === userId || match.player_b_id === userId
    if (!isPlayer) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const refundableStatuses = ['forming', 'funds_locked', 'ready']
    const battlingStatus = 'battling'

    if (refundableStatuses.includes(match.status)) {
      // ── Refund both players ──────────────────────────────────
      if (match.player_b_id) {
        await supabaseAdmin.rpc('refund_match_db', {
          p_match_id: match.id,
          p_player_a: match.player_a_id,
          p_player_b: match.player_b_id,
          p_amount: match.entry_fee_sol,
          p_reason: `Abandoned by ${userId} (status was: ${match.status})`,
        })
      } else {
        // Only P1 has locked funds
        await supabaseAdmin.rpc('unlock_player_funds', {
          p_user_id: match.player_a_id,
          p_amount: match.entry_fee_sol,
        })
        await supabaseAdmin.from('matches').update({
          status: 'voided',
          error_message: `Abandoned by ${userId} before opponent joined`,
          updated_at: new Date().toISOString(),
        }).eq('id', matchId)
      }

      // Audit log
      const players = [match.player_a_id, match.player_b_id].filter(Boolean)
      await supabaseAdmin.from('audit_log').insert(
        players.map(pid => ({
          user_id: pid,
          match_id: matchId,
          event_type: 'match_voided_refund',
          amount_sol: match.entry_fee_sol,
          metadata: { reason: 'match_abandoned', abandoned_by: userId },
        }))
      )

      return NextResponse.json({
        status: 'voided',
        refunded: true,
        refundedAmount: match.entry_fee_sol,
        message: 'Match abandoned. Funds unlocked.',
      })

    } else if (match.status === battlingStatus) {
      // Check timeout
      const lastUpdate = new Date(match.updated_at).getTime()
      const elapsed = Date.now() - lastUpdate

      if (elapsed >= BATTLE_TIMEOUT_MS) {
        await supabaseAdmin.from('matches').update({
          status: 'manual_review',
          error_message: `Battle timed out after ${Math.round(elapsed / 60000)} minutes`,
          updated_at: new Date().toISOString(),
        }).eq('id', matchId)

        await supabaseAdmin.from('audit_log').insert({
          user_id: userId,
          match_id: matchId,
          event_type: 'battle_timeout',
          metadata: { elapsed_ms: elapsed, triggered_by: userId },
        })

        return NextResponse.json({
          status: 'manual_review',
          message: 'Battle timed out. Admin will review and resolve.',
        })
      } else {
        return NextResponse.json({
          error: 'Battle is still in progress',
          timeRemainingMs: BATTLE_TIMEOUT_MS - elapsed,
        }, { status: 409 })
      }

    } else {
      return NextResponse.json({
        error: `Match cannot be abandoned in current state (status: ${match.status})`,
      }, { status: 409 })
    }

  } catch (err) {
    console.error('[Match Abandon] Unexpected error:', err)
    return NextResponse.json({ error: 'Failed to abandon match' }, { status: 500 })
  }
}
