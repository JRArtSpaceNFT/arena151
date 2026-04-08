/**
 * X Connection Card Component
 * Profile settings UI for linking/unlinking X account
 */

'use client'

import { useState } from 'react'
import { useArenaStore } from '@/lib/store'

interface XConnectionCardProps {
  onConnectionChange?: () => void
}

export function XConnectionCard({ onConnectionChange }: XConnectionCardProps) {
  const currentUser = useArenaStore(s => s.currentTrainer)
  const [isUnlinking, setIsUnlinking] = useState(false)

  const isConnected = !!currentUser?.x_user_id
  const xUsername = currentUser?.x_username
  const xName = currentUser?.x_name
  const xProfileImage = currentUser?.x_profile_image_url
  const xVerifiedAt = currentUser?.x_verified_at

  const handleConnect = () => {
    // Redirect to OAuth connect route
    window.location.href = '/api/x/connect'
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
    <div className="rounded-lg border border-white/10 bg-gradient-to-br from-slate-800/50 to-slate-900/50 p-6">
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

      {/* Connection status */}
      <div className="mt-6">
        {!isConnected ? (
          // Not connected state
          <div>
            <button
              onClick={handleConnect}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-black px-6 py-3 font-bold text-white transition hover:bg-black/80"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              Connect X Account
            </button>
            <p className="mt-2 text-center text-xs text-white/40">
              You'll be redirected to X to authorize Arena 151
            </p>
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
