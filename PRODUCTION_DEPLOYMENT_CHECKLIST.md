# Production Deployment Checklist

## ✅ What I Just Did

- [x] Updated `.env.local` to use production URLs
- [x] Committed all X OAuth code to Git
- [x] Pushed to GitHub
- [x] Vercel is deploying (auto-deploy from main branch)

---

## ⚠️ CRITICAL: Update X Developer Portal Callback URL

**You MUST do this or OAuth will fail:**

### Step 1: Go to X Developer Portal
**Link:** https://developer.x.com/en/portal/projects-and-apps

### Step 2: Find Your Arena 151 App
- Click on your app name
- Should be named something like "Arena 151" or similar

### Step 3: Go to App Settings
- Click "Settings" or "Edit" button
- Look for "User authentication settings"

### Step 4: Update Callback URLs
Find the "Callback URL" or "Redirect URL" field.

**Current value (probably):**
```
http://localhost:3002/api/x/callback
```

**Change to (add both):**
```
https://arena151.xyz/api/x/callback
http://localhost:3002/api/x/callback
```

You can have BOTH URLs listed (comma-separated or on separate lines).

### Step 5: Save Changes
- Click "Save" or "Update"
- X will verify the URLs

---

## 📊 Vercel Environment Variables Check

Vercel should already have these from your `.env.local`:

**Go to:** https://vercel.com/jfole001-7458s-projects/jonathan-foley-og6b/settings/environment-variables

**Verify these exist (for Production):**
- `X_CLIENT_ID` (or `X_CONSUMER_KEY`)
- `X_CLIENT_SECRET` (or `X_CONSUMER_SECRET`)
- `X_CALLBACK_URL` = `https://arena151.xyz/api/x/callback`
- `APP_BASE_URL` = `https://arena151.xyz`
- `SUPABASE_SERVICE_ROLE_KEY`

**If any are missing, add them.**

---

## 🧪 Test on Production

Once X callback URL is updated:

1. **Go to:** https://arena151.xyz
2. **Log in** to your Arena 151 account
3. **Go to profile page**
4. **Click "Connect X Account"**
5. **Should redirect to X authorization page**
6. **Click "Authorize app"**
7. **Should redirect back to arena151.xyz**
8. **Profile should show your X username + avatar**

---

## 🐛 If It Fails

Check server logs in Vercel:
- Go to: https://vercel.com/jfole001-7458s-projects/jonathan-foley-og6b/logs
- Look for logs starting with `[CONNECT_X_`
- Send me any error messages

Common issues:
- ❌ Callback URL not updated in X → "401 Invalid callback URL"
- ❌ Missing env vars in Vercel → "X OAuth not configured"
- ❌ Wrong credentials → "Failed to get request token: 401"

---

## ✅ Success Criteria

It's working when:
- ✅ Redirects to X authorization page
- ✅ X shows "Authorize Arena 151?"
- ✅ After authorizing, redirects back to arena151.xyz
- ✅ Profile shows your verified X username
- ✅ Refresh page → X account persists

---

**Current Status:**
- [x] Code deployed to Vercel
- [ ] X callback URL updated (YOU MUST DO THIS)
- [ ] Tested on arena151.xyz

**Next:** Update X callback URL, then test!
