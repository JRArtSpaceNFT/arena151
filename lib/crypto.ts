/**
 * Encryption utilities for secure token storage
 * Uses AES-256-GCM for authenticated encryption
 */

import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const SALT_LENGTH = 64
const TAG_LENGTH = 16
const KEY_LENGTH = 32

/**
 * Derive encryption key from master key using PBKDF2
 */
function deriveKey(password: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(password, salt, 100000, KEY_LENGTH, 'sha256')
}

/**
 * Encrypt text using AES-256-GCM
 * @param text - Plaintext to encrypt
 * @param masterKey - Master encryption key (from env var)
 * @returns base64 encoded encrypted data with salt, iv, and auth tag
 */
export function encrypt(text: string, masterKey: string): string {
  const salt = crypto.randomBytes(SALT_LENGTH)
  const key = deriveKey(masterKey, salt)
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')

  const tag = cipher.getAuthTag()

  // Format: salt:iv:tag:encrypted
  return Buffer.from(
    `${salt.toString('hex')}:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`
  ).toString('base64')
}

/**
 * Decrypt text using AES-256-GCM
 * @param encryptedData - base64 encoded encrypted data
 * @param masterKey - Master encryption key (from env var)
 * @returns decrypted plaintext
 */
export function decrypt(encryptedData: string, masterKey: string): string {
  const decoded = Buffer.from(encryptedData, 'base64').toString('utf8')
  const [saltHex, ivHex, tagHex, encrypted] = decoded.split(':')

  if (!saltHex || !ivHex || !tagHex || !encrypted) {
    throw new Error('Invalid encrypted data format')
  }

  const salt = Buffer.from(saltHex, 'hex')
  const iv = Buffer.from(ivHex, 'hex')
  const tag = Buffer.from(tagHex, 'hex')
  const key = deriveKey(masterKey, salt)

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)

  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}
