import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendSol, calcWithdrawal, getSolBalance, getMinWithdrawalSol } from '@/lib/solana'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

// Anon client for verifying the user's JWT
const supabaseAnon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Min withdrawal calculated from live SOL price at request time

export async function POST(req: NextRequest) {
  try {
    // ── Auth check: verify Bearer token matches the userId being withdrawn ──
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const token = authHeader.replace('Bearer ', '').trim()
    const { data: { user: authUser }, error: authError } = await supabaseAnon.auth.getUser(token)
    if (authError || !authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { userId, toAddress, amountSol } = await req.json()

    if (!userId || !toAddress || !amountSol) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // ── Enforce: authenticated user can only withdraw their own funds ──
    if (authUser.id !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const minWithdrawalSol = await getMinWithdrawalSol()
    if (amountSol < minWithdrawalSol) {
      return NextResponse.json({ error: 'Minimum withdrawal is $10 USD equivalent' }, { status: 400 })
    }

    // Get user profile
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, balance, sol_address, encrypted_private_key')
      .eq('id', userId)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (profile.balance < amountSol) {
      return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 })
    }

    const { fee, netAmount } = calcWithdrawal(amountSol)

    // Check the user's custodial wallet has enough SOL
    const walletBalance = await getSolBalance(profile.sol_address)
    if (walletBalance < amountSol + 0.000005) { // extra for gas
      return NextResponse.json({
        error: 'Wallet balance insufficient for withdrawal. Please contact support.',
      }, { status: 400 })
    }

    // Deduct from DB balance first (optimistic, prevents double-spend)
    await supabaseAdmin
      .from('profiles')
      .update({ balance: profile.balance - amountSol })
      .eq('id', userId)

    // Send net amount to user
    const result = await sendSol(profile.encrypted_private_key, toAddress, netAmount)

    if (!result.success) {
      // Rollback balance
      await supabaseAdmin
        .from('profiles')
        .update({ balance: profile.balance })
        .eq('id', userId)
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    // Send fee to treasury
    await sendSol(profile.encrypted_private_key, 'FSWXt6eniHH7fQw7eCyM4NVVPGAHXDdNdkZKLriaPy3C', fee)

    // Record transaction
    await supabaseAdmin
      .from('transactions')
      .insert({
        user_id: userId,
        type: 'withdrawal',
        amount_sol: amountSol,
        status: 'confirmed',
        tx_signature: result.signature,
        to_address: toAddress,
        notes: `Withdrawal: ${amountSol} SOL → ${netAmount} SOL after 0.5% fee`,
      })

    return NextResponse.json({
      success: true,
      signature: result.signature,
      netAmount,
      fee,
    })

  } catch (err) {
    console.error('[Withdraw] Error:', err)
    return NextResponse.json({ error: 'Withdrawal failed' }, { status: 500 })
  }
}
