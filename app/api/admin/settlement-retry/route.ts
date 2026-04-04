/**
 * POST /api/admin/settlement-retry
 *
 * Finds all settlement_failed matches within the last 24 hours and retries
 * their on-chain SOL transfers. Designed to be called by a cron job or manually.
 *
 * Security: Requires Authorization: Bearer ${ADMIN_SECRET} header.
 *
 * Logic per failed match:
 * 1. If settlement_tx is already set → tx went through; mark as 'settled' and skip
 * 2. Attempt sendSol() again
 * 3. On success → call settle_match_db() RPC, mark as 'settled'
 * 4. On failure → increment retry_count, log to audit_log
 * 5. After 3 retries → add MANUAL_INTERVENTION_REQUIRED to error_message
 *
 * Returns a summary of retried matches.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendSol, TREASURY_ADDRESS, HOUSE_FEE_PCT } from '@/lib/solana'

const MAX_RETRIES = 3
const LOOKBACK_HOURS = 24

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export async function POST(req: NextRequest) {
  // ── Auth ─────────────────────────────────────────────────────
  // NOTE: Vercel strips the Authorization header at the edge.
  // We use x-admin-token instead.
  const adminToken = req.headers.get('x-admin-token') ?? req.headers.get('Authorization')?.replace('Bearer ', '') ?? ''
  const expectedToken = process.env.ADMIN_SECRET
  if (!expectedToken) {
    return NextResponse.json({ error: 'ADMIN_SECRET not configured' }, { status: 500 })
  }
  if (adminToken !== expectedToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Query settlement_failed matches within last 24h ───────────
  const cutoff = new Date(Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000).toISOString()

  const { data: failedMatches, error: queryError } = await supabaseAdmin
    .from('matches')
    .select('id, player_a_id, player_b_id, winner_id, entry_fee_sol, settlement_tx, retry_count, error_message')
    .eq('status', 'settlement_failed')
    .gte('created_at', cutoff)
    .order('created_at', { ascending: true })

  if (queryError) {
    console.error('[SettlementRetry] Query error:', queryError)
    return NextResponse.json({ error: 'Failed to query failed matches' }, { status: 500 })
  }

  const results: Array<{
    matchId: string
    action: 'already_settled' | 'retry_succeeded' | 'retry_failed' | 'max_retries_reached' | 'skipped'
    details?: string
  }> = []

  for (const match of failedMatches ?? []) {
    const matchId = match.id

    // ── Step 1: Check if tx already went through ─────────────
    if (match.settlement_tx) {
      // The on-chain transfer succeeded — just mark as settled in DB
      await supabaseAdmin
        .from('matches')
        .update({
          status: 'settled',
          updated_at: new Date().toISOString(),
        })
        .eq('id', matchId)

      await supabaseAdmin.from('audit_log').insert({
        match_id: matchId,
        event_type: 'settlement_recovered',
        metadata: {
          recovery_method: 'tx_already_set',
          settlement_tx: match.settlement_tx,
          note: 'settlement_tx was present but status was settlement_failed — corrected',
        },
      })

      results.push({ matchId, action: 'already_settled', details: `TX: ${match.settlement_tx}` })
      continue
    }

    // ── Step 2: Check retry count ──────────────────────────────
    const retryCount = match.retry_count ?? 0
    if (retryCount >= MAX_RETRIES) {
      const alreadyFlagged = (match.error_message ?? '').includes('MANUAL_INTERVENTION_REQUIRED')
      if (!alreadyFlagged) {
        await supabaseAdmin
          .from('matches')
          .update({
            error_message: `${match.error_message ?? ''} | MANUAL_INTERVENTION_REQUIRED after ${MAX_RETRIES} failed retries`,
            updated_at: new Date().toISOString(),
          })
          .eq('id', matchId)

        await supabaseAdmin.from('audit_log').insert({
          match_id: matchId,
          event_type: 'settlement_manual_required',
          metadata: { retry_count: retryCount, error_message: match.error_message },
        })
      }
      results.push({ matchId, action: 'max_retries_reached', details: `${retryCount} retries exhausted` })
      continue
    }

    // ── Step 3: Load player profiles ──────────────────────────
    if (!match.winner_id || !match.player_a_id || !match.player_b_id) {
      results.push({ matchId, action: 'skipped', details: 'Missing winner_id or player IDs' })
      continue
    }

    const winnerId = match.winner_id
    const loserId  = winnerId === match.player_a_id ? match.player_b_id : match.player_a_id

    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('id, balance, locked_balance, sol_address, encrypted_private_key')
      .in('id', [winnerId, loserId])

    if (profilesError || !profiles || profiles.length < 2) {
      await incrementRetry(matchId, retryCount, 'Could not load player profiles for retry')
      results.push({ matchId, action: 'retry_failed', details: 'Profile load error' })
      continue
    }

    const winnerProfile = profiles.find(p => p.id === winnerId)!
    const loserProfile  = profiles.find(p => p.id === loserId)!

    // ── Step 4: Calculate prize pool ──────────────────────────
    const entryFeeSol  = Number(match.entry_fee_sol)
    const pot          = parseFloat((entryFeeSol * 2).toFixed(9))
    const houseFee     = parseFloat((pot * HOUSE_FEE_PCT).toFixed(9))
    const winnerPayout = parseFloat((pot - houseFee).toFixed(9))

    // ── Step 5: Retry sendSol ─────────────────────────────────
    const payoutResult = await sendSol(
      loserProfile.encrypted_private_key,
      winnerProfile.sol_address,
      winnerPayout,
    )

    if (!payoutResult.success) {
      const errorMsg = `Retry ${retryCount + 1}/${MAX_RETRIES} failed: ${payoutResult.error}`
      await incrementRetry(matchId, retryCount, errorMsg)

      await supabaseAdmin.from('audit_log').insert({
        user_id: winnerId,
        match_id: matchId,
        event_type: 'settlement_retry_failed',
        amount_sol: winnerPayout,
        metadata: {
          retry_number: retryCount + 1,
          error: payoutResult.error,
        },
      })

      results.push({
        matchId,
        action: 'retry_failed',
        details: `Attempt ${retryCount + 1}/${MAX_RETRIES}: ${payoutResult.error}`,
      })
      continue
    }

    // ── Step 6: House fee (best-effort) ──────────────────────
    await sendSol(loserProfile.encrypted_private_key, TREASURY_ADDRESS, houseFee)

    // ── Step 7: DB settlement ─────────────────────────────────
    const { error: dbError } = await supabaseAdmin.rpc('settle_match_db', {
      p_match_id: matchId,
      p_winner_id: winnerId,
      p_loser_id: loserId,
      p_entry_fee: entryFeeSol,
      p_winner_payout: winnerPayout,
      p_settlement_tx: payoutResult.signature!,
    })

    if (dbError) {
      console.error('[SettlementRetry] DB settlement failed after on-chain success:', dbError)
      // On-chain succeeded — note the mismatch for manual reconciliation
      await supabaseAdmin.from('audit_log').insert({
        match_id: matchId,
        event_type: 'settlement_db_error',
        metadata: {
          error: dbError.message,
          settlement_tx: payoutResult.signature,
          note: 'CRITICAL: On-chain retry succeeded but DB update failed. Manual reconciliation required.',
        },
      })
    } else {
      // Full success
      await supabaseAdmin.from('audit_log').insert({
        user_id: winnerId,
        match_id: matchId,
        event_type: 'settlement_retry_succeeded',
        amount_sol: winnerPayout,
        metadata: {
          retry_number: retryCount + 1,
          settlement_tx: payoutResult.signature,
        },
      })
    }

    results.push({
      matchId,
      action: 'retry_succeeded',
      details: `TX: ${payoutResult.signature}, DB: ${dbError ? 'FAILED (manual required)' : 'ok'}`,
    })
  }

  const summary = {
    total: results.length,
    alreadySettled: results.filter(r => r.action === 'already_settled').length,
    succeeded: results.filter(r => r.action === 'retry_succeeded').length,
    failed: results.filter(r => r.action === 'retry_failed').length,
    maxRetriesReached: results.filter(r => r.action === 'max_retries_reached').length,
    skipped: results.filter(r => r.action === 'skipped').length,
    results,
  }

  console.log('[SettlementRetry] Summary:', JSON.stringify(summary, null, 2))
  return NextResponse.json(summary)
}

async function incrementRetry(matchId: string, currentCount: number, errorMsg: string): Promise<void> {
  await supabaseAdmin
    .from('matches')
    .update({
      retry_count: currentCount + 1,
      last_retry_at: new Date().toISOString(),
      error_message: errorMsg,
      updated_at: new Date().toISOString(),
    })
    .eq('id', matchId)
}
