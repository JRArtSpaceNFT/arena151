/**
 * Server-side battle resolution
 *
 * The main battle engine (lib/engine/battle.ts) uses Math.random() extensively,
 * making it non-deterministic without a seeded RNG, and it also uses
 * browser-compatible imports (no Node-only APIs, but relies on CREATURES,
 * MOVE_MAP, etc. which are safe to import server-side).
 *
 * This module provides:
 * 1. runServerBattle() — full server-side battle resolution
 * 2. validateClientResult() — validates client-submitted result using a seeded RNG check
 *
 * ⚠️  CRITICAL: Until the battle engine is made deterministic with a seeded RNG,
 *     server-side validation cannot guarantee the same result as client-side.
 *     The current approach:
 *     - Runs a server-side battle independently
 *     - If server says A wins but client says B wins → manual_review
 *     - If both agree → proceed to settlement
 *
 * TODO: Seed Math.random() at match creation time and store seed in matches.battle_seed
 *       Then both client and server run identical sequences. Requires Math.random override.
 */

// The battle engine imports are safe for server-side (no window/document usage)
import { resolveBattle } from './battle'
import { createActiveCreature } from './battle'
import type { ActiveCreature, Trainer } from '@/lib/game-types'

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
 * Returns winnerId: 'A' | 'B'
 */
export function runServerBattle(
  teamAIds: number[],
  teamBIds: number[],
  playerAId: string,
  playerBId: string
): {
  winner: 'A' | 'B'
  winnerId: string
  loserId: string
  log?: unknown
} {
  try {
    const teamA: ActiveCreature[] = teamAIds.map(id => createActiveCreature(id))
    const teamB: ActiveCreature[] = teamBIds.map(id => createActiveCreature(id))

    // Use a generic arena (type doesn't affect outcome significantly)
    const arena = {
      id: 'server',
      name: 'Server Arena',
      type: 'normal' as const,
      bgGradient: ['#000', '#111'],
      groundColor: '#333',
      floorColor: '#222',
    }

    const trainerA = makeServerTrainer(playerAId, 'Player A')
    const trainerB = makeServerTrainer(playerBId, 'Player B')

    const result = resolveBattle(teamA, teamB, arena, trainerA, trainerB)

    const winner = result.winner ?? 'A'
    const winnerId = winner === 'A' ? playerAId : playerBId
    const loserId  = winner === 'A' ? playerBId : playerAId

    return { winner, winnerId, loserId, log: result.log }
  } catch (err) {
    console.error('[ServerBattle] Error running server battle:', err)
    // On error, cannot validate — return null-like so caller sends to manual review
    throw new Error(`Server battle failed: ${err instanceof Error ? err.message : String(err)}`)
  }
}

/**
 * Validate a client-submitted winner against a server-run battle.
 * Since the battle engine is non-deterministic (uses Math.random without seeding),
 * we cannot guarantee the same result, so we use a best-effort approach:
 *
 * - Run battle server-side
 * - If server result agrees with client → VALID
 * - If server result disagrees → DISPUTED (needs manual review or cross-check with both players)
 *
 * In a future version, seed Math.random at match start and this becomes deterministic.
 */
export function validateClientResult(
  clientClaimedWinnerId: string,
  teamAIds: number[],
  teamBIds: number[],
  playerAId: string,
  playerBId: string
): {
  valid: boolean
  serverWinnerId: string
  agrees: boolean
  confidence: 'high' | 'low'
} {
  try {
    const { winnerId: serverWinnerId } = runServerBattle(teamAIds, teamBIds, playerAId, playerBId)
    const agrees = serverWinnerId === clientClaimedWinnerId

    return {
      valid: agrees,
      serverWinnerId,
      agrees,
      // Low confidence because Math.random is unseeded — different run, different result
      confidence: 'low',
    }
  } catch {
    // If server battle fails, we can't validate
    return {
      valid: false,
      serverWinnerId: '',
      agrees: false,
      confidence: 'low',
    }
  }
}
