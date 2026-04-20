-- Add player_b_id to atomic_join_or_create_paid_match response
-- This allows the frontend to fetch opponent profile

CREATE OR REPLACE FUNCTION atomic_join_or_create_paid_match(
  p_user_id      UUID,
  p_room_id      TEXT,
  p_entry_fee    NUMERIC,
  p_team_a       JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_existing_match_id      UUID;
  v_existing_battle_seed   TEXT;
  v_existing_status        TEXT;
  v_existing_team_a        JSONB;
  v_existing_team_b        JSONB;
  v_existing_winner_id     UUID;
  v_existing_player_a      UUID;
  v_existing_player_b      UUID;
  v_candidate_match_id     UUID;
  v_candidate_player_a     UUID;
  v_candidate_battle_seed  TEXT;
  v_claimed_rows           INTEGER;
  v_balance_before         NUMERIC;
  v_locked_before          NUMERIC;
  v_new_match_id           UUID;
  v_new_battle_seed        TEXT;
  v_lock_success           JSONB;
BEGIN
  -- ─────────────────────────────────────────────────────────────
  -- STEP 1: Check if user already has an active paid match
  -- (idempotency / duplicate protection)
  -- FIX: Only resume matches created in the last 30 minutes
  -- ─────────────────────────────────────────────────────────────
  SELECT id, battle_seed, status, team_a, team_b, winner_id, player_a_id, player_b_id
  INTO v_existing_match_id, v_existing_battle_seed, v_existing_status,
       v_existing_team_a, v_existing_team_b, v_existing_winner_id, v_existing_player_a, v_existing_player_b
  FROM public.matches
  WHERE (player_a_id = p_user_id OR player_b_id = p_user_id)
    AND room_id = p_room_id
    AND game_mode = 'paid_pvp'
    AND status IN ('forming', 'ready', 'settlement_pending')
    AND created_at > now() - interval '30 minutes'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_existing_match_id IS NOT NULL THEN
    -- User already has an active match in this room — return it (idempotent)
    RAISE NOTICE 'User % already has active match % in status %', p_user_id, v_existing_match_id, v_existing_status;
    RETURN jsonb_build_object(
      'success', true,
      'matchId', v_existing_match_id,
      'role', CASE WHEN v_existing_player_b = p_user_id THEN 'player_b' ELSE 'player_a' END,
      'status', v_existing_status,
      'battleSeed', v_existing_battle_seed,
      'entryFeeSol', p_entry_fee,
      'teamA', v_existing_team_a,
      'teamB', v_existing_team_b,
      'winnerId', v_existing_winner_id,
      'playerAId', v_existing_player_a,
      'playerBId', v_existing_player_b,
      'createdNew', false,
      'resumed', true
    );
  END IF;

  -- ─────────────────────────────────────────────────────────────
  -- STEP 2: Atomically claim one open match (if available)
  -- Using FOR UPDATE SKIP LOCKED to prevent race conditions
  -- ─────────────────────────────────────────────────────────────
  BEGIN
    -- Find and lock ONE candidate match
    SELECT id, player_a_id, battle_seed
    INTO v_candidate_match_id, v_candidate_player_a, v_candidate_battle_seed
    FROM public.matches
    WHERE status = 'forming'
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
      RAISE NOTICE 'Found candidate match % to join', v_candidate_match_id;

      -- Lock funds for player_b (current user)
      v_lock_success := lock_player_funds(p_user_id, p_entry_fee);
      
      IF NOT (v_lock_success->>'success')::boolean THEN
        RAISE NOTICE 'Failed to lock funds for player_b: %', v_lock_success;
        RETURN jsonb_build_object(
          'success', false,
          'error', 'INSUFFICIENT_FUNDS',
          'details', v_lock_success
        );
      END IF;

      -- Claim the match: set player_b, transition to 'ready'
      UPDATE public.matches
      SET 
        player_b_id = p_user_id,
        status = 'ready',
        joined_at = now(),
        updated_at = now()
      WHERE id = v_candidate_match_id;

      GET DIAGNOSTICS v_claimed_rows = ROW_COUNT;

      IF v_claimed_rows = 1 THEN
        RAISE NOTICE 'Successfully claimed match % as player_b', v_candidate_match_id;
        
        -- Audit log for player_b join
        INSERT INTO public.audit_log (user_id, match_id, event_type, amount_sol, metadata)
        VALUES (
          p_user_id,
          v_candidate_match_id,
          'wager_locked',
          p_entry_fee,
          jsonb_build_object(
            'role', 'player_b',
            'room_id', p_room_id,
            'source', 'atomic_matchmaking',
            'balance_before', v_lock_success->>'balance_before',
            'balance_after', v_lock_success->>'balance_after'
          )
        );

        RETURN jsonb_build_object(
          'success', true,
          'matchId', v_candidate_match_id,
          'role', 'player_b',
          'status', 'ready',
          'battleSeed', v_candidate_battle_seed,
          'entryFeeSol', p_entry_fee,
          'createdNew', false,
          'resumed', false,
          'playerAId', v_candidate_player_a,
          'playerBId', p_user_id
        );
      ELSE
        -- Race condition: match was claimed by someone else between SELECT and UPDATE
        -- Unlock funds and fall through to creation path
        RAISE NOTICE 'Race: match % was claimed by another player, unlocking funds', v_candidate_match_id;
        PERFORM unlock_player_funds(p_user_id, p_entry_fee);
      END IF;
    ELSE
      RAISE NOTICE 'No open matches found for room % entry_fee %', p_room_id, p_entry_fee;
    END IF;
  END;

  -- ─────────────────────────────────────────────────────────────
  -- STEP 3: No match available — create new match as player_a
  -- ─────────────────────────────────────────────────────────────
  RAISE NOTICE 'Creating new match as player_a for user %', p_user_id;

  -- Lock funds for player_a
  v_lock_success := lock_player_funds(p_user_id, p_entry_fee);
  
  IF NOT (v_lock_success->>'success')::boolean THEN
    RAISE NOTICE 'Failed to lock funds for player_a: %', v_lock_success;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INSUFFICIENT_FUNDS',
      'details', v_lock_success
    );
  END IF;

  -- Generate IDs
  v_new_match_id := gen_random_uuid();
  v_new_battle_seed := gen_random_uuid()::text;

  -- Create match
  INSERT INTO public.matches (
    id,
    player_a_id,
    player_b_id,
    entry_fee_sol,
    status,
    game_mode,
    room_id,
    team_a,
    team_b,
    battle_seed,
    idempotency_key,
    expires_at,
    created_at
  ) VALUES (
    v_new_match_id,
    p_user_id,
    NULL,
    p_entry_fee,
    'forming',
    'paid_pvp',
    p_room_id,
    p_team_a,
    NULL,
    v_new_battle_seed,
    gen_random_uuid()::text,
    now() + interval '5 minutes',
    now()
  );

  -- Audit log for player_a creation
  INSERT INTO public.audit_log (user_id, match_id, event_type, amount_sol, metadata)
  VALUES (
    p_user_id,
    v_new_match_id,
    'wager_locked',
    p_entry_fee,
    jsonb_build_object(
      'role', 'player_a',
      'room_id', p_room_id,
      'source', 'atomic_matchmaking',
      'balance_before', v_lock_success->>'balance_before',
      'balance_after', v_lock_success->>'balance_after'
    )
  );

  RAISE NOTICE 'Created new match % as player_a', v_new_match_id;

  RETURN jsonb_build_object(
    'success', true,
    'matchId', v_new_match_id,
    'role', 'player_a',
    'status', 'forming',
    'battleSeed', v_new_battle_seed,
    'entryFeeSol', p_entry_fee,
    'createdNew', true,
    'resumed', false,
    'playerAId', p_user_id,
    'playerBId', NULL
  );
END;
$$;
