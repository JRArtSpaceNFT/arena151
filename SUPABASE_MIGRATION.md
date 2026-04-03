# Supabase Migration — Solana Wallets

## What This Does

Adds Solana custodial wallet columns (`sol_address`, `encrypted_private_key`) to the `profiles` table  
and creates a `transactions` table for tracking deposits, withdrawals, wins, losses, and fees.

## Steps

1. Go to **Supabase Dashboard** → your project → **SQL Editor**
2. Click **New Query**
3. Paste the contents of `supabase/migrations/001_wallets.sql`
4. Click **Run**

You should see "Success" — no rows affected is expected (ALTER TABLE on existing table).

## After Migration

1. **Register the Helius webhook** (one-time setup):
   ```bash
   node scripts/register-helius-webhook.mjs
   ```
   Copy the `webhookId` from the output.

2. **Add `HELIUS_WEBHOOK_ID` to environment variables:**
   - `.env.local` → `HELIUS_WEBHOOK_ID=<your-id>`
   - Vercel → Settings → Environment Variables → add `HELIUS_WEBHOOK_ID=<your-id>`

3. **Add `NEXT_PUBLIC_APP_URL` to Vercel** if not already set:
   - `NEXT_PUBLIC_APP_URL=https://jonathan-foley-og6b.vercel.app`

4. **Redeploy** on Vercel after adding env vars.

## How It Works

- **New user signs up** → `generateUserWallet()` creates a real Solana keypair server-side
- Their `sol_address` (public key) is stored in `profiles` and shown as their deposit address
- Their `encrypted_private_key` (base58 private key) is stored in `profiles` — keep this secret
- **User deposits SOL** → sends to their `sol_address` → Helius detects it → calls `/api/webhook/deposit` → balance credited
- **User withdraws** → `/api/withdraw` sends from their custodial wallet → net amount to them, 0.5% fee to treasury

## Security Note

The private keys are currently stored as base58 in plain text. For production hardening,  
encrypt them with AES-256 using an `ENCRYPTION_SECRET` env var. This is a known TODO.
