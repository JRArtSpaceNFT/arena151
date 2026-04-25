# Paid PvP Strict State Machine - Implementation Plan

**Status:** IN PROGRESS  
**Started:** April 24, 2026 17:15 PDT

## Files Created So Far

✅ **1. Database Migration**
- `supabase/migrations/030_strict_paid_pvp_state_machine.sql`
- Adds `player_a_lineup_locked`, `player_b_lineup_locked` columns
- Atomic RPC: `atomic_lock_lineup_and_maybe_assign_arena`
- Enhanced payload: `get_canonical_match_payload_strict` with full validation
- Server assigns arena ONCE after both lineups locked

✅ **2. API Endpoint**
- `app/api/match/[matchId]/lock-lineup/route.ts`
- POST endpoint that calls atomic RPC
- Comprehensive logging
- Returns updated match state

✅ **3. Waiting Screen**
- `components/WaitingForOpponent.tsx`
- Shows after player locks lineup
- Subscribes to realtime match updates
- Transitions to game when server assigns arena

✅ **4. App Routing**
- `app/page.tsx` - Added `waiting-for-opponent` screen

## Files Still To Modify

### CRITICAL PATH (must complete for MVP):

**1. GameWrapper.tsx** - Draft → Lineup → Lock
- Remove Draft screen (use existing TeamDraft)
- When player completes draft, call `POST /api/match/[matchId]/lock-lineup`
- If response says `bothLineupsLocked: false` → show waiting screen
- If response says `bothLineupsLocked: true` → proceed to arena reveal
- **NO client-side arena randomization**

**2. ArenaReveal.tsx** - Show Server Arena Only
- Remove all `Math.random()` arena selection
- Load `arenaId` from match server payload
- Validate `arenaId` exists before rendering
- Add logs:
  ```
  [ARENA_SYNC] matchId
  [ARENA_SYNC] arenaId (from server)
  [ARENA_SYNC] source=server
  ```

**3. QueueScreen.tsx** - Strict Opponent Validation
- Already has validation, but needs to use `get_canonical_match_payload_strict`
- Must never show "Rival Trainer" in paid PvP
- Add fail-fast checks:
  - If `opponent.userId` missing → HARD STOP
  - If profile fetch fails → HARD STOP
  - If `opponent.username === 'rival'` → HARD STOP

**4. Battle Engine Validation** - Fix `.ac` Crash
- `lib/engine/battle.ts` - Add `validateCanonicalPayload()`
- Check ALL required fields before compute:
  - `trainerA.id` exists
  - `trainerB.id` exists
  - `teamA` is array with length > 0
  - `teamB` is array with length > 0
  - Every Pokemon has: `id`, `name`, `hp`, `attack`, `defense`, `types`, `moves`
  - `arena` exists
  - `seed` exists
- If validation fails, log full payload and STOP (don't crash)

**5. Remove PIKACHU EGG from Paid PvP**
- `lib/engine/battle.ts` - Move easter egg logic to separate function
- Only run easter eggs in practice/friend modes
- Never run in paid PvP (can cause undefined crashes)

### SECONDARY (nice to have, not blocking):

**6. Realtime Sync Validation**
- Both clients should log when receiving match updates
- Verify both see same: matchId, arenaId, status, winner

**7. Settlement Validation**
- Ensure settlement runs once
- Log: matchId, winnerId, loserId, payout

## Server State Flow

```
queueing
  ↓ (player_b joins)
matched
  ↓ (both players ack via versus screen)
lineup_selection
  ↓ (first player locks)
waiting_for_lineups
  ↓ (second player locks + server assigns arena atomically)
arena_assigned
  ↓ (both players ack arena)
battle_ready
  ↓ (battle computes)
settlement_pending
  ↓ (payout completes)
settled
```

## Client Routing Rules

```typescript
switch (serverStatus) {
  case 'matched':
    return <VersusScreen />
    
  case 'lineup_selection':
  case 'waiting_for_lineups':
    if (myLineupLocked) {
      return <WaitingForOpponent />
    } else {
      return <TeamDraft />
    }
    
  case 'arena_assigned':
  case 'battle_ready':
    return <ArenaReveal /> // shows server arena, then battle
    
  case 'settlement_pending':
  case 'settled':
    return <ResultScreen />
    
  default:
    return <ErrorScreen message="Invalid match state" />
}
```

## Critical Invariants

### ❌ NEVER ALLOWED in Paid PvP:
1. Client chooses arena randomly
2. Client skips ahead without server confirmation
3. Opponent data falls back to "Rival Trainer" or AI
4. Battle computed without both lineups locked
5. Arena assigned before both lineups locked
6. Different arenas shown to different players
7. Different battle results shown to different players

### ✅ ALWAYS REQUIRED in Paid PvP:
1. Server assigns arena (once, deterministically from seed)
2. Server validates both lineups before arena
3. Both players see same arena
4. Both players compute same battle from same payload
5. Both players see same winner
6. Settlement runs once on server
7. Clear error messages if any validation fails

## Expected Test Logs

### Player A (creates match):
```
[PAID_PVP_QUEUE] matchId: abc-123
[PAID_PVP_QUEUE] myUserId: user-a
[PAID_PVP_QUEUE] myRole: player_a
[PAID_PVP_QUEUE] opponentUserId: user-b
[PAID_PVP_QUEUE] opponentUsername: johndoe
[PAID_PVP_QUEUE] matchStatus: matched

[LockLineup] Match ID: abc-123
[LockLineup] User: user-a
[LockLineup] Trainer: red
[LockLineup] Lineup: [1, 4, 7]
[LockLineup] My Role: player_a
[LockLineup] Both Locked: false
[LockLineup] Arena Assigned: false
[LockLineup] New Status: waiting_for_lineups

[WaitingForOpponent] Subscribing to match updates: abc-123
[WaitingForOpponent] Match updated
[WaitingForOpponent] Status: arena_assigned
[WaitingForOpponent] Both Lineups Locked: true
[WaitingForOpponent] Arena Assigned: true
[WaitingForOpponent] Arena ID: cerulean-city
[WaitingForOpponent] ✅ Arena assigned - transitioning to game

[ARENA_SYNC] matchId: abc-123
[ARENA_SYNC] myUserId: user-a
[ARENA_SYNC] role: player_a
[ARENA_SYNC] arenaId: cerulean-city
[ARENA_SYNC] source: server

[BATTLE_SYNC] matchId: abc-123
[BATTLE_SYNC] battleSeed: seed-xyz
[BATTLE_SYNC] trainerAId: red
[BATTLE_SYNC] trainerBId: blue
[BATTLE_SYNC] teamAIds: [1, 4, 7]
[BATTLE_SYNC] teamBIds: [2, 5, 8]
[BATTLE_SYNC] winnerId: user-a

[SETTLEMENT_PROOF] matchId: abc-123
[SETTLEMENT_PROOF] winnerId: user-a
[SETTLEMENT_PROOF] loserId: user-b
[SETTLEMENT_PROOF] payoutAmount: 0.095
```

### Player B (joins match):
```
[PAID_PVP_QUEUE] matchId: abc-123
[PAID_PVP_QUEUE] myUserId: user-b
[PAID_PVP_QUEUE] myRole: player_b
[PAID_PVP_QUEUE] opponentUserId: user-a
[PAID_PVP_QUEUE] opponentUsername: alice
[PAID_PVP_QUEUE] matchStatus: matched

[LockLineup] Match ID: abc-123
[LockLineup] User: user-b
[LockLineup] Trainer: blue
[LockLineup] Lineup: [2, 5, 8]
[LockLineup] My Role: player_b
[LockLineup] Both Locked: true
[LockLineup] Arena Assigned: true
[LockLineup] Arena ID: cerulean-city  ← SAME as Player A
[LockLineup] New Status: arena_assigned

[ARENA_SYNC] matchId: abc-123
[ARENA_SYNC] myUserId: user-b
[ARENA_SYNC] role: player_b
[ARENA_SYNC] arenaId: cerulean-city  ← SAME as Player A
[ARENA_SYNC] source: server

[BATTLE_SYNC] matchId: abc-123
[BATTLE_SYNC] battleSeed: seed-xyz  ← SAME as Player A
[BATTLE_SYNC] trainerAId: red
[BATTLE_SYNC] trainerBId: blue
[BATTLE_SYNC] teamAIds: [1, 4, 7]  ← SAME as Player A
[BATTLE_SYNC] teamBIds: [2, 5, 8]  ← SAME as Player A
[BATTLE_SYNC] winnerId: user-a  ← SAME as Player A

[SETTLEMENT_PROOF] matchId: abc-123
[SETTLEMENT_PROOF] winnerId: user-a  ← SAME as Player A
[SETTLEMENT_PROOF] loserId: user-b
[SETTLEMENT_PROOF] payoutAmount: 0.095
```

## Success Criteria

Both players must log:
- ✅ Same matchId
- ✅ Same opponentUserId
- ✅ Same arena Id
- ✅ Same battleSeed
- ✅ Same teamA and teamB composition
- ✅ Same winnerId
- ✅ Same settlement result

## Next Steps

1. ✅ Apply migration 030 to database
2. ⏳ Modify GameWrapper to call lock-lineup endpoint
3. ⏳ Modify ArenaReveal to only show server arena
4. ⏳ Add battle payload validation
5. ⏳ Remove PIKACHU EGG from paid PvP
6. ⏳ Test with two real accounts
7. ⏳ Verify logs match expected output

## Estimated Time

- Database migration: 5 minutes
- API endpoint testing: 5 minutes
- GameWrapper refactor: 30 minutes
- ArenaReveal refactor: 15 minutes
- Battle validation: 20 minutes
- Testing: 20 minutes

**Total: ~95 minutes**

## Deployment Checklist

- [ ] Apply migration 030 to production Supabase
- [ ] Push code to GitHub
- [ ] Vercel auto-deploys
- [ ] Hard refresh both test browsers
- [ ] Run two-player test
- [ ] Verify logs match expected output
- [ ] Verify no "Rival Trainer" appears
- [ ] Verify both players see same arena
- [ ] Verify both players see same winner
- [ ] Verify settlement runs once
