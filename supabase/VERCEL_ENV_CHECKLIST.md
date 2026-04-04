# Arena 151 — Vercel Environment Variables Checklist

All environment variables must be set in:
**Vercel Dashboard → your project → Settings → Environment Variables**

Set them for **Production**, **Preview**, and **Development** environments as appropriate.

After setting all variables, verify everything is working by calling:
```
https://arena151.xyz/api/health
```
It returns `{ ok: true }` when all critical env vars are present and Supabase is reachable.

---

## Required Variables

### Supabase

| Variable | Where to get it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Settings → API → **Project URL** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard → Settings → API → **anon / public** key |
| `SUPABASE_SERVICE_KEY` | Supabase Dashboard → Settings → API → **service_role** key |

**What they do:**
- `NEXT_PUBLIC_SUPABASE_URL` — The base URL of your Supabase project. Used by both client and server.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Safe-to-expose public key for browser-side Supabase calls (respects RLS).
- `SUPABASE_SERVICE_KEY` — **Secret.** Bypasses RLS. Used only on the server for admin operations (wallet creation, settlement, deposit processing). **Never expose to the browser.**

---

### Helius (Solana RPC + Webhooks)

| Variable | Where to get it |
|---|---|
| `HELIUS_API_KEY` | [dev.helius.xyz](https://dev.helius.xyz) → API Keys |
| `HELIUS_WEBHOOK_SECRET` | The `?secret=` value you put in your webhook URL |

**What they do:**
- `HELIUS_API_KEY` — Used to make Solana RPC calls (send transactions, check balances) via Helius.
- `HELIUS_WEBHOOK_SECRET` — Validates incoming Helius webhook calls. Must match the `?secret=` query param in your webhook URL. **Make this a long random string (32+ chars).**

**How to generate `HELIUS_WEBHOOK_SECRET`:**
```bash
openssl rand -hex 32
# or
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

### App Config

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_APP_URL` | `https://arena151.xyz` |

**What it does:** Used for constructing absolute URLs in server-side code and emails.

---

### Security Secrets

| Variable | What it does | How to generate |
|---|---|---|
| `ENCRYPTION_SECRET` | 32-char AES-256 key for encrypting custodial wallet private keys at rest | `openssl rand -hex 16` (gives 32 hex chars) |
| `ADMIN_SECRET` | Token required for `/api/admin/*` endpoints (settlement retry, dispute resolution) | `openssl rand -hex 32` |
| `CRON_SECRET` | Token required for `/api/cron/*` endpoints (settlement health check) | `openssl rand -hex 32` |

> ⚠️ **CRITICAL: Never change `ENCRYPTION_SECRET` after users have registered.**
> It's used to encrypt wallet private keys. Changing it makes all existing wallets unrecoverable.
> Store this in a password manager and back it up.

**How to generate all secrets at once:**
```bash
echo "ENCRYPTION_SECRET=$(openssl rand -hex 16)"
echo "ADMIN_SECRET=$(openssl rand -hex 32)"
echo "CRON_SECRET=$(openssl rand -hex 32)"
echo "HELIUS_WEBHOOK_SECRET=$(openssl rand -hex 32)"
```

---

## Complete Variable Reference

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_KEY=eyJ...
HELIUS_API_KEY=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
HELIUS_WEBHOOK_SECRET=<long random string>
NEXT_PUBLIC_APP_URL=https://arena151.xyz
ENCRYPTION_SECRET=<32 hex chars>
ADMIN_SECRET=<64 hex chars>
CRON_SECRET=<64 hex chars>
```

---

## How to Verify All Env Vars Are Set

After deploying to Vercel, call the health endpoint:
```bash
curl https://arena151.xyz/api/health
```

Expected response when everything is set:
```json
{
  "ok": true,
  "checks": {
    "env": {
      "NEXT_PUBLIC_SUPABASE_URL": true,
      "SUPABASE_SERVICE_KEY": true,
      "HELIUS_WEBHOOK_SECRET": true,
      "ENCRYPTION_SECRET": true,
      "ADMIN_SECRET": true
    },
    "supabase": true
  },
  "timestamp": "2026-04-03T..."
}
```

If `ok` is `false`, check which `checks` entry is `false` and set the missing variable.

---

## Cron Secret in vercel.json

The `CRON_SECRET` also needs to be referenced in `vercel.json` if you protect the cron endpoint.
Your cron endpoint at `/api/cron/settlement-health` should validate:
```
Authorization: Bearer <CRON_SECRET>
```
Vercel automatically sends `CRON_SECRET` as the bearer token for cron invocations when it's set as an env var.
