-- Check ALL columns in profiles table for these users
SELECT 
  username,
  balance,
  locked_balance,
  wallet_address,
  created_at
FROM profiles
WHERE username IN ('RareCandyClub', 'MistyLuvr')
ORDER BY username;

-- Check if there's a wallet balance somewhere
-- (The UI might be showing wallet balance, not profile balance)
