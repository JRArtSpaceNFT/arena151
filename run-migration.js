#!/usr/bin/env node

// Load .env.local FIRST
require('dotenv').config({ path: '.env.local' });

const fs = require('fs');
const path = require('path');

// Read migration file
const migrationSQL = fs.readFileSync(
  path.join(__dirname, 'supabase/migrations/025_fix_matchmaking_phases.sql'),
  'utf8'
);

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://abzurjxkxxtahdjrpvxk.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_KEY not set in .env.local');
  process.exit(1);
}

async function runMigration() {
  console.log('📦 Applying migration: 025_fix_matchmaking_phases.sql');
  console.log(`🔗 Target: ${SUPABASE_URL}`);
  console.log('');

  // Split into individual statements
  const statements = migrationSQL
    .split(/;\s*$/m)
    .map(s => s.trim())
    .filter(s => s.length > 10 && !s.startsWith('--'));

  console.log(`Found ${statements.length} SQL statements to execute`);
  console.log('');

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i] + ';';
    const preview = stmt.substring(0, 80).replace(/\s+/g, ' ');
    
    console.log(`⏳ [${i + 1}/${statements.length}] ${preview}...`);

    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SERVICE_KEY}`,
          'apikey': SERVICE_KEY,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({ query: stmt })
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error(`   ❌ Failed: ${errorText.substring(0, 200)}`);
        
        // Some errors are OK (like DROP CONSTRAINT IF EXISTS on non-existent constraints)
        if (errorText.includes('does not exist')) {
          console.log('   ⚠️  Constraint did not exist, continuing...');
          continue;
        }
        
        console.error('');
        console.error('Full error:', errorText);
        process.exit(1);
      }

      console.log('   ✅ Success');
    } catch (err) {
      console.error(`   ❌ Exception:`, err.message);
      process.exit(1);
    }
  }

  console.log('');
  console.log('✅ Migration complete!');
}

runMigration().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
