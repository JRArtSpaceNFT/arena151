import { Keypair, Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL, sendAndConfirmTransaction } from '@solana/web3.js'
import bs58 from 'bs58'
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

// ── Required environment variables ──────────────────────────
// HELIUS_API_KEY             — Helius RPC API key
// HELIUS_WEBHOOK_SECRET      — Helius webhook signing secret (HMAC-SHA256)
//                              Set in Helius dashboard → Webhooks → Signing Secret
// WALLET_ENCRYPTION_SECRET   — 64-char hex string (32 bytes) for AES-256-GCM key encryption
// ADMIN_SECRET               — Secret for /api/admin/* endpoints

// ── Helius RPC ────────────────────────────────────────────────
const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`
const connection = new Connection(HELIUS_RPC, 'confirmed')

export const TREASURY_ADDRESS = 'FSWXt6eniHH7fQw7eCyM4NVVPGAHXDdNdkZKLriaPy3C'
export const HOUSE_FEE_PCT = 0.05       // 5% on wagers
export const WITHDRAWAL_FEE_PCT = 0.005 // 0.5% on withdrawals
export const MIN_WITHDRAWAL_USD = 5    // $5 minimum
export const RENT_EXEMPT_MIN = 0.00089088  // Solana rent-exempt minimum for system accounts
export const GAS_BUFFER = 0.00002         // ~2x tx fee buffer

// ── AES-256-GCM encryption for private keys ──────────────────
// Key must be 32 bytes hex — set via WALLET_ENCRYPTION_SECRET env var
function getEncryptionKey(): Buffer {
  const secret = process.env.WALLET_ENCRYPTION_SECRET
  if (!secret || secret.length !== 64) {
    throw new Error('WALLET_ENCRYPTION_SECRET must be a 64-char hex string (32 bytes)')
  }
  return Buffer.from(secret, 'hex')
}

export function encryptPrivateKey(privateKeyBase58: string): string {
  const key = getEncryptionKey()
  const iv = randomBytes(12) // 96-bit IV for GCM
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(privateKeyBase58, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  // Format: iv(24 hex) + authTag(32 hex) + encrypted(hex)
  return iv.toString('hex') + authTag.toString('hex') + encrypted.toString('hex')
}

export function decryptPrivateKey(encryptedHex: string): string {
  // ⚠️  SECURITY: Legacy plaintext key fallback has been REMOVED.
  // All private keys must be encrypted with AES-256-GCM via encryptPrivateKey().
  // If you have unencrypted keys in the database, re-encrypt them before deploying.
  // Required env var: WALLET_ENCRYPTION_SECRET (64-char hex string)
  const key = getEncryptionKey()
  const iv = Buffer.from(encryptedHex.slice(0, 24), 'hex')
  const authTag = Buffer.from(encryptedHex.slice(24, 56), 'hex')
  const encrypted = Buffer.from(encryptedHex.slice(56), 'hex')
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(authTag)
  return decipher.update(encrypted) + decipher.final('utf8')
}

// ── Wallet generation ─────────────────────────────────────────
export function generateUserWallet(): { publicKey: string; encryptedPrivateKey: string } {
  const keypair = Keypair.generate()
  const publicKey = keypair.publicKey.toString()
  const privateKeyBase58 = bs58.encode(keypair.secretKey)
  const encryptedPrivateKey = encryptPrivateKey(privateKeyBase58)
  return { publicKey, encryptedPrivateKey }
}

// ── Live SOL price from CoinGecko ─────────────────────────────
let cachedSolPrice: number = 150
let lastPriceFetch: number = 0

export async function getLiveSolPrice(): Promise<number> {
  const now = Date.now()
  // Cache for 2 minutes to avoid rate limits
  if (now - lastPriceFetch < 120_000 && cachedSolPrice > 0) return cachedSolPrice
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd', {
      next: { revalidate: 120 },
    })
    const data = await res.json() as { solana?: { usd?: number } }
    const price = data?.solana?.usd
    if (price && price > 0) {
      cachedSolPrice = price
      lastPriceFetch = now
    }
  } catch {
    // Keep cached value on error
  }
  return cachedSolPrice
}

// Minimum withdrawal in SOL based on live price
export async function getMinWithdrawalSol(): Promise<number> {
  const price = await getLiveSolPrice()
  return MIN_WITHDRAWAL_USD / price
}

// ── SOL balance ───────────────────────────────────────────────
export async function getSolBalance(address: string): Promise<number> {
  try {
    const pubkey = new PublicKey(address)
    const lamports = await connection.getBalance(pubkey)
    return lamports / LAMPORTS_PER_SOL
  } catch {
    return 0
  }
}

// ── Send SOL ──────────────────────────────────────────────────
// FIX 3: Pre-flight balance check — verify on-chain wallet can cover
// the full requested amount BEFORE sending. If it can't, return a
// structured error instead of silently truncating the payment.
// This prevents the case where sendSol returns success with a truncated
// amount, causing DB/on-chain drift on every underfunded settlement.
export async function sendSol(
  encryptedOrRawPrivateKey: string,
  toAddress: string,
  amountSol: number,
  opts?: { skipPreflightCheck?: boolean }
): Promise<{ success: boolean; signature?: string; error?: string; actualLamports?: number; requestedLamports?: number }> {
  try {
    const privateKeyBase58 = decryptPrivateKey(encryptedOrRawPrivateKey)
    const secretKey = bs58.decode(privateKeyBase58)
    const fromKeypair = Keypair.fromSecretKey(secretKey)
    const toPubkey = new PublicKey(toAddress)

    const walletLamports = await connection.getBalance(fromKeypair.publicKey)
    const rentLamports = Math.ceil(RENT_EXEMPT_MIN * LAMPORTS_PER_SOL)
    const gasLamports = Math.ceil(GAS_BUFFER * LAMPORTS_PER_SOL)
    const maxSendable = walletLamports - rentLamports - gasLamports
    const requestedLamports = Math.floor(amountSol * LAMPORTS_PER_SOL)

    if (maxSendable <= 0) {
      return { success: false, error: 'Insufficient funds after rent-exempt reserve', requestedLamports }
    }

    // FIX 3: Strict pre-flight — if wallet cannot cover the full requested amount,
    // fail explicitly rather than sending a truncated payment.
    // Exception: skipPreflightCheck=true is used for house fee (best-effort, truncation ok).
    if (!opts?.skipPreflightCheck && requestedLamports > maxSendable) {
      return {
        success: false,
        error: `Wallet underfunded: has ${maxSendable} sendable lamports but ${requestedLamports} requested. Diff: ${requestedLamports - maxSendable} lamports. Settlement aborted to prevent partial payment.`,
        actualLamports: maxSendable,
        requestedLamports,
      }
    }

    const lamports = Math.min(requestedLamports, maxSendable)

    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: fromKeypair.publicKey,
        toPubkey,
        lamports,
      })
    )

    const signature = await sendAndConfirmTransaction(connection, transaction, [fromKeypair])
    return { success: true, signature, actualLamports: lamports, requestedLamports }
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}

// ── Fee calculations ──────────────────────────────────────────
export function calcPrizePool(wagerPerPlayer: number, numPlayers: number = 2): {
  totalPot: number
  houseFee: number
  winnerPayout: number
} {
  const totalPot = wagerPerPlayer * numPlayers
  const houseFee = totalPot * HOUSE_FEE_PCT
  const winnerPayout = totalPot - houseFee
  return { totalPot, houseFee, winnerPayout }
}

export function calcWithdrawal(requestedSol: number): {
  fee: number
  netAmount: number
} {
  const fee = requestedSol * WITHDRAWAL_FEE_PCT
  const netAmount = requestedSol - fee
  return { fee, netAmount }
}
