-- Arena 151 — Atomic Matchmaking RPC
-- Fixes race condition where two concurrent players create separate matches
-- instead of joining the same one.

-- ═══════════════════════════════════════════════════════════════
-- atomic_join_or_create_paid_match
--
-- Server-authoritative matchmaking:
-- 1. Attempts to atomically claim exactly ONE open paid match (FOR UPDATE SKIP LOCKED)
-- 2. If successful: locks funds, sets player_b, transitions to 'ready'
-- 3. If none available: creates new 'forming' match with user as player_a
-- 4. Prevents duplicate queue entries for same user
--
-- Returns JSONB:
-- {
--   "success": true,
--   "matchId": "uuid",
--   "role": "player_a" | "player_b",
--   "status": "forming" | "ready",
--   "battleSeed": "uuid",
--   "entryFeeSol": 0.05,
--   "createdNew": true | false,
--   "resumed": true | false (if user already had an active match)
-- }
-- ═══════════════════════════════════════════════════════════════

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
  -- ─────────────────────────────────────────────────────────────
  SELECT id, battle_seed, status, team_a, team_b, winner_id, player_b_id
  INTO v_existing_match_id, v_existing_battle_seed, v_existing_status,
       v_existing_team_a, v_existing_team_b, v_existing_winner_id, v_existing_player_b
  FROM public.matches
  WHERE (player_a_id = p_user_id OR player_b_id = p_user_id)
    AND room_id = p_room_id
    AND game_mode = 'paid_pvp'
    AND status IN ('forming', 'ready', 'settlement_pending')
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
          'playerAId', v_candidate_player_a
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
    now() + interval '5 minutes',  -- TTL: 5 min
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
    'resumed', false
  );
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION atomic_join_or_create_paid_match TO authenticated;

-- ═══════════════════════════════════════════════════════════════
-- Add game_mode column if it doesn't exist
-- (needed for filtering paid vs free matches)
-- ═══════════════════════════════════════════════════════════════
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'matches' AND column_name = 'game_mode'
  ) THEN
    ALTER TABLE public.matches ADD COLUMN game_mode TEXT DEFAULT 'paid_pvp' NOT NULL;
    CREATE INDEX idx_matches_game_mode ON public.matches(game_mode);
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════
-- Add expires_at column if it doesn't exist
-- (TTL for forming matches)
-- ═══════════════════════════════════════════════════════════════
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'matches' AND column_name = 'expires_at'
  ) THEN
    ALTER TABLE public.matches ADD COLUMN expires_at TIMESTAMPTZ;
    CREATE INDEX idx_matches_expires_at ON public.matches(expires_at) WHERE expires_at IS NOT NULL;
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════
-- Add joined_at column if it doesn't exist
-- (timestamp when player_b joined)
-- ═══════════════════════════════════════════════════════════════
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'matches' AND column_name = 'joined_at'
  ) THEN
    ALTER TABLE public.matches ADD COLUMN joined_at TIMESTAMPTZ;
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════
-- Cleanup expired forming matches
-- Run this periodically via cron or manual trigger
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION cleanup_expired_matches()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_expired_matches RECORD;
  v_count INTEGER := 0;
BEGIN
  FOR v_expired_matches IN
    SELECT id, player_a_id, entry_fee_sol
    FROM public.matches
    WHERE status = 'forming'
      AND game_mode = 'paid_pvp'
      AND player_b_id IS NULL
      AND expires_at < now()
  LOOP
    -- Unlock player_a funds
    PERFORM unlock_player_funds(v_expired_matches.player_a_id, v_expired_matches.entry_fee_sol);
    
    -- Mark match as voided
    UPDATE public.matches
    SET status = 'voided', error_message = 'Match expired - no opponent found'
    WHERE id = v_expired_matches.id;
    
    -- Audit log
    INSERT INTO public.audit_log (user_id, match_id, event_type, amount_sol, metadata)
    VALUES (
      v_expired_matches.player_a_id,
      v_expired_matches.id,
      'wager_refunded',
      v_expired_matches.entry_fee_sol,
      jsonb_build_object('reason', 'match_expired', 'source', 'cleanup_expired_matches')
    );
    
    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'cleaned_up_count', v_count);
END;
$$;

GRANT EXECUTE ON FUNCTION cleanup_expired_matches TO authenticated;
