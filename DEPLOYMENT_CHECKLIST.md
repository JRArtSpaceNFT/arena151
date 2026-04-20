# Arena 151 - PVP V2 Deployment Checklist

## ✅ Pre-Deployment (COMPLETED)

- [x] Database migrations run (021, 022)
- [x] Backend endpoints deployed
- [x] Frontend V2 components built
- [x] Canonical payload types defined
- [x] Validation functions implemented

## 🧪 Testing Protocol

### Test 1: Team Lock Validation
**Objective:** Verify users cannot queue without locking team

**Steps:**
1. Open Arena151.xyz
2. Try to join a paid room WITHOUT selecting team
3. **Expected:** Error message "You must lock your team before joining matchmaking"
4. Select trainer, 6 pokemon, set order
5. Click "Lock Team for PVP"
6. **Expected:** Success message, can now queue

### Test 2: Two-Player Matchmaking
**Objective:** Verify two users get matched together (not AI)

**Setup:** Two devices, two different accounts

**Steps:**
1. Device A: Lock team, join Pewter City queue
2. Device A console should show: `Status=queueing, subscribing for updates`
3. Device B: Lock team, join Pewter City queue
4. Device B console should show: `Status=matched, acking and transitioning`
5. **Expected:** Both devices show SAME matchId in console
6. **Expected:** Both devices see opponent's real username (NOT "Rival Trainer")

**Console checks:**
```
[QueueV2] Matchmaking response: {matchId: "...", status: "matched", ...}
[QueueV2] Status=matched, acking and transitioning...
```

### Test 3: Synchronized Arena Reveal
**Objective:** Verify both players see same arena and wait for each other

**Steps:**
1. Continue from Test 2 after match found
2. Both devices should transition to VersusScreen
3. After 3 seconds, both should see ArenaReveal
4. **Expected:** SAME arena name on both devices
5. **Expected:** Both see "Waiting for opponent..." message
6. **Expected:** Both advance to battle at the SAME time

**Console checks:**
```
[ArenaRevealV2] Arena: Pewter City | Match: ...
[ArenaRevealV2] Arena ack: {bothAcked: true, nextStatus: "battle_ready"}
```

### Test 4: Battle Determinism
**Objective:** Verify both players see identical battle

**Steps:**
1. Continue from Test 3 after arena reveal
2. Let battle play out completely
3. **Expected:** SAME winner on both devices
4. **Expected:** NO undefined crashes
5. **Expected:** NO 404 errors

**Console checks:**
```
[Battle] Winner: player_a (or player_b)
```

### Test 5: Canonical Payload Validation
**Objective:** Verify payload validation catches incomplete data

**Steps:**
1. Check browser console for ANY validation errors
2. **Expected:** NO messages like "Invalid match data: Missing opponent.username"
3. **Expected:** Opponent name always populated

### Test 6: Refresh/Reconnect
**Objective:** Verify refresh resumes from server state

**Steps:**
1. During queueing, refresh page
2. **Expected:** Returns to room select (match expired)
3. During matched phase, refresh page
4. **Expected:** Resumes to VersusScreen with correct opponent

## 🐛 Known Issues to Watch For

### Issue: "TEAM_NOT_LOCKED" error
**Cause:** User didn't call /api/team/lock before queueing
**Fix:** Add TeamLockFlow component to draft screen

### Issue: Both players see "Rival Trainer"
**Cause:** player_a_username or player_b_username not set in DB
**Fix:** Check atomic_join_or_create_paid_match_v2 is being called

### Issue: One player stuck on "Waiting for opponent"
**Cause:** Realtime subscription not firing or ack not persisting
**Fix:** Check Supabase realtime is enabled: `ALTER PUBLICATION supabase_realtime ADD TABLE matches;`

### Issue: Undefined crash: "Cannot read properties of undefined (reading 'ac')"
**Cause:** Battle engine receiving incomplete team data
**Fix:** Check playerA.team and playerB.team are arrays of 6 pokemon IDs

### Issue: 404 errors
**Cause:** Missing trainer/pokemon sprites
**Fix:** Audit asset paths, ensure all referenced files exist

## 📊 Success Criteria

✅ Two users can queue and match together
✅ Both see opponent's real username
✅ Both see same arena
✅ Both advance together (no one gets ahead)
✅ Battle completes without crashes
✅ Same winner on both devices
✅ Settlement processes correctly

## 🚨 Rollback Plan

If V2 breaks:
1. Revert to previous commit: `git reset --hard e0ebff1`
2. Push: `git push --force`
3. Deploy old version: `npx vercel --prod --yes`
4. Void all active matches: `UPDATE matches SET status='voided' WHERE status IN ('queueing','matched','arena_reveal')`

## 📝 Post-Deployment Notes

**What changed:**
- Matchmaking now requires team lock
- Canonical payload enforces server-authoritative data
- No more GENERIC_RIVAL fallbacks
- Ack gates prevent race conditions
- All screens validate payload before rendering

**Breaking changes:**
- Old QueueScreen replaced with QueueScreenV2
- SessionStorage auto-restore disabled
- Team must be locked before queueing
- Refresh during match may lose progress (by design - prevents stale state)

**Performance:**
- Adds 2 extra API calls per match (ack endpoints)
- Polling every 1s while waiting for opponent (max 30s)
- Total latency increase: ~1-2 seconds per phase transition

**Database load:**
- New columns: 21 (mostly JSONB and BOOLEAN)
- New indexes: 2 (arena_id, status)
- RPC calls per match: 3-5 (join, canonical, 2x ack)
