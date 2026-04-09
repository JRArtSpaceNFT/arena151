-- Enable Realtime for chat_messages table
-- Run this in Supabase SQL Editor

-- Enable replication for chat_messages
ALTER TABLE chat_messages REPLICA IDENTITY FULL;

-- Verify Realtime is enabled for the table
-- (You can also check in Supabase Dashboard → Database → Replication)
