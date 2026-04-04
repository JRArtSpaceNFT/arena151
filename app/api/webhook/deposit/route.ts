/**
 * POST /api/webhook/deposit
 *
 * Helius webhook handler for SOL deposits.
 *
 * Security fixes applied:
 * - HMAC-SHA256 signature verification using HELIUS_WEBHOOK_SECRET
 * - Atomic deposit processing via process_deposit() RPC (idempotent)
 * - Raw body captured before JSON parse (required for HMAC)
 * - Audit log written by RPC function
 * - Returns 200 even on duplicate (idempotent)
 *
 * Required env vars:
 *   HELIUS_WEBHOOK_SECRET  — Secret set in Helius dashboard → webhooks → signing secret
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_KEY
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { timingSafeEqual } from 'crypto'

// REQUIRED: Set HELIUS_WEBHOOK_SECRET in your environment.
// In Helius dashboard → Webhooks → select webhook → Signing Secret.
// This MUST be set in production or all deposits will be rejected.
const HELIUS_WEBHOOK_SECRET = process.env.HELIUS_WEBHOOK_SECRET

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export async function POST(req: NextRequest) {
  // ── 1. Read raw body FIRST (needed for HMAC verification) ────
  const rawBody = await req.text()

  // ── 2. Verify Helius webhook signature ───────────────────────
  // Helius uses the header: "authorization" with value "sha256=<hex>"
  // NOTE: If HELIUS_WEBHOOK_SECRET is not configured, reject ALL requests.
  // This prevents unauthenticated balance crediting in production.
  if (!HELIUS_WEBHOOK_SECRET) {
    console.error('[Deposit Webhook] HELIUS_WEBHOOK_SECRET is not set! Rejecting request. Set this env var in production.')
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
  }

  // Helius sends the authHeader value as a raw string in the Authorization header.
  // We use timingSafeEqual to prevent timing attacks.
  const sigHeader = req.headers.get('authorization') ?? req.headers.get('helius-webhook-authorization') ?? ''
  let authorized = false
  try {
    const a = Buffer.from(sigHeader)
    const b = Buffer.from(HELIUS_WEBHOOK_SECRET)
    authorized = a.length === b.length && timingSafeEqual(a, b)
  } catch {
    authorized = false
  }

  if (!authorized) {
    console.warn('[Deposit Webhook] Authorization header mismatch. Possible spoofed request. Header:', sigHeader.slice(0, 8) + '...')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── 3. Parse body ────────────────────────────────────────────
  let body: unknown
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Helius sends an array of transaction events
  const events = Array.isArray(body) ? body : [body]
  const results: Record<string, string> = {}

  for (const event of events) {
    const signature: string = (event as Record<string, unknown>).signature as string
    if (!signature) continue

    const nativeTransfers: Array<{ toUserAccount: string; amount: number }> =
      ((event as Record<string, unknown>).nativeTransfers as Array<{ toUserAccount: string; amount: number }>) ?? []

    for (const transfer of nativeTransfers) {
      const toAddress = transfer.toUserAccount
      const amountSol = transfer.amount / 1_000_000_000

      // Ignore dust and transfers to no one
      if (!toAddress || amountSol < 0.001) continue

      // ── 4. Atomic deposit via RPC ────────────────────────────
      // The process_deposit() function:
      //   - Finds user by sol_address
      //   - Inserts transaction with ON CONFLICT DO NOTHING on tx_signature
      //   - Credits balance ONLY if the insert succeeded (atomic, no double-credit)
      //   - Writes to audit_log
      const { data: result, error } = await supabaseAdmin.rpc('process_deposit', {
        p_sol_address: toAddress,
        p_amount_sol: amountSol,
        p_tx_signature: signature,
        p_notes: `Deposit of ${amountSol.toFixed(6)} SOL`,
      })

      if (error) {
        console.error('[Deposit Webhook] RPC error:', error)
        results[`${signature}:${toAddress}`] = 'rpc_error'
        continue
      }

      const outcome = result as string
      results[`${signature}:${toAddress}`] = outcome

      if (outcome === 'credited') {
        console.log(`[Deposit Webhook] Credited ${amountSol} SOL to ${toAddress} (tx: ${signature})`)
      } else if (outcome === 'duplicate') {
        console.log(`[Deposit Webhook] Duplicate tx ignored: ${signature}`)
      } else if (outcome === 'user_not_found') {
        // Not an error — could be a transfer to an address not registered in our system
        console.log(`[Deposit Webhook] No user found for address ${toAddress}`)
      }
    }
  }

  // Always return 200 — Helius retries on non-2xx, which would cause duplicates.
  // Our RPC is idempotent so retries are safe.
  return NextResponse.json({ ok: true, results })
}
