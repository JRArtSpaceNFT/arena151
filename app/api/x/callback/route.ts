/**
 * X OAuth Callback Route
 * Handles OAuth 2.0 callback from X
 * 
 * Flow:
 * 1. Validate state parameter (CSRF protection)
 * 2. Validate initiating user session
 * 3. Exchange authorization code for access token
 * 4. Get authenticated X user info
 * 5. Check if X account already linked to another Arena 151 profile
 * 6. Store verified X account info in user profile
 * 7. Clear temporary OAuth cookies
 * 8. Redirect to profile with success/error
 */

import { NextRequest, NextResponse } from 'next/server'
import { exchangeCodeForToken, getXUserInfo } from '@/lib/x-oauth'
import { encrypt } from '@/lib/crypto'
import { getCurrentUserId } from '@/lib/auth-server'
import {
  getProfileByXUserId,
  updateProfileXAccount,
  logXConnectionAudit,
} from '@/lib/db-server'

export async function GET(request: NextRequest) {
  const baseUrl = process.env.APP_BASE_URL || 'http://localhost:3002'
  
  try {
    // 1. Extract OAuth callback parameters
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    // Handle user denied authorization
    if (error) {
      return NextResponse.redirect(`${baseUrl}/?x_error=authorization_denied`)
    }

    if (!code || !state) {
      throw new Error('Missing code or state parameter')
    }

    // 2. Retrieve stored OAuth data from cookies
    const storedState = request.cookies.get('x_oauth_state')?.value
    const storedVerifier = request.cookies.get('x_oauth_verifier')?.value
    const storedUserId = request.cookies.get('x_oauth_user_id')?.value

    if (!storedState || !storedVerifier || !storedUserId) {
      throw new Error('OAuth session expired or invalid')
    }

    // 3. Validate state (CSRF protection)
    if (state !== storedState) {
      throw new Error('Invalid state parameter (CSRF check failed)')
    }

    // 4. Validate current user session matches OAuth initiator
    const currentUserId = await getCurrentUserId()
    if (!currentUserId || currentUserId !== storedUserId) {
      throw new Error('Session mismatch (OAuth initiated by different user)')
    }

    // 5. Exchange authorization code for access token
    const clientId = process.env.X_CLIENT_ID!
    const clientSecret = process.env.X_CLIENT_SECRET!
    const redirectUri = process.env.X_REDIRECT_URI!

    const tokenResponse = await exchangeCodeForToken({
      code,
      codeVerifier: storedVerifier,
      clientId,
      clientSecret,
      redirectUri,
    })

    // 6. Get authenticated X user info
    const xUser = await getXUserInfo(tokenResponse.access_token)

    // 7. Check if X account already linked to another Arena 151 profile
    const existingProfile = await getProfileByXUserId(xUser.id)
    
    if (existingProfile && existingProfile.id !== currentUserId) {
      await logXConnectionAudit({
        user_id: currentUserId,
        action: 'link_failed',
        x_user_id: xUser.id,
        x_username: xUser.username,
        error: 'X account already linked to another profile',
      })
      
      throw new Error('This X account is already linked to another Arena 151 profile')
    }

    // 8. Encrypt tokens (optional - can be omitted if not needed long-term)
    const encryptionKey = process.env.TOKEN_ENCRYPTION_KEY
    const accessTokenEncrypted = encryptionKey 
      ? encrypt(tokenResponse.access_token, encryptionKey)
      : undefined
    const refreshTokenEncrypted = encryptionKey && tokenResponse.refresh_token
      ? encrypt(tokenResponse.refresh_token, encryptionKey)
      : undefined

    // 9. Calculate token expiration
    const tokenExpiresAt = tokenResponse.expires_in
      ? new Date(Date.now() + tokenResponse.expires_in * 1000).toISOString()
      : undefined

    // 10. Store verified X account info in profile
    await updateProfileXAccount(currentUserId, {
      x_user_id: xUser.id,
      x_username: xUser.username,
      x_name: xUser.name,
      x_profile_image_url: xUser.profile_image_url,
      x_verified_at: new Date().toISOString(),
      x_access_token_encrypted: accessTokenEncrypted,
      x_refresh_token_encrypted: refreshTokenEncrypted,
      x_token_expires_at: tokenExpiresAt,
    })

    // 11. Log successful connection
    await logXConnectionAudit({
      user_id: currentUserId,
      action: 'linked',
      x_user_id: xUser.id,
      x_username: xUser.username,
    })

    // 12. Clear temporary OAuth cookies and redirect to success
    const response = NextResponse.redirect(`${baseUrl}/?x_success=true`)
    
    response.cookies.delete('x_oauth_state')
    response.cookies.delete('x_oauth_verifier')
    response.cookies.delete('x_oauth_user_id')

    return response

  } catch (error) {
    console.error('X OAuth callback error:', error)
    
    const errorMessage = error instanceof Error ? error.message : 'Failed to link X account'
    
    // Clear OAuth cookies on error
    const response = NextResponse.redirect(`${baseUrl}/?x_error=${encodeURIComponent(errorMessage)}`)
    
    response.cookies.delete('x_oauth_state')
    response.cookies.delete('x_oauth_verifier')
    response.cookies.delete('x_oauth_user_id')

    return response
  }
}
