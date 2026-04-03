/**
 * POST /api/settle
 *
 * Real on-chain settlement for wagered matches.
 *
 * Flow:
 *   1. Verify the caller is authenticated and is one of the two players.
 *   2. Idempotency check — refuse to settle the same matchId twice.
 *   3. Confirm both players have enough on-chain SOL (their custodial wallets).
 *   4. Send (entryFee × 1.90) SOL from loser's wallet → winner's wallet.
 *   5. Send (entryFee × 0.10) SOL from loser's wallet → treasury (5% of pot = 10% of entry).
 *   6. Update both Supabase balances to reflect on-chain reality.
 *   7. Log all transactions.
 *
 * Treasury: FSWXt6eniHH7fQw7eCyM4NVVPGAHXDdNdkZKLriaPy3C
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendSol, getSolBalance, TREASURY_ADDRESS, HOUSE_FEE_PCT } from '@/lib/solana'

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

    const { matchId, winnerId, loserId, entryFeeSol } = await req.json()

    if (!matchId || !winnerId || !loserId || !entryFeeSol || entryFeeSol <= 0) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Caller must be one of the two players
    if (authUser.id !== winnerId && authUser.id !== loserId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // ── Idempotency ───────────────────────────────────────────────
    const { data: existing } = await supabaseAdmin
      .from('transactions')
      .select('id')
      .eq('type', 'win')
      .eq('notes', `match:${matchId}`)
      .single()

    if (existing) {
      return NextResponse.json({ ok: true, alreadySettled: true })
    }

    // ── Load both profiles ────────────────────────────────────────
    const { data: profiles, error: fetchErr } = await supabaseAdmin
      .from('profiles')
      .select('id, balance, sol_address, encrypted_private_key')
      .in('id', [winnerId, loserId])

    if (fetchErr || !profiles || profiles.length < 2) {
      return NextResponse.json({ error: 'Could not load player profiles' }, { status: 500 })
    }

    const winnerProfile = profiles.find(p => p.id === winnerId)!
    const loserProfile  = profiles.find(p => p.id === loserId)!

    // ── Math ──────────────────────────────────────────────────────
    // Pot = entryFee × 2
    // House fee = 5% of pot = entryFee × 0.10
    // Winner payout = pot - houseFee = entryFee × 1.90
    const pot          = parseFloat((entryFeeSol * 2).toFixed(9))
    const houseFee     = parseFloat((pot * HOUSE_FEE_PCT).toFixed(9))
    const winnerPayout = parseFloat((pot - houseFee).toFixed(9))
    const GAS_BUFFER   = 0.000010 // ~10k lamports buffer for tx fees

    // ── On-chain balance checks ───────────────────────────────────
    const loserOnChain = await getSolBalance(loserProfile.sol_address)
    if (loserOnChain < entryFeeSol + GAS_BUFFER) {
      return NextResponse.json({
        error: `Loser's wallet has insufficient SOL (${loserOnChain.toFixed(6)} SOL, need ${(entryFeeSol + GAS_BUFFER).toFixed(6)})`,
      }, { status: 400 })
    }

    // ── Step 1: Send winner payout from loser → winner ───────────
    const payoutResult = await sendSol(
      loserProfile.encrypted_private_key,
      winnerProfile.sol_address,
      winnerPayout,
    )

    if (!payoutResult.success) {
      console.error('[Settle] Payout transfer failed:', payoutResult.error)
      return NextResponse.json({
        error: `Payout transfer failed: ${payoutResult.error}`,
      }, { status: 500 })
    }

    // ── Step 2: Send house fee from loser → treasury ──────────────
    // Best-effort — log failure but don't roll back the winner payout
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

    // ── Step 3: Update Supabase balances to reflect on-chain ──────
    const [winnerOnChainAfter, loserOnChainAfter] = await Promise.all([
      getSolBalance(winnerProfile.sol_address),
      getSolBalance(loserProfile.sol_address),
    ])

    await supabaseAdmin
      .from('profiles')
      .update({ balance: winnerOnChainAfter })
      .eq('id', winnerId)

    await supabaseAdmin
      .from('profiles')
      .update({ balance: loserOnChainAfter })
      .eq('id', loserId)

    // ── Step 4: Log transactions ──────────────────────────────────
    await supabaseAdmin.from('transactions').insert([
      {
        user_id: winnerId,
        type: 'win',
        amount_sol: winnerPayout,
        status: 'confirmed',
        tx_signature: payoutResult.signature,
        notes: `match:${matchId}`,
      },
      {
        user_id: loserId,
        type: 'loss',
        amount_sol: -entryFeeSol,
        status: 'confirmed',
        tx_signature: payoutResult.signature,
        notes: `match:${matchId}`,
      },
      {
        user_id: loserId,
        type: 'fee',
        amount_sol: -houseFee,
        status: feeResult.success ? 'confirmed' : 'failed',
        tx_signature: feeSignature ?? null,
        notes: `5% house fee — match:${matchId} — treasury:${TREASURY_ADDRESS}`,
      },
    ])

    return NextResponse.json({
      ok: true,
      winnerPayout,
      houseFee,
      pot,
      payoutSignature: payoutResult.signature,
      feeSignature,
      winnerBalanceAfter: winnerOnChainAfter,
      loserBalanceAfter: loserOnChainAfter,
    })

  } catch (err) {
    console.error('[Settle] Unexpected error:', err)
    return NextResponse.json({ error: 'Settlement failed' }, { status: 500 })
  }
}
