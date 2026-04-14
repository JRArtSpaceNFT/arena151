/**
 * POST /api/internal/logs
 * 
 * Internal logging endpoint for structured logs.
 * Forwards to external log aggregator (Axiom, Logtail, etc.)
 * 
 * This is fire-and-forget from the client - never blocks user actions.
 */

import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const log = await req.json()
    
    // Add server-side metadata
    const enrichedLog = {
      ...log,
      ip: req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown',
      userAgent: req.headers.get('user-agent') ?? 'unknown',
      serverTimestamp: new Date().toISOString(),
    }

    // Forward to log aggregator
    // Option 1: Axiom
    if (process.env.AXIOM_API_TOKEN && process.env.AXIOM_DATASET) {
      await fetch(`https://api.axiom.co/v1/datasets/${process.env.AXIOM_DATASET}/ingest`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.AXIOM_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([enrichedLog]),
      })
    }
    
    // Option 2: Logtail
    if (process.env.LOGTAIL_SOURCE_TOKEN) {
      await fetch('https://in.logtail.com/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.LOGTAIL_SOURCE_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(enrichedLog),
      })
    }

    // Option 3: Store in database (for basic setups)
    // await supabase.from('logs').insert(enrichedLog)

    return NextResponse.json({ ok: true })

  } catch (err) {
    // Silent fail - logging should never break the app
    console.error('[Internal Logs] Error:', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
