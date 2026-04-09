-- X OAuth 1.0a Implementation
-- Stores pending OAuth attempts with server-side state management

-- Drop old audit table if it exists (we'll recreate it properly)
DROP TABLE IF EXISTS x_connection_audit CASCADE;

-- Create x_oauth_attempts table for managing OAuth 1.0a flow state
CREATE TABLE IF NOT EXISTS x_oauth_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- OAuth 1.0a request token credentials (step 1)
  request_token TEXT NOT NULL,
  request_token_secret TEXT NOT NULL,
  
  -- Flow state
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'completed', 'failed', 'expired'
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes'),
  completed_at TIMESTAMPTZ,
  
  -- Metadata
  ip_address TEXT,
  user_agent TEXT,
  
  CONSTRAINT valid_status CHECK (status IN ('pending', 'completed', 'failed', 'expired'))
);

-- Indexes for fast lookups
CREATE INDEX idx_x_oauth_attempts_user_id ON x_oauth_attempts(user_id, created_at DESC);
CREATE INDEX idx_x_oauth_attempts_token ON x_oauth_attempts(request_token) WHERE status = 'pending';
CREATE INDEX idx_x_oauth_attempts_expires ON x_oauth_attempts(expires_at) WHERE status = 'pending';

-- Create x_connection_audit table for logging all connection events
CREATE TABLE IF NOT EXISTS x_connection_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Event details
  action TEXT NOT NULL, -- 'connect_start', 'connect_success', 'connect_failed', 'disconnect'
  
  -- X account details (when available)
  x_user_id TEXT,
  x_username TEXT,
  
  -- Error details (when failed)
  error_code TEXT,
  error_message TEXT,
  
  -- Metadata
  ip_address TEXT,
  user_agent TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_x_audit_user ON x_connection_audit(user_id, created_at DESC);
CREATE INDEX idx_x_audit_action ON x_connection_audit(action, created_at DESC);

-- Function to auto-expire old pending attempts
CREATE OR REPLACE FUNCTION expire_old_x_oauth_attempts()
RETURNS void AS $$
BEGIN
  UPDATE x_oauth_attempts
  SET status = 'expired'
  WHERE status = 'pending'
    AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- RLS policies
ALTER TABLE x_oauth_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE x_connection_audit ENABLE ROW LEVEL SECURITY;

-- Users can only see their own OAuth attempts
CREATE POLICY "Users can view own OAuth attempts"
ON x_oauth_attempts FOR SELECT
USING (auth.uid() = user_id);

-- Users can view their own audit log
CREATE POLICY "Users can view own audit log"
ON x_connection_audit FOR SELECT
USING (auth.uid() = user_id);

-- Service role can do everything (for API routes)
-- (Service role bypasses RLS anyway, but being explicit)
