-- Matchmaking Safety Improvements
-- Prevents race conditions and enforces constraints

-- 1. Prevent duplicate matches by same user in same room
-- Only one 'forming' match per user per room at a time
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_unique_forming_match_per_user_room
ON matches (player_a_id, room_id)
WHERE status = 'forming' AND player_b_id IS NULL;

-- 2. Add status transition validation
-- Ensures only valid status values can be stored
ALTER TABLE matches DROP CONSTRAINT IF EXISTS valid_match_status;
ALTER TABLE matches ADD CONSTRAINT valid_match_status 
CHECK (status IN (
  'forming',
  'ready', 
  'settlement_pending',
  'settled',
  'abandoned',
  'voided',
  'settlement_failed',
  'settling',
  'manual_review'
));

-- 3. Add index for faster queue lookups (P2 finding open matches)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_open_matches_by_room
ON matches (room_id, created_at)
WHERE status = 'forming' AND player_b_id IS NULL;

-- 4. Add index for realtime subscriptions
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_matches_for_realtime
ON matches (id, updated_at)
WHERE status IN ('forming', 'ready', 'settlement_pending');

COMMENT ON INDEX idx_unique_forming_match_per_user_room IS 
'Prevents duplicate match creation race condition - only one forming match per user per room';

COMMENT ON CONSTRAINT valid_match_status ON matches IS
'Enforces valid match status values - prevents invalid state transitions at DB level';
