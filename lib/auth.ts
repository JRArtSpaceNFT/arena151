// Arena 151 Auth Layer
// Currently uses localStorage for persistence.
// Ready to swap for Supabase / Postgres when backend is configured.
// See BACKEND_SETUP.md for what's needed.

export interface StoredUser {
  id: string;
  email: string;
  passwordHash: string; // In production: bcrypt hash via backend API
  username: string;
  displayName: string;
  bio: string;
  avatar: string; // URL or base64 data URI
  favoritePokemonId: number;
  favoritePokemonName: string;
  favoritePokemonTypes: string[];
  internalWalletId: string;
  balance: number;
  earnings: number; // net SOL from battles
  wins: number;
  losses: number;
  joinedDate: string;
  resetToken?: string;
  resetTokenExpiry?: number;
}

const STORAGE_KEY = 'arena151_users';
const SESSION_KEY = 'arena151_session';

// Simple hash for frontend demo — replace with bcrypt on backend
function simpleHash(password: string): string {
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36) + password.length.toString(36);
}

function getUsers(): StoredUser[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveUsers(users: StoredUser[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
}

export function registerUser(data: {
  email: string;
  password: string;
  username: string;
  displayName: string;
  bio: string;
  avatar: string;
  favoritePokemonId: number;
  favoritePokemonName: string;
  favoritePokemonTypes: string[];
  testingMode: boolean;
}): { success: boolean; error?: string; user?: StoredUser } {
  const users = getUsers();

  if (users.find(u => u.email.toLowerCase() === data.email.toLowerCase())) {
    return { success: false, error: 'An account with this email already exists.' };
  }
  if (users.find(u => u.username.toLowerCase() === data.username.toLowerCase())) {
    return { success: false, error: 'That username is already taken.' };
  }

  const newUser: StoredUser = {
    id: `user_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    email: data.email.toLowerCase(),
    passwordHash: simpleHash(data.password),
    username: data.username,
    displayName: data.displayName,
    bio: data.bio,
    avatar: data.avatar,
    favoritePokemonId: data.favoritePokemonId,
    favoritePokemonName: data.favoritePokemonName,
    favoritePokemonTypes: data.favoritePokemonTypes,
    internalWalletId: `arena151_${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`,
    balance: data.testingMode ? 999999 : 0,
    earnings: 0,
    wins: 0,
    losses: 0,
    joinedDate: new Date().toISOString(),
  };

  users.push(newUser);
  saveUsers(users);
  saveSession(newUser.id);
  return { success: true, user: newUser };
}

export function loginUser(email: string, password: string): { success: boolean; error?: string; user?: StoredUser } {
  const users = getUsers();
  const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());

  if (!user) {
    return { success: false, error: 'No account found with that email.' };
  }
  if (user.passwordHash !== simpleHash(password)) {
    return { success: false, error: 'Incorrect password.' };
  }

  saveSession(user.id);
  return { success: true, user };
}

export function updateUser(id: string, updates: Partial<StoredUser>): void {
  const users = getUsers();
  const idx = users.findIndex(u => u.id === id);
  if (idx !== -1) {
    users[idx] = { ...users[idx], ...updates };
    saveUsers(users);
  }
}

export function getUserById(id: string): StoredUser | null {
  return getUsers().find(u => u.id === u.id && u.id === id) || null;
}

export function getAllUsers(): Omit<StoredUser, 'passwordHash' | 'resetToken' | 'resetTokenExpiry'>[] {
  return getUsers().map(({ passwordHash: _ph, resetToken: _rt, resetTokenExpiry: _rte, ...safe }) => safe);
}

export function saveSession(userId: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SESSION_KEY, userId);
}

export function getSession(): StoredUser | null {
  if (typeof window === 'undefined') return null;
  const userId = localStorage.getItem(SESSION_KEY);
  if (!userId) return null;
  return getUserById(userId);
}

export function clearSession(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(SESSION_KEY);
}

// Password reset - generates token and "sends" email (logs to console in dev)
export function initiatePasswordReset(email: string): { success: boolean; error?: string; token?: string } {
  const users = getUsers();
  const userIdx = users.findIndex(u => u.email.toLowerCase() === email.toLowerCase());

  if (userIdx === -1) {
    // Don't reveal if email exists - security best practice
    return { success: true };
  }

  const token = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  const expiry = Date.now() + 60 * 60 * 1000; // 1 hour

  users[userIdx].resetToken = token;
  users[userIdx].resetTokenExpiry = expiry;
  saveUsers(users);

  // In production: send via Resend/SendGrid. For now, log to console.
  console.log(`[Arena 151] Password reset link for ${email}: /reset-password?token=${token}`);

  return { success: true, token }; // Remove token from return in production
}

export function resetPassword(token: string, newPassword: string): { success: boolean; error?: string } {
  const users = getUsers();
  const userIdx = users.findIndex(u =>
    u.resetToken === token &&
    u.resetTokenExpiry &&
    u.resetTokenExpiry > Date.now()
  );

  if (userIdx === -1) {
    return { success: false, error: 'Invalid or expired reset link.' };
  }

  users[userIdx].passwordHash = simpleHash(newPassword);
  users[userIdx].resetToken = undefined;
  users[userIdx].resetTokenExpiry = undefined;
  saveUsers(users);

  return { success: true };
}
