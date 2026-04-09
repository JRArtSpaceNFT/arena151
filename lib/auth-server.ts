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
 * Extract user ID from Supabase session cookie
 * Supabase stores session as base64-encoded JSON: {access_token, refresh_token, user, ...}
 */
function extractUserIdFromSession(cookieValue: string): string | null {
  try {
    // Supabase cookie is base64-encoded JSON
    const decoded = Buffer.from(cookieValue, 'base64').toString('utf8')
    const session = JSON.parse(decoded)
    
    // User ID can be in session.user.id or we can decode the access_token JWT
    if (session.user?.id) {
      return session.user.id
    }
    
    // Fallback: decode access_token JWT
    if (session.access_token) {
      const parts = session.access_token.split('.')
      if (parts.length === 3) {
        const payload = parts[1]
        const jwtPayload = Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
        const parsed = JSON.parse(jwtPayload)
        if (parsed.sub) return parsed.sub
      }
    }
    
    return null
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
  
  console.log('[auth-server] Cookie debug:')
  console.log('[auth-server] Total cookies found:', allCookies.length)
  console.log('[auth-server] All cookie names:', JSON.stringify(allCookies.map(c => c.name)))
  console.log('[auth-server] Looking for pattern: sb-abzurjxkxxtahdjrpvxk-auth-token*')
  
  // Look for the specific Supabase auth token cookie
  const authCookie = allCookies.find(c => 
    c.name === 'sb-abzurjxkxxtahdjrpvxk-auth-token' ||
    c.name.startsWith('sb-abzurjxkxxtahdjrpvxk-auth-token.')
  )
  
  if (!authCookie?.value) {
    console.error('[auth-server] ❌ No auth cookie found')
    console.log('[auth-server] Looking for cookie matching pattern: *-auth-token*')
    console.log('[auth-server] All cookies:', JSON.stringify(allCookies.map(c => ({ name: c.name, hasValue: !!c.value }))))
    throw new Error('Not authenticated')
  }

  console.log('[auth-server] ✅ Found auth cookie:', authCookie.name)
  console.log('[auth-server] Cookie value length:', authCookie.value.length)
  console.log('[auth-server] Cookie value preview:', authCookie.value.substring(0, 50) + '...')

  // Try to extract user ID from session cookie (fastest, no network call)
  const userId = extractUserIdFromSession(authCookie.value)
  if (userId) {
    console.log('[auth-server] ✅ User ID extracted from session cookie:', userId)
    return userId
  }

  // Fallback to Supabase client if session extraction failed
  console.log('[auth-server] ⚠️ Session extraction failed, falling back to Supabase getUser()')
  const supabase = await getSupabaseServer()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    console.error('[auth-server] ❌ Supabase getUser() failed:', error?.message)
    throw new Error('Not authenticated')
  }

  console.log('[auth-server] ✅ Supabase getUser() succeeded, user ID:', user.id)
  return user.id
}

/**
 * Check if user is authenticated (non-throwing version)
 */
export async function getCurrentUserId(): Promise<string | null> {
  try {
    return await getCurrentUserIdOrThrow()
  } catch (err) {
    console.error('[auth-server] getCurrentUserId failed:', err instanceof Error ? err.message : String(err))
    return null
  }
}
