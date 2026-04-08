-- Add X account linking fields to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS x_user_id TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS x_username TEXT,
ADD COLUMN IF NOT EXISTS x_name TEXT,
ADD COLUMN IF NOT EXISTS x_profile_image_url TEXT,
ADD COLUMN IF NOT EXISTS x_verified_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS x_access_token_encrypted TEXT,
ADD COLUMN IF NOT EXISTS x_refresh_token_encrypted TEXT,
ADD COLUMN IF NOT EXISTS x_token_expires_at TIMESTAMPTZ;

-- Create unique index on x_user_id (canonical identity, only one Arena 151 profile per X account)
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_x_user_id ON profiles(x_user_id) WHERE x_user_id IS NOT NULL;

-- Create index for lookup by x_username (display purposes)
CREATE INDEX IF NOT EXISTS idx_profiles_x_username ON profiles(x_username) WHERE x_username IS NOT NULL;

-- RLS policies (users can only update their own X connection)
CREATE POLICY "Users can update own X connection"
ON profiles FOR UPDATE
USING (auth.uid() = id);

-- Audit: log X account connections
CREATE TABLE IF NOT EXISTS x_connection_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL, -- 'linked', 'unlinked', 'link_failed'
  x_user_id TEXT,
  x_username TEXT,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_x_audit_user ON x_connection_audit(user_id, created_at DESC);
