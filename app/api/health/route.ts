import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

/**
 * GET /api/health
 *
 * Returns status of all critical systems.
 * Safe to expose publicly — no secrets returned, only presence/absence of env vars.
 *
 * Response shape:
 * {
 *   ok: boolean,
 *   checks: {
 *     env: Record<string, boolean>,
 *     supabase: boolean
 *   },
 *   timestamp: string
 * }
 */
export async function GET() {
  const envChecks: Record<string, boolean> = {
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_KEY: !!process.env.SUPABASE_SERVICE_KEY,
    HELIUS_WEBHOOK_SECRET: !!process.env.HELIUS_WEBHOOK_SECRET,
    ENCRYPTION_SECRET: !!process.env.ENCRYPTION_SECRET,
    ADMIN_SECRET: !!process.env.ADMIN_SECRET,
  }

  let supabaseOk = false
  try {
    const { error } = await supabaseAdmin.rpc('process_deposit', {
      p_sol_address: '__health_check__',
      p_amount_sol: 0,
      p_tx_signature: '__health_check__',
    })
    // 'user_not_found' is the expected response — it means Supabase is reachable
    // and the RPC function exists. Any error response other than a network error
    // means the DB is up.
    supabaseOk = !error || error.message !== 'fetch failed'
  } catch {
    supabaseOk = false
  }

  const allEnvOk = Object.values(envChecks).every(Boolean)
  const ok = allEnvOk && supabaseOk

  return NextResponse.json(
    {
      ok,
      checks: {
        env: envChecks,
        supabase: supabaseOk,
      },
      timestamp: new Date().toISOString(),
    },
    { status: ok ? 200 : 503 },
  )
}
