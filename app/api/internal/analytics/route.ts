/**
 * POST /api/internal/analytics
 * 
 * Internal analytics endpoint for event tracking.
 * Stores events in DB for custom dashboards.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { event, properties, timestamp, url, userAgent } = await req.json()

    // Store in analytics_events table (create if doesn't exist)
    await supabaseAdmin.from('analytics_events').insert({
      event_name: event,
      properties: properties || {},
      timestamp: new Date(timestamp),
      url,
      user_agent: userAgent,
      ip: req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown',
    })

    return NextResponse.json({ ok: true })

  } catch (err) {
    // Silent fail - analytics should never break the app
    console.error('[Internal Analytics] Error:', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
