/**
 * POST /api/settle
 *
 * Called after a real-money battle resolves.
 * Deducts the entry fee from the loser, credits the prize pool (95%) to the winner,
 * and credits the 5% house fee to the treasury wallet record.
 *
 * NOTE: This currently settles in the internal Supabase balance only.
 * Real on-chain SOL transfers happen at withdrawal time (user pulls funds out).
 * The treasury 5% is tracked in the `transactions` table for accounting purposes.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { ARENA_FEE_PCT } from '@/lib/constants'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    // Verify auth — only the authenticated user can trigger their own settlement
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const token = authHeader.slice(7)

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { winnerId, loserId, entryFeeSol, arenaId } = body

    if (!winnerId || !loserId || !entryFeeSol || entryFeeSol <= 0) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Only the winner or loser can trigger settlement (must be one of them)
    if (user.id !== winnerId && user.id !== loserId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const houseFee = parseFloat((entryFeeSol * ARENA_FEE_PCT).toFixed(9))
    const winnerPayout = parseFloat((entryFeeSol * 2 * (1 - ARENA_FEE_PCT)).toFixed(9))
    const pot = parseFloat((entryFeeSol * 2).toFixed(9))

    // Idempotency: check if this match was already settled
    const { data: existingSettle } = await supabaseAdmin
      .from('transactions')
      .select('id')
      .eq('user_id', winnerId)
      .eq('type', 'win')
      .eq('notes', `Settlement:${loserId}:${arenaId}:${entryFeeSol}`)
      .single()

    if (existingSettle) {
      return NextResponse.json({ ok: true, alreadySettled: true })
    }

    // Fetch both profiles
    const { data: profiles, error: fetchErr } = await supabaseAdmin
      .from('profiles')
      .select('id, balance')
      .in('id', [winnerId, loserId])

    if (fetchErr || !profiles || profiles.length < 2) {
      return NextResponse.json({ error: 'Could not fetch player profiles' }, { status: 500 })
    }

    const winnerProfile = profiles.find(p => p.id === winnerId)!
    const loserProfile = profiles.find(p => p.id === loserId)!

    // Validate loser has enough balance
    if (loserProfile.balance < entryFeeSol) {
      return NextResponse.json({ error: 'Loser has insufficient balance' }, { status: 400 })
    }

    const settleNote = `Settlement:${loserId}:${arenaId}:${entryFeeSol}`

    // Deduct from loser
    await supabaseAdmin
      .from('profiles')
      .update({ balance: parseFloat((loserProfile.balance - entryFeeSol).toFixed(9)) })
      .eq('id', loserId)

    await supabaseAdmin.from('transactions').insert({
      user_id: loserId,
      type: 'loss',
      amount_sol: -entryFeeSol,
      status: 'confirmed',
      notes: settleNote,
    })

    // Credit winner (95% of pot)
    await supabaseAdmin
      .from('profiles')
      .update({ balance: parseFloat((winnerProfile.balance + winnerPayout).toFixed(9)) })
      .eq('id', winnerId)

    await supabaseAdmin.from('transactions').insert({
      user_id: winnerId,
      type: 'win',
      amount_sol: winnerPayout,
      status: 'confirmed',
      notes: settleNote,
    })

    // Log house fee (tracked for accounting; actual treasury wallet funded at withdrawal)
    await supabaseAdmin.from('transactions').insert({
      user_id: winnerId, // attributed to the match winner for reference
      type: 'fee',
      amount_sol: houseFee,
      status: 'confirmed',
      notes: `House fee 5% of ${pot} SOL pot — arena: ${arenaId}`,
    })

    return NextResponse.json({
      ok: true,
      winnerPayout,
      houseFee,
      pot,
    })
  } catch (err) {
    console.error('[Settle] Error:', err)
    return NextResponse.json({ error: 'Settlement failed' }, { status: 500 })
  }
}
