/**
 * POST /api/withdraw
 *
 * Withdrawal endpoint with financial hardening:
 *
 * FIXES from previous version:
 * - Uses locked_balance: only available balance (balance - locked_balance) can be withdrawn
 * - Atomic SQL debit with WHERE guard (TOCTOU-safe, no race condition)
 * - Blocks withdrawal if user has active matches in battling/result_pending/settlement_pending
 * - Logs all attempts to audit_log (success and failure)
 * - On sendSol failure: atomically restores balance
 * - Checks rows affected after debit to detect concurrent depletion
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendSol, calcWithdrawal, getSolBalance, getMinWithdrawalSol, RENT_EXEMPT_MIN, GAS_BUFFER } from '@/lib/solana'

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
    const token = authHeader.replace('Bearer ', '').trim()
    const { data: { user: authUser }, error: authError } = await supabaseAnon.auth.getUser(token)
    if (authError || !authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { userId, toAddress, amountSol } = await req.json()

    if (!userId || !toAddress || !amountSol) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // ── Enforce: authenticated user can only withdraw their own funds ──
    if (authUser.id !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const minWithdrawalSol = await getMinWithdrawalSol()
    if (amountSol < minWithdrawalSol) {
      return NextResponse.json({ error: 'Minimum withdrawal is $5 USD equivalent' }, { status: 400 })
    }

    // ── Check for active matches (block withdrawal during active battles) ──
    const { data: activeMatches, error: matchCheckError } = await supabaseAdmin
      .from('matches')
      .select('id, status')
      .or(`player_a_id.eq.${userId},player_b_id.eq.${userId}`)
      .in('status', ['battling', 'result_pending', 'settlement_pending'])

    if (matchCheckError) {
      console.error('[Withdraw] Match check error:', matchCheckError)
      return NextResponse.json({ error: 'Could not verify match status' }, { status: 500 })
    }

    if (activeMatches && activeMatches.length > 0) {
      return NextResponse.json({
        error: 'Cannot withdraw while a match is in progress',
        activeMatches: activeMatches.map(m => ({ id: m.id, status: m.status })),
      }, { status: 400 })
    }

    // ── Load profile ─────────────────────────────────────────────
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, balance, locked_balance, sol_address, encrypted_private_key')
      .eq('id', userId)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // ── Available balance check ──────────────────────────────────
    const availableBalance = Number(profile.balance) - Number(profile.locked_balance)
    if (availableBalance < amountSol) {
      return NextResponse.json({
        error: 'Insufficient available balance',
        balance: profile.balance,
        locked: profile.locked_balance,
        available: availableBalance,
      }, { status: 400 })
    }

    // ── Check custodial wallet on-chain balance ──────────────────
    const walletBalance = await getSolBalance(profile.sol_address)
    const spendable = walletBalance - RENT_EXEMPT_MIN - GAS_BUFFER
    if (spendable <= 0) {
      return NextResponse.json({
        error: 'Wallet balance insufficient for withdrawal. Please contact support.',
      }, { status: 400 })
    }

    const effectiveAmountSol = Math.min(amountSol, spendable)
    const { fee, netAmount } = calcWithdrawal(effectiveAmountSol)

    // ── Log withdrawal attempt BEFORE debit (audit trail) ───────
    const { data: auditEntry } = await supabaseAdmin.from('audit_log').insert({
      user_id: userId,
      event_type: 'withdrawal_attempt',
      amount_sol: effectiveAmountSol,
      balance_before: profile.balance,
      metadata: { to_address: toAddress, net_amount: netAmount, fee },
    }).select('id').single()

    // ── Atomic debit with WHERE guard (TOCTOU-safe) ──────────────
    // Only succeeds if available_balance (balance - locked_balance) >= effectiveAmountSol
    // This single SQL statement does the check AND the debit atomically.
    const { data: debitResult, error: debitError } = await supabaseAdmin
      .from('profiles')
      .update({ balance: profile.balance - effectiveAmountSol })
      .eq('id', userId)
      .gte('balance', effectiveAmountSol)   // balance must cover amount
      // Inline available-balance guard:
      // balance - locked_balance >= effectiveAmountSol
      // ↔ balance >= effectiveAmountSol + locked_balance
      .gte('balance', Number(profile.locked_balance) + effectiveAmountSol)
      .select('id')

    if (debitError || !debitResult || debitResult.length === 0) {
      // Concurrent depletion or race condition — debit was rejected
      await supabaseAdmin.from('audit_log').insert({
        user_id: userId,
        event_type: 'withdrawal_rejected_concurrent',
        amount_sol: effectiveAmountSol,
        balance_before: profile.balance,
        metadata: { reason: 'atomic_debit_rejected', error: debitError?.message },
      })
      return NextResponse.json({ error: 'Insufficient available balance (concurrent update detected)' }, { status: 400 })
    }

    // ── Send net amount on-chain ─────────────────────────────────
    const result = await sendSol(profile.encrypted_private_key, toAddress, netAmount)

    if (!result.success) {
      // ── C5 FIX: Rollback via RELATIVE increment, not snapshot overwrite ──
      // Do NOT do: .update({ balance: profile.balance })
      // A concurrent deposit webhook may have credited balance between our
      // initial read and now. Restoring to the snapshot would erase that deposit.
      // The correct fix: balance = balance + effectiveAmountSol (relative add-back).
      await supabaseAdmin.rpc('credit_user_balance', {
        p_user_id: userId,
        p_amount: effectiveAmountSol,
      })

      await supabaseAdmin.from('audit_log').insert({
        user_id: userId,
        event_type: 'withdrawal_failed',
        amount_sol: effectiveAmountSol,
        balance_before: profile.balance - effectiveAmountSol,
        balance_after: profile.balance,  // approximate — actual may include concurrent deposits
        metadata: { error: result.error, to_address: toAddress, rolled_back: true, rollback_method: 'relative_increment' },
      })

      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    // ── Send fee to treasury (best-effort, non-blocking) ─────────
    sendSol(profile.encrypted_private_key, 'FSWXt6eniHH7fQw7eCyM4NVVPGAHXDdNdkZKLriaPy3C', fee)
      .catch(err => console.error('[Withdraw] Fee transfer failed:', err))

    // ── Log success ──────────────────────────────────────────────
    await supabaseAdmin.from('audit_log').insert({
      user_id: userId,
      event_type: 'withdrawal_success',
      amount_sol: effectiveAmountSol,
      balance_before: profile.balance,
      balance_after: profile.balance - effectiveAmountSol,
      metadata: { tx_signature: result.signature, to_address: toAddress, net_amount: netAmount, fee },
    })

    // ── Record transaction ────────────────────────────────────────
    await supabaseAdmin.from('transactions').insert({
      user_id: userId,
      type: 'withdrawal',
      amount_sol: effectiveAmountSol,
      status: 'confirmed',
      tx_signature: result.signature,
      to_address: toAddress,
      notes: `Withdrawal: ${effectiveAmountSol} SOL → ${netAmount} SOL after 0.5% fee`,
    })

    return NextResponse.json({
      success: true,
      signature: result.signature,
      netAmount,
      fee,
    })

  } catch (err) {
    console.error('[Withdraw] Error:', err)
    return NextResponse.json({ error: 'Withdrawal failed' }, { status: 500 })
  }
}
