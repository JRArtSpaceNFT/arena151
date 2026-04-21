-- First, let's see your current balance status
SELECT 
  id,
  username,
  balance,
  locked_balance,
  balance + locked_balance as total
FROM profiles
WHERE username = 'jfoley';

-- Find any active/stuck matches
SELECT 
  id,
  status,
  entry_fee_sol,
  created_at,
  player_a_id,
  player_b_id
FROM matches
WHERE (player_a_id = (SELECT id FROM profiles WHERE username = 'jfoley')
   OR player_b_id = (SELECT id FROM profiles WHERE username = 'jfoley'))
  AND status IN ('queueing', 'matched', 'arena_reveal', 'battle_ready', 'settlement_pending')
ORDER BY created_at DESC;
