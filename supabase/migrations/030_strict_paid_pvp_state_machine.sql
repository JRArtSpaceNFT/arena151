-- ═══════════════════════════════════════════════════════════════
-- STRICT PAID PVP STATE MACHINE
-- 
-- Server-controlled progression with atomic lineup locking
-- No client can skip ahead - all state transitions server-controlled
-- ═══════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────
-- Step 1: Enhanced match metadata for lineup locking
-- ───────────────────────────────────────────────────────────────

-- Add lineup lock tracking columns
ALTER TABLE matches 
ADD COLUMN IF NOT EXISTS player_a_lineup_locked BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS player_b_lineup_locked BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS player_a_lineup_locked_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS player_b_lineup_locked_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS arena_assigned_at TIMESTAMPTZ;

-- Add indexes for fast state queries
CREATE INDEX IF NOT EXISTS idx_matches_lineup_locks 
ON matches(id, player_a_lineup_locked, player_b_lineup_locked)
WHERE game_mode = 'paid_pvp';

COMMENT ON COLUMN matches.player_a_lineup_locked IS 
'TRUE when player A has submitted and locked their lineup';

COMMENT ON COLUMN matches.player_b_lineup_locked IS 
'TRUE when player B has submitted and locked their lineup';

-- ───────────────────────────────────────────────────────────────
-- Step 2: Strict state machine status enum
-- ───────────────────────────────────────────────────────────────

-- Document valid state transitions for paid PvP
COMMENT ON COLUMN matches.status IS 
'Strict state machine for paid PvP:
  queueing → matched (when player_b joins)
  matched → lineup_selection (both players ack match)
  lineup_selection → waiting_for_lineups (first player locks)
  waiting_for_lineups → both_lineups_locked (second player locks)
  both_lineups_locked → arena_assigned (server assigns arena atomically)
  arena_assigned → battle_ready (both players ack arena)
  battle_ready → settlement_pending (battle completes)
  settlement_pending → settled (payout complete)
  
  CRITICAL: Server controls all transitions. Clients only render based on status.';

-- ───────────────────────────────────────────────────────────────
-- Step 3: Atomic lineup lock + arena assignment
-- ───────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION atomic_lock_lineup_and_maybe_assign_arena(
  p_match_id UUID,
  p_user_id UUID,
  p_trainer_id TEXT,
  p_lineup_ids INTEGER[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_match RECORD;
  v_my_role TEXT;
  v_other_locked BOOLEAN;
  v_both_locked BOOLEAN;
  v_arena_id TEXT;
  v_arena_index INTEGER;
  v_new_status TEXT;
BEGIN
  -- ═══════════════════════════════════════════════════════════════
  -- STEP 1: Lock match row for update (prevents race conditions)
  -- ═══════════════════════════════════════════════════════════════
  
  SELECT * INTO v_match
  FROM matches
  WHERE id = p_match_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'MATCH_NOT_FOUND');
  END IF;
  
  -- Validate game mode
  IF v_match.game_mode != 'paid_pvp' THEN
    RETURN jsonb_build_object('error', 'NOT_PAID_PVP', 'gameMode', v_match.game_mode);
  END IF;
  
  -- Validate user is a player
  IF v_match.player_a_id != p_user_id AND v_match.player_b_id != p_user_id THEN
    RETURN jsonb_build_object('error', 'FORBIDDEN', 'message', 'Not a player in this match');
  END IF;
  
  -- ═══════════════════════════════════════════════════════════════
  -- STEP 2: Determine role and validate opponent exists
  -- ═══════════════════════════════════════════════════════════════
  
  v_my_role := CASE 
    WHEN v_match.player_a_id = p_user_id THEN 'player_a'
    ELSE 'player_b'
  END;
  
  -- CRITICAL: Both players MUST exist in paid PvP
  IF v_match.player_a_id IS NULL OR v_match.player_b_id IS NULL THEN
    RETURN jsonb_build_object(
      'error', 'INVALID_MATCH_STATE',
      'message', 'Paid PvP requires both players',
      'playerAId', v_match.player_a_id,
      'playerBId', v_match.player_b_id
    );
  END IF;
  
  -- ═══════════════════════════════════════════════════════════════
  -- STEP 3: Validate lineup
  -- ═══════════════════════════════════════════════════════════════
  
  IF p_lineup_ids IS NULL OR array_length(p_lineup_ids, 1) < 3 THEN
    RETURN jsonb_build_object('error', 'INVALID_LINEUP', 'message', 'Lineup must have at least 3 Pokemon');
  END IF;
  
  -- ═══════════════════════════════════════════════════════════════
  -- STEP 4: Save lineup to correct side
  -- ═══════════════════════════════════════════════════════════════
  
  IF v_my_role = 'player_a' THEN
    -- Check if already locked
    IF v_match.player_a_lineup_locked THEN
      RETURN jsonb_build_object('error', 'ALREADY_LOCKED', 'message', 'Player A lineup already locked');
    END IF;
    
    UPDATE matches
    SET 
      player_a_trainer_id = p_trainer_id,
      player_a_locked_order = p_lineup_ids,
      player_a_lineup_locked = true,
      player_a_lineup_locked_at = now(),
      updated_at = now()
    WHERE id = p_match_id;
    
    v_other_locked := v_match.player_b_lineup_locked;
    
  ELSE -- player_b
    -- Check if already locked
    IF v_match.player_b_lineup_locked THEN
      RETURN jsonb_build_object('error', 'ALREADY_LOCKED', 'message', 'Player B lineup already locked');
    END IF;
    
    UPDATE matches
    SET 
      player_b_trainer_id = p_trainer_id,
      player_b_locked_order = p_lineup_ids,
      player_b_lineup_locked = true,
      player_b_lineup_locked_at = now(),
      updated_at = now()
    WHERE id = p_match_id;
    
    v_other_locked := v_match.player_a_lineup_locked;
  END IF;
  
  -- ═══════════════════════════════════════════════════════════════
  -- STEP 5: Check if both lineups are now locked
  -- ═══════════════════════════════════════════════════════════════
  
  v_both_locked := (
    (v_my_role = 'player_a' AND v_other_locked) OR
    (v_my_role = 'player_b' AND v_other_locked)
  );
  
  -- ═══════════════════════════════════════════════════════════════
  -- STEP 6: If both locked, assign arena (ATOMIC)
  -- ═══════════════════════════════════════════════════════════════
  
  IF v_both_locked AND v_match.arena_id IS NULL THEN
    -- Deterministically choose arena from battle seed
    v_arena_index := (ABS(hashtext(v_match.battle_seed)) % 8);
    v_arena_id := CASE v_arena_index
      WHEN 0 THEN 'pewter-city'
      WHEN 1 THEN 'cerulean-city'
      WHEN 2 THEN 'vermilion-city'
      WHEN 3 THEN 'celadon-city'
      WHEN 4 THEN 'fuchsia-city'
      WHEN 5 THEN 'saffron-city'
      WHEN 6 THEN 'cinnabar-island'
      ELSE 'viridian-city'
    END;
    
    v_new_status := 'arena_assigned';
    
    UPDATE matches
    SET 
      arena_id = v_arena_id,
      arena_assigned_at = now(),
      status = v_new_status,
      updated_at = now()
    WHERE id = p_match_id;
    
  ELSIF v_both_locked AND v_match.arena_id IS NOT NULL THEN
    -- Arena already assigned (race condition - other player assigned it)
    v_arena_id := v_match.arena_id;
    v_new_status := v_match.status;
    
  ELSE
    -- Only one lineup locked - stay in waiting state
    v_new_status := CASE
      WHEN v_match.status = 'matched' THEN 'waiting_for_lineups'
      ELSE v_match.status
    END;
    
    UPDATE matches
    SET 
      status = v_new_status,
      updated_at = now()
    WHERE id = p_match_id AND status != v_new_status;
  END IF;
  
  -- ═══════════════════════════════════════════════════════════════
  -- STEP 7: Return updated match state
  -- ═══════════════════════════════════════════════════════════════
  
  RETURN jsonb_build_object(
    'success', true,
    'matchId', p_match_id,
    'myRole', v_my_role,
    'myLineupLocked', true,
    'playerALineupLocked', CASE WHEN v_my_role = 'player_a' THEN true ELSE v_other_locked END,
    'playerBLineupLocked', CASE WHEN v_my_role = 'player_b' THEN true ELSE v_other_locked END,
    'bothLineupsLocked', v_both_locked,
    'arenaId', v_arena_id,
    'arenaAssigned', v_arena_id IS NOT NULL,
    'status', v_new_status
  );
END;
$$;

GRANT EXECUTE ON FUNCTION atomic_lock_lineup_and_maybe_assign_arena TO authenticated;

COMMENT ON FUNCTION atomic_lock_lineup_and_maybe_assign_arena IS
'ATOMIC: Lock player lineup and assign arena if both lineups now locked. Prevents race conditions.';

-- ───────────────────────────────────────────────────────────────
-- Step 4: Enhanced canonical payload with strict validation
-- ───────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_canonical_match_payload_strict(
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
  v_missing_fields TEXT[];
BEGIN
  -- Load match
  SELECT * INTO v_match FROM matches WHERE id = p_match_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'MATCH_NOT_FOUND');
  END IF;
  
  -- Verify requesting user is a player
  IF v_match.player_a_id != p_requesting_user_id AND v_match.player_b_id != p_requesting_user_id THEN
    RETURN jsonb_build_object('error', 'FORBIDDEN');
  END IF;
  
  -- ═══════════════════════════════════════════════════════════════
  -- STRICT VALIDATION: Collect all missing required fields
  -- ═══════════════════════════════════════════════════════════════
  
  v_missing_fields := ARRAY[]::TEXT[];
  
  IF v_match.game_mode = 'paid_pvp' THEN
    -- Player IDs
    IF v_match.player_a_id IS NULL THEN
      v_missing_fields := array_append(v_missing_fields, 'player_a_id');
    END IF;
    IF v_match.player_b_id IS NULL THEN
      v_missing_fields := array_append(v_missing_fields, 'player_b_id');
    END IF;
    
    -- Battle seed
    IF v_match.battle_seed IS NULL THEN
      v_missing_fields := array_append(v_missing_fields, 'battle_seed');
    END IF;
    
    -- For battle_ready status, require everything
    IF v_match.status IN ('arena_assigned', 'battle_ready', 'settlement_pending') THEN
      IF v_match.arena_id IS NULL THEN
        v_missing_fields := array_append(v_missing_fields, 'arena_id');
      END IF;
      IF NOT v_match.player_a_lineup_locked THEN
        v_missing_fields := array_append(v_missing_fields, 'player_a_lineup_locked');
      END IF;
      IF NOT v_match.player_b_lineup_locked THEN
        v_missing_fields := array_append(v_missing_fields, 'player_b_lineup_locked');
      END IF;
      IF v_match.player_a_locked_order IS NULL OR array_length(v_match.player_a_locked_order, 1) < 3 THEN
        v_missing_fields := array_append(v_missing_fields, 'player_a_locked_order');
      END IF;
      IF v_match.player_b_locked_order IS NULL OR array_length(v_match.player_b_locked_order, 1) < 3 THEN
        v_missing_fields := array_append(v_missing_fields, 'player_b_locked_order');
      END IF;
    END IF;
    
    -- If any fields missing, return error
    IF array_length(v_missing_fields, 1) > 0 THEN
      RETURN jsonb_build_object(
        'error', 'INCOMPLETE_MATCH_DATA',
        'message', 'Cannot proceed - required fields missing',
        'missingFields', array_to_json(v_missing_fields),
        'matchId', p_match_id,
        'status', v_match.status,
        'gameMode', v_match.game_mode
      );
    END IF;
  END IF;
  
  -- ═══════════════════════════════════════════════════════════════
  -- VALIDATE PROFILES EXIST
  -- ═══════════════════════════════════════════════════════════════
  
  SELECT id, username, display_name, avatar, current_trainer_id
  INTO v_player_a_profile
  FROM profiles WHERE id = v_match.player_a_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'error', 'PLAYER_A_PROFILE_NOT_FOUND',
      'playerId', v_match.player_a_id
    );
  END IF;
  
  SELECT id, username, display_name, avatar, current_trainer_id
  INTO v_player_b_profile
  FROM profiles WHERE id = v_match.player_b_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'error', 'PLAYER_B_PROFILE_NOT_FOUND',
      'playerId', v_match.player_b_id
    );
  END IF;
  
  -- Determine role
  v_my_role := CASE 
    WHEN v_match.player_a_id = p_requesting_user_id THEN 'player_a'
    ELSE 'player_b'
  END;
  
  -- Build opponent object (ALWAYS exists for matched paid PvP)
  v_opponent := jsonb_build_object(
    'userId', CASE WHEN v_my_role = 'player_a' THEN v_match.player_b_id ELSE v_match.player_a_id END,
    'username', CASE WHEN v_my_role = 'player_a' THEN v_player_b_profile.username ELSE v_player_a_profile.username END,
    'displayName', CASE WHEN v_my_role = 'player_a' THEN v_player_b_profile.display_name ELSE v_player_a_profile.display_name END,
    'avatar', CASE WHEN v_my_role = 'player_a' THEN v_player_b_profile.avatar ELSE v_player_a_profile.avatar END,
    'trainerId', CASE WHEN v_my_role = 'player_a' THEN v_match.player_b_trainer_id ELSE v_match.player_a_trainer_id END
  );
  
  -- Return complete payload
  RETURN jsonb_build_object(
    'success', true,
    'matchId', v_match.id,
    'roomId', v_match.room_id,
    'status', v_match.status,
    'gameMode', v_match.game_mode,
    'arenaId', v_match.arena_id,
    'battleSeed', v_match.battle_seed,
    'entryFeeSol', v_match.entry_fee_sol,
    'playerA', jsonb_build_object(
      'userId', v_match.player_a_id,
      'username', v_player_a_profile.username,
      'displayName', v_player_a_profile.display_name,
      'avatar', v_player_a_profile.avatar,
      'trainerId', v_match.player_a_trainer_id,
      'lineupLocked', v_match.player_a_lineup_locked,
      'lockedOrder', v_match.player_a_locked_order
    ),
    'playerB', jsonb_build_object(
      'userId', v_match.player_b_id,
      'username', v_player_b_profile.username,
      'displayName', v_player_b_profile.display_name,
      'avatar', v_player_b_profile.avatar,
      'trainerId', v_match.player_b_trainer_id,
      'lineupLocked', v_match.player_b_lineup_locked,
      'lockedOrder', v_match.player_b_locked_order
    ),
    'myRole', v_my_role,
    'opponent', v_opponent,
    'bothLineupsLocked', (v_match.player_a_lineup_locked AND v_match.player_b_lineup_locked),
    'arenaAssigned', v_match.arena_id IS NOT NULL
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_canonical_match_payload_strict TO authenticated;

COMMENT ON FUNCTION get_canonical_match_payload_strict IS
'Enhanced payload with strict validation - returns error if any required field missing for current status';
