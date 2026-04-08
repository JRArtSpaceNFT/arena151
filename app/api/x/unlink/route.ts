/**
 * X Account Unlink Route
 * Disconnects linked X account from Arena 151 profile
 * 
 * Flow:
 * 1. Verify user is logged in
 * 2. Clear all X account fields from profile
 * 3. Log unlink action
 * 4. Return success response
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUserIdOrThrow } from '@/lib/auth-server'
import { clearProfileXAccount, logXConnectionAudit, getProfileByUserId } from '@/lib/db-server'

export async function POST(request: NextRequest) {
  try {
    // 1. Verify user is logged in
    const userId = await getCurrentUserIdOrThrow()

    // 2. Get current X account info (for audit log)
    const profile = await getProfileByUserId(userId)
    const xUserId = profile?.x_user_id
    const xUsername = profile?.x_username

    // 3. Clear X account info from profile
    await clearProfileXAccount(userId)

    // 4. Log unlink action
    if (xUserId && xUsername) {
      await logXConnectionAudit({
        user_id: userId,
        action: 'unlinked',
        x_user_id: xUserId,
        x_username: xUsername,
      })
    }

    // 5. Return success
    return NextResponse.json({
      success: true,
      message: 'X account unlinked successfully',
    })

  } catch (error) {
    console.error('X unlink error:', error)
    
    const errorMessage = error instanceof Error ? error.message : 'Failed to unlink X account'
    
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    )
  }
}
