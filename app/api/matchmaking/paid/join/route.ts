/**
 * POST /api/matchmaking/paid/join
 * 
 * V2 - Server-authoritative matchmaking with team lock validation
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { ROOM_TIERS } from '@/lib/constants'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

const supabaseAnon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: NextRequest) {
  const startTime = Date.now()
  let requestId = `srv_${Math.random().toString(36).slice(2, 10)}`
  
  console.log(`[Matchmaking ${requestId}] ==================== START V2 ====================`)

  try {
    // Auth
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      console.error(`[Matchmaking ${requestId}] ❌ 401 - No Authorization header`)
      return NextResponse.json({ 
        ok: false, 
        code: 'UNAUTHENTICATED', 
        message: 'Authorization header missing' 
      }, { status: 401 })
    }

    const token = authHeader.slice(7)
    const { data: { user }, error: authError } = await supabaseAnon.auth.getUser(token)
    
    if (authError || !user) {
      console.error(`[Matchmaking ${requestId}] ❌ 401 - Auth failed:`, authError)
      return NextResponse.json({ 
        ok: false, 
        code: 'UNAUTHENTICATED', 
        message: 'Invalid or expired session',
        details: authError 
      }, { status: 401 })
    }

    const userId = user.id
    console.log(`[Matchmaking ${requestId}] ✅ Authenticated user: ${userId} (${user.email})`)

    // Parse request
    const body = await req.json()
    
    // Use client requestId if provided
    if (body.requestId) {
      requestId = body.requestId
      console.log(`[Matchmaking ${requestId}] 🔗 Using client requestId`)
    }
    
    console.log(`[Matchmaking ${requestId}] 📥 Request body:`, JSON.stringify(body, null, 2))

    const { roomId } = body

    if (!roomId || typeof roomId !== 'string') {
      console.error(`[Matchmaking ${requestId}] ❌ 400 - INVALID_ROOM_ID`)
      console.error(`[Matchmaking ${requestId}]   roomId:`, roomId)
      console.error(`[Matchmaking ${requestId}]   type:`, typeof roomId)
      console.error(`[Matchmaking ${requestId}]   body:`, JSON.stringify(body))
      return NextResponse.json({ 
        ok: false, 
        code: 'INVALID_ROOM_ID', 
        message: 'Missing or invalid roomId in request body',
        details: { roomId, receivedType: typeof roomId, body }
      }, { status: 400 })
    }

    const roomTier = ROOM_TIERS[roomId]
    if (!roomTier) {
      console.error(`[Matchmaking ${requestId}] ❌ 400 - ROOM_NOT_FOUND`)
      console.error(`[Matchmaking ${requestId}]   requested:`, roomId)
      console.error(`[Matchmaking ${requestId}]   available:`, Object.keys(ROOM_TIERS))
      return NextResponse.json({ 
        ok: false, 
        code: 'ROOM_NOT_FOUND', 
        message: `Room '${roomId}' does not exist`,
        details: { roomId, availableRooms: Object.keys(ROOM_TIERS) }
      }, { status: 400 })
    }

    let entryFeeSol = roomTier.entryFee
    
    // TEMPORARY: Fallback if entryFee is NaN or undefined
    if (!entryFeeSol || isNaN(entryFeeSol)) {
      console.warn(`[Matchmaking ${requestId}] ⚠️  Invalid entryFee ${entryFeeSol}, using fallback 0.05`)
      entryFeeSol = 0.05
    }

    console.log(`[Matchmaking ${requestId}] ✅ Authenticated user: ${userId}`)
    console.log(`[Matchmaking ${requestId}] 🎯 Room: ${roomId}`)
    console.log(`[Matchmaking ${requestId}] 💰 Entry fee: ${entryFeeSol} SOL`)
    console.log(`[Matchmaking ${requestId}] 🏆 Tier: ${roomTier.tier}`)

    // Call atomic RPC V2
    console.log(`[Matchmaking ${requestId}] 🔄 Calling atomic_join_or_create_paid_match_v2`)
    console.log(`[Matchmaking ${requestId}]   - p_user_id: ${userId}`)
    console.log(`[Matchmaking ${requestId}]   - p_room_id: ${roomId}`)
    console.log(`[Matchmaking ${requestId}]   - p_entry_fee: ${entryFeeSol}`)

    const { data: payload, error: rpcError } = await supabaseAdmin.rpc(
      'atomic_join_or_create_paid_match_v2',
      {
        p_user_id: userId,
        p_room_id: roomId,
        p_entry_fee: entryFeeSol,
      }
    )

    if (rpcError) {
      console.error(`[Matchmaking ${requestId}] ❌ 500 - RPC_ERROR`)
      console.error(`[Matchmaking ${requestId}]   error:`, JSON.stringify(rpcError, null, 2))
      return NextResponse.json({ 
        ok: false, 
        code: 'RPC_ERROR', 
        message: 'Database matchmaking function failed',
        details: rpcError 
      }, { status: 500 })
    }

    if (!payload) {
      console.error(`[Matchmaking ${requestId}] ❌ 500 - RPC returned null`)
      return NextResponse.json({ 
        ok: false, 
        code: 'RPC_NULL_RESPONSE', 
        message: 'Matchmaking returned no data',
        details: null
      }, { status: 500 })
    }

    console.log(`[Matchmaking ${requestId}] 📦 RPC Response received`)
    console.log(`[Matchmaking ${requestId}] Full payload:`, JSON.stringify(payload, null, 2))

    // Check for errors from RPC
    if (payload.error) {
      console.error(`[Matchmaking ${requestId}] ❌ 400 - RPC_RETURNED_ERROR`)
      console.error(`[Matchmaking ${requestId}]   code:`, payload.error)
      console.error(`[Matchmaking ${requestId}]   message:`, payload.message)
      console.error(`[Matchmaking ${requestId}]   full payload:`, JSON.stringify(payload, null, 2))
      return NextResponse.json({
        ok: false,
        code: payload.error,
        message: payload.message || 'Matchmaking validation failed',
        details: payload
      }, { status: 400 })
    }

    const elapsed = Date.now() - startTime
    console.log(`[Matchmaking ${requestId}] ✅ SUCCESS in ${elapsed}ms`)
    console.log(`[Matchmaking ${requestId}]   - status: ${payload.status}`)
    console.log(`[Matchmaking ${requestId}]   - matchId: ${payload.matchId}`)
    console.log(`[Matchmaking ${requestId}]   - myRole: ${payload.myRole}`)
    console.log(`[Matchmaking ${requestId}]   - playerA.userId: ${payload.playerA?.userId}`)
    console.log(`[Matchmaking ${requestId}]   - playerA.trainerId: ${payload.playerA?.trainerId}`)
    console.log(`[Matchmaking ${requestId}]   - playerA.team: ${payload.playerA?.team ? `[${payload.playerA.team.length} Pokemon]` : 'null'}`)
    console.log(`[Matchmaking ${requestId}]   - playerB.userId: ${payload.playerB?.userId}`)
    console.log(`[Matchmaking ${requestId}]   - playerB.trainerId: ${payload.playerB?.trainerId}`)
    console.log(`[Matchmaking ${requestId}]   - playerB.team: ${payload.playerB?.team ? `[${payload.playerB.team.length} Pokemon]` : 'null'}`)
    console.log(`[Matchmaking ${requestId}]   - opponent.userId: ${payload.opponent?.userId}`)
    console.log(`[Matchmaking ${requestId}]   - arenaId: ${payload.arenaId}`)
    console.log(`[Matchmaking ${requestId}]   - battleSeed: ${payload.battleSeed}`)
    console.log(`[Matchmaking ${requestId}] RETURNED JSON TO CLIENT:`, JSON.stringify(payload, null, 2))
    console.log(`[Matchmaking ${requestId}] ==================== END ====================`)

    return NextResponse.json(payload)

  } catch (err: any) {
    const elapsed = Date.now() - startTime
    console.error(`[Matchmaking ${requestId}] ❌ 500 - EXCEPTION after ${elapsed}ms`)
    console.error(`[Matchmaking ${requestId}]   error:`, err)
    console.error(`[Matchmaking ${requestId}]   stack:`, err?.stack)
    return NextResponse.json({ 
      ok: false, 
      code: 'INTERNAL_ERROR', 
      message: 'Unexpected server error',
      details: { error: err?.message, stack: err?.stack }
    }, { status: 500 })
  }
}
