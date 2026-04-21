-- Unlock funds for jfoley by canceling stuck matches
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/abzurjxkxxtahdjrpvxk/sql/new

-- Step 1: Find the user ID
DO $$
DECLARE
  v_user_id UUID;
  v_locked_amount NUMERIC;
  v_match_id UUID;
BEGIN
  -- Get user
  SELECT id, locked_balance INTO v_user_id, v_locked_amount
  FROM profiles
  WHERE username = 'jfoley';
  
  IF v_user_id IS NULL THEN
    RAISE NOTICE 'User jfoley not found';
    RETURN;
  END IF;
  
  RAISE NOTICE 'User ID: %', v_user_id;
  RAISE NOTICE 'Current locked balance: % SOL', v_locked_amount;
  
  -- Find any active matches
  FOR v_match_id IN
    SELECT id
    FROM matches
    WHERE (player_a_id = v_user_id OR player_b_id = v_user_id)
      AND status IN ('queueing', 'matched', 'arena_reveal', 'battle_ready', 'settlement_pending')
    ORDER BY created_at DESC
  LOOP
    RAISE NOTICE 'Found active match: %', v_match_id;
    
    -- Cancel the match
    UPDATE matches
    SET status = 'cancelled'
    WHERE id = v_match_id;
    
    RAISE NOTICE 'Cancelled match: %', v_match_id;
  END LOOP;
  
  -- Unlock all funds
  UPDATE profiles
  SET balance = balance + locked_balance,
      locked_balance = 0
  WHERE id = v_user_id;
  
  RAISE NOTICE 'Unlocked % SOL', v_locked_amount;
  
  -- Show final balance
  SELECT balance, locked_balance
  INTO v_locked_amount, v_locked_amount
  FROM profiles
  WHERE id = v_user_id;
  
  RAISE NOTICE 'Final balance: % SOL (locked: %)', v_locked_amount, 0;
END $$;

-- Verify the result
SELECT 
  username,
  balance,
  locked_balance,
  balance + locked_balance as total
FROM profiles
WHERE username = 'jfoley';
