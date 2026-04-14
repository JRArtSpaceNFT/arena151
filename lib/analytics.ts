/**
 * Analytics tracking for Arena 151
 * 
 * Integrates with PostHog (or can be swapped for Mixpanel/Amplitude)
 * Also logs events for internal dashboard
 */

interface AnalyticsEvent {
  event: string
  properties?: Record<string, any>
}

export const analytics = {
  /**
   * Track an event
   */
  track(event: string, properties?: Record<string, any>) {
    // PostHog client-side tracking
    if (typeof window !== 'undefined' && (window as any).posthog) {
      ;(window as any).posthog.capture(event, properties)
    }
    
    // Also log for internal analytics dashboard
    if (typeof window !== 'undefined') {
      fetch('/api/internal/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event,
          properties,
          timestamp: Date.now(),
          url: window.location.href,
          userAgent: navigator.userAgent,
        }),
      }).catch(() => {
        // Silent fail - analytics should never break the app
      })
    }
  },

  /**
   * Identify a user
   */
  identify(userId: string, traits?: Record<string, any>) {
    if (typeof window !== 'undefined' && (window as any).posthog) {
      ;(window as any).posthog.identify(userId, traits)
    }
  },

  /**
   * Reset tracking (on logout)
   */
  reset() {
    if (typeof window !== 'undefined' && (window as any).posthog) {
      ;(window as any).posthog.reset()
    }
  },
}

// Convenience functions for common events
export const trackEvent = {
  // User events
  signUp: (method: string) => analytics.track('user_signed_up', { method }),
  login: () => analytics.track('user_logged_in'),
  logout: () => analytics.track('user_logged_out'),

  // Battle events
  battleStarted: (roomId: string, entryFee: number) => 
    analytics.track('battle_started', { roomId, entryFee }),
  battleCompleted: (roomId: string, winnerId: string, duration: number) => 
    analytics.track('battle_completed', { roomId, winnerId, duration }),
  
  // Financial events
  depositInitiated: (amount: number) => 
    analytics.track('deposit_initiated', { amount }),
  depositCompleted: (amount: number, txSignature: string) => 
    analytics.track('deposit_completed', { amount, txSignature }),
  withdrawalRequested: (amount: number) => 
    analytics.track('withdrawal_requested', { amount }),
  withdrawalCompleted: (amount: number, txSignature: string) => 
    analytics.track('withdrawal_completed', { amount, txSignature }),

  // Engagement events
  roomSelected: (roomId: string) => analytics.track('room_selected', { roomId }),
  queueJoined: (roomId: string) => analytics.track('queue_joined', { roomId }),
  profileViewed: (trainerId: string) => analytics.track('profile_viewed', { trainerId }),
}
