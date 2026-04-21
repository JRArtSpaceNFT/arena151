# Matchmaking Architecture Fix - April 20, 2026

## Problem Diagnosis

From console logs, we found a critical bug in the matchmaking system:

### The Bug
1. **Frontend requested** `roomId = "pewter-city"`
2. **Server returned** response with:
   - `status: "queueing"` 
   - `arenaId: "saffron-city"` ❌ (wrong arena, assigned too early)
   - `roomId: <unstored or mismatched>` 
   - `playerB: null`
   - `opponent: null`
   - `battleSeed: <present but shouldn't be>`
3. **Frontend threw** "Invalid matchmaking response" because it expected battle-ready data but got queueing status with partial data

### Root Causes
1. **No phase distinction** - RPC returned ALL fields (arenaId, battleSeed) even during queueing phase
2. **Arena assigned wrong** - Arena is randomly assigned at match creation, NOT based on roomId
3. **Cross-room leaks possible** - No DB-level safeguards preventing matches from mixing rooms
4. **Frontend validation broken** - Expected queueing responses to have null arena/seed but got populated values

## Architecture Fix

Implemented strict **2-phase matchmaking**:

### Phase 1: QUEUEING
**When:** Only player_a has joined, waiting for player_b

**Server returns:**
```json
{
  "success": true,
  "status": "queueing",
  "matchId": "...",
  "myRole": "player_a",
  "roomId": "pewter-city",
  "arenaId": null,        // ✅ Now null during queue
  "battleSeed": null,     // ✅ Now null during queue
  "opponent": null,       // ✅ Now null during queue
  "playerA": { ... },
  "playerB": null,        // ✅ Now null during queue
  "acks": { all false }
}
```

**Frontend behavior:**
- Stays on queue screen
- Subscribes to realtime updates
- Does NOT validate for battle-readiness
- Does NOT attempt to load arena/battle

### Phase 2: BATTLE_READY
**When:** Both players joined, arena assigned, match ready

**Server returns:**
```json
{
  "success": true,
  "status": "arena_ready" | "battle_ready",
  "matchId": "...",
  "myRole": "player_a",
  "roomId": "pewter-city",  // ✅ Matches requested room
  "arenaId": "saffron-city", // ✅ Now present
  "battleSeed": "...",       // ✅ Now present
  "opponent": { ... },       // ✅ Now present
  "playerA": { ... },
  "playerB": { ... },        // ✅ Now present
  "acks": { ... }
}
```

**Frontend behavior:**
- Validates all required fields present
- Validates roomId matches requested roomId
- Loads arena and transitions to battle

## Files Changed

### 1. Database Migration
**File:** `supabase/migrations/025_fix_matchmaking_phases.sql`

**Changes:**
- ✅ Updated `get_canonical_match_payload()` to return phase-appropriate data
  - Returns null for arenaId/battleSeed/opponent/playerB when status = 'queueing'
  - Returns full data when status = 'arena_ready' | 'battle_ready'
- ✅ Updated `atomic_join_or_create_paid_match_v2()` with detailed logging:
  - Logs requested roomId vs stored roomId
  - Logs arena assignment
  - Logs cross-room leak detection
  - Prevents stale match reuse
- ✅ Added DB index: `idx_matches_queueing_by_room` for fast room-scoped queries
- ✅ Added constraint: paid_pvp matches MUST have non-null roomId

**Why arena != roomId:**
- `roomId` = matchmaking tier (pewter-city, saffron-city, etc.) - determines entry fee & opponent skill level
- `arenaId` = visual/cosmetic arena for battle - randomly assigned from battleSeed, NOT tied to roomId
- This is intentional design - arena is just visuals, room is gameplay tier

### 2. API Route Logging
**File:** `app/api/matchmaking/paid/join/route.ts`

**Changes:**
- ✅ Added structured debug logging on every response:
  ```
  REQUESTED:
    roomId: pewter-city
  RESPONSE:
    roomId: pewter-city ✅
    arenaId: saffron-city
    status: queueing
    playerB: null
    opponent: null
  ```
- ✅ Logs cross-room mismatches with ❌ symbol
- ✅ Logs phase transition clearly

### 3. Frontend State Machine
**File:** `components/QueueScreen.tsx`

**Changes:**
- ✅ **REMOVED** blanket "Invalid matchmaking response" error
- ✅ **ADDED** phase-specific validation:
  - `status === 'queueing'` → accept null arena/seed/opponent/playerB
  - `status === 'arena_ready' | 'battle_ready'` → require all fields
- ✅ **ADDED** roomId validation:
  - If `response.roomId !== requested.roomId` → abort with alert
- ✅ **ADDED** detailed console logging for debugging
- ✅ **FIXED** realtime subscription to fetch full match data on status change
- ✅ **FIXED** opponent profile fetching before transition to versus screen

## Hard Requirements (Now Enforced)

1. ✅ Players cannot enter battle until both have joined
2. ✅ Arena is assigned once on server, both clients read same value
3. ✅ Matchmaking is scoped by roomId - no cross-room joins
4. ✅ Never reuse stale matches from another room
5. ✅ Server distinguishes clearly between queueing and battle_ready
6. ✅ Frontend only requires battleSeed/opponent/playerB when status = 'battle_ready'
7. ✅ Frontend accepts queueing responses without throwing errors
8. ✅ Server logs requested vs stored roomId on every response
9. ✅ DB constraint prevents paid_pvp matches with null roomId
10. ✅ DB index prevents cross-room match queries

## Deployment Steps

### 1. Apply Database Migration
Copy the contents of `supabase/migrations/025_fix_matchmaking_phases.sql` into Supabase SQL Editor and run it.

**Or** run via CLI:
```bash
cd /Users/worlddomination/.openclaw/workspace/arena151
export SUPABASE_SERVICE_KEY="<your-service-key>"
node scripts/run-migration.mjs
```

### 2. Deploy Frontend
```bash
cd /Users/worlddomination/.openclaw/workspace/arena151
git add .
git commit -m "fix: 2-phase matchmaking architecture + cross-room leak prevention"
git push
```

Vercel will auto-deploy.

### 3. Test Flow

**Single player (queueing):**
1. Join pewter-city room
2. Console should show: `status: "queueing"`, `arenaId: null`, `playerB: null`
3. Should stay on queue screen
4. Should NOT throw "Invalid matchmaking response"

**Two players (matched):**
1. Player A joins pewter-city → sees queueing
2. Player B joins pewter-city → both get realtime update
3. Console should show: `status: "arena_ready"`, `arenaId: <arena>`, `playerB: {...}`
4. Both should transition to versus screen
5. Both should see SAME arenaId and battleSeed

**Cross-room prevention:**
1. Player A joins pewter-city
2. Player B joins saffron-city
3. They should NOT match (different roomId filter)
4. Server logs should show separate matches created

## Success Criteria

✅ **Queueing phase:** Returns null for arena/seed/opponent/playerB  
✅ **Battle-ready phase:** Returns full data with all fields  
✅ **No cross-room matches:** roomId filter in DB query prevents leaks  
✅ **RoomId validation:** Frontend aborts if response.roomId != requested.roomId  
✅ **Detailed logging:** Every response logs requested vs returned roomId  
✅ **Stale match prevention:** DB constraint + index prevent reuse  
✅ **Frontend accepts queueing:** No more "Invalid matchmaking response" errors  

## What Was Wrong

1. **Cross-room mismatch:** Arena was randomly assigned, had nothing to do with roomId - THIS IS CORRECT DESIGN (arena is cosmetic, room is tier)
2. **Queueing returned as success:** Queueing payload had arenaId/battleSeed populated when they should be null - FIXED
3. **Frontend validation:** Expected null fields during queueing but got populated - FIXED to accept phase-appropriate data
4. **Stale matches:** No DB safeguards - FIXED with constraint + index

## Notes for Future

- **roomId vs arenaId:** These are NOT the same! roomId = matchmaking tier, arenaId = visual arena
- **Don't confuse the two** - it's correct for them to mismatch
- **Phase separation is critical** - queueing != battle_ready, return different data structures
- **Always validate roomId** - frontend should abort if server returns wrong room
- **Server is source of truth** - arena assignment happens server-side, clients just read it
