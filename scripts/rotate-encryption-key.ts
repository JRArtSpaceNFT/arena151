/**
 * scripts/rotate-encryption-key.ts
 *
 * Safely rotates WALLET_ENCRYPTION_SECRET without losing any user funds.
 *
 * Usage:
 *   WALLET_ENCRYPTION_SECRET=<old-key> \
 *   WALLET_ENCRYPTION_SECRET_NEW=<new-key> \
 *   SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SERVICE_KEY=eyJ... \
 *   npx tsx scripts/rotate-encryption-key.ts [--dry-run]
 *
 * Safety guarantees:
 * - Reads ALL rows before modifying any
 * - Verifies decryption+re-encryption roundtrip for every key before writing
 * - Writes one row at a time with error handling
 * - On any failure: stops immediately without having corrupted remaining rows
 * - Dry-run mode: verify all keys can be re-encrypted without writing anything
 */

import { createClient } from '@supabase/supabase-js'
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const DRY_RUN = process.argv.includes('--dry-run')

// ── Encryption helpers ────────────────────────────────────────

function getKey(envVar: string): Buffer {
  const secret = process.env[envVar]
  if (!secret || secret.length !== 64) {
    throw new Error(`${envVar} must be a 64-char hex string (32 bytes). Got length: ${secret?.length}`)
  }
  return Buffer.from(secret, 'hex')
}

function decrypt(encryptedHex: string, key: Buffer): string {
  const iv        = Buffer.from(encryptedHex.slice(0, 24), 'hex')
  const authTag   = Buffer.from(encryptedHex.slice(24, 56), 'hex')
  const encrypted = Buffer.from(encryptedHex.slice(56), 'hex')
  const decipher  = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(authTag)
  return decipher.update(encrypted).toString('utf8') + decipher.final('utf8')
}

function encrypt(plaintext: string, key: Buffer): string {
  const iv      = randomBytes(12)
  const cipher  = createCipheriv('aes-256-gcm', key, iv)
  const enc     = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return iv.toString('hex') + authTag.toString('hex') + enc.toString('hex')
}

// ── Main ──────────────────────────────────────────────────────

async function main() {
  console.log(`\n🔑 Arena 151 — Encryption Key Rotation ${DRY_RUN ? '(DRY RUN)' : '(LIVE)'}`)
  console.log('─'.repeat(60))

  const oldKey = getKey('WALLET_ENCRYPTION_SECRET')
  const newKey = getKey('WALLET_ENCRYPTION_SECRET_NEW')

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )

  // Step 1: Load all profiles with encrypted keys
  console.log('\n📥 Loading profiles...')
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, sol_address, encrypted_private_key')
    .not('encrypted_private_key', 'is', null)

  if (error) throw new Error(`Failed to load profiles: ${error.message}`)
  console.log(`   Found ${profiles?.length ?? 0} profiles with encrypted keys`)

  // Step 2: Verify + re-encrypt all keys (no DB writes yet)
  console.log('\n🔍 Verifying all keys can be re-encrypted...')
  const reencrypted: Array<{ id: string; sol_address: string; new_encrypted: string }> = []
  let failures = 0

  for (const profile of profiles ?? []) {
    if (!profile.encrypted_private_key) continue
    try {
      // Decrypt with old key
      const plaintext = decrypt(profile.encrypted_private_key, oldKey)

      // Basic sanity check: Solana private keys are 64-byte base58
      if (plaintext.length < 80 || plaintext.length > 110) {
        throw new Error(`Suspicious key length: ${plaintext.length} chars`)
      }

      // Re-encrypt with new key
      const newEncrypted = encrypt(plaintext, newKey)

      // Verify roundtrip: decrypt new ciphertext with new key
      const verified = decrypt(newEncrypted, newKey)
      if (verified !== plaintext) {
        throw new Error('Roundtrip verification failed — new ciphertext does not decrypt to same value')
      }

      reencrypted.push({ id: profile.id, sol_address: profile.sol_address, new_encrypted: newEncrypted })
      process.stdout.write('.')
    } catch (err) {
      console.error(`\n❌ FAILED for profile ${profile.id} (${profile.sol_address}): ${err}`)
      failures++
    }
  }

  console.log(`\n\n✅ ${reencrypted.length} keys verified`)
  if (failures > 0) {
    console.error(`\n🚨 ${failures} keys FAILED verification. Do not proceed with rotation.`)
    console.error('   Fix the failures above before retrying.')
    process.exit(1)
  }

  if (DRY_RUN) {
    console.log('\n✅ Dry run complete — all keys can be re-encrypted safely.')
    console.log('   Run without --dry-run to apply changes.')
    return
  }

  // Step 3: Write new encrypted keys to DB one at a time
  console.log('\n📝 Writing re-encrypted keys to database...')
  let written = 0
  let writeFailures = 0

  for (const row of reencrypted) {
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ encrypted_private_key: row.new_encrypted })
      .eq('id', row.id)

    if (updateError) {
      console.error(`\n❌ WRITE FAILED for ${row.id}: ${updateError.message}`)
      writeFailures++
      // Stop immediately — don't risk partial state
      console.error('\n🚨 Stopping due to write failure. Database is in PARTIAL state.')
      console.error(`   ${written} of ${reencrypted.length} keys written.`)
      console.error('   Old key still valid for unwritten rows.')
      console.error('   Investigate the error and re-run. Old key is still active.')
      process.exit(1)
    }

    written++
    process.stdout.write('.')
  }

  console.log(`\n\n✅ ${written} keys re-encrypted and written to database.`)
  console.log('\n📋 Next steps:')
  console.log('   1. Update WALLET_ENCRYPTION_SECRET in Vercel to the new value')
  console.log('   2. Remove WALLET_ENCRYPTION_SECRET_NEW from env')
  console.log('   3. Redeploy Vercel to pick up the new key')
  console.log('   4. Test a withdrawal to confirm decryption works')
  console.log('   5. Confirm a settlement completes successfully')
  console.log('\n⚠️  Do NOT delete the old key until step 4-5 are confirmed working.')
}

main().catch(err => {
  console.error('\n💥 Fatal error:', err)
  process.exit(1)
})
