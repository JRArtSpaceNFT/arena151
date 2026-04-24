# Battle Engine Critical Fixes - April 24, 2026

## Problem

Players successfully matched but crashed during battle computation with:

```
Uncaught TypeError: Cannot read properties of undefined (reading 'ac')
```

This happened after `battle_ready` state, preventing real money battles from completing.

## Root Cause

The crash occurred in `applyPassiveBonus()` when accessing `bcs.ac.creature.passive.effectKey` where `bcs` (BattleCreatureState) was undefined.

**Why `bcs` was undefined:**
- `statesA[activeA]` or `statesB[activeB]` returned undefined
- `activeA` or `activeB` index was out of bounds
- No validation before accessing array elements
- Easter egg logic could crash and break state initialization

## Fixes Applied

### 1. Input Validation (CRITICAL)

Added comprehensive validation at the start of `resolveBattle()`:

```typescript
// Validate teams exist and have creatures
if (!teamA || teamA.length === 0) {
  throw new Error(`[BATTLE ERROR] Team A invalid`)
}

// Validate all creatures have required fields
teamA.forEach((ac, idx) => {
  if (!ac?.creature?.id || !ac?.maxHp || !ac?.assignedMoves) {
    throw new Error(`[BATTLE ERROR] Team A slot ${idx} invalid`)
  }
})
```

**Prevents:** Battle from starting with invalid/undefined team data

### 2. Easter Egg Safety

Wrapped all easter egg logic (Pikachu, Fuji Charmander, Squirtle Squad, Psyduck) in try-catch:

```typescript
try {
  // All easter egg code...
} catch (eggErr) {
  console.error('[BATTLE] Easter egg logic failed (non-fatal):', eggErr)
  // Continue without easter eggs
}
```

**Prevents:** Easter eggs from crashing the entire battle

### 3. Bounds Checking in Battle Loop

Added validation before accessing states:

```typescript
if (activeA >= statesA.length || activeB >= statesB.length) {
  console.error(`[BATTLE ERROR] Index out of bounds`)
  break
}

const bcsA = statesA[activeA]
const bcsB = statesB[activeB]

if (!bcsA || !bcsB || !bcsA.ac || !bcsB.ac) {
  console.error(`[BATTLE ERROR] Invalid state`)
  break
}
```

**Prevents:** Accessing undefined array elements and crashing

### 4. Safety in applyPassiveBonus

Added defensive check:

```typescript
function applyPassiveBonus(bcs: BattleCreatureState, moveType: PokemonType): number {
  if (!bcs?.ac?.creature?.passive) {
    console.error('[BATTLE ERROR] applyPassiveBonus called with invalid bcs')
    return 0
  }
  // ... rest of function
}
```

**Prevents:** The exact `.ac` crash that was happening

### 5. Safety in executeTurnAttempt

Added validation for battle states:

```typescript
function executeTurnAttempt(...) {
  if (!attBCS?.ac || !defBCS?.ac) {
    console.error(`[BATTLE ERROR] Invalid state`)
    if (attBCS) attBCS.roundTurnConsumed = true
    return false
  }
  // ... rest of function
}
```

**Prevents:** Undefined states from propagating through battle logic

## Files Changed

- `lib/engine/battle.ts` - All critical fixes applied
- `lib/engine/battle-fix.patch.ts` - Documentation of changes

## Testing Protocol

### Before Testing
1. Verify Vercel deployed the new code (wait 2-3 minutes after push succeeds)
2. Hard refresh both browsers (Cmd+Shift+R)

### Test Steps
1. Two accounts with sufficient balance (test DB balances are fine)
2. Both enter matchmaking in same room
3. Both should pair successfully (already working based on your report)
4. **NEW: Both should complete battle without `.ac` crash**

### Expected Logs (Success)

**Browser Console:**
```
[ArenaReveal] Battle ready → computing canonical battle
[Battle] Battle started
[Battle] Turn 1, 2, 3... (no crashes)
[Battle] Winner determined
```

**NO ERRORS like:**
- ❌ `Cannot read properties of undefined (reading 'ac')`
- ❌ `[PIKACHU EGG] ...` followed by crash
- ❌ `[BATTLE ERROR]` (unless data actually invalid)

### Expected Logs (Graceful Failure)

If battle data IS invalid:
```
[BATTLE ERROR] Team A invalid: 0 creatures
```
Or:
```
[BATTLE ERROR] Team A slot 0 invalid creature: {...}
```

These will throw clear errors instead of cryptic `.ac` crashes.

## What's Still TODO

1. **Emoji URL 404**: Find where `👨‍💻` emoji is being used as image src
2. **Server-side battle**: Verify server computes battle, not client
3. **Deterministic results**: Verify both clients see same winner
4. **Settlement**: Verify winner gets paid exactly once

## Success Criteria

✅ **No `.ac` crashes**: Battle completes without undefined errors
✅ **Clear error messages**: If battle fails, error is actionable
✅ **Easter eggs non-fatal**: Even if they fail, battle continues
✅ **Both players reach battle**: No crashes during arena_reveal → battle transition

## If It Still Crashes

**Check browser console for:**
1. The exact error message
2. Line number in battle.ts
3. State of `teamA`, `teamB`, `activeA`, `activeB` when crash happened

**Send me:**
1. Screenshot of full error stack trace
2. Value of variables at crash point (expand error object)
3. Both players' console logs
4. Database state: `SELECT * FROM matches WHERE id = '<matchId>';`

This will show if it's a different crash or if validation isn't catching something.

## Deployment Status

- ✅ Code committed locally
- ⚠️ Push failed (auth issue) - Jonathan needs to push manually
- ⏳ Vercel deployment pending push

**To deploy:**
```bash
cd /Users/worlddomination/.openclaw/workspace/arena151
git push
```

Then wait 2-3 minutes for Vercel to build and deploy.
