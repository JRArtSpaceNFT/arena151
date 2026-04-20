/**
 * POST /api/match/[matchId]/ack/matched
 * 
 * Player acknowledges they received and validated the matched payload
 * Match only advances to arena_reveal when BOTH players have acked
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
      .select('id, player_a_id, player_b_id, status, player_a_match_ack, player_b_match_ack')
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
    const updateField = isPlayerA ? 'player_a_match_ack' : 'player_b_match_ack'
    const { error: updateError } = await supabaseAdmin
      .from('matches')
      .update({ [updateField]: true })
      .eq('id', matchId)

    if (updateError) {
      console.error('[AckMatched] Update failed:', updateError)
      return NextResponse.json({ error: 'Failed to set ack' }, { status: 500 })
    }

    console.log(`[AckMatched] Player ${isPlayerA ? 'A' : 'B'} (${user.id}) acked match ${matchId}`)

    // Check if both players have acked
    const bothAcked = isPlayerA 
      ? match.player_b_match_ack 
      : match.player_a_match_ack

    // If both acked AND status is still 'matched', advance to arena_reveal
    if (bothAcked && match.status === 'matched') {
      const { error: statusError } = await supabaseAdmin
        .from('matches')
        .update({ status: 'arena_reveal', updated_at: new Date().toISOString() })
        .eq('id', matchId)
        .eq('status', 'matched') // Only if still in matched state

      if (statusError) {
        console.error('[AckMatched] Status update failed:', statusError)
      } else {
        console.log(`[AckMatched] Both players acked - advancing match ${matchId} to arena_reveal`)
      }
    }

    return NextResponse.json({
      success: true,
      myAck: true,
      bothAcked,
      nextStatus: bothAcked ? 'arena_reveal' : 'matched',
    })

  } catch (err) {
    console.error('[AckMatched] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
