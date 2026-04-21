const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const sql = fs.readFileSync('supabase/migrations/024_complete_v2_bypass.sql', 'utf8');

async function runMigration() {
  try {
    console.log('Running migration 024...');
    
    // Use the raw SQL execution via RPC
    // We'll need to call it directly via fetch since supabase-js doesn't expose raw SQL
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec_sql`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`
        },
        body: JSON.stringify({ sql })
      }
    );
    
    if (!response.ok) {
      const error = await response.text();
      console.error('Migration failed:', error);
      process.exit(1);
    }
    
    console.log('Migration completed successfully!');
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

runMigration();
