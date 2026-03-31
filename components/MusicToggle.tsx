'use client'

import { useState, useEffect } from 'react'
import { isMusicMuted, setMusicMuted } from '@/lib/audio/musicEngine'

export default function MusicToggle() {
  const [muted, setMuted] = useState(false)

  useEffect(() => {
    setMuted(isMusicMuted())
  }, [])

  function toggle() {
    const next = !muted
    setMuted(next)
    setMusicMuted(next)
  }

  return (
    <button
      onClick={toggle}
      title={muted ? 'Unmute music' : 'Mute music'}
      style={{
        position: 'fixed',
        bottom: 36,
        left: 18,
        zIndex: 9999,
        width: 38,
        height: 38,
        borderRadius: '50%',
        border: '1px solid rgba(255,255,255,0.15)',
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(8px)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: muted ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.75)',
        transition: 'all 0.2s',
        fontSize: 17,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = 'rgba(255,255,255,0.1)'
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'rgba(0,0,0,0.55)'
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'
      }}
    >
      {muted ? '🔇' : '🎵'}
    </button>
  )
}
