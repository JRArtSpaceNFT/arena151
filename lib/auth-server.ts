/**
 * Server-side auth helpers for X OAuth
 * Uses Arena 151's Supabase auth system
 */

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Get Supabase server client with cookies
 */
async function getSupabaseServer() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from Server Component - ignore
          }
        },
      },
    }
  )
}

/**
 * Decode JWT payload from base64url (no signature verification)
 * For read-only access to user ID from session token
 */
function decodeJWT(token: string): { sub?: string } | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payload = parts[1]
    const decoded = Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
    return JSON.parse(decoded)
  } catch {
    return null
  }
}

/**
 * Get current logged-in user ID
 * @throws Error if user is not authenticated
 */
export async function getCurrentUserIdOrThrow(): Promise<string> {
  const cookieStore = await cookies()
  
  // Try to get session from Supabase auth cookie
  // Cookie names: sb-<project-ref>-auth-token or sb-<project-ref>-auth-token.0, .1, etc.
  const allCookies = cookieStore.getAll()
  const authCookie = allCookies.find(c => c.name.includes('-auth-token'))
  
  if (!authCookie?.value) {
    console.log('[auth-server] No auth cookie found. Available cookies:', allCookies.map(c => c.name))
    throw new Error('Not authenticated')
  }

  // Try to decode JWT directly (fastest, no network call)
  const decoded = decodeJWT(authCookie.value)
  if (decoded?.sub) {
    return decoded.sub
  }

  // Fallback to Supabase client if JWT decode failed
  console.log('[auth-server] JWT decode failed, falling back to Supabase getUser()')
  const supabase = await getSupabaseServer()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    console.error('[auth-server] Supabase getUser() failed:', error?.message)
    throw new Error('Not authenticated')
  }

  return user.id
}

/**
 * Check if user is authenticated (non-throwing version)
 */
export async function getCurrentUserId(): Promise<string | null> {
  try {
    return await getCurrentUserIdOrThrow()
  } catch (err) {
    console.error('[auth-server] getCurrentUserId failed:', err instanceof Error ? err.message : err)
    return null
  }
}
