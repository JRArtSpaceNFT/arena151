#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { config } from 'dotenv';

// Load env
config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_KEY not set in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

console.log('📦 Applying migration via Supabase client');
console.log(`🔗 Target: ${SUPABASE_URL}`);
console.log('');

// Read the full migration SQL
const sql = readFileSync('supabase/migrations/025_fix_matchmaking_phases.sql', 'utf8');

console.log('⏳ Executing migration SQL...');
console.log('');

// Try to execute directly - Supabase should handle it
const { data, error } = await supabase.rpc('exec', { sql });

if (error) {
  console.error('❌ Migration failed:', error);
  console.error('');
  console.error('The Supabase REST API cannot execute raw SQL.');
  console.error('');
  console.error('MANUAL STEPS REQUIRED:');
  console.error('1. Go to: https://supabase.com/dashboard/project/abzurjxkxxtahdjrpvxk/sql/new');
  console.error('2. Copy the ENTIRE contents of: supabase/migrations/025_fix_matchmaking_phases.sql');
  console.error('3. Paste into SQL Editor');
  console.error('4. Click "Run"');
  console.error('');
  console.error('OR use psql:');
  console.error('  psql "postgresql://postgres:[YOUR_PASSWORD]@db.abzurjxkxxtahdjrpvxk.supabase.co:5432/postgres" -f supabase/migrations/025_fix_matchmaking_phases.sql');
  process.exit(1);
}

console.log('✅ Migration complete!');
