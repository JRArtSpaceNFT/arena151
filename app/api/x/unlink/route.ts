/**
 * X OAuth Unlink Route
 * Disconnects X account from Arena 151 profile
 * 
 * Security:
 * - Requires authenticated session
 * - User can only unlink their own account
 * - Logs audit event
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUserId } from '@/lib/auth-server'
import { unlinkXAccountFromProfile, logOAuthEvent } from '@/lib/x-oauth-db'

export async function POST(request: NextRequest) {
  try {
    console.log('[X OAuth Unlink] Request received')

    // 1. Verify user is logged in
    const userId = await getCurrentUserId()
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      )
    }

    console.log('[X OAuth Unlink] User:', userId)

    // 2. Unlink X account from profile
    await unlinkXAccountFromProfile(userId)

    // 3. Log audit event
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined
    const userAgent = request.headers.get('user-agent') || undefined

    await logOAuthEvent({
      userId,
      action: 'disconnect',
      ipAddress,
      userAgent,
    })

    console.log('[X OAuth Unlink] Successfully unlinked')

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('[X OAuth Unlink] Error:', error)
    
    const errorMessage = error instanceof Error ? error.message : 'Failed to unlink X account'
    
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    )
  }
}
