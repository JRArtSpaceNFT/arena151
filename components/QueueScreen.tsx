'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useArenaStore } from '@/lib/store';
import { ROOM_TIERS } from '@/lib/constants';
import { supabase } from '@/lib/supabase';
import type { Trainer, Pokemon } from '@/types';

// Rotating flavor text
const SEARCH_LINES = [
  'Searching for Rival...',
  'Checking trainer rankings...',
  'Scanning battle records...',
  'Looking for fair matchup...',
  'Preparing battle arena...',
  'Finding a worthy opponent...',
  'Consulting the Pokédex...',
  'Analyzing team strength...',
]

// All 151 Gen 1 Pokémon
const FLOAT_POKEMON = Array.from({ length: 151 }, (_, i) => i + 1)

// Deterministic positions spread across full screen using a low-discrepancy grid
// Split screen into a 13×12 grid (156 cells), pick 151, jitter within each cell
const GRID_COLS = 13
const GRID_ROWS = 12
const CELL_W = 100 / GRID_COLS
const CELL_H = 100 / GRID_ROWS

// Simple pseudo-random jitter per cell (deterministic)
function cellJitter(seed: number, range: number) {
  return ((seed * 2654435761) >>> 0) % 1000 / 1000 * range
}

const FLOAT_CONFIG = FLOAT_POKEMON.map((id, i) => {
  const col = i % GRID_COLS
  const row = Math.floor(i / GRID_COLS)
  const leftPct = col * CELL_W + 1 + cellJitter(i * 7 + 3, CELL_W - 4)
  const topPct  = row * CELL_H + 1 + cellJitter(i * 13 + 7, CELL_H - 4)
  return {
    id,
    left: `${leftPct.toFixed(1)}%`,
    top:  `${topPct.toFixed(1)}%`,
    duration: 5 + (i % 7) * 0.9,
    delay: (i * 0.18) % 6,
    drift: 8 + (i % 6) * 4,
  }
})

function FloatingElements() {
  return (
    <>
      {FLOAT_CONFIG.map(({ id, left, top, duration, delay, drift }, i) => (
        <motion.img
          key={id}
          src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`}
          alt=""
          aria-hidden="true"
          className="absolute pointer-events-none select-none"
          style={{
            left, top,
            width: 48, height: 48,
            imageRendering: 'pixelated',
            opacity: 0,
          }}
          animate={{
            y: [0, -drift, 0],
            opacity: [0.07, 0.15, 0.07],
          }}
          transition={{ duration, repeat: Infinity, delay, ease: 'easeInOut' }}
        />
      ))}
    </>
  )
}

// Background grid lines
function GridLines() {
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-[0.04]" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
          <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#60a5fa" strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid)" />
    </svg>
  )
}

// Dim pokeball insignia in background
function BgPokeball() {
  return (
    <svg className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-[0.03]"
      width="500" height="500" viewBox="0 0 120 120">
      <circle cx="60" cy="60" r="55" fill="none" stroke="white" strokeWidth="6" />
      <path d="M 5,60 A 55,55 0 0,1 115,60 Z" fill="white" opacity="0.5" />
      <line x1="5" y1="60" x2="115" y2="60" stroke="white" strokeWidth="6" />
      <circle cx="60" cy="60" r="16" fill="none" stroke="white" strokeWidth="6" />
      <circle cx="60" cy="60" r="6" fill="white" />
    </svg>
  )
}

// Scanning ring that expands outward
function ScanRing({ delay }: { delay: number }) {
  return (
    <motion.div
      className="absolute rounded-full border pointer-events-none"
      style={{ borderColor: 'rgba(59,130,246,0.4)' }}
      initial={{ width: 130, height: 130, opacity: 0.6, x: '-50%', y: '-50%', left: '50%', top: '50%' }}
      animate={{ width: 280, height: 280, opacity: 0 }}
      transition={{ duration: 2.5, repeat: Infinity, delay, ease: 'easeOut' }}
    />
  )
}

// Premium pokeball
function SpinningPokeball() {
  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
      style={{ width: 110, height: 110, position: 'relative', filter: 'drop-shadow(0 0 10px rgba(239,68,68,0.5)) drop-shadow(0 0 20px rgba(59,130,246,0.3))' }}
    >
      <svg viewBox="0 0 120 120" width="110" height="110">
        <defs>
          <radialGradient id="topHalf" cx="40%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#ff6b6b" />
            <stop offset="100%" stopColor="#c0392b" />
          </radialGradient>
          <radialGradient id="bottomHalf" cx="40%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#cbd5e1" />
          </radialGradient>
          <radialGradient id="btnGrad" cx="35%" cy="30%" r="60%">
            <stop offset="0%" stopColor="#f1f5f9" />
            <stop offset="100%" stopColor="#94a3b8" />
          </radialGradient>
          <filter id="pb-glow">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Top half */}
        <path d="M 10,60 A 50,50 0 0,1 110,60 Z" fill="url(#topHalf)" filter="url(#pb-glow)" />
        {/* Bottom half */}
        <path d="M 10,60 A 50,50 0 0,0 110,60 Z" fill="url(#bottomHalf)" />
        {/* Shine on top */}
        <ellipse cx="42" cy="38" rx="14" ry="8" fill="rgba(255,255,255,0.25)" transform="rotate(-20,42,38)" />
        {/* Outer ring */}
        <circle cx="60" cy="60" r="50" fill="none" stroke="#1e293b" strokeWidth="4.5" />
        {/* Divider */}
        <line x1="10" y1="60" x2="110" y2="60" stroke="#1e293b" strokeWidth="4.5" />
        {/* Center button */}
        <circle cx="60" cy="60" r="14" fill="#1e293b" />
        <circle cx="60" cy="60" r="9.5" fill="url(#btnGrad)" />
        <circle cx="57" cy="57" r="3" fill="rgba(255,255,255,0.6)" />
      </svg>
    </motion.div>
  )
}

// Generic rival trainer placeholder for real PvP opponents (no profile fetched yet)
const GENERIC_RIVAL: Trainer = {
  id: 'rival',
  username: 'rival',
  displayName: 'Rival Trainer',
  email: '',
  avatar: '🧑‍💻',
  favoritePokemon: { id: 1, name: 'Bulbasaur', sprite: '', types: [], stats: { hp: 0, attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0 } } as Pokemon,
  joinedDate: new Date(0),
  record: { wins: 0, losses: 0 },
  internalWalletId: '',
  balance: 0,
  earnings: 0,
  badges: [],
};

export default function QueueScreen() {
  const {
    queueState, cancelQueue, setScreen, testingMode,
    currentTrainer: liveTrainer, setMatch, setServerMatch,
    queueMatchId, setQueueMatchId, isMatchJoiner, setIsMatchJoiner,
  } = useArenaStore();
  
  const [elapsed, setElapsed] = useState(0);
  const [flavorIdx, setFlavorIdx] = useState(0);
  const [noOpponentFound, setNoOpponentFound] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tokenRef = useRef<string | null>(null);

  const trainer = liveTrainer ?? queueState.currentTrainer;

  // Elapsed timer
  useEffect(() => {
    if (!queueState.searchStartTime) return;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - queueState.searchStartTime!) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [queueState.searchStartTime]);

  // Rotate flavor text every 2.5s
  useEffect(() => {
    const iv = setInterval(() => setFlavorIdx(i => (i + 1) % SEARCH_LINES.length), 2500)
    return () => clearInterval(iv)
  }, [])

  // Real matchmaking effect
  useEffect(() => {
    console.log('[Queue] ===== MATCHMAKING EFFECT v2.0 =====');
    console.log('[Queue] testingMode:', testingMode);
    console.log('[Queue] queueState:', queueState);
    
    // Guard: only run if actually searching
    if (!queueState.isSearching || !queueState.roomId) {
      console.log('[Queue] useEffect guard: not searching or no roomId');
      return;
    }
    
    if (testingMode) {
      // Testing mode: auto-resolve to bot after random delay
      console.log('[Queue] TESTING MODE ACTIVE - creating bot match');
      const matchTimeout = setTimeout(() => {
        setScreen('match-found');
      }, Math.random() * 7000 + 8000);
      return () => clearTimeout(matchTimeout);
    }

    console.log('[Queue] REAL MONEY MODE - calling atomic matchmaking endpoint');

    // Real money matchmaking — NEW ATOMIC SERVER PATH
    const run = async () => {
      
      try {
        // Get auth token
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          console.error('[Queue] No auth session');
          return;
        }
        const token = session.access_token;
        tokenRef.current = token;

        const roomId = queueState.roomId;
        if (!roomId) return;
        const roomTier = ROOM_TIERS[roomId];
        if (!roomTier) return;

        console.log('[Queue] Calling atomic matchmaking endpoint for room:', roomId);

        // ── SINGLE SERVER CALL: atomic matchmaking ──
        const matchmakingRes = await fetch('/api/matchmaking/paid/join', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ roomId, teamA: null }),
        });

        if (!matchmakingRes.ok) {
          const errorData = await matchmakingRes.json();
          console.error('[Queue] Matchmaking failed:', errorData);
          
          if (errorData.code === 'INSUFFICIENT_FUNDS') {
            alert('Insufficient funds. Please deposit more SOL.');
            cancelQueue();
            setScreen('room-select');
          }
          return;
        }

        const matchData = await matchmakingRes.json();
        console.log('[Queue] Matchmaking SUCCESS:', matchData);

        if (!matchData.success || !matchData.matchId) {
          console.error('[Queue] Invalid matchmaking response:', matchData);
          return;
        }

        // Store match info
        setQueueMatchId(matchData.matchId);
        setServerMatch(matchData.matchId, matchData.battleSeed ?? '');
        setIsMatchJoiner(matchData.role === 'player_b');

        console.log(`[Queue] Role: ${matchData.role} | Status: ${matchData.status} | Resumed: ${matchData.resumed}`);

        // If match is already ready (player_b joined) or settlement_pending (resumed)
        if (matchData.status === 'ready' || matchData.status === 'settlement_pending') {
          console.log('[Queue] Match already ready — transitioning to versus');
          
          // CRITICAL FIX: If resumed=true but status=ready, this is a stale match
          // Don't transition immediately - the match is corrupt. Cancel and retry.
          if (matchData.resumed) {
            console.warn('[Queue] STALE MATCH DETECTED - voiding and retrying');
            // Clear the corrupted match from sessionStorage
            if (typeof window !== 'undefined') {
              sessionStorage.removeItem('arena_matchId');
              sessionStorage.removeItem('arena_seed');
              sessionStorage.removeItem('arena_isJoiner');
            }
            // Abandon the match to unlock funds
            if (tokenRef.current) {
              fetch(`/api/match/${matchData.matchId}/abandon`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${tokenRef.current}` },
              }).catch(() => {});
            }
            alert('Found a stale match. Please try joining again.');
            cancelQueue();
            setScreen('room-select');
            return;
          }
          
          if (trainer) {
            setMatch({
              player1: matchData.role === 'player_a' ? trainer : GENERIC_RIVAL,
              player2: matchData.role === 'player_b' ? trainer : GENERIC_RIVAL,
              room: roomTier,
              matchId: matchData.matchId,
            });
          }
          setScreen('versus');
          return;
        }

        // Match is forming — subscribe to realtime updates for when player_b joins
        console.log('[Queue] Match forming — subscribing to realtime updates');
        channelRef.current = supabase
          .channel(`match:${matchData.matchId}`)
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'matches',
              filter: `id=eq.${matchData.matchId}`,
            },
            (payload) => {
              console.log('[Queue] Realtime update received:', payload.new);
              const newStatus = payload.new.status;
              
              if (newStatus === 'ready' || newStatus === 'settlement_pending') {
                console.log('[Queue] Match ready! Transitioning to versus screen');
                if (channelRef.current) channelRef.current.unsubscribe();
                if (timeoutRef.current) clearTimeout(timeoutRef.current);
                if (trainer) {
                  setMatch({
                    player1: matchData.role === 'player_a' ? trainer : GENERIC_RIVAL,
                    player2: matchData.role === 'player_b' ? trainer : GENERIC_RIVAL,
                    room: roomTier,
                    matchId: matchData.matchId,
                  });
                }
                setScreen('versus');
              }
            }
          )
          .subscribe((status) => {
            console.log('[Queue] Realtime subscription status:', status);
          });

        // Fallback timeout after 5 minutes
        timeoutRef.current = setTimeout(async () => {
          console.log('[Queue] Match timeout - auto-abandoning and unlocking funds');
          if (channelRef.current) channelRef.current.unsubscribe();
          
          // Auto-abandon to unlock funds
          if (tokenRef.current) {
            try {
              const abandonRes = await fetch(`/api/match/${matchData.matchId}/abandon`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${tokenRef.current}` },
              });
              if (abandonRes.ok) {
                console.log('[Queue] Funds unlocked successfully after timeout');
              } else {
                console.error('[Queue] Failed to abandon match:', await abandonRes.text());
              }
            } catch (err) {
              console.error('[Queue] Error abandoning match:', err);
            }
          }
          
          setNoOpponentFound(true);
        }, 5 * 60 * 1000);
      } catch (err) {
        console.error('[Queue] Unexpected error:', err);
      }
    };

    run();

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (channelRef.current) channelRef.current.unsubscribe();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [queueState.isSearching, queueState.roomId, testingMode]); // Re-run when queue state changes

  const handleCancel = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    // Best-effort abandon if we registered as P1
    if (queueMatchId && !isMatchJoiner && tokenRef.current) {
      fetch(`/api/match/${queueMatchId}/abandon`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${tokenRef.current}` },
      }).catch(() => {});
    }
    setQueueMatchId(null);
    cancelQueue();
    setScreen('room-select');
  };
  const room = queueState.roomId ? ROOM_TIERS[queueState.roomId] : null;
  const winRate = trainer && (trainer.record.wins + trainer.record.losses) > 0
    ? Math.round((trainer.record.wins / (trainer.record.wins + trainer.record.losses)) * 100)
    : null

  // Timer glow intensifies over time
  const timerGlow = Math.min(elapsed / 30, 1)

  return (
    <div className="h-screen flex flex-col items-center justify-center overflow-hidden relative"
      style={{ background: 'linear-gradient(160deg,#0a0818 0%,#0d1228 40%,#0a1020 80%,#060610 100%)' }}>

      {/* Background layers */}
      <GridLines />
      <BgPokeball />
      <FloatingElements />

      {/* Map glow behind card */}
      <motion.div
        className="absolute rounded-full pointer-events-none"
        style={{ width: 500, height: 500, background: 'radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }}
        animate={{ scale: [1, 1.15, 1], opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Light beams */}
      {[0, 1, 2].map(i => (
        <motion.div key={i} className="absolute pointer-events-none"
          style={{
            width: 1, height: '60%', top: 0,
            left: `${30 + i * 20}%`,
            background: 'linear-gradient(to bottom, transparent, rgba(59,130,246,0.04), transparent)',
            transformOrigin: 'top center',
          }}
          animate={{ opacity: [0, 0.6, 0], scaleX: [1, 2, 1] }}
          transition={{ duration: 5, repeat: Infinity, delay: i * 1.8, ease: 'easeInOut' }}
        />
      ))}

      <div className="relative z-10 w-full max-w-sm px-4 flex flex-col items-center gap-3">

        {/* Room badge */}
        {room && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-center gap-3 px-5 py-2 rounded-xl border"
              style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(12px)' }}>
              <p className="text-xs uppercase font-black tracking-widest" style={{ color: 'rgba(255,255,255,0.35)' }}>Entering</p>
              <p className="text-base font-black text-white">{room.name}</p>
            </div>
          </motion.div>
        )}

        {/* Main card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="w-full rounded-2xl px-6 py-5 flex flex-col items-center gap-4 relative overflow-hidden"
          style={{ background: 'rgba(8,6,24,0.88)', borderColor: 'rgba(59,130,246,0.2)', border: '1px solid rgba(59,130,246,0.2)', backdropFilter: 'blur(24px)' }}
        >
          {/* Card pulse glow */}
          <motion.div className="absolute inset-0 rounded-2xl pointer-events-none"
            style={{ boxShadow: 'inset 0 0 40px rgba(59,130,246,0.06)' }}
            animate={{ boxShadow: ['inset 0 0 30px rgba(59,130,246,0.04)', 'inset 0 0 60px rgba(59,130,246,0.12)', 'inset 0 0 30px rgba(59,130,246,0.04)'] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          />
          {/* Top edge accent */}
          <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(59,130,246,0.5), transparent)' }} />

          {/* Pokéball + scan rings */}
          <div className="relative flex items-center justify-center" style={{ width: 180, height: 180 }}>
            <ScanRing delay={0} />
            <ScanRing delay={1.2} />
            {/* Radar ring */}
            <motion.div className="absolute rounded-full border-2 pointer-events-none"
              style={{ width: 148, height: 148, borderColor: 'rgba(59,130,246,0.2)' }}
              animate={{ rotate: -360 }}
              transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
            />
            {/* Dashed orbit */}
            <motion.div className="absolute rounded-full pointer-events-none"
              style={{ width: 168, height: 168, border: '1px dashed rgba(99,102,241,0.15)' }}
              animate={{ rotate: 360 }}
              transition={{ duration: 16, repeat: Infinity, ease: 'linear' }}
            />
            {/* Blue pulse */}
            <motion.div className="absolute rounded-full pointer-events-none"
              style={{ width: 90, height: 90, background: 'radial-gradient(circle, rgba(59,130,246,0.15), transparent 70%)' }}
              animate={{ scale: [1, 1.6, 1], opacity: [0.4, 0, 0.4] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
            />
            <SpinningPokeball />
          </div>

          {/* Flavor text */}
          <div className="text-center" style={{ minHeight: 52 }}>
            <AnimatePresence mode="wait">
              <motion.h2 key={flavorIdx}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.35 }}
                className="text-lg font-black text-white mb-1" style={{ letterSpacing: '0.02em' }}>
                {SEARCH_LINES[flavorIdx]}

              </motion.h2>
            </AnimatePresence>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
              {testingMode ? 'Finding an AI opponent for testing' : 'Waiting for a real opponent to join...'}
            </p>
            {testingMode ? (
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mt-1.5 border"
                style={{ background: 'rgba(74,222,128,0.06)', borderColor: 'rgba(74,222,128,0.2)' }}>
                <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                <span className="text-xs font-bold text-green-400">Testing Mode: AI Bot</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mt-1.5 border"
                style={{ background: 'rgba(251,191,36,0.06)', borderColor: 'rgba(251,191,36,0.2)' }}>
                <div className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-pulse" />
                <span className="text-xs font-bold text-yellow-400">Real money — waiting for a live opponent</span>
              </div>
            )}
          </div>

          {/* Search status module */}
          <div className="flex flex-col items-center gap-1 px-5 py-2.5 rounded-xl border w-full"
            style={{ background: 'rgba(59,130,246,0.05)', borderColor: `rgba(59,130,246,${0.15 + timerGlow * 0.3})`, boxShadow: `0 0 ${8 + timerGlow * 16}px rgba(59,130,246,${0.05 + timerGlow * 0.15})` }}>
            <p className="text-xs uppercase tracking-widest font-black" style={{ color: 'rgba(255,255,255,0.3)' }}>Queue Time</p>
            <div className="flex items-center gap-2">
              <motion.div className="w-2 h-2 bg-blue-400 rounded-full"
                animate={{ opacity: [1, 0.2, 1] }} transition={{ duration: 1, repeat: Infinity }} />
              <span className="font-mono text-2xl font-black" style={{ color: `rgba(${100 + Math.round(timerGlow * 155)},${180 - Math.round(timerGlow * 60)},255,1)`, textShadow: `0 0 ${8 + timerGlow * 12}px rgba(59,130,246,0.6)` }}>
                {Math.floor(elapsed / 60)}:{(elapsed % 60).toString().padStart(2, '0')}
              </span>
            </div>
          </div>

          {/* Trainer card */}
          {trainer && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
              className="w-full rounded-xl p-3 border flex items-center gap-3"
              style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.07)' }}>
              <div className="flex-shrink-0 overflow-hidden flex items-center justify-center rounded-xl border"
                style={{ width: 44, height: 44, borderColor: 'rgba(59,130,246,0.3)', background: 'rgba(59,130,246,0.08)' }}>
                {trainer.avatar?.startsWith('data:') || trainer.avatar?.startsWith('/')
                  ? <img src={trainer.avatar} alt={trainer.displayName} className="w-full h-full object-cover" />
                  : <span className="text-xl">{trainer.avatar || '🧑'}</span>}
              </div>
              <div className="flex-1 text-left">
                <p className="font-black text-white text-sm">{trainer.displayName}</p>
                <p className="text-xs text-blue-400/70">@{trainer.username}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs font-black text-white/70">{trainer.record.wins}W · {trainer.record.losses}L</p>
                {winRate !== null && (
                  <p className="text-xs font-black" style={{ color: winRate >= 60 ? '#4ade80' : winRate >= 40 ? '#93c5fd' : '#f87171' }}>
                    {winRate}% WR
                  </p>
                )}
              </div>
            </motion.div>
          )}

          {/* No opponent found after timeout */}
          {noOpponentFound && (
            <div className="w-full rounded-xl px-4 py-3 border text-center"
              style={{ background: 'rgba(239,68,68,0.06)', borderColor: 'rgba(239,68,68,0.3)' }}>
              <p className="text-sm font-bold text-red-400">No opponent found</p>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>Your funds have been unlocked. Try again.</p>
            </div>
          )}

          {/* Cancel — subtle outlined */}
          <button onClick={handleCancel}
            className="flex items-center gap-2 px-5 py-2 rounded-xl font-bold text-sm transition-all border"
            style={{ background: 'transparent', borderColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.35)' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)'; e.currentTarget.style.color = '#f87171' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'rgba(255,255,255,0.35)' }}>
            <X className="w-3.5 h-3.5" /> Cancel Search
          </button>
        </motion.div>
      </div>
    </div>
  );
}
// Force rebuild Wed Apr 15 20:16:51 PDT 2026
