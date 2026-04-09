/**
 * Database helpers for X OAuth 1.0a flow
 * Manages pending OAuth attempts and audit logging
 */

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Get Supabase admin client (bypasses RLS)
 */
async function getSupabaseAdmin() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
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

interface XOAuthAttempt {
  id: string
  user_id: string
  request_token: string
  request_token_secret: string
  status: 'pending' | 'completed' | 'failed' | 'expired'
  created_at: string
  expires_at: string
  completed_at?: string
  ip_address?: string
  user_agent?: string
}

/**
 * Create a new OAuth attempt record
 */
export async function createOAuthAttempt(params: {
  userId: string
  requestToken: string
  requestTokenSecret: string
  ipAddress?: string
  userAgent?: string
}): Promise<string> {
  const supabase = await getSupabaseAdmin()

  // Expire any old pending attempts for this user first
  await supabase
    .from('x_oauth_attempts')
    .update({ status: 'expired' })
    .eq('user_id', params.userId)
    .eq('status', 'pending')

  // Create new attempt
  const { data, error } = await supabase
    .from('x_oauth_attempts')
    .insert({
      user_id: params.userId,
      request_token: params.requestToken,
      request_token_secret: params.requestTokenSecret,
      ip_address: params.ipAddress,
      user_agent: params.userAgent,
    })
    .select('id')
    .single()

  if (error) {
    console.error('[X OAuth DB] Failed to create attempt:', error)
    throw new Error('Failed to create OAuth attempt')
  }

  console.log('[X OAuth DB] Created attempt:', data.id)
  return data.id
}

/**
 * Get pending OAuth attempt by request token
 */
export async function getOAuthAttemptByToken(
  requestToken: string
): Promise<XOAuthAttempt | null> {
  const supabase = await getSupabaseAdmin()

  // First expire any old attempts
  await supabase.rpc('expire_old_x_oauth_attempts')

  const { data, error } = await supabase
    .from('x_oauth_attempts')
    .select('*')
    .eq('request_token', requestToken)
    .eq('status', 'pending')
    .single()

  if (error || !data) {
    console.log('[X OAuth DB] No pending attempt found for token')
    return null
  }

  // Check if expired (double-check even after RPC call)
  if (new Date(data.expires_at) < new Date()) {
    console.log('[X OAuth DB] Attempt expired:', data.id)
    await supabase
      .from('x_oauth_attempts')
      .update({ status: 'expired' })
      .eq('id', data.id)
    return null
  }

  return data as XOAuthAttempt
}

/**
 * Mark OAuth attempt as completed
 */
export async function completeOAuthAttempt(attemptId: string): Promise<void> {
  const supabase = await getSupabaseAdmin()

  const { error } = await supabase
    .from('x_oauth_attempts')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('id', attemptId)

  if (error) {
    console.error('[X OAuth DB] Failed to complete attempt:', error)
    throw new Error('Failed to complete OAuth attempt')
  }

  console.log('[X OAuth DB] Completed attempt:', attemptId)
}

/**
 * Mark OAuth attempt as failed
 */
export async function failOAuthAttempt(attemptId: string): Promise<void> {
  const supabase = await getSupabaseAdmin()

  await supabase
    .from('x_oauth_attempts')
    .update({ status: 'failed' })
    .eq('id', attemptId)

  console.log('[X OAuth DB] Failed attempt:', attemptId)
}

/**
 * Log OAuth event to audit table
 */
export async function logOAuthEvent(params: {
  userId: string
  action: 'connect_start' | 'connect_success' | 'connect_failed' | 'disconnect'
  xUserId?: string
  xUsername?: string
  errorCode?: string
  errorMessage?: string
  ipAddress?: string
  userAgent?: string
}): Promise<void> {
  const supabase = await getSupabaseAdmin()

  await supabase.from('x_connection_audit').insert({
    user_id: params.userId,
    action: params.action,
    x_user_id: params.xUserId,
    x_username: params.xUsername,
    error_code: params.errorCode,
    error_message: params.errorMessage,
    ip_address: params.ipAddress,
    user_agent: params.userAgent,
  })

  console.log(`[X OAuth Audit] ${params.action} - user ${params.userId}`)
}

/**
 * Update profile with verified X account
 */
export async function linkXAccountToProfile(params: {
  userId: string
  xUserId: string
  xUsername: string
  xName: string
  xProfileImageUrl: string
}): Promise<void> {
  const supabase = await getSupabaseAdmin()

  const { error } = await supabase
    .from('profiles')
    .update({
      x_user_id: params.xUserId,
      x_username: params.xUsername,
      x_name: params.xName,
      x_profile_image_url: params.xProfileImageUrl,
      x_verified_at: new Date().toISOString(),
    })
    .eq('id', params.userId)

  if (error) {
    console.error('[X OAuth DB] Failed to update profile:', error)
    throw new Error('Failed to link X account to profile')
  }

  console.log('[X OAuth DB] Linked X account:', params.xUsername, 'to user:', params.userId)
}

/**
 * Check if X account is already linked to another user
 */
export async function isXAccountLinked(
  xUserId: string,
  excludeUserId?: string
): Promise<{ isLinked: boolean; linkedUserId?: string }> {
  const supabase = await getSupabaseAdmin()

  let query = supabase
    .from('profiles')
    .select('id')
    .eq('x_user_id', xUserId)

  if (excludeUserId) {
    query = query.neq('id', excludeUserId)
  }

  const { data, error } = await query.single()

  if (error || !data) {
    return { isLinked: false }
  }

  return {
    isLinked: true,
    linkedUserId: data.id,
  }
}

/**
 * Unlink X account from profile
 */
export async function unlinkXAccountFromProfile(userId: string): Promise<void> {
  const supabase = await getSupabaseAdmin()

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
    console.error('[X OAuth DB] Failed to unlink X account:', error)
    throw new Error('Failed to unlink X account')
  }

  console.log('[X OAuth DB] Unlinked X account from user:', userId)
}
