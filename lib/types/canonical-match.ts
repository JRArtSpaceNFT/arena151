/**
 * Canonical Match Payload - Single source of truth for paid PVP matches
 * 
 * This is the ONLY data structure that should be used to render:
 * - Versus screen
 * - Arena reveal
 * - Battle
 * 
 * All screens must validate this payload is complete before rendering.
 */

export type MatchStatus = 
  | 'drafting'
  | 'ready_for_queue'
  | 'queueing'
  | 'matched'
  | 'arena_reveal'
  | 'battle_ready'
  | 'battling'
  | 'settlement_pending'
  | 'settled'
  | 'cancelled'
  | 'voided'

export interface CanonicalMatchPayload {
  matchId: string
  status: MatchStatus
  arenaId: string
  battleSeed: string
  entryFeeSol: number
  playerA: {
    userId: string
    username: string
    trainerId: string
    trainerName?: string
    team: number[]  // pokemon IDs
    lockedOrder: number[]  // battle order
  }
  playerB: {
    userId: string
    username: string
    trainerId: string
    trainerName?: string
    team: number[]
    lockedOrder: number[]
  }
  myRole: 'player_a' | 'player_b'
  opponent: {
    userId: string
    username: string
    trainerId: string
    trainerName?: string
  }
  acks: {
    playerAMatchAck: boolean
    playerBMatchAck: boolean
    playerAArenaAck: boolean
    playerBArenaAck: boolean
  }
}

/**
 * Validate canonical payload has all required fields
 * Returns error message if invalid, null if valid
 */
export function validateCanonicalPayload(payload: any): string | null {
  console.log('[Validator] Starting validation...')
  
  if (!payload) {
    console.error('[Validator] FAIL: payload is null or undefined')
    return 'Payload is null or undefined'
  }
  
  if (!payload.matchId) {
    console.error('[Validator] FAIL: missing field "matchId"')
    return 'Missing matchId'
  }
  
  if (!payload.status) {
    console.error('[Validator] FAIL: missing field "status"')
    return 'Missing status'
  }
  
  console.log(`[Validator] status = "${payload.status}"`)
  
  if (!payload.arenaId) {
    console.error('[Validator] FAIL: missing field "arenaId"')
    return 'Missing arenaId'
  }
  
  if (!payload.battleSeed) {
    console.error('[Validator] FAIL: missing field "battleSeed"')
    return 'Missing battleSeed'
  }
  
  if (!payload.myRole) {
    console.error('[Validator] FAIL: missing field "myRole"')
    return 'Missing myRole'
  }
  
  if (!payload.playerA) {
    console.error('[Validator] FAIL: missing field "playerA"')
    return 'Missing playerA'
  }
  
  if (!payload.playerA.userId) {
    console.error('[Validator] FAIL: missing field "playerA.userId"')
    return 'Missing playerA.userId'
  }
  
  if (!payload.playerA.username) {
    console.error('[Validator] FAIL: missing field "playerA.username"')
    return 'Missing playerA.username'
  }
  
  if (!payload.playerA.trainerId) {
    console.error('[Validator] FAIL: missing field "playerA.trainerId"')
    return 'Missing playerA.trainerId'
  }
  
  if (!Array.isArray(payload.playerA.team) || payload.playerA.team.length !== 6) {
    console.error('[Validator] FAIL: field "playerA.team" invalid:', payload.playerA.team)
    return 'Invalid playerA.team (must be array of 6)'
  }
  
  console.log('[Validator] playerA validated ✓')
  
  // PlayerB and opponent are only required when NOT queueing
  if (payload.status !== 'queueing') {
    console.log('[Validator] status is NOT queueing, validating playerB...')
    
    if (!payload.playerB) {
      console.error('[Validator] FAIL: missing field "playerB" (status is not queueing)')
      return 'Missing playerB'
    }
    
    if (!payload.playerB.userId) {
      console.error('[Validator] FAIL: missing field "playerB.userId"')
      return 'Missing playerB.userId'
    }
    
    if (!payload.playerB.username) {
      console.error('[Validator] FAIL: missing field "playerB.username"')
      return 'Missing playerB.username'
    }
    
    if (!payload.playerB.trainerId) {
      console.error('[Validator] FAIL: missing field "playerB.trainerId"')
      return 'Missing playerB.trainerId'
    }
    
    if (!Array.isArray(payload.playerB.team) || payload.playerB.team.length !== 6) {
      console.error('[Validator] FAIL: field "playerB.team" invalid:', payload.playerB.team)
      return 'Invalid playerB.team (must be array of 6)'
    }
    
    console.log('[Validator] playerB validated ✓')
    
    if (!payload.opponent) {
      console.error('[Validator] FAIL: missing field "opponent"')
      return 'Missing opponent'
    }
    
    if (!payload.opponent.userId) {
      console.error('[Validator] FAIL: missing field "opponent.userId"')
      return 'Missing opponent.userId'
    }
    
    if (!payload.opponent.username) {
      console.error('[Validator] FAIL: missing field "opponent.username"')
      return 'Missing opponent.username'
    }
    
    if (!payload.opponent.trainerId) {
      console.error('[Validator] FAIL: missing field "opponent.trainerId"')
      return 'Missing opponent.trainerId'
    }
    
    console.log('[Validator] opponent validated ✓')
  } else {
    console.log('[Validator] status is queueing, skipping playerB/opponent validation')
  }
  
  console.log('[Validator] ✓ ALL VALIDATION PASSED')
  return null // Valid
}
// Cache bust Mon Apr 20 19:06:28 PDT 2026
