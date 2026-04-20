/**
 * POST /api/match/[matchId]/ack/arena
 * 
 * Player acknowledges they completed arena reveal animation
 * Match only advances to battle_ready when BOTH players have acked
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

    // Get match
    const { data: match, error: matchError } = await supabaseAdmin
      .from('matches')
      .select('id, player_a_id, player_b_id, status, player_a_arena_ack, player_b_arena_ack')
      .eq('id', matchId)
      .single()

    if (matchError || !match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 })
    }

    // Verify user is a player
    if (match.player_a_id !== user.id && match.player_b_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const isPlayerA = match.player_a_id === user.id

    // Set ack
    const updateField = isPlayerA ? 'player_a_arena_ack' : 'player_b_arena_ack'
    const { error: updateError } = await supabaseAdmin
      .from('matches')
      .update({ [updateField]: true })
      .eq('id', matchId)

    if (updateError) {
      console.error('[AckArena] Update failed:', updateError)
      return NextResponse.json({ error: 'Failed to set ack' }, { status: 500 })
    }

    console.log(`[AckArena] Player ${isPlayerA ? 'A' : 'B'} (${user.id}) acked arena for match ${matchId}`)

    // Check if both players have acked
    const bothAcked = isPlayerA 
      ? match.player_b_arena_ack 
      : match.player_a_arena_ack

    // If both acked AND status is still 'arena_reveal', advance to battle_ready
    if (bothAcked && match.status === 'arena_reveal') {
      const { error: statusError } = await supabaseAdmin
        .from('matches')
        .update({ status: 'battle_ready', updated_at: new Date().toISOString() })
        .eq('id', matchId)
        .eq('status', 'arena_reveal')

      if (statusError) {
        console.error('[AckArena] Status update failed:', statusError)
      } else {
        console.log(`[AckArena] Both players acked - advancing match ${matchId} to battle_ready`)
      }
    }

    return NextResponse.json({
      success: true,
      myAck: true,
      bothAcked,
      nextStatus: bothAcked ? 'battle_ready' : 'arena_reveal',
    })

  } catch (err) {
    console.error('[AckArena] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
