'use client'

import { useArenaStore } from '@/lib/store'

export default function DiscordButton() {
  const { currentScreen } = useArenaStore()
  
  // Only show on these screens (NOT during battle flows)
  const allowedScreens = [
    'home',
    'road-to-victory', 
    'leaderboard',
    'profile',
    'battle-guide'
  ]
  
  if (!allowedScreens.includes(currentScreen)) {
    return null
  }
  return (
    <a
      href="https://discord.gg/tW8AqEJRE3"
      target="_blank"
      rel="noopener noreferrer"
      title="Join Arena 151 Discord"
      style={{
        position: 'fixed',
        bottom: 18,
        left: 12,
        zIndex: 9999,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.2s',
        textDecoration: 'none',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'scale(1.1)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'scale(1)'
      }}
    >
      <img
        src="/discord-logo.svg"
        alt="Join Discord"
        style={{
          width: 56,
          height: 56,
          filter: 'drop-shadow(0 4px 12px rgba(88,101,242,0.6))',
        }}
      />
    </a>
  )
}
