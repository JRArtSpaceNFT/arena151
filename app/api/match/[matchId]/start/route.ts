/**
 * POST /api/match/[matchId]/start
 *
 * Transitions match from 'ready'/'funds_locked' → 'battling'.
 * Returns match details so client can start the battle.
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

export async function POST(
  req: NextRequest,
  { params: _params }: { params: Promise<{ matchId: string }> }
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

    const { matchId } = await _params
    const userId = authUser.id

    // ── Load match ───────────────────────────────────────────────
    const { data: match, error: matchError } = await supabaseAdmin
      .from('matches')
      .select('id, player_a_id, player_b_id, entry_fee_sol, status, team_a, team_b, room_id, battle_seed')
      .eq('id', matchId)
      .single()

    if (matchError || !match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 })
    }

    // Must be one of the two players
    if (match.player_a_id !== userId && match.player_b_id !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (!['ready', 'funds_locked'].includes(match.status)) {
      return NextResponse.json({ error: `Match cannot be started (status: ${match.status})` }, { status: 409 })
    }

    // ── Transition to 'battling' ─────────────────────────────────
    const { error: updateError } = await supabaseAdmin
      .from('matches')
      .update({ status: 'battling', updated_at: new Date().toISOString() })
      .eq('id', matchId)
      .in('status', ['ready', 'funds_locked'])  // Guard: only if valid pre-battle status

    if (updateError) {
      console.error('[Match Start] update error:', updateError)
      return NextResponse.json({ error: 'Failed to start match' }, { status: 500 })
    }

    return NextResponse.json({
      matchId,
      status: 'battling',
      playerAId: match.player_a_id,
      playerBId: match.player_b_id,
      entryFeeSol: match.entry_fee_sol,
      roomId: match.room_id,
      teamA: match.team_a,
      teamB: match.team_b,
      battleSeed: match.battle_seed,
    })

  } catch (err) {
    console.error('[Match Start] Unexpected error:', err)
    return NextResponse.json({ error: 'Failed to start match' }, { status: 500 })
  }
}
