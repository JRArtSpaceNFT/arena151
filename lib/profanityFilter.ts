// Chat content filter for Arena 151
// Filters profanity, slurs, spam, and links

// Profanity and derogatory terms (will be replaced with asterisks)
const FILTERED_WORDS = [
  // Common profanity
  'fuck', 'shit', 'bitch', 'ass', 'damn', 'hell', 'bastard', 'piss',
  'dick', 'pussy', 'cock', 'whore', 'slut', 'twat', 'wank',
  
  // Slurs and derogatory terms
  'nigger', 'nigga', 'faggot', 'fag', 'dyke', 'tranny', 'retard',
  'retarded', 'cunt', 'chink', 'spic', 'kike', 'beaner', 'wetback',
  'towelhead', 'raghead', 'gook', 'jap', 'kyke',
  
  // Common substitutions/bypasses
  'fuk', 'fck', 'sh1t', 'b1tch', 'azz', 'phuck', 'phuk',
  'n1gger', 'n1gga', 'f4ggot', 'c0ck', 'p0rn',
]

// URL patterns to detect
const URL_PATTERNS = [
  /https?:\/\//i,
  /www\./i,
  /\.com\b/i,
  /\.net\b/i,
  /\.org\b/i,
  /\.io\b/i,
  /\.gg\b/i,
  /\.xyz\b/i,
  /\.link\b/i,
]

export function filterMessage(text: string): string {
  let filtered = text
  
  // Replace filtered words with asterisks (preserve first letter)
  for (const word of FILTERED_WORDS) {
    const regex = new RegExp(`\\b${word}\\b`, 'gi')
    filtered = filtered.replace(regex, (match) => {
      return match[0] + '*'.repeat(Math.max(match.length - 1, 1))
    })
  }
  
  return filtered
}

export function containsLink(text: string): boolean {
  return URL_PATTERNS.some(pattern => pattern.test(text))
}

export function isSpam(text: string): boolean {
  // Check for excessive repeated characters (e.g., "aaaaaaa")
  if (/([a-z])\1{5,}/i.test(text)) return true
  
  // Check for excessive caps (>70% caps in messages >10 chars)
  if (text.length > 10) {
    const capsCount = (text.match(/[A-Z]/g) || []).length
    const letterCount = (text.match(/[a-zA-Z]/g) || []).length
    if (letterCount > 0 && capsCount / letterCount > 0.7) return true
  }
  
  return false
}

export function sanitizeMessage(text: string): string {
  // Trim whitespace, limit to 200 chars
  let sanitized = text.trim().slice(0, 200)
  
  // Remove zalgo/excessive unicode combining marks
  sanitized = sanitized.replace(/[\u0300-\u036f]{3,}/g, '')
  
  return sanitized
}

export function validateMessage(text: string): { valid: boolean; error?: string; filtered?: string } {
  // Sanitize first
  const sanitized = sanitizeMessage(text)
  
  if (!sanitized || sanitized.length === 0) {
    return { valid: false, error: 'Message cannot be empty' }
  }
  
  // Check for links
  if (containsLink(sanitized)) {
    return { valid: false, error: 'Links are not allowed in chat' }
  }
  
  // Check for spam
  if (isSpam(sanitized)) {
    return { valid: false, error: 'Message flagged as spam' }
  }
  
  // Filter profanity/slurs
  const filtered = filterMessage(sanitized)
  
  return { valid: true, filtered }
}
