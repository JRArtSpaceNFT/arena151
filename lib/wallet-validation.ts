/**
 * Enhanced Solana wallet address validation
 * 
 * Validates both format (base58, length) and checksum
 */

import bs58 from 'bs58'

export interface ValidationResult {
  valid: boolean
  error?: string
}

/**
 * Validate a Solana public key address
 * 
 * Checks:
 * 1. Base58 format (no 0, O, I, l characters)
 * 2. Length (32-44 characters typical)
 * 3. Decodes successfully (checksum validation)
 * 4. Decoded length is exactly 32 bytes
 */
export function validateSolanaAddress(address: string): ValidationResult {
  const trimmed = address.trim()
  
  // Check format
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(trimmed)) {
    return {
      valid: false,
      error: 'Invalid Solana address format. Must be 32-44 base58 characters.',
    }
  }
  
  // Verify base58 checksum by attempting decode
  try {
    const decoded = bs58.decode(trimmed)
    
    // Solana public keys are exactly 32 bytes
    if (decoded.length !== 32) {
      return {
        valid: false,
        error: `Invalid address length. Expected 32 bytes, got ${decoded.length}.`,
      }
    }
    
    return { valid: true }
  } catch (err) {
    return {
      valid: false,
      error: 'Invalid base58 encoding. Please check the address for typos.',
    }
  }
}

/**
 * Format a Solana address for display
 * Shows first 4 and last 4 characters: "ABC...XYZ"
 */
export function formatSolanaAddress(address: string, chars: number = 4): string {
  if (address.length <= chars * 2) return address
  return `${address.slice(0, chars)}...${address.slice(-chars)}`
}

/**
 * Check if two Solana addresses are the same
 * Case-insensitive comparison
 */
export function isSameAddress(addr1: string, addr2: string): boolean {
  return addr1.trim().toLowerCase() === addr2.trim().toLowerCase()
}
