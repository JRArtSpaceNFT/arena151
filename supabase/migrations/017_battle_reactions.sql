-- Add reactions column to matches table for live Friend Battle emoji/hype reactions
-- Reactions are stored as JSONB array: [{playerId, type, content, timestamp}, ...]
-- Kept at max 50 reactions per match to prevent unbounded growth

ALTER TABLE matches
ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT '[]'::jsonb;

-- Add index for faster reaction queries (optional, but helpful for large tables)
CREATE INDEX IF NOT EXISTS idx_matches_reactions ON matches USING gin(reactions);

-- Comment for documentation
COMMENT ON COLUMN matches.reactions IS 'Live battle reactions array: [{playerId, type, content, timestamp}, ...]. Max 50 per match.';
