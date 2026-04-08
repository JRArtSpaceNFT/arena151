# X (Twitter) OAuth Setup Guide

## Quick Start

### 1. Get X Developer Credentials

1. Go to https://developer.x.com/en/portal/dashboard
2. Create a new project + app
3. Enable **OAuth 2.0**
4. Set callback URL: `http://localhost:3002/api/x/callback`
5. Copy **Client ID** and **Client Secret**

### 2. Update Environment Variables

Edit `.env.local` and replace these values:

```bash
X_CLIENT_ID="your_actual_client_id"
X_CLIENT_SECRET="your_actual_client_secret"
```

The rest are already configured.

### 3. Run Database Migration

Copy the SQL from `supabase/migrations/012_x_account_linking.sql` and run it in the Supabase SQL Editor:

1. Go to https://supabase.com/dashboard/project/abzurjxkxxtahdjrpvxk/sql
2. Paste the migration SQL
3. Click "Run"

### 4. Test Locally

```bash
npm run dev
```

1. Log in to Arena 151
2. Go to profile settings (you'll need to add `<XConnectionCard />` component)
3. Click "Connect X Account"
4. Authorize on X
5. Should redirect back with success

### 5. Add to Profile Page

Wherever you want to show X connection settings:

```tsx
import { XConnectionCard } from '@/components/XConnectionCard'

// In your profile settings page
<XConnectionCard onConnectionChange={() => {
  // Optional: refresh profile data
}} />
```

### 6. Display Public Badge

Wherever you show user profiles (leaderboard, user cards, etc.):

```tsx
import { PublicXBadge } from '@/components/PublicXBadge'

<PublicXBadge
  xUserId={user.x_user_id}
  xUsername={user.x_username}
  xName={user.x_name}
  xProfileImage={user.x_profile_image_url}
  size="md"
/>
```

---

## Production Setup

### Update Environment Variables (Vercel)

```bash
X_CLIENT_ID="prod_client_id"
X_CLIENT_SECRET="prod_client_secret"
X_REDIRECT_URI="https://arena151.xyz/api/x/callback"
APP_BASE_URL="https://arena151.xyz"
TOKEN_ENCRYPTION_KEY="..." # Keep the generated one
SESSION_SECRET="..." # Keep the generated one
```

### Update X Developer Portal

Add production callback URL:
- `https://arena151.xyz/api/x/callback`

---

## Security Notes

- ✅ Only OAuth-verified accounts are trusted (no manual entry)
- ✅ `x_user_id` is canonical identity (username can change)
- ✅ One X account = one Arena 151 profile (enforced by DB)
- ✅ All token exchanges happen server-side only
- ✅ PKCE prevents authorization code interception
- ✅ State parameter prevents CSRF attacks

---

## Files Created

```
supabase/migrations/012_x_account_linking.sql
lib/x-oauth.ts
lib/crypto.ts
lib/auth-server.ts
lib/db-server.ts
app/api/x/connect/route.ts
app/api/x/callback/route.ts
app/api/x/unlink/route.ts
components/XConnectionCard.tsx
components/PublicXBadge.tsx
```

---

## Troubleshooting

**Error: "X OAuth not configured"**
- Make sure `X_CLIENT_ID` and `X_REDIRECT_URI` are set in `.env.local`

**Error: "OAuth session expired"**
- OAuth cookies expire in 10 minutes. Start the flow again.

**Error: "X account already linked"**
- That X account is already connected to another Arena 151 profile
- One X account can only be linked to one Arena 151 account

**Callback redirects to wrong URL**
- Check `APP_BASE_URL` in `.env.local`
- For production, set to `https://arena151.xyz`

---

Ready to ship! 🚀
