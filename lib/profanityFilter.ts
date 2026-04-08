// Chat content filter for Arena 151
// Filters profanity, slurs, spam, and links

// Profanity patterns (will be replaced with asterisks)
// Using regex patterns to catch plurals, verb forms, and variations
const FILTERED_PATTERNS = [
  // F-word variations
  /\bf+u+c+k+(s|ing|ed|er|ing)?\b/gi,
  /\bf+u+k+(s|ing|ed|er)?\b/gi,
  /\bph+u+c+k+(s|ing|ed)?\b/gi,
  /\bf+[*@!]+c+k+(s|ing|ed)?\b/gi,
  
  // S-word variations
  /\bs+h+i+t+(s|ting|ted|ty)?\b/gi,
  /\bs+h+1+t+(s|ting)?\b/gi,
  /\bcr+a+p+(s|py)?\b/gi,
  
  // B-word variations
  /\bb+i+t+c+h+(es|ing|y)?\b/gi,
  /\bb+1+t+c+h+(es)?\b/gi,
  /\bb+[*@!]+t+c+h+(es)?\b/gi,
  
  // A-word variations
  /\ba+s+s+(es|hole|holes)?\b/gi,
  /\ba+z+z+(es)?\b/gi,
  
  // Other common profanity
  /\bd+a+m+n+(ed|ing)?\b/gi,
  /\bh+e+l+l+\b/gi,
  /\bb+a+s+t+a+r+d+(s)?\b/gi,
  /\bp+i+s+s+(ed|ing)?\b/gi,
  /\bd+i+c+k+(s|head)?\b/gi,
  /\bp+u+s+s+y+(ies)?\b/gi,
  /\bc+o+c+k+(s)?\b/gi,
  /\bc+0+c+k+(s)?\b/gi,
  /\bw+h+o+r+e+(s)?\b/gi,
  /\bs+l+u+t+(s|ty)?\b/gi,
  /\bt+w+a+t+(s)?\b/gi,
  /\bw+a+n+k+(er|ing)?\b/gi,
  
  // Severe slurs (will be caught separately for instant ban consideration)
  /\bn+i+g+g+(er|a|ers|as)\b/gi,
  /\bn+1+g+g+(er|a)\b/gi,
  /\bf+a+g+g+o+t+(s)?\b/gi,
  /\bf+a+g+(s)?\b/gi,
  /\bf+4+g+g+o+t+(s)?\b/gi,
  /\bd+y+k+e+(s)?\b/gi,
  /\bt+r+a+n+n+y+(ies)?\b/gi,
  /\br+e+t+a+r+d+(s|ed)?\b/gi,
  /\bc+u+n+t+(s)?\b/gi,
  /\bc+h+i+n+k+(s)?\b/gi,
  /\bs+p+i+c+(s)?\b/gi,
  /\bk+i+k+e+(s)?\b/gi,
  /\bk+y+k+e+(s)?\b/gi,
  /\bb+e+a+n+e+r+(s)?\b/gi,
  /\bw+e+t+b+a+c+k+(s)?\b/gi,
  /\bt+o+w+e+l+h+e+a+d+(s)?\b/gi,
  /\br+a+g+h+e+a+d+(s)?\b/gi,
  /\bg+o+o+k+(s)?\b/gi,
  /\bj+a+p+(s)?\b/gi,
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
  
  // Replace filtered patterns with asterisks (preserve first letter)
  for (const pattern of FILTERED_PATTERNS) {
    filtered = filtered.replace(pattern, (match) => {
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
