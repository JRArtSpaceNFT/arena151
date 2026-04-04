/**
 * POST /api/admin/match/[matchId]/review
 *
 * Admin manual review endpoint for disputed / failed / stuck matches.
 *
 * Actions:
 *   settle_winner_a — force-settle with player_a as winner
 *   settle_winner_b — force-settle with player_b as winner
 *   refund_both     — refund both players, void match
 *   void            — void without refund (e.g. both cheated, already refunded externally)
 *
 * Security:
 *   - timingSafeEqual comparison on ADMIN_SECRET (M10 pattern)
 *   - All actions logged to audit_log with admin_note
 *   - settle actions include on-chain pre-flight check (Fix 9)
 *   - refund actions check unlock return value (Fix 4)
 *   - Cannot act on already-finalized matches
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { timingSafeEqual } from 'crypto'
import { sendSol, getSolBalance, TREASURY_ADDRESS, HOUSE_FEE_PCT, RENT_EXEMPT_MIN, GAS_BUFFER } from '@/lib/solana'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

type ReviewAction = 'settle_winner_a' | 'settle_winner_b' | 'refund_both' | 'void'
const VALID_ACTIONS: ReviewAction[] = ['settle_winner_a', 'settle_winner_b', 'refund_both', 'void']
const FINAL_STATUSES = ['settled', 'refunded', 'voided']

export async function POST(
  req: NextRequest,
  { params: _params }: { params: Promise<{ matchId: string }> }
) {
  try {
    // ── Admin auth (timing-safe) ─────────────────────────────────
    const adminToken   = req.headers.get('x-admin-token') ?? req.headers.get('x-admin-secret') ?? ''
    const expectedToken = process.env.ADMIN_SECRET ?? ''
    let authorized = false
    try {
      const a = Buffer.from(adminToken)
      const b = Buffer.from(expectedToken)
      authorized = a.length > 0 && a.length === b.length && timingSafeEqual(a, b)
    } catch { authorized = false }

    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { matchId } = await _params
    const body = await req.json() as { action: ReviewAction; reason?: string }
    const { action, reason } = body

    if (!VALID_ACTIONS.includes(action)) {
      return NextResponse.json({ error: `Invalid action. Must be one of: ${VALID_ACTIONS.join(', ')}` }, { status: 400 })
    }

    // ── Load match ───────────────────────────────────────────────
    const { data: match, error: matchError } = await supabaseAdmin
      .from('matches')
      .select('id, player_a_id, player_b_id, entry_fee_sol, status, winner_id, settlement_tx')
      .eq('id', matchId)
      .single()

    if (matchError || !match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 })
    }

    if (FINAL_STATUSES.includes(match.status)) {
      return NextResponse.json({ error: `Match already finalized (status: ${match.status})` }, { status: 409 })
    }

    const adminNote = reason ?? `Admin action: ${action} at ${new Date().toISOString()}`
    const entryFeeSol = Number(match.entry_fee_sol)

    // ── Load profiles ─────────────────────────────────────────────
    const playerIds = [match.player_a_id, match.player_b_id].filter(Boolean) as string[]
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, sol_address, encrypted_private_key, balance, locked_balance')
      .in('id', playerIds)

    const profileA = profiles?.find(p => p.id === match.player_a_id)
    const profileB = profiles?.find(p => p.id === match.player_b_id)

    // ════════════════════════════════════════════════════════════
    // settle_winner_a / settle_winner_b
    // ════════════════════════════════════════════════════════════
    if (action === 'settle_winner_a' || action === 'settle_winner_b') {
      const winnerId      = action === 'settle_winner_a' ? match.player_a_id : match.player_b_id
      const loserId       = action === 'settle_winner_a' ? match.player_b_id : match.player_a_id
      const winnerProfile = action === 'settle_winner_a' ? profileA : profileB
      const loserProfile  = action === 'settle_winner_a' ? profileB : profileA

      if (!winnerProfile || !loserProfile || !loserId) {
        return NextResponse.json({ error: 'Could not load player profiles' }, { status: 500 })
      }

      const pot          = entryFeeSol * 2
      const houseFee     = parseFloat((pot * HOUSE_FEE_PCT).toFixed(9))
      const winnerPayout = parseFloat((pot - houseFee).toFixed(9))

      // Fix 9: Pre-flight on-chain balance check
      const loserOnChain = await getSolBalance(loserProfile.sol_address)
      const totalRequired = winnerPayout + houseFee + RENT_EXEMPT_MIN + GAS_BUFFER
      if (loserOnChain < totalRequired) {
        return NextResponse.json({
          error: `Loser wallet underfunded: has ${loserOnChain.toFixed(6)} SOL, needs ${totalRequired.toFixed(6)} SOL`,
          code: 'LOSER_WALLET_UNDERFUNDED',
          loserOnChain, totalRequired,
        }, { status: 402 })
      }

      // Force match into settlement_pending so settle_match_db accepts it
      await supabaseAdmin.from('matches').update({
        status: 'settling',
        winner_id: winnerId,
        updated_at: new Date().toISOString(),
      }).eq('id', matchId)

      // On-chain payout
      const payoutResult = await sendSol(loserProfile.encrypted_private_key, winnerProfile.sol_address, winnerPayout)
      if (!payoutResult.success) {
        // Revert to manual_review
        await supabaseAdmin.from('matches').update({
          status: 'manual_review',
          error_message: `Admin settle failed on-chain: ${payoutResult.error}`,
          updated_at: new Date().toISOString(),
        }).eq('id', matchId)
        return NextResponse.json({ error: `Settlement transfer failed: ${payoutResult.error}` }, { status: 500 })
      }

      // House fee (best-effort)
      const feeResult = await sendSol(loserProfile.encrypted_private_key, TREASURY_ADDRESS, houseFee, { skipPreflightCheck: true })
      if (!feeResult.success) {
        await supabaseAdmin.from('audit_log').insert({
          match_id: matchId,
          event_type: 'house_fee_failed',
          amount_sol: houseFee,
          metadata: { error: feeResult.error, context: 'admin_settlement' },
        })
      }

      // DB settlement
      const { data: dbResult } = await supabaseAdmin.rpc('settle_match_db', {
        p_match_id: matchId,
        p_winner_id: winnerId,
        p_loser_id: loserId,
        p_entry_fee: entryFeeSol,
        p_winner_payout: winnerPayout,
        p_settlement_tx: payoutResult.signature!,
      })

      // Audit log
      await supabaseAdmin.from('audit_log').insert({
        match_id: matchId,
        event_type: 'admin_settlement',
        amount_sol: winnerPayout,
        metadata: {
          action,
          admin_note: adminNote,
          winner_id: winnerId,
          loser_id: loserId,
          settlement_tx: payoutResult.signature,
          db_result: dbResult,
        },
      })

      return NextResponse.json({ ok: true, action, winnerId, winnerPayout, settlementTx: payoutResult.signature, dbResult })

    // ════════════════════════════════════════════════════════════
    // refund_both
    // ════════════════════════════════════════════════════════════
    } else if (action === 'refund_both') {
      if (!match.player_b_id) {
        // Only P1 has locked funds
        const unlockA = await supabaseAdmin.rpc('unlock_player_funds', { p_user_id: match.player_a_id, p_amount: entryFeeSol })
        if (!unlockA.data?.success) console.error('[Admin Review] P1-only unlock failed:', unlockA.data)
        await supabaseAdmin.from('matches').update({
          status: 'voided',
          error_message: `Admin refund: ${adminNote}`,
          updated_at: new Date().toISOString(),
        }).eq('id', matchId)
      } else {
        // Both players — use atomic refund RPC
        const refundResult = await supabaseAdmin.rpc('refund_match_db', {
          p_match_id: matchId,
          p_player_a: match.player_a_id,
          p_player_b: match.player_b_id,
          p_amount: entryFeeSol,
          p_reason: adminNote,
        })
        if (!refundResult.data?.success) {
          console.error('[Admin Review] refund_match_db failed:', refundResult.data)
        }
        await supabaseAdmin.from('matches').update({
          status: 'voided',
          updated_at: new Date().toISOString(),
        }).eq('id', matchId)
      }

      await supabaseAdmin.from('audit_log').insert({
        match_id: matchId,
        event_type: 'admin_refund_both',
        amount_sol: entryFeeSol,
        metadata: { action, admin_note: adminNote },
      })

      return NextResponse.json({ ok: true, action, refunded: true, eachAmount: entryFeeSol })

    // ════════════════════════════════════════════════════════════
    // void (no refund — use only if funds already returned externally)
    // ════════════════════════════════════════════════════════════
    } else if (action === 'void') {
      await supabaseAdmin.from('matches').update({
        status: 'voided',
        error_message: `Admin void: ${adminNote}`,
        updated_at: new Date().toISOString(),
      }).eq('id', matchId)

      await supabaseAdmin.from('audit_log').insert({
        match_id: matchId,
        event_type: 'admin_void',
        metadata: { action, admin_note: adminNote, warning: 'voided without refund — verify funds were already returned' },
      })

      return NextResponse.json({ ok: true, action, voided: true, warning: 'No refund issued — confirm funds returned externally' })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })

  } catch (err) {
    console.error('[Admin Review] Unexpected error:', err)
    return NextResponse.json({ error: 'Admin action failed' }, { status: 500 })
  }
}

// ── GET /api/admin/match/[matchId]/review — fetch match + audit trail ──
export async function GET(
  req: NextRequest,
  { params: _params }: { params: Promise<{ matchId: string }> }
) {
  const adminToken    = req.headers.get('x-admin-token') ?? ''
  const expectedToken = process.env.ADMIN_SECRET ?? ''
  let authorized = false
  try {
    const a = Buffer.from(adminToken)
    const b = Buffer.from(expectedToken)
    authorized = a.length > 0 && a.length === b.length && timingSafeEqual(a, b)
  } catch { authorized = false }
  if (!authorized) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { matchId } = await _params

  const [matchRes, auditRes] = await Promise.all([
    supabaseAdmin.from('matches').select('*').eq('id', matchId).single(),
    supabaseAdmin.from('audit_log').select('*').eq('match_id', matchId).order('created_at', { ascending: true }),
  ])

  return NextResponse.json({
    match: matchRes.data,
    auditLog: auditRes.data,
  })
}
