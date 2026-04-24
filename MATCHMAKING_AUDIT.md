# Matchmaking System Audit - April 24, 2026

## Critical Requirements

1. **Atomic Pairing**: Two players must join THE SAME match, never create separate ones
2. **Team Locking**: Both players must lock teams BEFORE arena selection
3. **Deterministic Battle**: Server computes ONE result using shared seed
4. **Consistent Display**: Both clients show identical battle and winner
5. **Correct Settlement**: Winner receives funds exactly once

## Current System State - To Be Verified

### Entry Point
- Frontend: `QueueScreenV2.tsx`
- API: `/api/matchmaking/paid/join`
- Database: RPC `atomic_join_or_create_paid_match_v2`

### Expected Flow
```
Player 1 enters queue
  → RPC creates match (status: queueing, player_a set, player_b NULL)
  → Returns to Player 1: {matchId, myRole: 'player_a', status: 'queueing'}
  → Player 1 subscribes to match updates

Player 2 enters queue
  → RPC finds Player 1's open match
  → RPC claims match (sets player_b, status → 'matched')
  → Returns to Player 2: {matchId, myRole: 'player_b', status: 'matched'}
  → Player 2 subscribes to same match

Both players receive realtime update: status → 'matched'
Both players proceed to team locking
Both players lock teams
Server generates battle seed
Server assigns arena
Server computes battle result
Both clients receive identical battle data
Both clients show same winner
Server settles funds to winner
```

### Points of Failure to Check

1. **Split Match Creation**
   - Are both players calling the RPC?
   - Is Player 2 finding Player 1's match?
   - Is the FOR UPDATE SKIP LOCKED working?
   - Are RLS policies blocking visibility?

2. **Team Lock Race Conditions**
   - Can battle start before both teams locked?
   - Is team lock status checked server-side?
   - Can one player advance while other is locked?

3. **Battle Determinism**
   - Is battle seed generated once and shared?
   - Does server compute battle, or do clients?
   - Can clients submit different winners?

4. **Settlement Idempotency**
   - Can settlement run twice?
   - Are funds locked during battle?
   - Is there TOCTOU vulnerability?

## Diagnostic Steps

### 1. Verify Current RPC Function
```sql
SELECT pg_get_functiondef(oid) 
FROM pg_proc 
WHERE proname = 'atomic_join_or_create_paid_match_v2';
```

### 2. Check Match Table Schema
```sql
\d matches
```

### 3. Test Atomic Pairing
- Two users queue simultaneously
- Check if ONE match created or TWO
- Verify both player_a_id and player_b_id filled

### 4. Trace Full Flow with Logging
Add logs at every critical point:
- Match lookup start
- Match found/not found
- Match claim attempt
- Match claim success/failure
- Team lock status
- Battle generation
- Winner computation
- Settlement execution

## Required Fixes

### Priority 1: Atomic Pairing
- [ ] Verify RPC has FOR UPDATE SKIP LOCKED
- [ ] Verify no RLS blocking match visibility
- [ ] Add comprehensive logging to RPC
- [ ] Test with two real users

### Priority 2: Team Locking
- [ ] Both players must lock before battle
- [ ] Server validates both locks before battle generation
- [ ] Battle cannot start with unlocked teams

### Priority 3: Battle Determinism
- [ ] Server generates battle seed once
- [ ] Server computes battle result once
- [ ] Clients receive server result, never compute locally
- [ ] Both clients show identical battle

### Priority 4: Settlement
- [ ] Winner determined server-side
- [ ] Settlement idempotent
- [ ] Funds distributed exactly once
- [ ] Loser balance updated correctly

## Testing Protocol

1. Create two test accounts with sufficient balance
2. Both enter same room matchmaking
3. Log every step with timestamps
4. Verify single match created
5. Verify both players in same match
6. Lock teams on both sides
7. Verify battle seed identical
8. Verify winner identical
9. Verify settlement correct
10. Verify no duplicate payouts

## Success Criteria

- [ ] 10/10 test runs produce single shared match
- [ ] 10/10 test runs show identical winner
- [ ] 10/10 test runs settle correctly
- [ ] Zero instances of split matches
- [ ] Zero instances of different winners
- [ ] Zero instances of incorrect payouts
