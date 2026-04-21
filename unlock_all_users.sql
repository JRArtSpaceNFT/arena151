-- Unlock funds for RareCandyClub and MistyLuvr

DO $$
DECLARE
  v_user_id UUID;
  v_locked_amount NUMERIC;
  v_match_id UUID;
  v_username TEXT;
BEGIN
  -- Loop through both usernames
  FOR v_username IN SELECT unnest(ARRAY['RareCandyClub', 'MistyLuvr'])
  LOOP
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Processing user: %', v_username;
    
    -- Get user
    SELECT id, locked_balance INTO v_user_id, v_locked_amount
    FROM profiles
    WHERE username = v_username;
    
    IF v_user_id IS NULL THEN
      RAISE NOTICE 'User % not found', v_username;
      CONTINUE;
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
    
    RAISE NOTICE 'Unlocked % SOL for %', v_locked_amount, v_username;
  END LOOP;
END $$;

-- Verify the results
SELECT 
  username,
  balance,
  locked_balance,
  balance + locked_balance as total
FROM profiles
WHERE username IN ('RareCandyClub', 'MistyLuvr')
ORDER BY username;
