/**
 * GET /api/match/[matchId]/status
 *
 * Poll endpoint for match state.
 * Auth required — must be a player in the match.
 * Safe to poll frequently; allows frontend to recover after disconnect/reconnect.
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

export async function GET(
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
      .select([
        'id', 'player_a_id', 'player_b_id', 'entry_fee_sol', 'status',
        'winner_id', 'settlement_tx', 'idempotency_key', 'error_message',
        'result_claim_a', 'result_claim_b',
        'result_submitted_at_a', 'result_submitted_at_b',
        'room_id', 'created_at', 'updated_at',
      ].join(', '))
      .eq('id', matchId)
      .single()

    if (matchError || !match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 })
    }

    // Must be a player in the match
    if (match.player_a_id !== userId && match.player_b_id !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json({
      matchId: match.id,
      status: match.status,
      playerAId: match.player_a_id,
      playerBId: match.player_b_id,
      entryFeeSol: match.entry_fee_sol,
      winnerId: match.winner_id ?? null,
      settlementTx: match.settlement_tx ?? null,
      errorMessage: match.error_message ?? null,
      myClaimSubmitted: userId === match.player_a_id
        ? !!match.result_claim_a
        : !!match.result_claim_b,
      opponentClaimSubmitted: userId === match.player_a_id
        ? !!match.result_claim_b
        : !!match.result_claim_a,
      roomId: match.room_id,
      createdAt: match.created_at,
      updatedAt: match.updated_at,
    })

  } catch (err) {
    console.error('[Match Status] Unexpected error:', err)
    return NextResponse.json({ error: 'Failed to fetch match status' }, { status: 500 })
  }
}
