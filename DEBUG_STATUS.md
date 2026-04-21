# Matchmaking 400 Error - Debug Status

## Current Status: FULLY INSTRUMENTED, READY TO TEST

**Latest Update:** Added explicit MATCHMAKING REQUEST/RESPONSE logging per Jonathan's request.

I have NOT identified the root cause yet because I need to see the actual server logs when you try to join a queue.

## What I Did (Systematic Debugging Steps 1-3)

### Step 1: Identified All 400 Return Paths ✅

**API Route:** `app/api/matchmaking/paid/join/route.ts`

Three possible 400 responses:
1. Line ~52: `INVALID_ROOM_ID` - Missing or non-string roomId
2. Line ~62: `ROOM_NOT_FOUND` - roomId not in ROOM_TIERS
3. Line ~94: RPC error codes from database function

### Step 2: Added Comprehensive Structured Logging ✅

**Server side:**
- Every request logs with unique request ID
- Auth status logged
- Request body logged (full JSON)
- Room validation logged
- RPC call parameters logged
- RPC response logged (full JSON)
- Every error path has emoji + error code + details
- All logs use format: `[Matchmaking abc123] ✅/❌ message`

**Client side:**
- Simple, explicit logging:
  - `MATCHMAKING REQUEST PAYLOAD` - exact payload sent
  - `MATCHMAKING RESPONSE STATUS` - HTTP status code
  - `MATCHMAKING RESPONSE BODY` - full server response
- Safe JSON parsing with error handling
- Error displayed on screen: `[ERROR_CODE] Message`
- Detailed error logging with full details

### Step 3: Structured Error Responses ✅

**New format (all errors):**
```json
{
  "ok": false,
  "code": "MACHINE_READABLE_CODE",
  "message": "Human explanation",
  "details": {...}
}
```

**Error codes:**
- `UNAUTHENTICATED` - Auth failed
- `INVALID_ROOM_ID` - roomId missing/wrong type
- `ROOM_NOT_FOUND` - roomId doesn't exist
- `RPC_ERROR` - Database function failed
- `RPC_NULL_RESPONSE` - No data returned
- Plus RPC-returned codes: `USER_NOT_FOUND`, `TEAM_NOT_LOCKED`, `INSUFFICIENT_FUNDS`, etc.

## Steps 4-11: BLOCKED - Need Server Logs

I cannot complete these steps until I see what error is actually happening:

- ❌ Step 4: Verify client/server payload match
- ❌ Step 5: Check missing fields
- ❌ Step 6: Check room handling
- ❌ Step 7: Check auth
- ❌ Step 8: Check validation
- ❌ Step 9: Check matchmaking flow
- ❌ Step 10: Add debug mode
- ❌ Step 11: Root cause analysis

## Next: YOU NEED TO TEST

### What to Do:

1. **Open Terminal** - Watch dev server logs (already running on port 3002)
2. **Open Browser Console** (F12 or Cmd+Opt+I)
3. **Go to Arena 151** - http://localhost:3002
4. **Try to join a queue** - Click on Pewter City and join
5. **Look at the error on screen** - Queue UI will display: `[ERROR_CODE] Message`
6. **Check both logs** - Browser console + terminal

### What I Need From You:

Copy and paste from **browser console**:
1. Line with: `MATCHMAKING REQUEST PAYLOAD`
2. Line with: `MATCHMAKING RESPONSE STATUS`
3. Line with: `MATCHMAKING RESPONSE BODY`
4. Any error lines after that

Copy and paste from **server terminal**:
1. All lines starting with `[Matchmaking]`
2. Look for the line with `==================== START V2 ====================`
3. Copy everything until `==================== END ====================` or the error

**The error will also display on screen in the queue UI** - screenshot that too.

The logs will show the EXACT error code and where it's failing.

## Files Changed

1. `app/api/matchmaking/paid/join/route.ts` - Added comprehensive logging + structured errors
2. `components/QueueScreenV2.tsx` - Added MATCHMAKING REQUEST/RESPONSE logging, safe JSON parsing, detailed error display
3. `supabase/migrations/024_complete_v2_bypass.sql` - Fixed RPC function (already deployed)

## Hypothesis (To Be Confirmed)

My best guess is one of these:
1. **RPC returning an error** - Migration 024 might have a bug
2. **Auth issue** - Session token not working
3. **Missing profile** - User doesn't have a profile record

But I won't know until I see the logs.

## After You Give Me Logs

Once I see the actual error, I will:
1. Identify the exact failure point
2. Fix the root cause
3. Test the fix
4. Give you before/after behavior
5. Provide a test plan for two users
