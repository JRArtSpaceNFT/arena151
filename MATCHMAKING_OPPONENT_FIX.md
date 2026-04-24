# Real Money PvP Opponent Bug - FIXED

**Date:** April 24, 2026  
**Status:** ✅ Fixed, ready to test

## The Problem

When joining a real money battle:
- ✅ Matchmaking worked (both players matched)
- ✅ Room joined correctly
- ❌ **Opponent showed as "Rival Trainer" (AI bot) instead of real player**
- ❌ **Battle started with AI instead of PvP**

## Root Cause

**QueueScreen.tsx line 354** was accessing the wrong field names:

```typescript
// ❌ WRONG - these fields don't exist in the matchmaking response
const opponentId = matchData.role === 'player_a' ? matchData.playerBId : matchData.playerAId
```

**Actual matchmaking response structure:**
```json
{
  "myRole": "player_a",
  "playerA": { "userId": "abc123", "trainerId": "..." },
  "playerB": { "userId": "def456", "trainerId": "..." },
  "opponent": { "userId": "def456", "trainerId": "..." }
}
```

**What happened:**
1. `opponentId` was `undefined` (accessing non-existent fields)
2. Profile fetch went to `/api/profile/undefined` → **404**
3. Fell back to `GENERIC_RIVAL` placeholder
4. Match was set with generic "Rival Trainer" data
5. Battle started with AI instead of real opponent

## The Fix

Changed QueueScreen.tsx line 354-356:

```typescript
// ✅ CORRECT - use opponent.userId from matchmaking response
const opponentId = matchData.opponent?.userId;
let opponentProfile = GENERIC_RIVAL;

console.log(`[Queue] Opponent userId from matchData: ${opponentId}`);
```

Now it:
1. ✅ Correctly extracts opponent user ID
2. ✅ Fetches real opponent profile from `/api/profile/{userId}`
3. ✅ Sets match with real player data
4. ✅ Battle starts as true PvP

## Testing Protocol

### Setup
1. Two accounts with balance (can use test accounts)
2. Both in different browsers (or incognito + regular)

### Steps
1. **Player 1:** Enter matchmaking, select same room (e.g. Pallet Pot)
2. **Player 2:** Enter matchmaking, select same room
3. Both should match within ~1-5 seconds
4. **Check versus screen:** Should show **real usernames and avatars** (not "Rival Trainer")
5. **Check battle:** Should say "{Player1} vs {Player2}" (not "Rival vs Rival")
6. **Complete battle:** Winner should get paid

### Expected Console Logs

**QueueScreen (both players):**
```
[Queue] ✅ BATTLE_READY - transitioning to versus
[Queue] Opponent userId from matchData: abc123def456...
[Queue] Fetching opponent profile: abc123def456...
```

**Versus Screen:**
```
Player 1: <real username>
Player 2: <real username>
```

**GameWrapper:**
```
[GameWrapper] Paid PvP battle - both players present
[Battle] Computing canonical battle...
```

### What to Watch For

❌ **If opponent still shows as "Rival Trainer":**
- Check console for: `Opponent userId from matchData: undefined`
- This means matchmaking response structure changed again

❌ **If profile fetch 404s:**
- Check: `Failed to load resource: /api/profile/{userId}` → 404
- This means the userId exists but profile doesn't exist in database
- Create the profile: User needs to complete signup flow

✅ **Success indicators:**
- Real usernames/avatars on versus screen
- Real player names during battle
- No "Rival Trainer" or "Rival vs Rival" text
- Winner gets paid exactly once

## Files Changed

- `components/QueueScreen.tsx` (line 354-358)

## Deploy & Test

```bash
cd /Users/worlddomination/.openclaw/workspace/arena151
git add components/QueueScreen.tsx MATCHMAKING_OPPONENT_FIX.md
git commit -m "fix: use opponent.userId for real PvP opponent profile fetch"
git push
```

Wait 2-3 minutes for Vercel to deploy, then hard refresh both browsers (Cmd+Shift+R) before testing.

## If It Still Fails

**Capture:**
1. Full browser console logs (both players)
2. Screenshot of versus screen showing opponent name
3. Network tab showing `/api/matchmaking/paid/join` response
4. Network tab showing `/api/profile/{userId}` response (or 404)

**Check database:**
```sql
SELECT id, username, display_name, avatar FROM profiles WHERE id = '<opponent_user_id>';
```

If profile doesn't exist, user needs to complete signup.
