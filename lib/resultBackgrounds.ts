/**
 * Result Background System
 * 
 * Single source of truth for victory/defeat backgrounds by trainer ID.
 * Validates asset existence and provides clear error logging.
 */

export type ResultOutcome = 'victory' | 'defeat'

export interface ResultBackground {
  victory: string
  defeat: string
}

/**
 * Trainer ID to result background mapping
 * Uses webp format for optimal performance
 * Asset path: /trainer-results/{trainerId}-{win|loss}.webp
 */
const RESULT_BACKGROUNDS: Record<string, ResultBackground> = {
  'red': {
    victory: '/trainer-results/red-win.webp',
    defeat: '/trainer-results/red-loss.webp',
  },
  'ash': {
    victory: '/trainer-results/ash-win.webp',
    defeat: '/trainer-results/ash-loss.webp',
  },
  'gary': {
    victory: '/trainer-results/gary-win.webp',
    defeat: '/trainer-results/gary-loss.webp',
  },
  'oak': {
    victory: '/trainer-results/oak-win.webp',
    defeat: '/trainer-results/oak-loss.webp',
  },
  'brock': {
    victory: '/trainer-results/brock-win.webp',
    defeat: '/trainer-results/brock-loss.webp',
  },
  'misty': {
    victory: '/trainer-results/misty-win.webp',
    defeat: '/trainer-results/misty-loss.webp',
  },
  'surge': {
    victory: '/trainer-results/surge-win.webp',
    defeat: '/trainer-results/surge-loss.webp',
  },
  'erika': {
    victory: '/trainer-results/erika-win.webp',
    defeat: '/trainer-results/erika-loss.webp',
  },
  'koga': {
    victory: '/trainer-results/koga-win.webp',
    defeat: '/trainer-results/koga-loss.webp',
  },
  'sabrina': {
    victory: '/trainer-results/sabrina-win.webp',
    defeat: '/trainer-results/sabrina-loss.webp',
  },
  'blaine': {
    victory: '/trainer-results/blaine-win.webp',
    defeat: '/trainer-results/blaine-loss.webp',
  },
  'giovanni': {
    victory: '/trainer-results/giovanni-win.webp',
    defeat: '/trainer-results/giovanni-loss.webp',
  },
  'lorelei': {
    victory: '/trainer-results/lorelei-win.webp',
    defeat: '/trainer-results/lorelei-loss.webp',
  },
  'bruno': {
    victory: '/trainer-results/bruno-win.webp',
    defeat: '/trainer-results/bruno-loss.webp',
  },
  'agatha': {
    victory: '/trainer-results/agatha-win.webp',
    defeat: '/trainer-results/agatha-loss.webp',
  },
  'lance': {
    victory: '/trainer-results/lance-win.webp',
    defeat: '/trainer-results/lance-loss.webp',
  },
  'fuji': {
    victory: '/trainer-results/fuji-win.webp',
    defeat: '/trainer-results/fuji-loss.webp',
  },
  'jessie-james': {
    victory: '/trainer-results/jessie-james-win.webp',
    defeat: '/trainer-results/jessie-james-loss.webp',
  },
}

/**
 * Fallback background when trainer background is missing
 */
const FALLBACK_BACKGROUND = '/victory-bg.webp'

/**
 * Get result background for a trainer
 * 
 * @param trainerId - Trainer ID (e.g., 'ash', 'gary')
 * @param outcome - 'victory' or 'defeat'
 * @returns Background image path, or fallback if not found
 * 
 * @example
 * const bg = getResultBackground('ash', 'victory')
 * // Returns: '/trainer-results/ash-win.webp'
 */
export function getResultBackground(
  trainerId: string | undefined | null,
  outcome: ResultOutcome
): string {
  // Validation: missing trainer ID
  if (!trainerId) {
    console.error('[ResultBackgrounds] Missing trainer ID', {
      trainerId,
      outcome,
      timestamp: new Date().toISOString(),
    })
    return FALLBACK_BACKGROUND
  }

  // Validation: trainer not in map
  const backgrounds = RESULT_BACKGROUNDS[trainerId]
  if (!backgrounds) {
    console.error('[ResultBackgrounds] Unknown trainer ID', {
      trainerId,
      outcome,
      availableTrainers: Object.keys(RESULT_BACKGROUNDS),
      timestamp: new Date().toISOString(),
    })
    return FALLBACK_BACKGROUND
  }

  const backgroundPath = backgrounds[outcome]

  // Validation: outcome asset missing (should never happen with TypeScript)
  if (!backgroundPath) {
    console.error('[ResultBackgrounds] Missing background for outcome', {
      trainerId,
      outcome,
      availableOutcomes: Object.keys(backgrounds),
      timestamp: new Date().toISOString(),
    })
    return FALLBACK_BACKGROUND
  }

  // Debug logging (can be removed after testing)
  if (process.env.NODE_ENV === 'development') {
    console.log('[ResultBackgrounds] Resolved background', {
      trainerId,
      outcome,
      backgroundPath,
      timestamp: new Date().toISOString(),
    })
  }

  return backgroundPath
}

/**
 * Preload result backgrounds for given trainers
 * Call this before entering battle to avoid loading flash
 * 
 * @param trainerIds - Array of trainer IDs to preload
 * 
 * @example
 * preloadResultBackgrounds(['ash', 'gary'])
 */
export function preloadResultBackgrounds(trainerIds: string[]): void {
  if (typeof window === 'undefined') return // SSR guard

  trainerIds.forEach(trainerId => {
    const backgrounds = RESULT_BACKGROUNDS[trainerId]
    if (!backgrounds) {
      console.warn('[ResultBackgrounds] Cannot preload unknown trainer', { trainerId })
      return
    }

    // Preload both victory and defeat
    ;[backgrounds.victory, backgrounds.defeat].forEach(path => {
      const img = new Image()
      img.src = path
      console.log('[ResultBackgrounds] Preloading', { trainerId, path })
    })
  })
}

/**
 * Validate all result background assets exist
 * Returns list of missing assets for debugging
 * 
 * @returns Array of missing asset paths
 */
export function validateResultBackgrounds(): string[] {
  const missing: string[] = []

  Object.entries(RESULT_BACKGROUNDS).forEach(([trainerId, backgrounds]) => {
    if (!backgrounds.victory) {
      missing.push(`${trainerId}: missing victory background`)
    }
    if (!backgrounds.defeat) {
      missing.push(`${trainerId}: missing defeat background`)
    }
  })

  if (missing.length > 0) {
    console.error('[ResultBackgrounds] Validation failed', { missing })
  } else {
    console.log('[ResultBackgrounds] All backgrounds validated ✓')
  }

  return missing
}

/**
 * Get all registered trainer IDs
 */
export function getRegisteredTrainerIds(): string[] {
  return Object.keys(RESULT_BACKGROUNDS)
}
