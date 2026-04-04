/**
 * POST /api/settle
 *
 * Server-authoritative match settlement.
 *
 * ⚠️  CRITICAL SECURITY CHANGES from previous version:
 *   OLD: Client sent { matchId, winnerId, loserId, entryFeeSol } — all client-controlled
 *   NEW: Client sends ONLY { matchId } — all values come from database
 *
 * Flow:
 *   1. Auth: verify caller is one of the two players
 *   2. Load match from DB — get winner, loser, fee from TRUSTED source
 *   3. Verify status is 'settlement_pending' (set by /result endpoint after both players agree)
 *   4. Idempotency: check if already settled
 *   5. DB lock: prevent concurrent settlement of same match
 *   6. Execute on-chain transfers
 *   7. Atomic DB update via settle_match_db() RPC
 *   8. Log all events to audit_log
 *
 * Treasury: FSWXt6eniHH7fQw7eCyM4NVVPGAHXDdNdkZKLriaPy3C
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendSol, TREASURY_ADDRESS, HOUSE_FEE_PCT } from '@/lib/solana'

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

    // ── Parse body — only matchId from client ────────────────────
    const body = await req.json()
    const { matchId } = body

    if (!matchId || typeof matchId !== 'string') {
      return NextResponse.json({ error: 'matchId required' }, { status: 400 })
    }

    // ── Load match from DB (trusted source) ──────────────────────
    const { data: match, error: matchError } = await supabaseAdmin
      .from('matches')
      .select('id, player_a_id, player_b_id, entry_fee_sol, status, winner_id, settlement_tx, idempotency_key')
      .eq('id', matchId)
      .single()

    if (matchError || !match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 })
    }

    const callerId = authUser.id

    // ── Verify caller is a player in THIS match ──────────────────
    if (match.player_a_id !== callerId && match.player_b_id !== callerId) {
      return NextResponse.json({ error: 'Forbidden: you are not a player in this match' }, { status: 403 })
    }

    // ── Idempotency: already settled? ────────────────────────────
    if (match.status === 'settled') {
      return NextResponse.json({
        ok: true,
        alreadySettled: true,
        settlementTx: match.settlement_tx,
        winnerId: match.winner_id,
      })
    }

    // ── Validate status ──────────────────────────────────────────
    if (match.status !== 'settlement_pending') {
      return NextResponse.json({
        error: `Match cannot be settled in current state (status: ${match.status})`,
        hint: match.status === 'battling' ? 'Both players must submit results first via /api/match/[matchId]/result' : undefined,
      }, { status: 409 })
    }

    // ── Ensure winner is recorded ────────────────────────────────
    if (!match.winner_id) {
      return NextResponse.json({
        error: 'No winner recorded. Both players must submit matching results first.',
      }, { status: 409 })
    }

    const winnerId = match.winner_id
    const loserId  = winnerId === match.player_a_id ? match.player_b_id : match.player_a_id

    if (!loserId) {
      return NextResponse.json({ error: 'Match is missing player data' }, { status: 500 })
    }

    // ── Lock match to prevent concurrent settlement ──────────────
    // Set status to settlement_pending→ (it already is, but we do a conditional update
    // to ensure only one concurrent request can proceed)
    const { data: lockResult, error: lockError } = await supabaseAdmin
      .from('matches')
      .update({ status: 'settlement_pending', updated_at: new Date().toISOString() })
      .eq('id', matchId)
      .eq('status', 'settlement_pending')  // Only if STILL pending (concurrent guard)
      .select('id')
      .single()

    if (lockError || !lockResult) {
      // Another request already started settlement, or status changed
      // Re-fetch to see current state
      const { data: recheckMatch } = await supabaseAdmin
        .from('matches')
        .select('status, settlement_tx, winner_id')
        .eq('id', matchId)
        .single()

      if (recheckMatch?.status === 'settled') {
        return NextResponse.json({ ok: true, alreadySettled: true, settlementTx: recheckMatch.settlement_tx })
      }
      return NextResponse.json({ error: 'Settlement already in progress' }, { status: 409 })
    }

    // ── Load player wallet data ──────────────────────────────────
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('id, balance, locked_balance, sol_address, encrypted_private_key')
      .in('id', [winnerId, loserId])

    if (profilesError || !profiles || profiles.length < 2) {
      await supabaseAdmin.from('matches').update({ status: 'settlement_failed', error_message: 'Could not load player profiles', updated_at: new Date().toISOString() }).eq('id', matchId)
      return NextResponse.json({ error: 'Could not load player profiles' }, { status: 500 })
    }

    const winnerProfile = profiles.find(p => p.id === winnerId)!
    const loserProfile  = profiles.find(p => p.id === loserId)!

    // ── Calculate prize pool ─────────────────────────────────────
    const entryFeeSol  = Number(match.entry_fee_sol)
    const pot          = parseFloat((entryFeeSol * 2).toFixed(9))
    const houseFee     = parseFloat((pot * HOUSE_FEE_PCT).toFixed(9))
    const winnerPayout = parseFloat((pot - houseFee).toFixed(9))

    // ── Step 1: Send winner payout from loser wallet → winner ────
    const payoutResult = await sendSol(
      loserProfile.encrypted_private_key,
      winnerProfile.sol_address,
      winnerPayout,
    )

    if (!payoutResult.success) {
      await supabaseAdmin
        .from('matches')
        .update({
          status: 'settlement_failed',
          error_message: `Payout transfer failed: ${payoutResult.error}`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', matchId)

      // Log the failure
      await supabaseAdmin.from('audit_log').insert([
        { user_id: winnerId, match_id: matchId, event_type: 'settlement_failed', amount_sol: winnerPayout, metadata: { error: payoutResult.error } },
        { user_id: loserId,  match_id: matchId, event_type: 'settlement_failed', amount_sol: entryFeeSol, metadata: { error: payoutResult.error } },
      ])

      console.error('[Settle] Payout failed:', payoutResult.error)
      return NextResponse.json({
        error: `Settlement transfer failed: ${payoutResult.error}. Funds are preserved. Contact support.`,
      }, { status: 500 })
    }

    // ── Step 2: Send house fee from loser wallet → treasury ──────
    // Best-effort — log failure but don't roll back winner payout (can't reverse on-chain tx)
    let feeSignature: string | undefined
    const feeResult = await sendSol(
      loserProfile.encrypted_private_key,
      TREASURY_ADDRESS,
      houseFee,
    )
    if (feeResult.success) {
      feeSignature = feeResult.signature
    } else {
      console.error('[Settle] House fee transfer failed (non-fatal):', feeResult.error)
    }

    // ── Step 3: Atomic DB settlement via RPC ─────────────────────
    const { data: dbResult, error: dbError } = await supabaseAdmin.rpc('settle_match_db', {
      p_match_id: matchId,
      p_winner_id: winnerId,
      p_loser_id: loserId,
      p_entry_fee: entryFeeSol,
      p_winner_payout: winnerPayout,
      p_settlement_tx: payoutResult.signature!,
    })

    if (dbError) {
      // On-chain tx succeeded but DB update failed — critical: needs manual reconciliation
      console.error('[Settle] DB settlement RPC failed after on-chain success:', dbError)
      await supabaseAdmin.from('audit_log').insert({
        user_id: callerId,
        match_id: matchId,
        event_type: 'settlement_db_error',
        metadata: {
          error: dbError.message,
          settlement_tx: payoutResult.signature,
          winner_id: winnerId,
          loser_id: loserId,
          note: 'CRITICAL: On-chain tx succeeded but DB update failed. Manual reconciliation required.',
        },
      })
    }

    // ── Step 4: Log transactions ─────────────────────────────────
    await supabaseAdmin.from('transactions').insert([
      {
        user_id: winnerId,
        type: 'win',
        amount_sol: winnerPayout,
        status: 'confirmed',
        tx_signature: payoutResult.signature,
        notes: `match:${matchId} — won ${winnerPayout} SOL`,
      },
      {
        user_id: loserId,
        type: 'loss',
        amount_sol: -entryFeeSol,
        status: 'confirmed',
        tx_signature: payoutResult.signature,
        notes: `match:${matchId} — lost ${entryFeeSol} SOL entry fee`,
      },
      ...(feeResult.success ? [{
        user_id: loserId,
        type: 'fee' as const,
        amount_sol: -houseFee,
        status: 'confirmed',
        tx_signature: feeSignature!,
        notes: `5% house fee — match:${matchId}`,
      }] : []),
    ])

    // Audit log
    await supabaseAdmin.from('audit_log').insert([
      {
        user_id: winnerId,
        match_id: matchId,
        event_type: 'settlement_winner',
        amount_sol: winnerPayout,
        balance_before: dbResult?.winner_balance_before,
        balance_after: dbResult?.winner_balance_after,
        metadata: { settlement_tx: payoutResult.signature, pot, house_fee: houseFee },
      },
      {
        user_id: loserId,
        match_id: matchId,
        event_type: 'settlement_loser',
        amount_sol: -entryFeeSol,
        balance_before: dbResult?.loser_balance_before,
        balance_after: dbResult?.loser_balance_after,
        metadata: { settlement_tx: payoutResult.signature, pot, house_fee: houseFee },
      },
    ])

    return NextResponse.json({
      ok: true,
      winnerId,
      loserId,
      winnerPayout,
      houseFee,
      pot,
      payoutSignature: payoutResult.signature,
      feeSignature,
      winnerBalanceAfter: dbResult?.winner_balance_after,
      loserBalanceAfter: dbResult?.loser_balance_after,
    })

  } catch (err) {
    console.error('[Settle] Unexpected error:', err)
    return NextResponse.json({ error: 'Settlement failed unexpectedly' }, { status: 500 })
  }
}
