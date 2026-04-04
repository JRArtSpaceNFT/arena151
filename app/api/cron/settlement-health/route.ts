/**
 * GET /api/cron/settlement-health
 *
 * Vercel cron job endpoint — runs every 5 minutes.
 * Performs two jobs:
 *
 * 1. SETTLEMENT RETRY: Calls the settlement-retry admin endpoint to
 *    retry any settlement_failed matches from the last 24 hours.
 *
 * 2. STUCK BATTLE DETECTION: Finds matches stuck in 'battling' status
 *    for >15 minutes and flags them as 'manual_review' with a note.
 *
 * Protected by CRON_SECRET header (set in Vercel env + vercel.json).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const STUCK_BATTLE_MINUTES = 15

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export async function GET(req: NextRequest) {
  // ── Auth: Vercel sends CRON_SECRET in Authorization header ───
  const authHeader = req.headers.get('Authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const report: {
    settlementRetry: unknown
    stuckBattles: { flagged: number; matchIds: string[] }
    timestamp: string
  } = {
    settlementRetry: null,
    stuckBattles: { flagged: 0, matchIds: [] },
    timestamp: new Date().toISOString(),
  }

  // ── Job 1: Trigger settlement retry ──────────────────────────
  try {
    const adminSecret = process.env.ADMIN_SECRET
    if (!adminSecret) {
      report.settlementRetry = { error: 'ADMIN_SECRET not configured' }
    } else {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL
        ?? `https://${req.headers.get('host')}`

      const retryRes = await fetch(`${baseUrl}/api/admin/settlement-retry`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminSecret}`,
          'Content-Type': 'application/json',
        },
      })

      if (retryRes.ok) {
        report.settlementRetry = await retryRes.json()
      } else {
        report.settlementRetry = {
          error: `HTTP ${retryRes.status}`,
          body: await retryRes.text().catch(() => ''),
        }
      }
    }
  } catch (err) {
    console.error('[SettlementHealth] Retry trigger failed:', err)
    report.settlementRetry = { error: String(err) }
  }

  // ── Job 2: Flag stuck battling matches (>15 min) ──────────────
  try {
    const stuckCutoff = new Date(Date.now() - STUCK_BATTLE_MINUTES * 60 * 1000).toISOString()

    const { data: stuckMatches, error: stuckError } = await supabaseAdmin
      .from('matches')
      .select('id, created_at, player_a_id, player_b_id')
      .eq('status', 'battling')
      .lt('updated_at', stuckCutoff)
      .limit(50)

    if (stuckError) {
      console.error('[SettlementHealth] Stuck battle query error:', stuckError)
    } else if (stuckMatches && stuckMatches.length > 0) {
      const stuckIds = stuckMatches.map(m => m.id)

      // Flag all stuck matches as manual_review
      await supabaseAdmin
        .from('matches')
        .update({
          status: 'manual_review',
          error_message: `Match stuck in battling for >${STUCK_BATTLE_MINUTES} minutes — flagged by health check cron`,
          updated_at: new Date().toISOString(),
        })
        .in('id', stuckIds)

      // Log each stuck match
      const auditEntries = stuckMatches.flatMap(m => [
        {
          user_id: m.player_a_id,
          match_id: m.id,
          event_type: 'stuck_battle_flagged',
          metadata: {
            reason: `stuck_in_battling_for_>${STUCK_BATTLE_MINUTES}min`,
            stuck_since: m.created_at,
          },
        },
        ...(m.player_b_id ? [{
          user_id: m.player_b_id,
          match_id: m.id,
          event_type: 'stuck_battle_flagged',
          metadata: {
            reason: `stuck_in_battling_for_>${STUCK_BATTLE_MINUTES}min`,
            stuck_since: m.created_at,
          },
        }] : []),
      ])

      await supabaseAdmin.from('audit_log').insert(auditEntries)

      report.stuckBattles = { flagged: stuckIds.length, matchIds: stuckIds }
      console.log(`[SettlementHealth] Flagged ${stuckIds.length} stuck battles:`, stuckIds)
    }
  } catch (err) {
    console.error('[SettlementHealth] Stuck battle check failed:', err)
  }

  return NextResponse.json(report)
}
