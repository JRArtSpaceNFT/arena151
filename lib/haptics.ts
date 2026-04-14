/**
 * Haptic feedback utilities for mobile devices
 * 
 * Uses Vibration API where available.
 * Gracefully degrades on unsupported browsers.
 */

export const haptic = {
  /**
   * Light tap (10ms) - for UI interactions like button presses
   */
  light: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(10)
    }
  },

  /**
   * Medium tap (20ms) - for selections, confirmations
   */
  medium: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(20)
    }
  },

  /**
   * Heavy tap (30ms + 30ms) - for important actions
   */
  heavy: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate([30, 10, 30])
    }
  },

  /**
   * Success pattern (20ms + 40ms) - for victories, confirmations
   */
  success: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate([20, 10, 40])
    }
  },

  /**
   * Error pattern (3x 50ms) - for failures, warnings
   */
  error: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate([50, 30, 50, 30, 50])
    }
  },

  /**
   * Impact - for attacks, collisions in battle
   */
  impact: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate([15, 5, 25])
    }
  },
}
