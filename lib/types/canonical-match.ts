/**
 * Canonical Match Payload - Discriminated union by status
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

export interface PopulatedPlayer {
  userId: string
  username: string
  trainerId: string
  trainerName?: string
  team: number[]
  lockedOrder: number[]
}

export interface BaseMatchPayload {
  matchId: string
  arenaId: string
  entryFeeSol: number
  myRole: 'player_a' | 'player_b'
  playerA: PopulatedPlayer
  acks: {
    playerAMatchAck: boolean
    playerBMatchAck: boolean
    playerAArenaAck: boolean
    playerBArenaAck: boolean
  }
}

// Queueing: waiting for opponent
export interface QueueingMatchPayload extends BaseMatchPayload {
  status: 'queueing'
  playerB: null
  opponent: null
  battleSeed: null
}

// Matched/Ready/Battling/Settled: both players present
export interface ActiveMatchPayload extends BaseMatchPayload {
  status: 'matched' | 'arena_reveal' | 'battle_ready' | 'battling' | 'settlement_pending' | 'settled'
  playerB: PopulatedPlayer
  opponent: PopulatedPlayer
  battleSeed: string
}

export type CanonicalMatchPayload = QueueingMatchPayload | ActiveMatchPayload

/**
 * Validate canonical payload using discriminated union
 */
export function validateCanonicalPayload(payload: any): string | null {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('[VALIDATOR_BUILD_2026_04_20_2004] UNIQUE BUILD MARKER')
  console.log('[Validator] Starting validation...')
  console.log('CANONICAL MATCH RESPONSE:', JSON.stringify(payload, null, 2))
  console.log('CANONICAL MATCH STATUS:', payload?.status)
  console.log('CANONICAL PLAYER_B:', payload?.playerB)
  console.log('CANONICAL OPPONENT:', payload?.opponent)
  console.log('CANONICAL BATTLE_SEED:', payload?.battleSeed)
  console.log('CANONICAL ACKS:', payload?.acks)
  
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
  
  if (!payload.myRole) {
    console.error('[Validator] FAIL: missing field "myRole"')
    return 'Missing myRole'
  }
  
  if (!payload.playerA) {
    console.error('[Validator] FAIL: missing field "playerA"')
    return 'Missing playerA'
  }
  
  console.log('[Validator] playerA keys:', Object.keys(payload.playerA))
  console.log('[Validator] playerA full:', payload.playerA)
  console.log('[Validator] acks keys:', Object.keys(payload.acks || {}))
  console.log('[Validator] acks full:', payload.acks)
  
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
  
  // DISCRIMINATED UNION VALIDATION
  if (payload.status === 'queueing') {
    console.log('[Validator] Validating QUEUEING payload...')
    
    if (payload.playerB !== null) {
      console.error('[Validator] FAIL: playerB must be null when status=queueing, got:', payload.playerB)
      return 'playerB must be null when status is queueing'
    }
    
    if (payload.opponent !== null) {
      console.error('[Validator] FAIL: opponent must be null when status=queueing, got:', payload.opponent)
      return 'opponent must be null when status is queueing'
    }
    
    if (payload.battleSeed !== null) {
      console.error('[Validator] FAIL: battleSeed must be null when status=queueing, got:', payload.battleSeed)
      return 'battleSeed must be null when status is queueing'
    }
    
    console.log('[Validator] ✓ QUEUEING validation passed')
  } else {
    console.log('[Validator] Validating ACTIVE match payload...')
    
    if (!payload.battleSeed || typeof payload.battleSeed !== 'string') {
      console.error('[Validator] FAIL: battleSeed must be string when not queueing, got:', payload.battleSeed)
      return 'battleSeed required for active matches'
    }
    
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
    console.log('[Validator] ✓ ACTIVE match validation passed')
  }
  
  console.log('[Validator] ✓ ALL VALIDATION PASSED')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  return null // Valid
}
