# Vercel Environment Variables Setup

**CRITICAL:** Do NOT store secrets in `.env.local` or commit them to Git.
All secrets must be configured in Vercel Dashboard → Settings → Environment Variables.

## Required Environment Variables

### 1. Supabase

| Variable | Value | Environment |
|----------|-------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://abzurjxkxxtahdjrpvxk.supabase.co` | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGci...` (your anon key) | Production, Preview, Development |
| `SUPABASE_SERVICE_KEY` | `eyJhbGci...` (your service role key) | Production, Preview, Development |

**Security:**
- `NEXT_PUBLIC_*` vars are public (bundled in client)
- `SUPABASE_SERVICE_KEY` is server-only (never exposed to client)
- To rotate service key: Contact Supabase support (not self-service)

---

### 2. Helius (Solana RPC + Webhooks)

| Variable | Value | Environment |
|----------|-------|-------------|
| `HELIUS_API_KEY` | `940fb72c-...` (your API key) | Production, Preview, Development |
| `HELIUS_WEBHOOK_SECRET` | `3e976336...` (from Helius dashboard) | Production only |
| `HELIUS_WEBHOOK_ID` | `6887c6c4-...` (webhook ID) | Production only |

**Security:**
- Use **separate API keys** for dev/staging/prod
- Rotate `HELIUS_WEBHOOK_SECRET` after any suspected leak
- Regenerate in Helius dashboard → Webhooks → your webhook → Signing Secret

**IP Restriction (Recommended):**
- Helius dashboard → API Keys → your key → IP Allowlist
- Add Vercel production IPs: `76.76.21.0/24`, `76.76.22.0/24`

---

### 3. Wallet Encryption

| Variable | Value | Environment |
|----------|-------|-------------|
| `WALLET_ENCRYPTION_SECRET` | 64-char hex (32 bytes) | Production, Preview, Development |

**Generate:**
```bash
openssl rand -hex 32
```

**Security:**
- This is the **master key** for all user wallets
- If leaked, **ALL user funds are at risk**
- Rotate quarterly (requires re-encryption migration)
- **DO NOT** use the same key across environments
- Store backup in 1Password/Bitwarden (NOT in Git)

**Key Rotation Process:**
1. Generate new key: `openssl rand -hex 32`
2. Run migration: `OLD_WALLET_KEY=<old> NEW_WALLET_KEY=<new> npm run migrate:re-encrypt`
3. Update Vercel env var with new key
4. Deploy
5. Verify: `SELECT * FROM get_key_version_summary();` (all should be v2)

---

### 4. Admin & Cron

| Variable | Value | Environment |
|----------|-------|-------------|
| `ADMIN_SECRET` | 64-char hex (32 bytes) | Production, Preview, Development |
| `CRON_SECRET` | 64-char hex (32 bytes) | ⚠️ **DEPRECATED** (see below) |

**Generate:**
```bash
openssl rand -hex 32
```

**CRON_SECRET Migration:**
- Old: Header-based auth (`x-cron-secret: <secret>`)
- New: Vercel native (`x-vercel-cron: 1` header set automatically)
- **Action:** Remove `CRON_SECRET` after migrating cron endpoints to use `x-vercel-cron`

---

### 5. Application

| Variable | Value | Environment |
|----------|-------|-------------|
| `NEXT_PUBLIC_APP_URL` | `https://arena151.xyz` | Production |
|  | `https://<preview-url>.vercel.app` | Preview |
|  | `http://localhost:3002` | Development |

**Usage:**
- Webhook callbacks (Helius sends to `${APP_URL}/api/webhook/deposit`)
- OAuth redirects (Twitter auth)
- Email confirmation links

---

### 6. Twitter OAuth (Optional)

| Variable | Value | Environment |
|----------|-------|-------------|
| `X_CLIENT_ID` | `Vk41b1F3d05IUX...` | Production, Preview, Development |
| `X_CLIENT_SECRET` | `v2WMQy4vSbhx...` | Production, Preview, Development |
| `X_CONSUMER_KEY` | `h3p8sfcUKC0a...` | Production, Preview, Development |
| `X_CONSUMER_SECRET` | `OlyssmogyMxW...` | Production, Preview, Development |
| `X_REDIRECT_URI` | `${NEXT_PUBLIC_APP_URL}/api/x/callback` | Production, Preview, Development |

---

## Setup Steps

### Step 1: Vercel Dashboard

1. Go to https://vercel.com/dashboard
2. Select your Arena 151 project
3. Settings → Environment Variables
4. Add each variable:
   - Name: `WALLET_ENCRYPTION_SECRET`
   - Value: `<your-64-char-hex>`
   - Environments: ✅ Production, ✅ Preview, ✅ Development
5. Click "Save"

### Step 2: Local Development

**DO NOT** add secrets to `.env.local` anymore.

Pull secrets from Vercel for local development:

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Link project
vercel link

# Pull environment variables
vercel env pull .env.local

# Start dev server
npm run dev
```

This creates `.env.local` with production secrets. **DO NOT COMMIT THIS FILE.**

### Step 3: Verify Configuration

```bash
# Start app — should see validation success
npm run dev

# Expected output:
# ✅ Environment configuration validated
# ▲ Next.js 15.1.6
# ...
```

If validation fails, you'll see specific errors:
```
❌ Configuration Validation Failed
====================================
  - WALLET_ENCRYPTION_SECRET is required (64-char hex, set in Vercel env vars)
  - ADMIN_SECRET is required (set in Vercel env vars)
```

---

## Deployment

### First Deploy (After Secret Rotation)

```bash
# 1. Ensure all secrets are in Vercel dashboard
# 2. Deploy
vercel --prod

# 3. Verify env vars are loaded
vercel env ls --environment production

# 4. Test API health
curl https://arena151.xyz/api/health

# Expected response:
# {
#   "status": "ok",
#   "secrets": {
#     "SUPABASE_SERVICE_KEY": true,
#     "WALLET_ENCRYPTION_SECRET": true,
#     "HELIUS_API_KEY": true,
#     "ADMIN_SECRET": true
#   }
# }
```

---

## Security Checklist

- [ ] All secrets stored in Vercel env vars (NOT in `.env.local`)
- [ ] `.env.local` is in `.gitignore`
- [ ] Git history audited for leaked secrets (`git log -- ".env*"`)
- [ ] Separate Helius API keys for dev/staging/prod
- [ ] `WALLET_ENCRYPTION_SECRET` is unique per environment
- [ ] Backup of secrets stored in password manager (1Password, Bitwarden)
- [ ] Vercel account has 2FA enabled
- [ ] Supabase project has 2FA enabled

---

## Emergency Secret Rotation

If any secret is compromised:

1. **Immediate:** Rotate the secret in Vercel env vars
2. **If `WALLET_ENCRYPTION_SECRET`:** Run re-encryption migration
3. **If `HELIUS_WEBHOOK_SECRET`:** Update in Helius dashboard
4. **If `SUPABASE_SERVICE_KEY`:** Contact Supabase support
5. **Deploy immediately:** `vercel --prod`
6. **Audit logs:** Check for unauthorized access during leak window

---

## Questions?

- Vercel env vars docs: https://vercel.com/docs/concepts/projects/environment-variables
- Helius webhook docs: https://docs.helius.dev/webhooks-and-websockets/webhooks
- Supabase secrets: https://supabase.com/docs/guides/platform/environment-variables
