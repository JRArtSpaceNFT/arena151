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
import { createServerClient } from '@supabase/ssr'
import { generateCodeVerifier, generateCodeChallenge, generateState, buildAuthorizationUrl } from '@/lib/x-oauth'

export async function GET(request: NextRequest) {
  try {
    // 1. Create Supabase client with cookies from request
    console.log('[X OAuth] Checking authentication...')
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll() {
            // No-op for GET request
          },
        },
      }
    )
    
    // 2. Verify user is logged in
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    console.log('[X OAuth] Auth check result:', { user: !!user, error: authError?.message })
    
    if (authError || !user) {
      console.error('[X OAuth] Auth error:', authError)
      throw new Error('Not authenticated')
    }
    
    const userId = user.id
    console.log('[X OAuth] User authenticated:', userId)

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
    const response = NextResponse.redirect(authUrl)
    
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
    
    // Use production URL in production, localhost for dev
    const baseUrl = process.env.NODE_ENV === 'production' 
      ? 'https://arena151.xyz'
      : 'http://localhost:3002'
    
    let errorMessage = error instanceof Error ? error.message : 'Failed to connect X account'
    
    // More helpful error message for auth failures
    if (errorMessage === 'Not authenticated') {
      errorMessage = 'Session expired - please refresh and try again'
    }
    
    console.log('[X OAuth] Redirecting to:', `${baseUrl}/?x_error=${encodeURIComponent(errorMessage)}`)
    
    return NextResponse.redirect(`${baseUrl}/?x_error=${encodeURIComponent(errorMessage)}`)
  }
}
