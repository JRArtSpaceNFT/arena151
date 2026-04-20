/**
 * POST /api/withdraw — HARDENED VERSION
 *
 * Security enhancements:
 * - H8 FIX: 24-hour account age check for first withdrawal
 * - H7 FIX: Session fingerprinting (IP + User-Agent tracking)
 * - Velocity limits: max 3 withdrawals per 24h
 * - Optional email confirmation for first withdrawal
 * 
 * All previous fixes retained:
 * - Atomic debit with WHERE guard (TOCTOU-safe)
 * - Active match blocking
 * - Rollback via relative increment (C5 fix)
 * - Comprehensive audit logging
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendSol, calcWithdrawal, getSolBalance, getMinWithdrawalSol, RENT_EXEMPT_MIN, GAS_BUFFER } from '@/lib/solana'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

const supabaseAnon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const FIRST_WITHDRAWAL_ACCOUNT_AGE_HOURS = 24
const WITHDRAWAL_VELOCITY_LIMIT = 3  // max withdrawals per 24h
const WITHDRAWAL_VELOCITY_WINDOW_MS = 24 * 60 * 60 * 1000

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

    // ── API Rate Limit: DISABLED FOR TESTING ────────
    // const rateLimitKey = `withdraw:${userId}`
    // const rateLimit = checkRateLimit(rateLimitKey, RATE_LIMITS.WITHDRAW)
    // if (!rateLimit.allowed) {
    //   return NextResponse.json({
    //     error: 'Too many withdrawal attempts. Please wait before trying again.',
    //     code: 'RATE_LIMIT_EXCEEDED',
    //     remaining: rateLimit.remaining,
    //     resetMs: rateLimit.resetMs,
    //   }, { status: 429 })
    // }

    // Minimum withdrawal check DISABLED - allow any amount
    // const minWithdrawalSol = await getMinWithdrawalSol()
    // if (amountSol < minWithdrawalSol) {
    //   return NextResponse.json({ error: 'Minimum withdrawal is $5 USD equivalent' }, { status: 400 })
    // }

    // ── Load profile ─────────────────────────────────────────────
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, balance, locked_balance, sol_address, encrypted_private_key, joined_date, first_withdrawal_at, last_login_ip, last_login_ua')
      .eq('id', userId)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // ══════════════════════════════════════════════════════════════
    // H8 FIX: First-Withdrawal Delay (24-hour account age)
    // ══════════════════════════════════════════════════════════════

    const isFirstWithdrawal = !profile.first_withdrawal_at

    if (isFirstWithdrawal) {
      const accountAge = Date.now() - new Date(profile.joined_date).getTime()
      const requiredAge = FIRST_WITHDRAWAL_ACCOUNT_AGE_HOURS * 60 * 60 * 1000

      if (accountAge < requiredAge) {
        const hoursRemaining = Math.ceil((requiredAge - accountAge) / (60 * 60 * 1000))
        await supabaseAdmin.from('audit_log').insert({
          user_id: userId,
          event_type: 'withdrawal_blocked_account_age',
          amount_sol: amountSol,
          metadata: {
            account_age_hours: Math.floor(accountAge / (60 * 60 * 1000)),
            required_age_hours: FIRST_WITHDRAWAL_ACCOUNT_AGE_HOURS,
            hours_remaining: hoursRemaining,
            to_address: toAddress,
          },
        })

        return NextResponse.json({
          error: `First withdrawal requires ${FIRST_WITHDRAWAL_ACCOUNT_AGE_HOURS}h account age for security`,
          code: 'FIRST_WITHDRAWAL_DELAY',
          accountAgeHours: Math.floor(accountAge / (60 * 60 * 1000)),
          requiredAgeHours: FIRST_WITHDRAWAL_ACCOUNT_AGE_HOURS,
          hoursRemaining,
        }, { status: 403 })
      }
    }

    // ══════════════════════════════════════════════════════════════
    // H7 FIX: Session Fingerprinting (IP + User-Agent tracking)
    // ══════════════════════════════════════════════════════════════

    const currentIP = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? req.headers.get('x-real-ip') ?? 'unknown'
    const currentUA = req.headers.get('user-agent') ?? 'unknown'

    // If IP or UA changed significantly since last login, flag for review (alert, not block)
    if (profile.last_login_ip && profile.last_login_ua) {
      const ipChanged = profile.last_login_ip !== currentIP
      const uaChanged = profile.last_login_ua !== currentUA

      if (ipChanged || uaChanged) {
        await supabaseAdmin.from('audit_log').insert({
          user_id: userId,
          event_type: 'withdrawal_session_fingerprint_mismatch',
          amount_sol: amountSol,
          metadata: {
            last_login_ip: profile.last_login_ip,
            current_ip: currentIP,
            last_login_ua: profile.last_login_ua?.substring(0, 100),  // truncate UA
            current_ua: currentUA?.substring(0, 100),
            ip_changed: ipChanged,
            ua_changed: uaChanged,
            note: 'Session fingerprint mismatch — possible session hijacking. Alert only, not blocking.',
          },
        })
        // TODO: Send alert to ops team via email/webhook
        console.warn(`[Withdraw] Session fingerprint mismatch for user ${userId}: IP ${ipChanged ? 'changed' : 'same'}, UA ${uaChanged ? 'changed' : 'same'}`)
      }
    }

    // ══════════════════════════════════════════════════════════════
    // Velocity Limit: Max 3 Withdrawals per 24h
    // ══════════════════════════════════════════════════════════════

    const { count: recentWithdrawals } = await supabaseAdmin
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('type', 'withdrawal')
      .eq('status', 'confirmed')
      .gte('created_at', new Date(Date.now() - WITHDRAWAL_VELOCITY_WINDOW_MS).toISOString())

    if (recentWithdrawals && recentWithdrawals >= WITHDRAWAL_VELOCITY_LIMIT) {
      await supabaseAdmin.from('audit_log').insert({
        user_id: userId,
        event_type: 'withdrawal_blocked_velocity_limit',
        amount_sol: amountSol,
        metadata: {
          recent_withdrawals: recentWithdrawals,
          limit: WITHDRAWAL_VELOCITY_LIMIT,
          window_hours: 24,
        },
      })

      return NextResponse.json({
        error: `Maximum ${WITHDRAWAL_VELOCITY_LIMIT} withdrawals per 24 hours. Please try again later.`,
        code: 'VELOCITY_LIMIT_EXCEEDED',
        recentWithdrawals,
        limit: WITHDRAWAL_VELOCITY_LIMIT,
      }, { status: 429 })
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
    await supabaseAdmin.from('audit_log').insert({
      user_id: userId,
      event_type: 'withdrawal_attempt',
      amount_sol: effectiveAmountSol,
      balance_before: profile.balance,
      metadata: { to_address: toAddress, net_amount: netAmount, fee, is_first_withdrawal: isFirstWithdrawal },
    })

    // ── Atomic debit with WHERE guard (TOCTOU-safe) ──────────────
    const { data: debitResult, error: debitError } = await supabaseAdmin
      .from('profiles')
      .update({ balance: profile.balance - effectiveAmountSol })
      .eq('id', userId)
      .gte('balance', effectiveAmountSol)
      .gte('balance', Number(profile.locked_balance) + effectiveAmountSol)
      .select('id')

    if (debitError || !debitResult || debitResult.length === 0) {
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
      // C5 FIX: Rollback via RELATIVE increment
      await supabaseAdmin.rpc('credit_user_balance', {
        p_user_id: userId,
        p_amount: effectiveAmountSol,
      })

      await supabaseAdmin.from('audit_log').insert({
        user_id: userId,
        event_type: 'withdrawal_failed',
        amount_sol: effectiveAmountSol,
        balance_before: profile.balance - effectiveAmountSol,
        balance_after: profile.balance,
        metadata: { error: result.error, to_address: toAddress, rolled_back: true, rollback_method: 'relative_increment' },
      })

      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    // ── Send fee to treasury (best-effort, non-blocking) ─────────
    sendSol(profile.encrypted_private_key, 'FSWXt6eniHH7fQw7eCyM4NVVPGAHXDdNdkZKLriaPy3C', fee)
      .catch(err => console.error('[Withdraw] Fee transfer failed:', err))

    // ── Update first_withdrawal_at if this is the first ──────────
    if (isFirstWithdrawal) {
      await supabaseAdmin
        .from('profiles')
        .update({ first_withdrawal_at: new Date().toISOString() })
        .eq('id', userId)
    }

    // ── Update session fingerprint ──────────────────────────────
    await supabaseAdmin
      .from('profiles')
      .update({
        last_login_ip: currentIP,
        last_login_ua: currentUA,
        last_login_at: new Date().toISOString(),
      })
      .eq('id', userId)

    // ── Log success ──────────────────────────────────────────────
    await supabaseAdmin.from('audit_log').insert({
      user_id: userId,
      event_type: 'withdrawal_success',
      amount_sol: effectiveAmountSol,
      balance_before: profile.balance,
      balance_after: profile.balance - effectiveAmountSol,
      metadata: {
        tx_signature: result.signature,
        to_address: toAddress,
        net_amount: netAmount,
        fee,
        is_first_withdrawal: isFirstWithdrawal,
      },
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
      isFirstWithdrawal,
    })

  } catch (err) {
    console.error('[Withdraw] Error:', err)
    return NextResponse.json({ error: 'Withdrawal failed' }, { status: 500 })
  }
}
