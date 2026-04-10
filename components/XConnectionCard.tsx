/**
 * X Connection Card Component
 * Profile settings UI for linking/unlinking X account
 */

'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useArenaStore } from '@/lib/store'

interface XConnectionCardProps {
  onConnectionChange?: () => void
}

export function XConnectionCard({ onConnectionChange }: XConnectionCardProps) {
  const currentUser = useArenaStore(s => s.currentTrainer)
  const [isUnlinking, setIsUnlinking] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Check for error in URL on mount
  useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const error = params.get('x_error')
      if (error) {
        setErrorMessage(error)
        // Clear error from URL
        window.history.replaceState({}, '', window.location.pathname)
      }
    }
  })

  const isConnected = !!currentUser?.x_user_id
  const xUsername = currentUser?.x_username
  const xName = currentUser?.x_name
  const xProfileImage = currentUser?.x_profile_image_url
  const xVerifiedAt = currentUser?.x_verified_at

  const handleConnect = async () => {
    // Temporarily disabled - coming soon
    setErrorMessage('X account linking is coming soon!')
    return
  }

  const handleUnlink = async () => {
    if (!confirm('Are you sure you want to unlink your X account?')) return

    setIsUnlinking(true)

    try {
      const response = await fetch('/api/x/unlink', {
        method: 'POST',
      })

      const data = await response.json()

      if (data.success) {
        alert('X account unlinked successfully')
        onConnectionChange?.()
        // Refresh page to update UI
        window.location.reload()
      } else {
        alert(`Failed to unlink: ${data.error}`)
      }
    } catch (error) {
      console.error('Unlink error:', error)
      alert('Failed to unlink X account')
    } finally {
      setIsUnlinking(false)
    }
  }

  return (
    <div className="rounded-2xl border shadow-xl relative overflow-hidden" style={{ background: 'linear-gradient(160deg, #0a1929 0%, #1a0a2e 100%)', borderColor: 'rgba(29,161,242,0.2)', padding: '1.5rem' }}>
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-bold text-white">X (Twitter) Account</h3>
          <p className="mt-1 text-sm text-white/60">
            Link your X account to verify your identity and display it on your profile
          </p>
        </div>

        {/* X logo */}
        <svg
          viewBox="0 0 24 24"
          className="h-8 w-8 text-white/80"
          fill="currentColor"
        >
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      </div>

      {/* Error message */}
      {errorMessage && (
        <div className="mt-4 rounded-lg border border-red-500/50 bg-red-500/10 p-3">
          <p className="text-sm font-bold text-red-400">
            {errorMessage === 'Not authenticated' 
              ? 'Please log in to Arena 151 first before connecting your X account'
              : errorMessage}
          </p>
        </div>
      )}

      {/* Connection status */}
      <div className="mt-6">
        {!isConnected ? (
          // Not connected state
          <div>
            <motion.button
              onClick={handleConnect}
              disabled={!currentUser}
              whileHover={currentUser ? { scale: 1.03, y: -2 } : {}}
              whileTap={currentUser ? { scale: 0.98, y: 0 } : {}}
              className="flex w-full items-center justify-center gap-3 rounded-xl px-8 py-5 font-black text-lg text-white transition-all duration-200 disabled:cursor-not-allowed relative overflow-hidden group"
              style={{
                background: currentUser 
                  ? 'linear-gradient(135deg, #1DA1F2 0%, #0d8bd9 100%)'
                  : 'linear-gradient(135deg, #475569 0%, #334155 100%)',
                boxShadow: currentUser
                  ? '0 6px 0 0 #0d8bd9, 0 8px 24px rgba(29,161,242,0.5), inset 0 1px 0 rgba(255,255,255,0.25)'
                  : '0 4px 0 0 #1e293b, 0 6px 12px rgba(0,0,0,0.3)',
                opacity: currentUser ? 1 : 0.5,
                transform: 'translateZ(0)', // Enable 3D transforms
              }}
            >
              {/* Animated shine effect on hover */}
              <motion.div 
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent"
                initial={{ x: '-100%' }}
                whileHover={{ x: '200%' }}
                transition={{ duration: 0.6 }}
              />
              <svg viewBox="0 0 24 24" className="h-6 w-6 relative z-10" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              <span className="relative z-10">Connect X Account (Coming Soon)</span>
            </motion.button>
            {!currentUser ? (
              <p className="mt-2 text-center text-xs text-red-400">
                ⚠️ You must be logged in to connect your X account
              </p>
            ) : (
              <p className="mt-2 text-center text-xs text-white/40">
                You'll be redirected to X to authorize Arena 151
              </p>
            )}
          </div>
        ) : (
          // Connected state
          <div>
            <div className="flex items-center gap-3 rounded-lg border border-green-500/30 bg-green-500/10 p-4">
              {/* Profile image */}
              {xProfileImage && (
                <img
                  src={xProfileImage}
                  alt={xUsername || 'X profile'}
                  className="h-12 w-12 rounded-full"
                />
              )}

              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white">{xName}</span>
                  <span className="rounded bg-green-500 px-1.5 py-0.5 text-xs font-bold text-white">
                    ✓ Verified
                  </span>
                </div>
                <a
                  href={`https://x.com/${xUsername}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-white/60 hover:text-white hover:underline"
                >
                  @{xUsername}
                </a>
                {xVerifiedAt && (
                  <p className="mt-1 text-xs text-white/40">
                    Connected {new Date(xVerifiedAt).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="mt-4 flex gap-2">
              <button
                onClick={handleConnect}
                className="flex-1 rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/10"
              >
                Change Account
              </button>
              <button
                onClick={handleUnlink}
                disabled={isUnlinking}
                className="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-2 text-sm font-bold text-red-500 transition hover:bg-red-500/20 disabled:opacity-50"
              >
                {isUnlinking ? 'Unlinking...' : 'Unlink'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
