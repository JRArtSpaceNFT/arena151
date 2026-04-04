-- Arena 151 — Financial Hardening Migration
-- Run this in Supabase Dashboard → SQL Editor → New Query → Run
-- This migration adds server-authoritative settlement infrastructure.
-- 
-- ⚠️  IMPORTANT: Run migrations in order.
--     001_wallets.sql must already be applied before this one.

-- ═══════════════════════════════════════════════════════════════
-- 1. Add locked_balance to profiles
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS locked_balance NUMERIC NOT NULL DEFAULT 0;

-- Constrain both balance columns: never go negative
-- Note: If a constraint already exists with this name, this will error — ignore it.
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

-- ═══════════════════════════════════════════════════════════════
-- 2. Add UNIQUE constraint to transactions.tx_signature
-- ═══════════════════════════════════════════════════════════════

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

-- ═══════════════════════════════════════════════════════════════
-- 3. Create matches table
-- ═══════════════════════════════════════════════════════════════

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

-- ═══════════════════════════════════════════════════════════════
-- 4. Create audit_log table
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.audit_log (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        REFERENCES public.profiles(id),
  match_id       UUID        REFERENCES public.matches(id),
  event_type     TEXT        NOT NULL,  -- 'wager_locked', 'wager_unlocked', 'settlement', 'withdrawal', 'deposit', etc.
  amount_sol     NUMERIC,
  balance_before NUMERIC,
  balance_after  NUMERIC,
  metadata       JSONB,
  created_at     TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════
-- 5. Indexes on matches
-- ═══════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_matches_player_a ON public.matches (player_a_id);
CREATE INDEX IF NOT EXISTS idx_matches_player_b ON public.matches (player_b_id);
CREATE INDEX IF NOT EXISTS idx_matches_status   ON public.matches (status);
CREATE INDEX IF NOT EXISTS idx_matches_created  ON public.matches (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_user    ON public.audit_log (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_match   ON public.audit_log (match_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON public.audit_log (created_at DESC);

-- ═══════════════════════════════════════════════════════════════
-- 6. Row Level Security for matches
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Players can read their own matches
DROP POLICY IF EXISTS "Players can read own matches" ON public.matches;
CREATE POLICY "Players can read own matches"
  ON public.matches
  FOR SELECT
  USING (auth.uid() = player_a_id OR auth.uid() = player_b_id);

-- Users can read their own audit log
DROP POLICY IF EXISTS "Users can read own audit log" ON public.audit_log;
CREATE POLICY "Users can read own audit log"
  ON public.audit_log
  FOR SELECT
  USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════
-- 7. Helper function: update match updated_at automatically
-- ═══════════════════════════════════════════════════════════════

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

-- ═══════════════════════════════════════════════════════════════
-- 8. RPC: process_deposit — atomic deposit processing
--    Inserts transaction (idempotent) then credits balance atomically.
--    Returns: 'credited' | 'duplicate' | 'user_not_found'
-- ═══════════════════════════════════════════════════════════════

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
