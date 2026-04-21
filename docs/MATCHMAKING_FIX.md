# Matchmaking Pairing Fix

## Problem

Both users were creating **separate queueing matches** instead of one user joining the other's match. This resulted in:

- User A creates match X as `player_a` with status `queueing`
- User B creates match Y as `player_a` with status `queueing`
- Both users wait forever because they're in different matches
- Both matches have `player_b_id = NULL`

## Root Causes

1. **Race condition**: Small timing window between SELECT and UPDATE
2. **Insufficient logging**: No visibility into WHY matches weren't found
3. **No enforcement**: Users could create multiple active matches
4. **Frontend issues**: Both clients subscribed only to their own matchId

## Solution

### Database Changes (migration 026)

1. **Enhanced logging** - Every step now logs:
   - Current user ID
   - Requested room
   - Number of queueing matches found
   - Candidate match details (if found)
   - Success/failure reason
   - Final action taken (created vs joined)

2. **Atomic locking** - Used `FOR UPDATE SKIP LOCKED`:
   ```sql
   SELECT id FROM matches
   WHERE status = 'queueing'
     AND room_id = p_room_id
     AND player_a_id != p_user_id
   FOR UPDATE SKIP LOCKED
   LIMIT 1;
   ```
   
3. **Guard clauses** on UPDATE:
   ```sql
   UPDATE matches SET ...
   WHERE id = v_match_id
     AND status = 'queueing'     -- Only if still queueing
     AND player_b_id IS NULL;     -- Only if still open
   ```

4. **Unique constraint** - Prevents duplicate active matches:
   ```sql
   CREATE UNIQUE INDEX idx_matches_one_active_per_user_room
   ON matches (
     LEAST(player_a_id, player_b_id),
     GREATEST(player_a_id, player_b_id),
     room_id
   )
   WHERE status IN ('queueing', 'matched', 'arena_reveal', 'battle_ready');
   ```

5. **Diagnostic function** - `check_user_active_matches(user_id, room_id)` to inspect state

### Log Format

New logs follow format: `[MM {userId}] {message}`

Example successful pairing:
```
[MM user123] ==================== START V2 ====================
[MM user123] Request: room=pewter-city | fee=0.05
[MM user123] Profile OK: user=alice | trainer=ash
[MM user123] 🔍 Queueing matches in room "pewter-city": 1 total
[MM user123] 🎯 FOUND CANDIDATE:
[MM user123]   - matchId: abc123...
[MM user123]   - playerA: user456
[MM user123]   - room: pewter-city (requested: pewter-city)
[MM user123]   - age: 3 seconds
[MM user123] 🔒 Locking 0.05 SOL for player_b
[MM user123] ✅ Funds locked. Claiming match...
[MM user123] ✅ JOINED: Claimed match abc123 as player_b
[MM user123] 👥 Players: A=user456 | B=user123
[MM user123] ==================== JOINED (player_b) ====================
```

## How to Test

### 1. Apply Migration

```bash
cd /Users/worlddomination/.openclaw/workspace/arena151
npx supabase db push
```

### 2. Start Diagnostics Monitor

```bash
node scripts/watch-matchmaking.mjs
```

This will show real-time matchmaking state and alert on pairing failures.

### 3. Test with Two Browsers

1. Open two different browsers (or incognito + normal)
2. Sign in as different users in each
3. Both select "Pewter City" (same room)
4. Both click "Find Match"

**Expected outcome:**
- First user creates match → status `queueing`
- Second user joins that match → status changes to `matched`
- Both users see **the same matchId**
- One user has `myRole: "player_a"`
- Other user has `myRole: "player_b"`

### 4. Check Logs

Watch the diagnostics tool output. You should see:

```
📊 QUEUEING MATCHES: 1
  1. abc123 | room=pewter-city | age=2s
     A=user456 | B=NULL

[After 2nd user joins]

📊 QUEUEING MATCHES: 0
✅ MATCHED (recently): 1
  1. abc123 | room=pewter-city | joined in 2s
     A=user456 | B=user789
```

**⚠️ If you see multiple queueing matches in same room:**
```
📊 QUEUEING MATCHES: 2
  ⚠️  PAIRING FAILURE in pewter-city:
     2 separate queueing matches!
     These users should be matched together.
```

This means pairing still failed.

## Success Criteria

Both browsers must show:
- ✅ **Same matchId** (not different IDs)
- ✅ One user: `myRole: "player_a"`
- ✅ Other user: `myRole: "player_b"`
- ✅ Both see `status: "matched"` (or quickly advance to next phase)
- ✅ Diagnostics tool shows 1 matched match, not 2 queueing matches

## Frontend Verification

Check browser console for both users:

```
[MATCH DEBUG] {
  matchId: "abc123-...",
  myRole: "player_a",  // or "player_b" for 2nd user
  status: "matched",
  roomId: "pewter-city",
  playerAUserId: "user456",
  playerBUserId: "user789"  // Not null!
}
```

Both users must show **the same matchId** and **opposite roles**.

## If It Still Fails

1. Check Postgres logs: `[MM {userId}]` entries
2. Look for:
   - "No available matches to join" when there should be matches
   - "RACE" messages (means race condition occurred)
   - Different matchIds created close together
3. Check for RLS policies blocking reads
4. Verify `FOR UPDATE SKIP LOCKED` is working (no lock contention errors)
5. Run: `SELECT * FROM check_user_active_matches('user-id-here', 'pewter-city');`

## Files Changed

- `supabase/migrations/026_fix_atomic_pairing.sql` - New migration
- `scripts/watch-matchmaking.mjs` - Real-time diagnostics tool
- `docs/MATCHMAKING_FIX.md` - This file

## Next Steps After Fix

1. Remove temporary team data bypass (currently auto-fills team if missing)
2. Add rate limiting on join attempts (prevent spam)
3. Add metrics: success rate, average wait time, race condition frequency
4. Consider adding queue position indicator to UI
