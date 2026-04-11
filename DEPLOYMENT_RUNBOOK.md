# Arena 151 Production Deployment Runbook

**Environment:** Production (`arena151.xyz`)  
**Database:** Supabase (`abzurjxkxxtahdjrpvxk`)  
**Hosting:** Vercel

---

## PRE-DEPLOYMENT CHECKLIST

- [ ] All blockers fixed (see `IMMEDIATE_ACTION_PLAN.md`)
- [ ] Secrets rotated and stored in Vercel env vars
- [ ] Wallets re-encrypted with new master key
- [ ] `.env.local` deleted from repo
- [ ] All DB migrations applied to production Supabase
- [ ] `LAUNCH_GATE_CHECKLIST.md` completed → all PASS
- [ ] Staging tested with real SOL (devnet or small mainnet amounts)

---

## DEPLOYMENT STEPS

### 1. Database Migrations

```bash
# Connect to Supabase
cd arena151/supabase/migrations

# Apply new migrations (if any pending)
# Go to Supabase dashboard → SQL Editor → New Query
# Paste contents of each new .sql file and run
```

**Apply in order:**
1. `014_wallet_key_versioning.sql`
2. `015_withdrawal_security.sql`

**Verify:**
```sql
-- Check key_version column exists
SELECT key_version, COUNT(*) FROM profiles GROUP BY key_version;

-- Check first_withdrawal_at column exists
SELECT COUNT(*) FROM profiles WHERE first_withdrawal_at IS NOT NULL;
```

---

### 2. Re-Encrypt Wallets (ONE-TIME ONLY)

⚠️ **CRITICAL:** Only run this ONCE after rotating `WALLET_ENCRYPTION_SECRET`

```bash
# Set old and new keys (from 1Password)
export OLD_WALLET_KEY="<64-char-hex-old-key>"
export NEW_WALLET_KEY="<64-char-hex-new-key>"

# Pull production env vars
vercel env pull .env.production.local

# Run migration
npm run migrate:re-encrypt

# Expected output:
# ✅ Re-encrypted username (uuid)
# ...
# 🎉 Migration complete! All wallets re-encrypted with new key.
```

**Verify:**
```sql
SELECT * FROM get_key_version_summary();
-- Expected: All profiles show key_version=2
```

**⚠️ DO NOT run this script twice** — it will fail (old key no longer valid)

---

### 3. Update Vercel Environment Variables

**Dashboard:** https://vercel.com/dashboard → arena151 → Settings → Environment Variables

**Add/Update:**
```
WALLET_ENCRYPTION_SECRET = <new-64-char-hex>   (Production only)
ADMIN_SECRET = <new-64-char-hex>               (Production only)
HELIUS_API_KEY = <production-api-key>          (Production only)
HELIUS_WEBHOOK_SECRET = <from-helius-dashboard> (Production only)
```

**Verify:**
- [ ] Production env vars set
- [ ] Preview env vars set (can be same as dev)
- [ ] Development env vars set (separate keys!)

---

### 4. Deploy to Production

```bash
# From arena151 directory
cd /Users/worlddomination/.openclaw/workspace/arena151

# Build locally first (verify no errors)
npm run build

# Deploy to production
vercel --prod

# Expected output:
# ✅ Deployed to production: https://arena151.xyz
```

**Deployment URL:** https://arena151.xyz

---

### 5. Post-Deployment Verification

#### 5.1 Health Check

```bash
curl https://arena151.xyz/api/health

# Expected response:
{
  "status": "ok",
  "timestamp": "2026-04-11T...",
  "secrets": {
    "SUPABASE_SERVICE_KEY": true,
    "WALLET_ENCRYPTION_SECRET": true,
    "HELIUS_API_KEY": true,
    "ADMIN_SECRET": true
  }
}
```

❌ If any secret shows `false` → deployment FAILED, env vars not loaded

---

#### 5.2 Database Connection

```bash
# Test user profile load
curl https://arena151.xyz/api/user/profile \
  -H "Authorization: Bearer <test-user-jwt>"

# Expected: User profile returned (balance, username, etc.)
```

---

#### 5.3 Withdrawal Safety

**Test 1: First-withdrawal delay**
```bash
# Create new account (age <24h)
# Attempt withdrawal

# Expected response:
{
  "error": "First withdrawal requires 24h account age for security",
  "code": "FIRST_WITHDRAWAL_DELAY",
  "accountAgeHours": 0,
  "requiredAgeHours": 24,
  "hoursRemaining": 24
}
```

**Test 2: Velocity limit**
```bash
# Make 4 withdrawal requests in rapid succession

# Expected: First 3 succeed, 4th returns:
{
  "error": "Maximum 3 withdrawals per 24 hours. Please try again later.",
  "code": "VELOCITY_LIMIT_EXCEEDED",
  "recentWithdrawals": 3,
  "limit": 3
}
```

---

#### 5.4 Settlement Integrity

**Check locked balance reconciliation:**
```sql
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
```

**Expected:** `drift = 0`  
**If drift ≠ 0:** 🚨 EMERGENCY — pause all settlements, investigate

---

#### 5.5 Cron Jobs

**Verify cron is running:**
```bash
# Vercel Dashboard → Deployments → arena151 → Logs
# Filter: "cron"

# Expected: Logs every 5 minutes:
# [SettlementHealth] {...}
```

**Manual trigger:**
```bash
curl https://arena151.xyz/api/cron/settlement-health

# Expected response:
{
  "timestamp": "2026-04-11T...",
  "settlementRetry": {...},
  "stuckBattles": {"flagged": 0},
  "expiredForming": {"voided": 0},
  "expiredReady": {"voided": 0},
  "stuckSettling": {"recovered": 0}
}
```

---

### 6. Smoke Test (End-to-End)

**Scenario: Full match lifecycle**

1. **User A deposits 0.01 SOL**
   - Verify: Balance updated in UI within 10s
   - Check: `transactions` table has deposit record
   - Check: `audit_log` has `deposit` event

2. **User A creates match (0.001 SOL wager)**
   - Verify: `locked_balance` increased by 0.001
   - Verify: `available_balance` decreased by 0.001
   - Check: Match status = 'forming'

3. **User B joins match**
   - Verify: Both players' `locked_balance` = 0.001
   - Verify: Match status = 'settlement_pending' (server-authoritative)
   - Check: `winner_id` is set

4. **Settlement triggered**
   - Verify: Winner receives payout (0.0019 SOL = 95% of 0.002 pot)
   - Verify: Loser `balance` decreased by 0.002 (both stakes)
   - Verify: Both `locked_balance` = 0 (released)
   - Check: Match status = 'settled'
   - Check: `settlement_tx` signature stored
   - Check: `audit_log` has `settlement_winner` + `settlement_loser` events

5. **Winner withdraws**
   - Verify: Withdrawal succeeds (or blocked if first withdrawal + <24h)
   - Check: `transactions` table has withdrawal record
   - Verify: On-chain tx signature matches `tx_signature` in DB

**✅ All steps pass?** → Deployment successful

**❌ Any step fails?** → Roll back, investigate

---

## ROLLBACK PROCEDURE

If deployment fails or critical bug discovered:

### Option 1: Vercel Rollback (Fast)

```bash
# Vercel Dashboard → Deployments → Previous deployment → "Promote to Production"
```

**Time:** <2 minutes  
**Downside:** Rolls back ALL changes (code + env vars)

---

### Option 2: Code Revert (Selective)

```bash
# Revert specific commits
git revert <commit-hash>
git push

# Vercel auto-deploys
```

**Time:** 5-10 minutes

---

### Option 3: Emergency Freeze (Keep Site Up, Block Money Ops)

**Set in Vercel env vars:**
```
EMERGENCY_FREEZE=true
```

**Redeploy:** `vercel --prod`

**Effect:**
- Withdrawals return 503 "Temporarily disabled for maintenance"
- Settlements return 503
- Deposits still work (users can add funds)
- Matches can be created but not settled

**Use when:** Bug in settlement/withdrawal logic but site otherwise functional

---

## MONITORING

### Sentry (Error Tracking)

**Setup:**
```bash
npm install @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

**Add to `sentry.client.config.js`:**
```javascript
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.VERCEL_ENV,
  tracesSampleRate: 0.1,
})
```

---

### Daily Reconciliation Queries

Run these DAILY via cron or manually:

**1. Locked balance drift:**
```sql
-- See step 5.4 above
-- Expected: drift = 0
```

**2. Negative balances:**
```sql
SELECT id, username, balance, locked_balance
FROM profiles
WHERE balance < 0 OR locked_balance < 0;

-- Expected: 0 rows
```

**3. Settled matches missing tx:**
```sql
SELECT id, player_a_id, player_b_id, entry_fee_sol, created_at
FROM matches
WHERE status = 'settled' AND settlement_tx IS NULL;

-- Expected: 0 rows
```

**4. Duplicate settlements:**
```sql
SELECT match_id, event_type, COUNT(*)
FROM audit_log
WHERE event_type IN ('settlement_winner','settlement_loser')
GROUP BY match_id, event_type HAVING COUNT(*) > 1;

-- Expected: 0 rows
```

---

## INCIDENT RESPONSE

### Scenario 1: User Reports Missing Deposit

**Steps:**
1. Get tx signature from user
2. Query Supabase:
   ```sql
   SELECT * FROM transactions WHERE tx_signature = '<sig>';
   ```
3. If not found:
   - Check Helius dashboard (webhook delivery logs)
   - Manually trigger deposit: `POST /api/webhook/deposit` with webhook payload
4. Verify balance updated
5. Notify user

---

### Scenario 2: Settlement Failed, Funds Stuck

**Steps:**
1. Get match ID from user
2. Query match status:
   ```sql
   SELECT * FROM matches WHERE id = '<match-id>';
   ```
3. Check `error_message` column
4. If `settlement_failed`:
   - Run retry worker: `POST /api/admin/settlement-retry`
   - Monitor audit_log for result
5. If retry fails after 3 attempts:
   - Manual intervention required
   - Verify on-chain: Check loser's wallet tx history
   - If payment sent: Reconcile DB manually
   - If payment NOT sent: Manually execute `sendSol()` + `settle_match_db()`

---

### Scenario 3: Double-Payment Detected

**🚨 EMERGENCY:**
1. Set `EMERGENCY_FREEZE=true` (blocks new settlements)
2. Query audit_log:
   ```sql
   SELECT * FROM audit_log
   WHERE event_type = 'settlement_winner'
     AND match_id = '<match-id>';
   ```
3. Check on-chain: Did two payments occur?
4. If yes:
   - Contact winner, request return of overpayment
   - If user refuses, flag account, ban if needed
   - Document for legal/compliance
5. Fix bug in code
6. Re-test on staging
7. Deploy fix
8. Clear `EMERGENCY_FREEZE`

---

## POST-LAUNCH CHECKLIST

**Day 1:**
- [ ] Monitor Vercel logs (every 4 hours)
- [ ] Run reconciliation queries (morning + evening)
- [ ] Check Sentry for errors
- [ ] Respond to user support tickets within 2 hours

**Week 1:**
- [ ] Daily reconciliation
- [ ] Review all settlements manually
- [ ] Check for anomalies (large withdrawals, velocity limit hits)

**Week 2-4:**
- [ ] Reconciliation every 2 days
- [ ] Monitor Sentry weekly
- [ ] Plan for beta expansion (increase limits)

---

**END OF RUNBOOK**

Keep this document updated as you deploy fixes and discover edge cases.
