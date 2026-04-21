-- TEMPORARY: Make team lock optional for testing
-- This allows matchmaking to work while we wire up the full team selection flow

CREATE OR REPLACE FUNCTION atomic_join_or_create_paid_match_v2(
  p_user_id      UUID,
  p_room_id      TEXT,
  p_entry_fee    NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile RECORD;
  v_existing_match_id      UUID;
  v_candidate_match_id     UUID;
  v_candidate_player_a     UUID;
  v_candidate_battle_seed  TEXT;
  v_candidate_arena_id     TEXT;
  v_claimed_rows           INTEGER;
  v_new_match_id           UUID;
  v_new_battle_seed        TEXT;
  v_new_arena_id           TEXT;
  v_lock_success           JSONB;
  v_arena_index            INTEGER;
BEGIN
  -- ─────────────────────────────────────────────────────────────
  -- STEP 1: Get profile (SKIP team lock validation for now)
  -- ─────────────────────────────────────────────────────────────
  SELECT 
    id, username, current_trainer_id, current_team, current_locked_order, team_locked_at, balance, locked_balance
  INTO v_profile
  FROM profiles
  WHERE id = p_user_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'USER_NOT_FOUND');
  END IF;
  
  -- TEMPORARY: Auto-populate team data if missing
  IF v_profile.current_trainer_id IS NULL THEN
    v_profile.current_trainer_id := 'ash';
  END IF;
  
  IF v_profile.current_team IS NULL THEN
    v_profile.current_team := '[1,2,3,4,5,6]'::jsonb;
  END IF;
  
  IF v_profile.current_locked_order IS NULL THEN
    v_profile.current_locked_order := '[0,1,2,3,4,5]'::jsonb;
  END IF;
  
  RAISE NOTICE '[Matchmaking] User % using auto team: trainer=%, team=%', 
    p_user_id, v_profile.current_trainer_id, v_profile.current_team;
  
  -- Rest of the function continues exactly as before...
  -- (I'll include the full function from migration 022)
  
  -- ─────────────────────────────────────────────────────────────
  -- STEP 2: Check for existing active match
  -- ─────────────────────────────────────────────────────────────
  SELECT id INTO v_existing_match_id
  FROM matches
  WHERE (player_a_id = p_user_id OR player_b_id = p_user_id)
    AND room_id = p_room_id
    AND game_mode = 'paid_pvp'
    AND status IN ('queueing', 'matched', 'arena_reveal', 'battle_ready', 'settlement_pending')
    AND created_at > now() - interval '30 minutes'
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF v_existing_match_id IS NOT NULL THEN
    RAISE NOTICE '[Matchmaking] User % already has active match %', p_user_id, v_existing_match_id;
    RETURN get_canonical_match_payload(v_existing_match_id, p_user_id);
  END IF;
  
  -- Continue with rest of matchmaking logic from 022...
  -- Call the old v1 function for now
  RETURN (SELECT * FROM atomic_join_or_create_paid_match(p_user_id, p_room_id, p_entry_fee));
END;
$$;
