# Matchmaking Debug Test Plan

## Changes Made

### 1. API Route (`app/api/matchmaking/paid/join/route.ts`)
- Added comprehensive structured logging with emojis for visibility
- Changed all error responses to structured format:
  ```json
  {
    "ok": false,
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": {...}
  }
  ```
- Added logging at every decision point:
  - Auth check
  - Request body parsing
  - Room validation
  - RPC call
  - RPC response
  - Success/failure

### 2. Client (`components/QueueScreenV2.tsx`)
- Added detailed request logging before fetch
- Shows exact payload being sent
- Logs response status
- Displays error code + message on screen
- Better error code handling (checks both `code` and `error` fields)

## All Possible 400 Error Paths

1. **INVALID_ROOM_ID** - `roomId` missing or not a string
2. **ROOM_NOT_FOUND** - `roomId` not in ROOM_TIERS constant
3. **RPC error codes** (from database function):
   - `USER_NOT_FOUND` - Profile doesn't exist
   - `TEAM_NOT_LOCKED` - Team not locked (should be bypassed by migration 024)
   - `NO_TRAINER_SELECTED` - Trainer not selected (should be auto-filled by migration 024)
   - `INVALID_TEAM` - Team array wrong size (should be auto-filled)
   - `INVALID_ORDER` - Order array wrong size (should be auto-filled)
   - `INSUFFICIENT_FUNDS` - Not enough balance

## What to Check

### Browser Console
Look for these log lines:
```
[QueueV2] ==================== MATCHMAKING REQUEST ====================
[QueueV2] Endpoint: /api/matchmaking/paid/join
[QueueV2] Payload: {...}
[QueueV2] roomId type: string
[QueueV2] roomId value: pewter-city
```

### Server Logs (Terminal running `npm run dev`)
Look for these log lines:
```
[Matchmaking xxxxxxxx] ==================== START V2 ====================
[Matchmaking xxxxxxxx] ✅ Authenticated user: ...
[Matchmaking xxxxxxxx] 📥 Request body: ...
[Matchmaking xxxxxxxx] 🎯 Room: pewter-city | Entry fee: ...
[Matchmaking xxxxxxxx] 🔄 Calling RPC with: ...
[Matchmaking xxxxxxxx] 📦 RPC Response: ...
```

If there's a 400 error, you'll see:
```
[Matchmaking xxxxxxxx] ❌ 400 - ERROR_CODE
```

## Next Steps

1. **Open browser console** (F12 / Cmd+Opt+I)
2. **Open terminal with dev server logs**
3. **Try joining a queue**
4. **Check both browser and server logs**
5. **Report the exact error code and messages**

## Expected Flow (No Errors)

### Client logs:
```
[QueueV2] ==================== MATCHMAKING REQUEST ====================
[QueueV2] Payload: {"roomId":"pewter-city"}
[QueueV2] Response status: 200 OK
```

### Server logs:
```
[Matchmaking abc123] ==================== START V2 ====================
[Matchmaking abc123] ✅ Authenticated user: <uuid>
[Matchmaking abc123] 📥 Request body: {"roomId":"pewter-city"}
[Matchmaking abc123] 🎯 Room: pewter-city | Entry fee: 0.0552 SOL
[Matchmaking abc123] 🔄 Calling RPC with: {p_user_id, p_room_id, p_entry_fee}
[Matchmaking abc123] 📦 RPC Response: {matchId, status: "queueing", ...}
[Matchmaking abc123] ✅ SUCCESS in 250ms
[Matchmaking abc123] ==================== END ====================
```

## If Still Getting 400

The logs will now show **exactly** which validation failed:
- `INVALID_ROOM_ID` → roomId is null/undefined/wrong type
- `ROOM_NOT_FOUND` → roomId doesn't match any ROOM_TIERS key
- `TEAM_NOT_LOCKED` → Migration 024 didn't apply correctly
- `INSUFFICIENT_FUNDS` → User balance too low
- `USER_NOT_FOUND` → Profile doesn't exist in database

The error will also display **on screen** in the queue UI.
