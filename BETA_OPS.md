# Arena 151 — Beta Operations Runbook

## 1. Manually Trigger Settlement Retry

The settlement retry cron runs **every 5 minutes** (`*/5 * * * *`) on Vercel Pro.

> **Note on Vercel plan:** Vercel Pro supports cron frequencies up to every minute.
> Vercel Hobby only supports **daily** crons. If you're on the Hobby plan and the cron
> isn't firing frequently, manually trigger settlement retry using the command below,
> or upgrade to Vercel Pro for automatic frequent retries.

For manual triggers during beta:

```bash
curl -X POST https://arena151.xyz/api/admin/settlement-retry \
  -H "x-admin-token: $ADMIN_SECRET"
```

Set `ADMIN_SECRET` to the value of your `ADMIN_SECRET` environment variable (in Vercel dashboard → Settings → Environment Variables).

---

## 2. Check for `manual_review` Matches in Supabase

In the Supabase dashboard → Table Editor → `matches`, filter by:

```
status = 'manual_review'
```

Or via SQL:

```sql
SELECT id, player_a_id, player_b_id, entry_fee_sol, result_claim_a, result_claim_b, error_message, updated_at
FROM matches
WHERE status = 'manual_review'
ORDER BY updated_at DESC;
```

These are matches where P1 and P2 submitted conflicting results. They require manual admin review before settlement.

---

## 3. Check for `settlement_failed` Matches

```sql
SELECT id, player_a_id, player_b_id, entry_fee_sol, winner_id, error_message, retry_count, updated_at
FROM matches
WHERE status = 'settlement_failed'
ORDER BY updated_at DESC;
```

These are matches where the on-chain settlement transaction failed after multiple retries. Trigger the settlement retry endpoint (see §1) to attempt again, or resolve manually.

---

## 4. Approve / Reject Disputed Matches

For `manual_review` matches, an admin can approve or reject via:

```bash
# Approve (specify the correct winner)
curl -X POST https://arena151.xyz/api/admin/match/<MATCH_ID>/review \
  -H "x-admin-token: $ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"decision": "approve", "winnerId": "<WINNER_USER_ID>"}'

# Reject (refund both players)
curl -X POST https://arena151.xyz/api/admin/match/<MATCH_ID>/review \
  -H "x-admin-token: $ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"decision": "reject"}'
```

Replace `<MATCH_ID>` with the UUID from the matches table and `<WINNER_USER_ID>` with the Supabase user ID of the correct winner.

---

## 5. Helius Webhook Security Note

⚠️ **Before scaling to production, upgrade Helius webhook authentication.**

Currently, the Helius webhook secret is passed as a `?secret=` query parameter in the webhook URL (e.g. `https://arena151.xyz/api/webhook/helius?secret=YOUR_SECRET`). This is validated server-side but:

- The secret is visible in server logs and Helius dashboard as a plain URL query param
- This is acceptable for beta with low transaction volume

**Before scale:**
- Upgrade to **Helius Pro** plan which supports **HMAC-SHA256 request signing**
- Replace the `?secret=` query param check with HMAC signature verification on the `x-helius-signature` header
- Rotate the current webhook secret after migrating

---

## Quick Reference

| Issue | Action |
|-------|--------|
| Settlement stuck | POST `/api/admin/settlement-retry` |
| Conflicting results | Check `manual_review`, POST `/api/admin/match/:id/review` |
| Repeated failures | Check `settlement_failed`, check Solana RPC health |
| Funds stuck locked | Check `audit_log` for `wager_locked` without matching `settlement_complete` |
