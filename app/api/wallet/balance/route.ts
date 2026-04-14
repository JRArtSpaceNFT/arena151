/**
 * GET /api/wallet/balance?userId=X
 * 
 * Returns on-chain SOL balance for a user's wallet.
 * Used for pre-flight checks before withdrawals.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSolBalance } from '@/lib/solana'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

const supabaseAnon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(req: NextRequest) {
  try {
    // Auth
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const token = authHeader.slice(7)
    const { data: { user: authUser }, error: authError } = await supabaseAnon.auth.getUser(token)
    if (authError || !authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = req.nextUrl.searchParams.get('userId')
    
    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 })
    }

    // Verify requesting user is the owner or admin
    if (authUser.id !== userId) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('is_admin')
        .eq('id', authUser.id)
        .single()
      
      if (!profile?.is_admin) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    // Get user's wallet address
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('sol_address, balance, locked_balance')
      .eq('id', userId)
      .single()

    if (profileError || !userProfile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get on-chain balance
    const onChainBalance = await getSolBalance(userProfile.sol_address)

    return NextResponse.json({
      onChainBalance,
      dbBalance: Number(userProfile.balance),
      lockedBalance: Number(userProfile.locked_balance),
      availableBalance: Number(userProfile.balance) - Number(userProfile.locked_balance),
    })

  } catch (err) {
    console.error('[Wallet Balance] Error:', err)
    return NextResponse.json(
      { error: 'Failed to fetch balance' },
      { status: 500 }
    )
  }
}
