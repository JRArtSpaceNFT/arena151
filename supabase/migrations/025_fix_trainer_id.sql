-- Fix: Ensure current_trainer_id defaults to 'ash' and never stores UUIDs

-- First, fix all existing profiles with UUID trainer IDs
UPDATE profiles
SET current_trainer_id = 'ash'
WHERE current_trainer_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- Add a check constraint to prevent UUIDs from being stored
ALTER TABLE profiles
DROP CONSTRAINT IF EXISTS current_trainer_id_not_uuid;

ALTER TABLE profiles
ADD CONSTRAINT current_trainer_id_not_uuid
CHECK (current_trainer_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');
