'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useArenaStore } from '@/lib/store'

interface RoomData {
  roomId: string
  p1: { name: string; timestamp: number } | null
  p2: { name: string; timestamp: number } | null
  state: 'waiting' | 'matched'
  createdAt: number
  expiresAt: number
}

const ROOM_KEY = (pw: string) => `arena151_room_${pw}`
const CHANNEL_NAME = 'arena151_friend_rooms'

export default function FriendBattle() {
  const { setScreen, currentTrainer } = useArenaStore()
  const [password, setPassword] = useState('')
  const [phase, setPhase] = useState<'input' | 'searching' | 'timeout' | 'error'>('input')
  const [countdown, setCountdown] = useState(60)
  const [errorMsg, setErrorMsg] = useState('')
  const [role, setRole] = useState<'p1' | 'p2' | null>(null)
  const channelRef = useRef<BroadcastChannel | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const playerName = currentTrainer?.displayName ?? currentTrainer?.username ?? 'Player'

  const clearRoom = useCallback((pw: string) => {
    try { localStorage.removeItem(ROOM_KEY(pw)) } catch (_) {}
  }, [])

  const broadcastUpdate = useCallback((pw: string) => {
    if (channelRef.current) {
      channelRef.current.postMessage({ type: 'room_update', roomId: pw })
    }
  }, [])

  const startGame = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    // Navigate to game in local_2p mode
    setScreen('game')
  }, [setScreen])

  const handleFindMatch = useCallback(() => {
    const pw = password.trim()
    if (pw.length < 4 || pw.length > 20) {
      setErrorMsg('Password must be 4–20 characters.')
      return
    }
    setErrorMsg('')

    // Open BroadcastChannel
    try {
      channelRef.current = new BroadcastChannel(CHANNEL_NAME)
    } catch (_) {
      channelRef.current = null
    }

    const now = Date.now()
    const key = ROOM_KEY(pw)
    let existing: RoomData | null = null
    try {
      const raw = localStorage.getItem(key)
      if (raw) existing = JSON.parse(raw) as RoomData
    } catch (_) {}

    // If room expired or doesn't exist, create as p1
    if (!existing || existing.expiresAt < now) {
      const room: RoomData = {
        roomId: pw,
        p1: { name: playerName, timestamp: now },
        p2: null,
        state: 'waiting',
        createdAt: now,
        expiresAt: now + 60000,
      }
      localStorage.setItem(key, JSON.stringify(room))
      setRole('p1')
      setPhase('searching')
      setCountdown(60)
      broadcastUpdate(pw)
    } else if (existing.p1 && !existing.p2 && existing.state === 'waiting') {
      // Join as p2
      const room: RoomData = {
        ...existing,
        p2: { name: playerName, timestamp: now },
        state: 'matched',
      }
      localStorage.setItem(key, JSON.stringify(room))
      setRole('p2')
      broadcastUpdate(pw)
      // P2 can start immediately
      setPhase('searching')
      setCountdown(5) // brief countdown before starting
    } else {
      setErrorMsg('Room is full or already matched. Try a different password.')
      return
    }

    // Listen for updates
    if (channelRef.current) {
      channelRef.current.onmessage = (e) => {
        if (e.data?.type === 'room_update' && e.data?.roomId === pw) {
          try {
            const raw = localStorage.getItem(key)
            if (!raw) return
            const room = JSON.parse(raw) as RoomData
            if (room.state === 'matched') {
              startGame()
              clearRoom(pw)
            }
          } catch (_) {}
        }
      }
    }

    // Also poll localStorage (same-tab or when BroadcastChannel not available)
    const pollInterval = setInterval(() => {
      try {
        const raw = localStorage.getItem(key)
        if (!raw) return
        const room = JSON.parse(raw) as RoomData
        if (room.state === 'matched') {
          clearInterval(pollInterval)
          startGame()
          clearRoom(pw)
        }
      } catch (_) {}
    }, 500)

    // Cleanup on unmount
    return () => clearInterval(pollInterval)
  }, [password, playerName, broadcastUpdate, startGame, clearRoom])

  // Countdown timer
  useEffect(() => {
    if (phase !== 'searching') return
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          clearInterval(timerRef.current!)
          setPhase('timeout')
          // Clean up room
          const pw = password.trim()
          clearRoom(pw)
          return 0
        }
        return c - 1
      })
    }, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [phase, password, clearRoom])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (channelRef.current) channelRef.current.close()
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  const handleReset = () => {
    setPhase('input')
    setPassword('')
    setCountdown(60)
    setRole(null)
    setErrorMsg('')
    if (channelRef.current) { channelRef.current.close(); channelRef.current = null }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #08060f 0%, #0d0a1e 40%, #0a0d18 80%, #060608 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      color: '#e2e8f0',
      padding: 24,
    }}>
      {/* Back button */}
      <button
        onClick={() => { handleReset(); setScreen('draft-mode-intro') }}
        style={{
          position: 'absolute', top: 16, left: 16,
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 10, padding: '8px 14px',
          color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        ← Back
      </button>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          width: '100%', maxWidth: 440,
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(139,92,246,0.3)',
          borderRadius: 20,
          padding: 32,
          boxShadow: '0 0 48px rgba(139,92,246,0.15)',
          textAlign: 'center',
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>⚔️</div>
          <h1 style={{
            fontFamily: '"Impact", "Arial Black", sans-serif',
            fontSize: 32, fontWeight: 900, color: '#a78bfa',
            letterSpacing: '0.06em', margin: 0, lineHeight: 1,
            textShadow: '0 0 24px rgba(167,139,250,0.5)',
          }}>
            PLAY A FRIEND
          </h1>
          <p style={{ color: '#64748b', fontSize: 13, marginTop: 8 }}>
            Share a password to battle a friend on the same device or network
          </p>
        </div>

        <AnimatePresence mode="wait">
          {phase === 'input' && (
            <motion.div key="input" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 11, color: '#64748b', fontWeight: 700, letterSpacing: '0.15em', marginBottom: 8, textTransform: 'uppercase' }}>
                  Battle Password
                </label>
                <input
                  type="text"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleFindMatch()}
                  placeholder="e.g. pikachu99"
                  maxLength={20}
                  style={{
                    width: '100%',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(139,92,246,0.4)',
                    borderRadius: 10,
                    padding: '12px 16px',
                    color: '#e2e8f0',
                    fontSize: 16,
                    outline: 'none',
                    fontFamily: '"Courier New", monospace',
                    letterSpacing: '0.08em',
                    textAlign: 'center',
                    boxSizing: 'border-box',
                  }}
                />
                {errorMsg && (
                  <div style={{ color: '#ef4444', fontSize: 12, marginTop: 6 }}>{errorMsg}</div>
                )}
              </div>

              <button
                onClick={handleFindMatch}
                disabled={password.trim().length < 4}
                style={{
                  width: '100%',
                  padding: '13px 24px',
                  background: password.trim().length >= 4
                    ? 'linear-gradient(135deg, #7c3aed, #5b21b6)'
                    : '#1a1a2e',
                  border: 'none',
                  borderRadius: 12,
                  color: password.trim().length >= 4 ? '#fff' : '#334155',
                  fontSize: 15, fontWeight: 900,
                  cursor: password.trim().length >= 4 ? 'pointer' : 'not-allowed',
                  letterSpacing: '0.06em',
                  boxShadow: password.trim().length >= 4 ? '0 0 24px rgba(124,58,237,0.5)' : 'none',
                  transition: 'all 0.2s',
                  textTransform: 'uppercase',
                }}
              >
                Find Match
              </button>

              <div style={{ marginTop: 20, padding: '14px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.07)' }}>
                <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.6 }}>
                  <div>🔑 <strong>Both players</strong> enter the same password</div>
                  <div>⚡ First player creates the room, second joins</div>
                  <div>⏱ Room expires after <strong>60 seconds</strong></div>
                  <div>🎮 Full battle — trainer select → draft → fight!</div>
                </div>
              </div>
            </motion.div>
          )}

          {phase === 'searching' && (
            <motion.div key="searching" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div style={{ marginBottom: 24 }}>
                {/* Pulsing animation */}
                <motion.div
                  animate={{ scale: [1, 1.15, 1], opacity: [0.7, 1, 0.7] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                  style={{
                    width: 80, height: 80,
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(139,92,246,0.4) 0%, transparent 70%)',
                    border: '2px solid rgba(139,92,246,0.6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 16px',
                    fontSize: 32,
                  }}
                >
                  ⚔️
                </motion.div>

                <div style={{ fontSize: 18, fontWeight: 900, color: '#a78bfa', marginBottom: 6 }}>
                  {role === 'p1' ? 'Waiting for opponent...' : 'Joining room...'}
                </div>
                <div style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
                  Password: <span style={{ color: '#e2e8f0', fontFamily: '"Courier New", monospace' }}>
                    {password}
                  </span>
                </div>

                {/* Countdown ring */}
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 64, height: 64,
                  borderRadius: '50%',
                  background: countdown <= 10 ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.05)',
                  border: `2px solid ${countdown <= 10 ? 'rgba(239,68,68,0.6)' : 'rgba(255,255,255,0.15)'}`,
                  fontSize: 22, fontWeight: 900,
                  color: countdown <= 10 ? '#ef4444' : '#94a3b8',
                  transition: 'all 0.3s',
                }}>
                  {countdown}
                </div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 6 }}>seconds remaining</div>
              </div>

              <button
                onClick={handleReset}
                style={{
                  padding: '10px 24px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 10,
                  color: 'rgba(255,255,255,0.5)',
                  fontSize: 13, fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </motion.div>
          )}

          {phase === 'timeout' && (
            <motion.div key="timeout" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>⏱</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: '#ef4444', marginBottom: 8 }}>
                No opponent found
              </div>
              <div style={{ fontSize: 13, color: '#64748b', marginBottom: 24 }}>
                The room expired after 60 seconds. Try again with the same password, or share a new one with your friend.
              </div>
              <button
                onClick={handleReset}
                style={{
                  padding: '12px 32px',
                  background: 'linear-gradient(135deg, #7c3aed, #5b21b6)',
                  border: 'none',
                  borderRadius: 12,
                  color: '#fff',
                  fontSize: 14, fontWeight: 900,
                  cursor: 'pointer',
                  letterSpacing: '0.05em',
                }}
              >
                Try Again
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
