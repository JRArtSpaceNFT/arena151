#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { config } from 'dotenv'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

console.log('═══════════════════════════════════════════════════════')
console.log('  Applying Matchmaking Pairing Fix')
console.log('═══════════════════════════════════════════════════════')
console.log('')

// Read migration file
const sql = readFileSync('supabase/migrations/026_fix_atomic_pairing.sql', 'utf-8')

console.log('📝 Applying migration 026_fix_atomic_pairing.sql...')
console.log('')

// Split into individual statements (Supabase doesn't support multi-statement)
// We'll use the rpc endpoint to execute raw SQL
try {
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql })
  
  if (error) {
    // exec_sql might not exist, try alternative approach
    console.log('⚠️  Direct SQL execution not available')
    console.log('📌 Manual steps required:')
    console.log('')
    console.log('1. Go to: https://supabase.com/dashboard/project/abzurjxkxxtahdjrpvxk/editor')
    console.log('2. Open SQL Editor')
    console.log('3. Paste contents of: supabase/migrations/026_fix_atomic_pairing.sql')
    console.log('4. Run the query')
    console.log('')
    console.log('Or use psql if you have the connection string:')
    console.log('  psql "<connection-string>" -f supabase/migrations/026_fix_atomic_pairing.sql')
    console.log('')
    process.exit(1)
  }
  
  console.log('✅ Migration applied successfully!')
} catch (err) {
  console.error('❌ Error:', err.message)
  console.log('')
  console.log('📌 Manual application required:')
  console.log('')
  console.log('Go to Supabase SQL Editor and run:')
  console.log('https://supabase.com/dashboard/project/abzurjxkxxtahdjrpvxk/editor')
  console.log('')
  console.log('File: supabase/migrations/026_fix_atomic_pairing.sql')
  process.exit(1)
}

console.log('')
console.log('═══════════════════════════════════════════════════════')
console.log('  Migration Applied ✅')
console.log('═══════════════════════════════════════════════════════')
console.log('')
console.log('Next steps:')
console.log('1. Start diagnostics: node scripts/watch-matchmaking.mjs')
console.log('2. Test with two browsers in same room')
console.log('3. Check for same matchId in both consoles')
console.log('')
