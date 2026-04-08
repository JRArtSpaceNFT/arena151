/**
 * Server-side database helpers for X OAuth
 * Uses Arena 151's Supabase database
 */

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export interface Profile {
  id: string
  username: string
  x_user_id?: string | null
  x_username?: string | null
  x_name?: string | null
  x_profile_image_url?: string | null
  x_verified_at?: string | null
  x_access_token_encrypted?: string | null
  x_refresh_token_encrypted?: string | null
  x_token_expires_at?: string | null
}

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
 * Get profile by user ID
 */
export async function getProfileByUserId(userId: string): Promise<Profile | null> {
  const supabase = await getSupabaseServer()
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (error || !data) return null
  return data as Profile
}

/**
 * Get profile by X user ID (to check if X account already linked)
 */
export async function getProfileByXUserId(xUserId: string): Promise<Profile | null> {
  const supabase = await getSupabaseServer()
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('x_user_id', xUserId)
    .single()

  if (error || !data) return null
  return data as Profile
}

/**
 * Update profile X account info
 */
export async function updateProfileXAccount(
  userId: string,
  xData: {
    x_user_id: string
    x_username: string
    x_name: string
    x_profile_image_url?: string
    x_verified_at: string
    x_access_token_encrypted?: string
    x_refresh_token_encrypted?: string
    x_token_expires_at?: string
  }
): Promise<void> {
  const supabase = await getSupabaseServer()
  const { error } = await supabase
    .from('profiles')
    .update(xData)
    .eq('id', userId)

  if (error) {
    throw new Error(`Failed to update profile: ${error.message}`)
  }
}

/**
 * Clear X account info from profile
 */
export async function clearProfileXAccount(userId: string): Promise<void> {
  const supabase = await getSupabaseServer()
  const { error } = await supabase
    .from('profiles')
    .update({
      x_user_id: null,
      x_username: null,
      x_name: null,
      x_profile_image_url: null,
      x_verified_at: null,
      x_access_token_encrypted: null,
      x_refresh_token_encrypted: null,
      x_token_expires_at: null,
    })
    .eq('id', userId)

  if (error) {
    throw new Error(`Failed to clear X account: ${error.message}`)
  }
}

/**
 * Log X connection audit event
 */
export async function logXConnectionAudit(params: {
  user_id: string
  action: 'linked' | 'unlinked' | 'link_failed'
  x_user_id?: string
  x_username?: string
  error?: string
}): Promise<void> {
  const supabase = await getSupabaseServer()
  await supabase.from('x_connection_audit').insert(params)
}
