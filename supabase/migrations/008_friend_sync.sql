-- ════════════════════════════════════════════════════════════════════
-- 008_friend_sync.sql
-- Add per-player JSONB sync metadata to matches for friend battle sync
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS metadata_a JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS metadata_b JSONB DEFAULT '{}';
