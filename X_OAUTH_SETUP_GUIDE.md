# X (Twitter) OAuth 1.0a Setup Guide

Complete step-by-step guide to enable "Connect X Account" on Arena 151.

---

## 🎯 What This Does

Allows Arena 151 users to:
- ✅ **Verify** their X (Twitter) account through official OAuth
- ✅ **Link** their verified X username to their Arena 151 profile
- ✅ **Display** their X handle and avatar on their profile
- ❌ **NOT** manually type a fake X username

**Security:** Uses OAuth 1.0a — the user must actually authorize Arena 151 through X's official flow.

---

## 📋 Prerequisites

1. **X Developer Account** (free)
   - Go to https://developer.x.com/
   - Apply for developer access (usually instant approval)

2. **Supabase Service Role Key**
   - Arena 151 Dashboard → Supabase → Settings → API
   - Copy the **service_role** key (NOT the anon key)

---

## 🔧 Step 1: Create X App

### 1.1 Go to X Developer Portal
https://developer.x.com/en/portal/projects-and-apps

### 1.2 Create New App
- Click "Create Project" or "Create App"
- Name: `Arena 151` (or whatever you want)
- Use case: "Making a bot" or "Exploring the API"

### 1.3 Configure App Settings
Go to your app's settings → **User authentication settings**

**App permissions:**
- ✅ Read (minimum required)
- ⬜ Write (optional)
- ⬜ Direct Messages (optional)

**Type of App:**
- ✅ Web App

**App info:**
- **Callback URL / Redirect URL:**
  - Local dev: `http://localhost:3002/api/x/callback`
  - Production: `https://arena151.xyz/api/x/callback`
  - ⚠️ **MUST match EXACTLY** what you put in `.env.local`

- **Website URL:**
  - Production: `https://arena151.xyz`
  - Local dev: `http://localhost:3002`

**Save** and you'll get:
- ✅ API Key (Consumer Key)
- ✅ API Secret (Consumer Secret)

**⚠️ COPY THESE NOW** - the secret is only shown once!

---

## 🔐 Step 2: Configure Environment Variables

### 2.1 Edit `.env.local`

```bash
# X OAuth 1.0a Credentials
X_CONSUMER_KEY=your_api_key_from_x_here
X_CONSUMER_SECRET=your_api_secret_from_x_here

# Callback URL (must match X app settings EXACTLY)
X_CALLBACK_URL=http://localhost:3002/api/x/callback

# App base URL
APP_BASE_URL=http://localhost:3002

# Supabase service role key (from Supabase dashboard)
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

### 2.2 For Production Deployment

Update Vercel environment variables:
```bash
X_CONSUMER_KEY=your_production_api_key
X_CONSUMER_SECRET=your_production_api_secret
X_CALLBACK_URL=https://arena151.xyz/api/x/callback
APP_BASE_URL=https://arena151.xyz
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

---

## 🗄️ Step 3: Run Database Migration

### 3.1 Apply Migration to Supabase

**Option A: Supabase Dashboard (Recommended)**
1. Go to Supabase Dashboard → SQL Editor
2. Click "New Query"
3. Copy contents of `supabase/migrations/013_x_oauth_1_0a.sql`
4. Paste and click "Run"

**Option B: Supabase CLI**
```bash
cd arena151
supabase db push
```

### 3.2 Verify Tables Created

Check that these tables exist:
- ✅ `x_oauth_attempts` (pending OAuth flows)
- ✅ `x_connection_audit` (audit log)

Check that `profiles` table has new columns:
- ✅ `x_user_id` (X account ID - unique)
- ✅ `x_username` (X handle)
- ✅ `x_name` (X display name)
- ✅ `x_profile_image_url` (X avatar)
- ✅ `x_verified_at` (timestamp)

---

## 🚀 Step 4: Test the Flow

### 4.1 Start Dev Server
```bash
npm run dev
```

### 4.2 Test OAuth Flow

1. **Log in to Arena 151**
   - Go to http://localhost:3002
   - Create account or log in

2. **Open Profile Page**
   - Navigate to your trainer profile
   - You should see an "X Connection Card"

3. **Click "Connect X Account"**
   - Should redirect to X authorization page
   - ⚠️ If you get "Session expired" → check `SUPABASE_SERVICE_ROLE_KEY`

4. **Authorize on X**
   - Click "Authorize app" on X
   - Should redirect back to Arena 151

5. **Verify Success**
   - Profile should now show your X username
   - Avatar should display your X profile picture
   - Green "✓ Verified" badge should appear

### 4.3 Check Server Logs

You should see detailed logs like:
```
[CONNECT_X_START] OAuth 1.0a flow initiated
[CONNECT_X_AUTH_OK] User authenticated: user-uuid
[CONNECT_X_REQUEST_TOKEN_SUCCESS] Got request token: abc123...
[CONNECT_X_DB_STORED] Attempt saved to database: attempt-uuid
[CONNECT_X_REDIRECT_TO_X] Authorization URL: https://api.x.com/oauth/authenticate?oauth_token=...
[CONNECT_X_CALLBACK_HIT] OAuth callback received
[CONNECT_X_TOKEN_MATCH_OK] Token ownership verified
[CONNECT_X_ACCESS_TOKEN_SUCCESS] Got access token
[CONNECT_X_IDENTITY_SUCCESS] Verified user: @username
[CONNECT_X_DB_LINK_SUCCESS] X account linked to profile
[CONNECT_X_DONE] Full flow completed in 1234 ms
```

---

## 🐛 Troubleshooting

### "Session expired - please refresh and try again"
**Cause:** `getCurrentUserId()` can't read Supabase session cookie

**Fix:**
1. Check `SUPABASE_SERVICE_ROLE_KEY` is set correctly
2. Verify `lib/auth-server.ts` uses `cookies()` from `next/headers`
3. Check Supabase auth is working (can you log in?)

### "X OAuth not configured on server"
**Cause:** Missing environment variables

**Fix:**
1. Check `.env.local` has all required vars
2. Restart dev server (`npm run dev`)
3. Verify no typos in variable names

### "OAuth session expired or invalid"
**Cause:** OAuth attempt record expired or not found in DB

**Fix:**
1. Check migration ran successfully
2. Verify `x_oauth_attempts` table exists
3. Check system time is correct (affects expiry checks)
4. Try the flow again (10 minute expiry)

### "X account already linked to another profile"
**Cause:** That X account is already connected to a different Arena 151 user

**Fix:**
1. Log in to the other Arena 151 account
2. Unlink the X account
3. Try again from the correct account

### "Failed to get request token: 401"
**Cause:** Invalid X credentials or callback URL mismatch

**Fix:**
1. Verify `X_CONSUMER_KEY` and `X_CONSUMER_SECRET` are correct
2. Check callback URL in X app settings matches `.env.local` EXACTLY
3. Check app is set to "Web App" mode in X portal
4. Regenerate X API keys if needed

### Callback hits but nothing happens
**Cause:** Redirect URL mismatch or DB write failure

**Fix:**
1. Check browser network tab for error responses
2. Look at server logs for database errors
3. Verify `SUPABASE_SERVICE_ROLE_KEY` has write permissions
4. Check `profiles` table has X account columns

---

## 📊 Monitoring & Logs

### View OAuth Audit Log

```sql
-- Recent connection attempts (Supabase SQL Editor)
SELECT 
  created_at,
  action,
  x_username,
  error_code,
  error_message
FROM x_connection_audit
WHERE user_id = 'your-user-id'
ORDER BY created_at DESC
LIMIT 20;
```

### View Pending OAuth Attempts

```sql
-- Active OAuth flows
SELECT 
  id,
  user_id,
  status,
  created_at,
  expires_at
FROM x_oauth_attempts
WHERE status = 'pending'
ORDER BY created_at DESC;
```

### Clean Up Expired Attempts

```sql
-- Manually expire old attempts
SELECT expire_old_x_oauth_attempts();
```

---

## 🔒 Security Checklist

- ✅ Never expose `X_CONSUMER_SECRET` to client-side code
- ✅ Never expose `SUPABASE_SERVICE_ROLE_KEY` to client
- ✅ All OAuth signing happens server-side only
- ✅ Request token secrets stored in DB, not cookies
- ✅ Callback verifies user session + token ownership
- ✅ Unique constraint prevents one X account → multiple Arena 151 profiles
- ✅ Audit log tracks all connection attempts
- ✅ OAuth attempts expire after 10 minutes
- ✅ No plaintext tokens in logs (only first 10 chars shown)

---

## 🧪 Test Checklist

Before marking as "working":

- [ ] User can initiate OAuth flow from profile page
- [ ] X authorization page appears with correct app name
- [ ] User can authorize and redirect back successfully
- [ ] Profile shows correct X username and avatar
- [ ] Refresh page still shows connected X account
- [ ] Cannot manually type fake X handle
- [ ] Cannot link same X account to multiple Arena 151 users
- [ ] Can disconnect X account successfully
- [ ] Can reconnect same X account
- [ ] Can connect different X account
- [ ] Expired OAuth attempt shows proper error
- [ ] Server logs show all expected events
- [ ] No secrets leaked in browser console or network tab
- [ ] Works in production (Vercel)

---

## 📝 File Manifest

**New files created:**
- ✅ `lib/x-oauth-1-0a.ts` - OAuth 1.0a utilities
- ✅ `lib/x-oauth-db.ts` - Database helpers
- ✅ `app/api/x/connect/route.ts` - Start OAuth flow
- ✅ `app/api/x/callback/route.ts` - Handle callback
- ✅ `app/api/x/unlink/route.ts` - Disconnect X account
- ✅ `supabase/migrations/013_x_oauth_1_0a.sql` - Database schema
- ✅ `.env.x-oauth.example` - Environment variable template
- ✅ `X_OAUTH_SETUP_GUIDE.md` - This file

**Files modified:**
- 🔄 `components/XConnectionCard.tsx` - Profile UI component
- 🔄 `.env.local` - Add X OAuth credentials

---

## 🎓 How OAuth 1.0a Works

**Step 1: Get Request Token**
```
Client → Arena 151 Server → X API
X returns: request_token + request_token_secret
Arena 151 stores both in database
```

**Step 2: User Authorization**
```
Client redirects to: https://api.x.com/oauth/authenticate?oauth_token=XXX
User clicks "Authorize app" on X
X redirects back to: https://arena151.xyz/api/x/callback?oauth_token=XXX&oauth_verifier=YYY
```

**Step 3: Exchange for Access Token**
```
Arena 151 Server loads request_token_secret from DB
Arena 151 Server → X API with verifier
X returns: access_token + access_token_secret + user_id + screen_name
```

**Step 4: Get User Details**
```
Arena 151 Server → X API /1.1/account/verify_credentials.json
X returns: full user profile (id, username, name, avatar)
Arena 151 saves to profiles table
```

**Done!** User is now connected.

---

## ✅ Success Criteria

The feature is **working** when:
1. User clicks "Connect X Account"
2. Redirects to X authorization page
3. User authorizes Arena 151
4. Redirects back to Arena 151
5. Profile shows **verified X username from OAuth**, not manual input
6. Refresh page → X account still connected
7. Server logs show complete flow end-to-end
8. No "session expired" errors
9. X username cannot be faked or manually entered

---

**Need help?** Check server logs first — every step is logged with `[CONNECT_X_...]` prefix.
