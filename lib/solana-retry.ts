/**
 * Retry utilities for Solana transactions
 * 
 * Handles transient failures (RPC down, network issues, rate limits)
 * with exponential backoff
 */

import { sendSol } from './solana'

interface SendSolResult {
  success: boolean
  signature?: string
  error?: string
  actualLamports?: number
  requestedLamports?: number
}

/**
 * Send SOL with automatic retry on transient failures
 * 
 * @param maxRetries - Maximum retry attempts (default: 3)
 * @returns SendSolResult with success status and signature or error
 */
export async function sendSolWithRetry(
  encryptedPrivateKey: string,
  toAddress: string,
  amount: number,
  options?: {
    maxRetries?: number
    skipPreflightCheck?: boolean
  }
): Promise<SendSolResult> {
  const maxRetries = options?.maxRetries ?? 3
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const result = await sendSol(
      encryptedPrivateKey,
      toAddress,
      amount,
      { skipPreflightCheck: options?.skipPreflightCheck }
    )
    
    if (result.success) {
      return result
    }
    
    // Check if error is retryable
    const isRetryable = isRetryableError(result.error || '')
    
    if (!isRetryable || attempt === maxRetries) {
      // Permanent failure or max retries reached
      return result
    }
    
    // Exponential backoff: 1s, 2s, 4s
    const delayMs = 1000 * Math.pow(2, attempt - 1)
    console.log(`[Solana Retry] Attempt ${attempt} failed, retrying in ${delayMs}ms...`)
    await new Promise(r => setTimeout(r, delayMs))
  }
  
  return { success: false, error: 'Max retries exceeded' }
}

/**
 * Check if an error is retryable (transient network/RPC issue)
 */
function isRetryableError(error: string): boolean {
  const retryablePatterns = [
    '429',           // Rate limit
    'timeout',       // Network timeout
    'network',       // Network error
    '503',           // Service unavailable
    '502',           // Bad gateway
    'ECONNRESET',    // Connection reset
    'ETIMEDOUT',     // Socket timeout
    'too many requests', // Rate limit (lowercase)
  ]
  
  const errorLower = error.toLowerCase()
  return retryablePatterns.some(pattern => errorLower.includes(pattern.toLowerCase()))
}
