// Basic profanity filter for Arena 151 chat
// Returns true if message contains filtered words

const FILTERED_WORDS = [
  'fuck', 'shit', 'bitch', 'ass', 'damn', 'hell',
  'nigger', 'nigga', 'faggot', 'retard', 'cunt',
  'dick', 'pussy', 'cock', 'whore', 'slut',
  // Add more as needed
]

export function containsProfanity(text: string): boolean {
  const lowercased = text.toLowerCase()
  
  // Check for exact word matches (with word boundaries)
  for (const word of FILTERED_WORDS) {
    const regex = new RegExp(`\\b${word}\\b`, 'i')
    if (regex.test(lowercased)) {
      return true
    }
  }
  
  return false
}

export function sanitizeMessage(text: string): string {
  // Basic sanitization: trim whitespace, limit to 200 chars
  return text.trim().slice(0, 200)
}
