# Battle Flow Audit - All Game Modes

## Current State (April 14, 2026)

### ✅ What's CONSISTENT Across All Modes

All three game modes (AI Practice, Friend Battle, Paid PvP) share:
- **Same BattleScreen component** - identical battle animations, VFX, sounds
- **Same ArenaReveal** - arena selection/reveal works the same way
- **Same battle engine** - `resolveBattle()` computes identical outcomes with same RNG seed
- **Same EnhancedBattleWrapper** - VFX system, hype reactions, camera work
- **Same Draft/Lineup components** - team selection UI is identical

### ❌ What's DIFFERENT

#### 1. **Pre-Battle Flow**

**AI Practice (PracticeGameWrapper):**
```
trainer_select → draft → coin_toss → lineup → arena_reveal → pretalk → battle → result
```

**Friend Battle (FriendGameWrapper):**
```
trainer_select → draft → lineup → arena_reveal → battle → victory/defeat → result
```
- ❌ Skips coin_toss (not needed for free 1v1)
- ❌ Skips pretalk

**Paid PvP (GameWrapper):**
```
room-select → queue → match-found → versus → battle (DIRECT JUMP!)
```
- ❌ **SKIPS EVERYTHING** — goes straight to battle screen (line 268 in GameWrapper.tsx)
- ❌ No trainer select, no draft, no lineup, no arena reveal shown to players
- ✅ Server computes teams/arena/trainers from seed, hydrates directly into battle

#### 2. **Results Screen**

**AI Practice & Paid PvP:**
- Uses `FinalResultsScreen` - complex screen with badges, leaderboard integration, SOL earnings display

**Friend Battle:**
- Uses `ResultsScreen` - simpler MVP/stats screen from gameStore.matchResults

#### 3. **Victory/Defeat Screens**

**AI Practice & Friend Battle:**
- Show intermediate `VictoryScreen` / `DefeatScreen` after battle
- Then proceed to final results

**Paid PvP:**
- ❌ **SKIPS Victory/Defeat** — goes straight to FinalResultsScreen after battle

## Issues to Fix

### 🚨 Critical: Paid PvP Has No Pre-Battle Experience

**Problem:**
Players in paid battles never see:
- Their opponent's trainer reveal
- The arena being revealed (most epic part!)
- Team composition preview
- Any hype buildup before battle starts

They go from "Match Found" screen → instantly in battle, which feels abrupt and removes all the ceremony.

**Why this happened:**
GameWrapper was optimized for refresh-resume: when someone refreshes mid-battle, it hydrates the battle state from server and jumps straight to battle screen (line 268). But this logic ALSO fires for fresh matches, skipping the experience for everyone.

**Fix needed:**
GameWrapper should:
1. Detect if this is a fresh match (not a resume)
2. If fresh: Start at `trainer_select` or `arena_reveal`, show teams/arena/trainers with animations
3. If resume: Keep current direct-to-battle logic

### 🎯 Recommendation: Unified Flow

**Ideal flow for ALL modes:**
```
[mode-specific entry] → arena_reveal → battle → victory/defeat → final_results
```

**Why arena_reveal is perfect for all modes:**
- Shows both trainers dramatically
- Reveals the arena with spinning animation (8 seconds of hype!)
- Plays battle music transition
- Works for AI, Friend, and Paid battles
- Server-authoritative (arena/trainers from seed) — no client manipulation possible

**For Paid PvP specifically:**
```
versus → arena_reveal (show P1/P2 trainers from seed + arena) → battle → victory/defeat → FinalResultsScreen (SOL payout)
```

## Recommended Changes

### 1. GameWrapper.tsx - Add Pre-Battle Flow for Fresh Matches

**Current (line 259-268):**
```typescript
gameStore.setState({
  gameMode: 'paid_pvp',
  screen: 'battle',  // ❌ Direct to battle
})
```

**Should be:**
```typescript
gameStore.setState({
  gameMode: 'paid_pvp',
  p1Trainer: trainerA,
  p2Trainer: trainerB,
  lineupA: teamA,
  lineupB: teamB,
  arena,
  screen: 'arena_reveal',  // ✅ Show arena reveal first!
})
```

Then ArenaReveal will:
- Play arena spinning animation (8s)
- Start battle music
- Auto-transition to battle after reveal completes

### 2. Add Victory/Defeat to Paid PvP Flow

**Current:**
```typescript
const screens: Record<string, React.ReactNode> = {
  battle: <BattleScreen />,
  result: <FinalResultsScreen />,
}
```

**Should be:**
```typescript
const screens: Record<string, React.ReactNode> = {
  arena_reveal: <ArenaReveal />,
  battle: <BattleScreen />,
  victory: <VictoryScreen />,
  defeat: <DefeatScreen />,
  result: <FinalResultsScreen />,
}
```

### 3. Unify Results Screen (Optional)

Consider using `FinalResultsScreen` for ALL modes:
- Practice: Show badges, no SOL
- Friend: Show stats, no SOL
- Paid: Show SOL earnings, badges, leaderboard

OR keep separate but ensure both render properly in all contexts.

## Testing Checklist

After fixes, verify:
- [ ] AI Practice: Full flow with all screens, proper music transitions
- [ ] Friend Battle: Full flow, reactions work, proper results screen
- [ ] Paid PvP: **SHOWS ARENA REVEAL** before battle, victory/defeat after, FinalResultsScreen with SOL payout
- [ ] Paid PvP refresh: Still resumes mid-battle correctly (don't break existing resume logic)
- [ ] All modes: Same battle animations, sounds, VFX
- [ ] All modes: Mute button silences everything
- [ ] All modes: Music transitions properly (menu → battle → victory)

## Summary

**Currently working:**
- Battle itself is identical across all modes ✅
- Battle engine is deterministic and fair ✅

**Needs fixing:**
- Paid PvP skips the entire pre-battle ceremony ❌
- Paid PvP skips victory/defeat screens ❌
- Inconsistent results screens between modes ⚠️

**Impact:**
Players paying real money get a worse, more abrupt experience than free practice players. This should be the opposite — paid battles should feel MORE premium, not less.
