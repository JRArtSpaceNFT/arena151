/**
 * POST /api/admin/match/[matchId]/review
 *
 * Admin manual review endpoint for disputed/failed matches.
 *
 * Actions:
 *   settle_winner_a — settle with player_a as winner
 *   settle_winner_b — settle with player_b as winner
 *   refund_both     — refund both players and void match
 *   void            — void without refund (e.g. both cheated)
 *
 * Auth: Requires either:
 *   - X-Admin-Secret header matching ADMIN_SECRET env var, OR
 *   - User with is_admin = true in profiles table (extend schema if needed)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendSol, TREASURY_ADDRESS, HOUSE_FEE_PCT } from '@/lib/solana'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

const ADMIN_SECRET = process.env.ADMIN_SECRET

type ReviewAction = 'settle_winner_a' | 'settle_winner_b' | 'refund_both' | 'void'

export async function POST(
  req: NextRequest,
  { params }: { params: { matchId: string } }
) {
  try {
    // ── Admin Auth ────────────────────────────────────────────────
    const adminSecret = req.headers.get('X-Admin-Secret')
    if (!ADMIN_SECRET || adminSecret !== ADMIN_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { matchId } = params
    const { action, reason } = await req.json() as { action: ReviewAction; reason?: string }

    const validActions: ReviewAction[] = ['settle_winner_a', 'settle_winner_b', 'refund_both', 'void']
    if (!validActions.includes(action)) {
      return NextResponse.json({ error: `Invalid action. Must be one of: ${validActions.join(', ')}` }, { status: 400 })
    }

    // ── Load match ───────────────────────────────────────────────
    const { data: match, error: matchError } = await supabaseAdmin
      .from('matches')
      .select('id, player_a_id, player_b_id, entry_fee_sol, status')
      .eq('id', matchId)
      .single()

    if (matchError || !match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 })
    }

    if (match.status === 'settled' || match.status === 'refunded') {
      return NextResponse.json({ error: `Match already finalized (status: ${match.status})` }, { status: 409 })
    }

    const adminNote = reason ?? `Admin action: ${action}`

    // ── Load profiles ─────────────────────────────────────────────
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, sol_address, encrypted_private_key, balance, locked_balance')
      .in('id', [match.player_a_id, match.player_b_id].filter(Boolean))

    const profileA = profiles?.find(p => p.id === match.player_a_id)
    const profileB = profiles?.find(p => p.id === match.player_b_id)

    if (action === 'settle_winner_a' || action === 'settle_winner_b') {
      const winnerId = action === 'settle_winner_a' ? match.player_a_id : match.player_b_id
      const loserId  = action === 'settle_winner_a' ? match.player_b_id : match.player_a_id
      const winnerProfile = action === 'settle_winner_a' ? profileA : profileB
      const loserProfile  = action === 'settle_winner_a' ? profileB : profileA

      if (!winnerProfile || !loserProfile || !loserId) {
        return NextResponse.json({ error: 'Could not load player profiles' }, { status: 500 })
      }

      const entryFeeSol  = Number(match.entry_fee_sol)
      const pot          = entryFeeSol * 2
      const houseFee     = parseFloat((pot * HOUSE_FEE_PCT).toFixed(9))
      const winnerPayout = parseFloat((pot - houseFee).toFixed(9))

      // On-chain settlement from loser's custodial wallet
      const payoutResult = await sendSol(loserProfile.encrypted_private_key, winnerProfile.sol_address, winnerPayout)
      if (!payoutResult.success) {
        return NextResponse.json({ error: `Settlement transfer failed: ${payoutResult.error}` }, { status: 500 })
      }

      await sendSol(loserProfile.encrypted_private_key, TREASURY_ADDRESS, houseFee).catch(e =>
        console.error('[Admin Review] Fee tx failed:', e)
      )

      // DB settlement
      await supabaseAdmin.rpc('settle_match_db', {
        p_match_id: matchId,
        p_winner_id: winnerId,
        p_loser_id: loserId,
        p_entry_fee: entryFeeSol,
        p_winner_payout: winnerPayout,
        p_settlement_tx: payoutResult.signature!,
      })

      // Log admin action
      await supabaseAdmin.from('audit_log').insert({
        match_id: matchId,
        event_type: 'admin_settlement',
        amount_sol: winnerPayout,
        metadata: { action, admin_note: adminNote, winner_id: winnerId, loser_id: loserId, settlement_tx: payoutResult.signature },
      })

      return NextResponse.json({ ok: true, action, winnerId, winnerPayout, settlementTx: payoutResult.signature })

    } else if (action === 'refund_both') {
      if (!match.player_b_id) {
        // Only P1 has locked funds
        await supabaseAdmin.rpc('unlock_player_funds', { p_user_id: match.player_a_id, p_amount: match.entry_fee_sol })
        await supabaseAdmin.from('matches').update({ status: 'refunded', error_message: adminNote, updated_at: new Date().toISOString() }).eq('id', matchId)
      } else {
        await supabaseAdmin.rpc('refund_match_db', {
          p_match_id: matchId,
          p_player_a: match.player_a_id,
          p_player_b: match.player_b_id,
          p_amount: match.entry_fee_sol,
          p_reason: adminNote,
        })
        await supabaseAdmin.from('matches').update({ status: 'refunded', updated_at: new Date().toISOString() }).eq('id', matchId)
      }

      await supabaseAdmin.from('audit_log').insert({
        match_id: matchId,
        event_type: 'admin_refund_both',
        amount_sol: match.entry_fee_sol,
        metadata: { action, admin_note: adminNote },
      })

      return NextResponse.json({ ok: true, action, refunded: true })

    } else if (action === 'void') {
      await supabaseAdmin.from('matches').update({
        status: 'voided',
        error_message: adminNote,
        updated_at: new Date().toISOString(),
      }).eq('id', matchId)

      await supabaseAdmin.from('audit_log').insert({
        match_id: matchId,
        event_type: 'admin_void',
        metadata: { action, admin_note: adminNote },
      })

      return NextResponse.json({ ok: true, action, voided: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })

  } catch (err) {
    console.error('[Admin Review] Unexpected error:', err)
    return NextResponse.json({ error: 'Admin action failed' }, { status: 500 })
  }
}
