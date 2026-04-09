/**
 * X OAuth Connect Route
 * Initiates OAuth 2.0 PKCE flow with X (Twitter)
 * 
 * Flow:
 * 1. Verify user is logged in
 * 2. Generate PKCE verifier, challenge, and state
 * 3. Store temporary OAuth data in secure httpOnly cookies
 * 4. Redirect user to X authorization page
 */

import { NextRequest, NextResponse } from 'next/server'
import { generateCodeVerifier, generateCodeChallenge, generateState, buildAuthorizationUrl } from '@/lib/x-oauth'
import { getCurrentUserId } from '@/lib/auth-server'

export async function GET(request: NextRequest) {
  try {
    console.log('[X OAuth Connect] Starting OAuth flow...')
    console.log('[X OAuth Connect] Request URL:', request.url)
    console.log('[X OAuth Connect] Request headers:', Object.fromEntries(request.headers.entries()))
    
    // 1. Verify user is logged in using server-side cookies
    const userId = await getCurrentUserId()
    
    console.log('[X OAuth Connect] getCurrentUserId returned:', userId)
    
    if (!userId) {
      console.error('[X OAuth Connect] No user session found - redirecting with error')
      throw new Error('Not authenticated')
    }
    
    console.log('[X OAuth Connect] User authenticated successfully:', userId)

    // 2. Generate PKCE parameters
    const codeVerifier = generateCodeVerifier()
    const codeChallenge = generateCodeChallenge(codeVerifier)
    const state = generateState()

    // 3. Get OAuth config from env
    const clientId = process.env.X_CLIENT_ID
    const redirectUri = process.env.X_REDIRECT_URI
    const scopes = process.env.X_SCOPES || 'users.read tweet.read'

    if (!clientId || !redirectUri) {
      throw new Error('X OAuth not configured (missing X_CLIENT_ID or X_REDIRECT_URI)')
    }

    // 4. Build authorization URL
    const authUrl = buildAuthorizationUrl({
      clientId,
      redirectUri,
      state,
      codeChallenge,
      scopes,
    })

    // 5. Store temporary OAuth data in secure cookies (expires in 10 minutes)
    const response = NextResponse.json({ authUrl })
    
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: 60 * 10, // 10 minutes
      path: '/',
    }

    response.cookies.set('x_oauth_state', state, cookieOptions)
    response.cookies.set('x_oauth_verifier', codeVerifier, cookieOptions)
    response.cookies.set('x_oauth_user_id', userId, cookieOptions) // Bind to current user

    return response

  } catch (error) {
    console.error('[X OAuth] Error:', error)
    console.error('[X OAuth] Error stack:', error instanceof Error ? error.stack : 'No stack')
    
    let errorMessage = error instanceof Error ? error.message : 'Failed to connect X account'
    
    // More helpful error message for auth failures
    if (errorMessage === 'Not authenticated') {
      errorMessage = 'Session expired - please refresh and try again'
    }
    
    // Return JSON error instead of redirect so fetch() can catch it
    return NextResponse.json(
      { error: errorMessage },
      { status: errorMessage === 'Not authenticated' ? 401 : 500 }
    )
  }
}
