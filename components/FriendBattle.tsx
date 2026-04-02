'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useArenaStore } from '@/lib/store'

interface RoomData {
  roomId: string
  p1: { name: string; timestamp: number } | null
  p2: { name: string; timestamp: number; accepted: boolean } | null
  state: 'waiting' | 'pending_accept' | 'matched'
  wager: number   // 0 = FREE
  createdAt: number
  expiresAt: number
}

const ROOM_KEY = (pw: string) => `arena151_room_${pw}`
const CHANNEL_NAME = 'arena151_friend_rooms'

function PokeBall({ size = 56 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" fill="none">
      <circle cx="28" cy="28" r="27" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="2"/>
      <path d="M1 28 Q1 1 28 1 Q55 1 55 28" fill="#ef4444"/>
      <rect x="0" y="25" width="56" height="6" fill="#1e293b"/>
      <circle cx="28" cy="28" r="8" fill="#1e293b" stroke="#1e293b" strokeWidth="2"/>
      <circle cx="28" cy="28" r="5" fill="#f8fafc"/>
    </svg>
  )
}

export default function FriendBattle() {
  const { setScreen, currentTrainer } = useArenaStore()
  const [password, setPassword] = useState('')
  const [wagerInput, setWagerInput] = useState('')           // '' = FREE
  const [phase, setPhase] = useState<'input' | 'searching' | 'accept' | 'timeout' | 'error'>('input')
  const [countdown, setCountdown] = useState(60)
  const [errorMsg, setErrorMsg] = useState('')
  const [role, setRole] = useState<'p1' | 'p2' | null>(null)
  const [pendingRoom, setPendingRoom] = useState<RoomData | null>(null)   // for p2 accept screen
  const channelRef = useRef<BroadcastChannel | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const playerName = currentTrainer?.displayName ?? currentTrainer?.username ?? 'Player'
  const parsedWager = parseFloat(wagerInput) || 0
  const isFree = parsedWager === 0 || wagerInput.trim() === ''
  const wagerDisplay = isFree ? 'FREE' : `${parsedWager.toFixed(4)} SOL`

  const clearRoom = useCallback((pw: string) => {
    try { localStorage.removeItem(ROOM_KEY(pw)) } catch (_) {}
  }, [])

  const broadcast = useCallback((pw: string) => {
    channelRef.current?.postMessage({ type: 'room_update', roomId: pw })
  }, [])

  const startGame = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (pollRef.current) clearInterval(pollRef.current)
    setScreen('game')
  }, [setScreen])

  const checkRoom = useCallback((pw: string, myRole: 'p1' | 'p2') => {
    try {
      const raw = localStorage.getItem(ROOM_KEY(pw))
      if (!raw) return
      const room = JSON.parse(raw) as RoomData
      if (room.state === 'matched') {
        clearRoom(pw)
        startGame()
      }
      // P1 also advances to searching once P2 has accepted (state = matched)
      if (myRole === 'p1' && room.state === 'matched') startGame()
    } catch (_) {}
  }, [clearRoom, startGame])

  // Countdown
  useEffect(() => {
    if (phase !== 'searching') return
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          clearInterval(timerRef.current!)
          setPhase('timeout')
          clearRoom(password.trim())
          return 0
        }
        return c - 1
      })
    }, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [phase, password, clearRoom])

  // Cleanup
  useEffect(() => {
    return () => {
      channelRef.current?.close()
      if (timerRef.current) clearInterval(timerRef.current)
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  const openChannel = useCallback((pw: string, myRole: 'p1' | 'p2') => {
    try { channelRef.current = new BroadcastChannel(CHANNEL_NAME) } catch (_) {}
    if (channelRef.current) {
      channelRef.current.onmessage = (e) => {
        if (e.data?.type === 'room_update' && e.data?.roomId === pw) {
          checkRoom(pw, myRole)
        }
      }
    }
    // Also poll
    pollRef.current = setInterval(() => checkRoom(pw, myRole), 500)
  }, [checkRoom])

  // ── P1 creates room ──────────────────────────────────────────
  const handleCreateRoom = useCallback(() => {
    const pw = password.trim()
    if (pw.length < 4 || pw.length > 20) { setErrorMsg('Battle code must be 4–20 characters.'); return }
    setErrorMsg('')

    const now = Date.now()
    const room: RoomData = {
      roomId: pw,
      p1: { name: playerName, timestamp: now },
      p2: null,
      state: 'waiting',
      wager: isFree ? 0 : parsedWager,
      createdAt: now,
      expiresAt: now + 60000,
    }
    localStorage.setItem(ROOM_KEY(pw), JSON.stringify(room))
    setRole('p1')
    setPhase('searching')
    setCountdown(60)
    openChannel(pw, 'p1')
    broadcast(pw)
  }, [password, playerName, isFree, parsedWager, openChannel, broadcast])

  // ── P2 enters code — show accept screen ─────────────────────
  const handleJoinRoom = useCallback(() => {
    const pw = password.trim()
    if (pw.length < 4 || pw.length > 20) { setErrorMsg('Battle code must be 4–20 characters.'); return }
    setErrorMsg('')

    const now = Date.now()
    try {
      const raw = localStorage.getItem(ROOM_KEY(pw))
      if (!raw) { setErrorMsg('No room found with that code. Have your friend create one first.'); return }
      const existing = JSON.parse(raw) as RoomData
      if (existing.expiresAt < now) { setErrorMsg('Room expired. Ask your friend to start a new one.'); return }
      if (existing.p2) { setErrorMsg('Room is already full.'); return }
      if (existing.state !== 'waiting') { setErrorMsg('Match already started.'); return }
      // Show accept screen with wager details
      setPendingRoom(existing)
      setRole('p2')
      setPhase('accept')
    } catch (_) {
      setErrorMsg('Could not read room data. Try again.')
    }
  }, [password])

  // ── P2 accepts wager ─────────────────────────────────────────
  const handleAccept = useCallback(() => {
    if (!pendingRoom) return
    const pw = pendingRoom.roomId
    const now = Date.now()
    const updated: RoomData = {
      ...pendingRoom,
      p2: { name: playerName, timestamp: now, accepted: true },
      state: 'matched',
    }
    localStorage.setItem(ROOM_KEY(pw), JSON.stringify(updated))
    broadcast(pw)
    startGame()
  }, [pendingRoom, playerName, broadcast, startGame])

  // ── Single "Find Match" button: smart create vs join ─────────
  const handleFindMatch = useCallback(() => {
    const pw = password.trim()
    if (pw.length < 4 || pw.length > 20) { setErrorMsg('Battle code must be 4–20 characters.'); return }
    const now = Date.now()
    try {
      const raw = localStorage.getItem(ROOM_KEY(pw))
      if (raw) {
        const existing = JSON.parse(raw) as RoomData
        if (existing.expiresAt >= now && existing.p1 && !existing.p2 && existing.state === 'waiting') {
          // Room exists and waiting — go to accept
          handleJoinRoom()
          return
        }
      }
    } catch (_) {}
    // No valid room — create as P1
    handleCreateRoom()
  }, [password, handleJoinRoom, handleCreateRoom])

  const handleReset = () => {
    setPhase('input')
    setPassword('')
    setWagerInput('')
    setCountdown(60)
    setRole(null)
    setErrorMsg('')
    setPendingRoom(null)
    channelRef.current?.close()
    channelRef.current = null
    if (timerRef.current) clearInterval(timerRef.current)
    if (pollRef.current) clearInterval(pollRef.current)
  }

  // ── Wager presets ────────────────────────────────────────────
  const PRESETS = ['FREE', '0.01', '0.05', '0.1', '0.5', '1.0']

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #08060f 0%, #0d0a1e 40%, #0a0d18 80%, #060608 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      color: '#e2e8f0', padding: 24, position: 'relative',
    }}>
      {/* Back */}
      <button
        onClick={() => { handleReset(); setScreen('room-select') }}
        style={{
          position: 'absolute', top: 16, left: 16,
          background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 10, padding: '8px 14px', color: 'rgba(255,255,255,0.6)',
          fontSize: 13, fontWeight: 700, cursor: 'pointer',
        }}
      >← Back</button>

      <motion.div
        initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
        style={{
          width: '100%', maxWidth: 460,
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(129,140,248,0.3)',
          borderRadius: 20, padding: 32,
          boxShadow: '0 0 60px rgba(129,140,248,0.12)',
          textAlign: 'center',
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
            <PokeBall size={52} />
          </div>
          <h1 style={{
            fontFamily: '"Impact","Arial Black",sans-serif',
            fontSize: 30, fontWeight: 900, color: '#818cf8',
            letterSpacing: '0.06em', margin: 0, lineHeight: 1,
            textShadow: '0 0 24px rgba(129,140,248,0.5)',
          }}>PLAY A FRIEND</h1>
          <p style={{ color: '#475569', fontSize: 12, marginTop: 8 }}>
            Challenge a friend • Share a battle code • Settle the score
          </p>
        </div>

        <AnimatePresence mode="wait">

          {/* ── INPUT PHASE ── */}
          {phase === 'input' && (
            <motion.div key="input" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>

              {/* Battle code */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 10, color: '#64748b', fontWeight: 800, letterSpacing: '0.15em', marginBottom: 8, textTransform: 'uppercase' }}>
                  Battle Code (case-sensitive)
                </label>
                <input
                  type="text"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleFindMatch()}
                  placeholder="e.g. pikachu99"
                  maxLength={20}
                  style={{
                    width: '100%', background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(129,140,248,0.4)', borderRadius: 10,
                    padding: '12px 16px', color: '#e2e8f0', fontSize: 16, outline: 'none',
                    fontFamily: '"Courier New",monospace', letterSpacing: '0.1em',
                    textAlign: 'center', boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Wager */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 10, color: '#64748b', fontWeight: 800, letterSpacing: '0.15em', marginBottom: 8, textTransform: 'uppercase' }}>
                  Wager (SOL) — leave blank for FREE
                </label>

                {/* Presets */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
                  {PRESETS.map(p => {
                    const active = p === 'FREE' ? isFree : wagerInput === p
                    return (
                      <button key={p}
                        onClick={() => setWagerInput(p === 'FREE' ? '' : p)}
                        style={{
                          padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 800,
                          cursor: 'pointer', border: '1px solid',
                          background: active ? (p === 'FREE' ? 'rgba(74,222,128,0.2)' : 'rgba(129,140,248,0.2)') : 'rgba(255,255,255,0.04)',
                          borderColor: active ? (p === 'FREE' ? '#4ade80' : '#818cf8') : 'rgba(255,255,255,0.1)',
                          color: active ? (p === 'FREE' ? '#4ade80' : '#818cf8') : '#64748b',
                          transition: 'all 0.15s',
                        }}>
                        {p === 'FREE' ? '🆓 FREE' : `◎ ${p}`}
                      </button>
                    )
                  })}
                </div>

                {/* Custom amount */}
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#818cf8', fontWeight: 900, fontSize: 14 }}>◎</span>
                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    value={wagerInput}
                    onChange={e => setWagerInput(e.target.value)}
                    placeholder="Custom amount or leave blank"
                    style={{
                      width: '100%', background: 'rgba(255,255,255,0.05)',
                      border: `1px solid ${isFree ? 'rgba(255,255,255,0.1)' : 'rgba(129,140,248,0.5)'}`,
                      borderRadius: 10, padding: '10px 12px 10px 30px',
                      color: '#e2e8f0', fontSize: 14, outline: 'none',
                      boxSizing: 'border-box',
                      boxShadow: isFree ? 'none' : '0 0 12px rgba(129,140,248,0.2)',
                    }}
                  />
                </div>

                {/* Wager summary */}
                <div style={{
                  marginTop: 10, padding: '10px 14px',
                  background: isFree ? 'rgba(74,222,128,0.08)' : 'rgba(129,140,248,0.1)',
                  border: `1px solid ${isFree ? 'rgba(74,222,128,0.25)' : 'rgba(129,140,248,0.35)'}`,
                  borderRadius: 10, fontSize: 13,
                  color: isFree ? '#4ade80' : '#818cf8',
                  fontWeight: 800,
                }}>
                  {isFree
                    ? '🆓 This battle is FREE — no SOL on the line'
                    : `⚔️ Wager: ${parsedWager.toFixed(4)} SOL per player · Winner takes ${(parsedWager * 2).toFixed(4)} SOL`
                  }
                </div>
              </div>

              {errorMsg && (
                <div style={{ color: '#ef4444', fontSize: 12, marginBottom: 12, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '8px 12px' }}>
                  {errorMsg}
                </div>
              )}

              <button
                onClick={handleFindMatch}
                disabled={password.trim().length < 4}
                style={{
                  width: '100%', padding: '13px 24px',
                  background: password.trim().length >= 4 ? 'linear-gradient(135deg, #6366f1, #4f46e5)' : 'rgba(255,255,255,0.05)',
                  border: 'none', borderRadius: 12,
                  color: password.trim().length >= 4 ? '#fff' : '#334155',
                  fontSize: 15, fontWeight: 900,
                  cursor: password.trim().length >= 4 ? 'pointer' : 'not-allowed',
                  letterSpacing: '0.06em',
                  boxShadow: password.trim().length >= 4 ? '0 0 24px rgba(99,102,241,0.4)' : 'none',
                  transition: 'all 0.2s', textTransform: 'uppercase', marginBottom: 16,
                }}
              >Find Match →</button>

              <div style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.02)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.7 }}>
                  <div>🔑 Both players enter the <strong style={{ color: '#94a3b8' }}>same code</strong> — case sensitive</div>
                  <div>⏱ Room open for <strong style={{ color: '#94a3b8' }}>60 seconds</strong></div>
                  <div>🤝 P2 reviews the wager before accepting</div>
                  <div>🎮 Full battle: trainer → draft → fight!</div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── ACCEPT PHASE (P2 reviews wager) ── */}
          {phase === 'accept' && pendingRoom && (
            <motion.div key="accept" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
                  <strong style={{ color: '#818cf8' }}>{pendingRoom.p1?.name}</strong> wants to battle you!
                </div>

                {/* Wager card */}
                <div style={{
                  padding: '20px 24px',
                  background: pendingRoom.wager === 0 ? 'rgba(74,222,128,0.08)' : 'rgba(129,140,248,0.1)',
                  border: `2px solid ${pendingRoom.wager === 0 ? 'rgba(74,222,128,0.4)' : 'rgba(129,140,248,0.5)'}`,
                  borderRadius: 14, marginBottom: 8,
                  boxShadow: pendingRoom.wager === 0 ? '0 0 24px rgba(74,222,128,0.12)' : '0 0 24px rgba(129,140,248,0.18)',
                }}>
                  <div style={{ fontSize: 11, color: '#64748b', letterSpacing: '0.12em', fontWeight: 800, textTransform: 'uppercase', marginBottom: 6 }}>Proposed Wager</div>
                  {pendingRoom.wager === 0 ? (
                    <div style={{ fontSize: 28, fontWeight: 900, color: '#4ade80', textShadow: '0 0 16px rgba(74,222,128,0.5)' }}>FREE</div>
                  ) : (
                    <>
                      <div style={{ fontSize: 28, fontWeight: 900, color: '#818cf8', textShadow: '0 0 16px rgba(129,140,248,0.5)' }}>
                        ◎ {pendingRoom.wager.toFixed(4)} SOL
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                        Winner takes ◎ {(pendingRoom.wager * 2).toFixed(4)} SOL
                      </div>
                    </>
                  )}
                </div>

                <div style={{ fontSize: 11, color: '#475569', marginBottom: 20 }}>
                  Battle code: <span style={{ fontFamily: '"Courier New",monospace', color: '#94a3b8' }}>{pendingRoom.roomId}</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={handleReset}
                  style={{
                    flex: 1, padding: '12px 0',
                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 12, color: 'rgba(255,255,255,0.5)', fontSize: 14, fontWeight: 800, cursor: 'pointer',
                  }}>
                  Decline
                </button>
                <button onClick={handleAccept}
                  style={{
                    flex: 2, padding: '12px 0',
                    background: pendingRoom.wager === 0
                      ? 'linear-gradient(135deg, #16a34a, #15803d)'
                      : 'linear-gradient(135deg, #6366f1, #4f46e5)',
                    border: 'none', borderRadius: 12,
                    color: '#fff', fontSize: 14, fontWeight: 900, cursor: 'pointer',
                    letterSpacing: '0.04em',
                    boxShadow: pendingRoom.wager === 0 ? '0 0 20px rgba(74,222,128,0.3)' : '0 0 20px rgba(99,102,241,0.4)',
                  }}>
                  {pendingRoom.wager === 0 ? '✓ Accept — Let\'s Battle!' : `✓ Accept ◎ ${pendingRoom.wager.toFixed(4)} Wager`}
                </button>
              </div>
            </motion.div>
          )}

          {/* ── SEARCHING PHASE (P1 waits) ── */}
          {phase === 'searching' && (
            <motion.div key="searching" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div style={{ marginBottom: 24 }}>
                <motion.div
                  animate={{ scale: [1, 1.1, 1], opacity: [0.7, 1, 0.7] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                  style={{
                    width: 80, height: 80, borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(129,140,248,0.35) 0%, transparent 70%)',
                    border: '2px solid rgba(129,140,248,0.6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 16px',
                  }}
                >
                  <PokeBall size={44} />
                </motion.div>

                <div style={{ fontSize: 18, fontWeight: 900, color: '#818cf8', marginBottom: 6 }}>
                  Waiting for opponent…
                </div>
                <div style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>
                  Code: <span style={{ color: '#e2e8f0', fontFamily: '"Courier New",monospace' }}>{password}</span>
                </div>
                <div style={{ fontSize: 13, marginBottom: 16 }}>
                  Wager: <span style={{ color: isFree ? '#4ade80' : '#818cf8', fontWeight: 800 }}>{wagerDisplay}</span>
                </div>

                <div style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 64, height: 64, borderRadius: '50%',
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

              <button onClick={handleReset}
                style={{
                  padding: '10px 24px',
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 10, color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                }}>
                Cancel
              </button>
            </motion.div>
          )}

          {/* ── TIMEOUT ── */}
          {phase === 'timeout' && (
            <motion.div key="timeout" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div style={{ fontSize: 44, marginBottom: 12 }}>⏱</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: '#ef4444', marginBottom: 8 }}>No opponent found</div>
              <div style={{ fontSize: 13, color: '#64748b', marginBottom: 24 }}>
                Room expired after 60 seconds. Try the same code again or share a new one.
              </div>
              <button onClick={handleReset}
                style={{
                  padding: '12px 32px',
                  background: 'linear-gradient(135deg, #6366f1, #4f46e5)', border: 'none',
                  borderRadius: 12, color: '#fff', fontSize: 14, fontWeight: 900,
                  cursor: 'pointer', letterSpacing: '0.05em',
                }}>
                Try Again
              </button>
            </motion.div>
          )}

        </AnimatePresence>
      </motion.div>
    </div>
  )
}
