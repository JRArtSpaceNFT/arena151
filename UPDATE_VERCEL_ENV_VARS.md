# Update Vercel Environment Variables

## 🔐 New X OAuth Credentials

Your correct X OAuth credentials are:

**Client ID:**
```
Vk41b1F3d05IUXhRdzhEMjUxMDY6MTpjaQ
```

**Client Secret:**
```
v2WMQy4vSbhx_CLLVR1Z79wlZjPKfnpbXUKyDS08iUUFRa061M
```

---

## 📝 Update Vercel (Required)

### Step 1: Go to Vercel Environment Variables
**Click this link:**
👉 https://vercel.com/jfole001-7458s-projects/jonathan-foley-og6b/settings/environment-variables

### Step 2: Update X_CLIENT_ID

1. Find **`X_CLIENT_ID`** in the list
2. Click the **"..."** menu button → Edit
3. Replace value with:
   ```
   Vk41b1F3d05IUXhRdzhEMjUxMDY6MTpjaQ
   ```
4. Click "Save"

### Step 3: Update X_CLIENT_SECRET

1. Find **`X_CLIENT_SECRET`** in the list
2. Click the **"..."** menu button → Edit
3. Replace value with:
   ```
   v2WMQy4vSbhx_CLLVR1Z79wlZjPKfnpbXUKyDS08iUUFRa061M
   ```
4. Click "Save"

### Step 4: Verify Other Variables

Make sure these also exist (add if missing):

**X_CALLBACK_URL:**
```
https://arena151.xyz/api/x/callback
```

**APP_BASE_URL:**
```
https://arena151.xyz
```

**SUPABASE_SERVICE_ROLE_KEY:**
(Should already be there from existing config)

### Step 5: Redeploy

After saving environment variables:
1. Vercel may auto-redeploy
2. OR click "Redeploy" button in Vercel dashboard

---

## ✅ After Vercel is Updated

Wait ~60 seconds for redeploy, then test:

1. Go to: https://arena151.xyz
2. Log in
3. Go to profile
4. Click "Connect X Account"
5. Should redirect to X authorization page

---

**Do this now, then let me know when Vercel variables are updated!**
