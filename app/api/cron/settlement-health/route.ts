/**
 * GET /api/cron/settlement-health
 *
 * Vercel cron job endpoint — runs every 5 minutes.
 *
 * Jobs:
 * 1. SETTLEMENT RETRY     — retry settlement_failed matches (last 24h)
 * 2. STUCK BATTLE         — flag battling matches stuck >15min → manual_review + unlock funds
 * 3. EXPIRED FORMING      — void forming matches open >30min (no opponent joined) + unlock P1
 * 4. EXPIRED READY        — void ready matches stuck >10min (both joined, neither started) + unlock both
 * 5. STUCK SETTLING       — flag settling matches stuck >5min → settlement_failed (mutex leak guard)
 *
 * Protected by CRON_SECRET (Vercel env) or x-vercel-cron-key (Vercel native cron).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const STUCK_BATTLE_MINUTES    = 15
const EXPIRED_FORMING_MINUTES = 30
const EXPIRED_READY_MINUTES   = 10
const STUCK_SETTLING_MINUTES  = 5

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export async function GET(req: NextRequest) {
  const cronToken   = req.headers.get('x-cron-secret') ?? req.headers.get('Authorization')?.replace('Bearer ', '') ?? ''
  const cronSecret  = process.env.CRON_SECRET
  const isVercelCron = req.headers.get('x-vercel-cron-key') != null

  if (cronSecret && !isVercelCron && cronToken !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const report: Record<string, unknown> = { timestamp: new Date().toISOString() }

  // ══════════════════════════════════════════════════════════════
  // Job 1: Settlement retry
  // ══════════════════════════════════════════════════════════════
  try {
    const adminSecret = process.env.ADMIN_SECRET
    if (!adminSecret) {
      report.settlementRetry = { error: 'ADMIN_SECRET not configured' }
    } else {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? `https://${req.headers.get('host')}`
      const retryRes = await fetch(`${baseUrl}/api/admin/settlement-retry`, {
        method: 'POST',
        headers: { 'x-admin-token': adminSecret, 'Content-Type': 'application/json' },
      })
      report.settlementRetry = retryRes.ok
        ? await retryRes.json()
        : { error: `HTTP ${retryRes.status}`, body: await retryRes.text().catch(() => '') }
    }
  } catch (err) {
    report.settlementRetry = { error: String(err) }
  }

  // ══════════════════════════════════════════════════════════════
  // Job 2: Stuck battling matches (>15 min) → manual_review + unlock
  // ══════════════════════════════════════════════════════════════
  try {
    const cutoff = new Date(Date.now() - STUCK_BATTLE_MINUTES * 60 * 1000).toISOString()
    const { data: matches } = await supabaseAdmin
      .from('matches')
      .select('id, created_at, player_a_id, player_b_id, entry_fee_sol')
      .eq('status', 'battling')
      .lt('updated_at', cutoff)
      .limit(50)

    if (matches && matches.length > 0) {
      const ids = matches.map(m => m.id)
      await supabaseAdmin.from('matches').update({
        status: 'manual_review',
        error_message: `Stuck in battling >${STUCK_BATTLE_MINUTES}min — cron flagged. Funds unlocked.`,
        updated_at: new Date().toISOString(),
      }).in('id', ids)

      for (const m of matches) {
        if (m.entry_fee_sol != null) {
          const unlockA = await supabaseAdmin.rpc('unlock_player_funds', { p_user_id: m.player_a_id, p_amount: m.entry_fee_sol })
          if (!unlockA.data?.success) console.error(`[SettlementHealth] ready-expiry unlock failed for player_a ${m.player_a_id} match ${m.id}:`, unlockA.data)
          if (m.player_b_id) {
            const unlockB = await supabaseAdmin.rpc('unlock_player_funds', { p_user_id: m.player_b_id, p_amount: m.entry_fee_sol })
            if (!unlockB.data?.success) console.error(`[SettlementHealth] ready-expiry unlock failed for player_b ${m.player_b_id} match ${m.id}:`, unlockB.data)
          }
        }
      }

      await supabaseAdmin.from('audit_log').insert(
        matches.flatMap(m => [
          { user_id: m.player_a_id, match_id: m.id, event_type: 'stuck_battle_flagged', metadata: { funds_unlocked: true, stuck_since: m.created_at } },
          ...(m.player_b_id ? [{ user_id: m.player_b_id, match_id: m.id, event_type: 'stuck_battle_flagged', metadata: { funds_unlocked: true, stuck_since: m.created_at } }] : []),
        ])
      )

      report.stuckBattles = { flagged: ids.length, matchIds: ids }
    } else {
      report.stuckBattles = { flagged: 0 }
    }
  } catch (err) {
    report.stuckBattles = { error: String(err) }
  }

  // ══════════════════════════════════════════════════════════════
  // Job 3: Expired forming matches (>30 min, no opponent) → voided + unlock P1
  // ══════════════════════════════════════════════════════════════
  try {
    const cutoff = new Date(Date.now() - EXPIRED_FORMING_MINUTES * 60 * 1000).toISOString()
    const { data: matches } = await supabaseAdmin
      .from('matches')
      .select('id, player_a_id, entry_fee_sol, created_at')
      .eq('status', 'forming')
      .lt('updated_at', cutoff)
      .limit(50)

    if (matches && matches.length > 0) {
      const ids = matches.map(m => m.id)
      await supabaseAdmin.from('matches').update({
        status: 'voided',
        error_message: `No opponent joined within ${EXPIRED_FORMING_MINUTES}min — auto-voided by cron. P1 funds unlocked.`,
        updated_at: new Date().toISOString(),
      }).in('id', ids)

      for (const m of matches) {
        if (m.entry_fee_sol != null) {
          const unlockA = await supabaseAdmin.rpc('unlock_player_funds', { p_user_id: m.player_a_id, p_amount: m.entry_fee_sol })
          if (!unlockA.data?.success) console.error(`[SettlementHealth] forming-expiry unlock failed for ${m.player_a_id} match ${m.id}:`, unlockA.data)
        }
      }

      await supabaseAdmin.from('audit_log').insert(
        matches.map(m => ({
          user_id: m.player_a_id,
          match_id: m.id,
          event_type: 'match_expired_forming',
          amount_sol: m.entry_fee_sol,
          metadata: { reason: `no_opponent_after_${EXPIRED_FORMING_MINUTES}min`, created_at: m.created_at, funds_unlocked: true },
        }))
      )

      report.expiredForming = { voided: ids.length, matchIds: ids }
    } else {
      report.expiredForming = { voided: 0 }
    }
  } catch (err) {
    report.expiredForming = { error: String(err) }
  }

  // ══════════════════════════════════════════════════════════════
  // Job 4: Expired ready matches (>10 min, both joined, nobody started) → voided + unlock both
  // ══════════════════════════════════════════════════════════════
  try {
    const cutoff = new Date(Date.now() - EXPIRED_READY_MINUTES * 60 * 1000).toISOString()
    const { data: matches } = await supabaseAdmin
      .from('matches')
      .select('id, player_a_id, player_b_id, entry_fee_sol, created_at')
      .in('status', ['ready', 'funds_locked'])
      .lt('updated_at', cutoff)
      .limit(50)

    if (matches && matches.length > 0) {
      const ids = matches.map(m => m.id)
      await supabaseAdmin.from('matches').update({
        status: 'voided',
        error_message: `Match not started within ${EXPIRED_READY_MINUTES}min of both players joining — auto-voided by cron. Funds unlocked.`,
        updated_at: new Date().toISOString(),
      }).in('id', ids)

      for (const m of matches) {
        if (m.entry_fee_sol != null) {
          await supabaseAdmin.rpc('unlock_player_funds', { p_user_id: m.player_a_id, p_amount: m.entry_fee_sol })
          if (m.player_b_id) await supabaseAdmin.rpc('unlock_player_funds', { p_user_id: m.player_b_id, p_amount: m.entry_fee_sol })
        }
      }

      await supabaseAdmin.from('audit_log').insert(
        matches.flatMap(m => [
          { user_id: m.player_a_id, match_id: m.id, event_type: 'match_expired_ready', amount_sol: m.entry_fee_sol, metadata: { funds_unlocked: true } },
          ...(m.player_b_id ? [{ user_id: m.player_b_id, match_id: m.id, event_type: 'match_expired_ready', amount_sol: m.entry_fee_sol, metadata: { funds_unlocked: true } }] : []),
        ])
      )

      report.expiredReady = { voided: ids.length, matchIds: ids }
    } else {
      report.expiredReady = { voided: 0 }
    }
  } catch (err) {
    report.expiredReady = { error: String(err) }
  }

  // ══════════════════════════════════════════════════════════════
  // Job 5: Stuck 'settling' matches (>5 min) → settlement_failed
  // Guards against the settlement mutex leaking: if a server crashed
  // mid-settle and left the match in 'settling', cron recovers it.
  // DO NOT unlock funds here — the on-chain tx may have run.
  // The retry worker will handle it on the next pass.
  // ══════════════════════════════════════════════════════════════
  try {
    const cutoff = new Date(Date.now() - STUCK_SETTLING_MINUTES * 60 * 1000).toISOString()
    const { data: matches } = await supabaseAdmin
      .from('matches')
      .select('id, player_a_id, player_b_id, winner_id, settlement_tx')
      .eq('status', 'settling')
      .lt('updated_at', cutoff)
      .limit(20)

    if (matches && matches.length > 0) {
      const ids = matches.map(m => m.id)
      await supabaseAdmin.from('matches').update({
        status: 'settlement_failed',
        error_message: `Stuck in 'settling' for >${STUCK_SETTLING_MINUTES}min — likely server crash mid-settlement. Retry worker will attempt recovery. DO NOT auto-unlock funds until on-chain state is verified.`,
        updated_at: new Date().toISOString(),
      }).in('id', ids)

      await supabaseAdmin.from('audit_log').insert(
        matches.map(m => ({
          match_id: m.id,
          event_type: 'stuck_settling_recovered',
          metadata: {
            settlement_tx: m.settlement_tx,
            winner_id: m.winner_id,
            note: 'Moved settling→settlement_failed. Retry worker will verify on-chain and reconcile.',
          },
        }))
      )

      report.stuckSettling = { recovered: ids.length, matchIds: ids }
    } else {
      report.stuckSettling = { recovered: 0 }
    }
  } catch (err) {
    report.stuckSettling = { error: String(err) }
  }

  return NextResponse.json(report)
}
