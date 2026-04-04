-- ============================================================
-- Arena 151 — FULL DATABASE SETUP
-- ============================================================
--
-- HOW TO RUN:
--   1. Go to https://supabase.com/dashboard → select your project
--   2. Click "SQL Editor" in the left sidebar
--   3. Click "New Query" (top right)
--   4. Paste this ENTIRE file into the editor
--   5. Click "Run" (or press Ctrl+Enter / Cmd+Enter)
--
-- WHAT THIS CREATES:
--   Tables:    profiles (adds wallet columns), transactions, matches, audit_log
--   Functions: process_deposit, lock_player_funds, unlock_player_funds,
--              settle_match_db, refund_match_db, update_match_updated_at
--   Policies:  RLS policies for all tables
--   Indexes:   Performance indexes on matches and audit_log
--
-- SAFE TO RE-RUN: Uses IF NOT EXISTS and OR REPLACE throughout.
--
-- ============================================================


-- ════════════════════════════════════════════════════════════
-- MIGRATION 001: Wallet columns + transactions table
-- ════════════════════════════════════════════════════════════

-- Add wallet columns to the profiles table
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS sol_address TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS encrypted_private_key TEXT;

-- Create transactions table for deposit/withdrawal/win/loss tracking
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'deposit', 'withdrawal', 'win', 'loss', 'fee'
  amount_sol NUMERIC NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending', 'confirmed', 'failed'
  tx_signature TEXT, -- Solana transaction signature
  from_address TEXT,
  to_address TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Users can read their own transactions
DROP POLICY IF EXISTS "Users can read own transactions" ON public.transactions;
CREATE POLICY "Users can read own transactions"
  ON public.transactions
  FOR SELECT
  USING (auth.uid() = user_id);


-- ════════════════════════════════════════════════════════════
-- MIGRATION 002: Financial hardening — locked_balance, matches, audit_log
-- ════════════════════════════════════════════════════════════

-- 1. Add locked_balance to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS locked_balance NUMERIC NOT NULL DEFAULT 0;

-- Constrain both balance columns: never go negative
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'check_balances' AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT check_balances CHECK (balance >= 0 AND locked_balance >= 0);
  END IF;
END $$;

-- 2. Add UNIQUE constraint to transactions.tx_signature
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'transactions_tx_signature_key' AND conrelid = 'public.transactions'::regclass
  ) THEN
    ALTER TABLE public.transactions
      ADD CONSTRAINT transactions_tx_signature_key UNIQUE (tx_signature);
  END IF;
END $$;

-- 3. Create matches table
CREATE TABLE IF NOT EXISTS public.matches (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  player_a_id       UUID        NOT NULL REFERENCES public.profiles(id),
  player_b_id       UUID        REFERENCES public.profiles(id),  -- NULL until opponent joins
  entry_fee_sol     NUMERIC     NOT NULL CHECK (entry_fee_sol > 0),
  status            TEXT        NOT NULL DEFAULT 'forming' CHECK (status IN (
    'forming',          -- P1 created match, waiting for P2
    'funds_locked',     -- Both players' funds locked
    'ready',            -- Ready to start
    'battling',         -- Battle in progress
    'result_pending',   -- Awaiting result submission
    'settlement_pending',-- Settlement in progress
    'settled',          -- Settled successfully
    'refund_pending',   -- Refund queued
    'refunded',         -- Refunded successfully
    'voided',           -- Voided (abandoned, timeout, etc.)
    'manual_review',    -- Disputed result — needs admin
    'settlement_failed' -- Settlement tx failed — needs admin
  )),
  winner_id         UUID        REFERENCES public.profiles(id),
  battle_seed       TEXT,       -- For future deterministic replay
  battle_log        JSONB,      -- Full battle log (server-computed or submitted)
  team_a            JSONB,      -- Player A's team at battle time
  team_b            JSONB,      -- Player B's team at battle time
  room_id           TEXT,       -- Which room tier this battle is in
  settlement_tx     TEXT,       -- On-chain settlement transaction signature
  refund_tx         TEXT,       -- On-chain refund transaction signature
  idempotency_key   TEXT        UNIQUE,
  error_message     TEXT,
  -- Per-player result claims (submitted by each player independently)
  result_claim_a    UUID        REFERENCES public.profiles(id),  -- P1's claimed winner
  result_claim_b    UUID        REFERENCES public.profiles(id),  -- P2's claimed winner
  result_submitted_at_a TIMESTAMPTZ,
  result_submitted_at_b TIMESTAMPTZ,
  -- Metadata
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

-- 4. Create audit_log table
CREATE TABLE IF NOT EXISTS public.audit_log (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        REFERENCES public.profiles(id),
  match_id       UUID        REFERENCES public.matches(id),
  event_type     TEXT        NOT NULL,
  amount_sol     NUMERIC,
  balance_before NUMERIC,
  balance_after  NUMERIC,
  metadata       JSONB,
  created_at     TIMESTAMPTZ DEFAULT now()
);

-- 5. Indexes on matches
CREATE INDEX IF NOT EXISTS idx_matches_player_a ON public.matches (player_a_id);
CREATE INDEX IF NOT EXISTS idx_matches_player_b ON public.matches (player_b_id);
CREATE INDEX IF NOT EXISTS idx_matches_status   ON public.matches (status);
CREATE INDEX IF NOT EXISTS idx_matches_created  ON public.matches (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_user    ON public.audit_log (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_match   ON public.audit_log (match_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON public.audit_log (created_at DESC);

-- 6. Row Level Security
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Players can read own matches" ON public.matches;
CREATE POLICY "Players can read own matches"
  ON public.matches
  FOR SELECT
  USING (auth.uid() = player_a_id OR auth.uid() = player_b_id);

DROP POLICY IF EXISTS "Users can read own audit log" ON public.audit_log;
CREATE POLICY "Users can read own audit log"
  ON public.audit_log
  FOR SELECT
  USING (auth.uid() = user_id);

-- 7. Helper function: update match updated_at automatically
CREATE OR REPLACE FUNCTION update_match_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_matches_updated_at ON public.matches;
CREATE TRIGGER trg_matches_updated_at
  BEFORE UPDATE ON public.matches
  FOR EACH ROW EXECUTE FUNCTION update_match_updated_at();

-- 8. RPC: process_deposit — atomic deposit processing
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
  v_profile_id UUID;
  v_balance_before NUMERIC;
  v_balance_after  NUMERIC;
  v_inserted       BOOLEAN := false;
BEGIN
  -- Find user
  SELECT id, balance INTO v_profile_id, v_balance_before
  FROM public.profiles
  WHERE sol_address = p_sol_address;

  IF v_profile_id IS NULL THEN
    RETURN 'user_not_found';
  END IF;

  -- Try to insert transaction (idempotent on tx_signature)
  INSERT INTO public.transactions (user_id, type, amount_sol, status, tx_signature, to_address, notes)
  VALUES (v_profile_id, 'deposit', p_amount_sol, 'confirmed', p_tx_signature, p_sol_address, COALESCE(p_notes, 'Deposit'))
  ON CONFLICT (tx_signature) DO NOTHING;

  -- Check if insert happened
  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  IF NOT v_inserted THEN
    RETURN 'duplicate';
  END IF;

  -- Credit balance atomically
  UPDATE public.profiles
  SET balance = balance + p_amount_sol
  WHERE id = v_profile_id
  RETURNING balance INTO v_balance_after;

  -- Audit log
  INSERT INTO public.audit_log (user_id, event_type, amount_sol, balance_before, balance_after, metadata)
  VALUES (v_profile_id, 'deposit', p_amount_sol, v_balance_before, v_balance_after,
          jsonb_build_object('tx_signature', p_tx_signature, 'sol_address', p_sol_address));

  RETURN 'credited';
END;
$$;


-- ════════════════════════════════════════════════════════════
-- MIGRATION 003: RPC helper functions for safe financial ops
-- ════════════════════════════════════════════════════════════

-- lock_player_funds: Atomically lock a player's wager
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

-- unlock_player_funds: Atomically unlock a player's funds (refund path)
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

-- settle_match_db: Atomic settlement — debit loser, credit winner
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

-- refund_match_db: Atomically unlock both players' funds
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
  UPDATE public.profiles
  SET locked_balance = GREATEST(0, locked_balance - p_amount)
  WHERE id IN (p_player_a, p_player_b);

  UPDATE public.matches
  SET status = 'voided', updated_at = now(), error_message = p_reason
  WHERE id = p_match_id;

  RETURN jsonb_build_object('success', true, 'refunded_each', p_amount);
END;
$$;


-- ════════════════════════════════════════════════════════════
-- MIGRATION 004: Retry count + settlement failure tracking
-- ════════════════════════════════════════════════════════════

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS last_retry_at TIMESTAMPTZ;

-- battle_seed already added in matches table above, but safe to re-apply
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS battle_seed TEXT;

-- Index for fast lookup of settlement_failed matches
CREATE INDEX IF NOT EXISTS idx_matches_settlement_failed
  ON public.matches (status, created_at)
  WHERE status = 'settlement_failed';

-- Index for fast lookup of stuck battling matches (for health check)
CREATE INDEX IF NOT EXISTS idx_matches_battling
  ON public.matches (status, created_at)
  WHERE status = 'battling';


-- ════════════════════════════════════════════════════════════
-- DIAGNOSTIC QUERIES — Verify everything was created
-- ════════════════════════════════════════════════════════════

-- You should see these functions listed:
--   lock_player_funds, process_deposit, refund_match_db,
--   settle_match_db, unlock_player_funds, update_match_updated_at
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
ORDER BY routine_name;

-- You should see these tables listed:
--   audit_log, matches, profiles, transactions
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
