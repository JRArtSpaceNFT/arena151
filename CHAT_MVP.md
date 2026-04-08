# Arena 151 Global Chat MVP

## Overview

A real-time global chat lobby that appears on the Road to Victory homepage, making the game feel social, alive, and community-driven.

## Features Implemented

### Core Chat
- ✅ Chat icon button in top-right corner with unread badge
- ✅ Slide-out panel from right side (360px width)
- ✅ Single global "Arena Lobby" room
- ✅ Real-time message delivery via Supabase Realtime
- ✅ Messages display: avatar, username, favorite Pokémon icon, text, timestamp
- ✅ Messages expire after 10 minutes
- ✅ Max 100 recent messages loaded
- ✅ Auto-scroll to bottom when new message arrives
- ✅ Online count in header (updates every 10s)

### Presence System
- ✅ Heartbeat every 30 seconds while tab active
- ✅ Auto-cleanup of stale presence (90s timeout)
- ✅ Online count function with automatic cleanup

### Profile Modal
- ✅ Click username → centered profile modal
- ✅ Displays: avatar, username, rank, W/L record, win rate, favorite Pokémon, badges
- ✅ Actions: Mute, Report
- ✅ Challenge button (placeholder - requires matchmaking integration)

### Security & Moderation
- ✅ Authenticated users only
- ✅ Server-side rate limit: 1 message per 3 seconds (enforced via RLS)
- ✅ Max 200 characters per message
- ✅ Links blocked (not allowed)
- ✅ Basic profanity filter (client + server validation)
- ✅ User-level mute (client-side hide)
- ✅ Report system (saves to DB)

### Database Schema
- `chat_messages` - stores messages with 10-min expiration
- `chat_presence` - tracks online users
- `chat_mutes` - user blocking
- `chat_reports` - moderation queue

## Setup Instructions

### 1. Run Database Migration

```bash
cd /Users/worlddomination/.openclaw/workspace/arena151
# Run the migration in Supabase SQL Editor
cat supabase/migrations/011_arena_chat.sql
```

Or via Supabase CLI:
```bash
supabase db push
```

### 2. Set Up Cron Jobs (Supabase Dashboard)

Go to Database → Cron Jobs and add:

**Cleanup expired messages** (every 5 minutes):
```sql
SELECT cleanup_expired_chat_messages();
```

**Cleanup stale presence** (every 60 seconds):
```sql
SELECT cleanup_stale_chat_presence();
```

### 3. Test the Feature

1. Navigate to Road to Victory homepage (`draft-mode-intro` screen)
2. Click the 💬 chat button in top-right
3. Send a message
4. Open in another browser/incognito to test real-time updates
5. Click a username to view profile modal
6. Test mute/report functionality

## Technical Architecture

### Real-Time Transport
- **Supabase Realtime** for WebSocket-based message delivery
- Postgres `INSERT` events broadcast to all connected clients

### Rate Limiting
- Enforced at database level via Row-Level Security policy
- Checks for messages sent in last 3 seconds before allowing INSERT

### Message Storage
- Messages stored with `expires_at` timestamp (10 minutes from creation)
- Cron job deletes expired messages every 5 minutes
- Max 100 messages fetched on panel open

### Presence Tracking
- Client sends heartbeat every 30s via `UPSERT` to `chat_presence`
- Server cron removes stale entries (no heartbeat in 90s)
- Online count computed on-demand with automatic cleanup

## What's NOT in MVP

❌ Emoji reactions  
❌ @mentions  
❌ Typing indicators  
❌ Multiple rooms  
❌ DMs (direct messages)  
❌ Admin moderation dashboard  
❌ Advanced content filtering  
❌ Message history pagination  
❌ Online user list  
❌ Battle spectate integration  
❌ System event announcements  

## Future Enhancements (V2)

1. **System Events** - "🏆 Red just won +150 SOL in Saffron Arena!"
2. **Emoji Reactions** - React to messages with 🔥💀👏
3. **Challenge Button** - Send battle invite from profile modal
4. **Friend System** - Add friends, see online status
5. **Multiple Rooms** - Split by rank/region when > 500 concurrent users
6. **DMs** - Private 1:1 messaging
7. **Admin Dashboard** - Review reports, timeout/ban users
8. **Battle Callouts** - Link to spectate live matches

## Performance Notes

- **Client-side**: Lazy loads 100 messages on open, no infinite scroll
- **Server-side**: RLS policies + cron cleanup prevent bloat
- **Scale trigger**: Single room until 500+ concurrent users
- **Memory**: Messages auto-expire, no permanent storage

## Troubleshooting

### Chat not appearing
- Verify you're on the `draft-mode-intro` screen (Road to Victory)
- Check browser console for errors
- Ensure user is authenticated

### Messages not sending
- Check rate limit (1 message per 3s)
- Verify profanity filter isn't blocking
- Check Supabase logs for RLS policy errors

### Presence not updating
- Verify heartbeat interval (30s)
- Check cron job is running (cleanup_stale_chat_presence)
- Inspect `chat_presence` table directly

## Files Modified/Created

**New Files:**
- `components/GlobalChat.tsx` - Main chat component
- `lib/chat-types.ts` - TypeScript types
- `lib/profanityFilter.ts` - Content filtering
- `supabase/migrations/011_arena_chat.sql` - Database schema
- `CHAT_MVP.md` - This file

**Modified Files:**
- `app/page.tsx` - Added `<GlobalChat />` component on draft-mode-intro screen

## Deployment

Already integrated into main app. Just need to:

1. ✅ Run DB migration in Supabase
2. ✅ Set up cron jobs
3. ✅ Push to production

No additional config needed. Chat will appear automatically on Road to Victory homepage.
