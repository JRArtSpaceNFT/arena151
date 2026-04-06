/**
 * GET /api/match/[matchId]/resume
 *
 * Called when a player refreshes mid-match and needs to re-enter the correct phase.
 * Returns everything needed to resume without re-calling join or create.
 *
 * Response:
 *   myRole:      'player_a' | 'player_b'
 *   status:      match status
 *   battleSeed:  shared seed
 *   teamA:       player_a's team IDs
 *   teamB:       player_b's team IDs (null if not yet joined)
 *   winnerId:    server-computed winner (null if not yet settled)
 *   entryFeeSol: wager amount
 *   resumePhase: 'waiting_p2' | 'battle_ready' | 'settled' | 'abandoned'
 *
 * resumePhase tells the client exactly where to resume:
 *   waiting_p2    → P1 should return to ArenaReveal and wait for P2
 *   battle_ready  → both joined; compute canonical battle and go to battle screen
 *   settled       → match already settled; show result — includes full resultPayload
 *   abandoned     → match voided/refunded; show error
 *
 * When resumePhase === 'settled', the response also includes:
 *   resultPayload: {
 *     winnerId:       string — UUID of the winner
 *     myRole:         'player_a' | 'player_b'
 *     iWon:           boolean
 *     entryFeeSol:    number
 *     payoutDelta:    number — net SOL change for caller (+winner, -loser)
 *     finalStatus:    string — e.g. 'settled'
 *     battleSeed:     string
 *     settlementTx:   string | null
 *     myProfile:      { id, username, displayName, balance, wins, losses, badges, avatar }
 *     opponentProfile: { id, username, displayName } | null
 *     roomId:         string | null
 *   }
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
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { data: { user }, error: authErr } = await supabaseAnon.auth.getUser(authHeader.slice(7))
    if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { matchId } = await params

    const { data: match, error } = await supabaseAdmin
      .from('matches')
      .select('id, player_a_id, player_b_id, status, battle_seed, team_a, team_b, winner_id, entry_fee_sol, settlement_tx, room_id')
      .eq('id', matchId)
      .single()

    if (error || !match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 })
    }

    // Caller must be one of the two players
    const isPlayerA = match.player_a_id === user.id
    const isPlayerB = match.player_b_id === user.id
    if (!isPlayerA && !isPlayerB) {
      return NextResponse.json({ error: 'You are not a player in this match' }, { status: 403 })
    }

    const myRole = isPlayerA ? 'player_a' : 'player_b'

    // Determine resume phase
    let resumePhase: string
    if (['voided', 'refunded', 'manual_review', 'settlement_failed'].includes(match.status)) {
      resumePhase = 'abandoned'
    } else if (match.status === 'settled') {
      resumePhase = 'settled'
    } else if (
      ['settlement_pending', 'settling', 'battling', 'result_pending', 'ready', 'funds_locked'].includes(match.status)
      && match.team_a && match.team_b
    ) {
      resumePhase = 'battle_ready'
    } else if (match.status === 'forming') {
      resumePhase = 'waiting_p2'
    } else {
      resumePhase = 'battle_ready' // default: attempt to proceed
    }

    // Base response for all phases
    const baseResponse = {
      myRole,
      status:      match.status,
      battleSeed:  match.battle_seed,
      teamA:       match.team_a,
      teamB:       match.team_b,
      winnerId:    match.winner_id,
      entryFeeSol: Number(match.entry_fee_sol),
      settlementTx: match.settlement_tx,
      resumePhase,
      matchId:     match.id,
    }

    // For settled matches, enrich with a full result payload so the client can
    // render ResultScreen without any in-memory Zustand state.
    if (resumePhase === 'settled' && match.winner_id) {
      const winnerId = match.winner_id as string
      const iWon = (
        (myRole === 'player_a' && winnerId === match.player_a_id) ||
        (myRole === 'player_b' && winnerId === match.player_b_id)
      )
      const entryFee = Number(match.entry_fee_sol)
      // Winner receives 2× entry minus any platform fee (currently 0% — net = +entryFee).
      // Loser loses their entry (net = -entryFee).
      const payoutDelta = iWon ? entryFee : -entryFee

      // Fetch caller's profile
      const { data: myProfile } = await supabaseAdmin
        .from('profiles')
        .select('id, username, display_name, balance, wins, losses, badges, avatar')
        .eq('id', user.id)
        .single()

      // Fetch opponent's profile (may be null if match was voided before P2 joined)
      const opponentId = myRole === 'player_a' ? match.player_b_id : match.player_a_id
      let opponentProfile: { id: string; username: string; displayName: string } | null = null
      if (opponentId) {
        const { data: opp } = await supabaseAdmin
          .from('profiles')
          .select('id, username, display_name')
          .eq('id', opponentId)
          .single()
        if (opp) {
          opponentProfile = {
            id: opp.id,
            username: opp.username,
            displayName: opp.display_name,
          }
        }
      }

      return NextResponse.json({
        ...baseResponse,
        resultPayload: {
          winnerId,
          myRole,
          iWon,
          entryFeeSol:     entryFee,
          payoutDelta,
          finalStatus:     match.status,
          battleSeed:      match.battle_seed ?? null,
          settlementTx:    match.settlement_tx ?? null,
          roomId:          match.room_id ?? null,
          myProfile:       myProfile ? {
            id:          myProfile.id,
            username:    myProfile.username,
            displayName: myProfile.display_name,
            balance:     Number(myProfile.balance ?? 0),
            wins:        myProfile.wins ?? 0,
            losses:      myProfile.losses ?? 0,
            badges:      myProfile.badges ?? [],
            avatar:      myProfile.avatar ?? '🧑',
          } : null,
          opponentProfile,
        },
      })
    }

    return NextResponse.json(baseResponse)

  } catch (err) {
    console.error('[MatchResume] Unexpected error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
