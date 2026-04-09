# Apply X OAuth 1.0a Database Migration

## Quick Steps

1. **Go to Supabase Dashboard**
   - Open: https://supabase.com/dashboard/project/abzurjxkxxtahdjrpvxk

2. **Open SQL Editor**
   - Left sidebar → SQL Editor → New Query

3. **Copy Migration**
   - Open: `supabase/migrations/013_x_oauth_1_0a.sql`
   - Copy entire contents

4. **Paste and Run**
   - Paste into SQL Editor
   - Click "Run" (bottom right)
   - Should see success message

5. **Verify Tables**
   ```sql
   -- Check tables were created
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name IN ('x_oauth_attempts', 'x_connection_audit');
   
   -- Should return 2 rows
   ```

6. **Verify Profiles Columns**
   ```sql
   -- Check new columns exist
   SELECT column_name 
   FROM information_schema.columns 
   WHERE table_name = 'profiles' 
   AND column_name LIKE 'x_%';
   
   -- Should return 8 rows (x_user_id, x_username, etc.)
   ```

## Done!
Database is ready for X OAuth 1.0a flow.
