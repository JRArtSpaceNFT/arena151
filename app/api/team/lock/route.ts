/**
 * POST /api/team/lock
 * 
 * Lock team configuration before joining paid PVP matchmaking
 * 
 * Required fields:
 * - trainerId: string
 * - team: number[] (6 pokemon IDs)
 * - lockedOrder: number[] (6 indices for battle order)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

const supabaseAnon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: NextRequest) {
  try {
    // Auth
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.slice(7)
    const { data: { user }, error: authError } = await supabaseAnon.auth.getUser(token)
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse body
    const { trainerId, team, lockedOrder } = await req.json()

    // Validate
    if (!trainerId || typeof trainerId !== 'string') {
      return NextResponse.json({ error: 'trainerId required (string)' }, { status: 400 })
    }

    if (!Array.isArray(team) || team.length !== 6) {
      return NextResponse.json({ error: 'team must be array of 6 pokemon IDs' }, { status: 400 })
    }

    if (!Array.isArray(lockedOrder) || lockedOrder.length !== 6) {
      return NextResponse.json({ error: 'lockedOrder must be array of 6 indices' }, { status: 400 })
    }

    // Validate all team members are valid pokemon IDs (1-151)
    for (const id of team) {
      if (typeof id !== 'number' || id < 1 || id > 151) {
        return NextResponse.json({ error: `Invalid pokemon ID: ${id}` }, { status: 400 })
      }
    }

    // Validate locked order contains 0-5 exactly once
    const orderSet = new Set(lockedOrder)
    if (orderSet.size !== 6 || !Array.from(orderSet).every(i => i >= 0 && i < 6)) {
      return NextResponse.json({ error: 'lockedOrder must contain 0-5 exactly once' }, { status: 400 })
    }

    console.log(`[TeamLock] User ${user.id} locking: trainer=${trainerId}, team=${team.join(',')}`)

    // Update profile
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        current_trainer_id: trainerId,
        current_team: team,
        current_locked_order: lockedOrder,
        team_locked_at: new Date().toISOString(),
      })
      .eq('id', user.id)

    if (updateError) {
      console.error('[TeamLock] Update failed:', updateError)
      return NextResponse.json({ error: 'Failed to lock team' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Team locked successfully',
      trainerId,
      teamSize: team.length,
      lockedAt: new Date().toISOString(),
    })

  } catch (err) {
    console.error('[TeamLock] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
