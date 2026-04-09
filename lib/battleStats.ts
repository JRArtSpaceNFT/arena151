// ─── Battle Stats & Feed (localStorage-based) ────────────────────────────────

export interface BattleLogEntry {
  winner: string
  loser: string
  arena: string
  arenaEmoji?: string
  timestamp: number
  userId?: string // ID of the user this battle belongs to
}

const KEYS = {
  battlesTotal: 'arena151_battles_total',
  sessionsToday: 'arena151_sessions_today',
  lastSession: 'arena151_last_session',
  battleLog: 'arena151_battle_log',
} as const

// ── Read helpers ───────────────────────────────────────────────────────────────

export function getBattlesTotal(): number {
  if (typeof window === 'undefined') return 0
  return parseInt(localStorage.getItem(KEYS.battlesTotal) ?? '0', 10) || 0
}

export function getSessionsToday(): number {
  if (typeof window === 'undefined') return 0
  return parseInt(localStorage.getItem(KEYS.sessionsToday) ?? '0', 10) || 0
}

export function getBattleLog(userId?: string): BattleLogEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const allBattles = JSON.parse(localStorage.getItem(KEYS.battleLog) ?? '[]') as BattleLogEntry[]
    // If userId provided, filter to only that user's battles
    if (userId) {
      return allBattles.filter(b => b.userId === userId)
    }
    return allBattles
  } catch {
    return []
  }
}

// ── Write helpers ──────────────────────────────────────────────────────────────

export function incrementBattlesTotal(): number {
  if (typeof window === 'undefined') return 0
  const next = getBattlesTotal() + 1
  localStorage.setItem(KEYS.battlesTotal, String(next))
  return next
}

/** Call once on page load to track "trainers today" */
export function trackSession(): void {
  if (typeof window === 'undefined') return
  const now = Date.now()
  const last = parseInt(localStorage.getItem(KEYS.lastSession) ?? '0', 10) || 0
  const THIRTY_MINUTES = 30 * 60 * 1000
  if (now - last > THIRTY_MINUTES) {
    // New session
    const today = new Date().toDateString()
    const storedDate = localStorage.getItem('arena151_sessions_date')
    if (storedDate !== today) {
      // Reset count for new day
      localStorage.setItem('arena151_sessions_today', '1')
      localStorage.setItem('arena151_sessions_date', today)
    } else {
      const next = getSessionsToday() + 1
      localStorage.setItem(KEYS.sessionsToday, String(next))
    }
    localStorage.setItem(KEYS.lastSession, String(now))
  }
}

export function addBattleToLog(entry: BattleLogEntry): void {
  if (typeof window === 'undefined') return
  const log = getBattleLog() // Get all battles (no filter)
  log.unshift(entry)
  // Keep last 100 battles total (across all users on this device)
  if (log.length > 100) log.length = 100
  localStorage.setItem(KEYS.battleLog, JSON.stringify(log))
}

export function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}
