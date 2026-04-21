-- Check all user balances
SELECT 
  username,
  balance,
  locked_balance,
  balance + locked_balance as total_funds
FROM profiles
WHERE username IN ('RareCandyClub', 'MistyLuvr', 'jfoley')
ORDER BY username;

-- Check what the entry fee is for pewter-city
-- (Should be around 0.05 SOL)
SELECT 0.05 as pewter_city_entry_fee;
