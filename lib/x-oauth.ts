/**
 * X (Twitter) OAuth 2.0 PKCE utilities
 * Implements secure OAuth flow with PKCE for public clients
 */

import crypto from 'crypto'

/**
 * Generate cryptographically secure random string for PKCE verifier
 * @returns base64url encoded random string (43-128 chars)
 */
export function generateCodeVerifier(): string {
  return base64URLEncode(crypto.randomBytes(32))
}

/**
 * Generate PKCE code challenge from verifier using SHA256
 * @param verifier - The code verifier
 * @returns base64url encoded SHA256 hash
 */
export function generateCodeChallenge(verifier: string): string {
  return base64URLEncode(crypto.createHash('sha256').update(verifier).digest())
}

/**
 * Generate secure random state for CSRF protection
 * @returns base64url encoded random string
 */
export function generateState(): string {
  return base64URLEncode(crypto.randomBytes(32))
}

/**
 * Encode buffer to base64url format (URL-safe, no padding)
 * @param buffer - Buffer to encode
 * @returns base64url encoded string
 */
export function base64URLEncode(buffer: Buffer): string {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

/**
 * Build X OAuth authorization URL
 */
export function buildAuthorizationUrl(params: {
  clientId: string
  redirectUri: string
  state: string
  codeChallenge: string
  scopes: string
}): string {
  const url = new URL('https://twitter.com/i/oauth2/authorize')
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', params.clientId)
  url.searchParams.set('redirect_uri', params.redirectUri)
  url.searchParams.set('scope', params.scopes)
  url.searchParams.set('state', params.state)
  url.searchParams.set('code_challenge', params.codeChallenge)
  url.searchParams.set('code_challenge_method', 'S256')
  return url.toString()
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeCodeForToken(params: {
  code: string
  codeVerifier: string
  clientId: string
  clientSecret: string
  redirectUri: string
}): Promise<{
  access_token: string
  refresh_token?: string
  expires_in: number
  token_type: string
}> {
  const response = await fetch('https://api.twitter.com/2/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${params.clientId}:${params.clientSecret}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: params.code,
      redirect_uri: params.redirectUri,
      code_verifier: params.codeVerifier,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Token exchange failed: ${error}`)
  }

  return response.json()
}

/**
 * Get authenticated X user info
 */
export async function getXUserInfo(accessToken: string): Promise<{
  id: string
  username: string
  name: string
  profile_image_url?: string
}> {
  const response = await fetch('https://api.twitter.com/2/users/me?user.fields=profile_image_url', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to get X user info: ${error}`)
  }

  const json = await response.json()
  return json.data
}
