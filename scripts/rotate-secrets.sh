#!/bin/bash
# Arena 151 Secret Rotation Script
# Run this ONCE to rotate all secrets and prepare for Vercel deployment

set -e

echo "🔐 Arena 151 Secret Rotation"
echo "=============================="
echo ""
echo "⚠️  WARNING: This will generate NEW secrets and require re-encryption of all wallets."
echo "⚠️  Make sure you have a DATABASE BACKUP before proceeding."
echo ""
read -p "Have you backed up the database? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
  echo "❌ Aborted. Backup your database first."
  exit 1
fi

echo ""
echo "Generating new secrets..."
echo ""

# Generate new secrets
NEW_WALLET_KEY=$(openssl rand -hex 32)
NEW_ADMIN_SECRET=$(openssl rand -hex 32)
NEW_CRON_SECRET=$(openssl rand -hex 32)

echo "✅ WALLET_ENCRYPTION_SECRET (new): $NEW_WALLET_KEY"
echo "✅ ADMIN_SECRET (new): $NEW_ADMIN_SECRET"
echo "✅ CRON_SECRET (new): $NEW_CRON_SECRET"
echo ""
echo "📋 HELIUS_WEBHOOK_SECRET: Regenerate this in Helius dashboard → Webhooks → Signing Secret"
echo "📋 HELIUS_API_KEY: Create separate keys for dev/staging/prod in Helius dashboard"
echo "📋 SUPABASE_SERVICE_KEY: Contact Supabase support to rotate (not self-service)"
echo ""
echo "Next steps:"
echo "1. Add these to Vercel env vars (dashboard → Settings → Environment Variables)"
echo "2. Run npm run migrate:re-encrypt to re-encrypt all private keys with new WALLET_ENCRYPTION_SECRET"
echo "3. Update Helius webhook secret in Helius dashboard"
echo "4. Deploy to Vercel (secrets will be injected automatically)"
echo "5. DELETE .env.local from your local machine"
echo ""
echo "🔴 CRITICAL: Do NOT commit these secrets to Git"
echo "🔴 Store them in 1Password, Bitwarden, or your password manager"
