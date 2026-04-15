# Friend Battle TODO

## Live Emoji Sync (High Priority)

**Issue:** When player sends emoji/hype reaction during friend battle, opponent doesn't see it

**Implementation needed:**

1. **Server API changes** (`app/api/match/friend/route.ts`):
   - Add `hype_events` JSONB array to matches table schema
   - New action: `add_hype` - appends hype event to array with timestamp
   - Return latest hype events in `sync_state` response

2. **Client polling** (`components/battle/FriendGameWrapper.tsx`):
   - During battle screen, poll every 1-2 seconds for new hype events
   - Track `lastHypeTimestamp` to only fetch new events
   - Pass events to BattleScreen via props

3. **Hype trigger sync** (`components/battle/BattleScreen.tsx`):
   - When local player triggers hype, send to server immediately
   - When receiving opponent hype from polling, trigger via `triggerReaction()`
   - Deduplicate by timestamp to prevent double-triggers

**Example hype event:**
```json
{
  "side": "A",
  "type": "emote",
  "content": "/hype-emojis/Emoji1.png",
  "timestamp": 1713147234567,
  "playerId": "user-uuid"
}
```

**Estimated effort:** 2-3 hours
- Server: 30 min
- Client polling: 1 hour
- Integration + testing: 1 hour

## Database Schema Update Needed

```sql
ALTER TABLE matches
ADD COLUMN hype_events JSONB DEFAULT '[]'::jsonb;

CREATE INDEX idx_matches_hype_events ON matches USING GIN (hype_events);
```
