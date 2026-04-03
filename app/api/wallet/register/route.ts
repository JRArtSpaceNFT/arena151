import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { address } = await req.json()

  if (!address) {
    return NextResponse.json({ error: 'Address required' }, { status: 400 })
  }

  // Get the current webhook to read existing addresses
  const getRes = await fetch(
    `https://api.helius.xyz/v0/webhooks/${process.env.HELIUS_WEBHOOK_ID}?api-key=${process.env.HELIUS_API_KEY}`,
    { method: 'GET' }
  )

  let existingAddresses: string[] = []
  if (getRes.ok) {
    const existing = await getRes.json()
    existingAddresses = existing.accountAddresses || []
  }

  // Add address to existing Helius webhook (append to existing addresses)
  const res = await fetch(
    `https://api.helius.xyz/v0/webhooks/${process.env.HELIUS_WEBHOOK_ID}?api-key=${process.env.HELIUS_API_KEY}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        webhookURL: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhook/deposit`,
        transactionTypes: ['Any'],
        accountAddresses: [...existingAddresses, address],
        webhookType: 'enhanced',
      }),
    }
  )

  const data = await res.json()
  return NextResponse.json({ ok: true, data })
}
