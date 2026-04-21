-- COMPLETE SCHEMA FIX - Run this ONCE to fix everything
-- This adds all missing columns and updates all constraints

-- 1. Add missing columns to matches table if they don't exist
DO $$ 
BEGIN
  -- Add updated_at if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='matches' AND column_name='updated_at') THEN
    ALTER TABLE matches ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();
  END IF;
  
  -- Add joined_at if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='matches' AND column_name='joined_at') THEN
    ALTER TABLE matches ADD COLUMN joined_at TIMESTAMPTZ;
  END IF;
END $$;

-- 2. Update status constraint to allow all statuses
ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_status_check;
ALTER TABLE matches ADD CONSTRAINT matches_status_check 
CHECK (status = ANY (ARRAY[
  'forming'::text,
  'funds_locked'::text,
  'ready'::text,
  'voided'::text,
  'queueing'::text,
  'matched'::text,
  'arena_reveal'::text,
  'battle_ready'::text,
  'in_progress'::text,
  'settlement_pending'::text,
  'completed'::text,
  'cancelled'::text
]));

-- 3. Verify the fix
SELECT 'Schema fix complete' as status;
