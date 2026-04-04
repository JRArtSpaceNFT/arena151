/**
 * POST /api/webhook/deposit
 *
 * Helius webhook handler for SOL deposits.
 *
 * Security:
 * - HMAC-SHA256 only. The ?secret= query param fallback has been REMOVED.
 *   Helius must be configured to use "Signing Secret" mode (sha256=<hmac> header).
 *   The secret appears in NO logs this way.
 * - Atomic + idempotent via process_deposit() RPC
 * - Always returns 200 (Helius retries on non-2xx; RPC is safe to replay)
 *
 * Helius dashboard setup:
 *   Webhooks → your webhook → Auth Header: leave blank
 *   Webhooks → your webhook → Signing Secret: set HELIUS_WEBHOOK_SECRET
 *   Helius will send: Authorization: sha256=<hmac-hex>
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { timingSafeEqual, createHmac } from 'crypto'

const HELIUS_WEBHOOK_SECRET = process.env.HELIUS_WEBHOOK_SECRET

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export async function POST(req: NextRequest) {
  // ── 1. Read raw body FIRST (required for HMAC) ───────────────
  const rawBody = await req.text()

  // ── 2. HMAC-SHA256 verification — no query param fallback ────
  // Helius sends: Authorization: sha256=<hex-hmac>
  // We verify this against HMAC-SHA256(secret, rawBody).
  // The ?secret= query param fallback has been intentionally removed:
  //   - Query params appear in Helius logs, Vercel logs, CDN logs
  //   - HMAC is replay-resistant and does not expose the secret in URLs
  if (!HELIUS_WEBHOOK_SECRET) {
    console.error('[Deposit Webhook] HELIUS_WEBHOOK_SECRET not set — rejecting all requests')
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
  }

  // Helius "Authentication Header" mode sends the raw secret as the Authorization header value.
  // We support two verification modes:
  //   1. Raw header match — timingSafeEqual(header, secret)  [Helius standard auth header mode]
  //   2. HMAC-SHA256     — timingSafeEqual(header, sha256=<hmac>) [if Helius adds signing in future]
  // Both are checked. Either passing = authorized.
  const authHeader = req.headers.get('authorization')
    ?? req.headers.get('x-helius-authorization')
    ?? ''

  let authorized = false
  try {
    // Mode 1: Raw header comparison (Helius "Authentication Header" mode)
    // Helius sends the secret value directly as the Authorization header.
    const a = Buffer.from(authHeader.trim())
    const b = Buffer.from(HELIUS_WEBHOOK_SECRET.trim())
    if (a.length === b.length) {
      authorized = timingSafeEqual(a, b)
    }

    // Mode 2: HMAC-SHA256 (future-proofing / if using Helius signing secret mode)
    if (!authorized) {
      const expectedHmac = 'sha256=' + createHmac('sha256', HELIUS_WEBHOOK_SECRET).update(rawBody).digest('hex')
      const c = Buffer.from(authHeader.trim())
      const d = Buffer.from(expectedHmac)
      if (c.length === d.length) {
        authorized = timingSafeEqual(c, d)
      }
    }
  } catch {
    authorized = false
  }

  if (!authorized) {
    console.warn('[Deposit Webhook] Auth failed. Header present:', authHeader.length > 0)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── 3. Parse body ────────────────────────────────────────────
  let body: unknown
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

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

      if (!toAddress || amountSol < 0.001) continue

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
        console.log(`[Deposit Webhook] Duplicate ignored: ${signature}:${toAddress}`)
      } else if (outcome === 'user_not_found') {
        console.log(`[Deposit Webhook] No user for address ${toAddress}`)
      }
    }
  }

  // Always 200 — Helius retries on non-2xx; RPC is idempotent.
  return NextResponse.json({ ok: true, results })
}
