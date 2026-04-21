-- Check current balance for the user who just tried to queue
SELECT 
  username,
  balance,
  locked_balance,
  balance + locked_balance as total
FROM profiles
WHERE username IN ('RareCandyClub', 'MistyLuvr')
ORDER BY username;

-- Check what pewter-city entry fee should be
SELECT 
  'pewter-city' as room,
  5.0 as usd_entry,
  (5.0 / 90.57) as expected_sol_fee;
