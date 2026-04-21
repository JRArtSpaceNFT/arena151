-- Fix canonical match response contract
-- For queueing: playerB, opponent, battleSeed must be NULL
-- For matched/ready/battling/settled: all fields must be populated

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
  v_player_b JSONB;
  v_battle_seed TEXT;
BEGIN
  -- Fetch match
  SELECT * INTO v_match FROM matches WHERE id = p_match_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Match not found');
  END IF;
  
  -- Verify requesting user is a player
  IF v_match.player_a_id != p_requesting_user_id AND v_match.player_b_id != p_requesting_user_id THEN
    RETURN jsonb_build_object('error', 'Forbidden: not a player in this match');
  END IF;
  
  -- Determine role
  v_my_role := CASE 
    WHEN v_match.player_a_id = p_requesting_user_id THEN 'player_a'
    ELSE 'player_b'
  END;
  
  -- Fetch player A profile
  SELECT username, current_trainer_id INTO v_player_a_profile
  FROM profiles WHERE id = v_match.player_a_id;
  
  -- DISCRIMINATED UNION: Build response based on status
  IF v_match.status = 'queueing' THEN
    -- QUEUEING: playerB, opponent, battleSeed = null
    v_player_b := NULL;
    v_opponent := NULL;
    v_battle_seed := NULL;
  ELSE
    -- MATCHED/READY/BATTLING/SETTLED: all fields populated
    -- Fetch player B profile
    SELECT username, current_trainer_id INTO v_player_b_profile
    FROM profiles WHERE id = v_match.player_b_id;
    
    v_player_b := jsonb_build_object(
      'userId', v_match.player_b_id,
      'username', v_match.player_b_username,
      'trainerId', v_match.player_b_trainer_id,
      'team', v_match.team_b,
      'lockedOrder', v_match.player_b_locked_order
    );
    
    v_opponent := jsonb_build_object(
      'userId', CASE WHEN v_my_role = 'player_a' THEN v_match.player_b_id ELSE v_match.player_a_id END,
      'username', CASE WHEN v_my_role = 'player_a' THEN v_player_b_profile.username ELSE v_player_a_profile.username END,
      'trainerId', CASE WHEN v_my_role = 'player_a' THEN v_match.player_b_trainer_id ELSE v_match.player_a_trainer_id END
    );
    
    v_battle_seed := v_match.battle_seed;
  END IF;
  
  -- Return canonical payload
  RETURN jsonb_build_object(
    'matchId', v_match.id,
    'status', v_match.status,
    'arenaId', v_match.arena_id,
    'battleSeed', v_battle_seed,
    'entryFeeSol', v_match.entry_fee_sol,
    'playerA', jsonb_build_object(
      'userId', v_match.player_a_id,
      'username', v_match.player_a_username,
      'trainerId', v_match.player_a_trainer_id,
      'team', v_match.team_a,
      'lockedOrder', v_match.player_a_locked_order
    ),
    'playerB', v_player_b,
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
