# Arena 151 Production Launch Gate

**Date:** _____________________  
**Auditor:** ___________________  
**Environment:** Production  
**Database:** `abzurjxkxxtahdjrpvxk.supabase.co`

---

## INSTRUCTIONS

- Only mark **PASS** if you have verified the test AND seen evidence
- Mark **FAIL** if the test fails
- Mark **NOT VERIFIED** if you haven't tested yet
- **LAUNCH IS BLOCKED** if any item is marked FAIL or NOT VERIFIED

---

## 1. DEPOSITS CANNOT CREDIT TWICE

| Test | Status | Evidence | Notes |
|------|--------|----------|-------|
| **1.1** Webhook replay (same payload sent twice) → only first credits balance | [ ] PASS  [ ] FAIL  [ ] NOT VERIFIED | Screenshot / Log snippet: | |
| **1.2** Multi-recipient Solana tx (2 users, 1 tx sig) → both credited once | [ ] PASS  [ ] FAIL  [ ] NOT VERIFIED | Screenshot / Log snippet: | |
| **1.3** Query: `SELECT tx_signature, to_address, COUNT(*) FROM transactions WHERE type='deposit' GROUP BY tx_signature, to_address HAVING COUNT(*) > 1;` returns 0 rows | [ ] PASS  [ ] FAIL  [ ] NOT VERIFIED | Query result: | |
| **1.4** Helius webhook with invalid HMAC → 401 Unauthorized | [ ] PASS  [ ] FAIL  [ ] NOT VERIFIED | Screenshot / Log snippet: | |

**BLOCKER:** [ ] YES  [ ] NO

---

## 2. WITHDRAWALS CANNOT PAY TWICE

| Test | Status | Evidence | Notes |
|------|--------|----------|-------|
| **2.1** Concurrent withdrawal requests (spam 10 clicks) → only first succeeds, rest 400 | [ ] PASS  [ ] FAIL  [ ] NOT VERIFIED | Screenshot / Log snippet: | |
| **2.2** sendSol failure → balance rolled back via relative increment (not snapshot overwrite) | [ ] PASS  [ ] FAIL  [ ] NOT VERIFIED | audit_log shows rollback_method='relative_increment' | |
| **2.3** Withdraw during active match → 400 "Cannot withdraw while match is in progress" | [ ] PASS  [ ] FAIL  [ ] NOT VERIFIED | Screenshot / Log snippet: | |
| **2.4** Withdraw > available balance (balance - locked) → 400 "Insufficient available balance" | [ ] PASS  [ ] FAIL  [ ] NOT VERIFIED | Screenshot / Log snippet: | |
| **2.5** First withdrawal on new account (<24h) → 403 "First withdrawal requires 24h account age" | [ ] PASS  [ ] FAIL  [ ] NOT VERIFIED | Screenshot / Log snippet: | |
| **2.6** 4th withdrawal in 24h → 429 "Maximum 3 withdrawals per 24 hours" | [ ] PASS  [ ] FAIL  [ ] NOT VERIFIED | Screenshot / Log snippet: | |

**BLOCKER:** [ ] YES  [ ] NO

---

## 3. MATCHES CANNOT SETTLE TWICE

| Test | Status | Evidence | Notes |
|------|--------|----------|-------|
| **3.1** Concurrent settlement API calls (2 requests, same matchId) → one gets 'settling' mutex, other 409 Conflict | [ ] PASS  [ ] FAIL  [ ] NOT VERIFIED | Screenshot / Log snippet: | |
| **3.2** `settle_match_db()` called twice → second returns `{success: false, reason: 'already_settled'}` | [ ] PASS  [ ] FAIL  [ ] NOT VERIFIED | RPC test result: | |
| **3.3** Query: `SELECT match_id, event_type, COUNT(*) FROM audit_log WHERE event_type IN ('settlement_winner','settlement_loser') GROUP BY match_id, event_type HAVING COUNT(*) > 1;` returns 0 rows | [ ] PASS  [ ] FAIL  [ ] NOT VERIFIED | Query result: | |
| **3.4** Loser wallet underfunded (on-chain balance < required) → settlement_failed with pre-flight error | [ ] PASS  [ ] FAIL  [ ] NOT VERIFIED | Screenshot / Log snippet: | |

**BLOCKER:** [ ] YES  [ ] NO

---

## 4. LOCKED FUNDS ALWAYS RECONCILE

| Test | Status | Evidence | Notes |
|------|--------|----------|-------|
| **4.1** Query reconciliation (locked balance drift): `WITH active AS (SELECT COALESCE(SUM(entry_fee_sol), 0) * 2 AS expected_locked FROM matches WHERE status IN ('forming','ready','funds_locked','battling','result_pending','settlement_pending','settling')) SELECT (SELECT COALESCE(SUM(locked_balance),0) FROM profiles) AS actual_locked, active.expected_locked, (SELECT COALESCE(SUM(locked_balance),0) FROM profiles) - active.expected_locked AS drift FROM active;` → **drift = 0** | [ ] PASS  [ ] FAIL  [ ] NOT VERIFIED | Query result: drift = _____ | |
| **4.2** Query: `SELECT COUNT(*) FROM profiles WHERE locked_balance > balance;` returns 0 | [ ] PASS  [ ] FAIL  [ ] NOT VERIFIED | Query result: count = _____ | |
| **4.3** Match abandonment (ready → voided) → both players' funds unlocked | [ ] PASS  [ ] FAIL  [ ] NOT VERIFIED | Audit log confirms unlock | |
| **4.4** Battle timeout (battling >15min) → manual_review + both funds unlocked | [ ] PASS  [ ] FAIL  [ ] NOT VERIFIED | Cron log + audit_log | |

**BLOCKER:** [ ] YES  [ ] NO

---

## 5. ON-CHAIN EVENTS RECONCILE TO INTERNAL LEDGER

| Test | Status | Evidence | Notes |
|------|--------|----------|-------|
| **5.1** Settled match has settlement_tx signature stored: `SELECT COUNT(*) FROM matches WHERE status='settled' AND settlement_tx IS NULL;` returns 0 | [ ] PASS  [ ] FAIL  [ ] NOT VERIFIED | Query result: count = _____ | |
| **5.2** Every confirmed withdrawal has tx_signature: `SELECT COUNT(*) FROM transactions WHERE type='withdrawal' AND status='confirmed' AND tx_signature IS NULL;` returns 0 | [ ] PASS  [ ] FAIL  [ ] NOT VERIFIED | Query result: count = _____ | |
| **5.3** House fee reconciliation query detects missing fees: (run manual query from SETTLEMENT_RETRY_PATCH.md) → acceptable missing fee count | [ ] PASS  [ ] FAIL  [ ] NOT VERIFIED | Missing fees: _____ SOL | |
| **5.4** Settlement retry worker detects on-chain payment (Helius + RPC sources) → reconciles DB without re-sending | [ ] PASS  [ ] FAIL  [ ] NOT VERIFIED | Screenshot / Log snippet: | |

**BLOCKER:** [ ] YES  [ ] NO

---

## 6. SECRETS ARE NO LONGER DANGEROUSLY EXPOSED

| Test | Status | Evidence | Notes |
|------|--------|----------|-------|
| **6.1** Git history audit: `git log --all --full-history -- ".env*"` returns 0 results | [ ] PASS  [ ] FAIL  [ ] NOT VERIFIED | Command output: | |
| **6.2** `.env.local` does NOT exist in production deployment (Vercel only) | [ ] PASS  [ ] FAIL  [ ] NOT VERIFIED | `ls -la .env.local` → file not found | |
| **6.3** All secrets stored in Vercel env vars (dashboard → Settings → Environment Variables) | [ ] PASS  [ ] FAIL  [ ] NOT VERIFIED | Screenshot of Vercel dashboard | |
| **6.4** `WALLET_ENCRYPTION_SECRET`, `HELIUS_API_KEY`, `ADMIN_SECRET` all different from dev/staging | [ ] PASS  [ ] FAIL  [ ] NOT VERIFIED | Verified via: _____ | |
| **6.5** Startup validation succeeds: `curl https://arena151.xyz/api/health` returns `{"status":"ok","secrets":{...all true}}` | [ ] PASS  [ ] FAIL  [ ] NOT VERIFIED | API response: | |

**BLOCKER:** [ ] YES  [ ] NO

---

## 7. WALLET ENCRYPTION IS STRONG ENOUGH

| Test | Status | Evidence | Notes |
|------|--------|----------|-------|
| **7.1** `WALLET_ENCRYPTION_SECRET` is 64-char hex (32 bytes) | [ ] PASS  [ ] FAIL  [ ] NOT VERIFIED | Length verified: _____ | |
| **7.2** Key versioning migration complete: `SELECT * FROM get_key_version_summary();` → all profiles show key_version=2 | [ ] PASS  [ ] FAIL  [ ] NOT VERIFIED | Query result: | |
| **7.3** Test wallet decryption with new key → succeeds | [ ] PASS  [ ] FAIL  [ ] NOT VERIFIED | Test user: _____ | |
| **7.4** Old `WALLET_ENCRYPTION_SECRET` (v1) has been rotated and deleted | [ ] PASS  [ ] FAIL  [ ] NOT VERIFIED | Confirmed by: _____ | |

**BLOCKER:** [ ] YES  [ ] NO

---

## 8. ADMIN ROUTES ARE HARDENED

| Test | Status | Evidence | Notes |
|------|--------|----------|-------|
| **8.1** `/api/admin/settlement-retry` without `x-admin-token` → 401 | [ ] PASS  [ ] FAIL  [ ] NOT VERIFIED | Screenshot / Log snippet: | |
| **8.2** `/api/admin/settlement-retry` with wrong token → 401 (timing-safe comparison) | [ ] PASS  [ ] FAIL  [ ] NOT VERIFIED | Screenshot / Log snippet: | |
| **8.3** `/api/cron/settlement-health` without `x-vercel-cron` header → 401 | [ ] PASS  [ ] FAIL  [ ] NOT VERIFIED | Screenshot / Log snippet: | |
| **8.4** Admin actions logged to audit_log with actor, timestamp, reason | [ ] PASS  [ ] FAIL  [ ] NOT VERIFIED | Sample audit_log entry: | |

**BLOCKER:** [ ] YES  [ ] NO

---

## 9. RETRY LOGIC IS BOUNDED AND IDEMPOTENT

| Test | Status | Evidence | Notes |
|------|--------|----------|-------|
| **9.1** Settlement retry max 3 attempts → after 3 failures, match flagged `MANUAL_INTERVENTION_REQUIRED` | [ ] PASS  [ ] FAIL  [ ] NOT VERIFIED | Screenshot / Log snippet: | |
| **9.2** Settlement retry on-chain verification uses multi-source (Helius + RPC) | [ ] PASS  [ ] FAIL  [ ] NOT VERIFIED | Code review confirmed: _____ | |
| **9.3** If verification fails (all sources down), retry is SKIPPED (fail-safe) | [ ] PASS  [ ] FAIL  [ ] NOT VERIFIED | Screenshot / Log snippet: | |
| **9.4** Cron jobs run at correct intervals: settlement-health every 5min, fee-reconciliation daily | [ ] PASS  [ ] FAIL  [ ] NOT VERIFIED | vercel.json confirmed: _____ | |

**BLOCKER:** [ ] YES  [ ] NO

---

## 10. HIGH RISK WITHDRAWALS CAN BE HELD OR REVIEWED

| Test | Status | Evidence | Notes |
|------|--------|----------|-------|
| **10.1** First withdrawal requires 24h account age | [ ] PASS  [ ] FAIL  [ ] NOT VERIFIED | Tested with account age: _____ | |
| **10.2** Session fingerprint mismatch (IP or UA changed) → logged to audit_log as alert | [ ] PASS  [ ] FAIL  [ ] NOT VERIFIED | Screenshot / Log snippet: | |
| **10.3** Withdrawal velocity limit (3 per 24h) enforced | [ ] PASS  [ ] FAIL  [ ] NOT VERIFIED | Screenshot / Log snippet: | |
| **10.4** Email confirmation flow for first withdrawal (optional, if implemented) | [ ] PASS  [ ] FAIL  [ ] NOT VERIFIED [ ] NOT APPLICABLE | Screenshot / Log snippet: | |

**BLOCKER:** [ ] YES  [ ] NO

---

## FINAL GATE

**All sections marked PASS?** [ ] YES  [ ] NO

**Any FAIL or NOT VERIFIED?** [ ] YES  [ ] NO

**Ready for production launch with real money?** [ ] YES  [ ] NO

---

## SIGN-OFF

| Role | Name | Signature | Date |
|------|------|-----------|------|
| **Lead Engineer** | | | |
| **Security Auditor** | | | |
| **Product Owner** | | | |

---

## NOTES / EXCEPTIONS

(Document any exceptions, known issues, or items to fix post-launch)

_____________________________________________________________

_____________________________________________________________

_____________________________________________________________

---

**END OF CHECKLIST**

If all items are **PASS**, proceed to production deployment.

If any item is **FAIL** or **NOT VERIFIED**, **DO NOT LAUNCH**.
