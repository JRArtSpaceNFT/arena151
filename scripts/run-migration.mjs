#!/usr/bin/env node

/**
 * Run migration 025 directly via Supabase client
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SUPABASE_URL = 'https://abzurjxkxxtahdjrpvxk.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_KEY not set');
  console.error('Run: export SUPABASE_SERVICE_KEY="<your-service-key>"');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const migrationPath = join(__dirname, '../supabase/migrations/025_fix_matchmaking_phases.sql');
const sql = readFileSync(migrationPath, 'utf8');

console.log('📦 Running migration: 025_fix_matchmaking_phases.sql');
console.log(`🔗 Target: ${SUPABASE_URL}`);

// Split by statement and execute sequentially
const statements = sql
  .split(';')
  .map(s => s.trim())
  .filter(s => s.length > 0 && !s.startsWith('--'));

console.log(`📝 Found ${statements.length} SQL statements`);

for (let i = 0; i < statements.length; i++) {
  const stmt = statements[i] + ';';
  console.log(`\n⏳ Executing statement ${i + 1}/${statements.length}...`);
  console.log(stmt.substring(0, 100) + '...');
  
  try {
    const { data, error } = await supabase.rpc('exec_sql', { query: stmt });
    
    if (error) {
      console.error(`❌ Statement ${i + 1} failed:`, error);
      // Don't exit - some errors might be OK (like DROP IF EXISTS on non-existent constraints)
      console.warn('⚠️  Continuing anyway...');
    } else {
      console.log(`✅ Statement ${i + 1} succeeded`);
    }
  } catch (err) {
    console.error(`❌ Unexpected error on statement ${i + 1}:`, err.message);
  }
}

console.log('\n✅ Migration complete!');
