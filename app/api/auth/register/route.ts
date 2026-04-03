import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateUserWallet } from '@/lib/solana'

// Admin client bypasses RLS — safe for server-side use only
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const data = await req.json()
    const { email, password, username, displayName, bio, avatar,
      favoritePokemonId, favoritePokemonName, favoritePokemonTypes } = data

    if (!email || !password || !username || !displayName) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
    }

    // 1. Create auth user via admin (skips email confirmation requirement)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email.toLowerCase(),
      password,
      email_confirm: true, // auto-confirm — no email confirmation needed
    })

    if (authError) {
      if (authError.message.includes('already registered') || authError.message.includes('already been registered')) {
        return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 400 })
      }
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    if (!authData.user) {
      return NextResponse.json({ error: 'Failed to create account.' }, { status: 500 })
    }

    // 2. Generate real Solana wallet
    const { publicKey, encryptedPrivateKey } = generateUserWallet()

    // 3. Insert profile (admin bypasses RLS — works regardless of email confirmation)
    const { error: profileError } = await supabaseAdmin.from('profiles').insert({
      id: authData.user.id,
      email: email.toLowerCase(),
      username: username.toLowerCase(),
      display_name: displayName,
      bio: bio || '',
      avatar: avatar || '',
      favorite_pokemon_id: favoritePokemonId || 25,
      favorite_pokemon_name: favoritePokemonName || 'Pikachu',
      favorite_pokemon_types: favoritePokemonTypes || ['electric'],
      internal_wallet_id: publicKey,
      sol_address: publicKey,
      encrypted_private_key: encryptedPrivateKey,
      balance: 0,
      earnings: 0,
      wins: 0,
      losses: 0,
      badges: [],
      joined_date: new Date().toISOString(),
    })

    if (profileError) {
      // Rollback auth user if profile insert failed
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      if (profileError.code === '23505') {
        if (profileError.message.includes('username')) {
          return NextResponse.json({ error: 'That username is already taken.' }, { status: 400 })
        }
        return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 400 })
      }
      return NextResponse.json({ error: profileError.message }, { status: 500 })
    }

    // 4. Register wallet with Helius (fire-and-forget)
    fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/wallet/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: publicKey }),
    }).catch(() => {})

    return NextResponse.json({
      success: true,
      userId: authData.user.id,
      solAddress: publicKey,
    })
  } catch (err) {
    console.error('[Register API]', err)
    return NextResponse.json({ error: 'Registration failed. Please try again.' }, { status: 500 })
  }
}
