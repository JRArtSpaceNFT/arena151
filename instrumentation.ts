/**
 * Next.js Instrumentation Hook
 * 
 * This file runs once when the Next.js server starts.
 * Use it for startup validation, telemetry, etc.
 * 
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Import and run config validation at startup
    const { validateEnvConfig } = await import('./lib/config-validation')
    
    try {
      validateEnvConfig()
      console.log('✅ [Startup] Environment configuration validated')
    } catch (err) {
      console.error('❌ [Startup] Configuration validation failed')
      console.error(err)
      // Fail-fast: exit process if critical secrets are missing
      process.exit(1)
    }
  }
}
