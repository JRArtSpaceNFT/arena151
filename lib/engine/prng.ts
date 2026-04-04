// ═══════════════════════════════════════════════════════════════
// SEEDED PRNG — Mulberry32
// ═══════════════════════════════════════════════════════════════
// Fast, seedable, good-quality 32-bit PRNG.
// Both client and server run the IDENTICAL sequence given the same seed.

/**
 * Returns a PRNG function seeded with the given 32-bit integer.
 * Each call advances internal state and returns a float in [0, 1).
 */
export function mulberry32(seed: number): () => number {
  let s = seed >>> 0
  return function (): number {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Deterministic 32-bit seed derived from a UUID / battle_seed string.
 * Both client and server call this with the same matchId → same seed → same PRNG sequence.
 */
export function seedFromMatchId(matchId: string): number {
  let hash = 0
  for (let i = 0; i < matchId.length; i++) {
    const char = matchId.charCodeAt(i)
    hash = Math.imul(hash, 31) + char
    hash = hash | 0 // keep 32-bit signed
  }
  return Math.abs(hash)
}
