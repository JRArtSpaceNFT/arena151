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
import { runServerBattle } from '@/lib/engine/server-battle'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit'

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

    // ── API Rate Limit: 20 join attempts per 5 minutes ──────────
    const rateLimitKey = `match-join:${userId}`
    const rateLimit = checkRateLimit(rateLimitKey, RATE_LIMITS.MATCH_JOIN)

    if (!rateLimit.allowed) {
      return NextResponse.json({
        error: 'Rate limit exceeded. Please wait before joining another match.',
        code: 'RATE_LIMIT_EXCEEDED',
        remaining: rateLimit.remaining,
        resetMs: rateLimit.resetMs,
      }, { status: 429 })
    }

    // ── Load match ───────────────────────────────────────────────
    const { data: match, error: matchError } = await supabaseAdmin
      .from('matches')
      .select('id, player_a_id, player_b_id, entry_fee_sol, status, battle_seed, team_a')
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
    // C4 FIX: Check rows affected, NOT just updateError.
    // Supabase/PostgREST returns updateError=null when 0 rows match the WHERE clause.
    // If another player joined between our read and this write, we'd get 0 rows
    // with no error — and this player's funds would be locked with no match record.
    // We MUST detect 0 rows and unlock funds immediately.
    console.log('[Match Join] P2 attempting to join match:', { matchId, userId });
    
    const { data: updatedRows, error: updateError } = await supabaseAdmin
      .from('matches')
      .update({
        player_b_id: userId,
        team_b: teamB ?? null,
        status: 'ready',
        updated_at: new Date().toISOString(),
      })
      .eq('id', matchId)
      .eq('status', 'forming')  // Guard: only succeeds if match is STILL in 'forming'
      .select('id')             // Must select to detect 0 rows affected

    if (updateError || !updatedRows || updatedRows.length === 0) {
      // Funds were locked above — unlock them immediately in both error cases.
      // FIX 4: Check unlock return value — if unlock fails, log it for manual reconciliation.
      const unlockResult = await supabaseAdmin.rpc('unlock_player_funds', { p_user_id: userId, p_amount: match.entry_fee_sol })
      if (!unlockResult.data?.success) {
        console.error('[Match Join] CRITICAL: fund unlock failed after join race. User funds may be stuck.', { userId, matchId, unlockResult: unlockResult.data })
      }

      if (updateError) {
        console.error('[Match Join] update error:', updateError)
        return NextResponse.json({ error: 'Failed to join match' }, { status: 500 })
      }

      // 0 rows affected: another player won the race and joined this match first.
      // Funds have been unlocked above — return a clean error.
      console.log('[Match Join] Race condition: another P2 joined first. Funds unlocked for userId:', userId);
      return NextResponse.json(
        { error: 'Match is no longer available — another player joined first' },
        { status: 409 }
      )
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

    // ── Server computes winner immediately when P2 joins ─────────
    // No more player-submitted results. Server is authoritative.
    // Both teams are now known; run battle with shared seed → winner determined.
    const battleSeed = (match as { battle_seed: string }).battle_seed
    let serverWinnerId: string | null = null

    const teamAIds: number[] | null = Array.isArray(match.team_a)
      ? (match.team_a as number[])
      : null
    const teamBIds: number[] | null = Array.isArray(teamB)
      ? (teamB as number[])
      : null

    if (teamAIds && teamBIds && battleSeed) {
      try {
        const result = runServerBattle(
          teamAIds, teamBIds,
          match.player_a_id, userId,
          battleSeed
        )
        serverWinnerId = result.winnerId
        console.log('[Match Join] Server computed winner:', serverWinnerId)

        // Store winner + transition to settlement_pending immediately
        await supabaseAdmin.from('matches').update({
          team_b: teamBIds,
          winner_id: serverWinnerId,
          status: 'settlement_pending',
          updated_at: new Date().toISOString(),
        }).eq('id', matchId)

        await supabaseAdmin.from('audit_log').insert({
          user_id: userId,
          match_id: matchId,
          event_type: 'server_battle_computed',
          metadata: {
            winner_id: serverWinnerId,
            battle_seed: battleSeed,
            team_a: teamAIds,
            team_b: teamBIds,
          },
        })
      } catch (err) {
        console.error('[Match Join] Server battle computation failed:', err)
        // Fall back to ready status — result can still be submitted manually
        await supabaseAdmin.from('matches').update({
          team_b: teamBIds,
          status: 'ready',
          updated_at: new Date().toISOString(),
        }).eq('id', matchId)
      }
    }

    console.log('[Match Join] SUCCESS: P2 joined match:', { matchId, userId, status: serverWinnerId ? 'settlement_pending' : 'ready' });
    
    return NextResponse.json({
      matchId,
      status: serverWinnerId ? 'settlement_pending' : 'ready',
      battleSeed,
      winnerId: serverWinnerId,
      teamA: teamAIds,
      teamB: teamBIds ?? teamB,
    })

  } catch (err) {
    console.error('[Match Join] Unexpected error:', err)
    return NextResponse.json({ error: 'Failed to join match' }, { status: 500 })
  }
}
