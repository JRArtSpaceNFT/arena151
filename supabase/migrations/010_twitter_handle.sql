-- ════════════════════════════════════════════════════════════════════
-- 010_twitter_handle.sql
-- Add optional twitter_handle to profiles for social discovery
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS twitter_handle TEXT DEFAULT NULL;
