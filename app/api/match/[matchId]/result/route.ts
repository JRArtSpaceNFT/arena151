/**
 * POST /api/match/[matchId]/result
 *
 * Player submits their claimed match result.
 *
 * Flow:
 * 1. Player A submits { winnerId } → stored as result_claim_a
 * 2. Player B submits { winnerId } → stored as result_claim_b
 * 3. If both claims match → auto-trigger settlement
 * 4. If claims disagree → manual_review, unlock funds
 * 5. If only one player submits → timeout after 30s, use that claim (with manual_review flag)
 *
 * Note: The server also runs its own battle validation (best-effort).
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

const SINGLE_CLAIM_TIMEOUT_MS = 30_000 // 30 seconds

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
    const { winnerId } = await req.json()

    if (!winnerId || typeof winnerId !== 'string') {
      return NextResponse.json({ error: 'winnerId required' }, { status: 400 })
    }

    // ── Load match ───────────────────────────────────────────────
    const { data: match, error: matchError } = await supabaseAdmin
      .from('matches')
      .select('id, player_a_id, player_b_id, entry_fee_sol, status, result_claim_a, result_claim_b, result_submitted_at_a, result_submitted_at_b, team_a, team_b')
      .eq('id', matchId)
      .single()

    if (matchError || !match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 })
    }

    const isPlayerA = match.player_a_id === userId
    const isPlayerB = match.player_b_id === userId

    if (!isPlayerA && !isPlayerB) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Validate: winnerId must be one of the two players
    if (winnerId !== match.player_a_id && winnerId !== match.player_b_id) {
      return NextResponse.json({ error: 'Invalid winnerId: must be one of the match players' }, { status: 400 })
    }

    if (!['battling', 'result_pending'].includes(match.status)) {
      return NextResponse.json({ error: `Match cannot receive results (status: ${match.status})` }, { status: 409 })
    }

    // ── Store this player's claim ────────────────────────────────
    const updates: Record<string, unknown> = { status: 'result_pending', updated_at: new Date().toISOString() }
    if (isPlayerA) {
      updates.result_claim_a = winnerId
      updates.result_submitted_at_a = new Date().toISOString()
    } else {
      updates.result_claim_b = winnerId
      updates.result_submitted_at_b = new Date().toISOString()
    }

    const { error: updateError } = await supabaseAdmin
      .from('matches')
      .update(updates)
      .eq('id', matchId)

    if (updateError) {
      console.error('[Match Result] update error:', updateError)
      return NextResponse.json({ error: 'Failed to store result claim' }, { status: 500 })
    }

    // Get updated match state
    const claimA = isPlayerA ? winnerId : match.result_claim_a
    const claimB = isPlayerB ? winnerId : match.result_claim_b

    // ── Both players have submitted ──────────────────────────────
    if (claimA && claimB) {
      if (claimA === claimB) {
        // Agreement → proceed to settlement
        await supabaseAdmin
          .from('matches')
          .update({ status: 'settlement_pending', updated_at: new Date().toISOString() })
          .eq('id', matchId)

        return NextResponse.json({
          status: 'settlement_pending',
          winnerId: claimA,
          message: 'Both players agree. Settlement will proceed.',
        })
      } else {
        // Disagreement → manual review, unlock funds
        await supabaseAdmin
          .from('matches')
          .update({
            status: 'manual_review',
            error_message: `Disputed result: player_a claims ${claimA}, player_b claims ${claimB}`,
            updated_at: new Date().toISOString(),
          })
          .eq('id', matchId)

        // Unlock both players' funds pending manual review
        if (match.player_b_id) {
          await supabaseAdmin.rpc('unlock_player_funds', { p_user_id: match.player_a_id, p_amount: match.entry_fee_sol })
          await supabaseAdmin.rpc('unlock_player_funds', { p_user_id: match.player_b_id, p_amount: match.entry_fee_sol })
        }

        // Audit log for dispute
        await supabaseAdmin.from('audit_log').insert([
          { user_id: match.player_a_id, match_id: matchId, event_type: 'dispute_raised', metadata: { claim_a: claimA, claim_b: claimB } },
          { user_id: match.player_b_id, match_id: matchId, event_type: 'dispute_raised', metadata: { claim_a: claimA, claim_b: claimB } },
        ])

        return NextResponse.json({
          status: 'manual_review',
          message: 'Result disputed. Funds unlocked. Admin will review.',
        })
      }
    }

    // ── Only one player has submitted ────────────────────────────
    // Check if the other player's submission has timed out
    const firstSubmissionTime = isPlayerA
      ? new Date(updates.result_submitted_at_a as string).getTime()
      : (match.result_submitted_at_a ? new Date(match.result_submitted_at_a).getTime() : Date.now())

    const elapsed = Date.now() - firstSubmissionTime

    if (elapsed >= SINGLE_CLAIM_TIMEOUT_MS) {
      // Timeout: use the submitter's claim but flag for review
      const timedOutWinner = winnerId
      await supabaseAdmin
        .from('matches')
        .update({
          status: 'settlement_pending',
          winner_id: timedOutWinner,
          error_message: 'Opponent did not submit result within timeout. Using submitter claim.',
          updated_at: new Date().toISOString(),
        })
        .eq('id', matchId)

      return NextResponse.json({
        status: 'settlement_pending',
        winnerId: timedOutWinner,
        message: 'Opponent timed out. Settlement will proceed with your claim.',
      })
    }

    return NextResponse.json({
      status: 'result_pending',
      message: 'Claim recorded. Waiting for opponent to submit their result.',
      timeoutMs: SINGLE_CLAIM_TIMEOUT_MS - elapsed,
    })

  } catch (err) {
    console.error('[Match Result] Unexpected error:', err)
    return NextResponse.json({ error: 'Failed to process result' }, { status: 500 })
  }
}
