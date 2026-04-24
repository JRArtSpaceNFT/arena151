# Matchmaking Fix - Complete Guide

## What This Fixes

1. **Atomic Pairing**: Prevents split matches - both players join THE SAME match
2. **Comprehensive Logging**: Every step is logged to `matchmaking_log` table
3. **Race Condition Protection**: FOR UPDATE SKIP LOCKED prevents duplicate joins
4. **Diagnostic View**: `matchmaking_flow_trace` shows complete flow for any match

## Step 1: Apply the Migration

Go to Supabase SQL Editor and run:

```
supabase/migrations/028_production_matchmaking.sql
```

This will:
- Create `matchmaking_log` table for auditing
- Replace `atomic_join_or_create_paid_match_v2` with production version
- Create diagnostic view `matchmaking_flow_trace`

## Step 2: Test Atomic Pairing

### Setup
1. Two test accounts with 1 SOL each
2. Both hard refresh browsers (Cmd+Shift+R)
3. Ready to queue in same room

### Test Protocol

**Account 1 (e.g., rarecandyclub):**
1. Select Pewter City
2. Click "Find Match"
3. Note the matchId from console

**Account 2 (e.g., ash_ketchup):**
1. Select Pewter City
2. Click "Find Match"  
3. Note the matchId from console

**CRITICAL CHECK**: Both matchIds must be IDENTICAL

### Verify in Database

```sql
-- Check if both players in same match
SELECT 
  id,
  player_a_id,
  player_b_id,
  status,
  room_id,
  battle_seed,
  created_at
FROM matches
WHERE created_at > now() - interval '5 minutes'
ORDER BY created_at DESC;
```

**Expected Result:**
- ONE match row
- `player_a_id` = Account 1's user ID
- `player_b_id` = Account 2's user ID
- `status` = `matched`
- Both accounts show SAME `id`

**Failure Signs:**
- TWO match rows = Atomic pairing failed
- `player_b_id` = NULL = Account 2 didn't join
- Different `id` values = Split match bug

### Check Matchmaking Logs

```sql
-- View complete flow for recent matches
SELECT * FROM matchmaking_flow_trace
WHERE created_at > now() - interval '10 minutes'
ORDER BY created_at ASC;
```

**Expected Log Sequence (Account 1):**
1. `matchmaking_start` - Account 1 enters
2. `search_open_match` - Looks for existing match
3. `no_match_found` - None available
4. `match_created` - Creates new match as player_a

**Expected Log Sequence (Account 2):**
1. `matchmaking_start` - Account 2 enters
2. `search_open_match` - Looks for existing match
3. `candidate_found` - Finds Account 1's match
4. `match_joined` - Successfully joins as player_b

**Failure Indicators:**
- Account 2 shows `match_created` instead of `match_joined` = Didn't find Account 1's match
- Account 2 shows `race_condition` = Match was claimed by someone else (rare, retry should succeed)
- Missing logs = RPC function not running

## Step 3: Debug Common Issues

### Issue: Both players create separate matches

**Diagnosis:**
```sql
-- Check for duplicate matches in same room
SELECT 
  room_id,
  COUNT(*) as match_count,
  ARRAY_AGG(id) as match_ids,
  ARRAY_AGG(player_a_id) as player_a_ids
FROM matches
WHERE status IN ('queueing', 'matched')
  AND created_at > now() - interval '10 minutes'
GROUP BY room_id
HAVING COUNT(*) > 1;
```

**Possible Causes:**
1. RLS policy blocking visibility
2. Timing issue (both called RPC simultaneously before either created match)
3. FOR UPDATE SKIP LOCKED not working

**Solution:**
- Check RLS policies: `SELECT * FROM pg_policies WHERE tablename = 'matches';`
- Add delay between queue attempts (test with 2-3 second gap)
- Verify migration 028 applied correctly

### Issue: Account 2 gets 500 error

**Check Vercel Logs:**
- Look for error code in response
- Check if RPC function exists
- Verify database connection

**Check Browser Console:**
- Expand error object
- Look for specific error message
- Check if API call reached server

### Issue: Match created but player_b stays NULL

**Diagnosis:**
```sql
-- Check matchmaking logs for Account 2
SELECT * FROM matchmaking_log
WHERE user_id = '<account-2-user-id>'
  AND created_at > now() - interval '10 minutes'
ORDER BY created_at ASC;
```

**If no logs:** Account 2's RPC call never executed
**If logs stop at `candidate_found`:** UPDATE failed (trigger blocking?)
**If shows `race_condition`:** Normal, should retry and succeed

## Step 4: Verify Team Locking (Next Phase)

After pairing works:

1. Both players should see "Match Found" screen
2. Both proceed to team selection
3. Both must lock teams before battle starts
4. Server validates both locks before generating battle

**Check team lock status:**
```sql
SELECT 
  id,
  player_a_team_locked,
  player_b_team_locked,
  battle_seed,
  status
FROM matches
WHERE id = '<match-id>';
```

## Step 5: Verify Server-Side Battle

**Critical Requirements:**
1. Battle seed generated ONCE by server
2. Battle computed ONCE by server
3. Both clients receive SAME battle result
4. Winner determined server-side, not client-side

**Check battle computation:**
```sql
SELECT 
  id,
  battle_seed,
  winner_id,
  team_a,
  team_b,
  battle_log
FROM matches
WHERE id = '<match-id>';
```

**Expected:**
- `battle_seed` is identical for both players
- `winner_id` is set server-side
- `battle_log` contains server-computed result

## Success Criteria

✅ **Pairing Works**: 10/10 test runs produce ONE shared match
✅ **No Split Matches**: Zero instances of both players creating separate matches
✅ **Logs Complete**: Every step traceable in `matchmaking_log`
✅ **No Errors**: Both players enter match without 500/409 errors

## If All Else Fails

**Nuclear Option - Start Fresh:**

```sql
-- Backup current state
CREATE TABLE matches_backup AS SELECT * FROM matches;
CREATE TABLE matchmaking_log_backup AS SELECT * FROM matchmaking_log;

-- Clear all active matches
UPDATE matches SET status = 'cancelled' 
WHERE status IN ('queueing', 'matched');

-- Clear logs older than 1 hour
DELETE FROM matchmaking_log WHERE created_at < now() - interval '1 hour';
```

Then test with completely clean state.

## Contact Points

If you see any of these, message back:
- **Split matches** (two separate match IDs)
- **500 errors** (RPC failing)
- **player_b stays NULL** (join failing)
- **Missing logs** (logging not working)

Include:
1. Both browser console logs
2. Database query results
3. `matchmaking_flow_trace` output
4. Vercel error logs (if any)

This will let me pinpoint the exact failure point.
