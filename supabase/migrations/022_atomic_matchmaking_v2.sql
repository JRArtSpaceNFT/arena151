-- Arena 151 - Atomic Matchmaking V2
-- Server-authoritative matchmaking with team lock validation and canonical payload

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
  -- STEP 1: Validate team is locked
  -- ─────────────────────────────────────────────────────────────
  SELECT 
    id, username, current_trainer_id, current_team, current_locked_order, team_locked_at, balance, locked_balance
  INTO v_profile
  FROM profiles
  WHERE id = p_user_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'USER_NOT_FOUND');
  END IF;
  
  -- Check team lock
  IF v_profile.team_locked_at IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'TEAM_NOT_LOCKED', 'message', 'You must lock your team before joining matchmaking');
  END IF;
  
  IF v_profile.current_trainer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NO_TRAINER_SELECTED', 'message', 'You must select a trainer');
  END IF;
  
  IF v_profile.current_team IS NULL OR jsonb_array_length(v_profile.current_team) != 6 THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_TEAM', 'message', 'You must select exactly 6 Pokémon');
  END IF;
  
  IF v_profile.current_locked_order IS NULL OR jsonb_array_length(v_profile.current_locked_order) != 6 THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_ORDER', 'message', 'You must set your battle order');
  END IF;
  
  RAISE NOTICE '[Matchmaking] User % team validated: trainer=%, team size=%', 
    p_user_id, v_profile.current_trainer_id, jsonb_array_length(v_profile.current_team);
  
  -- ─────────────────────────────────────────────────────────────
  -- STEP 2: Check for existing active match (resume protection)
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
  
  -- ─────────────────────────────────────────────────────────────
  -- STEP 3: Try to join existing queueing match
  -- ─────────────────────────────────────────────────────────────
  SELECT id, player_a_id, battle_seed, arena_id
  INTO v_candidate_match_id, v_candidate_player_a, v_candidate_battle_seed, v_candidate_arena_id
  FROM matches
  WHERE status = 'queueing'
    AND game_mode = 'paid_pvp'
    AND player_b_id IS NULL
    AND player_a_id != p_user_id
    AND room_id = p_room_id
    AND entry_fee_sol = p_entry_fee
    AND (expires_at IS NULL OR expires_at > now())
  ORDER BY created_at ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1;
  
  IF v_candidate_match_id IS NOT NULL THEN
    RAISE NOTICE '[Matchmaking] Found candidate match % to join', v_candidate_match_id;
    
    -- Lock funds for player_b
    v_lock_success := lock_player_funds(p_user_id, p_entry_fee);
    IF NOT (v_lock_success->>'success')::boolean THEN
      RETURN jsonb_build_object('success', false, 'error', 'INSUFFICIENT_FUNDS', 'details', v_lock_success);
    END IF;
    
    -- Get player_a username and trainer
    DECLARE
      v_player_a_username TEXT;
      v_player_a_trainer_id TEXT;
    BEGIN
      SELECT username, current_trainer_id INTO v_player_a_username, v_player_a_trainer_id
      FROM profiles WHERE id = v_candidate_player_a;
    END;
    
    -- Claim the match as player_b
    UPDATE matches
    SET 
      player_b_id = p_user_id,
      player_b_username = v_profile.username,
      player_b_trainer_id = v_profile.current_trainer_id,
      team_b = v_profile.current_team,
      player_b_locked_order = v_profile.current_locked_order,
      status = 'matched',
      joined_at = now(),
      updated_at = now()
    WHERE id = v_candidate_match_id;
    
    GET DIAGNOSTICS v_claimed_rows = ROW_COUNT;
    
    IF v_claimed_rows = 1 THEN
      RAISE NOTICE '[Matchmaking] User % joined match % as player_b', p_user_id, v_candidate_match_id;
      
      INSERT INTO audit_log (user_id, match_id, event_type, amount_sol, metadata)
      VALUES (
        p_user_id,
        v_candidate_match_id,
        'wager_locked',
        p_entry_fee,
        jsonb_build_object('role', 'player_b', 'room_id', p_room_id, 'source', 'atomic_matchmaking_v2')
      );
      
      RETURN get_canonical_match_payload(v_candidate_match_id, p_user_id);
    ELSE
      -- Race condition - unlock and fall through
      RAISE NOTICE '[Matchmaking] Race: match % was claimed by another player', v_candidate_match_id;
      PERFORM unlock_player_funds(p_user_id, p_entry_fee);
    END IF;
  END IF;
  
  -- ─────────────────────────────────────────────────────────────
  -- STEP 4: Create new queueing match as player_a
  -- ─────────────────────────────────────────────────────────────
  RAISE NOTICE '[Matchmaking] Creating new queueing match for user %', p_user_id;
  
  -- Lock funds
  v_lock_success := lock_player_funds(p_user_id, p_entry_fee);
  IF NOT (v_lock_success->>'success')::boolean THEN
    RETURN jsonb_build_object('success', false, 'error', 'INSUFFICIENT_FUNDS', 'details', v_lock_success);
  END IF;
  
  -- Generate IDs
  v_new_match_id := gen_random_uuid();
  v_new_battle_seed := gen_random_uuid()::text;
  
  -- Pre-select arena deterministically from seed
  v_arena_index := (ABS((v_new_battle_seed::text).hashtext()) % 8);
  v_new_arena_id := CASE v_arena_index
    WHEN 0 THEN 'pewter-city'
    WHEN 1 THEN 'cerulean-city'
    WHEN 2 THEN 'vermilion-city'
    WHEN 3 THEN 'celadon-city'
    WHEN 4 THEN 'fuchsia-city'
    WHEN 5 THEN 'saffron-city'
    WHEN 6 THEN 'cinnabar-island'
    ELSE 'viridian-city'
  END;
  
  -- Create match
  INSERT INTO matches (
    id,
    player_a_id,
    player_a_username,
    player_a_trainer_id,
    player_b_id,
    entry_fee_sol,
    status,
    game_mode,
    room_id,
    team_a,
    player_a_locked_order,
    team_b,
    battle_seed,
    arena_id,
    idempotency_key,
    expires_at,
    created_at
  ) VALUES (
    v_new_match_id,
    p_user_id,
    v_profile.username,
    v_profile.current_trainer_id,
    NULL,
    p_entry_fee,
    'queueing',
    'paid_pvp',
    p_room_id,
    v_profile.current_team,
    v_profile.current_locked_order,
    NULL,
    v_new_battle_seed,
    v_new_arena_id,
    gen_random_uuid()::text,
    now() + interval '5 minutes',
    now()
  );
  
  INSERT INTO audit_log (user_id, match_id, event_type, amount_sol, metadata)
  VALUES (
    p_user_id,
    v_new_match_id,
    'wager_locked',
    p_entry_fee,
    jsonb_build_object('role', 'player_a', 'room_id', p_room_id, 'source', 'atomic_matchmaking_v2')
  );
  
  RAISE NOTICE '[Matchmaking] Created match % with arena % for user %', v_new_match_id, v_new_arena_id, p_user_id;
  
  RETURN get_canonical_match_payload(v_new_match_id, p_user_id);
END;
$$;

GRANT EXECUTE ON FUNCTION atomic_join_or_create_paid_match_v2 TO authenticated;
