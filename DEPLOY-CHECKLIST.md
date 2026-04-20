# 🚀 Arena 151 Atomic Matchmaking — Deploy Checklist

## Pre-Flight

- [x] Root cause identified (TOCTOU race condition)
- [x] Solution designed (atomic server RPC + row locking)
- [x] Code written
- [x] Automated test created
- [x] Documentation written

---

## Deployment (15 minutes)

### Step 1: Apply Database Migration (5 min)

1. Open Supabase SQL Editor:
   ```
   https://supabase.com/dashboard/project/abzurjxkxxtahdjrpvxk/sql/new
   ```

2. Open local file:
   ```bash
   open supabase/migrations/018_atomic_matchmaking.sql
   ```

3. Copy entire SQL file → Paste into SQL Editor → Click "Run"

4. Expected result: Green success message, no errors

5. Verify RPC exists:
   ```sql
   SELECT routine_name FROM information_schema.routines
   WHERE routine_name = 'atomic_join_or_create_paid_match';
   ```
   Should return 1 row.

---

### Step 2: Deploy Code to Vercel (5 min)

```bash
cd /Users/worlddomination/.openclaw/workspace/arena151

# Commit changes
git add .
git commit -m "Fix: Implement atomic matchmaking to prevent race conditions

- Add atomic_join_or_create_paid_match RPC with FOR UPDATE SKIP LOCKED
- Add /api/matchmaking/paid/join endpoint (server-authoritative)
- Replace client-side search-then-create logic with single server call
- Add automated concurrency test
- Handle edge cases: idempotency, TTL, duplicate protection"

# Push to GitHub (Vercel auto-deploys)
git push
```

Wait for Vercel deployment to complete (~2 min):
```
https://vercel.com/jonathan-foley-og6b/deployments
```

---

### Step 3: Run Automated Test (2 min)

```bash
cd /Users/worlddomination/.openclaw/workspace/arena151
npm run test:matchmaking
```

**Expected output:**
```
✅ PASS: Both users in same match
✅ PASS: Users have different roles (player_a / player_b)
✅ PASS: Only one match created
🎉 ALL TESTS PASSED
```

**If test fails:** Check logs, review RPC in Supabase, verify migration applied.

---

### Step 4: Manual Verification (3 min)

**Test with 2 real browsers:**

1. Open Chrome (normal)
2. Open Chrome (incognito) or Safari
3. Log in as different users (or create 2 test accounts)
4. Both select same room (e.g., Bronze Tier - 0.05 SOL)
5. **Click "Enter Arena" at the same time** (countdown: 3, 2, 1, GO!)
6. Expected: Both land in same match
7. Check server logs for confirmation:
   ```
   [Matchmaking xxx] Role: player_a | Match: abc-123
   [Matchmaking yyy] Role: player_b | Match: abc-123  ← Same match ID
   ```

---

## Validation

### ✅ Success Indicators

- [ ] Migration applied without errors
- [ ] Vercel deployment succeeded
- [ ] `npm run test:matchmaking` passes
- [ ] Two real users land in same match
- [ ] Server logs show correct role assignment
- [ ] Only ONE match created per pair
- [ ] No duplicate fund locks

### ❌ Rollback Plan (if needed)

If something breaks:

1. **Revert code:**
   ```bash
   git revert HEAD
   git push
   ```

2. **Old endpoints still work** (backward compatible)
   - `/api/match/queue` (GET/POST) still exists
   - Client can fall back to old flow if new endpoint fails

3. **Manual match cleanup** (if needed):
   ```sql
   -- Unlock funds for any stuck forming matches
   SELECT * FROM matches WHERE status = 'forming' AND created_at < now() - interval '10 minutes';
   -- Then manually call cleanup_expired_matches() or unlock funds via RPC
   ```

---

## Post-Deployment Monitoring

### First 30 Minutes

Watch Vercel logs for:
- `[Matchmaking ...]` entries
- Any errors from `/api/matchmaking/paid/join`
- Successful role assignments (player_a / player_b)

### First 24 Hours

Monitor:
- Match success rate (forming → ready → settled)
- Average matchmaking latency
- Any duplicate matches created (should be 0)
- Any stuck forming matches (should auto-expire)

### Metrics to Track

| Metric | Target | Check |
|--------|--------|-------|
| Matchmaking latency | < 200ms | Server logs |
| Match pairing rate | > 95% | DB query: `SELECT COUNT(*) FROM matches WHERE player_b_id IS NOT NULL` |
| Duplicate matches | 0 | Test script |
| Abandoned matches | < 5% | `cleanup_expired_matches()` results |

---

## Troubleshooting

### Issue: Migration fails with "function already exists"

**Solution:** RPC is idempotent. It's safe to rerun. Or use `CREATE OR REPLACE FUNCTION`.

### Issue: Test fails with "insufficient funds"

**Solution:** Test users need 10 SOL balance. Check/reset via:
```sql
UPDATE profiles SET balance = 10.0, locked_balance = 0
WHERE id IN ('test-user-1-uuid', 'test-user-2-uuid');
```

### Issue: Two users still get separate matches

**Possible causes:**
1. Migration didn't apply → Check RPC exists in Supabase
2. Client still using old endpoint → Check network tab, should call `/api/matchmaking/paid/join`
3. Cache issue → Hard refresh both browsers (Cmd+Shift+R)

### Issue: Match stays in "forming" forever

**Solution:** Run cleanup:
```sql
SELECT cleanup_expired_matches();
```

Or set up cron job to run this every 5 min.

---

## Optional: Set Up Automated Cleanup Cron

Add to Supabase cron extension (or external cron service):

```sql
-- Run every 5 minutes
SELECT cron.schedule(
  'cleanup-expired-matches',
  '*/5 * * * *',
  $$SELECT cleanup_expired_matches()$$
);
```

---

## 📞 Support

If anything goes wrong:

1. Check server logs: Vercel dashboard
2. Check DB logs: Supabase dashboard → Logs
3. Review this checklist
4. Review `docs/MATCHMAKING-FIX.md` for details
5. Ask Achilles (me!) for help

---

**Ready to deploy?** Start with Step 1. Take it one step at a time. You got this! 🎮

— Achilles
