# Arena 151 — Production Operations Manual

---

## Launch Checklist

### Pre-Launch

1. **Helius webhook** — switch to HMAC signing mode in dashboard; remove any `?secret=` query param from the webhook URL; confirm `HELIUS_WEBHOOK_SECRET` in Vercel matches the dashboard signing secret
2. **Vercel cron** — confirm `/api/cron/settlement-health` is listed and has run recently in Vercel dashboard → Cron tab; must be on Pro plan (Hobby = 2/day max)
3. **Env vars** — all set in Vercel: `SUPABASE_SERVICE_KEY`, `WALLET_ENCRYPTION_SECRET`, `ADMIN_SECRET`, `HELIUS_API_KEY`, `HELIUS_WEBHOOK_SECRET`, RPC URL
4. **End-to-end test** — run 5 complete matches with 2 real accounts; verify DB balances match on-chain after each
5. **unlock_player_funds** — grep Vercel logs to confirm return values are logged and not silently failing
6. **Reconciliation SQL** — run the daily reconciliation queries below; all must return healthy (0 rows / 0 drift)
7. **Resume endpoint — settled path** — for a completed test match, call `GET /api/match/:id/resume` as both the winner and loser account; confirm response includes `resumePhase: 'settled'` and a populated `resultPayload` with `iWon`, `myProfile`, `opponentProfile`, and `payoutDelta`
8. **Cancel / timeout path** — trigger a match where P1 creates and then cancels (or the forming TTL expires); confirm the match status becomes `voided` and P1's funds are returned immediately (check `profiles.balance` and `audit_log`)
9. **ArenaReveal refresh safety** — while P1 is waiting at ArenaReveal (match in `forming` state), hard-refresh the page; confirm only one `forming` match exists for that user in the DB (no duplicate created)

### Two-Browser Smoke Test

1. **Happy path** — P1 creates match → P2 joins → both battle → auto-settle fires → result screen shows correct SOL delta for both players → hard-refresh result screen on both browsers → confirm it hydrates from server with no blank screen
2. **Disconnect / resume path** — P1 joins match → P2 hard-refreshes mid-battle → confirm P2 resumes at the correct phase (`battle_ready`) → battle completes → settlement fires exactly once (check `audit_log` for single `settlement_winner` event)

### Post-Launch Monitoring

1. **Vercel logs** — watch for `[settle]` errors or `settlement_failed` status in DB
2. **Stuck matches** — Supabase matches table: no rows in `forming` > 30 min or `settling` > 5 min
3. **Helius deposits** — confirm webhook delivery is hitting `/api/webhook/deposit` (check Vercel function logs after any deposit)
4. **Manual review queue** — `GET /api/admin/matches?status=manual_review` should return 0
5. **Duplicate forming matches** — watch for multiple `forming` rows with the same `player_a_id`; indicates ArenaReveal refresh is creating extra matches (run: `SELECT player_a_id, COUNT(*) FROM matches WHERE status = 'forming' GROUP BY player_a_id HAVING COUNT(*) > 1`)
6. **Settlement double-fire** — watch for spikes in `alreadySettled: true` in Vercel logs; each match should settle once; repeated hits may indicate a client-side retry loop
7. **Abandoned matches** — track daily: `SELECT DATE(created_at), COUNT(*) FROM matches WHERE status IN ('voided','abandoned') GROUP BY 1 ORDER BY 1 DESC`; spikes signal UX friction in the match flow

### Emergency Rollback

```bash
# Roll back to last good Vercel deploy
npx vercel rollback --yes

# Stuck funds mid-settlement — find and act
SELECT * FROM matches
WHERE status IN ('settling', 'settlement_pending')
AND updated_at < now() - interval '10 minutes';
-- Resolve via admin API:
curl -X POST https://arena151.xyz/api/admin/match/MATCH_ID/review \
  -H "x-admin-token: $ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"action":"refund_both","reason":"Rollback — settlement did not complete"}'

# Client-side support reset (give to player if their session is stuck)
sessionStorage.clear()   # run in browser console — clears matchId/seed/joiner state
```

---

## Pre-Launch Checklist (run before first real wager)

### 1. Helius Webhook Verification (FIX 1)
The webhook auth was changed to HMAC-only. The `?secret=` query param was removed.
**You must reconfigure Helius or deposits will silently fail.**

Steps:
1. Go to https://dev.helius.xyz/dashboard/app
2. Select your webhook
3. Under "Auth Type" → ensure it is set to **"Signing Secret"** (not "Auth Header" or query param)
4. The webhook URL must NOT contain `?secret=...` — remove it if present
5. The signing secret in Helius dashboard must match `HELIUS_WEBHOOK_SECRET` in Vercel env vars
6. Test: Make a small deposit (0.01 SOL) to any registered wallet and verify:
   - Vercel function logs show `[Deposit Webhook] Credited X SOL`
   - Supabase `profiles.balance` increases
   - Supabase `audit_log` has a `deposit` event

### 2. Vercel Cron Verification (FIX 2)
The settlement health cron (every 5 minutes) handles:
- Stuck battle detection + fund unlock
- forming/ready match TTL expiry + fund unlock
- settling mutex leak recovery
- Settlement retry triggering

**Without this cron, stuck funds have no automatic recovery.**

Steps:
1. Go to Vercel dashboard → your project → Settings → Cron Jobs
2. Confirm `/api/cron/settlement-health` is listed with schedule `*/5 * * * *`
3. Confirm the cron has run recently (check "Last Run" timestamp)
4. If on Hobby plan: cron is limited to 2 per day — **upgrade to Pro plan before launch**
5. Manually trigger: `GET /api/cron/settlement-health` with `x-cron-secret` header
6. Verify response includes all 5 jobs: settlementRetry, stuckBattles, expiredForming, expiredReady, stuckSettling

---

## Daily Reconciliation Queries

Run these in Supabase SQL Editor every day. All must return the "healthy" value.

```sql
-- 1. locked_balance > balance (NEVER acceptable)
SELECT COUNT(*) as violations FROM profiles WHERE locked_balance > balance;
-- HEALTHY: 0. IMMEDIATE ACTION if > 0.

-- 2. Locked funds conservation (should always be 0 drift)
WITH active AS (
  SELECT COALESCE(SUM(entry_fee_sol), 0) * 2 AS expected_locked
  FROM matches
  WHERE status IN ('forming','ready','funds_locked','battling','result_pending','settlement_pending','settling')
)
SELECT
  (SELECT COALESCE(SUM(locked_balance),0) FROM profiles) AS actual_locked,
  active.expected_locked,
  (SELECT COALESCE(SUM(locked_balance),0) FROM profiles) - active.expected_locked AS drift
FROM active;
-- HEALTHY: drift = 0. Investigate any non-zero drift immediately.

-- 3. Duplicate settlements (should never happen)
SELECT match_id, event_type, COUNT(*)
FROM audit_log
WHERE event_type IN ('settlement_winner','settlement_loser')
GROUP BY match_id, event_type HAVING COUNT(*) > 1;
-- HEALTHY: 0 rows.

-- 4. Settled matches missing tx signature
SELECT id, status, error_message FROM matches WHERE status = 'settled' AND settlement_tx IS NULL;
-- HEALTHY: 0 rows.

-- 5. Orphaned locks (locked balance with no active match)
SELECT p.id, p.locked_balance FROM profiles p
WHERE p.locked_balance > 0
AND NOT EXISTS (
  SELECT 1 FROM matches m
  WHERE m.status IN ('forming','ready','funds_locked','battling','result_pending','settlement_pending','settling')
  AND (m.player_a_id = p.id OR m.player_b_id = p.id)
);
-- HEALTHY: 0 rows. Manual unlock required if any found.

-- 6. Audit log missing for settled matches
SELECT m.id FROM matches m
WHERE m.status = 'settled'
AND NOT EXISTS (SELECT 1 FROM audit_log a WHERE a.match_id = m.id AND a.event_type = 'settlement_winner');
-- HEALTHY: 0 rows. Indicates crash post-settlement if any found.

-- 7. Duplicate deposits (same tx + address credited twice)
SELECT tx_signature, to_address, COUNT(*)
FROM transactions
WHERE type = 'deposit'
GROUP BY tx_signature, to_address HAVING COUNT(*) > 1;
-- HEALTHY: 0 rows.

-- 8. manual_review matches (need admin resolution)
SELECT id, player_a_id, player_b_id, entry_fee_sol, error_message, created_at, updated_at
FROM matches WHERE status = 'manual_review'
ORDER BY updated_at DESC;
-- HEALTHY: 0 rows. Each row needs admin action via /api/admin/match/:id/review.

-- 9. settlement_failed matches needing retry attention
SELECT id, retry_count, error_message, winner_id, settlement_tx, updated_at
FROM matches WHERE status = 'settlement_failed'
ORDER BY retry_count DESC, updated_at ASC;
-- HEALTHY: 0 rows. Retry worker handles these automatically up to 3 retries.
-- Any with retry_count >= 3 need manual intervention.

-- 10. Negative available balance
SELECT id, balance, locked_balance, balance - locked_balance AS available
FROM profiles WHERE balance - locked_balance < -0.000001;
-- HEALTHY: 0 rows. Should be caught by DB constraint.

-- 11. Missing house fee (detect treasury revenue loss)
SELECT
  (SELECT COUNT(*) FROM matches WHERE status = 'settled') AS total_settled,
  (SELECT COUNT(*) FROM audit_log WHERE event_type = 'house_fee_failed') AS fee_failures,
  (SELECT COALESCE(SUM(amount_sol),0) FROM audit_log WHERE event_type = 'house_fee_failed') AS lost_fees_sol;
-- HEALTHY: fee_failures = 0. Any lost_fees_sol > 0 needs manual fee collection.

-- 12. DB vs on-chain balance drift detection (run weekly)
-- Note: This requires cross-referencing with on-chain data via Helius.
-- For each user, compare profiles.balance with actual on-chain wallet balance.
-- Run this script periodically to detect custodial drift:
SELECT id, sol_address, balance, locked_balance, balance - locked_balance AS available
FROM profiles
ORDER BY balance DESC;
-- Then verify top wallets via: getSolBalance(sol_address) in Helius/Solscan.

-- 13. Match outcome vs financial outcome mismatch
SELECT m.id, m.winner_id, a_win.user_id AS credited_user
FROM matches m
LEFT JOIN audit_log a_win ON a_win.match_id = m.id AND a_win.event_type = 'settlement_winner'
WHERE m.status = 'settled'
AND (a_win.user_id IS NULL OR m.winner_id != a_win.user_id);
-- HEALTHY: 0 rows.
```

---

## Admin API Reference

### List matches needing attention
```bash
curl https://arena151.xyz/api/admin/matches \
  -H "x-admin-token: $ADMIN_SECRET" \
  -G --data-urlencode "status=manual_review,settlement_failed"
```

### View a specific match + full audit trail
```bash
curl https://arena151.xyz/api/admin/match/MATCH_ID/review \
  -H "x-admin-token: $ADMIN_SECRET"
```

### Force-settle a disputed match
```bash
curl -X POST https://arena151.xyz/api/admin/match/MATCH_ID/review \
  -H "x-admin-token: $ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"action":"settle_winner_a","reason":"Server replay confirmed player A won"}'
```

### Refund both players
```bash
curl -X POST https://arena151.xyz/api/admin/match/MATCH_ID/review \
  -H "x-admin-token: $ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"action":"refund_both","reason":"Server crash during battle — no outcome determinable"}'
```

### Manually trigger settlement retry
```bash
curl -X POST https://arena151.xyz/api/admin/settlement-retry \
  -H "x-admin-token: $ADMIN_SECRET"
```

### Manually trigger health cron
```bash
curl https://arena151.xyz/api/cron/settlement-health \
  -H "x-cron-secret: $CRON_SECRET"
```

---

## Key Rotation Procedure (FIX 10)

**WALLET_ENCRYPTION_SECRET** encrypts every user's Solana private key in the database.
If this key is rotated without re-encrypting all keys first, all user funds become
inaccessible (decryption will fail on every sendSol call).

### When to rotate:
- If WALLET_ENCRYPTION_SECRET is suspected compromised
- Routine security rotation (recommend every 6-12 months)
- Before: never rotate without following this procedure

### Rotation procedure:
1. **Set new secret in a temp env var** (do NOT replace the old one yet):
   ```
   WALLET_ENCRYPTION_SECRET_NEW=<new-64-char-hex>
   ```

2. **Run re-encryption script** (see `scripts/rotate-encryption-key.ts`):
   - Reads every `encrypted_private_key` from profiles
   - Decrypts with OLD key
   - Re-encrypts with NEW key
   - Updates the row in DB
   - Verifies decryption with NEW key before committing

3. **Verify re-encryption** — run a test sendSol with the new key on a test wallet

4. **Replace env var** — update `WALLET_ENCRYPTION_SECRET` in Vercel to the new value

5. **Remove temp var** — delete `WALLET_ENCRYPTION_SECRET_NEW`

6. **Verify** — trigger a test withdrawal. Confirm it succeeds.

**Never delete the old key until re-encryption + verification is complete.**

---

## Supabase Connection Pool (FIX 8)

Free plan: ~60 connections. Pro plan: 200+.

At 500 concurrent matches, each settlement hits Supabase 4-6 times (auth, match read,
profile reads, RPC calls, audit log writes). At 20 concurrent settlements you can exhaust
the connection pool. Symptoms: `Connection refused` or `ECONNRESET` errors in Vercel logs.

**Before launch:**
1. Upgrade to Supabase Pro if expecting > 20 simultaneous players
2. Monitor: Supabase Dashboard → Project → Reports → Database → Active Connections
3. Alert threshold: > 80% of connection limit = scale up immediately

---

## House Fee Reconciliation

Run weekly to detect uncollected treasury fees:

```sql
SELECT
  COUNT(*) AS failed_fee_events,
  COALESCE(SUM((metadata->>'amount_sol')::numeric), 0) AS uncollected_fees_sol
FROM audit_log
WHERE event_type = 'house_fee_failed';
```

For each `match_id` in results, manually send the fee:
```
sendSol(loserProfile.encryptedKey, TREASURY_ADDRESS, houseFee)
```

---

## Emergency Procedures

### All settlements failing
1. Check Vercel function logs for errors
2. Check Helius RPC status: https://status.helius.dev
3. Check Supabase status: https://status.supabase.com
4. If Helius RPC is down: no settlement or withdrawal possible until restored
   - Funds are safe in custodial wallets — no money lost
   - Alert users: settlements paused, will resume automatically

### User reports balance not updated after deposit
1. Check Vercel logs for `[Deposit Webhook]` entries
2. If missing: Helius webhook may be misconfigured (see Pre-Launch Checklist #1)
3. Check Supabase `audit_log` for `deposit` event with their wallet address
4. If deposit tx exists on-chain but not in DB: manually call `process_deposit` RPC

### Funds stuck in manual_review
1. Funds are already UNLOCKED (since M5 fix) — user can withdraw their available balance
2. Match record is for reconciliation only
3. Run: `GET /api/admin/match/:id/review` to see full context
4. Resolve with appropriate admin action (settle/refund/void)

### Encrypted key rotation emergency (suspected key compromise)
1. Immediately: revoke WALLET_ENCRYPTION_SECRET in Vercel (set to garbage value)
   - This blocks ALL withdrawals and settlements — no funds can leave
   - Funds are safe on-chain
2. Audit: determine if any private keys were accessed with the compromised key
3. Follow Key Rotation Procedure above to restore service
