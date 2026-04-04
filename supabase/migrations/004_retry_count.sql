-- ============================================================
-- 004_retry_count.sql
-- Adds retry tracking columns to matches table for settlement retry worker
-- ============================================================

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS last_retry_at TIMESTAMPTZ;

-- Also add battle_seed column if not already present (from Task 2)
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS battle_seed TEXT;

-- Index for fast lookup of settlement_failed matches within 24h
CREATE INDEX IF NOT EXISTS idx_matches_settlement_failed
  ON public.matches (status, created_at)
  WHERE status = 'settlement_failed';

-- Index for fast lookup of stuck battling matches (for health check)
CREATE INDEX IF NOT EXISTS idx_matches_battling
  ON public.matches (status, created_at)
  WHERE status = 'battling';
