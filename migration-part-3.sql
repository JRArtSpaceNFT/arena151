CREATE INDEX IF NOT EXISTS idx_matches_queueing_by_room 
ON matches(room_id, status, created_at) 
WHERE status = 'queueing' AND player_b_id IS NULL;

ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_paid_pvp_room_required;

ALTER TABLE matches ADD CONSTRAINT matches_paid_pvp_room_required 
CHECK (game_mode != 'paid_pvp' OR room_id IS NOT NULL);
