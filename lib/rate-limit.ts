/**
 * Rate Limiting for Money-Sensitive Routes
 * 
 * In-memory rate limiter using sliding window algorithm.
 * 
 * LIMITS:
 * - /api/match/create: 10 requests per 5 minutes per user
 * - /api/withdraw: 3 requests per 1 hour per user
 * - /api/match/[id]/join: 20 requests per 5 minutes per user
 * 
 * IMPORTANT: This is in-memory (resets on server restart).
 * For multi-instance deployments, use Vercel KV or Redis.
 */

interface RateLimitEntry {
  timestamps: number[]  // Array of request timestamps (milliseconds)
}

const rateLimitStore = new Map<string, RateLimitEntry>()

export interface RateLimitConfig {
  maxRequests: number
  windowMs: number
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetMs: number
}

/**
 * Check if request is allowed under rate limit.
 * 
 * @param key - Unique identifier (e.g., `userId:match-create`)
 * @param config - Rate limit configuration
 * @returns RateLimitResult
 */
export function checkRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now()
  const windowStart = now - config.windowMs

  // Get or create entry
  let entry = rateLimitStore.get(key)
  if (!entry) {
    entry = { timestamps: [] }
    rateLimitStore.set(key, entry)
  }

  // Remove timestamps outside the current window (sliding window)
  entry.timestamps = entry.timestamps.filter(ts => ts > windowStart)

  // Check if limit exceeded
  if (entry.timestamps.length >= config.maxRequests) {
    const oldestTimestamp = Math.min(...entry.timestamps)
    const resetMs = (oldestTimestamp + config.windowMs) - now

    return {
      allowed: false,
      remaining: 0,
      resetMs: Math.max(0, resetMs),
    }
  }

  // Record this request
  entry.timestamps.push(now)

  return {
    allowed: true,
    remaining: config.maxRequests - entry.timestamps.length,
    resetMs: config.windowMs,
  }
}

/**
 * Clean up old entries (run periodically via cron or on-demand)
 */
export function cleanupRateLimitStore() {
  const now = Date.now()
  const maxAge = 60 * 60 * 1000  // 1 hour

  for (const [key, entry] of rateLimitStore.entries()) {
    // Remove entry if all timestamps are older than 1 hour
    if (entry.timestamps.length === 0 || Math.max(...entry.timestamps) < now - maxAge) {
      rateLimitStore.delete(key)
    }
  }
}

// Periodic cleanup (every 10 minutes)
if (typeof window === 'undefined') {
  setInterval(cleanupRateLimitStore, 10 * 60 * 1000)
}

/**
 * Predefined rate limit configs for money-sensitive routes
 */
export const RATE_LIMITS = {
  MATCH_CREATE: {
    maxRequests: 10,
    windowMs: 5 * 60 * 1000,  // 5 minutes
  },
  WITHDRAW: {
    maxRequests: 3,
    windowMs: 60 * 60 * 1000,  // 1 hour
  },
  MATCH_JOIN: {
    maxRequests: 20,
    windowMs: 5 * 60 * 1000,  // 5 minutes
  },
} as const
