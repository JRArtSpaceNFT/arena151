-- Arena 151 Admin Infrastructure (Safe Version)
-- Only creates what's needed for admin auth to work

-- Extend profiles for admin tracking
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_seen timestamptz,
  ADD COLUMN IF NOT EXISTS signup_source text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS is_flagged boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS account_status text DEFAULT 'active';

CREATE INDEX IF NOT EXISTS idx_profiles_is_admin ON profiles(is_admin) WHERE is_admin = true;
CREATE INDEX IF NOT EXISTS idx_profiles_is_flagged ON profiles(is_flagged) WHERE is_flagged = true;
CREATE INDEX IF NOT EXISTS idx_profiles_last_seen ON profiles(last_seen DESC);

-- Grant admin privileges to your account
UPDATE profiles 
SET is_admin = true 
WHERE email = 'blacklivesmatteretsy@gmail.com';

-- Verify
SELECT id, email, username, is_admin 
FROM profiles 
WHERE email = 'blacklivesmatteretsy@gmail.com';
