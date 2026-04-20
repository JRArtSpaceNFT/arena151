/**
 * GET /api/match/[matchId]/canonical
 * 
 * Returns canonical match payload for client hydration
 * Single source of truth for all match data
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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  try {
    const { matchId } = await params

    // Auth
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.slice(7)
    const { data: { user }, error: authError } = await supabaseAnon.auth.getUser(token)
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Call RPC to get canonical payload
    const { data: payload, error: rpcError } = await supabaseAdmin.rpc(
      'get_canonical_match_payload',
      {
        p_match_id: matchId,
        p_requesting_user_id: user.id,
      }
    )

    if (rpcError) {
      console.error('[Canonical] RPC error:', rpcError)
      return NextResponse.json({ error: 'Failed to fetch match payload' }, { status: 500 })
    }

    if (payload?.error) {
      return NextResponse.json({ error: payload.error }, { status: 404 })
    }

    console.log(`[Canonical] Returning payload for match ${matchId}, user ${user.id}, role ${payload.myRole}`)

    return NextResponse.json(payload)

  } catch (err) {
    console.error('[Canonical] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
