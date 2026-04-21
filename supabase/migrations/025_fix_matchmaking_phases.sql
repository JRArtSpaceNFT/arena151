-- Fix matchmaking to support proper 2-phase flow
-- Phase 1: queueing (minimal data, no arena/seed/opponent)
-- Phase 2: battle_ready (full data, both players matched)

-- ═══════════════════════════════════════════════════════════════
-- Update get_canonical_match_payload to return phase-appropriate data
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_canonical_match_payload(
  p_match_id UUID,
  p_requesting_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_match RECORD;
  v_player_a_profile RECORD;
  v_player_b_profile RECORD;
  v_my_role TEXT;
  v_opponent JSONB;
  v_response_status TEXT;
BEGIN
  -- Fetch match
  SELECT * INTO v_match FROM matches WHERE id = p_match_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'MATCH_NOT_FOUND', 'message', 'Match not found');
  END IF;
  
  -- Verify requesting user is a player
  IF v_match.player_a_id != p_requesting_user_id AND v_match.player_b_id != p_requesting_user_id THEN
    RETURN jsonb_build_object('error', 'FORBIDDEN', 'message', 'Not a player in this match');
  END IF;
  
  -- Determine role
  v_my_role := CASE 
    WHEN v_match.player_a_id = p_requesting_user_id THEN 'player_a'
    ELSE 'player_b'
  END;
  
  -- Fetch player profiles
  SELECT username, current_trainer_id INTO v_player_a_profile
  FROM profiles WHERE id = v_match.player_a_id;
  
  IF v_match.player_b_id IS NOT NULL THEN
    SELECT username, current_trainer_id INTO v_player_b_profile
    FROM profiles WHERE id = v_match.player_b_id;
  END IF;
  
  -- Determine response status based on match state
  -- "queueing" = waiting for player_b
  -- "matched_waiting_lock" = both players joined, waiting for locks (UNUSED in bypass mode)
  -- "arena_ready" = both players ready, arena assigned
  -- "battle_ready" = all acks received, ready to fight
  v_response_status := CASE
    WHEN v_match.player_b_id IS NULL THEN 'queueing'
    WHEN v_match.status = 'matched' OR v_match.status = 'arena_reveal' THEN 'arena_ready'
    WHEN v_match.status = 'battle_ready' THEN 'battle_ready'
    WHEN v_match.status = 'settlement_pending' THEN 'battle_ready' -- Allow resume
    ELSE v_match.status
  END;
  
  RAISE NOTICE '[get_canonical_match_payload] matchId=% | dbStatus=% | responseStatus=% | playerB=%',
    p_match_id, v_match.status, v_response_status, v_match.player_b_id;
  
  -- PHASE 1: QUEUEING RESPONSE
  -- Return minimal payload while waiting for player_b
  IF v_response_status = 'queueing' THEN
    RAISE NOTICE '[get_canonical_match_payload] Returning QUEUEING response';
    RETURN jsonb_build_object(
      'success', true,
      'matchId', v_match.id,
      'status', 'queueing',
      'myRole', v_my_role,
      'roomId', v_match.room_id,
      'entryFeeSol', v_match.entry_fee_sol,
      'arenaId', NULL,
      'battleSeed', NULL,
      'opponent', NULL,
      'playerA', jsonb_build_object(
        'userId', v_match.player_a_id,
        'username', v_match.player_a_username,
        'trainerId', v_match.player_a_trainer_id,
        'team', v_match.team_a,
        'lockedOrder', v_match.player_a_locked_order
      ),
      'playerB', NULL,
      'acks', jsonb_build_object(
        'playerAMatchAck', false,
        'playerBMatchAck', false,
        'playerAArenaAck', false,
        'playerBArenaAck', false
      )
    );
  END IF;
  
  -- PHASE 2: BATTLE_READY RESPONSE
  -- Return full payload with opponent, arena, seed
  -- Build opponent object
  v_opponent := jsonb_build_object(
    'userId', CASE WHEN v_my_role = 'player_a' THEN v_match.player_b_id ELSE v_match.player_a_id END,
    'username', CASE WHEN v_my_role = 'player_a' THEN v_player_b_profile.username ELSE v_player_a_profile.username END,
    'trainerId', CASE WHEN v_my_role = 'player_a' THEN v_match.player_b_trainer_id ELSE v_match.player_a_trainer_id END
  );
  
  RAISE NOTICE '[get_canonical_match_payload] Returning BATTLE_READY response';
  RETURN jsonb_build_object(
    'success', true,
    'matchId', v_match.id,
    'status', v_response_status,
    'arenaId', v_match.arena_id,
    'battleSeed', v_match.battle_seed,
    'roomId', v_match.room_id,
    'entryFeeSol', v_match.entry_fee_sol,
    'playerA', jsonb_build_object(
      'userId', v_match.player_a_id,
      'username', v_match.player_a_username,
      'trainerId', v_match.player_a_trainer_id,
      'team', v_match.team_a,
      'lockedOrder', v_match.player_a_locked_order
    ),
    'playerB', jsonb_build_object(
      'userId', v_match.player_b_id,
      'username', v_match.player_b_username,
      'trainerId', v_match.player_b_trainer_id,
      'team', v_match.team_b,
      'lockedOrder', v_match.player_b_locked_order
    ),
    'myRole', v_my_role,
    'opponent', v_opponent,
    'acks', jsonb_build_object(
      'playerAMatchAck', COALESCE(v_match.player_a_match_ack, false),
      'playerBMatchAck', COALESCE(v_match.player_b_match_ack, false),
      'playerAArenaAck', COALESCE(v_match.player_a_arena_ack, false),
      'playerBArenaAck', COALESCE(v_match.player_b_arena_ack, false)
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_canonical_match_payload TO authenticated;

-- ═══════════════════════════════════════════════════════════════
-- Add detailed logging to atomic_join_or_create_paid_match_v2
-- ═══════════════════════════════════════════════════════════════

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
  v_candidate_room_id      TEXT;
  v_claimed_rows           INTEGER;
  v_new_match_id           UUID;
  v_new_battle_seed        TEXT;
  v_new_arena_id           TEXT;
  v_lock_success           JSONB;
  v_arena_index            INTEGER;
  v_player_a_username      TEXT;
  v_player_a_trainer_id    TEXT;
BEGIN
  RAISE NOTICE '[Matchmaking V2] ========== START ==========';
  RAISE NOTICE '[Matchmaking V2] Requested: userId=% | roomId=% | entryFee=%', p_user_id, p_room_id, p_entry_fee;
  
  -- ─────────────────────────────────────────────────────────────
  -- STEP 1: Get profile (SKIP team lock validation, auto-populate)
  -- ─────────────────────────────────────────────────────────────
  SELECT 
    id, username, current_trainer_id, current_team, current_locked_order, team_locked_at, balance, locked_balance
  INTO v_profile
  FROM profiles
  WHERE id = p_user_id;
  
  IF NOT FOUND THEN
    RAISE NOTICE '[Matchmaking V2] ❌ USER_NOT_FOUND';
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
  
  RAISE NOTICE '[Matchmaking V2] Profile: username=% | trainer=% | team=%', 
    v_profile.username, v_profile.current_trainer_id, v_profile.current_team;
  
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
    RAISE NOTICE '[Matchmaking V2] ✅ RESUME: User already has active match %', v_existing_match_id;
    RETURN get_canonical_match_payload(v_existing_match_id, p_user_id);
  END IF;
  
  -- ─────────────────────────────────────────────────────────────
  -- STEP 3: Try to join existing queueing match IN SAME ROOM
  -- ─────────────────────────────────────────────────────────────
  RAISE NOTICE '[Matchmaking V2] 🔍 Searching for queueing matches in roomId=%', p_room_id;
  
  SELECT id, player_a_id, battle_seed, arena_id, room_id
  INTO v_candidate_match_id, v_candidate_player_a, v_candidate_battle_seed, v_candidate_arena_id, v_candidate_room_id
  FROM matches
  WHERE status = 'queueing'
    AND game_mode = 'paid_pvp'
    AND player_b_id IS NULL
    AND player_a_id != p_user_id
    AND room_id = p_room_id  -- CRITICAL: Must match requested room
    AND entry_fee_sol = p_entry_fee
    AND (expires_at IS NULL OR expires_at > now())
  ORDER BY created_at ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1;
  
  IF v_candidate_match_id IS NOT NULL THEN
    RAISE NOTICE '[Matchmaking V2] 🎯 Found candidate match:';
    RAISE NOTICE '[Matchmaking V2]   - matchId: %', v_candidate_match_id;
    RAISE NOTICE '[Matchmaking V2]   - playerA: %', v_candidate_player_a;
    RAISE NOTICE '[Matchmaking V2]   - stored roomId: %', v_candidate_room_id;
    RAISE NOTICE '[Matchmaking V2]   - stored arenaId: %', v_candidate_arena_id;
    RAISE NOTICE '[Matchmaking V2]   - stored battleSeed: %', v_candidate_battle_seed;
    
    -- Verify room match (sanity check - should always pass due to WHERE clause)
    IF v_candidate_room_id != p_room_id THEN
      RAISE WARNING '[Matchmaking V2] ⚠️  CROSS-ROOM LEAK DETECTED! Requested=%, Stored=% - REJECTING', p_room_id, v_candidate_room_id;
      -- Don't join this match - fall through to create new one
    ELSE
      -- Lock funds for player_b
      v_lock_success := lock_player_funds(p_user_id, p_entry_fee);
      IF NOT (v_lock_success->>'success')::boolean THEN
        RAISE NOTICE '[Matchmaking V2] ❌ INSUFFICIENT_FUNDS';
        RETURN jsonb_build_object('success', false, 'error', 'INSUFFICIENT_FUNDS', 'details', v_lock_success);
      END IF;
      
      -- Get player_a username and trainer
      SELECT username, current_trainer_id INTO v_player_a_username, v_player_a_trainer_id
      FROM profiles WHERE id = v_candidate_player_a;
      
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
        RAISE NOTICE '[Matchmaking V2] ✅ JOINED: User % joined match % as player_b', p_user_id, v_candidate_match_id;
        
        INSERT INTO audit_log (user_id, match_id, event_type, amount_sol, metadata)
        VALUES (
          p_user_id,
          v_candidate_match_id,
          'wager_locked',
          p_entry_fee,
          jsonb_build_object('role', 'player_b', 'room_id', p_room_id, 'source', 'atomic_matchmaking_v2_join')
        );
        
        RETURN get_canonical_match_payload(v_candidate_match_id, p_user_id);
      ELSE
        -- Race condition - unlock and fall through
        RAISE NOTICE '[Matchmaking V2] ⚠️  RACE: match % was claimed by another player', v_candidate_match_id;
        PERFORM unlock_player_funds(p_user_id, p_entry_fee);
      END IF;
    END IF;
  ELSE
    RAISE NOTICE '[Matchmaking V2] 🔍 No queueing matches found in roomId=%', p_room_id;
  END IF;
  
  -- ─────────────────────────────────────────────────────────────
  -- STEP 4: Create new queueing match as player_a
  -- ─────────────────────────────────────────────────────────────
  RAISE NOTICE '[Matchmaking V2] 🆕 Creating new queueing match for user %', p_user_id;
  
  -- Lock funds
  v_lock_success := lock_player_funds(p_user_id, p_entry_fee);
  IF NOT (v_lock_success->>'success')::boolean THEN
    RAISE NOTICE '[Matchmaking V2] ❌ INSUFFICIENT_FUNDS';
    RETURN jsonb_build_object('success', false, 'error', 'INSUFFICIENT_FUNDS', 'details', v_lock_success);
  END IF;
  
  -- Generate IDs
  v_new_match_id := gen_random_uuid();
  v_new_battle_seed := gen_random_uuid()::text;
  
  -- Pre-select arena deterministically from seed (NOT from roomId)
  -- This is intentional - arena is cosmetic, roomId is for matchmaking tier
  v_arena_index := (ABS(hashtext(v_new_battle_seed)) % 8);
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
  
  RAISE NOTICE '[Matchmaking V2] 🎲 Generated:';
  RAISE NOTICE '[Matchmaking V2]   - matchId: %', v_new_match_id;
  RAISE NOTICE '[Matchmaking V2]   - battleSeed: %', v_new_battle_seed;
  RAISE NOTICE '[Matchmaking V2]   - arenaId: % (index %)', v_new_arena_id, v_arena_index;
  RAISE NOTICE '[Matchmaking V2]   - roomId: % (STORED)', p_room_id;
  
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
    p_room_id,  -- CRITICAL: Store requested roomId
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
    jsonb_build_object('role', 'player_a', 'room_id', p_room_id, 'source', 'atomic_matchmaking_v2_create')
  );
  
  RAISE NOTICE '[Matchmaking V2] ✅ CREATED: Match % with arena % in room %', v_new_match_id, v_new_arena_id, p_room_id;
  RAISE NOTICE '[Matchmaking V2] ========== END ==========';
  
  RETURN get_canonical_match_payload(v_new_match_id, p_user_id);
END;
$$;

GRANT EXECUTE ON FUNCTION atomic_join_or_create_paid_match_v2 TO authenticated;

-- ═══════════════════════════════════════════════════════════════
-- Add index to prevent cross-room matches
-- ═══════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_matches_queueing_by_room 
ON matches(room_id, status, created_at) 
WHERE status = 'queueing' AND player_b_id IS NULL;

-- Add a check constraint to prevent null room_id for paid_pvp matches
ALTER TABLE matches 
  DROP CONSTRAINT IF EXISTS matches_paid_pvp_room_required;

ALTER TABLE matches 
  ADD CONSTRAINT matches_paid_pvp_room_required 
  CHECK (game_mode != 'paid_pvp' OR room_id IS NOT NULL);
