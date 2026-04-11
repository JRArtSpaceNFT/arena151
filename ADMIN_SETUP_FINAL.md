# Arena 151 Admin — FINAL SETUP STEPS

Your admin account is **created** ✅  
But you need to **apply the database migration** first.

---

## Step 1: Apply Database Migration

**Go to Supabase SQL Editor:**
https://supabase.com/dashboard/project/abzurjxkxxtahdjrpvxk/sql/new

**Copy and paste this entire migration:**

```sql
-- Arena 151 Admin Infrastructure
-- Safe admin tables for monitoring, notes, risk management, and reconciliation

-- Admin notes on users
CREATE TABLE admin_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  admin_id uuid NOT NULL REFERENCES profiles(id),
  note text NOT NULL,
  created_at timestamptz DEFAULT NOW()
);

CREATE INDEX idx_admin_notes_user_id ON admin_notes(user_id);
CREATE INDEX idx_admin_notes_created_at ON admin_notes(created_at DESC);

-- Risk flags
CREATE TABLE risk_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  flag_type text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  description text,
  flagged_by uuid REFERENCES profiles(id),
  resolved boolean DEFAULT false,
  resolved_at timestamptz,
  resolved_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT NOW()
);

CREATE INDEX idx_risk_flags_user_id ON risk_flags(user_id);
CREATE INDEX idx_risk_flags_severity ON risk_flags(severity) WHERE NOT resolved;
CREATE INDEX idx_risk_flags_resolved ON risk_flags(resolved);

-- Manual review queue
CREATE TABLE manual_review_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('withdrawal', 'user', 'match', 'deposit')),
  entity_id uuid NOT NULL,
  reason text NOT NULL,
  priority text NOT NULL CHECK (priority IN ('urgent', 'high', 'normal', 'low')),
  assigned_to uuid REFERENCES profiles(id),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'resolved', 'dismissed')),
  created_at timestamptz DEFAULT NOW(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES profiles(id),
  resolution_notes text
);

CREATE INDEX idx_manual_review_status ON manual_review_queue(status);
CREATE INDEX idx_manual_review_priority ON manual_review_queue(priority) WHERE status = 'pending';
CREATE INDEX idx_manual_review_entity ON manual_review_queue(entity_type, entity_id);

-- Reconciliation reports
CREATE TABLE reconciliation_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at timestamptz DEFAULT NOW(),
  total_user_balance numeric(20,9) NOT NULL,
  total_locked_balance numeric(20,9) NOT NULL,
  pending_withdrawals numeric(20,9) NOT NULL,
  pending_deposits numeric(20,9) NOT NULL,
  platform_fees numeric(20,9) NOT NULL,
  mismatch_count integer DEFAULT 0,
  drift_amount numeric(20,9) DEFAULT 0,
  status text NOT NULL CHECK (status IN ('healthy', 'warning', 'critical')),
  details jsonb
);

CREATE INDEX idx_reconciliation_reports_run_at ON reconciliation_reports(run_at DESC);
CREATE INDEX idx_reconciliation_reports_status ON reconciliation_reports(status);

-- Withdrawal holds
CREATE TABLE withdrawal_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  withdrawal_id uuid NOT NULL REFERENCES withdrawals(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id),
  reason text NOT NULL,
  held_by uuid NOT NULL REFERENCES profiles(id),
  held_at timestamptz DEFAULT NOW(),
  released_at timestamptz,
  released_by uuid REFERENCES profiles(id)
);

CREATE INDEX idx_withdrawal_holds_withdrawal_id ON withdrawal_holds(withdrawal_id);
CREATE INDEX idx_withdrawal_holds_user_id ON withdrawal_holds(user_id);
CREATE INDEX idx_withdrawal_holds_active ON withdrawal_holds(withdrawal_id) WHERE released_at IS NULL;

-- Admin audit log
CREATE TABLE admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES profiles(id),
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  summary text NOT NULL,
  before_state jsonb,
  after_state jsonb,
  request_id text,
  status text,
  metadata jsonb,
  created_at timestamptz DEFAULT NOW()
);

CREATE INDEX idx_admin_audit_log_admin_id ON admin_audit_log(admin_id);
CREATE INDEX idx_admin_audit_log_created_at ON admin_audit_log(created_at DESC);
CREATE INDEX idx_admin_audit_log_action ON admin_audit_log(action);
CREATE INDEX idx_admin_audit_log_entity ON admin_audit_log(entity_type, entity_id);

-- Extend profiles for admin tracking
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_seen timestamptz,
  ADD COLUMN IF NOT EXISTS signup_source text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS is_flagged boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS account_status text DEFAULT 'active';

CREATE INDEX idx_profiles_is_admin ON profiles(is_admin) WHERE is_admin = true;
CREATE INDEX idx_profiles_is_flagged ON profiles(is_flagged) WHERE is_flagged = true;
CREATE INDEX idx_profiles_last_seen ON profiles(last_seen DESC);

-- Extend withdrawals for admin controls
ALTER TABLE withdrawals 
  ADD COLUMN IF NOT EXISTS held boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS risk_score numeric(3,2),
  ADD COLUMN IF NOT EXISTS manual_review boolean DEFAULT false;

CREATE INDEX idx_withdrawals_held ON withdrawals(held) WHERE held = true;
CREATE INDEX idx_withdrawals_manual_review ON withdrawals(manual_review) WHERE manual_review = true;

-- RLS Policies (Admin only)

-- Admin notes: Only admins can read/write
ALTER TABLE admin_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_notes_admin_all ON admin_notes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = true
    )
  );

-- Risk flags: Only admins
ALTER TABLE risk_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY risk_flags_admin_all ON risk_flags
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = true
    )
  );

-- Manual review queue: Only admins
ALTER TABLE manual_review_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY manual_review_queue_admin_all ON manual_review_queue
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = true
    )
  );

-- Reconciliation reports: Only admins read
ALTER TABLE reconciliation_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY reconciliation_reports_admin_read ON reconciliation_reports
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = true
    )
  );

-- Withdrawal holds: Only admins
ALTER TABLE withdrawal_holds ENABLE ROW LEVEL SECURITY;
CREATE POLICY withdrawal_holds_admin_all ON withdrawal_holds
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = true
    )
  );

-- Admin audit log: Only admins read
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_audit_log_admin_read ON admin_audit_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = true
    )
  );
```

**Click "Run" in Supabase.**

---

## Step 2: Grant Admin Privileges

**In the same SQL Editor, run:**

```sql
UPDATE profiles 
SET is_admin = true 
WHERE email = 'blacklivesmatteretsy@gmail.com';
```

**Verify it worked:**

```sql
SELECT id, email, is_admin 
FROM profiles 
WHERE email = 'blacklivesmatteretsy@gmail.com';
```

You should see `is_admin: true`.

---

## Step 3: Login

1. **Start dev server:**
   ```bash
   cd /Users/worlddomination/.openclaw/workspace/arena151
   npm run dev
   ```

2. **Visit:**
   http://localhost:3002/login

3. **Login with:**
   - Email: `blacklivesmatteretsy@gmail.com`
   - Password: `0439Fole1!`

4. **You'll be redirected to:**
   http://localhost:3002/admin

**You're in. ✅**

---

## Your Admin Account

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Admin Account Details
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Email:    blacklivesmatteretsy@gmail.com
Password: 0439Fole1!
User ID:  958d4edc-afe6-4eb1-8d90-c5e50885b262
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**The account is created. Just apply the migration and login.**
