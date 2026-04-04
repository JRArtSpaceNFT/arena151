-- Arena 151 — RPC Helper Functions for Safe Financial Operations
-- Run this after 002_financial_hardening.sql

-- ═══════════════════════════════════════════════════════════════
-- lock_player_funds: Atomically lock a player's wager
-- Returns JSONB: { success, balance_before, balance_after, locked_before, locked_after }
-- TOCTOU-safe: check and debit are one atomic SQL operation
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION lock_player_funds(
  p_user_id UUID,
  p_amount   NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_balance_before  NUMERIC;
  v_locked_before   NUMERIC;
  v_balance_after   NUMERIC;
  v_locked_after    NUMERIC;
  v_rows_affected   INTEGER;
BEGIN
  -- Read current state (for audit purposes)
  SELECT balance, locked_balance INTO v_balance_before, v_locked_before
  FROM public.profiles WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'user_not_found');
  END IF;

  -- Atomic lock: only succeeds if (balance - locked_balance) >= amount
  UPDATE public.profiles
  SET locked_balance = locked_balance + p_amount
  WHERE id = p_user_id
    AND (balance - locked_balance) >= p_amount;

  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

  IF v_rows_affected = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'insufficient_available_balance',
      'balance', v_balance_before,
      'locked', v_locked_before,
      'available', v_balance_before - v_locked_before
    );
  END IF;

  -- Read new state
  SELECT balance, locked_balance INTO v_balance_after, v_locked_after
  FROM public.profiles WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'balance_before', v_balance_before,
    'balance_after', v_balance_after,
    'locked_before', v_locked_before,
    'locked_after', v_locked_after
  );
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- unlock_player_funds: Atomically unlock a player's funds (refund path)
-- ═══════════════════════════════════════════════════════════════

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
  SELECT balance, locked_balance INTO v_balance_before, v_locked_before
  FROM public.profiles WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'user_not_found');
  END IF;

  -- Only unlock up to what is actually locked
  UPDATE public.profiles
  SET locked_balance = GREATEST(0, locked_balance - p_amount)
  WHERE id = p_user_id;

  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', v_rows_affected > 0,
    'balance_before', v_balance_before,
    'locked_before', v_locked_before
  );
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- settle_match: Atomic settlement — debit loser, credit winner
-- Called after on-chain tx succeeds.
-- Returns JSONB with updated balances.
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION settle_match_db(
  p_match_id    UUID,
  p_winner_id   UUID,
  p_loser_id    UUID,
  p_entry_fee   NUMERIC,
  p_winner_payout NUMERIC,
  p_settlement_tx TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_winner_balance_before NUMERIC;
  v_loser_balance_before  NUMERIC;
  v_winner_balance_after  NUMERIC;
  v_loser_balance_after   NUMERIC;
BEGIN
  SELECT balance, locked_balance INTO v_winner_balance_before
  FROM public.profiles WHERE id = p_winner_id;

  SELECT balance, locked_balance INTO v_loser_balance_before
  FROM public.profiles WHERE id = p_loser_id;

  -- Loser: debit locked_balance and balance by entry_fee
  UPDATE public.profiles
  SET
    balance        = balance - p_entry_fee,
    locked_balance = GREATEST(0, locked_balance - p_entry_fee)
  WHERE id = p_loser_id;

  -- Winner: unlock their locked amount + credit the winner payout amount
  -- Their locked_balance (their own entry fee) is freed + they get winner_payout
  -- winner_payout = (2 * entry_fee) * 0.95 — but we credit the diff above their entry fee
  -- Net: winner balance += (winner_payout - entry_fee), locked_balance -= entry_fee
  -- Simplified: balance += (winner_payout - entry_fee), locked_balance -= entry_fee
  UPDATE public.profiles
  SET
    balance        = balance + (p_winner_payout - p_entry_fee),
    locked_balance = GREATEST(0, locked_balance - p_entry_fee)
  WHERE id = p_winner_id;

  -- Update match status
  UPDATE public.matches
  SET
    status         = 'settled',
    winner_id      = p_winner_id,
    settlement_tx  = p_settlement_tx,
    updated_at     = now()
  WHERE id = p_match_id;

  SELECT balance INTO v_winner_balance_after FROM public.profiles WHERE id = p_winner_id;
  SELECT balance INTO v_loser_balance_after  FROM public.profiles WHERE id = p_loser_id;

  RETURN jsonb_build_object(
    'success', true,
    'winner_balance_before', v_winner_balance_before,
    'winner_balance_after', v_winner_balance_after,
    'loser_balance_before', v_loser_balance_before,
    'loser_balance_after', v_loser_balance_after
  );
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- refund_match: Atomically unlock both players' funds
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION refund_match_db(
  p_match_id  UUID,
  p_player_a  UUID,
  p_player_b  UUID,
  p_amount    NUMERIC,
  p_reason    TEXT DEFAULT 'refund'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Unlock both players
  UPDATE public.profiles
  SET locked_balance = GREATEST(0, locked_balance - p_amount)
  WHERE id IN (p_player_a, p_player_b);

  -- Update match
  UPDATE public.matches
  SET status = 'voided', updated_at = now(), error_message = p_reason
  WHERE id = p_match_id;

  RETURN jsonb_build_object('success', true, 'refunded_each', p_amount);
END;
$$;
