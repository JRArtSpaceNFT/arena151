// Run this ONCE to register Arena 151 with Helius and get a webhook ID
// Usage: node scripts/register-helius-webhook.mjs
//
// After running, save the webhookId output and add it to:
//   .env.local → HELIUS_WEBHOOK_ID=<id>
//   Vercel env vars → HELIUS_WEBHOOK_ID=<id>

const HELIUS_API_KEY = '940fb72c-4bfe-4624-b55e-a9de4ba21b88'
const WEBHOOK_URL = 'https://jonathan-foley-og6b.vercel.app/api/webhook/deposit'

const response = await fetch(`https://api.helius.xyz/v0/webhooks?api-key=${HELIUS_API_KEY}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    webhookURL: WEBHOOK_URL,
    transactionTypes: ['TRANSFER'],
    accountAddresses: [], // addresses added dynamically as users sign up
    webhookType: 'enhanced',
  }),
})

const data = await response.json()
console.log('Webhook created:', JSON.stringify(data, null, 2))
if (data.webhookId) {
  console.log('\n✅ Add this to .env.local and Vercel:')
  console.log(`HELIUS_WEBHOOK_ID=${data.webhookId}`)
} else {
  console.error('\n❌ No webhookId returned — check response above')
}
