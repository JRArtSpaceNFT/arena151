-- Clean up stuck queueing matches older than 5 minutes
-- This will let you test fresh matching

-- First, check what we have
SELECT 
  id, 
  player_a_id, 
  player_b_id, 
  status, 
  room_id,
  created_at,
  EXTRACT(EPOCH FROM (now() - created_at)) / 60 as age_minutes
FROM matches
WHERE status = 'queueing'
  AND game_mode = 'paid_pvp'
  AND created_at > now() - interval '1 hour'
ORDER BY created_at DESC;

-- If those look like stuck matches, delete them:
-- DELETE FROM matches WHERE status = 'queueing' AND game_mode = 'paid_pvp' AND created_at < now() - interval '5 minutes';
