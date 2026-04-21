#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'
import { Connection, PublicKey } from '@solana/web3.js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

const connection = new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com')

const userId = 'fa8c3977-93a5-4c94-a662-330465e9feb2'

console.log('🔍 Checking balance reconciliation...\n')

// Get DB balance
const { data: profile } = await supabase
  .from('profiles')
  .select('username, balance, locked_balance, wallet_address')
  .eq('id', userId)
  .single()

console.log('📊 Database state:')
console.log(`   Username: ${profile.username}`)
console.log(`   Balance: ${profile.balance} SOL`)
console.log(`   Locked: ${profile.locked_balance} SOL`)
console.log(`   Available: ${profile.balance - profile.locked_balance} SOL`)
console.log(`   Wallet: ${profile.wallet_address}`)

// Get actual wallet balance
if (profile.wallet_address) {
  try {
    const pubkey = new PublicKey(profile.wallet_address)
    const lamports = await connection.getBalance(pubkey)
    const actualBalance = lamports / 1e9
    
    console.log('\n💰 Actual wallet balance:')
    console.log(`   ${actualBalance} SOL`)
    
    const diff = actualBalance - (profile.balance + profile.locked_balance)
    if (Math.abs(diff) > 0.001) {
      console.log('\n⚠️  MISMATCH detected!')
      console.log(`   Difference: ${diff.toFixed(4)} SOL`)
      console.log('\nTo reconcile, update DB to match wallet:')
      console.log(`   UPDATE profiles SET balance = ${actualBalance}, locked_balance = 0 WHERE id = '${userId}';`)
    } else {
      console.log('\n✅ Balances match (within 0.001 SOL)')
    }
  } catch (err) {
    console.log('\n❌ Could not fetch wallet balance:', err.message)
  }
}

process.exit(0)
