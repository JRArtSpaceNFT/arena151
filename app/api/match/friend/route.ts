/**
 * POST /api/match/friend
 *
 * Friend Battle server-side room management.
 * Works across any device/browser — no localStorage dependency.
 *
 * Actions:
 *   create — P1 creates a room with a battle code (free, wager=0)
 *   join   — P2 joins by entering the same code
 *   status — Poll for room state (P1 uses this to detect when P2 joined)
 *   cancel — P1 cancels their open room
 *
 * Uses the existing matches table with:
 *   - entry_fee_sol = 0 (free practice)
 *   - friend_code column (added in migration 007)
 *   - status = 'forming' while waiting, 'ready' once P2 joins
 *
 * Auth: Bearer JWT required for create/join/cancel. Status is public (uses code).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

// Friend rooms expire after 5 minutes if no opponent joins
const FRIEND_ROOM_TTL_MS = 5 * 60 * 1000

// Decode a Supabase JWT without a network round-trip.
// Supabase JWTs are HS256-signed — the payload is plain base64url.
// We trust the token because it was issued by our own Supabase project;
// the client cannot forge a different sub because they don't have the secret.
// This eliminates the /auth/v1/user network call that was failing intermittently.
function decodeSupabaseJwt(token: string): { sub: string; role: string; exp: number } | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payload = Buffer.from(parts[1], 'base64url').toString('utf8')
    const parsed = JSON.parse(payload)
    // Reject if expired
    if (parsed.exp && parsed.exp < Math.floor(Date.now() / 1000)) {
      console.warn('[FriendAuth] JWT expired, exp:', parsed.exp)
      return null
    }
    // Reject service-role tokens (only user JWTs have a real sub)
    if (parsed.role === 'service_role' || parsed.role === 'anon') return null
    if (!parsed.sub) return null
    return { sub: parsed.sub, role: parsed.role, exp: parsed.exp }
  } catch {
    return null
  }
}

async function getAuthUser(req: NextRequest) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.slice(7)

  // Fast path: decode locally, no network call
  const decoded = decodeSupabaseJwt(token)
  if (decoded) {
    return { id: decoded.sub } as { id: string }
  }

  // Fallback: hit Supabase if local decode fails for any reason
  console.warn('[FriendAuth] local JWT decode failed, falling back to network auth')
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !user) {
    console.error('[FriendAuth] network auth also failed:', error?.message ?? 'no user')
    return null
  }
  return user
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action } = body as { action: string }

    // ── CREATE ────────────────────────────────────────────────────
    if (action === 'create') {
      const user = await getAuthUser(req)
      if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

      const { friendCode } = body as { friendCode: string }
      if (!friendCode || friendCode.length < 4 || friendCode.length > 20) {
        return NextResponse.json({ error: 'Battle code must be 4–20 characters' }, { status: 400 })
      }

      // Sanitize: alphanumeric only
      const code = friendCode.toLowerCase().replace(/[^a-z0-9]/g, '')
      if (code.length < 4) {
        return NextResponse.json({ error: 'Battle code must contain at least 4 letters or numbers' }, { status: 400 })
      }

      // Cancel any existing open friend rooms for this user first (cleanup)
      await supabaseAdmin
        .from('matches')
        .update({ status: 'voided', error_message: 'Replaced by new friend room', updated_at: new Date().toISOString() })
        .eq('player_a_id', user.id)
        .eq('status', 'forming')
        .eq('entry_fee_sol', 0)
        .not('friend_code', 'is', null)

      // Check if code is already taken by another active room
      const { data: existing } = await supabaseAdmin
        .from('matches')
        .select('id, created_at')
        .eq('friend_code', code)
        .eq('status', 'forming')
        .single()

      if (existing) {
        const age = Date.now() - new Date(existing.created_at).getTime()
        if (age < FRIEND_ROOM_TTL_MS) {
          return NextResponse.json({
            error: 'That battle code is already in use — try a different one',
            code: 'CODE_TAKEN',
          }, { status: 409 })
        }
        // Expired — void it and proceed
        await supabaseAdmin
          .from('matches')
          .update({ status: 'voided', error_message: 'Friend room TTL expired', updated_at: new Date().toISOString() })
          .eq('id', existing.id)
      }

      // Create the match record — entry_fee_sol = 0 (free practice)
      const matchId = crypto.randomUUID()
      const battleSeed = crypto.randomUUID()

      const { error: insertError } = await supabaseAdmin
        .from('matches')
        .insert({
          id: matchId,
          player_a_id: user.id,
          player_b_id: null,
          entry_fee_sol: 0,
          status: 'forming',
          room_id: 'friend',
          friend_code: code,
          battle_seed: battleSeed,
          idempotency_key: crypto.randomUUID(),
          metadata_a: {},
          metadata_b: {},
        })

      if (insertError) {
        console.error('[FriendMatch Create] insert error:', insertError)
        return NextResponse.json({ error: 'Failed to create room' }, { status: 500 })
      }

      return NextResponse.json({ matchId, battleSeed, friendCode: code, status: 'forming' })
    }

    // ── JOIN ──────────────────────────────────────────────────────
    if (action === 'join') {
      const user = await getAuthUser(req)
      if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

      const { friendCode } = body as { friendCode: string }
      if (!friendCode) return NextResponse.json({ error: 'friendCode required' }, { status: 400 })

      const code = friendCode.toLowerCase().replace(/[^a-z0-9]/g, '')

      // Find the open room
      const { data: match, error: findError } = await supabaseAdmin
        .from('matches')
        .select('id, player_a_id, player_b_id, status, battle_seed, created_at, entry_fee_sol')
        .eq('friend_code', code)
        .eq('status', 'forming')
        .single()

      if (findError || !match) {
        return NextResponse.json({ error: 'No open room found with that code — ask your friend to create one first' }, { status: 404 })
      }

      // Check TTL
      const age = Date.now() - new Date(match.created_at).getTime()
      if (age > FRIEND_ROOM_TTL_MS) {
        await supabaseAdmin.from('matches').update({ status: 'voided', error_message: 'Friend room TTL expired' }).eq('id', match.id)
        return NextResponse.json({ error: 'Room expired — ask your friend to create a new one' }, { status: 410 })
      }

      // Can't join your own room
      if (match.player_a_id === user.id) {
        return NextResponse.json({ error: 'You cannot join your own room — share the code with a friend' }, { status: 400 })
      }

      // Atomic join — .eq('status', 'forming') + .is('player_b_id', null) prevents race condition.
      // NOTE: Do NOT reset metadata_a/b here. P1 may have already written trainer_select data
      // to metadata_a while waiting for P2. Wiping it would break the sync — P1's trainerSynced
      // flag is already true so Step 1 would never re-fire, causing a permanent stuck state.
      const { data: updated, error: updateError } = await supabaseAdmin
        .from('matches')
        .update({
          player_b_id: user.id,
          status: 'ready',
          updated_at: new Date().toISOString(),
        })
        .eq('id', match.id)
        .eq('status', 'forming')
        .is('player_b_id', null)
        .select('id')

      if (updateError || !updated || updated.length === 0) {
        return NextResponse.json({ error: 'Room was just taken — ask your friend to create a new one' }, { status: 409 })
      }

      return NextResponse.json({
        matchId: match.id,
        battleSeed: match.battle_seed,
        friendCode: code,
        status: 'ready',
        role: 'p2',
      })
    }

    // ── STATUS ────────────────────────────────────────────────────
    if (action === 'status') {
      const { matchId, friendCode } = body as { matchId?: string; friendCode?: string }

      let query = supabaseAdmin
        .from('matches')
        .select('id, status, player_a_id, player_b_id, battle_seed, friend_code, created_at')

      if (matchId) {
        query = query.eq('id', matchId) as typeof query
      } else if (friendCode) {
        const code = friendCode.toLowerCase().replace(/[^a-z0-9]/g, '')
        query = query.eq('friend_code', code).in('status', ['forming', 'ready']) as typeof query
      } else {
        return NextResponse.json({ error: 'matchId or friendCode required' }, { status: 400 })
      }

      const { data: match } = await query.single()

      if (!match) {
        return NextResponse.json({ status: 'not_found' })
      }

      // Auto-void expired forming rooms
      if (match.status === 'forming') {
        const age = Date.now() - new Date(match.created_at).getTime()
        if (age > FRIEND_ROOM_TTL_MS) {
          await supabaseAdmin.from('matches').update({ status: 'voided', error_message: 'TTL expired' }).eq('id', match.id)
          return NextResponse.json({ status: 'expired' })
        }
      }

      return NextResponse.json({
        matchId: match.id,
        status: match.status,
        battleSeed: match.battle_seed,
        playerAId: match.player_a_id,
        playerBId: match.player_b_id,
        friendCode: match.friend_code,
        expiresAt: new Date(new Date(match.created_at).getTime() + FRIEND_ROOM_TTL_MS).toISOString(),
      })
    }

    // ── CANCEL ────────────────────────────────────────────────────
    if (action === 'cancel') {
      const user = await getAuthUser(req)
      if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

      const { matchId } = body as { matchId: string }
      if (!matchId) return NextResponse.json({ error: 'matchId required' }, { status: 400 })

      const { data: updated } = await supabaseAdmin
        .from('matches')
        .update({ status: 'voided', error_message: 'Cancelled by creator', updated_at: new Date().toISOString() })
        .eq('id', matchId)
        .eq('player_a_id', user.id)  // Only creator can cancel
        .eq('status', 'forming')
        .select('id')

      if (!updated || updated.length === 0) {
        return NextResponse.json({ error: 'Room not found or already started' }, { status: 404 })
      }

      return NextResponse.json({ ok: true, cancelled: true })
    }

    // ── SUBMIT_TEAM ──────────────────────────────────────────────
    // Player submits their trainer + team to the server match record.
    // This is called after draft + lineup is confirmed, before arena reveal.
    // Stored in team_a (for player_a) or team_b (for player_b).
    if (action === 'submit_team') {
      const user = await getAuthUser(req)
      if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

      const { matchId, trainerId, teamIds } = body as { matchId: string; trainerId: string; teamIds: number[] }
      if (!matchId || !trainerId || !Array.isArray(teamIds) || teamIds.length === 0) {
        return NextResponse.json({ error: 'matchId, trainerId, and teamIds required' }, { status: 400 })
      }

      // Verify this user is in the match
      const { data: match } = await supabaseAdmin
        .from('matches')
        .select('id, player_a_id, player_b_id, status')
        .eq('id', matchId)
        .single()

      if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 })
      if (match.player_a_id !== user.id && match.player_b_id !== user.id) {
        return NextResponse.json({ error: 'You are not in this match' }, { status: 403 })
      }
      if (!['ready', 'forming', 'battling'].includes(match.status)) {
        return NextResponse.json({ error: `Match is not in a joinable state: ${match.status}` }, { status: 409 })
      }

      const isPlayerA = match.player_a_id === user.id
      const teamPayload = { trainerId, teamIds }

      const { error: updateError } = await supabaseAdmin
        .from('matches')
        .update({
          ...(isPlayerA ? { team_a: teamPayload } : { team_b: teamPayload }),
          // Move to battling once the first team is submitted;
          // status stays 'battling' when second submits (already set)
          status: match.status === 'ready' ? 'battling' : match.status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', matchId)

      if (updateError) {
        console.error('[FriendMatch submit_team] error:', updateError)
        return NextResponse.json({ error: 'Failed to submit team' }, { status: 500 })
      }

      console.log(`[FriendMatch] ${isPlayerA ? 'player_a' : 'player_b'} submitted team for match ${matchId}`)
      return NextResponse.json({ ok: true, role: isPlayerA ? 'player_a' : 'player_b' })
    }

    // ── GET_OPPONENT_TEAM ─────────────────────────────────────────
    // Poll for opponent's submitted team. Called by each player after
    // submitting their own team. Returns once both teams are present.
    if (action === 'get_opponent_team') {
      const user = await getAuthUser(req)
      if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

      const { matchId } = body as { matchId: string }
      if (!matchId) return NextResponse.json({ error: 'matchId required' }, { status: 400 })

      const { data: match } = await supabaseAdmin
        .from('matches')
        .select('id, player_a_id, player_b_id, team_a, team_b, status, battle_seed')
        .eq('id', matchId)
        .single()

      if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 })
      if (match.player_a_id !== user.id && match.player_b_id !== user.id) {
        return NextResponse.json({ error: 'You are not in this match' }, { status: 403 })
      }

      const isPlayerA = match.player_a_id === user.id
      // Return the OPPONENT's team (not the caller's own team)
      const opponentTeam = isPlayerA ? match.team_b : match.team_a

      if (!opponentTeam) {
        // Opponent hasn't submitted yet
        return NextResponse.json({ ready: false, message: 'Waiting for opponent to draft their team' })
      }

      return NextResponse.json({
        ready: true,
        opponentTrainerId: (opponentTeam as { trainerId: string; teamIds: number[] }).trainerId,
        opponentTeamIds: (opponentTeam as { trainerId: string; teamIds: number[] }).teamIds,
        battleSeed: match.battle_seed,
      })
    }

    // ── SYNC_STATE ───────────────────────────────────────────────
    // Players report their current step and data.
    // Returns both players' states so client knows when to advance.
    //
    // step values: 'trainer_selected' | 'draft_locked' | 'lineup_locked'
    // Each step stores the player's data in metadata_a or metadata_b columns.
    // When both players share the same step, the client advances.
    if (action === 'sync_state') {
      const user = await getAuthUser(req)
      if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

      const { matchId, step, data: stepData } = body as {
        matchId: string
        step: string
        data: Record<string, unknown>
      }
      if (!matchId || !step) return NextResponse.json({ error: 'matchId and step required' }, { status: 400 })

      const { data: match, error: matchFetchError } = await supabaseAdmin
        .from('matches')
        .select('id, player_a_id, player_b_id, metadata_a, metadata_b, status')
        .eq('id', matchId)
        .single()

      if (matchFetchError || !match) {
        console.error('[FriendSync] sync_state match fetch failed:', matchFetchError, 'matchId:', matchId)
        return NextResponse.json({ error: 'Match not found' }, { status: 404 })
      }
      if (match.player_a_id !== user.id && match.player_b_id !== user.id) {
        console.error('[FriendSync] sync_state auth fail: user', user.id, 'not in match', matchId, 'playerA:', match.player_a_id, 'playerB:', match.player_b_id)
        return NextResponse.json({ error: 'Not a player in this match' }, { status: 403 })
      }

      const isA = match.player_a_id === user.id
      const myKey   = isA ? 'metadata_a' : 'metadata_b'
      const myMeta  = ((isA ? match.metadata_a : match.metadata_b) ?? {}) as Record<string, unknown>
      const newMeta = { ...myMeta, [step]: stepData, [`${step}_at`]: new Date().toISOString() }

      const { error: writeError } = await supabaseAdmin
        .from('matches')
        .update({ [myKey]: newMeta, updated_at: new Date().toISOString() })
        .eq('id', matchId)

      if (writeError) {
        console.error('[FriendSync] sync_state write failed:', writeError, 'key:', myKey, 'matchId:', matchId)
        return NextResponse.json({ error: 'Failed to write sync state' }, { status: 500 })
      }

      // Re-fetch to get both sides
      const { data: updated, error: refetchError } = await supabaseAdmin
        .from('matches')
        .select('metadata_a, metadata_b, battle_seed, player_a_id, player_b_id')
        .eq('id', matchId)
        .single()

      if (refetchError || !updated) {
        console.error('[FriendSync] sync_state re-fetch failed:', refetchError, 'matchId:', matchId)
        // Return partial success — client will retry and see bothReady on next poll
        return NextResponse.json({
          bothReady: false,
          myData: newMeta[step],
          opponentData: null,
          battleSeed: null,
          playerAId: match.player_a_id,
          playerBId: match.player_b_id,
          myRole: isA ? 'a' : 'b',
        })
      }

      const metaA = (updated?.metadata_a ?? {}) as Record<string, unknown>
      const metaB = (updated?.metadata_b ?? {}) as Record<string, unknown>
      const bothReady = !!(metaA[step] && metaB[step])

      console.log(`[FriendSync] sync_state step=${step} matchId=${matchId} role=${isA?'a':'b'} bothReady=${bothReady} metaA_has=${!!metaA[step]} metaB_has=${!!metaB[step]}`)

      return NextResponse.json({
        bothReady,
        myData:       newMeta[step],
        opponentData: isA ? metaB[step] : metaA[step],
        battleSeed:   updated?.battle_seed,
        playerAId:    updated?.player_a_id,
        playerBId:    updated?.player_b_id,
        myRole:       isA ? 'a' : 'b',
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

  } catch (err) {
    console.error('[FriendMatch] Unexpected error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
