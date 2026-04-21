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
  SELECT * INTO v_match FROM matches WHERE id = p_match_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'MATCH_NOT_FOUND', 'message', 'Match not found');
  END IF;
  
  IF v_match.player_a_id != p_requesting_user_id AND v_match.player_b_id != p_requesting_user_id THEN
    RETURN jsonb_build_object('error', 'FORBIDDEN', 'message', 'Not a player in this match');
  END IF;
  
  v_my_role := CASE 
    WHEN v_match.player_a_id = p_requesting_user_id THEN 'player_a'
    ELSE 'player_b'
  END;
  
  SELECT username, current_trainer_id INTO v_player_a_profile
  FROM profiles WHERE id = v_match.player_a_id;
  
  IF v_match.player_b_id IS NOT NULL THEN
    SELECT username, current_trainer_id INTO v_player_b_profile
    FROM profiles WHERE id = v_match.player_b_id;
  END IF;
  
  v_response_status := CASE
    WHEN v_match.player_b_id IS NULL THEN 'queueing'
    WHEN v_match.status = 'matched' OR v_match.status = 'arena_reveal' THEN 'arena_ready'
    WHEN v_match.status = 'battle_ready' THEN 'battle_ready'
    WHEN v_match.status = 'settlement_pending' THEN 'battle_ready'
    ELSE v_match.status
  END;
  
  IF v_response_status = 'queueing' THEN
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
  
  v_opponent := jsonb_build_object(
    'userId', CASE WHEN v_my_role = 'player_a' THEN v_match.player_b_id ELSE v_match.player_a_id END,
    'username', CASE WHEN v_my_role = 'player_a' THEN v_player_b_profile.username ELSE v_player_a_profile.username END,
    'trainerId', CASE WHEN v_my_role = 'player_a' THEN v_match.player_b_trainer_id ELSE v_match.player_a_trainer_id END
  );
  
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
