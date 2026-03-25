# X (Twitter) OAuth Integration Plan

## Status: Pending Backend Setup

X profile linking is fully designed but requires a backend before it can be implemented safely. See `BACKEND_SETUP.md` for the Supabase setup that unblocks this.

---

## What We're Building

Allow users to connect their verified X account to their Arena 151 trainer profile so other players can click through to their X page. The connection must be **real OAuth** — not a text field anyone can type anything into.

---

## X Developer App Setup

1. Go to [developer.twitter.com](https://developer.twitter.com) and create an app
2. Set **App Type** to "Web App"
3. Set **Callback URI**: `https://yourdomain.com/auth/x/callback`
   - For local dev: `http://localhost:3000/auth/x/callback`
4. Enable **OAuth 2.0** with scopes: `tweet.read users.read offline.access`
5. Copy your **Client ID** (public) and **Client Secret** (server-only — never in frontend)

---

## Recommended Flow: OAuth 2.0 PKCE (via Supabase Auth)

Supabase Auth has native X/Twitter provider support. Once you have the Supabase project set up:

```
1. User clicks "Connect X" on their profile
2. Frontend calls: supabase.auth.signInWithOAuth({ provider: 'twitter' })
3. User is redirected to X to authorize
4. X redirects back to your callback URL with an auth code
5. Supabase exchanges the code for tokens server-side
6. You receive the user's X handle + user ID in the session
7. Store verified X data in the user's profile row in Supabase
```

### Why not do this purely on the frontend?

The OAuth client secret must never be exposed in browser code. Any frontend-only implementation can be trivially spoofed. The backend (Supabase) holds the secret and performs the token exchange securely.

---

## Data to Store

Add to `StoredUser` (and Supabase `users` table):

```typescript
x_handle?: string;       // e.g. "@JR_OnChain"
x_user_id?: string;      // X's numeric user ID (stable, even if handle changes)
x_verified: boolean;     // true only if connected via OAuth, never user-entered
x_connected_at?: string; // ISO timestamp
```

---

## UI Placement on Profile

In `TrainerProfile.tsx`, add a section below the stats grid:

```
┌─────────────────────────────────────────────────┐
│  🐦 X Account                                    │
│  [@JR_OnChain]  [Connected ✓]  [Disconnect]      │
│  ── or ──                                        │
│  [Connect X Account]                             │
└─────────────────────────────────────────────────┘
```

- Connected state: shows handle as a clickable link to `x.com/handle`, green verified badge, Disconnect button
- Disconnected state: single "Connect X" button that triggers OAuth flow
- On other players' profiles (future): shows the X handle as a clickable link

---

## Frontend Implementation (once Supabase is live)

```typescript
// In TrainerProfile.tsx
const handleConnectX = async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'twitter',
    options: {
      redirectTo: `${window.location.origin}/auth/x/callback`,
      scopes: 'tweet.read users.read',
    },
  });
  if (error) console.error(error);
};

// In a new /app/auth/x/callback/page.tsx
// Supabase handles the token exchange automatically
// Read the session and extract x_username from user.identities
```

---

## Persistence

Once connected, store in Supabase `users` table:
```sql
ALTER TABLE users ADD COLUMN x_handle TEXT;
ALTER TABLE users ADD COLUMN x_user_id TEXT;
ALTER TABLE users ADD COLUMN x_verified BOOLEAN DEFAULT FALSE;
```

The localStorage `StoredUser` type would get these fields too for local reads.

---

## Estimated Effort

| Step | Time |
|------|------|
| Enable Twitter provider in Supabase dashboard | 5 min |
| Create X developer app + get keys | 15 min |
| Add OAuth callback route in Next.js | 30 min |
| Update TrainerProfile UI | 1 hr |
| Wire to Supabase user row | 30 min |
| Test + edge cases (disconnect, reconnect, revoke) | 1 hr |
| **Total** | **~3.5 hours** |

---

## Edge Cases to Handle

- User disconnects X — clear `x_handle`, `x_user_id`, set `x_verified: false`
- User changes X handle — `x_user_id` stays stable, handle should update on reconnect
- OAuth fails or is cancelled — graceful error state, no partial data saved
- User has multiple Arena accounts — each must authorize separately; one X account per Arena account
- X API rate limits — OAuth calls are user-initiated and infrequent, no rate limit concern

---

## When Ready

Give me:
1. Your Supabase project URL and anon key
2. Your X app Client ID and Client Secret (share Client Secret privately — never commit to git)

I'll wire the entire flow in one pass.
