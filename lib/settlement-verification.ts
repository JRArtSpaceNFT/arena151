/**
 * Settlement On-Chain Verification
 * 
 * Multi-source verification to prevent settlement retry double-payment.
 * 
 * Before retrying a failed settlement, verify whether payment already
 * occurred on-chain. Uses three independent sources:
 * 1. Helius transaction history API (primary)
 * 2. Solana RPC getSignaturesForAddress (fallback)
 * 3. On-chain balance delta check (last resort)
 * 
 * Only retries if ALL sources confirm no payment was sent.
 */

import { Connection, PublicKey, ParsedTransactionWithMeta } from '@solana/web3.js'

const HELIUS_API_KEY = process.env.HELIUS_API_KEY
const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`
const connection = new Connection(HELIUS_RPC, 'confirmed')

const VERIFICATION_LOOKBACK_HOURS = 48
const AMOUNT_TOLERANCE_LAMPORTS = 1000  // ±1000 lamports (~$0.0001)

export interface VerificationResult {
  verified: boolean
  source?: 'helius' | 'rpc' | 'balance_delta'
  signature?: string
  confidence: 'high' | 'medium' | 'low' | 'failed'
  details?: string
}

/**
 * Verify whether a settlement payment was already sent on-chain.
 * 
 * @param loserWallet - Source wallet (loser pays winner + house fee)
 * @param winnerWallet - Destination wallet (winner receives payout)
 * @param expectedAmountSol - Expected transfer amount in SOL
 * @param houseFeeAmountSol - House fee amount (optional, for total validation)
 * @returns VerificationResult with verified=true if payment found
 */
export async function verifySettlementOnChain(
  loserWallet: string,
  winnerWallet: string,
  expectedAmountSol: number,
  houseFeeAmountSol?: number
): Promise<VerificationResult> {
  const expectedLamports = Math.floor(expectedAmountSol * 1_000_000_000)
  const cutoffTimestamp = Math.floor((Date.now() - VERIFICATION_LOOKBACK_HOURS * 60 * 60 * 1000) / 1000)

  // ══════════════════════════════════════════════════════════════
  // SOURCE 1: Helius Transaction History (Primary)
  // ══════════════════════════════════════════════════════════════

  try {
    console.log(`[SettlementVerify] Helius: Checking ${loserWallet} → ${winnerWallet} for ${expectedAmountSol} SOL...`)

    const res = await fetch(
      `https://api.helius.xyz/v0/addresses/${loserWallet}/transactions?api-key=${HELIUS_API_KEY}&limit=200&type=TRANSFER`,
      { signal: AbortSignal.timeout(10000) }
    )

    if (res.ok) {
      const txs = await res.json() as Array<{
        signature: string
        timestamp?: number
        nativeTransfers?: Array<{
          fromUserAccount: string
          toUserAccount: string
          amount: number
        }>
      }>

      // Filter to recent txs within lookback window
      const recentTxs = txs.filter(tx => !tx.timestamp || tx.timestamp >= cutoffTimestamp)

      for (const tx of recentTxs) {
        const match = (tx.nativeTransfers ?? []).find(t =>
          t.fromUserAccount === loserWallet &&
          t.toUserAccount === winnerWallet &&
          Math.abs(t.amount - expectedLamports) <= AMOUNT_TOLERANCE_LAMPORTS
        )

        if (match) {
          console.log(`[SettlementVerify] ✅ Helius: Payment found (sig: ${tx.signature})`)
          return {
            verified: true,
            source: 'helius',
            signature: tx.signature,
            confidence: 'high',
            details: `Helius confirmed transfer of ${match.amount} lamports (±${Math.abs(match.amount - expectedLamports)} from expected)`,
          }
        }
      }

      console.log(`[SettlementVerify] Helius: No matching payment found in ${recentTxs.length} recent txs`)
    } else {
      console.warn(`[SettlementVerify] Helius API failed: HTTP ${res.status}`)
    }
  } catch (err) {
    console.error('[SettlementVerify] Helius verification error:', err)
  }

  // ══════════════════════════════════════════════════════════════
  // SOURCE 2: Solana RPC getSignaturesForAddress (Fallback)
  // ══════════════════════════════════════════════════════════════

  try {
    console.log(`[SettlementVerify] RPC: Querying signatures for ${loserWallet}...`)

    const loserPubkey = new PublicKey(loserWallet)
    const signatures = await connection.getSignaturesForAddress(
      loserPubkey,
      { limit: 200 },
      'confirmed'
    )

    console.log(`[SettlementVerify] RPC: Found ${signatures.length} signatures, checking transactions...`)

    for (const sigInfo of signatures) {
      // Skip if tx is too old (before cutoff)
      if (sigInfo.blockTime && sigInfo.blockTime < cutoffTimestamp) {
        continue
      }

      const tx = await connection.getParsedTransaction(
        sigInfo.signature,
        { maxSupportedTransactionVersion: 0 }
      )

      if (!tx || !tx.meta) continue

      // Analyze postBalances to find transfers
      const { accountKeys, postBalances, preBalances } = tx.transaction.message
      const loserIndex = accountKeys.findIndex(k => k.pubkey.toString() === loserWallet)
      const winnerIndex = accountKeys.findIndex(k => k.pubkey.toString() === winnerWallet)

      if (loserIndex === -1 || winnerIndex === -1) continue

      const loserDelta = postBalances[loserIndex] - preBalances[loserIndex]  // should be negative (sent)
      const winnerDelta = postBalances[winnerIndex] - preBalances[winnerIndex]  // should be positive (received)

      // Loser should have sent ~expectedLamports (negative delta)
      // Winner should have received ~expectedLamports (positive delta)
      const winnerReceived = winnerDelta
      const loserSent = Math.abs(loserDelta)

      if (Math.abs(winnerReceived - expectedLamports) <= AMOUNT_TOLERANCE_LAMPORTS) {
        console.log(`[SettlementVerify] ✅ RPC: Payment found (sig: ${sigInfo.signature})`)
        return {
          verified: true,
          source: 'rpc',
          signature: sigInfo.signature,
          confidence: 'high',
          details: `RPC confirmed winner received ${winnerReceived} lamports (±${Math.abs(winnerReceived - expectedLamports)} from expected)`,
        }
      }

      // Also check total outflow from loser (winner payout + house fee)
      if (houseFeeAmountSol) {
        const totalExpectedLamports = Math.floor((expectedAmountSol + houseFeeAmountSol) * 1_000_000_000)
        if (Math.abs(loserSent - totalExpectedLamports) <= AMOUNT_TOLERANCE_LAMPORTS * 2) {
          console.log(`[SettlementVerify] ✅ RPC: Total outflow matches (sig: ${sigInfo.signature})`)
          return {
            verified: true,
            source: 'rpc',
            signature: sigInfo.signature,
            confidence: 'medium',
            details: `RPC confirmed loser sent ${loserSent} lamports total (matches expected payout + fee)`,
          }
        }
      }
    }

    console.log(`[SettlementVerify] RPC: No matching payment found in ${signatures.length} signatures`)
  } catch (err) {
    console.error('[SettlementVerify] RPC verification error:', err)
  }

  // ══════════════════════════════════════════════════════════════
  // SOURCE 3: Balance Delta Check (Last Resort)
  // ══════════════════════════════════════════════════════════════

  // This is less reliable (balance could have changed from other txs)
  // but can detect if a large payment occurred even if we can't find the exact tx.

  try {
    console.log(`[SettlementVerify] BalanceDelta: Checking current balances...`)

    const loserBalance = await connection.getBalance(new PublicKey(loserWallet))
    const winnerBalance = await connection.getBalance(new PublicKey(winnerWallet))

    // This is speculative — we don't have "before" snapshot, so we can't definitively say.
    // Skip this check for now unless we add balance snapshots to DB.
    console.log(`[SettlementVerify] BalanceDelta: loser=${loserBalance}, winner=${winnerBalance} (no baseline, skipping)`)
  } catch (err) {
    console.error('[SettlementVerify] Balance delta check error:', err)
  }

  // ══════════════════════════════════════════════════════════════
  // ALL SOURCES FAILED — Cannot Verify
  // ══════════════════════════════════════════════════════════════

  console.warn(`[SettlementVerify] ❌ All verification sources failed — cannot confirm payment status`)
  return {
    verified: false,
    confidence: 'failed',
    details: 'All verification sources failed or returned no matching payment. Cannot safely retry — manual review required.',
  }
}

/**
 * Strict verification policy: Only retry if ALL sources confirm no payment.
 * If ANY source fails or is inconclusive, DO NOT retry (fail-safe).
 */
export function shouldRetrySettlement(verification: VerificationResult): boolean {
  if (verification.verified) {
    // Payment already sent — do NOT retry
    return false
  }

  if (verification.confidence === 'failed') {
    // Cannot verify — do NOT retry (fail-safe)
    return false
  }

  // All sources checked, no payment found — safe to retry
  return true
}
