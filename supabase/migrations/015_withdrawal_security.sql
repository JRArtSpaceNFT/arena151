-- ════════════════════════════════════════════════════════════════════
-- 015_withdrawal_security.sql
-- Add security columns for withdrawal throttling and review
-- ════════════════════════════════════════════════════════════════════

-- Track first withdrawal timestamp (for 24h delay enforcement)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_withdrawal_at TIMESTAMPTZ;

-- Track last login info (for session hijacking detection)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_login_ip TEXT,
  ADD COLUMN IF NOT EXISTS last_login_ua TEXT,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- Add withdrawal confirmation table (for email-based first withdrawal approval)
CREATE TABLE IF NOT EXISTS public.withdrawal_confirmations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount_sol NUMERIC NOT NULL,
  to_address TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,  -- UUID confirmation token
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'expired', 'cancelled')),
  expires_at TIMESTAMPTZ NOT NULL,
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_withdrawal_confirmations_user
  ON public.withdrawal_confirmations (user_id);

CREATE INDEX IF NOT EXISTS idx_withdrawal_confirmations_token
  ON public.withdrawal_confirmations (token)
  WHERE status = 'pending';

-- Enable RLS
ALTER TABLE public.withdrawal_confirmations ENABLE ROW LEVEL SECURITY;

-- Users can read their own withdrawal confirmations
CREATE POLICY "Users can read own withdrawal confirmations"
  ON public.withdrawal_confirmations
  FOR SELECT
  USING (auth.uid() = user_id);

-- Cleanup expired confirmations (run via cron)
CREATE OR REPLACE FUNCTION cleanup_expired_withdrawal_confirmations()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM public.withdrawal_confirmations
  WHERE status = 'pending' AND expires_at < now();

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

-- Usage: SELECT cleanup_expired_withdrawal_confirmations();
-- Returns: number of expired confirmations deleted
