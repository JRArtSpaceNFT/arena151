/**
 * GET  /api/match/queue?roomId=X   — Find the oldest open `forming` match in a room (not owned by caller)
 * POST /api/match/queue            — P1 enqueues: create a match record with status `forming`
 *
 * Security:
 * - Auth required (Bearer JWT) for both
 * - GET: cannot return your own match (filtered by player_a_id != userId)
 * - POST: identical fund-lock logic as /api/match/create
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

const supabaseAnon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ── GET /api/match/queue?roomId=X ────────────────────────────────────────────
// Returns the oldest open `forming` match in the room that doesn't belong to the caller.
// Used by P2 to discover a match to join.
export async function GET(req: NextRequest) {
  try {
    // Auth
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const token = authHeader.slice(7)
    const { data: { user: authUser }, error: authError } = await supabaseAnon.auth.getUser(token)
    if (authError || !authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const roomId = req.nextUrl.searchParams.get('roomId')
    if (!roomId) {
      return NextResponse.json({ error: 'roomId query param required' }, { status: 400 })
    }

    const userId = authUser.id

    // Find oldest forming match in this room not owned by the caller
    const { data: match, error: matchError } = await supabaseAdmin
      .from('matches')
      .select('id, entry_fee_sol')
      .eq('room_id', roomId)
      .eq('status', 'forming')
      .is('player_b_id', null)
      .neq('player_a_id', userId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (matchError) {
      console.error('[Queue GET] query error:', matchError)
      return NextResponse.json({ error: 'Failed to query queue' }, { status: 500 })
    }

    if (!match) {
      return NextResponse.json({ matchId: null })
    }

    return NextResponse.json({
      matchId: match.id,
      entryFeeSol: match.entry_fee_sol,
    })

  } catch (err) {
    console.error('[Queue GET] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ── POST /api/match/queue ────────────────────────────────────────────────────
// P1 enqueues: creates a match record (status: forming) and locks funds.
// Mirrors /api/match/create logic.
export async function POST(req: NextRequest) {
  try {
    // Auth
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const token = authHeader.slice(7)
    const { data: { user: authUser }, error: authError } = await supabaseAnon.auth.getUser(token)
    if (authError || !authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse body
    const { roomId, entryFeeSol, teamA } = await req.json()

    if (!roomId || typeof entryFeeSol !== 'number' || entryFeeSol <= 0) {
      return NextResponse.json(
        { error: 'Missing or invalid fields: roomId, entryFeeSol required' },
        { status: 400 }
      )
    }

    if (entryFeeSol > 10) {
      return NextResponse.json(
        { error: 'Entry fee exceeds maximum (10 SOL)' },
        { status: 400 }
      )
    }

    const userId = authUser.id

    // ── Idempotency: return existing active match if one exists ──
    // If the user already has a forming match in this room (e.g. from a refresh),
    // return it immediately instead of creating a duplicate and locking funds again.
    // This prevents double-lock on page refresh or remount.
    const { data: existingMatch } = await supabaseAdmin
      .from('matches')
      .select('id, battle_seed, entry_fee_sol, team_a')
      .eq('player_a_id', userId)
      .eq('room_id', roomId)
      .eq('status', 'forming')
      .is('player_b_id', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existingMatch) {
      console.log('[Queue POST] Returning existing forming match for user:', userId, 'matchId:', existingMatch.id)
      return NextResponse.json({
        matchId: existingMatch.id,
        idempotencyKey: existingMatch.id, // reuse matchId as key
        battleSeed: existingMatch.battle_seed,
        status: 'forming',
        teamA: existingMatch.team_a,
        resumed: true,  // flag so client knows this is a resumed match
      })
    }

    // ── Also check for settlement_pending matches (P2 already joined) ──
    // If user refreshed after P2 joined, resume settlement instead of creating new match.
    const { data: pendingMatch } = await supabaseAdmin
      .from('matches')
      .select('id, battle_seed, entry_fee_sol, team_a, team_b, winner_id, player_b_id')
      .eq('player_a_id', userId)
      .eq('room_id', roomId)
      .eq('status', 'settlement_pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (pendingMatch) {
      console.log('[Queue POST] Resuming settlement_pending match:', pendingMatch.id)
      return NextResponse.json({
        matchId: pendingMatch.id,
        idempotencyKey: pendingMatch.id,
        battleSeed: pendingMatch.battle_seed,
        status: 'settlement_pending',
        teamA: pendingMatch.team_a,
        teamB: pendingMatch.team_b,
        winnerId: pendingMatch.winner_id,
        resumed: true,
      })
    }

    // ── Atomic fund lock (TOCTOU-safe: single SQL statement with WHERE guard)
    const { data: lockData, error: lockError } = await supabaseAdmin.rpc('lock_player_funds', {
      p_user_id: userId,
      p_amount: entryFeeSol,
    })

    if (lockError) {
      console.error('[Queue POST] lock_player_funds error:', lockError)
      return NextResponse.json({ error: 'Failed to lock funds' }, { status: 500 })
    }

    if (!lockData?.success) {
      return NextResponse.json(
        { error: 'Insufficient available balance', code: 'INSUFFICIENT_FUNDS' },
        { status: 400 }
      )
    }

    // Create match record with status `forming`
    const idempotencyKey = randomUUID()
    const matchId = randomUUID()
    const battleSeed = randomUUID()

    const { error: matchError } = await supabaseAdmin
      .from('matches')
      .insert({
        id: matchId,
        player_a_id: userId,
        player_b_id: null,
        entry_fee_sol: entryFeeSol,
        status: 'forming',
        room_id: roomId,
        team_a: teamA ?? null,
        team_b: null,
        idempotency_key: idempotencyKey,
        battle_seed: battleSeed,
      })

    if (matchError) {
      // Rollback the fund lock
      await supabaseAdmin.rpc('unlock_player_funds', { p_user_id: userId, p_amount: entryFeeSol })
      console.error('[Queue POST] insert error:', matchError)
      return NextResponse.json({ error: 'Failed to create match' }, { status: 500 })
    }

    // Audit log
    await supabaseAdmin.from('audit_log').insert({
      user_id: userId,
      match_id: matchId,
      event_type: 'wager_locked',
      amount_sol: entryFeeSol,
      balance_before: lockData.balance_before,
      balance_after: lockData.balance_after,
      metadata: { room_id: roomId, idempotency_key: idempotencyKey, source: 'queue' },
    })

    return NextResponse.json({ matchId, idempotencyKey, battleSeed, status: 'forming' })

  } catch (err) {
    console.error('[Queue POST] Unexpected error:', err)
    return NextResponse.json({ error: 'Failed to create match' }, { status: 500 })
  }
}
