/**
 * POST /api/matchmaking/paid/join
 * 
 * Server-authoritative atomic matchmaking endpoint.
 * Replaces client-side "search then create" flow with single server call.
 * 
 * Flow:
 * 1. Validate authenticated user
 * 2. Call atomic_join_or_create_paid_match RPC (server-side transaction with row locking)
 * 3. Return final match record + role assignment
 * 
 * The RPC guarantees:
 * - Only ONE concurrent requester can claim a given open match
 * - No duplicate queue entries for the same user
 * - Atomic fund locking with TOCTOU-safe checks
 * - Idempotent: returns existing active match if user already queued
 * 
 * Security:
 * - Auth required (Bearer JWT)
 * - Entry fee validation (max 10 SOL)
 * - Room validation
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

interface MatchmakingRequest {
  roomId: string
  teamA?: any
}

interface MatchmakingResponse {
  success: boolean
  matchId?: string
  role?: 'player_a' | 'player_b'
  status?: 'forming' | 'ready' | 'settlement_pending'
  battleSeed?: string
  entryFeeSol?: number
  teamA?: any
  teamB?: any
  winnerId?: string
  createdNew?: boolean
  resumed?: boolean
  playerAId?: string
  playerBId?: string
  error?: string
  code?: string
}

export async function POST(req: NextRequest) {
  const startTime = Date.now()
  const requestId = Math.random().toString(36).slice(2, 10)
  
  console.log(`[Matchmaking ${requestId}] START`)

  try {
    // ── Auth ──────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      console.log(`[Matchmaking ${requestId}] REJECT: No auth header`)
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.slice(7)
    const { data: { user: authUser }, error: authError } = await supabaseAnon.auth.getUser(token)
    
    if (authError || !authUser) {
      console.log(`[Matchmaking ${requestId}] REJECT: Auth failed`, authError?.message)
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const userId = authUser.id
    console.log(`[Matchmaking ${requestId}] User: ${userId}`)

    // ── Parse request ─────────────────────────────────────────
    const body: MatchmakingRequest = await req.json()
    const { roomId, teamA } = body

    if (!roomId || typeof roomId !== 'string') {
      console.log(`[Matchmaking ${requestId}] REJECT: Invalid roomId`)
      return NextResponse.json(
        { success: false, error: 'Missing or invalid roomId' },
        { status: 400 }
      )
    }

    const roomTier = ROOM_TIERS[roomId]
    if (!roomTier) {
      console.log(`[Matchmaking ${requestId}] REJECT: Unknown room ${roomId}`)
      return NextResponse.json(
        { success: false, error: 'Invalid roomId' },
        { status: 400 }
      )
    }

    const entryFeeSol = roomTier.entryFee

    if (entryFeeSol > 10) {
      console.log(`[Matchmaking ${requestId}] REJECT: Entry fee ${entryFeeSol} exceeds max`)
      return NextResponse.json(
        { success: false, error: 'Entry fee exceeds maximum (10 SOL)' },
        { status: 400 }
      )
    }

    console.log(`[Matchmaking ${requestId}] Room: ${roomId} | Entry fee: ${entryFeeSol} SOL`)

    // ── Call atomic RPC ───────────────────────────────────────
    console.log(`[Matchmaking ${requestId}] Calling atomic_join_or_create_paid_match RPC`)
    
    const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc(
      'atomic_join_or_create_paid_match',
      {
        p_user_id: userId,
        p_room_id: roomId,
        p_entry_fee: entryFeeSol,
        p_team_a: teamA ? JSON.stringify(teamA) : null,
      }
    )

    if (rpcError) {
      console.error(`[Matchmaking ${requestId}] RPC ERROR:`, rpcError)
      return NextResponse.json(
        { success: false, error: 'Matchmaking RPC failed', details: rpcError.message },
        { status: 500 }
      )
    }

    if (!rpcData) {
      console.error(`[Matchmaking ${requestId}] RPC returned null`)
      return NextResponse.json(
        { success: false, error: 'Matchmaking RPC returned no data' },
        { status: 500 }
      )
    }

    console.log(`[Matchmaking ${requestId}] RPC SUCCESS:`, JSON.stringify(rpcData, null, 2))

    // ── Parse RPC response ────────────────────────────────────
    if (!rpcData.success) {
      // RPC returned error (e.g., insufficient funds)
      console.log(`[Matchmaking ${requestId}] RPC returned failure:`, rpcData.error)
      return NextResponse.json(
        {
          success: false,
          error: rpcData.error || 'Matchmaking failed',
          code: rpcData.error === 'INSUFFICIENT_FUNDS' ? 'INSUFFICIENT_FUNDS' : 'MATCHMAKING_FAILED',
          details: rpcData.details,
        },
        { status: 400 }
      )
    }

    const elapsed = Date.now() - startTime
    console.log(`[Matchmaking ${requestId}] SUCCESS in ${elapsed}ms | Role: ${rpcData.role} | Match: ${rpcData.matchId} | Status: ${rpcData.status} | CreatedNew: ${rpcData.createdNew} | Resumed: ${rpcData.resumed}`)

    const response: MatchmakingResponse = {
      success: true,
      matchId: rpcData.matchId,
      role: rpcData.role,
      status: rpcData.status,
      battleSeed: rpcData.battleSeed,
      entryFeeSol: rpcData.entryFeeSol,
      teamA: rpcData.teamA,
      teamB: rpcData.teamB,
      winnerId: rpcData.winnerId,
      createdNew: rpcData.createdNew,
      resumed: rpcData.resumed,
      playerAId: rpcData.playerAId,
      playerBId: rpcData.playerBId,
    }

    return NextResponse.json(response)

  } catch (err) {
    const elapsed = Date.now() - startTime
    console.error(`[Matchmaking ${requestId}] EXCEPTION after ${elapsed}ms:`, err)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
