-- Arena 151 Admin User Setup
-- Run this in Supabase SQL Editor

-- Step 1: Create admin user account (if not exists)
-- Replace with your email and password
-- NOTE: Supabase requires you to create the user via Auth UI or API first
-- Then run this to grant admin privileges

-- Step 2: Grant admin privileges to existing user
UPDATE profiles 
SET is_admin = true 
WHERE email = 'YOUR_EMAIL_HERE';

-- Step 3: Verify admin was granted
SELECT id, email, username, is_admin 
FROM profiles 
WHERE is_admin = true;

-- Alternative: If you need to create the user programmatically
-- Use Supabase Auth API or dashboard to create the user first
-- Then run the UPDATE above
