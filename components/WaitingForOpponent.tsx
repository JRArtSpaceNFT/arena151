'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useArenaStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';

export default function WaitingForOpponent() {
  const { serverMatchId, setScreen } = useArenaStore();
  const [dots, setDots] = useState('');
  const [elapsed, setElapsed] = useState(0);
  
  // Animated dots
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(d => d.length >= 3 ? '' : d + '.');
    }, 500);
    return () => clearInterval(interval);
  }, []);
  
  // Elapsed timer
  useEffect(() => {
    const start = Date.now();
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);
  
  // Subscribe to match updates
  useEffect(() => {
    if (!serverMatchId) return;
    
    console.log('[WaitingForOpponent] Subscribing to match updates:', serverMatchId);
    
    const channel = supabase
      .channel(`match:${serverMatchId}:waiting`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'matches',
          filter: `id=eq.${serverMatchId}`,
        },
        (payload) => {
          console.log('[WaitingForOpponent] Match updated:', payload.new);
          
          const newStatus = payload.new.status;
          const bothLocked = payload.new.player_a_lineup_locked && payload.new.player_b_lineup_locked;
          const arenaAssigned = payload.new.arena_id !== null;
          
          console.log('[WaitingForOpponent] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log('[WaitingForOpponent] Status:', newStatus);
          console.log('[WaitingForOpponent] Both Lineups Locked:', bothLocked);
          console.log('[WaitingForOpponent] Arena Assigned:', arenaAssigned);
          console.log('[WaitingForOpponent] Arena ID:', payload.new.arena_id);
          console.log('[WaitingForOpponent] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          
          // Transition to arena reveal when server assigns arena
          if (newStatus === 'arena_assigned' || (bothLocked && arenaAssigned)) {
            console.log('[WaitingForOpponent] ✅ Arena assigned - transitioning to game');
            channel.unsubscribe();
            setScreen('game');
          }
        }
      )
      .subscribe();
    
    return () => {
      console.log('[WaitingForOpponent] Unsubscribing from match updates');
      channel.unsubscribe();
    };
  }, [serverMatchId, setScreen]);
  
  return (
    <div className="h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute w-96 h-96 bg-purple-500 rounded-full blur-3xl animate-pulse" style={{ top: '20%', left: '20%' }} />
        <div className="absolute w-96 h-96 bg-blue-500 rounded-full blur-3xl animate-pulse" style={{ top: '60%', left: '60%', animationDelay: '1s' }} />
      </div>
      
      <div className="relative z-10 text-center px-8 max-w-2xl">
        {/* Pokeball spinner */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          className="mx-auto mb-8"
        >
          <svg viewBox="0 0 120 120" width="120" height="120">
            <defs>
              <radialGradient id="topHalf" cx="40%" cy="35%" r="65%">
                <stop offset="0%" stopColor="#ff6b6b" />
                <stop offset="100%" stopColor="#c0392b" />
              </radialGradient>
              <radialGradient id="bottomHalf" cx="40%" cy="35%" r="65%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="100%" stopColor="#cbd5e1" />
              </radialGradient>
            </defs>
            <circle cx="60" cy="60" r="55" fill="none" stroke="#64748b" strokeWidth="4" />
            <path d="M 10,60 A 50,50 0 0,1 110,60 Z" fill="url(#topHalf)" />
            <path d="M 10,60 A 50,50 0 0,0 110,60 Z" fill="url(#bottomHalf)" />
            <line x1="10" y1="60" x2="110" y2="60" stroke="#64748b" strokeWidth="6" />
            <circle cx="60" cy="60" r="14" fill="#334155" stroke="#64748b" strokeWidth="4" />
            <circle cx="60" cy="60" r="6" fill="#f8fafc" />
          </svg>
        </motion.div>
        
        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-5xl font-black mb-4"
          style={{
            fontFamily: '"Impact", "Arial Black", sans-serif',
            background: 'linear-gradient(135deg, #60a5fa 0%, #a78bfa 50%, #ec4899 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          LINEUP LOCKED
        </motion.h1>
        
        {/* Status */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-2xl text-slate-300 mb-2"
        >
          Waiting for opponent to lock their lineup{dots}
        </motion.p>
        
        {/* Timer */}
        <p className="text-slate-400 text-sm mb-8">
          {elapsed}s elapsed
        </p>
        
        {/* Info */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="glass-panel p-6 rounded-2xl border border-purple-500/30 max-w-md mx-auto"
        >
          <p className="text-slate-300 text-sm leading-relaxed">
            <strong className="text-purple-400">SERVER-CONTROLLED MATCHMAKING</strong>
            <br />
            <br />
            Your lineup has been saved. The server will assign the battle arena once both players have locked their teams.
            <br />
            <br />
            <span className="text-xs text-slate-500">
              This ensures both players see the same arena and battle result.
            </span>
          </p>
        </motion.div>
        
        {/* Debug info */}
        {serverMatchId && (
          <p className="text-xs text-slate-600 mt-4 font-mono">
            Match ID: {serverMatchId}
          </p>
        )}
      </div>
    </div>
  );
}
