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
  const requestId = Math.random().toString(36).slice(2, 10)
  
  console.log(`[Matchmaking ${requestId}] START V2`)

  try {
    // Auth
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.slice(7)
    const { data: { user }, error: authError } = await supabaseAnon.auth.getUser(token)
    
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const userId = user.id
    console.log(`[Matchmaking ${requestId}] User: ${userId}`)

    // Parse request
    const body = await req.json()
    const { roomId } = body

    if (!roomId || typeof roomId !== 'string') {
      return NextResponse.json({ success: false, error: 'Missing or invalid roomId' }, { status: 400 })
    }

    const roomTier = ROOM_TIERS[roomId]
    if (!roomTier) {
      return NextResponse.json({ success: false, error: 'Invalid roomId' }, { status: 400 })
    }

    const entryFeeSol = roomTier.entryFee

    console.log(`[Matchmaking ${requestId}] Room: ${roomId} | Entry fee: ${entryFeeSol} SOL`)

    // Call atomic RPC V2
    const { data: payload, error: rpcError } = await supabaseAdmin.rpc(
      'atomic_join_or_create_paid_match_v2',
      {
        p_user_id: userId,
        p_room_id: roomId,
        p_entry_fee: entryFeeSol,
      }
    )

    if (rpcError) {
      console.error(`[Matchmaking ${requestId}] RPC ERROR:`, rpcError)
      return NextResponse.json({ success: false, error: 'Matchmaking RPC failed', details: rpcError.message }, { status: 500 })
    }

    if (!payload) {
      console.error(`[Matchmaking ${requestId}] RPC returned null`)
      return NextResponse.json({ success: false, error: 'Matchmaking RPC returned no data' }, { status: 500 })
    }

    // Check for errors from RPC
    if (payload.error) {
      console.log(`[Matchmaking ${requestId}] RPC returned error:`, payload.error)
      return NextResponse.json({
        success: false,
        error: payload.error,
        message: payload.message,
      }, { status: 400 })
    }

    const elapsed = Date.now() - startTime
    console.log(`[Matchmaking ${requestId}] SUCCESS in ${elapsed}ms | Status: ${payload.status} | Match: ${payload.matchId}`)

    return NextResponse.json(payload)

  } catch (err) {
    const elapsed = Date.now() - startTime
    console.error(`[Matchmaking ${requestId}] EXCEPTION after ${elapsed}ms:`, err)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
