/**
 * Public X Badge Component
 * Shows verified X account on public profile
 */

'use client'

interface PublicXBadgeProps {
  xUserId?: string | null
  xUsername?: string | null
  xName?: string | null
  xProfileImage?: string | null
  size?: 'sm' | 'md' | 'lg'
}

export function PublicXBadge({
  xUserId,
  xUsername,
  xName,
  xProfileImage,
  size = 'md',
}: PublicXBadgeProps) {
  // Only render if X account is linked and verified
  if (!xUserId || !xUsername) return null

  const sizeClasses = {
    sm: 'text-xs gap-1.5 px-2 py-1',
    md: 'text-sm gap-2 px-3 py-1.5',
    lg: 'text-base gap-2.5 px-4 py-2',
  }

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  }

  return (
    <a
      href={`https://x.com/${xUsername}`}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center rounded-full border border-white/20 bg-black/40 font-bold text-white transition hover:bg-black/60 hover:border-white/40 ${sizeClasses[size]}`}
      title={`${xName || xUsername} on X`}
    >
      {/* X logo */}
      <svg
        viewBox="0 0 24 24"
        className={iconSizes[size]}
        fill="currentColor"
      >
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>

      {/* Profile image (optional) */}
      {xProfileImage && size !== 'sm' && (
        <img
          src={xProfileImage}
          alt={xUsername}
          className="h-5 w-5 rounded-full"
        />
      )}

      {/* Username */}
      <span>@{xUsername}</span>

      {/* Verified checkmark */}
      <svg
        className={`${iconSizes[size]} text-green-500`}
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
      </svg>
    </a>
  )
}
