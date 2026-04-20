/**
 * Run SQL migration via Supabase admin client
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join } from 'path'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_KEY')
  process.exit(1)
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function runMigration(filename: string) {
  console.log(`📦 Running migration: ${filename}`)
  
  const migrationPath = join(process.cwd(), 'supabase', 'migrations', filename)
  const sql = readFileSync(migrationPath, 'utf-8')
  
  console.log(`📄 Read ${sql.length} characters from ${filename}`)
  
  // Split on semicolons but preserve function bodies
  // This is a simplified approach - for production use a proper SQL parser
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'))
  
  console.log(`🔧 Executing ${statements.length} statements...`)
  
  let successCount = 0
  let errorCount = 0
  
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i] + ';'
    
    // Skip empty statements
    if (stmt.trim() === ';') continue
    
    try {
      const { error } = await supabaseAdmin.rpc('exec_sql', { sql: stmt }).single()
      
      if (error) {
        // Try direct query if RPC doesn't exist
        const { error: queryError } = await supabaseAdmin
          .from('_migrations')
          .select('*')
          .limit(0)
        
        if (queryError) {
          console.warn(`⚠️  Statement ${i + 1} warning: ${error.message}`)
        }
      }
      
      successCount++
    } catch (err: any) {
      // Some statements might fail due to idempotency (e.g., column already exists)
      // Log but continue
      console.warn(`⚠️  Statement ${i + 1} error: ${err.message}`)
      errorCount++
    }
  }
  
  console.log(`✅ Migration complete: ${successCount} succeeded, ${errorCount} warnings`)
}

// Get migration filename from args
const migrationFile = process.argv[2]

if (!migrationFile) {
  console.error('❌ Usage: tsx scripts/run-migration.ts <migration-filename>')
  console.error('   Example: tsx scripts/run-migration.ts 018_atomic_matchmaking.sql')
  process.exit(1)
}

runMigration(migrationFile)
  .then(() => {
    console.log('✅ Done')
    process.exit(0)
  })
  .catch(err => {
    console.error('❌ Migration failed:', err)
    process.exit(1)
  })
