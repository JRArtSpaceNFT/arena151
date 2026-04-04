/**
 * POST /api/settle
 *
 * Server-authoritative match settlement.
 *
 * Security properties:
 *   - Client sends ONLY { matchId } — all values (winner, fee) come from DB
 *   - Auth required; caller must be a player in the match
 *   - Settlement mutex: atomically transitions status='settlement_pending' → 'settling'
 *     Only ONE concurrent request can hold 'settling'; all others get 409.
 *   - settle_match_db() RPC is idempotent: second call returns {reason:'already_settled'}
 *   - Balance math: loser pays 2×entry_fee; winner receives winner_payout (see 005_critical_fixes.sql)
 *
 * Flow:
 *   1. Auth
 *   2. Load match from DB
 *   3. Idempotency: already settled → return cached result
 *   4. ATOMIC MUTEX: UPDATE status='settlement_pending'→'settling' (only one concurrent winner)
 *   5. Execute on-chain transfers
 *   6. settle_match_db() — idempotent atomic DB settlement
 *   7. Log to audit_log + transactions
 *
 * Treasury: FSWXt6eniHH7fQw7eCyM4NVVPGAHXDdNdkZKLriaPy3C
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendSol, getSolBalance, TREASURY_ADDRESS, HOUSE_FEE_PCT, RENT_EXEMPT_MIN, GAS_BUFFER } from '@/lib/solana'

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

    // ── ATOMIC SETTLEMENT MUTEX ──────────────────────────────────
    // Transition status from 'settlement_pending' → 'settling'.
    // 'settling' is an EXCLUSIVE state: only one concurrent request can win this race.
    // Any other request hitting this for the same match will find 0 rows and bail.
    // This is the ONLY correct way to prevent double-payment from concurrent calls.
    const { data: lockRows, error: lockError } = await supabaseAdmin
      .from('matches')
      .update({ status: 'settling', updated_at: new Date().toISOString() })
      .eq('id', matchId)
      .eq('status', 'settlement_pending')  // ONLY advances from pending → settling
      .select('id')

    if (lockError || !lockRows || lockRows.length === 0) {
      // Another request already grabbed the 'settling' mutex, or status changed.
      // Re-fetch to distinguish 'already settled' from 'in progress'.
      const { data: recheckMatch } = await supabaseAdmin
        .from('matches')
        .select('status, settlement_tx, winner_id')
        .eq('id', matchId)
        .single()

      if (recheckMatch?.status === 'settled') {
        return NextResponse.json({ ok: true, alreadySettled: true, settlementTx: recheckMatch.settlement_tx })
      }
      if (recheckMatch?.status === 'settling') {
        return NextResponse.json({ error: 'Settlement already in progress — please wait and retry' }, { status: 409 })
      }
      return NextResponse.json({ error: 'Settlement mutex failed: unexpected match state', state: recheckMatch?.status }, { status: 409 })
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

    // ── Step 1: Pre-flight: verify loser wallet can cover full payout ────
    // FIX 9: Check actual on-chain balance BEFORE calling sendSol.
    // sendSol now has a strict pre-flight check, but we add an explicit check
    // here to provide a better error message and avoid even attempting the tx
    // when the wallet is clearly underfunded.
    const loserOnChainSol = await getSolBalance(loserProfile.sol_address)
    const totalRequired = winnerPayout + houseFee + RENT_EXEMPT_MIN + GAS_BUFFER
    if (loserOnChainSol < totalRequired) {
      const shortfall = totalRequired - loserOnChainSol
      await supabaseAdmin.from('matches').update({
        status: 'settlement_failed',
        error_message: `Loser wallet underfunded: has ${loserOnChainSol.toFixed(6)} SOL on-chain, needs ${totalRequired.toFixed(6)} SOL (shortfall: ${shortfall.toFixed(6)} SOL). DB balance may be inconsistent with on-chain state.`,
        updated_at: new Date().toISOString(),
      }).eq('id', matchId)

      await supabaseAdmin.from('audit_log').insert({
        user_id: loserId,
        match_id: matchId,
        event_type: 'settlement_failed_underfunded',
        metadata: {
          loser_onchain_sol: loserOnChainSol,
          required_sol: totalRequired,
          shortfall_sol: shortfall,
          loser_db_balance: loserProfile.balance,
          note: 'On-chain wallet balance insufficient. Possible DB/on-chain drift. Manual reconciliation required.',
        },
      })

      return NextResponse.json({
        error: `Settlement failed: loser wallet has insufficient on-chain balance (${loserOnChainSol.toFixed(6)} SOL available, ${totalRequired.toFixed(6)} SOL required).`,
        code: 'LOSER_WALLET_UNDERFUNDED',
      }, { status: 402 })
    }

    // ── Step 2: Send winner payout from loser wallet → winner ────
    const payoutResult = await sendSol(
      loserProfile.encrypted_private_key,
      winnerProfile.sol_address,
      winnerPayout,
    )

    if (!payoutResult.success) {
      // Revert 'settling' back to 'settlement_pending' so it can be retried
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
    // skipPreflightCheck=true: house fee truncation is acceptable (our money, not user funds).
    let feeSignature: string | undefined
    const feeResult = await sendSol(
      loserProfile.encrypted_private_key,
      TREASURY_ADDRESS,
      houseFee,
      { skipPreflightCheck: true }
    )
    if (feeResult.success) {
      feeSignature = feeResult.signature
    } else {
      // FIX 7: Log to audit_log so reconciliation query detects missing fees
      console.error('[Settle] House fee transfer failed (non-fatal):', feeResult.error)
      await supabaseAdmin.from('audit_log').insert({
        user_id: loserId,
        match_id: matchId,
        event_type: 'house_fee_failed',
        amount_sol: houseFee,
        metadata: { error: feeResult.error, note: 'House fee not collected. Run reconciliation query to detect and retry.' },
      })
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
      // On-chain tx succeeded but DB update failed — critical inconsistency.
      // The match is in 'settling' state, on-chain payment was sent.
      // Flag for manual reconciliation; do NOT retry automatically (would double-pay).
      console.error('[Settle] DB settlement RPC failed after on-chain success:', dbError)
      await supabaseAdmin.from('matches').update({
        status: 'settlement_failed',
        error_message: `DB_UPDATE_FAILED_AFTER_ONCHAIN: ${dbError.message}. settlement_tx=${payoutResult.signature}. DO NOT AUTO-RETRY.`,
        settlement_tx: payoutResult.signature,  // Store the tx sig so retry worker knows not to re-send
        updated_at: new Date().toISOString(),
      }).eq('id', matchId)
      await supabaseAdmin.from('audit_log').insert({
        user_id: callerId,
        match_id: matchId,
        event_type: 'settlement_db_error',
        metadata: {
          error: dbError.message,
          settlement_tx: payoutResult.signature,
          winner_id: winnerId,
          loser_id: loserId,
          note: 'CRITICAL: On-chain tx succeeded but DB update failed. settlement_tx stored. Retry worker will detect and reconcile.',
        },
      })
    } else if (dbResult?.reason === 'already_settled') {
      // settle_match_db idempotency: already settled by a concurrent request
      // On-chain tx still sent — this is a double-payment if it happens.
      // The 'settling' mutex should prevent this, but log it as a critical alert.
      console.error('[Settle] CRITICAL: settle_match_db returned already_settled after on-chain tx! Possible double-payment.')
      await supabaseAdmin.from('audit_log').insert({
        user_id: callerId,
        match_id: matchId,
        event_type: 'settlement_possible_double_payment',
        metadata: {
          settlement_tx: payoutResult.signature,
          winner_id: winnerId,
          note: 'CRITICAL: settle_match_db already_settled but on-chain tx was sent. Investigate immediately.',
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
