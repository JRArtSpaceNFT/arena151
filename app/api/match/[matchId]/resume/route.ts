/**
 * GET /api/match/[matchId]/resume
 *
 * Called when a player refreshes mid-match and needs to re-enter the correct phase.
 * Returns everything needed to resume without re-calling join or create.
 *
 * Response:
 *   myRole:      'player_a' | 'player_b'
 *   status:      match status
 *   battleSeed:  shared seed
 *   teamA:       player_a's team IDs
 *   teamB:       player_b's team IDs (null if not yet joined)
 *   winnerId:    server-computed winner (null if not yet settled)
 *   entryFeeSol: wager amount
 *   resumePhase: 'waiting_p2' | 'battle_ready' | 'settled' | 'abandoned'
 *
 * resumePhase tells the client exactly where to resume:
 *   waiting_p2    → P1 should return to ArenaReveal and wait for P2
 *   battle_ready  → both joined; compute canonical battle and go to battle screen
 *   settled       → match already settled; show result
 *   abandoned     → match voided/refunded; show error
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
  { params }: { params: Promise<{ matchId: string }> }
) {
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { data: { user }, error: authErr } = await supabaseAnon.auth.getUser(authHeader.slice(7))
    if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { matchId } = await params

    const { data: match, error } = await supabaseAdmin
      .from('matches')
      .select('id, player_a_id, player_b_id, status, battle_seed, team_a, team_b, winner_id, entry_fee_sol, settlement_tx')
      .eq('id', matchId)
      .single()

    if (error || !match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 })
    }

    // Caller must be one of the two players
    const isPlayerA = match.player_a_id === user.id
    const isPlayerB = match.player_b_id === user.id
    if (!isPlayerA && !isPlayerB) {
      return NextResponse.json({ error: 'You are not a player in this match' }, { status: 403 })
    }

    const myRole = isPlayerA ? 'player_a' : 'player_b'

    // Determine resume phase
    let resumePhase: string
    if (['voided', 'refunded', 'manual_review', 'settlement_failed'].includes(match.status)) {
      resumePhase = 'abandoned'
    } else if (match.status === 'settled') {
      resumePhase = 'settled'
    } else if (
      ['settlement_pending', 'settling', 'battling', 'result_pending', 'ready', 'funds_locked'].includes(match.status)
      && match.team_a && match.team_b
    ) {
      resumePhase = 'battle_ready'
    } else if (match.status === 'forming') {
      resumePhase = 'waiting_p2'
    } else {
      resumePhase = 'battle_ready' // default: attempt to proceed
    }

    return NextResponse.json({
      myRole,
      status:      match.status,
      battleSeed:  match.battle_seed,
      teamA:       match.team_a,
      teamB:       match.team_b,
      winnerId:    match.winner_id,
      entryFeeSol: Number(match.entry_fee_sol),
      settlementTx: match.settlement_tx,
      resumePhase,
      matchId:     match.id,
    })

  } catch (err) {
    console.error('[MatchResume] Unexpected error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
