/**
 * X OAuth Callback Route - Step 2
 * Handles OAuth 1.0a callback from X
 * 
 * Flow:
 * 1. X redirects here with oauth_token + oauth_verifier
 * 2. Verify current user session exists
 * 3. Load pending OAuth attempt from database by oauth_token
 * 4. Verify attempt is not expired
 * 5. Verify oauth_token matches stored request token
 * 6. Exchange request token + verifier for access token
 * 7. Get authenticated X user details
 * 8. Check if X account already linked to different Arena 151 user
 * 9. Link X account to current user profile
 * 10. Mark OAuth attempt as completed
 * 11. Log success audit event
 * 12. Redirect to profile page with success
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUserId } from '@/lib/auth-server'
import { getAccessToken, verifyCredentials } from '@/lib/x-oauth-1-0a'
import {
  getOAuthAttemptByToken,
  completeOAuthAttempt,
  failOAuthAttempt,
  logOAuthEvent,
  linkXAccountToProfile,
  isXAccountLinked,
} from '@/lib/x-oauth-db'

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  const baseUrl = process.env.APP_BASE_URL || 'http://localhost:3002'
  
  try {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('[CONNECT_X_CALLBACK_HIT] OAuth callback received')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    // 1. Extract callback parameters from X
    const searchParams = request.nextUrl.searchParams
    const oauth_token = searchParams.get('oauth_token')
    const oauth_verifier = searchParams.get('oauth_verifier')
    const denied = searchParams.get('denied')

    console.log('[CONNECT_X_CALLBACK] oauth_token:', oauth_token?.substring(0, 10) + '...')
    console.log('[CONNECT_X_CALLBACK] oauth_verifier:', oauth_verifier?.substring(0, 10) + '...')
    console.log('[CONNECT_X_CALLBACK] denied:', denied)

    // Handle user denied authorization
    if (denied) {
      console.log('[CONNECT_X_ERROR] User denied authorization')
      return NextResponse.redirect(`${baseUrl}/?x_error=authorization_denied`)
    }

    if (!oauth_token || !oauth_verifier) {
      console.error('[CONNECT_X_ERROR] Missing oauth_token or oauth_verifier')
      throw new Error('Missing callback parameters')
    }

    // 2. Verify current user is logged in
    const currentUserId = await getCurrentUserId()
    
    if (!currentUserId) {
      console.error('[CONNECT_X_ERROR] No authenticated session on callback')
      throw new Error('Session expired. Please log in and try again.')
    }

    console.log('[CONNECT_X_AUTH_OK] Current user:', currentUserId)

    // 3. Load pending OAuth attempt from database
    console.log('[CONNECT_X_DB_LOOKUP] Loading attempt by token...')
    
    const attempt = await getOAuthAttemptByToken(oauth_token)
    
    if (!attempt) {
      console.error('[CONNECT_X_ERROR] No pending OAuth attempt found')
      throw new Error('OAuth session expired or invalid. Please try connecting again.')
    }

    console.log('[CONNECT_X_DB_FOUND] Attempt ID:', attempt.id)
    console.log('[CONNECT_X_DB_FOUND] User ID:', attempt.user_id)
    console.log('[CONNECT_X_DB_FOUND] Status:', attempt.status)
    console.log('[CONNECT_X_DB_FOUND] Expires at:', attempt.expires_at)

    // 4. Verify oauth attempt belongs to current user
    if (attempt.user_id !== currentUserId) {
      console.error('[CONNECT_X_ERROR] OAuth user mismatch')
      console.error('Attempt user:', attempt.user_id)
      console.error('Current user:', currentUserId)
      await failOAuthAttempt(attempt.id)
      throw new Error('Session mismatch. Please try connecting again.')
    }

    console.log('[CONNECT_X_TOKEN_MATCH_OK] Token ownership verified')

    // 5. Get OAuth credentials
    const consumerKey = process.env.X_CONSUMER_KEY || process.env.X_CLIENT_ID
    const consumerSecret = process.env.X_CONSUMER_SECRET || process.env.X_CLIENT_SECRET

    if (!consumerKey || !consumerSecret) {
      throw new Error('X OAuth not configured on server')
    }

    // 6. Exchange request token + verifier for access token (OAuth 1.0a Step 2)
    console.log('[CONNECT_X_TOKEN_EXCHANGE] Exchanging for access token...')
    
    const accessTokenData = await getAccessToken(
      consumerKey,
      consumerSecret,
      oauth_token,
      attempt.request_token_secret,
      oauth_verifier
    )

    console.log('[CONNECT_X_ACCESS_TOKEN_SUCCESS] Got access token')
    console.log('[CONNECT_X_ACCESS_TOKEN_SUCCESS] X User ID:', accessTokenData.user_id)
    console.log('[CONNECT_X_ACCESS_TOKEN_SUCCESS] X Username:', accessTokenData.screen_name)

    // 7. Verify credentials and get full user details
    console.log('[CONNECT_X_IDENTITY] Fetching user details...')
    
    const xUser = await verifyCredentials(
      consumerKey,
      consumerSecret,
      accessTokenData.oauth_token,
      accessTokenData.oauth_token_secret
    )

    console.log('[CONNECT_X_IDENTITY_SUCCESS] Verified user:', xUser.screen_name)
    console.log('[CONNECT_X_IDENTITY_SUCCESS] Display name:', xUser.name)
    console.log('[CONNECT_X_IDENTITY_SUCCESS] Profile image:', xUser.profile_image_url_https)

    // 8. Check if X account already linked to another Arena 151 user
    console.log('[CONNECT_X_UNIQUENESS] Checking if X account already linked...')
    
    const { isLinked, linkedUserId } = await isXAccountLinked(
      xUser.id_str,
      currentUserId
    )

    if (isLinked) {
      console.error('[CONNECT_X_ERROR] X account already linked to another user')
      console.error('X User ID:', xUser.id_str)
      console.error('Linked to:', linkedUserId)
      
      await failOAuthAttempt(attempt.id)
      await logOAuthEvent({
        userId: currentUserId,
        action: 'connect_failed',
        xUserId: xUser.id_str,
        xUsername: xUser.screen_name,
        errorCode: 'account_already_linked',
        errorMessage: 'This X account is already linked to another Arena 151 profile',
      })
      
      throw new Error('This X account is already linked to another Arena 151 profile')
    }

    console.log('[CONNECT_X_UNIQUENESS_OK] X account not linked elsewhere')

    // 9. Link X account to current user profile
    console.log('[CONNECT_X_DB_LINK] Linking X account to profile...')
    
    await linkXAccountToProfile({
      userId: currentUserId,
      xUserId: xUser.id_str,
      xUsername: xUser.screen_name,
      xName: xUser.name,
      xProfileImageUrl: xUser.profile_image_url_https,
    })

    console.log('[CONNECT_X_DB_LINK_SUCCESS] X account linked to profile')

    // 10. Mark OAuth attempt as completed
    await completeOAuthAttempt(attempt.id)
    
    console.log('[CONNECT_X_DB_COMPLETE] Attempt marked as completed')

    // 11. Log success audit event
    await logOAuthEvent({
      userId: currentUserId,
      action: 'connect_success',
      xUserId: xUser.id_str,
      xUsername: xUser.screen_name,
    })

    const elapsed = Date.now() - startTime
    console.log('[CONNECT_X_DONE] Full flow completed in', elapsed, 'ms')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    // 12. Redirect to profile page with success
    return NextResponse.redirect(`${baseUrl}/?x_success=true`)

  } catch (error) {
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.error('[CONNECT_X_ERROR] Callback failed')
    console.error('Error:', error instanceof Error ? error.message : error)
    console.error('Stack:', error instanceof Error ? error.stack : 'No stack')
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'Failed to link X account'
    
    const errorCode = errorMessage.includes('already linked')
      ? 'account_already_linked'
      : errorMessage.includes('expired')
      ? 'session_expired'
      : errorMessage.includes('mismatch')
      ? 'session_mismatch'
      : 'unknown_error'

    // Redirect to homepage with error
    return NextResponse.redirect(
      `${baseUrl}/?x_error=${encodeURIComponent(errorCode)}&x_error_message=${encodeURIComponent(errorMessage)}`
    )
  }
}
