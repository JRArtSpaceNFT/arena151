# X OAuth Implementation - Quick Start

## 🎯 What I Built

Complete OAuth 1.0a "Connect X Account" feature with:
- ✅ Real X OAuth flow (user must authorize on X)
- ✅ Server-side state management (database, not cookies)
- ✅ Security validation (session checks, uniqueness, expiry)
- ✅ Cannot fake X username - must be verified through OAuth
- ✅ Comprehensive logging for debugging

---

## ⚡ Quick Start (3 Steps)

### Step 1: Apply Database Migration (2 minutes)

1. Go to: https://supabase.com/dashboard/project/abzurjxkxxtahdjrpvxk/sql/new
2. Copy contents of: `supabase/migrations/013_x_oauth_1_0a.sql`
3. Paste into SQL Editor
4. Click "Run"
5. Should see: Success ✅

**Verify it worked:**
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('x_oauth_attempts', 'x_connection_audit');
-- Should return 2 rows
```

---

### Step 2: Get X API Credentials (5 minutes)

**You already have credentials in `.env.local`:**
```
X_CLIENT_ID="OWRlWE1GZ3c2cGJYTERwV2U1bG86MTpjaQ"
X_CLIENT_SECRET="hjKuKemW7NEI45sYxFNRLRe17uLwy1y57FOTvjifaCoOPA2-zg"
```

**BUT - these look like OAuth 2.0 credentials.**

**Check if they work for OAuth 1.0a:**
1. Go to: https://developer.x.com/en/portal/projects-and-apps
2. Find your "Arena 151" app
3. Go to: Keys and Tokens tab
4. Look for: **API Key & Secret** (not Client ID)

**If you see API Key & Secret:**
- Copy them
- Update `.env.local`:
  ```bash
  X_CONSUMER_KEY=your_api_key_here
  X_CONSUMER_SECRET=your_api_secret_here
  ```

**If you only see Client ID & Secret:**
- Your app might be OAuth 2.0 only
- You may need to create a new app with OAuth 1.0a enabled
- See: `X_OAUTH_SETUP_GUIDE.md` for full walkthrough

**Callback URL (CRITICAL - must match exactly):**
- In X app settings: `http://localhost:3002/api/x/callback`
- In `.env.local`: Already set ✅

---

### Step 3: Test the Flow (2 minutes)

Dev server is already running on `http://localhost:3002`

**Full test:**
1. Open: http://localhost:3002
2. Log in (or create account)
3. Go to your profile
4. Click "Connect X Account" (blue button)
5. Should redirect to X authorization page
6. Click "Authorize app"
7. Should redirect back to Arena 151
8. Profile should show your X username + avatar

**Check server logs:**
Should see:
```
[CONNECT_X_START] OAuth 1.0a flow initiated
[CONNECT_X_REQUEST_TOKEN_SUCCESS] Got request token
[CONNECT_X_CALLBACK_HIT] OAuth callback received
[CONNECT_X_IDENTITY_SUCCESS] Verified user: @yourhandle
[CONNECT_X_DONE] Full flow completed
```

---

## 🐛 If Something Breaks

### Error: "Session expired - please refresh"
**Fix:**
```bash
# Check Supabase service role key is set
grep SUPABASE_SERVICE_ROLE_KEY .env.local
# Should show a long JWT token
```

### Error: "Failed to get request token: 401"
**Fix:** X credentials are wrong or callback URL doesn't match
- Check X Developer Portal app settings
- Verify API Key & Secret in `.env.local`
- Callback URL must be EXACT: `http://localhost:3002/api/x/callback`

### Error: "OAuth session expired or invalid"
**Fix:** Database migration didn't run
- Go to Supabase SQL Editor
- Run migration again
- Verify `x_oauth_attempts` table exists

### Nothing happens / no redirect to X
**Fix:** Check browser console for errors
- Open DevTools → Console
- Click "Connect X Account"
- Look for error message
- Check Network tab for failed requests

---

## 📚 Full Documentation

- **`X_OAUTH_SETUP_GUIDE.md`** - Complete setup walkthrough
- **`TEST_X_OAUTH.md`** - Comprehensive test procedures
- **`X_OAUTH_IMPLEMENTATION_SUMMARY.md`** - Technical details

---

## ✅ Success Criteria

**It's working when:**
1. ✅ Click "Connect X Account"
2. ✅ Redirects to X authorization page
3. ✅ Click "Authorize app"
4. ✅ Redirects back to Arena 151
5. ✅ Profile shows YOUR ACTUAL X username (from OAuth)
6. ✅ Refresh page → X account still connected
7. ✅ Server logs show complete flow

**It's NOT working if:**
- ❌ Shows "Session expired"
- ❌ Stays on profile page (no redirect)
- ❌ Redirects to Pokemon main page
- ❌ Shows generic error
- ❌ X username disappears on refresh

---

## 🔧 What I Changed

**New files created:** 10 files (~60 KB of code)
- `lib/x-oauth-1-0a.ts` - OAuth signing & API calls
- `lib/x-oauth-db.ts` - Database state management
- `app/api/x/connect/route.ts` - Start OAuth flow
- `app/api/x/callback/route.ts` - Handle callback (completely rewritten)
- `app/api/x/unlink/route.ts` - Disconnect flow
- `supabase/migrations/013_x_oauth_1_0a.sql` - Database schema
- 4 documentation files (this one + 3 guides)

**Existing files modified:**
- `.env.local` - Added `SUPABASE_SERVICE_ROLE_KEY`, updated callback URLs for localhost

**What makes this different from before:**
- ✅ OAuth 1.0a (standard developer access)
- ✅ Database state (survives redirects)
- ✅ Server-side secrets (nothing in browser)
- ✅ Comprehensive validation (security first)
- ✅ Detailed logging (easy debugging)
- ✅ Proper error handling (no generic errors)

---

## 🚀 Next: Deploy to Production

Once localhost works:

1. **Push to GitHub:**
   ```bash
   git add .
   git commit -m "feat: complete X OAuth 1.0a implementation"
   git push
   ```

2. **Vercel auto-deploys** ✅

3. **Set Vercel env vars:**
   - Dashboard → Settings → Environment Variables
   - Add production values:
     ```
     X_CONSUMER_KEY=<production key>
     X_CONSUMER_SECRET=<production secret>
     X_CALLBACK_URL=https://arena151.xyz/api/x/callback
     APP_BASE_URL=https://arena151.xyz
     SUPABASE_SERVICE_ROLE_KEY=<same as local>
     ```

4. **Update X app callback URL:**
   - X Developer Portal → App Settings
   - Add: `https://arena151.xyz/api/x/callback`

5. **Test on production:**
   - Go to: https://arena151.xyz
   - Full OAuth flow
   - Check it works

---

**Need help?** Check the detailed guides or look at server logs - everything is logged.

**Ready to test?** Run through Step 3 above ☝️
