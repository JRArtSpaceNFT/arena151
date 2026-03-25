# Arena 151 — Backend Setup Guide

Everything listed here is what you need to configure to make Arena 151 fully production-ready.

---

## Current Status (Frontend-Only)

Right now Arena 151 runs **entirely in the browser** using `localStorage`. This means:

✅ Accounts persist across page refreshes on the **same device/browser**
✅ Login, signup, and password reset logic is all wired and ready
✅ Win/loss records and balances save correctly
❌ Accounts are NOT shared across devices
❌ If a user clears their browser storage, they lose their account
❌ Password reset emails don't actually send (they log to the browser console)
❌ Profile picture uploads stay in memory, not permanently stored

Everything is architected to **swap the backend in** cleanly. The functions in `lib/auth.ts` are the only thing that needs to change.

---

## What You Need to Set Up

### 1. Database (store users)

**Recommended: [Supabase](https://supabase.com)** (free tier, Postgres, built-in auth)

**What to store:**
```sql
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,           -- bcrypt
  username      TEXT UNIQUE NOT NULL,
  display_name  TEXT NOT NULL,
  bio           TEXT DEFAULT '',
  avatar_url    TEXT,
  favorite_pokemon_id    INTEGER,
  favorite_pokemon_name  TEXT,
  favorite_pokemon_types TEXT[],
  wallet_id     TEXT UNIQUE NOT NULL,
  balance       NUMERIC DEFAULT 0,
  wins          INTEGER DEFAULT 0,
  losses        INTEGER DEFAULT 0,
  joined_date   TIMESTAMPTZ DEFAULT now(),
  reset_token   TEXT,
  reset_token_expiry TIMESTAMPTZ
);
```

**Alternative options:** PlanetScale (MySQL), Neon (Postgres), Firebase Firestore

---

### 2. Authentication

**Option A: Supabase Auth (easiest)**
- Handles email/password login, password reset, and session management out of the box
- Swap `registerUser()` and `loginUser()` in `lib/auth.ts` to call `supabase.auth.signUp()` and `supabase.auth.signInWithPassword()`
- Sessions are handled via JWT tokens — no localStorage needed

**Option B: NextAuth.js**
- Add to the Next.js app
- Use email/password provider with your database

**Option C: Custom (if you want full control)**
- Use `bcrypt` on the server to hash passwords
- Use `jsonwebtoken` (JWT) for session tokens
- Store tokens in httpOnly cookies

---

### 3. Email Service (password reset)

**For password reset emails, choose one:**

| Provider | Free Tier | Notes |
|----------|-----------|-------|
| [Resend](https://resend.com) | 3,000/month | Easiest to set up, great DX |
| [SendGrid](https://sendgrid.com) | 100/day | Widely used |
| [Postmark](https://postmarkapp.com) | 100/month | High deliverability |

**Template for reset email:**
```
Subject: Reset your Arena 151 password

Hi Trainer,

Someone requested a password reset for your Arena 151 account.
Click the link below within 1 hour:

https://arena151.gg/reset-password?token={TOKEN}

If you didn't request this, ignore this email.

— Professor Oak & the Arena 151 team
```

**Environment variable needed:**
```env
EMAIL_SERVICE_API_KEY=your_key_here
EMAIL_FROM=noreply@arena151.gg
NEXT_PUBLIC_APP_URL=https://arena151.gg
```

---

### 4. File Storage (profile picture uploads)

**Currently:** Profile pictures are stored as base64 data URIs in localStorage. This won't scale.

**Recommended: [Cloudinary](https://cloudinary.com)** (free tier, image optimization)

Other options: Supabase Storage, AWS S3, Vercel Blob

**What to configure:**
```env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

**Upload endpoint to create:**
```
POST /api/upload-avatar
- Accepts: multipart/form-data with image file
- Validates: file type (jpg/png/webp), max 5MB
- Uploads to Cloudinary
- Returns: { url: string }
- Stores url in user record
```

---

### 5. Solana Wallet Integration

**For real SOL deposits:**
- Each user needs a real Solana wallet address
- Options:
  - **Custodial (simplest):** Generate a Solana keypair per user server-side; you hold the keys
  - **Non-custodial:** User connects their own wallet (Phantom, Solflare) via `@solana/wallet-adapter`

**Monitor deposits:**
- Use `@solana/web3.js` to poll user wallet address for incoming transactions
- Or use a webhook service like [Helius](https://helius.xyz) to get notified on deposits instantly

**Payout on win:**
- Deduct entry fees and pay winner from your fee pool wallet
- Transaction signing happens server-side (never expose private keys client-side)

---

### 6. Environment Variables Needed

Create a `.env.local` file in the arena151 directory:

```env
# Database
DATABASE_URL=postgresql://user:password@host/arena151

# Auth
NEXTAUTH_SECRET=your_random_secret_here
NEXTAUTH_URL=http://localhost:3002

# If using Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_KEY=your_service_key

# Email
RESEND_API_KEY=re_xxxx
EMAIL_FROM=noreply@arena151.gg

# File storage
CLOUDINARY_CLOUD_NAME=your_cloud
CLOUDINARY_API_KEY=your_key
CLOUDINARY_API_SECRET=your_secret

# Solana
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
ARENA_WALLET_PRIVATE_KEY=your_treasury_wallet_key

# App
NEXT_PUBLIC_APP_URL=https://arena151.gg
```

---

### 7. Hosting

**Recommended: [Vercel](https://vercel.com)**
- Free tier available
- Automatic Next.js optimization
- Easy environment variable management
- Deploy in 2 minutes from GitHub

**Domain:** Register `arena151.gg` (or similar) via Namecheap, Google Domains, etc.

---

## Quick Start Path (Cheapest/Fastest)

If you want to go live quickly with minimal cost:

1. **Supabase** — Database + Auth + Storage (free tier covers ~50k users)
2. **Resend** — Email (free tier: 3,000/month)
3. **Cloudinary** — Image storage (free tier: 25GB)
4. **Vercel** — Hosting (free tier for side projects)

**Estimated monthly cost at launch:** $0 (all free tiers)
**When you scale:** ~$25-50/month

---

## How to Swap In the Backend

When you're ready, update `lib/auth.ts`:

```typescript
// Replace the localStorage functions with API calls:

export async function registerUser(data) {
  const response = await fetch('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return response.json();
}

export async function loginUser(email, password) {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  return response.json();
}
```

The rest of the app stays exactly the same — the auth layer is isolated.

---

## Summary Checklist

| What | Service | Status |
|------|---------|--------|
| Database | Supabase / Postgres | ⏳ Needs setup |
| Auth | Supabase Auth / NextAuth | ⏳ Needs setup |
| Email | Resend / SendGrid | ⏳ Needs setup |
| File storage | Cloudinary / Supabase Storage | ⏳ Needs setup |
| Solana wallet | @solana/web3.js + Helius | ⏳ Needs setup |
| Hosting | Vercel | ⏳ Needs setup |
| Domain | Any registrar | ⏳ Needs setup |
| Username moderation | ✅ Implemented (lib/moderation.ts) | Done |
| Password reset logic | ✅ Wired, needs email service | Done |
| Profile persistence | ✅ localStorage (swap to DB) | Done |
| Profile pic upload | ✅ Base64 preview (swap to Cloudinary) | Done |
| Account sessions | ✅ localStorage (swap to JWT/cookies) | Done |

---

## Short Answer for "What Do I Need?"

> A database (Supabase is easiest), an email service (Resend), and image storage (Cloudinary). Once those are connected, everything else is already built.

---

*This file lives at `BACKEND_SETUP.md` in the arena151 directory for reference.*
