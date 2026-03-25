// Username moderation - catches slurs, profanity, and leet-speak substitutions

// Normalize leet-speak and number substitutions to actual letters
export function normalizeLeetSpeak(input: string): string {
  return input
    .toLowerCase()
    .replace(/0/g, 'o')
    .replace(/1/g, 'i')
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/5/g, 's')
    .replace(/6/g, 'g')
    .replace(/7/g, 't')
    .replace(/8/g, 'b')
    .replace(/9/g, 'g')
    .replace(/@/g, 'a')
    .replace(/\$/g, 's')
    .replace(/!/g, 'i')
    .replace(/\+/g, 't')
    .replace(/[^a-z]/g, ''); // strip remaining non-alpha after normalization
}

// Blocked terms - racial slurs, severe profanity, hateful language
// Using partial fragments so the list catches variations
const BLOCKED_FRAGMENTS = [
  // Racial slurs (keeping this list to fragments to avoid displaying them)
  'nigger', 'nigga', 'nigg', 'niga', 'chink', 'spic', 'kike', 'wetback',
  'gook', 'towelhead', 'raghead', 'beaner', 'coon', 'cracker', 'honky',
  'jigaboo', 'pickaninny', 'sambo', 'spook', 'jungle', 'porch',
  // Profanity
  'fuck', 'fuk', 'fck', 'shit', 'sht', 'cunt', 'cnt', 'pussy', 'puss',
  'bitch', 'btch', 'asshole', 'assh', 'cock', 'ckck', 'dick', 'dck',
  'faggot', 'fagot', 'fag', 'dyke', 'retard', 'retrd',
  // Hate terms
  'hitler', 'nazi', 'kkk', 'jihad', 'terrorist', 'rape', 'rapist',
  'pedo', 'pedophile', 'molest', 'homo', 'tranny',
];

export function isUsernameBlocked(username: string): { blocked: boolean; reason?: string } {
  const normalized = normalizeLeetSpeak(username);
  const raw = username.toLowerCase().replace(/[^a-z0-9]/g, '');

  for (const fragment of BLOCKED_FRAGMENTS) {
    if (normalized.includes(fragment) || raw.includes(fragment)) {
      return { blocked: true, reason: 'Username contains prohibited language.' };
    }
  }

  return { blocked: false };
}

// Username format rules
export function validateUsername(username: string): { valid: boolean; error?: string } {
  if (!username || username.length < 3) {
    return { valid: false, error: 'Username must be at least 3 characters.' };
  }
  if (username.length > 20) {
    return { valid: false, error: 'Username must be 20 characters or less.' };
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    return { valid: false, error: 'Username can only contain letters, numbers, underscores, and hyphens.' };
  }

  const modCheck = isUsernameBlocked(username);
  if (modCheck.blocked) {
    return { valid: false, error: modCheck.reason };
  }

  return { valid: true };
}

// Chat message filter
export function filterChatMessage(message: string): string {
  const normalized = normalizeLeetSpeak(message);
  let filtered = message;

  for (const fragment of BLOCKED_FRAGMENTS) {
    if (normalized.includes(fragment)) {
      // Replace with stars in the original message using case-insensitive regex
      const regex = new RegExp(fragment.split('').join('.?'), 'gi');
      filtered = filtered.replace(regex, (match) => '*'.repeat(match.length));
    }
  }

  return filtered;
}
