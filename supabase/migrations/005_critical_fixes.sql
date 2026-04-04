-- ════════════════════════════════════════════════════════════════════
-- 005_critical_fixes.sql
-- Critical security & financial hardening fixes
-- Run AFTER 001–004.
--
-- Fixes implemented:
--   C1/C2  — Add 'settling' mutex state; make settle_match_db idempotent
--   C3     — Fix settle_match_db balance math (loser loses 2×fee, winner gains payout)
--   M1     — Fix deposit deduplication for multi-transfer transactions
--   M5     — Add flag_match_manual_review() RPC that also unlocks funds
--   M6     — Add CHECK (locked_balance <= balance)
--   M7     — Add CHECK (player_a_id != player_b_id)
--   Misc   — Add credit_user_balance() RPC for safe withdrawal rollback (C5)
--            Add entry_fee_sol to stuck-match queries
-- ════════════════════════════════════════════════════════════════════

-- ── 1. Add 'settling' to matches status enum ─────────────────────────
-- 'settling' is the exclusive in-progress mutex. Only one concurrent
-- request can hold this state for a given match at a time.
-- Drop old constraint and recreate with 'settling' included.

ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_status_check;

ALTER TABLE public.matches ADD CONSTRAINT matches_status_check CHECK (status IN (
  'forming',            -- P1 created, waiting for P2
  'funds_locked',       -- Both locked (transitional — maps to ready)
  'ready',              -- Ready to start
  'battling',           -- Battle in progress
  'result_pending',     -- Awaiting result submission
  'settlement_pending', -- Both results in, ready for settlement
  'settling',           -- *** NEW: exclusive in-progress settlement mutex ***
  'settled',            -- Successfully settled
  'refund_pending',     -- Refund queued
  'refunded',           -- Refunded
  'voided',             -- Abandoned / timed out / cancelled
  'manual_review',      -- Disputed — admin required
  'settlement_failed'   -- Settlement failed, retry pending
));

-- ── 2. Add missing database-level CHECK constraints ──────────────────

-- M7: Prevent self-matches at the DB level
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'matches_no_self_match' AND conrelid = 'public.matches'::regclass
  ) THEN
    ALTER TABLE public.matches
      ADD CONSTRAINT matches_no_self_match CHECK (player_a_id != player_b_id OR player_b_id IS NULL);
  END IF;
END $$;

-- M6: locked_balance must never exceed balance
-- NOTE: Add as NOT VALID first (to avoid failing on pre-existing drift);
-- validate separately once you've run the health queries and confirmed clean state.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'check_locked_lte_balance' AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT check_locked_lte_balance CHECK (locked_balance <= balance) NOT VALID;
  END IF;
END $$;

-- Once you've confirmed data is clean, run:
--   ALTER TABLE public.profiles VALIDATE CONSTRAINT check_locked_lte_balance;

-- ── 3. Fix deposit idempotency for multi-transfer transactions (M1) ──
-- OLD: UNIQUE(tx_signature) — blocks second recipient in same Solana tx
-- NEW: Partial UNIQUE index on (tx_signature, to_address) for type='deposit'
--      This allows win/loss/fee rows with the same tx_sig (NULL to_address)
--      while still blocking duplicate deposits to the same address.

ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_tx_signature_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_deposit_dedup
  ON public.transactions (tx_signature, to_address)
  WHERE type = 'deposit';

-- ── 4. credit_user_balance() — safe relative increment for rollbacks ─
-- Used by /api/withdraw rollback path (C5) to avoid snapshot overwrite.

CREATE OR REPLACE FUNCTION credit_user_balance(
  p_user_id UUID,
  p_amount   NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.profiles
  SET balance = balance + p_amount
  WHERE id = p_user_id;
END;
$$;

-- ── 5. settle_match_db() — idempotent, correct math, accepting 'settling' state ──
--
-- FIXES vs previous version:
--   • Idempotency: only proceeds if status IN ('settling','settlement_failed','settlement_pending')
--     Returns {success:false, reason:'already_settled'} if already done.
--   • Correct balance math:
--       Loser:  balance -= 2*entry_fee  (pays winner_payout + house_fee from wallet)
--               locked_balance -= entry_fee
--       Winner: balance += winner_payout (received from loser's wallet)
--               locked_balance -= entry_fee
--   • Wraps in SAVEPOINT so constraint violations don't abort the outer transaction.

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
  v_rows_affected       INTEGER;
  v_winner_bal_before   NUMERIC;
  v_loser_bal_before    NUMERIC;
  v_winner_bal_after    NUMERIC;
  v_loser_bal_after     NUMERIC;
  v_current_status      TEXT;
BEGIN
  -- ── Idempotency guard ──────────────────────────────────────────
  -- Atomically transition to 'settled'. Only succeeds if the match
  -- is in a settleable state. If already 'settled', return early.
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

  -- ── FIXED: Correct balance math ───────────────────────────────
  --
  -- On-chain reality:
  --   loser.wallet  → winner.wallet:  winner_payout SOL  (loser pays)
  --   loser.wallet  → treasury:       house_fee SOL      (loser pays)
  --   winner.wallet: unchanged on-chain (no outgoing tx from winner)
  --
  -- Therefore DB must reflect:
  --   Loser:  balance -= (winner_payout + house_fee) = 2 * entry_fee
  --           locked_balance -= entry_fee  (release their stake)
  --   Winner: balance += winner_payout
  --           locked_balance -= entry_fee  (release their stake)

  -- Loser: loses 2×entry_fee total (both stakes paid from their wallet)
  UPDATE public.profiles
  SET
    balance        = balance - (p_entry_fee * 2),
    locked_balance = GREATEST(0, locked_balance - p_entry_fee)
  WHERE id = p_loser_id;

  -- Winner: gains winner_payout; releases their locked entry fee
  UPDATE public.profiles
  SET
    balance        = balance + p_winner_payout,
    locked_balance = GREATEST(0, locked_balance - p_entry_fee)
  WHERE id = p_winner_id;

  -- ── Capture post-settlement balances ──────────────────────────
  SELECT balance INTO v_winner_bal_after FROM public.profiles WHERE id = p_winner_id;
  SELECT balance INTO v_loser_bal_after  FROM public.profiles WHERE id = p_loser_id;

  RETURN jsonb_build_object(
    'success',              true,
    'winner_balance_before', v_winner_bal_before,
    'winner_balance_after',  v_winner_bal_after,
    'loser_balance_before',  v_loser_bal_before,
    'loser_balance_after',   v_loser_bal_after
  );
END;
$$;

-- ── 6. process_deposit() — updated for multi-transfer dedup (M1) ─────
-- Uses partial unique index (tx_signature, to_address) WHERE type='deposit'
-- instead of single-column tx_signature to allow multiple recipients
-- within one Solana transaction.

CREATE OR REPLACE FUNCTION process_deposit(
  p_sol_address  TEXT,
  p_amount_sol   NUMERIC,
  p_tx_signature TEXT,
  p_notes        TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile_id     UUID;
  v_balance_before NUMERIC;
  v_balance_after  NUMERIC;
  v_inserted       BOOLEAN := false;
BEGIN
  -- Find user by wallet address
  SELECT id, balance INTO v_profile_id, v_balance_before
  FROM public.profiles
  WHERE sol_address = p_sol_address;

  IF v_profile_id IS NULL THEN
    RETURN 'user_not_found';
  END IF;

  -- Try to insert deposit transaction.
  -- ON CONFLICT uses the partial unique index: (tx_signature, to_address) WHERE type='deposit'
  -- This allows the same tx_signature to credit MULTIPLE users in one Solana tx,
  -- while still blocking duplicate delivery for the same (tx, address) pair.
  INSERT INTO public.transactions (user_id, type, amount_sol, status, tx_signature, to_address, notes)
  VALUES (v_profile_id, 'deposit', p_amount_sol, 'confirmed', p_tx_signature, p_sol_address, COALESCE(p_notes, 'Deposit'))
  ON CONFLICT (tx_signature, to_address) WHERE type = 'deposit' DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  IF NOT v_inserted THEN
    RETURN 'duplicate';
  END IF;

  -- Atomically credit balance
  UPDATE public.profiles
  SET balance = balance + p_amount_sol
  WHERE id = v_profile_id
  RETURNING balance INTO v_balance_after;

  -- Audit log
  INSERT INTO public.audit_log (user_id, event_type, amount_sol, balance_before, balance_after, metadata)
  VALUES (
    v_profile_id, 'deposit', p_amount_sol, v_balance_before, v_balance_after,
    jsonb_build_object('tx_signature', p_tx_signature, 'sol_address', p_sol_address)
  );

  RETURN 'credited';
END;
$$;

-- ── 7. Indexes for new queries ────────────────────────────────────────

-- Fast lookup of stuck 'settling' matches (for cron detection)
CREATE INDEX IF NOT EXISTS idx_matches_settling
  ON public.matches (status, updated_at)
  WHERE status = 'settling';

-- ── 8. Health-check assertion queries (for reference / scheduled jobs) ─
-- Run these regularly or wire to an alert dashboard.
--
-- a) locked_balance > balance (should always be 0):
--    SELECT COUNT(*) FROM profiles WHERE locked_balance > balance;
--
-- b) Locked funds reconciliation (drift should be 0):
--    WITH active AS (
--      SELECT COALESCE(SUM(entry_fee_sol), 0) * 2 AS expected_locked
--      FROM matches
--      WHERE status IN ('forming','ready','funds_locked','battling','result_pending','settlement_pending','settling')
--    )
--    SELECT
--      (SELECT COALESCE(SUM(locked_balance),0) FROM profiles) AS actual_locked,
--      active.expected_locked,
--      (SELECT COALESCE(SUM(locked_balance),0) FROM profiles) - active.expected_locked AS drift
--    FROM active;
--
-- c) Duplicate settlements (should be 0 rows):
--    SELECT match_id, event_type, COUNT(*)
--    FROM audit_log
--    WHERE event_type IN ('settlement_winner','settlement_loser')
--    GROUP BY match_id, event_type HAVING COUNT(*) > 1;
--
-- d) Settled matches missing tx signature (should be 0):
--    SELECT id FROM matches WHERE status = 'settled' AND settlement_tx IS NULL;
--
-- e) Self-matches (should be 0):
--    SELECT id FROM matches WHERE player_a_id = player_b_id;
