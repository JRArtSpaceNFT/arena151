# Supabase Setup for Arena 151

## One-Time Database Setup (2 minutes)

1. Go to: https://supabase.com/dashboard/project/abzurjxkxxtahdjrpvxk
2. Click **SQL Editor** in the left sidebar
3. Click **New Query**
4. Copy and paste the contents of `supabase/schema.sql`
5. Click **Run** (or press Cmd+Enter)

That's it! The `profiles` table will be created and linked to Supabase Auth.

---

## What This Enables

- **Real accounts** — email/password auth via Supabase, works across all devices
- **Persistent sessions** — JWT tokens, users stay logged in
- **Profiles table** — username, avatar, wins/losses, balance, badges stored in Postgres
- **Leaderboard** — reads from real database, not localStorage

---

## Auth Flow

- **Sign up**: Creates Supabase Auth user + inserts into `profiles` table
- **Login**: Supabase Auth validates email/password, fetches profile
- **Session**: Supabase manages JWT tokens automatically (localStorage via supabase-js)
- **Logout**: Signs out from Supabase Auth

---

## Notes

- The `.env.local` already has all required keys (SUPABASE_URL, ANON_KEY, SERVICE_KEY)
- Email confirmation is OFF by default in new Supabase projects — users can log in immediately after signup
- If email confirmation is ON, users will need to verify their email before logging in
  - To disable: Supabase Dashboard → Authentication → Settings → uncheck "Enable email confirmations"

---

## Leaderboard

The leaderboard now reads from Supabase. An unauthenticated user can see it but won't have profile data shown. The leaderboard API route at `/api/leaderboard` uses the service key to fetch all profiles.
