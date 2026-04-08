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
 * Get current logged-in user ID
 * @throws Error if user is not authenticated
 */
export async function getCurrentUserIdOrThrow(): Promise<string> {
  const supabase = await getSupabaseServer()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
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
  } catch {
    return null
  }
}
