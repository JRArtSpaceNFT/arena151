-- ════════════════════════════════════════════════════════════════════
-- 009_allow_free_matches.sql
-- Allow entry_fee_sol = 0 for free/friend practice matches.
-- Previously: CHECK (entry_fee_sol > 0) rejected all free matches.
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE public.matches
  DROP CONSTRAINT IF EXISTS matches_entry_fee_sol_check;

ALTER TABLE public.matches
  ADD CONSTRAINT matches_entry_fee_sol_check CHECK (entry_fee_sol >= 0);
