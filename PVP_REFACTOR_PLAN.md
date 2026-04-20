# Arena 151 - Paid PVP Refactor Plan

## ROOT CAUSE ANALYSIS

**Why it's still broken:**

1. **No team lock validation** - Users can queue without selecting teams
2. **Client-side opponent guessing** - UI uses GENERIC_RIVAL fallback instead of requiring server data
3. **Race conditions** - No acknowledgment gates between match phases
4. **Incomplete payloads** - Clients advance with partial data
5. **SessionStorage resurrection** - Stale matches keep coming back
6. **No canonical match object** - Each screen reconstructs state differently

**Specific crashes:**
- `Cannot read properties of undefined (reading 'ac')` - Battle engine receives incomplete team data
- 404s - Missing sprite assets for trainers not in the selected pool

---

## NEW STATE MACHINE

```
drafting → ready_for_queue → queueing → matched → arena_reveal → battle_ready → battling → settlement_pending → settled
```

### State Transitions (Server-Only)

**drafting**
- User selecting trainer/team/order
- Cannot queue

**ready_for_queue**
- Server validated: trainer_id, team (6 pokemon), locked_order
- Can call `/api/queue/join`

**queueing**
- User in matchmaking pool
- Server searching for opponent

**matched**
- Server atomically paired two users
- Server wrote: arenaId, battleSeed, both usernames, both trainer IDs, both teams
- Both clients receive canonical payload
- Both clients must ACK before advancing

**arena_reveal**
- Only after both players ACKed matched
- Both see same arena (from server arenaId)
- Both see same opponent name (from server payload)

**battle_ready**
- Only after both players ACKed arena_reveal
- Server validated battle payload complete

**battling**
- Both clients render deterministic battle from server seed

---

## DATABASE SCHEMA CHANGES

```sql
-- Add to matches table
ALTER TABLE matches ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'drafting';
ALTER TABLE matches ADD COLUMN IF NOT EXISTS arena_id TEXT;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS player_a_username TEXT;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS player_b_username TEXT;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS player_a_trainer_id TEXT;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS player_b_trainer_id TEXT;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS player_a_locked_order JSONB;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS player_b_locked_order JSONB;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS player_a_match_ack BOOLEAN DEFAULT FALSE;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS player_b_match_ack BOOLEAN DEFAULT FALSE;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS player_a_arena_ack BOOLEAN DEFAULT FALSE;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS player_b_arena_ack BOOLEAN DEFAULT FALSE;

-- Add to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS current_trainer_id TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS current_team JSONB;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS current_locked_order JSONB;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS team_locked_at TIMESTAMPTZ;
```

---

## CANONICAL MATCH PAYLOAD

```typescript
interface CanonicalMatchPayload {
  matchId: string
  status: MatchStatus
  arenaId: string
  battleSeed: string
  entryFeeSol: number
  playerA: {
    userId: string
    username: string
    trainerId: string
    trainerName: string
    team: number[]  // pokemon IDs
    lockedOrder: number[]  // battle order
  }
  playerB: {
    userId: string
    username: string
    trainerId: string
    trainerName: string
    team: number[]
    lockedOrder: number[]
  }
  myRole: 'player_a' | 'player_b'
  opponent: {
    userId: string
    username: string
    trainerId: string
    trainerName: string
  }
  acks: {
    playerAMatchAck: boolean
    playerBMatchAck: boolean
    playerAArenaAck: boolean
    playerBArenaAck: boolean
  }
}
```

---

## IMPLEMENTATION STEPS

### 1. Team Lock Validation Endpoint
`POST /api/team/lock`
- Validates: trainer selected, 6 pokemon, order set
- Persists to profiles table
- Returns readiness status

### 2. Atomic Matchmaking with Lock Check
Update `atomic_join_or_create_paid_match`:
- Check `team_locked_at IS NOT NULL`
- If not locked, return `TEAM_NOT_LOCKED` error
- On match creation: write arenaId, battleSeed, usernames, trainer IDs
- On join: fetch full canonical payload

### 3. Canonical Payload Endpoint
`GET /api/match/[matchId]/canonical`
- Returns full CanonicalMatchPayload
- Validates all required fields present
- Used by all screens

### 4. Acknowledgment Endpoints
`POST /api/match/[matchId]/ack/matched`
`POST /api/match/[matchId]/ack/arena`
- Sets player_a_match_ack or player_b_match_ack
- Only advances status when BOTH acked

### 5. UI Payload Guards
Before rendering versus/arena/battle:
```typescript
function validatePayload(payload: CanonicalMatchPayload): string | null {
  if (!payload.matchId) return 'Missing matchId'
  if (!payload.opponent?.username) return 'Missing opponent username'
  if (!payload.arenaId) return 'Missing arenaId'
  if (!payload.battleSeed) return 'Missing battleSeed'
  if (!payload.playerA?.team) return 'Missing playerA team'
  if (!payload.playerB?.team) return 'Missing playerB team'
  return null // valid
}
```

### 6. Fix Undefined Crash
Add guards in battle engine:
```typescript
// Before accessing .ac
if (!creature || !creature.ac) {
  console.error('[Battle] Invalid creature:', creature)
  throw new Error('Battle boot failed: invalid creature data')
}
```

### 7. Fix 404s
Audit all asset paths:
- Trainer sprites
- Pokemon sprites
- Arena backgrounds
Ensure paths match actual files in /public

### 8. Synchronized Gates
QueueScreen subscribes to match updates
When `status` changes to `matched`:
- Fetch canonical payload
- Validate payload
- Call `/ack/matched`
- Poll for both acks
- Only then transition to versus

---

## FILES TO CHANGE

**Database:**
- `supabase/migrations/021_pvp_state_machine.sql` (schema changes)
- `supabase/migrations/022_atomic_matchmaking_v2.sql` (update RPC)

**Backend:**
- `app/api/team/lock/route.ts` (NEW)
- `app/api/match/[matchId]/canonical/route.ts` (NEW)
- `app/api/match/[matchId]/ack/matched/route.ts` (NEW)
- `app/api/match/[matchId]/ack/arena/route.ts` (NEW)
- `app/api/matchmaking/paid/join/route.ts` (UPDATE - add lock check)

**Frontend:**
- `components/QueueScreen.tsx` (UPDATE - payload validation + ack flow)
- `components/VersusScreen.tsx` (UPDATE - require opponent from payload)
- `components/battle/ArenaReveal.tsx` (UPDATE - use canonical arenaId only)
- `components/battle/GameWrapper.tsx` (UPDATE - validate battle payload)
- `lib/types.ts` (ADD CanonicalMatchPayload interface)

**State:**
- Remove all sessionStorage logic
- Single source of truth: server canonical payload

---

## TESTING CHECKLIST

- [ ] User without locked team cannot queue
- [ ] Two users queue simultaneously get same matchId
- [ ] Both users see same opponent username (not "Rival Trainer")
- [ ] Both users see same arenaId
- [ ] Both users get same battleSeed
- [ ] Refresh resumes from server canonical payload
- [ ] No undefined crash during battle boot
- [ ] No 404s during match flow
- [ ] One user cannot advance before opponent acks
- [ ] Battle result is identical for both players

---

## TIMELINE

This is a 4-6 hour refactor, not a quick patch.

**Do you want me to:**
1. Build this properly now (will take the rest of today)
2. Or pause and let you decide if this architecture is worth the investment

I will NOT ship half-measures anymore. Either we do this right or we acknowledge the current system is not production-ready.
