import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Helius sends an array of transaction events
    const events = Array.isArray(body) ? body : [body]

    for (const event of events) {
      // Look for SOL transfers (native transfers)
      const nativeTransfers = event.nativeTransfers || []

      for (const transfer of nativeTransfers) {
        const toAddress = transfer.toUserAccount
        const amountLamports = transfer.amount
        const amountSol = amountLamports / 1_000_000_000
        const signature = event.signature

        if (!toAddress || amountSol < 0.001) continue

        // Find the user with this wallet address
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('id, balance, email')
          .eq('sol_address', toAddress)
          .single()

        if (!profile) continue

        // Check we haven't already processed this transaction
        const { data: existing } = await supabaseAdmin
          .from('transactions')
          .select('id')
          .eq('tx_signature', signature)
          .single()

        if (existing) continue // Already processed

        // Credit the user's balance
        const newBalance = (profile.balance || 0) + amountSol

        await supabaseAdmin
          .from('profiles')
          .update({ balance: newBalance })
          .eq('id', profile.id)

        // Record the transaction
        await supabaseAdmin
          .from('transactions')
          .insert({
            user_id: profile.id,
            type: 'deposit',
            amount_sol: amountSol,
            status: 'confirmed',
            tx_signature: signature,
            to_address: toAddress,
            notes: `Deposit of ${amountSol.toFixed(4)} SOL`,
          })

        console.log(`[Deposit] ${amountSol} SOL credited to user ${profile.id} (${toAddress})`)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[Webhook] Error:', err)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
