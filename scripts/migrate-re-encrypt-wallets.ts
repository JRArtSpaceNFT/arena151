/**
 * Wallet Re-Encryption Migration
 * 
 * Run this ONCE after rotating WALLET_ENCRYPTION_SECRET.
 * 
 * Usage:
 *   OLD_WALLET_KEY=<old-key> NEW_WALLET_KEY=<new-key> npx tsx scripts/migrate-re-encrypt-wallets.ts
 * 
 * What it does:
 * 1. Reads all profiles with encrypted_private_key
 * 2. Decrypts each with OLD_WALLET_KEY
 * 3. Re-encrypts with NEW_WALLET_KEY
 * 4. Updates profiles table with new encrypted_private_key + key_version=2
 * 5. Logs progress and errors
 * 
 * CRITICAL: Test on staging/dev first. Backup database before running on production.
 */

import { createClient } from '@supabase/supabase-js'
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

// ═══════════════════════════════════════════════════════════════
// Environment Validation
// ═══════════════════════════════════════════════════════════════

const OLD_WALLET_KEY = process.env.OLD_WALLET_KEY
const NEW_WALLET_KEY = process.env.NEW_WALLET_KEY
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY

if (!OLD_WALLET_KEY || OLD_WALLET_KEY.length !== 64) {
  console.error('❌ OLD_WALLET_KEY must be a 64-char hex string')
  process.exit(1)
}

if (!NEW_WALLET_KEY || NEW_WALLET_KEY.length !== 64) {
  console.error('❌ NEW_WALLET_KEY must be a 64-char hex string')
  process.exit(1)
}

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY required')
  process.exit(1)
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// ═══════════════════════════════════════════════════════════════
// Encryption Helpers
// ═══════════════════════════════════════════════════════════════

function decryptPrivateKey(encryptedHex: string, keyHex: string): string {
  const key = Buffer.from(keyHex, 'hex')
  const iv = Buffer.from(encryptedHex.slice(0, 24), 'hex')
  const authTag = Buffer.from(encryptedHex.slice(24, 56), 'hex')
  const encrypted = Buffer.from(encryptedHex.slice(56), 'hex')
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(authTag)
  return decipher.update(encrypted, undefined, 'utf8') + decipher.final('utf8')
}

function encryptPrivateKey(privateKeyBase58: string, keyHex: string): string {
  const key = Buffer.from(keyHex, 'hex')
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(privateKeyBase58, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return iv.toString('hex') + authTag.toString('hex') + encrypted.toString('hex')
}

// ═══════════════════════════════════════════════════════════════
// Migration Logic
// ═══════════════════════════════════════════════════════════════

async function migrateWallets() {
  console.log('🔐 Wallet Re-Encryption Migration')
  console.log('=================================')
  console.log('')

  // Step 1: Add key_version column if it doesn't exist
  console.log('Step 1: Adding key_version column...')
  const { error: alterError } = await supabaseAdmin.rpc('exec_sql', {
    sql: 'ALTER TABLE profiles ADD COLUMN IF NOT EXISTS key_version INTEGER DEFAULT 1;'
  }).catch(() => {
    // Column may already exist from manual migration — that's fine
    return { error: null }
  })

  if (alterError) {
    console.warn('⚠️  Could not add key_version column (may already exist):', alterError.message)
  } else {
    console.log('✅ key_version column ready')
  }

  console.log('')

  // Step 2: Load all profiles with encrypted keys
  console.log('Step 2: Loading profiles...')
  const { data: profiles, error: loadError } = await supabaseAdmin
    .from('profiles')
    .select('id, username, encrypted_private_key, key_version')
    .not('encrypted_private_key', 'is', null)

  if (loadError) {
    console.error('❌ Failed to load profiles:', loadError)
    process.exit(1)
  }

  if (!profiles || profiles.length === 0) {
    console.log('⚠️  No profiles with encrypted keys found. Nothing to migrate.')
    process.exit(0)
  }

  console.log(`✅ Loaded ${profiles.length} profiles`)
  console.log('')

  // Step 3: Re-encrypt each wallet
  console.log('Step 3: Re-encrypting wallets...')
  let successCount = 0
  let failCount = 0
  const errors: Array<{ userId: string; username: string; error: string }> = []

  for (const profile of profiles) {
    try {
      // Skip if already migrated to version 2
      if (profile.key_version === 2) {
        console.log(`⏭️  Skipping ${profile.username} (already v2)`)
        successCount++
        continue
      }

      // Decrypt with old key
      const privateKeyBase58 = decryptPrivateKey(profile.encrypted_private_key, OLD_WALLET_KEY)

      // Re-encrypt with new key
      const newEncrypted = encryptPrivateKey(privateKeyBase58, NEW_WALLET_KEY)

      // Update database
      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({
          encrypted_private_key: newEncrypted,
          key_version: 2,
        })
        .eq('id', profile.id)

      if (updateError) {
        throw new Error(`DB update failed: ${updateError.message}`)
      }

      console.log(`✅ Re-encrypted ${profile.username} (${profile.id})`)
      successCount++
    } catch (err) {
      console.error(`❌ Failed to re-encrypt ${profile.username}:`, err instanceof Error ? err.message : String(err))
      failCount++
      errors.push({
        userId: profile.id,
        username: profile.username,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  console.log('')
  console.log('=================================')
  console.log(`✅ Success: ${successCount}/${profiles.length}`)
  console.log(`❌ Failed: ${failCount}/${profiles.length}`)

  if (errors.length > 0) {
    console.log('')
    console.log('Failed profiles:')
    errors.forEach(e => console.log(`  - ${e.username} (${e.userId}): ${e.error}`))
    console.log('')
    console.log('⚠️  Manual intervention required for failed profiles.')
    process.exit(1)
  }

  console.log('')
  console.log('🎉 Migration complete! All wallets re-encrypted with new key.')
  console.log('🔴 Next step: Update WALLET_ENCRYPTION_SECRET in Vercel env vars to NEW_WALLET_KEY')
  console.log('🔴 Then deploy to production.')
}

// Run migration
migrateWallets().catch(err => {
  console.error('💥 Migration failed:', err)
  process.exit(1)
})
