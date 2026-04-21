# EXACT LOGS TO CAPTURE

## Browser Console (F12 or Cmd+Opt+I)

Look for these **THREE lines**:

```
MATCHMAKING REQUEST PAYLOAD {roomId: "pewter-city"}
MATCHMAKING RESPONSE STATUS 400
MATCHMAKING RESPONSE BODY {ok: false, code: "...", message: "...", ...}
```

Copy and paste those three lines.

---

## Server Terminal (running `npm run dev`)

Look for a block that starts with:

```
[Matchmaking abc123] ==================== START V2 ====================
```

And includes lines like:

```
[Matchmaking abc123] ✅ Authenticated user: ...
[Matchmaking abc123] 📥 Request body: ...
[Matchmaking abc123] 🎯 Room: pewter-city | Entry fee: ...
[Matchmaking abc123] 🔄 Calling RPC with: ...
[Matchmaking abc123] ❌ 400 - ERROR_CODE_HERE
```

Copy and paste that entire block (from `START V2` to the error or `END`).

---

## On-Screen Error

The queue screen itself will display:

```
❌ [ERROR_CODE] Error message here
```

Take a screenshot or copy that text.

---

## That's It

Send me those three things and I'll identify the exact root cause.
