#!/usr/bin/env node

import { Connection, PublicKey } from '@solana/web3.js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const connection = new Connection(
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com'
)

const walletAddress = process.argv[2]

if (!walletAddress) {
  console.error('Usage: node check-wallet-balance.mjs <wallet-address>')
  process.exit(1)
}

try {
  const pubkey = new PublicKey(walletAddress)
  const lamports = await connection.getBalance(pubkey)
  const sol = lamports / 1e9
  
  console.log(`\nWallet: ${walletAddress}`)
  console.log(`Balance: ${sol} SOL (${lamports} lamports)`)
  console.log(`\nRent exempt minimum: ~0.00203928 SOL`)
  console.log(`Spendable: ~${(sol - 0.00203928 - 0.001).toFixed(6)} SOL\n`)
} catch (err) {
  console.error('Error:', err.message)
  process.exit(1)
}
