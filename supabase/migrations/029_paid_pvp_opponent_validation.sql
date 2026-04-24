-- ═══════════════════════════════════════════════════════════════
-- PAID PVP OPPONENT VALIDATION
-- 
-- CRITICAL: Prevent paid PvP matches from silently falling back to AI
-- 
-- This migration adds:
-- 1. Server-side validation that battle_ready requires BOTH real players
-- 2. Database constraints preventing NULL opponent in paid matches
-- 3. Enhanced get_canonical_match_payload with validation
-- ═══════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────
-- Step 1: Add check constraint - paid PvP MUST have both players
-- ───────────────────────────────────────────────────────────────

-- Drop existing constraint if exists
ALTER TABLE matches DROP CONSTRAINT IF EXISTS chk_paid_pvp_requires_both_players;

-- Add constraint: If game_mode='paid_pvp' and status in battle states, both players required
ALTER TABLE matches 
ADD CONSTRAINT chk_paid_pvp_requires_both_players 
CHECK (
  -- Allow queueing with only player_a
  (game_mode = 'paid_pvp' AND status = 'queueing' AND player_a_id IS NOT NULL)
  OR
  -- For all other statuses in paid PvP, BOTH players required
  (game_mode = 'paid_pvp' AND status != 'queueing' AND player_a_id IS NOT NULL AND player_b_id IS NOT NULL)
  OR
  -- Non-paid modes can be anything
  (game_mode != 'paid_pvp')
);

COMMENT ON CONSTRAINT chk_paid_pvp_requires_both_players ON matches IS
'CRITICAL: Paid PvP matches MUST have both real players before transitioning from queueing status. Prevents AI fallback.';

-- ───────────────────────────────────────────────────────────────
-- Step 2: Enhanced canonical payload with validation
-- ───────────────────────────────────────────────────────────────

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
BEGIN
  -- Fetch match
  SELECT * INTO v_match FROM matches WHERE id = p_match_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'MATCH_NOT_FOUND', 'message', 'Match does not exist');
  END IF;
  
  -- Verify requesting user is a player
  IF v_match.player_a_id != p_requesting_user_id AND v_match.player_b_id != p_requesting_user_id THEN
    RETURN jsonb_build_object('error', 'FORBIDDEN', 'message', 'Not a player in this match');
  END IF;
  
  -- ═══════════════════════════════════════════════════════════════
  -- CRITICAL VALIDATION: Paid PvP MUST have both players
  -- ═══════════════════════════════════════════════════════════════
  
  IF v_match.game_mode = 'paid_pvp' THEN
    -- In queueing status, only player_a is required
    IF v_match.status = 'queueing' THEN
      IF v_match.player_a_id IS NULL THEN
        RETURN jsonb_build_object(
          'error', 'INVALID_MATCH_STATE',
          'message', 'Paid PvP match in queueing status missing player_a_id',
          'details', jsonb_build_object('matchId', p_match_id, 'status', v_match.status)
        );
      END IF;
    ELSE
      -- For ALL other statuses (matched, battle_ready, etc), BOTH players required
      IF v_match.player_a_id IS NULL OR v_match.player_b_id IS NULL THEN
        RETURN jsonb_build_object(
          'error', 'INVALID_MATCH_STATE',
          'message', 'Paid PvP match missing player IDs - AI fallback is FORBIDDEN',
          'details', jsonb_build_object(
            'matchId', p_match_id,
            'status', v_match.status,
            'playerAId', v_match.player_a_id,
            'playerBId', v_match.player_b_id,
            'criticalError', 'BOTH_PLAYERS_REQUIRED_IN_PAID_PVP'
          )
        );
      END IF;
    END IF;
  END IF;
  
  -- Determine role
  v_my_role := CASE 
    WHEN v_match.player_a_id = p_requesting_user_id THEN 'player_a'
    ELSE 'player_b'
  END;
  
  -- Fetch player profiles (with validation)
  SELECT id, username, current_trainer_id INTO v_player_a_profile
  FROM profiles WHERE id = v_match.player_a_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'error', 'PLAYER_A_PROFILE_NOT_FOUND',
      'message', 'Player A profile does not exist',
      'details', jsonb_build_object('playerId', v_match.player_a_id)
    );
  END IF;
  
  -- For non-queueing paid matches, player_b profile MUST exist
  IF v_match.game_mode = 'paid_pvp' AND v_match.status != 'queueing' THEN
    SELECT id, username, current_trainer_id INTO v_player_b_profile
    FROM profiles WHERE id = v_match.player_b_id;
    
    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'error', 'PLAYER_B_PROFILE_NOT_FOUND',
        'message', 'Player B profile does not exist - paid PvP cannot proceed',
        'details', jsonb_build_object(
          'playerId', v_match.player_b_id,
          'matchId', p_match_id,
          'criticalError', 'OPPONENT_PROFILE_MISSING'
        )
      );
    END IF;
  ELSE
    -- For queueing matches, player_b might not exist yet
    SELECT id, username, current_trainer_id INTO v_player_b_profile
    FROM profiles WHERE id = v_match.player_b_id;
  END IF;
  
  -- Build opponent object (only if opponent exists)
  IF v_my_role = 'player_a' AND v_match.player_b_id IS NOT NULL THEN
    v_opponent := jsonb_build_object(
      'userId', v_match.player_b_id,
      'username', v_player_b_profile.username,
      'trainerId', v_match.player_b_trainer_id
    );
  ELSIF v_my_role = 'player_b' AND v_match.player_a_id IS NOT NULL THEN
    v_opponent := jsonb_build_object(
      'userId', v_match.player_a_id,
      'username', v_player_a_profile.username,
      'trainerId', v_match.player_a_trainer_id
    );
  ELSE
    v_opponent := NULL;
  END IF;
  
  -- Return canonical payload with success=true
  RETURN jsonb_build_object(
    'success', true,
    'matchId', v_match.id,
    'roomId', v_match.room_id,
    'status', v_match.status,
    'arenaId', v_match.arena_id,
    'battleSeed', v_match.battle_seed,
    'entryFeeSol', v_match.entry_fee_sol,
    'playerA', jsonb_build_object(
      'userId', v_match.player_a_id,
      'username', v_match.player_a_username,
      'trainerId', v_match.player_a_trainer_id,
      'team', v_match.team_a,
      'lockedOrder', v_match.player_a_locked_order
    ),
    'playerB', CASE 
      WHEN v_match.player_b_id IS NOT NULL THEN
        jsonb_build_object(
          'userId', v_match.player_b_id,
          'username', v_match.player_b_username,
          'trainerId', v_match.player_b_trainer_id,
          'team', v_match.team_b,
          'lockedOrder', v_match.player_b_locked_order
        )
      ELSE NULL
    END,
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

COMMENT ON FUNCTION get_canonical_match_payload IS
'Enhanced with validation: Paid PvP matches MUST have both real players. Returns error if opponent data missing.';

-- ───────────────────────────────────────────────────────────────
-- Step 3: Validation function for use in triggers
-- ───────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION validate_paid_pvp_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only validate paid PvP matches
  IF NEW.game_mode != 'paid_pvp' THEN
    RETURN NEW;
  END IF;
  
  -- If transitioning FROM queueing TO any other status
  IF OLD.status = 'queueing' AND NEW.status != 'queueing' THEN
    -- MUST have both players
    IF NEW.player_a_id IS NULL OR NEW.player_b_id IS NULL THEN
      RAISE EXCEPTION 'PAID_PVP_TRANSITION_ERROR: Cannot transition from queueing to % without both players (A: %, B: %)',
        NEW.status, NEW.player_a_id, NEW.player_b_id;
    END IF;
    
    -- Validate both profiles exist
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = NEW.player_a_id) THEN
      RAISE EXCEPTION 'PAID_PVP_PLAYER_A_PROFILE_MISSING: Player A profile does not exist (id: %)', NEW.player_a_id;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = NEW.player_b_id) THEN
      RAISE EXCEPTION 'PAID_PVP_PLAYER_B_PROFILE_MISSING: Player B profile does not exist (id: %)', NEW.player_b_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trg_validate_paid_pvp ON matches;

-- Create trigger
CREATE TRIGGER trg_validate_paid_pvp
  BEFORE UPDATE ON matches
  FOR EACH ROW
  EXECUTE FUNCTION validate_paid_pvp_transition();

COMMENT ON TRIGGER trg_validate_paid_pvp ON matches IS
'CRITICAL: Prevents paid PvP matches from transitioning to battle states without both real players';

-- ───────────────────────────────────────────────────────────────
-- Step 4: Add index for faster validation queries
-- ───────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_matches_paid_pvp_validation 
ON matches(game_mode, status, player_a_id, player_b_id)
WHERE game_mode = 'paid_pvp';

COMMENT ON INDEX idx_matches_paid_pvp_validation IS
'Optimizes validation queries for paid PvP opponent existence checks';
