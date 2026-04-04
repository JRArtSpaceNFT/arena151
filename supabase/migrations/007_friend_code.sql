-- ════════════════════════════════════════════════════════════════════
-- 007_friend_code.sql
-- Add friend_code column to matches for server-side friend battle rooms
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS friend_code TEXT;

-- Partial unique index: only one active forming room per code at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_matches_friend_code_active
  ON public.matches (friend_code)
  WHERE status = 'forming' AND friend_code IS NOT NULL;

-- Fast lookup of friend rooms by code
CREATE INDEX IF NOT EXISTS idx_matches_friend_code
  ON public.matches (friend_code)
  WHERE friend_code IS NOT NULL;
