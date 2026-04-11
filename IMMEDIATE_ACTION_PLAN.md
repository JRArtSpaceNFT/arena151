# 🔴 IMMEDIATE ACTION PLAN — BEFORE REAL MONEY

**Platform:** Arena 151  
**Date:** April 11, 2026  
**Status:** ❌ NOT SAFE FOR REAL MONEY (blockers exist)

---

## ⚠️ CRITICAL BLOCKERS

These **MUST** be fixed before launching with real user funds:

### **BLOCKER 1: Secret Exposure (C6, C7, C8)**
**Risk:** Master wallet key + DB admin key in `.env.local`  
**Impact:** If leaked, ALL user wallets + DB compromised  
**Time:** 4 hours

**Actions:**
1. Run: `cd arena151 && bash scripts/rotate-secrets.sh`
2. Copy new secrets to 1Password/Bitwarden
3. Add to Vercel: Dashboard → Settings → Environment Variables
4. Run DB migration: `npm run db:migrate` (applies 014_wallet_key_versioning.sql, 015_withdrawal_security.sql)
5. Run: `OLD_WALLET_KEY=<old> NEW_WALLET_KEY=<new> npm run migrate:re-encrypt`
6. Delete local `.env.local`: `rm .env.local`
7. Deploy: `vercel --prod`
8. Test: `curl https://arena151.xyz/api/health` → all secrets should show `true`

**Verification:**
- [ ] `.env.local` deleted
- [ ] Git history clean: `git log -- ".env*"` → no results
- [ ] All profiles re-encrypted: `SELECT * FROM get_key_version_summary();` → all v2
- [ ] Production deployment works without local `.env.local`

---

### **BLOCKER 2: First-Withdrawal Delay (H8)**
**Risk:** Account compromise → instant drain  
**Impact:** User funds stolen within seconds  
**Time:** 30 minutes

**Actions:**
1. Apply migration: `015_withdrawal_security.sql` (adds `first_withdrawal_at` column)
2. Replace `/app/api/withdraw/route.ts` with hardened version (already done)
3. Deploy: `vercel --prod`

**Verification:**
- [ ] New account, try withdraw immediately → 403 "requires 24h account age"
- [ ] Wait 24h → withdrawal succeeds
- [ ] `first_withdrawal_at` timestamp recorded

---

### **BLOCKER 3: Settlement Retry Double-Payment (H2)**
**Risk:** Winner gets paid twice if retry logic fails  
**Impact:** Platform loses 2× match pot  
**Time:** 2 hours

**Actions:**
1. Add file: `lib/settlement-verification.ts` (already created)
2. Apply patch: Follow `SETTLEMENT_RETRY_PATCH.md`
3. Deploy: `vercel --prod`

**Verification:**
- [ ] Manually mark settled match as `settlement_failed` (keep settlement_tx)
- [ ] Run retry worker: `curl -X POST https://arena151.xyz/api/admin/settlement-retry -H "x-admin-token: <your-secret>"`
- [ ] Check audit_log: should see `settlement_recovered_onchain` (NOT `settlement_retry_succeeded`)
- [ ] Verify no duplicate payment on-chain

---

## 🟡 HIGH PRIORITY (Fix Before Beta)

### **Cron Secret Migration (H4)**
**Time:** 30 minutes

**Actions:**
1. Update `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/settlement-health",
      "schedule": "*/5 * * * *"
    }
  ]
}
```
2. Update `/app/api/cron/settlement-health/route.ts`:
```typescript
const isVercelCron = req.headers.get('x-vercel-cron') === '1'
if (!isVercelCron) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
```
3. Remove `CRON_SECRET` from Vercel env vars
4. Deploy

---

### **Rate Limiting (H6)**
**Time:** 1 hour

**Actions:**
1. Install Vercel KV (Redis): `vercel integration add kv`
2. Add rate limit middleware (see implementation guide below)
3. Apply to: `/api/match/create`, `/api/withdraw`, `/api/settle`

---

## 📋 EXECUTION CHECKLIST

**Day 1:**
- [ ] Generate new secrets (rotate-secrets.sh)
- [ ] Add secrets to Vercel env vars
- [ ] Run DB migrations (014, 015)
- [ ] Re-encrypt wallets
- [ ] Delete `.env.local`

**Day 2:**
- [ ] Deploy hardened withdrawal endpoint
- [ ] Apply settlement retry patch
- [ ] Test first-withdrawal delay
- [ ] Test settlement retry verification

**Day 3:**
- [ ] Migrate cron auth to x-vercel-cron
- [ ] Add rate limiting
- [ ] Full regression test suite
- [ ] Manual QA (happy path + edge cases)

**Day 4:**
- [ ] Run **LAUNCH_GATE_CHECKLIST.md**
- [ ] All items PASS? → Soft launch (beta, low limits)
- [ ] Any FAIL? → Fix and re-test

---

## 🚀 SOFT LAUNCH LIMITS (First 30 Days)

Until all fixes are battle-tested:

- **Max deposit:** 0.1 SOL (~$15)
- **Max wager:** 0.01 SOL per match
- **Total TVL cap:** $10,000
- **Invite-only:** 100-500 users
- **Daily reconciliation:** Manual review of all locks/settlements
- **24h support:** Discord + Telegram for fast response

**Monitoring:**
- Sentry for error tracking
- Daily balance reconciliation queries
- Alert on: negative balance, locked > balance, settlement failures

**Kill Switch:**
Set `EMERGENCY_FREEZE=true` in Vercel env vars → blocks all withdrawals + settlements

---

## 📞 SUPPORT CONTACTS

- **Vercel Support:** https://vercel.com/support
- **Supabase Support:** https://supabase.com/dashboard/support
- **Helius Support:** https://discord.gg/helius (Discord #support)

---

## ❌ DO NOT LAUNCH IF

- [ ] Secrets still in `.env.local`
- [ ] Git history contains committed secrets
- [ ] First-withdrawal delay not working
- [ ] Settlement retry lacks on-chain verification
- [ ] Any LAUNCH_GATE_CHECKLIST item is FAIL or NOT VERIFIED

---

**NEXT STEP:** Start with BLOCKER 1 (secret rotation). This is the highest risk.

Run: `cd arena151 && bash scripts/rotate-secrets.sh`
