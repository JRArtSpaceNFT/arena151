/**
 * POST /api/match/create
 *
 * Creates a server-side match record and atomically locks P1's wager funds.
 *
 * Security properties:
 * - Auth required (Bearer JWT)
 * - Available balance check BEFORE atomic debit
 * - Atomic SQL: locks funds only if balance is sufficient (1 query, 0 TOCTOU)
 * - Audit logged on success
 * - Returns matchId + idempotencyKey for client to use throughout match lifecycle
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

const supabaseAnon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: NextRequest) {
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

    // ── Parse body ───────────────────────────────────────────────
    const { roomId, entryFeeSol, teamA, teamB, opponentId } = await req.json()

    if (!roomId || typeof entryFeeSol !== 'number' || entryFeeSol <= 0) {
      return NextResponse.json({ error: 'Missing or invalid fields: roomId, entryFeeSol required' }, { status: 400 })
    }

    if (entryFeeSol > 10) {
      return NextResponse.json({ error: 'Entry fee exceeds maximum (10 SOL)' }, { status: 400 })
    }

    const userId = authUser.id

    // ── API Rate Limit: 10 match creations per 5 minutes ─────────
    const rateLimitKey = `match-create:${userId}`
    const rateLimit = checkRateLimit(rateLimitKey, RATE_LIMITS.MATCH_CREATE)

    if (!rateLimit.allowed) {
      return NextResponse.json({
        error: 'Rate limit exceeded. Please wait before creating another match.',
        code: 'RATE_LIMIT_EXCEEDED',
        remaining: rateLimit.remaining,
        resetMs: rateLimit.resetMs,
      }, { status: 429 })
    }

    // ── DB Limit: max 3 open 'forming' matches per user ──────────
    // Prevents spam-creating matches to lock up funds or clog matchmaking.
    // 'forming' = created but no opponent yet. Cap at 3 concurrent open matches.
    const { count: openCount, error: openMatchError } = await supabaseAdmin
      .from('matches')
      .select('*', { count: 'exact', head: true })
      .eq('player_a_id', userId)
      .eq('status', 'forming')

    if (openMatchError) {
      console.error('[Match Create] rate limit check error:', openMatchError)
      return NextResponse.json({ error: 'Failed to check open matches' }, { status: 500 })
    }

    if ((openCount ?? 0) >= 3) {
      return NextResponse.json({
        error: 'Too many open matches — cancel an existing match before creating a new one',
        code: 'RATE_LIMIT_FORMING_MATCHES',
        openCount,
      }, { status: 429 })
    }

    // ── Atomic fund lock ─────────────────────────────────────────
    // Single UPDATE with WHERE guard: only succeeds if available_balance >= entryFeeSol
    // available_balance = balance - locked_balance
    // This is TOCTOU-safe because the check and the write are in the same SQL statement.
    const { data: updateData, error: updateError } = await supabaseAdmin.rpc(
      'lock_player_funds',
      { p_user_id: userId, p_amount: entryFeeSol }
    )

    if (updateError) {
      console.error('[Match Create] lock_player_funds error:', updateError)
      return NextResponse.json({ error: 'Failed to lock funds' }, { status: 500 })
    }

    // RPC returns: { success: boolean, balance_before: number, balance_after: number }
    if (!updateData?.success) {
      return NextResponse.json({
        error: 'Insufficient available balance',
        code: 'INSUFFICIENT_FUNDS',
      }, { status: 400 })
    }

    // ── Create match record ──────────────────────────────────────
    const idempotencyKey = randomUUID()
    const matchId = randomUUID()
    // Deterministic battle seed: both client and server use this to run identical battles
    const battleSeed = randomUUID()

    const { error: matchError } = await supabaseAdmin
      .from('matches')
      .insert({
        id: matchId,
        player_a_id: userId,
        player_b_id: opponentId ?? null,
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
      console.error('[Match Create] insert error:', matchError)
      return NextResponse.json({ error: 'Failed to create match' }, { status: 500 })
    }

    // ── Audit log ────────────────────────────────────────────────
    await supabaseAdmin.from('audit_log').insert({
      user_id: userId,
      match_id: matchId,
      event_type: 'wager_locked',
      amount_sol: entryFeeSol,
      balance_before: updateData.balance_before,
      balance_after: updateData.balance_after,
      metadata: { room_id: roomId, idempotency_key: idempotencyKey },
    })

    return NextResponse.json({ matchId, idempotencyKey, battleSeed, status: 'forming', teamA: teamA ?? null })

  } catch (err) {
    console.error('[Match Create] Unexpected error:', err)
    return NextResponse.json({ error: 'Failed to create match' }, { status: 500 })
  }
}
