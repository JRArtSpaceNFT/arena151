'use client'

/**
 * FriendBattle — Server-side friend room matching.
 *
 * Uses /api/match/friend (Option B) instead of localStorage/BroadcastChannel.
 * Works across any device, any browser, any network.
 *
 * Flow:
 *   P1: enters code → POST friend/create → polls status every 2s → when status='ready' → start game
 *   P2: enters same code → POST friend/join → immediately starts game
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useArenaStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'

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

type Phase = 'input' | 'waiting' | 'found' | 'error' | 'expired'

export default function FriendBattle() {
  const { setScreen, setServerMatch } = useArenaStore()

  const [code, setCode]           = useState('')
  const [phase, setPhase]         = useState<Phase>('input')
  const [errorMsg, setErrorMsg]   = useState('')
  const [matchId, setMatchId]     = useState<string | null>(null)
  const [role, setRole]           = useState<'p1' | 'p2' | null>(null)
  const [countdown, setCountdown] = useState(300) // 5 min TTL
  const [opponentName, setOpponentName] = useState<string | null>(null)

  const pollRef  = useRef<ReturnType<typeof setInterval> | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPolling = useCallback(() => {
    if (pollRef.current)  clearInterval(pollRef.current)
    if (timerRef.current) clearInterval(timerRef.current)
  }, [])

  const startGame = useCallback((seed: string, mid: string) => {
    stopPolling()
    console.log('[FriendBattle] Starting friend game. matchId:', mid, 'seed:', seed)
    setServerMatch(mid, seed)
    // CRITICAL: Route to 'friend-game', NOT 'game' or 'practice-game'.
    // 'game' = GameWrapper which uses vs_ai mode.
    // 'practice-game' = PracticeGameWrapper which also uses practice mode (AI opponent).
    // 'friend-game' = FriendGameWrapper which uses friend_battle mode (real PvP).
    setScreen('friend-game')
  }, [stopPolling, setServerMatch, setScreen])

  // Cleanup on unmount
  useEffect(() => () => stopPolling(), [stopPolling])

  // Countdown timer while waiting
  useEffect(() => {
    if (phase !== 'waiting') return
    setCountdown(300)
    timerRef.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          stopPolling()
          setPhase('expired')
          return 0
        }
        return c - 1
      })
    }, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [phase, stopPolling])

  const getToken = async (): Promise<string | null> => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ?? null
  }

  // ── P1: Create room ──────────────────────────────────────────
  const handleCreate = async () => {
    const trimmed = code.trim()
    if (trimmed.length < 4) { setErrorMsg('Code must be at least 4 characters'); return }
    setErrorMsg('')

    const token = await getToken()
    if (!token) { setErrorMsg('You must be logged in to create a room'); return }

    const res = await fetch('/api/match/friend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: 'create', friendCode: trimmed }),
    })
    const data = await res.json()

    if (!res.ok) {
      setErrorMsg(data.error ?? 'Failed to create room')
      return
    }

    setMatchId(data.matchId)
    setRole('p1')
    setPhase('waiting')

    // Poll every 2 seconds for P2 joining
    pollRef.current = setInterval(async () => {
      const pollRes = await fetch('/api/match/friend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'status', matchId: data.matchId }),
      })
      const pollData = await pollRes.json()

      if (pollData.status === 'ready') {
        stopPolling()
        setPhase('found')
        // Fetch opponent display name
        if (pollData.playerBId) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('display_name, username')
            .eq('id', pollData.playerBId)
            .single()
          setOpponentName(profile?.display_name || profile?.username || 'Challenger')
        }
        // Short celebration delay then start
        setTimeout(() => startGame(data.battleSeed, data.matchId), 2000)
      } else if (pollData.status === 'expired' || pollData.status === 'not_found') {
        stopPolling()
        setPhase('expired')
      }
    }, 2000)
  }

  // ── P2: Join room ────────────────────────────────────────────
  const handleJoin = async () => {
    const trimmed = code.trim()
    if (trimmed.length < 4) { setErrorMsg('Code must be at least 4 characters'); return }
    setErrorMsg('')

    const token = await getToken()
    if (!token) { setErrorMsg('You must be logged in to join a room'); return }

    const res = await fetch('/api/match/friend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: 'join', friendCode: trimmed }),
    })
    const data = await res.json()

    if (!res.ok) {
      setErrorMsg(data.error ?? 'Failed to join room')
      return
    }

    // P2 joined — immediately get into game
    setMatchId(data.matchId)
    setRole('p2')
    setPhase('found')
    setOpponentName('Opponent')
    setTimeout(() => startGame(data.battleSeed, data.matchId), 1500)
  }

  // Smart button — try join first, create if no room exists
  const handleFindMatch = async () => {
    const trimmed = code.trim()
    if (trimmed.length < 4) { setErrorMsg('Code must be at least 4 characters'); return }
    setErrorMsg('')

    // First try to join
    const token = await getToken()
    if (!token) { setErrorMsg('You must be logged in'); return }

    const checkRes = await fetch('/api/match/friend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'status', friendCode: trimmed }),
    })
    const checkData = await checkRes.json()

    if (checkData.status === 'forming') {
      // Room exists — join it
      await handleJoin()
    } else {
      // No room — create one
      await handleCreate()
    }
  }

  const handleCancel = async () => {
    if (matchId) {
      const token = await getToken()
      if (token) {
        await fetch('/api/match/friend', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ action: 'cancel', matchId }),
        })
      }
    }
    stopPolling()
    setPhase('input')
    setMatchId(null)
    setRole(null)
    setErrorMsg('')
  }

  const formatCountdown = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

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
        onClick={() => { handleCancel(); setScreen('room-select') }}
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
            Same code · Any device · Real opponent
          </p>
        </div>

        <AnimatePresence mode="wait">

          {/* ── INPUT ── */}
          {phase === 'input' && (
            <motion.div key="input" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div style={{ marginBottom: 20 }}>
                <label style={{
                  display: 'block', fontSize: 10, color: '#64748b',
                  fontWeight: 800, letterSpacing: '0.15em', marginBottom: 8, textTransform: 'uppercase',
                }}>
                  Battle Code (share with your friend)
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={e => setCode(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))}
                  onKeyDown={e => e.key === 'Enter' && code.trim().length >= 4 && handleFindMatch()}
                  placeholder="e.g. pikachu99"
                  maxLength={20}
                  style={{
                    width: '100%', background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(129,140,248,0.4)', borderRadius: 10,
                    padding: '12px 16px', color: '#e2e8f0', fontSize: 18, outline: 'none',
                    fontFamily: '"Courier New",monospace', letterSpacing: '0.15em',
                    textAlign: 'center', boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Info box */}
              <div style={{
                marginBottom: 20, padding: '14px 16px',
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 12, fontSize: 12, color: '#475569', lineHeight: 1.8, textAlign: 'left',
              }}>
                <div>🔑 Both players enter the <strong style={{ color: '#94a3b8' }}>same code</strong></div>
                <div>📱 Works on any device — phone, laptop, anywhere</div>
                <div>⏱ Room stays open for <strong style={{ color: '#94a3b8' }}>5 minutes</strong></div>
                <div>🆓 Free practice battle — no SOL on the line</div>
              </div>

              {errorMsg && (
                <div style={{
                  color: '#ef4444', fontSize: 12, marginBottom: 14,
                  background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
                  borderRadius: 8, padding: '8px 12px',
                }}>
                  {errorMsg}
                </div>
              )}

              <button
                onClick={handleFindMatch}
                disabled={code.trim().length < 4}
                style={{
                  width: '100%', padding: '14px 24px',
                  background: code.trim().length >= 4
                    ? 'linear-gradient(135deg, #6366f1, #4f46e5)'
                    : 'rgba(255,255,255,0.05)',
                  border: 'none', borderRadius: 12,
                  color: code.trim().length >= 4 ? '#fff' : '#334155',
                  fontSize: 16, fontWeight: 900,
                  cursor: code.trim().length >= 4 ? 'pointer' : 'not-allowed',
                  letterSpacing: '0.06em',
                  boxShadow: code.trim().length >= 4 ? '0 0 28px rgba(99,102,241,0.45)' : 'none',
                  transition: 'all 0.2s', textTransform: 'uppercase',
                }}
              >
                Find Match →
              </button>
            </motion.div>
          )}

          {/* ── WAITING (P1 polls) ── */}
          {phase === 'waiting' && (
            <motion.div key="waiting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <motion.div
                animate={{ scale: [1, 1.08, 1], opacity: [0.7, 1, 0.7] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                style={{
                  width: 88, height: 88, borderRadius: '50%',
                  background: 'radial-gradient(circle, rgba(129,140,248,0.3) 0%, transparent 70%)',
                  border: '2px solid rgba(129,140,248,0.5)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 20px',
                }}
              >
                <PokeBall size={48} />
              </motion.div>

              <div style={{ fontSize: 20, fontWeight: 900, color: '#818cf8', marginBottom: 8 }}>
                Waiting for your friend…
              </div>
              <div style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
                Share this code with them:
              </div>

              {/* Code display — big and copyable */}
              <div
                onClick={() => navigator.clipboard?.writeText(code)}
                style={{
                  fontSize: 32, fontWeight: 900, fontFamily: '"Courier New",monospace',
                  letterSpacing: '0.2em', color: '#e2e8f0',
                  background: 'rgba(129,140,248,0.1)',
                  border: '2px solid rgba(129,140,248,0.4)',
                  borderRadius: 12, padding: '12px 24px', marginBottom: 20,
                  cursor: 'pointer', userSelect: 'all',
                  textShadow: '0 0 20px rgba(129,140,248,0.4)',
                }}
                title="Click to copy"
              >
                {code}
              </div>
              <div style={{ fontSize: 11, color: '#475569', marginBottom: 20 }}>
                Tap code to copy · Room expires in{' '}
                <span style={{ color: countdown < 60 ? '#ef4444' : '#94a3b8', fontWeight: 800 }}>
                  {formatCountdown(countdown)}
                </span>
              </div>

              <button onClick={handleCancel} style={{
                padding: '10px 28px',
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 10, color: 'rgba(255,255,255,0.5)',
                fontSize: 13, fontWeight: 700, cursor: 'pointer',
              }}>
                Cancel
              </button>
            </motion.div>
          )}

          {/* ── MATCH FOUND ── */}
          {phase === 'found' && (
            <motion.div key="found" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
              <motion.div
                animate={{ scale: [1, 1.15, 1] }}
                transition={{ duration: 0.6, repeat: 2 }}
                style={{ fontSize: 56, marginBottom: 12 }}
              >
                ⚔️
              </motion.div>
              <div style={{ fontSize: 24, fontWeight: 900, color: '#4ade80', marginBottom: 8, textShadow: '0 0 20px rgba(74,222,128,0.5)' }}>
                Opponent Found!
              </div>
              {opponentName && (
                <div style={{ fontSize: 15, color: '#94a3b8', marginBottom: 16 }}>
                  vs <strong style={{ color: '#818cf8' }}>{opponentName}</strong>
                </div>
              )}
              <div style={{ fontSize: 13, color: '#475569' }}>
                Starting battle…
              </div>
            </motion.div>
          )}

          {/* ── EXPIRED ── */}
          {phase === 'expired' && (
            <motion.div key="expired" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div style={{ fontSize: 44, marginBottom: 12 }}>⏱</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: '#ef4444', marginBottom: 8 }}>Room Expired</div>
              <div style={{ fontSize: 13, color: '#64748b', marginBottom: 24 }}>
                No opponent joined within 5 minutes. Try again with the same or a new code.
              </div>
              <button onClick={() => { setPhase('input'); setMatchId(null); setRole(null) }} style={{
                padding: '12px 32px',
                background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                border: 'none', borderRadius: 12, color: '#fff',
                fontSize: 14, fontWeight: 900, cursor: 'pointer', letterSpacing: '0.05em',
              }}>
                Try Again
              </button>
            </motion.div>
          )}

          {/* ── ERROR ── */}
          {phase === 'error' && (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div style={{ fontSize: 44, marginBottom: 12 }}>❌</div>
              <div style={{ fontSize: 16, color: '#ef4444', marginBottom: 24 }}>{errorMsg}</div>
              <button onClick={() => { setPhase('input'); setErrorMsg('') }} style={{
                padding: '12px 32px',
                background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                border: 'none', borderRadius: 12, color: '#fff',
                fontSize: 14, fontWeight: 900, cursor: 'pointer',
              }}>
                Back
              </button>
            </motion.div>
          )}

        </AnimatePresence>
      </motion.div>
    </div>
  )
}
