# Matchmaking Debug Trace Test Protocol

## When Deployment is Ready

1. **Get latest deployment URL:**
   ```bash
   cd /Users/worlddomination/.openclaw/workspace/arena151
   npx vercel ls | head -4
   ```
   Open the newest "Ready" URL (should be ~2 min old when ready)

2. **Open browser console FIRST (before any action):**
   - Cmd+Option+J (Chrome/Edge)
   - Clear console
   - Enable "Preserve log" checkbox

3. **Login to test account:**
   - Email: `pole1239@gmail.com` (mistyluvr)
   - Use password reset if needed

4. **Navigate to queue:**
   - Click "Enter the Arena"
   - Select any room (e.g., "Cinnabar Chamber")
   - Click "Join Match"

5. **Capture console output:**
   - Look for these exact log lines:
     ```
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     MATCHMAKING REQUEST ID: req_...
     MATCHMAKING REQUEST PAYLOAD: {...}
     MATCHMAKING RESPONSE STATUS: 200 or 400
     MATCHMAKING RESPONSE RAW JSON: {...}
     MATCHMAKING RESPONSE AFTER NORMALIZATION: {...}
     [Validator] Starting validation...
     [Validator] status = "..."
     [Validator] FAIL: ... OR ✓ ALL VALIDATION PASSED
     MATCHMAKING VALIDATION RESULT: PASSED or FAILED: ...
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     ```

6. **Extract requestId:**
   - Copy the `requestId` value (e.g., `req_1234567890_abc123`)

7. **Get matching server logs:**
   ```bash
   cd /Users/worlddomination/.openclaw/workspace/arena151
   npx vercel logs --limit 50 | grep -A100 "req_1234567890_abc123"
   ```

8. **Paste both:**
   - Browser console output (everything between the ━━━ delimiters)
   - Server logs for same requestId

## Expected Outcomes

### If endpoint returns 400:
Server logs will show:
```
[Matchmaking req_...] ❌ 400 - [ERROR_CODE]
```

Then we fix the server route.

### If endpoint returns 200 but validator fails:
Browser console will show:
```
MATCHMAKING RESPONSE STATUS: 200
[Validator] FAIL: missing field "playerB.team"
MATCHMAKING VALIDATION RESULT: FAILED: Invalid playerB.team
```

Then we fix the canonical response shape.

### If everything passes:
```
MATCHMAKING RESPONSE STATUS: 200
[Validator] ✓ ALL VALIDATION PASSED
MATCHMAKING VALIDATION RESULT: PASSED
```

Then the queue screen should render without error.

## DO NOT PROCEED until you have:
- ✅ Full browser console trace with requestId
- ✅ Full server logs for same requestId
- ✅ Exact field name that failed (if any)
