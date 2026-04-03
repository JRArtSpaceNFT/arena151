import { Keypair, Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL, sendAndConfirmTransaction } from '@solana/web3.js'
import bs58 from 'bs58'

// Helius RPC endpoint — much faster and more reliable than public endpoint
const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`
const connection = new Connection(HELIUS_RPC, 'confirmed')

export const TREASURY_ADDRESS = 'FSWXt6eniHH7fQw7eCyM4NVVPGAHXDdNdkZKLriaPy3C'
export const HOUSE_FEE_PCT = 0.05   // 5% on wagers
export const WITHDRAWAL_FEE_PCT = 0.005  // 0.5% on withdrawals

// Generate a new Solana keypair for a user
export function generateUserWallet(): { publicKey: string; encryptedPrivateKey: string } {
  const keypair = Keypair.generate()
  const publicKey = keypair.publicKey.toString()
  // Store private key as base58 — in production use proper encryption (AES-256 with ENCRYPTION_SECRET)
  const encryptedPrivateKey = bs58.encode(keypair.secretKey)
  return { publicKey, encryptedPrivateKey }
}

// Get SOL balance for an address
export async function getSolBalance(address: string): Promise<number> {
  try {
    const pubkey = new PublicKey(address)
    const lamports = await connection.getBalance(pubkey)
    return lamports / LAMPORTS_PER_SOL
  } catch {
    return 0
  }
}

// Send SOL from one address to another (requires private key of sender)
export async function sendSol(
  fromPrivateKeyBase58: string,
  toAddress: string,
  amountSol: number
): Promise<{ success: boolean; signature?: string; error?: string }> {
  try {
    const secretKey = bs58.decode(fromPrivateKeyBase58)
    const fromKeypair = Keypair.fromSecretKey(secretKey)
    const toPubkey = new PublicKey(toAddress)

    const lamports = Math.floor(amountSol * LAMPORTS_PER_SOL)

    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: fromKeypair.publicKey,
        toPubkey,
        lamports,
      })
    )

    const signature = await sendAndConfirmTransaction(connection, transaction, [fromKeypair])
    return { success: true, signature }
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}

// Calculate prize pool after house fee
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

// Calculate withdrawal after fee
export function calcWithdrawal(requestedSol: number): {
  fee: number
  netAmount: number
} {
  const fee = requestedSol * WITHDRAWAL_FEE_PCT
  const netAmount = requestedSol - fee
  return { fee, netAmount }
}
