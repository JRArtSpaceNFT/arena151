-- ════════════════════════════════════════════════════════════════════
-- 014_wallet_key_versioning.sql
-- Add key versioning for wallet encryption key rotation
-- ════════════════════════════════════════════════════════════════════

-- Add key_version column to track which encryption key was used
-- Version 1: Original key (pre-rotation)
-- Version 2+: Rotated keys
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS key_version INTEGER DEFAULT 1;

-- Add index for fast lookup during re-encryption migrations
CREATE INDEX IF NOT EXISTS idx_profiles_key_version
  ON public.profiles (key_version)
  WHERE encrypted_private_key IS NOT NULL;

-- Add audit column for when key was last rotated (optional, for compliance)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS key_rotated_at TIMESTAMPTZ;

-- Helper function to track re-encryption progress
CREATE OR REPLACE FUNCTION get_key_version_summary()
RETURNS TABLE(
  key_version INTEGER,
  wallet_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(p.key_version, 1) AS key_version,
    COUNT(*) AS wallet_count
  FROM profiles p
  WHERE encrypted_private_key IS NOT NULL
  GROUP BY key_version
  ORDER BY key_version;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Usage: SELECT * FROM get_key_version_summary();
-- Expected after migration: All rows should show key_version=2
