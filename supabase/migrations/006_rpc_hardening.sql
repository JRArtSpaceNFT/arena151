-- ════════════════════════════════════════════════════════════════════
-- 006_rpc_hardening.sql
-- Remaining audit fixes: RPC exception handling + strict unlock guard
--
-- Fixes:
--   • settle_match_db: EXCEPTION block catches constraint violations
--     (e.g. balance goes negative) and returns structured error instead
--     of aborting the transaction silently.
--   • unlock_player_funds: strict mode — errors if unlock amount exceeds
--     actual locked_balance, preventing silent ledger corruption.
-- ════════════════════════════════════════════════════════════════════

-- ── 1. settle_match_db — add EXCEPTION handler ───────────────────────
--
-- Previously: a CHECK constraint violation (e.g. balance < 0) during the
-- loser UPDATE would raise an unhandled exception, aborting the entire
-- plpgsql transaction and leaving the match in an unknown state.
-- The on-chain payment would already have been sent.
--
-- Fix: catch constraint violations, record the on-chain tx signature in
-- the match error_message, and return a structured error so the caller
-- can log it for manual reconciliation without retrying sendSol.

CREATE OR REPLACE FUNCTION settle_match_db(
  p_match_id      UUID,
  p_winner_id     UUID,
  p_loser_id      UUID,
  p_entry_fee     NUMERIC,
  p_winner_payout NUMERIC,
  p_settlement_tx TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rows_affected      INTEGER;
  v_winner_bal_before  NUMERIC;
  v_loser_bal_before   NUMERIC;
  v_winner_bal_after   NUMERIC;
  v_loser_bal_after    NUMERIC;
  v_current_status     TEXT;
BEGIN
  -- ── Idempotency: atomically claim 'settled' state ─────────────
  UPDATE public.matches
  SET
    status        = 'settled',
    winner_id     = p_winner_id,
    settlement_tx = p_settlement_tx,
    updated_at    = now()
  WHERE id = p_match_id
    AND status IN ('settling', 'settlement_failed', 'settlement_pending');

  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

  IF v_rows_affected = 0 THEN
    SELECT status INTO v_current_status FROM public.matches WHERE id = p_match_id;
    IF v_current_status = 'settled' THEN
      RETURN jsonb_build_object('success', false, 'reason', 'already_settled');
    ELSE
      RETURN jsonb_build_object('success', false, 'reason', 'invalid_state', 'status', v_current_status);
    END IF;
  END IF;

  -- ── Capture pre-settlement balances ───────────────────────────
  SELECT balance INTO v_winner_bal_before FROM public.profiles WHERE id = p_winner_id;
  SELECT balance INTO v_loser_bal_before  FROM public.profiles WHERE id = p_loser_id;

  -- ── Apply balance changes inside a SAVEPOINT ──────────────────
  -- SAVEPOINT allows catching constraint violations (e.g. balance going
  -- negative) without aborting the outer transaction. If the balance
  -- updates fail, we roll back to the savepoint, record the on-chain
  -- tx signature for reconciliation, and return a structured error.
  SAVEPOINT settle_balance_updates;

  BEGIN
    -- Loser: pays both stakes from their wallet (2×entry_fee total)
    UPDATE public.profiles
    SET
      balance        = balance - (p_entry_fee * 2),
      locked_balance = GREATEST(0, locked_balance - p_entry_fee)
    WHERE id = p_loser_id;

    -- Winner: receives winner_payout into their balance; stake released
    UPDATE public.profiles
    SET
      balance        = balance + p_winner_payout,
      locked_balance = GREATEST(0, locked_balance - p_entry_fee)
    WHERE id = p_winner_id;

  EXCEPTION
    WHEN check_violation OR not_null_violation OR numeric_value_out_of_range THEN
      -- Balance constraint violated — roll back balance updates only.
      -- The match status is already 'settled' (on-chain tx ran successfully).
      -- Record the error so manual reconciliation can fix the DB balances.
      ROLLBACK TO SAVEPOINT settle_balance_updates;

      UPDATE public.matches
      SET error_message = format(
        'BALANCE_UPDATE_FAILED after on-chain settlement. settlement_tx=%s. Manual reconciliation required. Error: %s',
        p_settlement_tx, SQLERRM
      )
      WHERE id = p_match_id;

      RETURN jsonb_build_object(
        'success',        false,
        'reason',         'balance_update_constraint_violation',
        'settlement_tx',  p_settlement_tx,
        'error',          SQLERRM,
        'note',           'On-chain tx succeeded. Match marked settled. Balance updates failed — manual reconciliation needed.'
      );
  END;

  RELEASE SAVEPOINT settle_balance_updates;

  -- ── Capture post-settlement balances ──────────────────────────
  SELECT balance INTO v_winner_bal_after FROM public.profiles WHERE id = p_winner_id;
  SELECT balance INTO v_loser_bal_after  FROM public.profiles WHERE id = p_loser_id;

  RETURN jsonb_build_object(
    'success',               true,
    'winner_balance_before', v_winner_bal_before,
    'winner_balance_after',  v_winner_bal_after,
    'loser_balance_before',  v_loser_bal_before,
    'loser_balance_after',   v_loser_bal_after
  );
END;
$$;


-- ── 2. unlock_player_funds — strict mode ─────────────────────────────
--
-- Previously: used GREATEST(0, locked_balance - p_amount) which silently
-- clamped to 0 if p_amount exceeded actual locked_balance.
-- This masked bugs where the wrong amount was passed, corrupting the ledger.
--
-- Fix: validate that locked_balance >= p_amount before unlocking.
-- Returns success:false with reason if amount exceeds locked balance,
-- so callers know immediately rather than silently succeeding with wrong math.
-- Exception: if p_amount is 0, it's always a no-op (safe).

CREATE OR REPLACE FUNCTION unlock_player_funds(
  p_user_id UUID,
  p_amount   NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_balance_before NUMERIC;
  v_locked_before  NUMERIC;
  v_rows_affected  INTEGER;
BEGIN
  IF p_amount = 0 THEN
    RETURN jsonb_build_object('success', true, 'note', 'zero_amount_noop');
  END IF;

  SELECT balance, locked_balance INTO v_balance_before, v_locked_before
  FROM public.profiles WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'user_not_found');
  END IF;

  -- Strict check: do not silently clamp
  IF v_locked_before < p_amount THEN
    RETURN jsonb_build_object(
      'success',        false,
      'reason',         'unlock_exceeds_locked_balance',
      'locked_balance', v_locked_before,
      'requested',      p_amount,
      'note',           'Unlock amount exceeds actual locked_balance — possible double-unlock or wrong amount'
    );
  END IF;

  UPDATE public.profiles
  SET locked_balance = locked_balance - p_amount
  WHERE id = p_user_id;

  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

  RETURN jsonb_build_object(
    'success',        v_rows_affected > 0,
    'locked_before',  v_locked_before,
    'locked_after',   v_locked_before - p_amount
  );
END;
$$;
