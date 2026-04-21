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
  if (!payload) return 'Payload is null or undefined'
  if (!payload.matchId) return 'Missing matchId'
  if (!payload.status) return 'Missing status'
  if (!payload.arenaId) return 'Missing arenaId'
  if (!payload.battleSeed) return 'Missing battleSeed'
  if (!payload.myRole) return 'Missing myRole'
  
  if (!payload.playerA) return 'Missing playerA'
  if (!payload.playerA.userId) return 'Missing playerA.userId'
  if (!payload.playerA.username) return 'Missing playerA.username'
  if (!payload.playerA.trainerId) return 'Missing playerA.trainerId'
  if (!Array.isArray(payload.playerA.team) || payload.playerA.team.length !== 6) {
    return 'Invalid playerA.team (must be array of 6)'
  }
  
  // PlayerB and opponent are only required when NOT queueing
  if (payload.status !== 'queueing') {
    if (!payload.playerB) return 'Missing playerB'
    if (!payload.playerB.userId) return 'Missing playerB.userId'
    if (!payload.playerB.username) return 'Missing playerB.username'
    if (!payload.playerB.trainerId) return 'Missing playerB.trainerId'
    if (!Array.isArray(payload.playerB.team) || payload.playerB.team.length !== 6) {
      return 'Invalid playerB.team (must be array of 6)'
    }
    
    if (!payload.opponent) return 'Missing opponent'
    if (!payload.opponent.userId) return 'Missing opponent.userId'
    if (!payload.opponent.username) return 'Missing opponent.username'
    if (!payload.opponent.trainerId) return 'Missing opponent.trainerId'
  }
  
  return null // Valid
}
// Cache bust Mon Apr 20 19:06:28 PDT 2026
