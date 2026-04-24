// CRITICAL FIXES FOR BATTLE ENGINE
// 
// Issues Fixed:
// 1. Undefined BattleCreatureState causing .ac crash
// 2. Fragile easter egg logic accessing undefined objects
// 3. Missing validation before battle starts
//
// Apply these changes to lib/engine/battle.ts

// ═══════════════════════════════════════════════════════════════
// FIX 1: Add defensive validation in applyPassiveBonus
// ═══════════════════════════════════════════════════════════════

// REPLACE (around line 143):
/*
function applyPassiveBonus(bcs: BattleCreatureState, moveType: PokemonType): number {
  const ek = bcs.ac.creature.passive.effectKey
*/

// WITH:
function applyPassiveBonus(bcs: BattleCreatureState | undefined, moveType: PokemonType): number {
  if (!bcs?.ac?.creature?.passive) {
    console.error('[BATTLE ERROR] applyPassiveBonus called with invalid bcs:', bcs)
    return 0
  }
  const ek = bcs.ac.creature.passive.effectKey


// ═══════════════════════════════════════════════════════════════
// FIX 2: Add validation before easter egg logic
// ═══════════════════════════════════════════════════════════════

// REPLACE (around line 1129):
/*
  console.log('[PIKACHU EGG] trainerA.id=', trainerA.id, 'slot0 id=', teamA[0]?.creature?.id, 'slot0 name=', teamA[0]?.creature?.name)
  const ashPikachuEgg =
    trainerA.id === 'ash' &&
    teamA.length > 0 &&
    teamA[0].creature.id === 25
*/

// WITH:
  // Validate teams before easter eggs
  if (!teamA || teamA.length === 0 || !teamB || teamB.length === 0) {
    throw new Error(`[BATTLE ERROR] Invalid teams: teamA=${teamA?.length ?? 0} teamB=${teamB?.length ?? 0}`)
  }
  
  // Validate all team members have required fields
  for (const [team, name] of [[teamA, 'A'], [teamB, 'B']] as [ActiveCreature[], string][]) {
    team.forEach((ac, idx) => {
      if (!ac?.creature?.id || !ac?.creature?.name || !ac?.maxHp || !ac?.assignedMoves) {
        throw new Error(`[BATTLE ERROR] Team ${name} slot ${idx} has invalid creature:`, ac)
      }
    })
  }

  // OPTIONAL: Disable easter eggs entirely for production safety
  const ENABLE_EASTER_EGGS = false
  
  if (ENABLE_EASTER_EGGS) {
    console.log('[PIKACHU EGG] trainerA.id=', trainerA.id, 'slot0 id=', teamA[0]?.creature?.id)
    const ashPikachuEgg =
      trainerA?.id === 'ash' &&
      teamA?.length > 0 &&
      teamA[0]?.creature?.id === 25


// ═══════════════════════════════════════════════════════════════
// FIX 3: Add bounds checking in battle loop
// ═══════════════════════════════════════════════════════════════

// REPLACE (around line 1443):
/*
    const bcsA = statesA[activeA]
    const bcsB = statesB[activeB]
*/

// WITH:
    // Bounds check before accessing states
    if (activeA >= statesA.length || activeB >= statesB.length) {
      console.error(`[BATTLE ERROR] Index out of bounds: activeA=${activeA}/${statesA.length} activeB=${activeB}/${statesB.length}`)
      break
    }
    
    const bcsA = statesA[activeA]
    const bcsB = statesB[activeB]
    
    // Validate both states exist
    if (!bcsA || !bcsB) {
      console.error(`[BATTLE ERROR] Undefined state: bcsA=${!!bcsA} bcsB=${!!bcsB}`)
      break
    }


// ═══════════════════════════════════════════════════════════════
// FIX 4: Add validation in executeTurnAttempt
// ═══════════════════════════════════════════════════════════════

// AT START OF executeTurnAttempt function (around line 1295):
  function executeTurnAttempt(
    attBCS: BattleCreatureState,
    defBCS: BattleCreatureState,
    attkSide: 'A' | 'B',
  ): boolean {
    // Validate inputs
    if (!attBCS?.ac || !defBCS?.ac) {
      console.error(`[BATTLE ERROR] executeTurnAttempt called with undefined state: att=${!!attBCS} def=${!!defBCS}`)
      attBCS.roundTurnConsumed = true // Prevent infinite loop
      return false
    }


// ═══════════════════════════════════════════════════════════════
// FIX 5: Wrap all easter egg logic in try-catch
// ═══════════════════════════════════════════════════════════════

// WRAP all easter egg sections (lines 1129-1210) with:
  try {
    // ... existing easter egg code ...
  } catch (err) {
    console.error('[BATTLE] Easter egg logic failed:', err)
    // Continue without easter eggs
  }
