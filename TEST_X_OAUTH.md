# X OAuth 1.0a Implementation Test Plan

## 🔍 Current Implementation Status

### ✅ Files Created
1. `lib/x-oauth-1-0a.ts` - OAuth 1.0a signing & API calls
2. `lib/x-oauth-db.ts` - Database state management
3. `app/api/x/connect/route.ts` - Start OAuth flow
4. `app/api/x/callback/route.ts` - Handle callback
5. `app/api/x/unlink/route.ts` - Disconnect X account
6. `supabase/migrations/013_x_oauth_1_0a.sql` - Database schema
7. `.env.x-oauth.example` - Environment variable template
8. `X_OAUTH_SETUP_GUIDE.md` - Complete setup guide

### 📋 Prerequisites Checklist

Before testing, verify:

- [ ] Database migration applied (see `APPLY_X_MIGRATION.md`)
- [ ] `.env.local` has all required variables:
  - [ ] `X_CONSUMER_KEY` or `X_CLIENT_ID`
  - [ ] `X_CONSUMER_SECRET` or `X_CLIENT_SECRET`
  - [ ] `X_CALLBACK_URL` (http://localhost:3002/api/x/callback)
  - [ ] `APP_BASE_URL` (http://localhost:3002)
  - [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Dev server running (`npm run dev`)
- [ ] Logged into Arena 151 as a test user

---

## 🧪 Test Procedure

### Test 1: Environment Check

```bash
# Check all required env vars are set
cd arena151
node -e "
const required = [
  'X_CONSUMER_KEY', 'X_CLIENT_ID',
  'X_CONSUMER_SECRET', 'X_CLIENT_SECRET', 
  'X_CALLBACK_URL', 'X_REDIRECT_URI',
  'APP_BASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY'
];
const env = require('dotenv').config().parsed;
required.forEach(key => {
  const val = process.env[key] || env?.[key];
  console.log(key + ':', val ? '✅ SET' : '❌ MISSING');
});
"
```

**Expected:** All should show ✅ SET

---

### Test 2: Database Schema Check

Go to Supabase SQL Editor and run:

```sql
-- Check x_oauth_attempts table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_name = 'x_oauth_attempts'
);
-- Expected: true

-- Check x_connection_audit table exists  
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_name = 'x_connection_audit'
);
-- Expected: true

-- Check profiles has X columns
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name LIKE 'x_%'
ORDER BY column_name;
-- Expected: 8 rows (x_user_id, x_username, x_name, etc.)
```

**Expected:** All queries return expected results

---

### Test 3: API Endpoint Check

```bash
# Test connect endpoint (should require auth)
curl -v http://localhost:3002/api/x/connect 2>&1 | grep -E "HTTP|error|authUrl"

# Expected: 
# - HTTP 401 if not logged in
# - OR authUrl if logged in
```

---

### Test 4: Manual OAuth Flow

**CRITICAL:** This is the real test. Follow exactly:

#### 4.1 Start Flow
1. Open browser: http://localhost:3002
2. Log in to Arena 151 (or create account)
3. Navigate to your profile page
4. Look for "X Connection Card" component

**Expected:** Card shows "Connect X Account" button (blue, 3D style)

#### 4.2 Click Connect
1. Click "Connect X Account" button
2. Watch browser DevTools → Network tab
3. Should see:
   - Request to `/api/x/connect`
   - Response with `authUrl`
   - Browser redirects to `api.x.com/oauth/authenticate?oauth_token=...`

**Expected:** Redirects to X authorization page

**If stuck on "Session expired":**
- Check server logs for `[CONNECT_X_ERROR]`
- Verify `SUPABASE_SERVICE_ROLE_KEY` is correct
- Check `lib/auth-server.ts` getCurrentUserId() works

#### 4.3 Authorize on X
1. You should see X authorization page
2. Shows "Authorize Arena 151 to access your account?"
3. Click "Authorize app"

**Expected:** X redirects back to localhost

**If X shows error:**
- Check callback URL in X app settings matches `.env.local`
- Verify X API credentials are valid
- Check X app has "Web App" type selected

#### 4.4 Callback Processing
1. Browser redirects to: `http://localhost:3002/api/x/callback?oauth_token=XXX&oauth_verifier=YYY`
2. Watch server logs (terminal running `npm run dev`)
3. Should see detailed logs:

```
[CONNECT_X_CALLBACK_HIT] OAuth callback received
[CONNECT_X_AUTH_OK] Current user: <uuid>
[CONNECT_X_DB_LOOKUP] Loading attempt by token...
[CONNECT_X_DB_FOUND] Attempt ID: <uuid>
[CONNECT_X_TOKEN_MATCH_OK] Token ownership verified
[CONNECT_X_TOKEN_EXCHANGE] Exchanging for access token...
[CONNECT_X_ACCESS_TOKEN_SUCCESS] Got access token
[CONNECT_X_IDENTITY] Fetching user details...
[CONNECT_X_IDENTITY_SUCCESS] Verified user: @username
[CONNECT_X_UNIQUENESS] Checking if X account already linked...
[CONNECT_X_UNIQUENESS_OK] X account not linked elsewhere
[CONNECT_X_DB_LINK] Linking X account to profile...
[CONNECT_X_DB_LINK_SUCCESS] X account linked to profile
[CONNECT_X_DB_COMPLETE] Attempt marked as completed
[CONNECT_X_DONE] Full flow completed in XXX ms
```

**Expected:** All steps complete successfully

#### 4.5 Verify Connection
1. Browser redirects to: `http://localhost:3002/?x_success=true`
2. Profile page now shows:
   - ✅ Your X avatar
   - ✅ Your X display name
   - ✅ Your @username
   - ✅ Green "Verified" badge
   - ✅ "Connected <date>" timestamp
   - ✅ "Disconnect" button

**Expected:** Profile shows YOUR actual X account from OAuth

**Verify it's NOT fake:**
- Refresh page → X account still there
- Check Supabase `profiles` table → `x_user_id` field populated
- Try to manually edit username → should not be possible

---

### Test 5: Security Checks

#### 5.1 Uniqueness Constraint
1. Log out from Arena 151
2. Create a NEW Arena 151 account (different email)
3. Try to connect the SAME X account
4. Should see error: "This X account is already linked to another Arena 151 profile"

**Expected:** Cannot link same X account to multiple users

#### 5.2 Expiry Check
1. Start OAuth flow (click Connect)
2. Get redirected to X
3. **WAIT 11 MINUTES** (don't authorize yet)
4. Now click "Authorize" on X
5. Should redirect back with error: "OAuth session expired"

**Expected:** Expired attempts are rejected

#### 5.3 Token Security
1. Open browser DevTools → Network tab
2. Start OAuth flow
3. Check all network requests
4. Look for `X_CONSUMER_SECRET`, `request_token_secret`, or `access_token`

**Expected:** ZERO secrets visible in browser (all server-side only)

---

### Test 6: Disconnect Flow

1. On profile page, click "Disconnect" button
2. Confirm disconnect
3. Profile should revert to "Connect X Account" button
4. Check Supabase `profiles` table → `x_user_id` should be NULL

**Expected:** Can disconnect successfully

---

### Test 7: Reconnect Flow

1. Click "Connect X Account" again
2. Authorize on X
3. Should link the same X account again

**Expected:** Can reconnect same account

---

### Test 8: Change Account Flow

1. Connect X account A
2. Click "Change Account" button
3. Authorize with X account B (different account)
4. Profile should update to show account B

**Expected:** Can switch to different X account

---

## 🐛 Common Issues & Fixes

### Issue: "Session expired - please refresh"
**Cause:** `getCurrentUserId()` can't read Supabase session

**Debug:**
```bash
# Check if auth is working at all
curl -X POST http://localhost:3002/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test123456","username":"testuser"}'

# Should return user data
```

**Fix:**
- Verify `SUPABASE_SERVICE_ROLE_KEY` is correct
- Check `lib/auth-server.ts` uses `cookies()` from `next/headers`
- Restart dev server

### Issue: "Failed to get request token: 401"
**Cause:** Invalid X credentials or callback URL mismatch

**Debug:**
```bash
# Check X credentials format
echo $X_CONSUMER_KEY
echo $X_CONSUMER_SECRET

# Should be non-empty strings
```

**Fix:**
- Go to X Developer Portal → Your App → Keys and tokens
- Regenerate API Key & Secret
- Update `.env.local`
- Verify callback URL matches EXACTLY

### Issue: "OAuth session expired or invalid"
**Cause:** Database attempt record not found or expired

**Debug:**
```sql
-- Check if attempts are being created
SELECT * FROM x_oauth_attempts 
ORDER BY created_at DESC 
LIMIT 5;

-- Check for errors
SELECT * FROM x_connection_audit 
WHERE action = 'connect_failed'
ORDER BY created_at DESC 
LIMIT 5;
```

**Fix:**
- Verify migration ran successfully
- Check `SUPABASE_SERVICE_ROLE_KEY` has write permissions
- Complete flow within 10 minutes

### Issue: Callback hits but no logs appear
**Cause:** Code not deployed or server not restarted

**Fix:**
```bash
# Kill dev server
pkill -f "next dev"

# Restart
npm run dev
```

---

## ✅ Success Criteria

The implementation is **WORKING** when ALL of these pass:

- [ ] User can click "Connect X Account"
- [ ] Redirects to X authorization page
- [ ] X shows correct app name
- [ ] User can authorize
- [ ] Redirects back to Arena 151
- [ ] Profile shows ACTUAL X username (not manual input)
- [ ] Profile shows ACTUAL X avatar
- [ ] Refresh page → X account still connected
- [ ] Server logs show complete flow end-to-end
- [ ] Cannot connect same X account to 2 Arena 151 users
- [ ] Can disconnect X account
- [ ] Can reconnect X account
- [ ] Can change to different X account
- [ ] No secrets leaked in browser console/network
- [ ] OAuth expires after 10 minutes if not completed
- [ ] All error cases show proper messages (not "Session expired")

---

## 📊 Monitoring

### View Audit Log
```sql
SELECT 
  to_char(created_at, 'YYYY-MM-DD HH24:MI:SS') as time,
  action,
  x_username,
  error_code,
  error_message
FROM x_connection_audit
ORDER BY created_at DESC
LIMIT 20;
```

### View Pending Attempts
```sql
SELECT 
  id,
  status,
  to_char(created_at, 'HH24:MI:SS') as started,
  to_char(expires_at, 'HH24:MI:SS') as expires,
  CASE 
    WHEN expires_at < NOW() THEN 'EXPIRED'
    ELSE 'ACTIVE'
  END as state
FROM x_oauth_attempts
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
```

### View Connected Accounts
```sql
SELECT 
  username as arena_user,
  x_username as x_handle,
  to_char(x_verified_at, 'YYYY-MM-DD HH24:MI') as connected
FROM profiles
WHERE x_user_id IS NOT NULL
ORDER BY x_verified_at DESC;
```

---

## 🎓 Understanding the Flow

**What actually happens:**

1. **User clicks Connect**
   - Browser: `fetch('/api/x/connect')`
   - Server: Creates request token via X API
   - Server: Saves `{user_id, request_token, request_token_secret}` to DB
   - Server: Returns `{authUrl: 'https://api.x.com/oauth/authenticate?oauth_token=XXX'}`
   - Browser: Redirects to authUrl

2. **User on X authorization page**
   - X shows: "Authorize Arena 151?"
   - User clicks: "Authorize app"
   - X generates: oauth_verifier
   - X redirects: `http://localhost:3002/api/x/callback?oauth_token=XXX&oauth_verifier=YYY`

3. **Callback processing**
   - Server: Loads attempt from DB by oauth_token
   - Server: Verifies current user matches attempt.user_id
   - Server: Calls X API with oauth_verifier → gets access_token
   - Server: Calls X API with access_token → gets user details
   - Server: Checks if x_user_id already linked elsewhere
   - Server: Updates profiles table with X account data
   - Server: Marks attempt as completed
   - Server: Redirects to `/?x_success=true`

4. **Profile updated**
   - Browser: Sees `?x_success=true` param
   - Browser: Fetches updated profile data
   - UI: Shows verified X account

**Key security points:**
- Request token secret NEVER leaves server (stored in DB)
- Access token NEVER sent to browser (used server-side only)
- OAuth verifier is one-time use
- Current user session must match OAuth initiator
- X account can only link to one Arena 151 profile

---

**Ready to test?** Start with Test 1 and work through sequentially.
