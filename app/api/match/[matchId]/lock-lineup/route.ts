/**
 * POST /api/match/[matchId]/lock-lineup
 * 
 * CRITICAL: Server-controlled lineup locking for paid PvP
 * 
 * Flow:
 * 1. Validate user is a player in this match
 * 2. Atomically save lineup to correct side (player_a or player_b)
 * 3. If both lineups now locked, assign arena deterministically
 * 4. Return updated match state
 * 
 * This prevents clients from skipping ahead or choosing their own arena.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

const supabaseAnon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  const startTime = Date.now()
  const { matchId } = await params
  const requestId = `lock_${Math.random().toString(36).slice(2, 8)}`
  
  console.log(`[LockLineup ${requestId}] ==================== START ====================`)
  console.log(`[LockLineup ${requestId}] Match ID: ${matchId}`)
  
  try {
    // ═══════════════════════════════════════════════════════════════
    // STEP 1: Authenticate
    // ═══════════════════════════════════════════════════════════════
    
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      console.error(`[LockLineup ${requestId}] ❌ 401 - No auth header`)
      return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 })
    }
    
    const token = authHeader.slice(7)
    const { data: { user }, error: authError } = await supabaseAnon.auth.getUser(token)
    
    if (authError || !user) {
      console.error(`[LockLineup ${requestId}] ❌ 401 - Auth failed:`, authError)
      return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 })
    }
    
    const userId = user.id
    console.log(`[LockLineup ${requestId}] ✅ User: ${userId}`)
    
    // ═══════════════════════════════════════════════════════════════
    // STEP 2: Parse request
    // ═══════════════════════════════════════════════════════════════
    
    const body = await req.json()
    const { trainerId, lineupIds } = body
    
    console.log(`[LockLineup ${requestId}] Trainer: ${trainerId}`)
    console.log(`[LockLineup ${requestId}] Lineup: ${JSON.stringify(lineupIds)}`)
    
    if (!trainerId || !lineupIds || !Array.isArray(lineupIds)) {
      console.error(`[LockLineup ${requestId}] ❌ 400 - Invalid payload`)
      return NextResponse.json({ 
        error: 'INVALID_PAYLOAD',
        message: 'trainerId and lineupIds[] required'
      }, { status: 400 })
    }
    
    if (lineupIds.length < 3) {
      console.error(`[LockLineup ${requestId}] ❌ 400 - Lineup too short`)
      return NextResponse.json({
        error: 'INVALID_LINEUP',
        message: 'Lineup must have at least 3 Pokemon'
      }, { status: 400 })
    }
    
    // ═══════════════════════════════════════════════════════════════
    // STEP 3: Call atomic RPC
    // ═══════════════════════════════════════════════════════════════
    
    console.log(`[LockLineup ${requestId}] Calling atomic_lock_lineup_and_maybe_assign_arena`)
    console.log(`[LockLineup ${requestId}]   - match_id: ${matchId}`)
    console.log(`[LockLineup ${requestId}]   - user_id: ${userId}`)
    console.log(`[LockLineup ${requestId}]   - trainer_id: ${trainerId}`)
    console.log(`[LockLineup ${requestId}]   - lineup_ids: [${lineupIds.join(', ')}]`)
    
    const { data: result, error: rpcError } = await supabaseAdmin.rpc(
      'atomic_lock_lineup_and_maybe_assign_arena',
      {
        p_match_id: matchId,
        p_user_id: userId,
        p_trainer_id: trainerId,
        p_lineup_ids: lineupIds
      }
    )
    
    if (rpcError) {
      console.error(`[LockLineup ${requestId}] ❌ 500 - RPC error:`, rpcError)
      return NextResponse.json({
        error: 'RPC_ERROR',
        message: 'Database function failed',
        details: rpcError
      }, { status: 500 })
    }
    
    if (!result) {
      console.error(`[LockLineup ${requestId}] ❌ 500 - RPC returned null`)
      return NextResponse.json({
        error: 'RPC_NULL_RESPONSE'
      }, { status: 500 })
    }
    
    // Check for errors from RPC
    if (result.error) {
      console.error(`[LockLineup ${requestId}] ❌ 400 - RPC returned error:`, result.error)
      const statusCode = result.error === 'ALREADY_LOCKED' ? 409 : 400
      return NextResponse.json(result, { status: statusCode })
    }
    
    // ═══════════════════════════════════════════════════════════════
    // STEP 4: Log success
    // ═══════════════════════════════════════════════════════════════
    
    const elapsed = Date.now() - startTime
    
    console.log(`[LockLineup ${requestId}] ✅ SUCCESS in ${elapsed}ms`)
    console.log(`[LockLineup ${requestId}] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    console.log(`[LockLineup ${requestId}] Match ID: ${result.matchId}`)
    console.log(`[LockLineup ${requestId}] My Role: ${result.myRole}`)
    console.log(`[LockLineup ${requestId}] My Lineup Locked: ${result.myLineupLocked}`)
    console.log(`[LockLineup ${requestId}] Player A Locked: ${result.playerALineupLocked}`)
    console.log(`[LockLineup ${requestId}] Player B Locked: ${result.playerBLineupLocked}`)
    console.log(`[LockLineup ${requestId}] Both Locked: ${result.bothLineupsLocked}`)
    console.log(`[LockLineup ${requestId}] Arena Assigned: ${result.arenaAssigned}`)
    console.log(`[LockLineup ${requestId}] Arena ID: ${result.arenaId ?? 'null'}`)
    console.log(`[LockLineup ${requestId}] New Status: ${result.status}`)
    console.log(`[LockLineup ${requestId}] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    console.log(`[LockLineup ${requestId}] ==================== END ====================`)
    
    return NextResponse.json(result)
    
  } catch (err: any) {
    const elapsed = Date.now() - startTime
    console.error(`[LockLineup ${requestId}] ❌ 500 - Exception after ${elapsed}ms`)
    console.error(`[LockLineup ${requestId}]   error:`, err)
    console.error(`[LockLineup ${requestId}]   stack:`, err?.stack)
    return NextResponse.json({
      error: 'INTERNAL_ERROR',
      message: err?.message,
      stack: err?.stack
    }, { status: 500 })
  }
}
