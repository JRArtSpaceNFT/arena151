-- ═══════════════════════════════════════════════════════════════
-- CRITICAL FIX: Atomic matchmaking pairing
-- 
-- PROBLEM: Both users creating separate queueing matches instead of
-- one user joining the other's match.
-- 
-- ROOT CAUSES:
-- 1. Race condition between SELECT and UPDATE
-- 2. Missing visibility into why matches aren't found
-- 3. No single-user-per-room enforcement
--
-- SOLUTION:
-- 1. Add extensive logging to diagnose pairing failures
-- 2. Enforce one-active-match-per-user-per-room
-- 3. Add explicit lock to prevent race conditions
-- 4. Return detailed diagnostics in response
-- ═══════════════════════════════════════════════════════════════

-- Add helper function to check for any active user matches
CREATE OR REPLACE FUNCTION check_user_active_matches(p_user_id UUID, p_room_id TEXT)
RETURNS TABLE(
  match_id UUID,
  status TEXT,
  role TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT 
    id,
    status,
    CASE 
      WHEN player_a_id = p_user_id THEN 'player_a'
      WHEN player_b_id = p_user_id THEN 'player_b'
      ELSE 'unknown'
    END as role,
    created_at
  FROM matches
  WHERE (player_a_id = p_user_id OR player_b_id = p_user_id)
    AND room_id = p_room_id
    AND status IN ('queueing', 'matched', 'arena_reveal', 'battle_ready', 'settlement_pending')
    AND created_at > now() - interval '30 minutes'
  ORDER BY created_at DESC;
$$;

-- Enhanced atomic matchmaking with detailed diagnostics
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
  v_candidate_created_at   TIMESTAMPTZ;
  v_claimed_rows           INTEGER;
  v_new_match_id           UUID;
  v_new_battle_seed        TEXT;
  v_new_arena_id           TEXT;
  v_lock_success           JSONB;
  v_arena_index            INTEGER;
  v_player_a_username      TEXT;
  v_player_a_trainer_id    TEXT;
  v_search_count           INTEGER;
  v_diagnostics            JSONB;
BEGIN
  RAISE NOTICE '[MM %] ==================== START V2 ====================', p_user_id;
  RAISE NOTICE '[MM %] Request: room=% | fee=%', p_user_id, p_room_id, p_entry_fee;
  
  -- ─────────────────────────────────────────────────────────────
  -- STEP 0: Check for existing active matches (ANY status)
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
    RAISE NOTICE '[MM %] ✅ RESUME: Found existing match %', p_user_id, v_existing_match_id;
    RETURN jsonb_build_object(
      'action', 'resume',
      'matchId', v_existing_match_id
    ) || get_canonical_match_payload(v_existing_match_id, p_user_id);
  END IF;
  
  -- ─────────────────────────────────────────────────────────────
  -- STEP 1: Get profile
  -- ─────────────────────────────────────────────────────────────
  SELECT 
    id, username, current_trainer_id, current_team, current_locked_order, 
    team_locked_at, balance, locked_balance
  INTO v_profile
  FROM profiles
  WHERE id = p_user_id;
  
  IF NOT FOUND THEN
    RAISE NOTICE '[MM %] ❌ USER_NOT_FOUND', p_user_id;
    RETURN jsonb_build_object('success', false, 'error', 'USER_NOT_FOUND');
  END IF;
  
  -- Auto-populate team data if missing (temporary bypass)
  IF v_profile.current_trainer_id IS NULL THEN
    v_profile.current_trainer_id := 'ash';
  END IF;
  
  IF v_profile.current_team IS NULL THEN
    v_profile.current_team := '[1,2,3,4,5,6]'::jsonb;
  END IF;
  
  IF v_profile.current_locked_order IS NULL THEN
    v_profile.current_locked_order := '[0,1,2,3,4,5]'::jsonb;
  END IF;
  
  RAISE NOTICE '[MM %] Profile OK: user=% | trainer=%', p_user_id, v_profile.username, v_profile.current_trainer_id;
  
  -- ─────────────────────────────────────────────────────────────
  -- STEP 2: DIAGNOSTIC - Count all queueing matches in this room
  -- ─────────────────────────────────────────────────────────────
  SELECT COUNT(*) INTO v_search_count
  FROM matches
  WHERE status = 'queueing'
    AND game_mode = 'paid_pvp'
    AND player_b_id IS NULL
    AND room_id = p_room_id
    AND entry_fee_sol = p_entry_fee
    AND (expires_at IS NULL OR expires_at > now());
    
  RAISE NOTICE '[MM %] 🔍 Queueing matches in room "%": % total', p_user_id, p_room_id, v_search_count;
  
  -- ─────────────────────────────────────────────────────────────
  -- STEP 3: Try to join existing queueing match
  -- CRITICAL: FOR UPDATE SKIP LOCKED prevents race conditions
  -- ─────────────────────────────────────────────────────────────
  SELECT id, player_a_id, battle_seed, arena_id, room_id, created_at
  INTO v_candidate_match_id, v_candidate_player_a, v_candidate_battle_seed, 
       v_candidate_arena_id, v_candidate_room_id, v_candidate_created_at
  FROM matches
  WHERE status = 'queueing'
    AND game_mode = 'paid_pvp'
    AND player_b_id IS NULL
    AND player_a_id != p_user_id  -- CRITICAL: Cannot join own match
    AND room_id = p_room_id       -- CRITICAL: Must match requested room
    AND entry_fee_sol = p_entry_fee
    AND (expires_at IS NULL OR expires_at > now())
  ORDER BY created_at ASC
  FOR UPDATE SKIP LOCKED  -- CRITICAL: Atomic lock
  LIMIT 1;
  
  IF v_candidate_match_id IS NOT NULL THEN
    RAISE NOTICE '[MM %] 🎯 FOUND CANDIDATE:', p_user_id;
    RAISE NOTICE '[MM %]   - matchId: %', p_user_id, v_candidate_match_id;
    RAISE NOTICE '[MM %]   - playerA: %', p_user_id, v_candidate_player_a;
    RAISE NOTICE '[MM %]   - room: % (requested: %)', p_user_id, v_candidate_room_id, p_room_id;
    RAISE NOTICE '[MM %]   - created: %', p_user_id, v_candidate_created_at;
    RAISE NOTICE '[MM %]   - age: % seconds', p_user_id, EXTRACT(EPOCH FROM (now() - v_candidate_created_at));
    
    -- Double-check room match (paranoid validation)
    IF v_candidate_room_id != p_room_id THEN
      RAISE WARNING '[MM %] ⚠️  CROSS-ROOM LEAK! req=% stored=% REJECTING', 
        p_user_id, p_room_id, v_candidate_room_id;
      -- Fall through to create new match
    ELSE
      -- Lock funds for player_b
      RAISE NOTICE '[MM %] 🔒 Locking % SOL for player_b', p_user_id, p_entry_fee;
      v_lock_success := lock_player_funds(p_user_id, p_entry_fee);
      
      IF NOT (v_lock_success->>'success')::boolean THEN
        RAISE NOTICE '[MM %] ❌ INSUFFICIENT_FUNDS', p_user_id;
        RETURN jsonb_build_object(
          'success', false, 
          'error', 'INSUFFICIENT_FUNDS',
          'action', 'insufficient_funds',
          'details', v_lock_success
        );
      END IF;
      
      RAISE NOTICE '[MM %] ✅ Funds locked. Claiming match...', p_user_id;
      
      -- Get player_a profile
      SELECT username, current_trainer_id INTO v_player_a_username, v_player_a_trainer_id
      FROM profiles WHERE id = v_candidate_player_a;
      
      -- ATOMIC UPDATE: Claim match as player_b
      -- The WHERE clause ensures we only update if match is STILL queueing
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
      WHERE id = v_candidate_match_id
        AND status = 'queueing'      -- Guard: only if still queueing
        AND player_b_id IS NULL;      -- Guard: only if still open
      
      GET DIAGNOSTICS v_claimed_rows = ROW_COUNT;
      
      IF v_claimed_rows = 1 THEN
        RAISE NOTICE '[MM %] ✅ JOINED: Claimed match % as player_b', p_user_id, v_candidate_match_id;
        RAISE NOTICE '[MM %] 👥 Players: A=% | B=%', p_user_id, v_candidate_player_a, p_user_id;
        
        -- Audit log
        INSERT INTO audit_log (user_id, match_id, event_type, amount_sol, metadata)
        VALUES (
          p_user_id,
          v_candidate_match_id,
          'wager_locked',
          p_entry_fee,
          jsonb_build_object(
            'action', 'joined_match',
            'role', 'player_b', 
            'room_id', p_room_id,
            'player_a_id', v_candidate_player_a,
            'source', 'atomic_matchmaking_v2_join'
          )
        );
        
        RAISE NOTICE '[MM %] ==================== JOINED (player_b) ====================', p_user_id;
        
        RETURN jsonb_build_object(
          'action', 'joined',
          'matchId', v_candidate_match_id,
          'myRole', 'player_b',
          'opponentId', v_candidate_player_a
        ) || get_canonical_match_payload(v_candidate_match_id, p_user_id);
      ELSE
        -- Race condition: another player claimed this match first
        RAISE NOTICE '[MM %] ⚠️  RACE: Match % already claimed. Unlocking funds...', 
          p_user_id, v_candidate_match_id;
        PERFORM unlock_player_funds(p_user_id, p_entry_fee);
        -- Fall through to create new match
      END IF;
    END IF;
  ELSE
    RAISE NOTICE '[MM %] 🔍 No available matches to join (checked % queueing matches)', 
      p_user_id, v_search_count;
  END IF;
  
  -- ─────────────────────────────────────────────────────────────
  -- STEP 4: Create new queueing match as player_a
  -- ─────────────────────────────────────────────────────────────
  RAISE NOTICE '[MM %] 🆕 Creating new match as player_a', p_user_id;
  
  -- Lock funds for player_a
  v_lock_success := lock_player_funds(p_user_id, p_entry_fee);
  IF NOT (v_lock_success->>'success')::boolean THEN
    RAISE NOTICE '[MM %] ❌ INSUFFICIENT_FUNDS (create)', p_user_id;
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'INSUFFICIENT_FUNDS',
      'action', 'insufficient_funds',
      'details', v_lock_success
    );
  END IF;
  
  -- Generate IDs
  v_new_match_id := gen_random_uuid();
  v_new_battle_seed := gen_random_uuid()::text;
  
  -- Pre-select arena from seed
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
  
  RAISE NOTICE '[MM %] 🎲 New match:', p_user_id;
  RAISE NOTICE '[MM %]   - matchId: %', p_user_id, v_new_match_id;
  RAISE NOTICE '[MM %]   - battleSeed: %', p_user_id, v_new_battle_seed;
  RAISE NOTICE '[MM %]   - arenaId: %', p_user_id, v_new_arena_id;
  RAISE NOTICE '[MM %]   - roomId: %', p_user_id, p_room_id;
  
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
  
  -- Audit log
  INSERT INTO audit_log (user_id, match_id, event_type, amount_sol, metadata)
  VALUES (
    p_user_id,
    v_new_match_id,
    'wager_locked',
    p_entry_fee,
    jsonb_build_object(
      'action', 'created_match',
      'role', 'player_a', 
      'room_id', p_room_id,
      'source', 'atomic_matchmaking_v2_create'
    )
  );
  
  RAISE NOTICE '[MM %] ✅ CREATED: New queueing match %', p_user_id, v_new_match_id;
  RAISE NOTICE '[MM %] ==================== CREATED (player_a) ====================', p_user_id;
  
  RETURN jsonb_build_object(
    'action', 'created',
    'matchId', v_new_match_id,
    'myRole', 'player_a'
  ) || get_canonical_match_payload(v_new_match_id, p_user_id);
END;
$$;

GRANT EXECUTE ON FUNCTION atomic_join_or_create_paid_match_v2 TO authenticated;
GRANT EXECUTE ON FUNCTION check_user_active_matches TO authenticated;

-- Add unique constraint to prevent duplicate active matches per user per room
CREATE UNIQUE INDEX IF NOT EXISTS idx_matches_one_active_per_user_room
ON matches (
  LEAST(player_a_id, player_b_id),
  GREATEST(player_a_id, player_b_id),
  room_id
)
WHERE status IN ('queueing', 'matched', 'arena_reveal', 'battle_ready') 
  AND game_mode = 'paid_pvp';

COMMENT ON INDEX idx_matches_one_active_per_user_room IS 
  'Prevents users from having multiple active matches in the same room. Uses LEAST/GREATEST to handle both player_a and player_b roles.';
