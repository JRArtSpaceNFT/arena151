-- QUICK FIX: Manually set database balances to match what you see in UI
-- Run this in Supabase SQL Editor

UPDATE profiles
SET balance = 0.0793,
    locked_balance = 0
WHERE username = 'RareCandyClub';

UPDATE profiles
SET balance = 0.0597,
    locked_balance = 0
WHERE username = 'MistyLuvr';

-- Verify
SELECT 
  username,
  balance,
  locked_balance,
  balance + locked_balance as total_funds
FROM profiles
WHERE username IN ('RareCandyClub', 'MistyLuvr')
ORDER BY username;
