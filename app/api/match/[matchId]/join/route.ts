/**
 * POST /api/match/[matchId]/join
 *
 * Second player joins a match and locks their funds.
 *
 * Security properties:
 * - Auth required
 * - Validates match exists, is in 'forming' state
 * - Prevents joining own match
 * - Atomic fund lock (TOCTOU-safe)
 * - Updates match to 'funds_locked' then 'ready'
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
    const { teamB } = await req.json().catch(() => ({}))

    // ── Load match ───────────────────────────────────────────────
    const { data: match, error: matchError } = await supabaseAdmin
      .from('matches')
      .select('id, player_a_id, player_b_id, entry_fee_sol, status, battle_seed')
      .eq('id', matchId)
      .single()

    if (matchError || !match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 })
    }

    if (match.status !== 'forming') {
      return NextResponse.json({ error: `Match is not open for joining (status: ${match.status})` }, { status: 409 })
    }

    if (match.player_a_id === userId) {
      return NextResponse.json({ error: 'Cannot join your own match' }, { status: 400 })
    }

    if (match.player_b_id && match.player_b_id !== userId) {
      return NextResponse.json({ error: 'Match already has an opponent' }, { status: 409 })
    }

    // ── Atomic fund lock for P2 ──────────────────────────────────
    const { data: lockData, error: lockError } = await supabaseAdmin.rpc('lock_player_funds', {
      p_user_id: userId,
      p_amount: match.entry_fee_sol,
    })

    if (lockError) {
      console.error('[Match Join] lock_player_funds error:', lockError)
      return NextResponse.json({ error: 'Failed to lock funds' }, { status: 500 })
    }

    if (!lockData?.success) {
      return NextResponse.json({
        error: 'Insufficient available balance',
        code: 'INSUFFICIENT_FUNDS',
      }, { status: 400 })
    }

    // ── Update match: set player_b, status → ready ───────────────
    const { error: updateError } = await supabaseAdmin
      .from('matches')
      .update({
        player_b_id: userId,
        team_b: teamB ?? null,
        status: 'ready',
        updated_at: new Date().toISOString(),
      })
      .eq('id', matchId)
      .eq('status', 'forming')  // Extra guard: only update if still forming

    if (updateError) {
      // Rollback fund lock
      await supabaseAdmin.rpc('unlock_player_funds', { p_user_id: userId, p_amount: match.entry_fee_sol })
      console.error('[Match Join] update error:', updateError)
      return NextResponse.json({ error: 'Failed to join match' }, { status: 500 })
    }

    // ── Audit log for P2 ─────────────────────────────────────────
    await supabaseAdmin.from('audit_log').insert({
      user_id: userId,
      match_id: matchId,
      event_type: 'wager_locked',
      amount_sol: match.entry_fee_sol,
      balance_before: lockData.balance_before,
      balance_after: lockData.balance_after,
      metadata: { role: 'player_b' },
    })

    return NextResponse.json({ matchId, status: 'ready', battleSeed: (match as { battle_seed: string }).battle_seed })

  } catch (err) {
    console.error('[Match Join] Unexpected error:', err)
    return NextResponse.json({ error: 'Failed to join match' }, { status: 500 })
  }
}
