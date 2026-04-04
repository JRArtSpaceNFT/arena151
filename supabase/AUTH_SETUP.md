# Arena 151 — Supabase Auth & Dashboard Setup

These settings **must be configured manually** in the Supabase dashboard.
They cannot be set via SQL or environment variables.

---

## 1. Turn Off Email Confirmation

> **Why:** The register API uses the admin client to auto-confirm new accounts.
> If email confirmation is still enabled in the dashboard, users will get stuck waiting for a confirmation email that's never expected.

**Steps:**
1. Go to [Supabase Dashboard](https://supabase.com/dashboard) → your project
2. Left sidebar → **Authentication** → **Settings**
3. Under **"Email Auth"** section:
   - Toggle **"Enable email confirmations"** → **OFF**
4. Click **Save**

---

## 2. Set Site URL and Redirect URLs

> **Why:** Supabase requires a known site URL for auth redirects. Without this,
> OAuth flows and magic link redirects will fail or be blocked.

**Steps:**
1. Go to **Authentication** → **URL Configuration**
2. Set **"Site URL"** to:
   ```
   https://arena151.xyz
   ```
3. Under **"Redirect URLs"**, click **Add URL** and add:
   ```
   https://arena151.xyz/**
   ```
4. Add another redirect URL for local development:
   ```
   http://localhost:3002/**
   ```
5. Click **Save**

---

## 3. Verify RLS Is Enabled on All Tables

> **Why:** Row Level Security (RLS) ensures users can only read their own data.
> If RLS is disabled, any authenticated user could read all records.

**Steps:**
1. Go to **Table Editor** in the left sidebar
2. Check each of these tables and confirm **"RLS enabled"** is shown:
   - `profiles`
   - `transactions`
   - `matches`
   - `audit_log`

If RLS shows as disabled on any table, run this in SQL Editor:
```sql
ALTER TABLE public.profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log   ENABLE ROW LEVEL SECURITY;
```

---

## 4. Set Up Helius Webhook (Deposit Detection)

> **Why:** Helius monitors your treasury wallet and calls your API when SOL is received,
> so deposits are credited automatically.

**Steps:**
1. Go to [https://dev.helius.xyz](https://dev.helius.xyz) → **Webhooks**
2. Click **"Create new webhook"**
3. Set:
   - **Webhook URL:**
     ```
     https://arena151.xyz/api/webhook/deposit?secret=YOUR_HELIUS_WEBHOOK_SECRET
     ```
     Replace `YOUR_HELIUS_WEBHOOK_SECRET` with the value you set as `HELIUS_WEBHOOK_SECRET` in Vercel.
   - **Transaction types:** `TRANSFER`
   - **Account addresses:** Add your treasury wallet's Solana address
4. Click **Save**
5. Test by sending a small SOL amount to the treasury wallet and watching Supabase `transactions` table for a new deposit record

> **Security note:** The `?secret=` query param is validated server-side. Before scaling,
> upgrade to Helius Pro for HMAC-SHA256 signed webhooks (see BETA_OPS.md §5).

---

## 5. (Optional) Check Auth Users

To verify your register API is working correctly:
1. Go to **Authentication** → **Users**
2. New registrations should appear here with **"Email confirmed"** status

If users appear as unconfirmed, double-check Step 1 above.
