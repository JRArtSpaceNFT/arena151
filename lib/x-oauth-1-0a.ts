/**
 * X (Twitter) OAuth 1.0a Implementation
 * 
 * Standard 3-legged OAuth flow:
 * 1. POST /oauth/request_token → get request token + secret
 * 2. Redirect user to /oauth/authenticate?oauth_token=XXX
 * 3. User authorizes, X redirects back with oauth_token + oauth_verifier
 * 4. POST /oauth/access_token with verifier → get access token + secret
 * 5. Use access token to make authenticated API calls
 */

import crypto from 'crypto'

// OAuth 1.0a endpoints
const OAUTH_BASE = 'https://api.x.com'
const REQUEST_TOKEN_URL = `${OAUTH_BASE}/oauth/request_token`
const AUTHENTICATE_URL = `${OAUTH_BASE}/oauth/authenticate`
const ACCESS_TOKEN_URL = `${OAUTH_BASE}/oauth/access_token`
const VERIFY_CREDENTIALS_URL = `${OAUTH_BASE}/1.1/account/verify_credentials.json`

/**
 * Generate OAuth 1.0a signature
 */
function generateSignature(
  method: string,
  url: string,
  params: Record<string, string>,
  consumerSecret: string,
  tokenSecret?: string
): string {
  // 1. Sort parameters alphabetically
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join('&')

  // 2. Build signature base string
  const signatureBaseString = [
    method.toUpperCase(),
    encodeURIComponent(url),
    encodeURIComponent(sortedParams),
  ].join('&')

  // 3. Build signing key (consumer_secret&token_secret)
  const signingKey = `${encodeURIComponent(consumerSecret)}&${tokenSecret ? encodeURIComponent(tokenSecret) : ''}`

  // 4. Generate HMAC-SHA1 signature
  const hmac = crypto.createHmac('sha1', signingKey)
  hmac.update(signatureBaseString)
  return hmac.digest('base64')
}

/**
 * Generate OAuth 1.0a Authorization header
 */
function buildAuthHeader(
  method: string,
  url: string,
  params: Record<string, string>,
  consumerKey: string,
  consumerSecret: string,
  tokenSecret?: string
): string {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: crypto.randomBytes(32).toString('base64'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_version: '1.0',
    ...params,
  }

  // Generate signature
  const signature = generateSignature(method, url, oauthParams, consumerSecret, tokenSecret)
  oauthParams.oauth_signature = signature

  // Build Authorization header
  const headerParams = Object.keys(oauthParams)
    .filter(key => key.startsWith('oauth_'))
    .sort()
    .map(key => `${encodeURIComponent(key)}="${encodeURIComponent(oauthParams[key])}"`)
    .join(', ')

  return `OAuth ${headerParams}`
}

/**
 * Step 1: Request a request token from X
 */
export async function getRequestToken(
  consumerKey: string,
  consumerSecret: string,
  callbackUrl: string
): Promise<{
  oauth_token: string
  oauth_token_secret: string
  oauth_callback_confirmed: string
}> {
  const params = {
    oauth_callback: callbackUrl,
  }

  const authHeader = buildAuthHeader(
    'POST',
    REQUEST_TOKEN_URL,
    params,
    consumerKey,
    consumerSecret
  )

  console.log('[X OAuth 1.0a] Requesting token from:', REQUEST_TOKEN_URL)

  const response = await fetch(REQUEST_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('[X OAuth 1.0a] Request token error:', errorText)
    throw new Error(`Failed to get request token: ${response.status} ${errorText}`)
  }

  const body = await response.text()
  console.log('[X OAuth 1.0a] Request token response:', body)

  // Parse response: oauth_token=XXX&oauth_token_secret=YYY&oauth_callback_confirmed=true
  const params_parsed = new URLSearchParams(body)
  
  return {
    oauth_token: params_parsed.get('oauth_token')!,
    oauth_token_secret: params_parsed.get('oauth_token_secret')!,
    oauth_callback_confirmed: params_parsed.get('oauth_callback_confirmed')!,
  }
}

/**
 * Step 2: Build authorization URL to redirect user to X
 */
export function buildAuthUrl(requestToken: string): string {
  return `${AUTHENTICATE_URL}?oauth_token=${encodeURIComponent(requestToken)}`
}

/**
 * Step 3: Exchange request token + verifier for access token
 */
export async function getAccessToken(
  consumerKey: string,
  consumerSecret: string,
  requestToken: string,
  requestTokenSecret: string,
  oauthVerifier: string
): Promise<{
  oauth_token: string
  oauth_token_secret: string
  user_id: string
  screen_name: string
}> {
  const params = {
    oauth_token: requestToken,
    oauth_verifier: oauthVerifier,
  }

  const authHeader = buildAuthHeader(
    'POST',
    ACCESS_TOKEN_URL,
    params,
    consumerKey,
    consumerSecret,
    requestTokenSecret
  )

  console.log('[X OAuth 1.0a] Exchanging token at:', ACCESS_TOKEN_URL)

  const response = await fetch(ACCESS_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('[X OAuth 1.0a] Access token error:', errorText)
    throw new Error(`Failed to get access token: ${response.status} ${errorText}`)
  }

  const body = await response.text()
  console.log('[X OAuth 1.0a] Access token response:', body)

  // Parse response
  const params_parsed = new URLSearchParams(body)
  
  return {
    oauth_token: params_parsed.get('oauth_token')!,
    oauth_token_secret: params_parsed.get('oauth_token_secret')!,
    user_id: params_parsed.get('user_id')!,
    screen_name: params_parsed.get('screen_name')!,
  }
}

/**
 * Step 4: Verify credentials and get user details
 */
export async function verifyCredentials(
  consumerKey: string,
  consumerSecret: string,
  accessToken: string,
  accessTokenSecret: string
): Promise<{
  id_str: string
  screen_name: string
  name: string
  profile_image_url_https: string
}> {
  const url = `${VERIFY_CREDENTIALS_URL}?include_email=false`
  
  const params = {
    oauth_token: accessToken,
  }

  const authHeader = buildAuthHeader(
    'GET',
    VERIFY_CREDENTIALS_URL,
    params,
    consumerKey,
    consumerSecret,
    accessTokenSecret
  )

  console.log('[X OAuth 1.0a] Verifying credentials at:', url)

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: authHeader,
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('[X OAuth 1.0a] Verify credentials error:', errorText)
    throw new Error(`Failed to verify credentials: ${response.status} ${errorText}`)
  }

  const userData = await response.json()
  console.log('[X OAuth 1.0a] User verified:', userData.screen_name)

  return userData
}
