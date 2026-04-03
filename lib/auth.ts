// Arena 151 Auth Layer — Supabase Backend
// Uses Supabase Auth for email/password authentication.
// User profile data (username, avatar, etc.) stored in `profiles` table.
// See SUPABASE_SETUP.md and supabase/schema.sql for setup instructions.

import { supabase } from './supabase'

export interface StoredUser {
  id: string
  email: string
  username: string
  displayName: string
  bio: string
  avatar: string
  favoritePokemonId: number
  favoritePokemonName: string
  favoritePokemonTypes: string[]
  internalWalletId: string
  balance: number
  earnings: number
  wins: number
  losses: number
  badges: string[]
  joinedDate: string
}

function generateWalletId(): string {
  const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
  let result = ''
  for (let i = 0; i < 44; i++) {
    result += chars[Math.floor(Math.random() * chars.length)]
  }
  return result
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function profileToUser(profile: Record<string, any>): StoredUser {
  return {
    id: profile.id as string,
    email: profile.email as string,
    username: profile.username as string,
    displayName: profile.display_name as string,
    bio: (profile.bio as string) || '',
    avatar: (profile.avatar as string) || '',
    favoritePokemonId: (profile.favorite_pokemon_id as number) || 25,
    favoritePokemonName: (profile.favorite_pokemon_name as string) || 'Pikachu',
    favoritePokemonTypes: (profile.favorite_pokemon_types as string[]) || ['electric'],
    internalWalletId: (profile.internal_wallet_id as string) || '',
    balance: Number(profile.balance) || 0,
    earnings: Number(profile.earnings) || 0,
    wins: (profile.wins as number) || 0,
    losses: (profile.losses as number) || 0,
    badges: (profile.badges as string[]) || [],
    joinedDate: (profile.joined_date as string) || new Date().toISOString(),
  }
}

export async function registerUser(data: {
  email: string
  password: string
  username: string
  displayName: string
  bio: string
  avatar: string
  favoritePokemonId: number
  favoritePokemonName: string
  favoritePokemonTypes: string[]
  testingMode?: boolean
}): Promise<{ success: boolean; error?: string; user?: StoredUser }> {
  // 1. Create Supabase Auth user
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: data.email,
    password: data.password,
  })

  if (authError) {
    if (authError.message.includes('already registered') || authError.message.includes('User already registered')) {
      return { success: false, error: 'An account with this email already exists.' }
    }
    return { success: false, error: authError.message }
  }

  if (!authData.user) {
    return { success: false, error: 'Failed to create account. Please try again.' }
  }

  const walletId = generateWalletId()

  // 2. Insert profile record
  const profile = {
    id: authData.user.id,
    email: data.email.toLowerCase(),
    username: data.username.toLowerCase(),
    display_name: data.displayName,
    bio: data.bio,
    avatar: data.avatar,
    favorite_pokemon_id: data.favoritePokemonId,
    favorite_pokemon_name: data.favoritePokemonName,
    favorite_pokemon_types: data.favoritePokemonTypes,
    internal_wallet_id: walletId,
    balance: 0,
    earnings: 0,
    wins: 0,
    losses: 0,
    badges: [],
    joined_date: new Date().toISOString(),
  }

  const { error: profileError } = await supabase.from('profiles').insert(profile)

  if (profileError) {
    if (profileError.code === '23505') {
      if (profileError.message.includes('username')) {
        return { success: false, error: 'That username is already taken.' }
      }
      return { success: false, error: 'An account with this email already exists.' }
    }
    return { success: false, error: profileError.message }
  }

  const user: StoredUser = {
    id: authData.user.id,
    email: data.email.toLowerCase(),
    username: data.username.toLowerCase(),
    displayName: data.displayName,
    bio: data.bio,
    avatar: data.avatar,
    favoritePokemonId: data.favoritePokemonId,
    favoritePokemonName: data.favoritePokemonName,
    favoritePokemonTypes: data.favoritePokemonTypes,
    internalWalletId: walletId,
    balance: 0,
    earnings: 0,
    wins: 0,
    losses: 0,
    badges: [],
    joinedDate: new Date().toISOString(),
  }

  return { success: true, user }
}

export async function loginUser(
  email: string,
  password: string
): Promise<{ success: boolean; error?: string; user?: StoredUser }> {
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (authError) {
    if (
      authError.message.toLowerCase().includes('invalid login') ||
      authError.message.toLowerCase().includes('invalid credentials') ||
      authError.message.toLowerCase().includes('email not confirmed')
    ) {
      return { success: false, error: 'Incorrect email or password.' }
    }
    return { success: false, error: authError.message }
  }

  if (!authData.user) {
    return { success: false, error: 'Login failed.' }
  }

  // Fetch profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', authData.user.id)
    .single()

  if (profileError || !profile) {
    return { success: false, error: 'Profile not found. Please contact support.' }
  }

  return { success: true, user: profileToUser(profile) }
}

export async function updateUser(id: string, updates: Partial<StoredUser>): Promise<void> {
  const dbUpdates: Record<string, unknown> = {}
  if (updates.displayName !== undefined) dbUpdates.display_name = updates.displayName
  if (updates.bio !== undefined) dbUpdates.bio = updates.bio
  if (updates.avatar !== undefined) dbUpdates.avatar = updates.avatar
  if (updates.favoritePokemonId !== undefined) dbUpdates.favorite_pokemon_id = updates.favoritePokemonId
  if (updates.favoritePokemonName !== undefined) dbUpdates.favorite_pokemon_name = updates.favoritePokemonName
  if (updates.favoritePokemonTypes !== undefined) dbUpdates.favorite_pokemon_types = updates.favoritePokemonTypes
  if (updates.balance !== undefined) dbUpdates.balance = updates.balance
  if (updates.earnings !== undefined) dbUpdates.earnings = updates.earnings
  if (updates.wins !== undefined) dbUpdates.wins = updates.wins
  if (updates.losses !== undefined) dbUpdates.losses = updates.losses
  if (updates.badges !== undefined) dbUpdates.badges = updates.badges

  await supabase.from('profiles').update(dbUpdates).eq('id', id)
}

export async function getSession(): Promise<StoredUser | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single()

  if (!profile) return null
  return profileToUser(profile)
}

export async function clearSession(): Promise<void> {
  await supabase.auth.signOut()
}

export async function initiatePasswordReset(
  email: string
): Promise<{ success: boolean; error?: string }> {
  const redirectTo =
    typeof window !== 'undefined'
      ? `${window.location.origin}/reset-password`
      : undefined

  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
  if (error) return { success: false, error: error.message }
  return { success: true }
}

// Legacy: kept for leaderboard — reads all profiles via service role (server-side only)
// On client, use the leaderboard API route instead.
export async function getAllUsers(): Promise<Omit<StoredUser, never>[]> {
  const { data, error } = await supabase.from('profiles').select('*')
  if (error || !data) return []
  return data.map(profileToUser)
}

// Kept for backwards compat — does nothing meaningful client-side with Supabase
export function getUserById(_id: string): StoredUser | null {
  return null
}
