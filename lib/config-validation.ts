/**
 * Configuration Validation
 * 
 * Validates required environment variables at startup.
 * Fails fast with clear error messages if secrets are missing.
 * 
 * Import this at the top of app/layout.tsx or instrumentation.ts
 * to ensure validation runs before any API requests.
 */

export function validateEnvConfig() {
  const errors: string[] = []

  // ═══════════════════════════════════════════════════════════════
  // Required Secrets (Server-Side Only)
  // ═══════════════════════════════════════════════════════════════

  if (typeof window === 'undefined') {
    // Supabase
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      errors.push('NEXT_PUBLIC_SUPABASE_URL is required')
    }
    if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      errors.push('NEXT_PUBLIC_SUPABASE_ANON_KEY is required')
    }
    if (!process.env.SUPABASE_SERVICE_KEY) {
      errors.push('SUPABASE_SERVICE_KEY is required (set in Vercel env vars)')
    }

    // Helius
    if (!process.env.HELIUS_API_KEY) {
      errors.push('HELIUS_API_KEY is required (set in Vercel env vars)')
    }
    if (!process.env.HELIUS_WEBHOOK_SECRET) {
      errors.push('HELIUS_WEBHOOK_SECRET is required (set in Vercel env vars)')
    }

    // Wallet Encryption
    if (!process.env.WALLET_ENCRYPTION_SECRET) {
      errors.push('WALLET_ENCRYPTION_SECRET is required (64-char hex, set in Vercel env vars)')
    } else if (process.env.WALLET_ENCRYPTION_SECRET.length !== 64) {
      errors.push('WALLET_ENCRYPTION_SECRET must be exactly 64 characters (32 bytes hex)')
    } else if (!/^[a-f0-9]{64}$/i.test(process.env.WALLET_ENCRYPTION_SECRET)) {
      errors.push('WALLET_ENCRYPTION_SECRET must be a valid hex string (0-9, a-f)')
    }

    // Admin & Cron
    if (!process.env.ADMIN_SECRET) {
      errors.push('ADMIN_SECRET is required (set in Vercel env vars)')
    }
    // CRON_SECRET is now optional (replaced by x-vercel-cron header)
    // But keep for backwards compatibility during migration
    if (!process.env.CRON_SECRET && !process.env.VERCEL) {
      console.warn('⚠️  CRON_SECRET not set. Cron endpoints will only accept x-vercel-cron header.')
    }

    // App URL
    if (!process.env.NEXT_PUBLIC_APP_URL) {
      errors.push('NEXT_PUBLIC_APP_URL is required (e.g., https://arena151.xyz)')
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Fail Fast if Errors
  // ═══════════════════════════════════════════════════════════════

  if (errors.length > 0) {
    console.error('❌ Configuration Validation Failed')
    console.error('====================================')
    errors.forEach(err => console.error(`  - ${err}`))
    console.error('')
    console.error('🔴 Set these in Vercel Dashboard → Settings → Environment Variables')
    console.error('🔴 For local dev, add to .env.local (but DO NOT commit to Git)')
    console.error('')
    throw new Error('Missing required environment variables. See logs above.')
  }

  // ═══════════════════════════════════════════════════════════════
  // Warnings (Non-Blocking)
  // ═══════════════════════════════════════════════════════════════

  if (typeof window === 'undefined') {
    // Warn if running in production without proper domain
    if (process.env.VERCEL_ENV === 'production' && !process.env.NEXT_PUBLIC_APP_URL?.includes('arena151.xyz')) {
      console.warn('⚠️  NEXT_PUBLIC_APP_URL does not match production domain')
    }

    // Warn if service key looks like anon key (common mistake)
    if (process.env.SUPABASE_SERVICE_KEY === process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.warn('⚠️  SUPABASE_SERVICE_KEY matches ANON_KEY — this is likely a configuration error')
    }
  }
}

// Auto-validate on import (server-side only)
if (typeof window === 'undefined' && process.env.NODE_ENV !== 'test') {
  try {
    validateEnvConfig()
    console.log('✅ Environment configuration validated')
  } catch (err) {
    // Let the error propagate — app should not start with invalid config
    throw err
  }
}
