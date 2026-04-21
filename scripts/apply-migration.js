#!/usr/bin/env node

/**
 * Apply migration directly to Supabase via service role key
 */

const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://abzurjxkxxtahdjrpvxk.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_KEY not set');
  process.exit(1);
}

const migrationPath = path.join(__dirname, '../supabase/migrations/025_fix_matchmaking_phases.sql');
const sql = fs.readFileSync(migrationPath, 'utf8');

async function applyMigration() {
  console.log('📦 Applying migration: 025_fix_matchmaking_phases.sql');
  console.log(`🔗 Target: ${SUPABASE_URL}`);
  
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'apikey': SERVICE_KEY,
      },
      body: JSON.stringify({ query: sql }),
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error('❌ Migration failed:', errorText);
      process.exit(1);
    }
    
    console.log('✅ Migration applied successfully');
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

applyMigration();
