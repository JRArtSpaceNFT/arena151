#!/usr/bin/env tsx
/**
 * Apply SQL migration to Supabase via SQL editor API
 * Usage: tsx scripts/apply-migration.ts 018_atomic_matchmaking.sql
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join } from 'path'

// Load from env
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing required environment variables:')
  console.error('   NEXT_PUBLIC_SUPABASE_URL')
  console.error('   SUPABASE_SERVICE_KEY')
  console.error('\nMake sure .env.local is set up correctly.')
  process.exit(1)
}

const migrationFile = process.argv[2]
if (!migrationFile) {
  console.error('❌ Usage: tsx scripts/apply-migration.ts <filename>')
  console.error('   Example: tsx scripts/apply-migration.ts 018_atomic_matchmaking.sql')
  process.exit(1)
}

const migrationPath = join(process.cwd(), 'supabase', 'migrations', migrationFile)

console.log(`📦 Applying migration: ${migrationFile}`)
console.log(`📁 Path: ${migrationPath}`)

try {
  const sql = readFileSync(migrationPath, 'utf-8')
  console.log(`📄 Read ${sql.length} bytes`)
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    db: { schema: 'public' },
  })

  console.log('🔧 Executing SQL...')
  
  // Use Supabase's direct SQL execution
  // Note: This won't work via standard Supabase client - need direct DB access
  // For now, just output instructions
  
  console.log('\n' + '='.repeat(60))
  console.log('⚠️  MANUAL MIGRATION REQUIRED')
  console.log('='.repeat(60))
  console.log('Supabase requires migrations to be run via:')
  console.log('1. Supabase SQL Editor (web dashboard)')
  console.log('2. Direct psql connection')
  console.log('3. Supabase CLI')
  console.log('')
  console.log('Steps:')
  console.log('1. Go to: https://supabase.com/dashboard/project/abzurjxkxxtahdjrpvxk/sql/new')
  console.log('2. Copy the SQL from:')
  console.log(`   ${migrationPath}`)
  console.log('3. Paste and run in SQL Editor')
  console.log('='.repeat(60))
  
  // For testing, we can directly call the RPC once it exists
  console.log('\n💡 After migration, you can test with:')
  console.log('   npm run test:matchmaking')
  
} catch (err: any) {
  console.error('❌ Error:', err.message)
  process.exit(1)
}
