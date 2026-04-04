/**
 * Server-side battle resolution
 *
 * Uses the same battle engine as the client, now with seeded PRNG support.
 * When both client and server use the same battleSeed, they run an IDENTICAL
 * deterministic battle sequence — enabling reliable cross-validation.
 *
 * Flow:
 * 1. /api/match/create generates a battleSeed and returns it to the client
 * 2. Client runs resolveBattle(..., mulberry32(seedFromMatchId(battleSeed)))
 * 3. Server runs runServerBattle(..., battleSeed) → same sequence, same winner
 * 4. If client/server winners agree → confident, high-confidence settlement
 * 5. If they disagree → server result is authoritative
 */

import { resolveBattle, createActiveCreature } from './battle'
import { mulberry32, seedFromMatchId } from './prng'
import type { ActiveCreature, Arena, Trainer } from '@/lib/game-types'

// Minimal trainer stub for server-side resolution
function makeServerTrainer(id: string, name: string): Trainer {
  return {
    id,
    name,
    color: '#ffffff',
    spriteUrl: '',
    battleIntro: '',
    winQuote: '',
    loseQuote: '',
    type: 'normal',
    difficulty: 'medium',
    signature: [],
    passive: null,
    battleReactions: {},
  } as unknown as Trainer
}

/**
 * Run battle server-side from creature ID arrays.
 * Pass battleSeed to get a deterministic, reproducible result.
 * Returns winnerId: 'A' | 'B'
 */
export function runServerBattle(
  teamAIds: number[],
  teamBIds: number[],
  playerAId: string,
  playerBId: string,
  battleSeed?: string,
): {
  winner: 'A' | 'B'
  winnerId: string
  loserId: string
  log?: unknown
  deterministic: boolean
} {
  // Build seeded RNG if seed provided
  const rng = battleSeed
    ? mulberry32(seedFromMatchId(battleSeed))
    : undefined

  try {
    const teamA: ActiveCreature[] = teamAIds.map(id => createActiveCreature(id, rng))
    const teamB: ActiveCreature[] = teamBIds.map(id => createActiveCreature(id, rng))

    // Use a generic arena (type doesn't affect outcome significantly)
    const arena: Arena = {
      id: 'server',
      name: 'Server Arena',
      type: 'normal',
      bgGradient: 'linear-gradient(#000, #111)',
      bonusTypes: [],
      bonusAmount: 0,
    }

    const trainerA = makeServerTrainer(playerAId, 'Player A')
    const trainerB = makeServerTrainer(playerBId, 'Player B')

    const result = resolveBattle(teamA, teamB, arena, trainerA, trainerB, rng)

    const winner = result.winner ?? 'A'
    const winnerId = winner === 'A' ? playerAId : playerBId
    const loserId  = winner === 'A' ? playerBId : playerAId

    return { winner, winnerId, loserId, log: result.log, deterministic: !!battleSeed }
  } catch (err) {
    console.error('[ServerBattle] Error running server battle:', err)
    throw new Error(`Server battle failed: ${err instanceof Error ? err.message : String(err)}`)
  }
}

/**
 * Validate a client-submitted winner against a server-run battle.
 *
 * With a battleSeed, both runs are identical → high confidence validation.
 * Without a seed, results are non-deterministic → low confidence (legacy behaviour).
 */
export function validateClientResult(
  clientClaimedWinnerId: string,
  teamAIds: number[],
  teamBIds: number[],
  playerAId: string,
  playerBId: string,
  battleSeed?: string,
): {
  valid: boolean
  serverWinnerId: string
  agrees: boolean
  confidence: 'high' | 'low'
} {
  try {
    const { winnerId: serverWinnerId, deterministic } = runServerBattle(
      teamAIds, teamBIds, playerAId, playerBId, battleSeed,
    )
    const agrees = serverWinnerId === clientClaimedWinnerId

    return {
      valid: agrees,
      serverWinnerId,
      agrees,
      confidence: deterministic ? 'high' : 'low',
    }
  } catch {
    return {
      valid: false,
      serverWinnerId: '',
      agrees: false,
      confidence: 'low',
    }
  }
}
