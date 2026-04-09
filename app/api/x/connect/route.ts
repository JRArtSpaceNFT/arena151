/**
 * X OAuth Connect Route - Step 1
 * Initiates OAuth 1.0a flow with X (Twitter)
 * 
 * Flow:
 * 1. Verify user is logged in to Arena 151
 * 2. Call X to get request token + secret
 * 3. Store request token data in database (server-side state)
 * 4. Return authorization URL to redirect user to X
 * 5. Log audit event
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUserId } from '@/lib/auth-server'
import { getRequestToken, buildAuthUrl } from '@/lib/x-oauth-1-0a'
import { createOAuthAttempt, logOAuthEvent } from '@/lib/x-oauth-db'

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('[CONNECT_X_START] OAuth 1.0a flow initiated')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    // 1. Verify user is logged in
    const userId = await getCurrentUserId()
    
    if (!userId) {
      console.error('[CONNECT_X_ERROR] No authenticated session found')
      return NextResponse.json(
        { error: 'Not authenticated. Please log in to Arena 151 first.' },
        { status: 401 }
      )
    }

    console.log('[CONNECT_X_AUTH_OK] User authenticated:', userId)

    // 2. Get OAuth credentials from environment
    // X uses OAuth 1.0a for account linking (needs consumer keys)
    const consumerKey = process.env.X_CONSUMER_KEY
    const consumerSecret = process.env.X_CONSUMER_SECRET
    const callbackUrl = process.env.X_CALLBACK_URL || process.env.X_REDIRECT_URI

    if (!consumerKey || !consumerSecret || !callbackUrl) {
      console.error('[CONNECT_X_ERROR] Missing OAuth 1.0a configuration')
      console.error('Need X_CONSUMER_KEY (OAuth 1.0a) not X_CLIENT_ID (OAuth 2.0)')
      console.error('X_CONSUMER_KEY:', !!consumerKey)
      console.error('X_CONSUMER_SECRET:', !!consumerSecret)
      console.error('X_CALLBACK_URL:', !!callbackUrl)
      throw new Error('X OAuth 1.0a not configured (need consumer keys, not client keys)')
    }

    console.log('[CONNECT_X_CONFIG_OK] OAuth config loaded')
    console.log('Callback URL:', callbackUrl)

    // 3. Get request token from X (OAuth 1.0a Step 1)
    console.log('[CONNECT_X_REQUEST_TOKEN] Calling X API...')
    
    const { oauth_token, oauth_token_secret, oauth_callback_confirmed } = 
      await getRequestToken(consumerKey, consumerSecret, callbackUrl)

    if (oauth_callback_confirmed !== 'true') {
      throw new Error('X did not confirm callback URL')
    }

    console.log('[CONNECT_X_REQUEST_TOKEN_SUCCESS] Got request token:', oauth_token.substring(0, 10) + '...')

    // 4. Store OAuth attempt in database (server-side persistence)
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined
    const userAgent = request.headers.get('user-agent') || undefined

    const attemptId = await createOAuthAttempt({
      userId,
      requestToken: oauth_token,
      requestTokenSecret: oauth_token_secret,
      ipAddress,
      userAgent,
    })

    console.log('[CONNECT_X_DB_STORED] Attempt saved to database:', attemptId)

    // 5. Build authorization URL
    const authUrl = buildAuthUrl(oauth_token)
    
    console.log('[CONNECT_X_REDIRECT_TO_X] Authorization URL:', authUrl)

    // 6. Log audit event
    await logOAuthEvent({
      userId,
      action: 'connect_start',
      ipAddress,
      userAgent,
    })

    const elapsed = Date.now() - startTime
    console.log('[CONNECT_X_DONE] Flow prepared in', elapsed, 'ms')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    // 7. Return authorization URL to client
    return NextResponse.json({
      success: true,
      authUrl,
      attemptId,
    })

  } catch (error) {
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.error('[CONNECT_X_ERROR] Failed to initiate OAuth flow')
    console.error('Error:', error instanceof Error ? error.message : error)
    console.error('Stack:', error instanceof Error ? error.stack : 'No stack')
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    
    const errorMessage = error instanceof Error ? error.message : 'Failed to connect X account'
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
