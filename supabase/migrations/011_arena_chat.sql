-- ============================================================
-- Arena 151 Global Chat MVP
-- ============================================================

-- Chat messages table
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL CHECK (char_length(message) <= 200),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes'),
  is_deleted BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_chat_messages_created ON public.chat_messages(created_at DESC) WHERE is_deleted = FALSE;
CREATE INDEX idx_chat_messages_expires ON public.chat_messages(expires_at) WHERE is_deleted = FALSE;

-- Chat presence table (tracks who's online)
CREATE TABLE IF NOT EXISTS public.chat_presence (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_heartbeat TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_chat_presence_heartbeat ON public.chat_presence(last_heartbeat);

-- Chat mutes table (user-level blocking)
CREATE TABLE IF NOT EXISTS public.chat_mutes (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  muted_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, muted_user_id)
);

-- Chat reports table
CREATE TABLE IF NOT EXISTS public.chat_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reported_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message_id UUID REFERENCES public.chat_messages(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Row Level Security Policies
-- ============================================================

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_mutes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_reports ENABLE ROW LEVEL SECURITY;

-- Chat messages: everyone can read, only owner can insert
DROP POLICY IF EXISTS "Anyone can view active chat messages" ON public.chat_messages;
CREATE POLICY "Anyone can view active chat messages" ON public.chat_messages
  FOR SELECT
  USING (is_deleted = FALSE AND expires_at > NOW());

DROP POLICY IF EXISTS "Users can send chat messages" ON public.chat_messages;
CREATE POLICY "Users can send chat messages" ON public.chat_messages
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (
      -- Rate limit: max 1 message per 3 seconds
      SELECT COUNT(*) 
      FROM public.chat_messages 
      WHERE user_id = auth.uid() 
        AND created_at > NOW() - INTERVAL '3 seconds'
    ) = 0
  );

-- Chat presence: everyone can read, only owner can upsert
DROP POLICY IF EXISTS "Anyone can view chat presence" ON public.chat_presence;
CREATE POLICY "Anyone can view chat presence" ON public.chat_presence
  FOR SELECT
  USING (TRUE);

DROP POLICY IF EXISTS "Users can update own presence" ON public.chat_presence;
CREATE POLICY "Users can update own presence" ON public.chat_presence
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Chat mutes: only owner can read/write
DROP POLICY IF EXISTS "Users can manage own mutes" ON public.chat_mutes;
CREATE POLICY "Users can manage own mutes" ON public.chat_mutes
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Chat reports: users can insert, admins can read (for now, anyone can insert)
DROP POLICY IF EXISTS "Users can submit reports" ON public.chat_reports;
CREATE POLICY "Users can submit reports" ON public.chat_reports
  FOR INSERT
  WITH CHECK (auth.uid() = reporter_id);

-- ============================================================
-- Helper Functions
-- ============================================================

-- Clean up expired messages (run via cron every 5 minutes)
CREATE OR REPLACE FUNCTION cleanup_expired_chat_messages()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.chat_messages
  WHERE expires_at < NOW();
END;
$$;

-- Clean up stale presence (no heartbeat in last 90 seconds)
CREATE OR REPLACE FUNCTION cleanup_stale_chat_presence()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.chat_presence
  WHERE last_heartbeat < NOW() - INTERVAL '90 seconds';
END;
$$;

-- Get online count
CREATE OR REPLACE FUNCTION get_online_count()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  online_count INTEGER;
BEGIN
  -- First clean up stale presence
  DELETE FROM public.chat_presence
  WHERE last_heartbeat < NOW() - INTERVAL '90 seconds';
  
  -- Count active users
  SELECT COUNT(*)::INTEGER INTO online_count
  FROM public.chat_presence;
  
  RETURN online_count;
END;
$$;
