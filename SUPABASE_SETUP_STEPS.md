# Supabase Database Migration - Step by Step

## 🎯 Goal
Apply the X OAuth 1.0a database migration to create the required tables.

---

## 📋 Step-by-Step Instructions

### Step 1: Open Supabase SQL Editor

**Click this link:**
https://supabase.com/dashboard/project/abzurjxkxxtahdjrpvxk/sql/new

This will:
- Open your Arena 151 Supabase project
- Open a new SQL query editor
- You should see a blank SQL editor screen

---

### Step 2: Copy the Migration SQL

**Open this file on your computer:**
```
/Users/worlddomination/.openclaw/workspace/arena151/supabase/migrations/013_x_oauth_1_0a.sql
```

**OR copy the SQL below:**

```sql
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
```

---

### Step 3: Paste into SQL Editor

1. In the Supabase SQL Editor (the page you opened in Step 1)
2. Click inside the SQL editor box (big text area)
3. Press `Cmd+A` (select all) to clear any default text
4. Press `Cmd+V` (paste) to paste the migration SQL
5. You should see all the SQL code in the editor

---

### Step 4: Run the Migration

1. Look for the **"Run"** button in the bottom-right corner of the SQL editor
2. Click **"Run"** (or press `Cmd+Enter`)
3. Wait 2-3 seconds for it to execute

**Expected result:**
- Green success message: "Success. No rows returned"
- OR: Individual success messages for each CREATE statement

**If you see errors:**
- Take a screenshot
- Copy the error message
- Send to me for debugging

---

### Step 5: Verify Tables Were Created

**Still in Supabase SQL Editor, run this verification query:**

Click "New Query" button, then paste:

```sql
-- Check if both new tables exist
SELECT table_name, 
       (SELECT COUNT(*) FROM information_schema.columns WHERE columns.table_name = tables.table_name) as column_count
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('x_oauth_attempts', 'x_connection_audit')
ORDER BY table_name;
```

Click "Run"

**Expected result:**
```
table_name              | column_count
------------------------|-------------
x_connection_audit      | 8
x_oauth_attempts        | 10
```

You should see **2 rows** returned.

---

### Step 6: Verify Profiles Table Has X Columns

**Run this query:**

```sql
-- Check if profiles table has X account columns
SELECT column_name, data_type
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name LIKE 'x_%'
ORDER BY column_name;
```

Click "Run"

**Expected result: 8 rows**
```
column_name              | data_type
-------------------------|------------------
x_access_token_encrypted | text
x_name                   | text
x_profile_image_url      | text
x_refresh_token_encrypted| text
x_token_expires_at       | timestamp with time zone
x_user_id                | text
x_username               | text
x_verified_at            | timestamp with time zone
```

If you see these 8 columns, the profiles table is already set up! ✅

---

## ✅ Success Checklist

After completing all steps, you should have:

- [x] Opened Supabase SQL Editor
- [x] Pasted migration SQL
- [x] Clicked "Run"
- [x] Saw success message
- [x] Verified `x_oauth_attempts` table exists (10 columns)
- [x] Verified `x_connection_audit` table exists (8 columns)
- [x] Verified `profiles` table has 8 X columns

**If all checkboxes are ✅ → Migration complete! Move to next step.**

---

## 🐛 Common Issues

### Issue: "relation 'profiles' does not exist"
**Fix:** The profiles table should already exist. Check:
```sql
SELECT * FROM profiles LIMIT 1;
```
If this fails, there's a bigger database issue.

### Issue: "column 'x_user_id' already exists"
**Fix:** The profiles X columns were added in a previous migration (012). This is OK! The migration uses `IF NOT EXISTS` so it won't error. Just continue.

### Issue: "permission denied"
**Fix:** Make sure you're logged into the correct Supabase account (the one that owns Arena 151 project).

---

## 📸 Screenshots (What You Should See)

**Step 1 - SQL Editor:**
- URL bar shows: `supabase.com/dashboard/project/abzurjxkxxtahdjrpvxk/sql/new`
- Big text box for SQL
- "Run" button in bottom-right

**Step 4 - After Running:**
- Green notification at top: "Success. No rows returned"
- OR: Multiple success messages

**Step 5 - Verification:**
- Table showing 2 rows (x_oauth_attempts, x_connection_audit)
- Column counts: 10 and 8

---

## 🔗 Quick Links

**Supabase Dashboard:**  
https://supabase.com/dashboard/project/abzurjxkxxtahdjrpvxk

**SQL Editor (New Query):**  
https://supabase.com/dashboard/project/abzurjxkxxtahdjrpvxk/sql/new

**Table Editor (View Tables):**  
https://supabase.com/dashboard/project/abzurjxkxxtahdjrpvxk/editor

**API Settings (Get Service Key):**  
https://supabase.com/dashboard/project/abzurjxkxxtahdjrpvxk/settings/api

---

## ⏱️ Time Required

- Step 1-4: 2 minutes (paste and run)
- Step 5-6: 1 minute (verification)
- Total: ~3 minutes

---

## ✅ What's Next After This?

Once migration is complete:
1. ✅ Verify X API credentials (next guide)
2. ✅ Test OAuth flow
3. ✅ Verify it works

---

**Ready?** Click the link in Step 1 to start! ☝️
