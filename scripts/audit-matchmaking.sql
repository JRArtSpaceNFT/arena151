-- Matchmaking System Audit Script
-- Run this to check current state

-- 1. Check if RPC function exists and its definition
SELECT 
  proname as function_name,
  pg_get_functiondef(oid) as definition
FROM pg_proc 
WHERE proname = 'atomic_join_or_create_paid_match_v2';

-- 2. Check match table structure
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'matches'
ORDER BY ordinal_position;

-- 3. Check for recent matches
SELECT 
  id,
  player_a_id,
  player_b_id,
  status,
  room_id,
  battle_seed,
  arena_id,
  created_at,
  joined_at
FROM matches
WHERE created_at > now() - interval '24 hours'
ORDER BY created_at DESC
LIMIT 10;

-- 4. Check status transition trigger
SELECT 
  tgname,
  tgenabled,
  pg_get_triggerdef(oid) as definition
FROM pg_trigger
WHERE tgrelid = 'matches'::regclass
  AND tgname = 'enforce_match_status_transition';

-- 5. Check RLS policies on matches table
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'matches';
