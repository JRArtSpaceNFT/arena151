'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, TrendingUp, Home, RotateCcw } from 'lucide-react';
import { useArenaStore } from '@/lib/store';
import type { SettledMatchResult } from '@/lib/store';
import { updateUser } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { ARENA_BADGES, ROOM_TIERS } from '@/lib/constants';

// ── Badge Ceremony Overlay ──────────────────────────────────────────────────
function BadgeCeremony({ arenaId, onDismiss }: { arenaId: string; onDismiss: () => void }) {
  const badge = ARENA_BADGES[arenaId];
  if (!badge) return null;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)' }}
      onClick={onDismiss}
    >
      {/* Radial burst */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 2.5, opacity: 0 }}
        transition={{ duration: 1.2, delay: 0.3 }}
        className="absolute rounded-full"
        style={{ width: 300, height: 300, background: `radial-gradient(ellipse, ${badge.color}88 0%, transparent 70%)` }}
      />

      {/* Confetti particles */}
      {Array.from({ length: 24 }).map((_, i) => {
        const angle = (i / 24) * 360;
        const dist = 160 + (i % 3) * 40;
        const x = Math.cos((angle * Math.PI) / 180) * dist;
        const y = Math.sin((angle * Math.PI) / 180) * dist;
        const colors = [badge.color, '#fbbf24', '#ffffff', '#f0abfc', '#38bdf8'];
        return (
          <motion.div key={i}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{ x, y, opacity: 0, scale: 0.3 }}
            transition={{ duration: 1.0, delay: 0.2 + i * 0.02, ease: 'easeOut' }}
            className="absolute rounded-full"
            style={{ width: 8, height: 8, background: colors[i % colors.length] }}
          />
        );
      })}

      <motion.div
        initial={{ scale: 0.4, opacity: 0, y: 40 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 220, damping: 18, delay: 0.1 }}
        className="relative z-10 flex flex-col items-center text-center px-8 py-10 rounded-2xl"
        style={{
          background: 'linear-gradient(160deg, rgba(10,8,24,0.98) 0%, rgba(6,4,16,0.98) 100%)',
          border: `2px solid ${badge.color}55`,
          boxShadow: `0 0 60px ${badge.color}33, 0 0 120px ${badge.color}18`,
          maxWidth: 400,
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Top label */}
        <motion.p
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-xs font-black uppercase tracking-widest mb-4"
          style={{ color: badge.color, letterSpacing: '0.2em' }}
        >
          🏅 Badge Earned!
        </motion.p>

        {/* Badge image — big and glowing */}
        <motion.div
          className="relative mb-5"
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
        >
          <motion.div
            className="absolute inset-0 rounded-full blur-2xl"
            style={{ background: badge.color }}
            animate={{ opacity: [0.4, 0.9, 0.4] }}
            transition={{ duration: 1.8, repeat: Infinity }}
          />
          <img
            src={badge.file}
            alt={badge.name}
            style={{
              width: 96, height: 96,
              objectFit: 'contain',
              imageRendering: 'pixelated',
              filter: `drop-shadow(0 0 16px ${badge.color}) drop-shadow(0 0 32px ${badge.color}88)`,
              position: 'relative', zIndex: 1,
            }}
          />
        </motion.div>

        {/* Badge name */}
        <motion.h2
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, type: 'spring' }}
          className="text-3xl font-black mb-1"
          style={{ color: badge.color, textShadow: `0 0 24px ${badge.color}` }}
        >
          {badge.name}
        </motion.h2>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-sm font-semibold mb-1"
          style={{ color: 'rgba(255,255,255,0.7)' }}
        >
          {badge.city} City Gym · {badge.leader}
        </motion.p>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="text-xs mb-6"
          style={{ color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}
        >
          This badge now appears on your trainer profile.
        </motion.p>

        <motion.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.85 }}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.97 }}
          onClick={onDismiss}
          className="px-8 py-3 rounded-xl font-black text-sm uppercase tracking-wide"
          style={{
            background: `linear-gradient(135deg, ${badge.color}44, ${badge.color}22)`,
            border: `2px solid ${badge.color}77`,
            color: badge.color,
            letterSpacing: '0.08em',
          }}
        >
          Claim Badge ✓
        </motion.button>
      </motion.div>
    </motion.div>
  );
}

export default function ResultScreen() {
  const { currentMatch, currentTrainer, setTrainer, setScreen, clearMatch, lastMatchWinner, settledMatchResult, setSettledMatchResult } = useArenaStore();
  // lastMatchWinner is set by GameWrapper before playAgain() clears the game store.
  // winner === 1 means P1 (the human player) won.
  const [isVictory] = useState(() => lastMatchWinner !== null ? lastMatchWinner === 1 : false);
  const [newBadgeArena, setNewBadgeArena] = useState<string | null>(null);

  // ── Post-refresh settled resume path ──────────────────────────
  // If we arrived here via a page refresh after settlement, currentMatch and
  // currentTrainer are null (Zustand was wiped). settledMatchResult holds the
  // server-sourced payload from /resume. Reconstruct a minimal view from it.
  const resolvedFromServer = !currentMatch && settledMatchResult;

  // Derive a synthetic currentMatch from settledMatchResult for the settled-resume path
  const syntheticMatch = resolvedFromServer ? (() => {
    const r = settledMatchResult as SettledMatchResult;
    const room = r.roomId ? ROOM_TIERS[r.roomId] : null;
    if (!r.myProfile || !room) return null;
    const myTrainer = {
      id:          r.myProfile.id,
      username:    r.myProfile.username,
      displayName: r.myProfile.displayName,
      email:       '',
      bio:         '',
      avatar:      r.myProfile.avatar,
      favoritePokemon: null as never,
      joinedDate:  new Date(),
      record:      { wins: r.myProfile.wins, losses: r.myProfile.losses },
      internalWalletId: '',
      balance:     r.myProfile.balance,
      earnings:    0,
      badges:      r.myProfile.badges,
    };
    const oppTrainer = r.opponentProfile ? {
      id:          r.opponentProfile.id,
      username:    r.opponentProfile.username,
      displayName: r.opponentProfile.displayName,
      email: '', bio: '', avatar: '😎', favoritePokemon: null as never,
      joinedDate: new Date(),
      record: { wins: 0, losses: 0 },
      internalWalletId: '', balance: 0, earnings: 0, badges: [],
    } : null;
    return {
      matchId: settledMatchResult?.battleSeed ?? '',
      player1: myTrainer,
      player2: oppTrainer ?? myTrainer,
      room,
      iWon: r.iWon,
      payoutDelta: r.payoutDelta,
      settlementTx: r.settlementTx,
    };
  })() : null;

  const syntheticTrainer = resolvedFromServer && settledMatchResult?.myProfile ? {
    id:          settledMatchResult.myProfile.id,
    username:    settledMatchResult.myProfile.username,
    displayName: settledMatchResult.myProfile.displayName,
    email: '', bio: '',
    avatar:      settledMatchResult.myProfile.avatar,
    favoritePokemon: null as never,
    joinedDate:  new Date(),
    record:      { wins: settledMatchResult.myProfile.wins, losses: settledMatchResult.myProfile.losses },
    internalWalletId: '', balance: settledMatchResult.myProfile.balance, earnings: 0,
    badges:      settledMatchResult.myProfile.badges,
  } : null;

  // Effective values — prefer live Zustand data, fall back to server-sourced
  const effectiveMatch    = currentMatch ?? syntheticMatch as typeof currentMatch;
  const effectiveTrainer  = currentTrainer ?? syntheticTrainer as typeof currentTrainer;
  const effectiveVictory  = resolvedFromServer ? (settledMatchResult?.iWon ?? false) : isVictory;

  useEffect(() => {
    if (!effectiveMatch || !effectiveTrainer) return;
    // For settled-resume path, skip the legacy settlement logic (already done server-side)
    if (resolvedFromServer) {
      // Update local trainer record from server data (badges, wins/losses already up-to-date)
      const arenaId = effectiveMatch.room.id as string;
      const existingBadges: string[] = effectiveTrainer.badges ?? [];
      const isFirstBadgeEarn = effectiveVictory && ARENA_BADGES[arenaId] && !existingBadges.includes(arenaId);
      if (isFirstBadgeEarn) setTimeout(() => setNewBadgeArena(arenaId), 1400);
      // Clear settledMatchResult so subsequent navigations don't re-use stale data
      return;
    }
    if (!currentMatch || !currentTrainer) return;

    // Update trainer record — run only once on mount
    // NOTE: Balance is NOT updated client-side for real money games.
    // Real SOL payouts happen server-side via /api/settle (on-chain transfers).
    const isRealMoneyGame = currentMatch.room.entryFee > 0;

    // ── Real-money on-chain settlement ────────────────────────────
    // SECURITY: Client now sends ONLY matchId to /api/settle.
    // Winner/loser/fee come from the database (server-authoritative).
    // Real-money matches must be registered via /api/match/create first.
    if (isRealMoneyGame) {
      const isBotMatch = currentMatch.player2.id.startsWith('bot_')
      // UUID format check: server-registered matches have a proper UUID (not 'match_<timestamp>')
      const hasServerMatchId = currentMatch.matchId &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(currentMatch.matchId)

      if (!isBotMatch && hasServerMatchId) {
        const claimedWinnerId = isVictory ? currentTrainer.id : currentMatch.player2.id

        // Poll for settlement_pending after submitting result claim.
        // Needed for vs-AI matches where the 30s single-player timeout path is used.
        const pollForSettlement = async (headers: Record<string, string>) => {
          for (let i = 0; i < 30; i++) { // 30 * 2s = 60s max
            await new Promise(r => setTimeout(r, 2000))
            try {
              const statusRes = await fetch(`/api/match/${currentMatch.matchId}/status`, { headers })
              const statusData = await statusRes.json()
              if (statusData.status === 'settlement_pending') {
                // Trigger settlement — server looks up winner/loser/fee from DB
                const settleRes = await fetch('/api/settle', {
                  method: 'POST',
                  headers,
                  body: JSON.stringify({ matchId: currentMatch.matchId }),
                })
                return settleRes.json()
              }
              if (statusData.status === 'settled') {
                return statusData // Already settled (e.g. cron beat us to it)
              }
              if (['voided', 'manual_review', 'settlement_failed'].includes(statusData.status)) {
                break // Terminal state — stop polling
              }
            } catch (pollErr) {
              console.error('[ResultScreen] poll error:', pollErr)
            }
          }
          return null
        }

        supabase.auth.getSession().then(async ({ data: { session } }) => {
          if (!session?.access_token) return
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          }
          try {
            // Step 1: Submit result claim to server
            const resultRes = await fetch(`/api/match/${currentMatch.matchId}/result`, {
              method: 'POST',
              headers,
              body: JSON.stringify({ winnerId: claimedWinnerId }),
            })
            const resultData = await resultRes.json()

            let data: Record<string, unknown> | null = null
            if (resultData.status === 'settlement_pending') {
              // Both players agreed immediately — trigger settle right away
              const settleRes = await fetch('/api/settle', {
                method: 'POST',
                headers,
                body: JSON.stringify({ matchId: currentMatch.matchId }),
              })
              data = await settleRes.json()
            } else if (resultData.status === 'result_pending') {
              // Single-player path (vs AI) — poll until server sets settlement_pending
              data = await pollForSettlement(headers)
            }

            if (data?.ok && !data.alreadySettled && data.winnerBalanceAfter !== undefined) {
              const updatedBalance = isVictory ? data.winnerBalanceAfter : data.loserBalanceAfter
              if (updatedBalance !== undefined) {
                setTrainer({ ...currentTrainer, balance: updatedBalance as number })
              }
            }
          } catch (err) {
            console.error('[ResultScreen] settle error:', err)
          }
        })
      } else if (!isBotMatch && !hasServerMatchId) {
        // SAFETY BLOCK: Real-money match without server registration.
        // This should not happen in production. Do NOT call settle.
        console.error('[ResultScreen] BLOCKED: Real-money match has no server matchId. Settlement requires /api/match/create flow. matchId:', currentMatch.matchId)
      }
    }

    // Badge awarding — first win in this arena earns the gym badge
    const arenaId = currentMatch.room.id as string;
    const existingBadges: string[] = currentTrainer.badges ?? [];
    const isFirstBadgeEarn = isVictory && ARENA_BADGES[arenaId] && !existingBadges.includes(arenaId);
    const updatedBadges = isFirstBadgeEarn ? [...existingBadges, arenaId] : existingBadges;

    const updatedTrainer = {
      ...currentTrainer,
      record: {
        wins: isVictory ? currentTrainer.record.wins + 1 : currentTrainer.record.wins,
        losses: !isVictory ? currentTrainer.record.losses + 1 : currentTrainer.record.losses,
      },
      // Do NOT update balance locally for real money — server settlement handles this
      balance: currentTrainer.balance,
      earnings: currentTrainer.earnings ?? 0,
      badges: updatedBadges,
    };

    setTrainer(updatedTrainer);
    // Persist win/loss + badges to Supabase (balance is NOT written — server settles real money)
    updateUser(effectiveTrainer.id, {
      wins: updatedTrainer.record.wins,
      losses: updatedTrainer.record.losses,
      ...(isRealMoneyGame ? {} : { balance: updatedTrainer.balance, earnings: updatedTrainer.earnings }),
      badges: updatedBadges,
    });

    // Trigger badge ceremony on first earn (with slight delay for drama)
    if (isFirstBadgeEarn) {
      setTimeout(() => setNewBadgeArena(arenaId), 1400);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps — intentional, run once on mount only

  // Clear settledMatchResult when leaving ResultScreen so it doesn’t pollute future sessions
  useEffect(() => {
    return () => {
      if (settledMatchResult) setSettledMatchResult(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleReturnHome = () => {
    clearMatch();
    setScreen('draft-mode-intro');
  };

  const handleRematch = () => {
    clearMatch();
    setScreen('room-select');
  };

  // Show loading state while hydrating from server (e.g. settledMatchResult not yet populated)
  if (!effectiveMatch || !effectiveTrainer) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-950">
        <div className="text-center">
          <div className="text-4xl mb-4">⏳</div>
          <p className="text-slate-400 font-mono">Loading match result...</p>
        </div>
      </div>
    );
  }

  return (
    <>
    {/* ── Badge ceremony overlay (first-time badge earn) ── */}
    <AnimatePresence>
      {newBadgeArena && (
        <BadgeCeremony arenaId={newBadgeArena} onDismiss={() => setNewBadgeArena(null)} />
      )}
    </AnimatePresence>

    <div className={`h-screen flex items-center justify-center relative overflow-hidden ${
      effectiveVictory ? 'bg-gradient-to-br from-amber-950 via-slate-950 to-slate-950' : 'bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950'
    }`}>
      {/* Ambient effects */}
      {effectiveVictory ? (
        <>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-amber-500/20 rounded-full blur-3xl" />
          <motion.div
            animate={{
              scale: [1, 1.3, 1],
              opacity: [0.1, 0.2, 0.1],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            className="absolute inset-0 bg-gradient-to-r from-yellow-500/10 via-amber-500/10 to-orange-500/10"
          />
        </>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-b from-blue-950/30 to-transparent" />
      )}

      {/* Confetti particles for victory */}
      {effectiveVictory && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(30)].map((_, i) => (
            <motion.div
              key={i}
              initial={{ y: -100, x: Math.random() * window.innerWidth, opacity: 1 }}
              animate={{
                y: window.innerHeight + 100,
                rotate: Math.random() * 360,
              }}
              transition={{
                duration: Math.random() * 3 + 2,
                delay: Math.random() * 2,
                repeat: Infinity,
              }}
              className="absolute w-3 h-3 rounded-sm"
              style={{
                backgroundColor: ['#fbbf24', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6'][Math.floor(Math.random() * 5)],
              }}
            />
          ))}
        </div>
      )}

      <div className="relative z-10 max-w-4xl w-full px-6">
        {/* Result announcement */}
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 150, damping: 15 }}
          className="text-center mb-4"
        >
          {effectiveVictory ? (
            <>
              {(() => {
                const badge = ARENA_BADGES[effectiveMatch.room.id as string];
                return badge ? (
                  <motion.div
                    animate={{ rotate: [0, 10, -10, 10, 0], scale: [1, 1.1, 1] }}
                    transition={{ duration: 0.8, repeat: Infinity, repeatDelay: 2 }}
                    className="relative mx-auto mb-2 w-16 h-16 flex items-center justify-center"
                  >
                    <motion.div
                      className="absolute inset-0 rounded-full blur-xl"
                      style={{ background: badge.color }}
                      animate={{ opacity: [0.4, 0.9, 0.4] }}
                      transition={{ duration: 1.8, repeat: Infinity }}
                    />
                    <img
                      src={badge.file}
                      alt={badge.name}
                      style={{
                        width: 64, height: 64, objectFit: 'contain',
                        imageRendering: 'pixelated',
                        filter: `drop-shadow(0 0 12px ${badge.color}) drop-shadow(0 0 24px ${badge.color}88)`,
                        position: 'relative', zIndex: 1,
                      }}
                    />
                  </motion.div>
                ) : (
                  <motion.div animate={{ rotate: [0, 10, -10, 10, 0], scale: [1, 1.1, 1] }} transition={{ duration: 0.8, repeat: Infinity, repeatDelay: 2 }}>
                    <Trophy className="w-16 h-16 mx-auto mb-2 text-amber-400 drop-shadow-[0_0_40px_rgba(251,191,36,0.8)]" />
                  </motion.div>
                );
              })()}
              <h1 className="text-6xl font-black mb-1 arena-glow bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 bg-clip-text text-transparent">VICTORY!</h1>
              <p className="text-lg text-amber-300 font-bold">Triumphant in the {effectiveMatch.room.name}</p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 mx-auto mb-2 rounded-full bg-slate-800 flex items-center justify-center border-4 border-blue-500">
                <span className="text-3xl">💫</span>
              </div>
              <h1 className="text-5xl font-black mb-1 text-blue-300">Defeat</h1>
              <p className="text-base text-slate-400 font-bold">Every loss is a lesson. You'll come back stronger.</p>
            </>
          )}
        </motion.div>

        {/* Match summary */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.5 }} className="glass-panel rounded-xl p-4 mb-3">
          <div className="grid grid-cols-3 gap-4 mb-3">
            {/* Player */}
            <div className={`text-center p-3 rounded-xl ${effectiveVictory ? 'bg-green-950/30 border-2 border-green-500' : 'bg-slate-900/50'}`}>
              <div className="w-14 h-14 mx-auto mb-2 rounded-xl bg-slate-800 overflow-hidden border-2 border-blue-500 flex items-center justify-center text-3xl">
                {effectiveTrainer?.avatar?.startsWith('data:') || effectiveTrainer?.avatar?.startsWith('/')
                  ? <img src={effectiveTrainer.avatar} alt="avatar" className="w-full h-full object-cover" />
                  : <span>{effectiveTrainer?.avatar || '🧑'}</span>}
              </div>
              <p className="font-bold text-sm mb-0.5">{effectiveMatch.player1.displayName}</p>
              <p className="text-xs text-slate-400">@{effectiveMatch.player1.username}</p>
              {effectiveVictory && <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 bg-green-500/20 rounded-full border border-green-500"><Trophy className="w-3 h-3 text-green-400" /><span className="text-xs font-bold text-green-400">WINNER</span></div>}
            </div>

            {/* VS */}
            <div className="flex items-center justify-center">
              <div className={`w-14 h-14 rounded-full bg-gradient-to-r ${effectiveMatch.room.color} flex items-center justify-center`}>
                <span className="text-xl font-black text-white">VS</span>
              </div>
            </div>

            {/* Opponent */}
            <div className={`text-center p-3 rounded-xl ${!effectiveVictory ? 'bg-green-950/30 border-2 border-green-500' : 'bg-slate-900/50'}`}>
              <div className="w-14 h-14 mx-auto mb-2 rounded-xl bg-slate-800 flex items-center justify-center text-3xl border-2 border-red-500">😎</div>
              <p className="font-bold text-sm mb-0.5">{effectiveMatch.player2.displayName}</p>
              <p className="text-xs text-slate-400">@{effectiveMatch.player2.username}</p>
              {!effectiveVictory && <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 bg-green-500/20 rounded-full border border-green-500"><Trophy className="w-3 h-3 text-green-400" /><span className="text-xs font-bold text-green-400">WINNER</span></div>}
            </div>
          </div>

          {/* Rewards/Losses */}
          <div className="pt-3 border-t border-slate-800 grid grid-cols-2 gap-3">
            <div className="glass-panel p-3 rounded-lg text-center">
              <p className="text-xs text-slate-400 mb-0.5">Arena</p>
              <p className="font-bold text-sm">{effectiveMatch.room.name}</p>
            </div>
            <div className={`glass-panel p-3 rounded-lg text-center ${effectiveVictory ? 'border-2 border-green-500' : 'border-2 border-red-500'}`}>
              <p className="text-xs text-slate-400 mb-0.5">{effectiveVictory ? 'Prize Won' : 'Entry Fee'}</p>
              <p className={`font-bold text-xl ${effectiveVictory ? 'text-green-400' : 'text-red-400'}`}>
                {effectiveVictory ? '+' : '-'}{effectiveVictory ? effectiveMatch.room.prizePool : effectiveMatch.room.entryFee} SOL
              </p>
            </div>
          </div>
        </motion.div>

        {/* Updated record */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.5 }} className="glass-panel rounded-xl p-4 mb-3">
          <div className="flex items-center justify-center gap-8">
            <div className="text-center">
              <p className="text-xs text-slate-400 mb-1">Your New Record</p>
              <p className="font-mono text-2xl font-black">
                <span className="text-green-400">{effectiveTrainer.record.wins + (effectiveVictory ? 1 : 0)}W</span>
                {' - '}
                <span className="text-red-400">{effectiveTrainer.record.losses + (!effectiveVictory ? 1 : 0)}L</span>
              </p>
            </div>
            <div className="h-8 w-px bg-slate-700" />
            <div className="text-center">
              <p className="text-xs text-slate-400 mb-1">Win Rate</p>
              <div className="flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-blue-400" />
                <p className="font-bold text-xl">
                  {(((effectiveTrainer.record.wins + (effectiveVictory ? 1 : 0)) / (effectiveTrainer.record.wins + effectiveTrainer.record.losses + 1)) * 100).toFixed(0)}%
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Actions */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7, duration: 0.5 }} className="flex gap-4 justify-center">
          <button onClick={handleRematch} className={effectiveVictory ? 'arena-button-gold flex items-center gap-2' : 'arena-button-primary flex items-center gap-2'}>
            <RotateCcw className="w-4 h-4" />Battle Again
          </button>
          <button onClick={handleReturnHome} className="glass-panel px-6 py-3 rounded-lg font-bold tracking-wide uppercase hover:border-blue-500/50 transition-all flex items-center gap-2 text-sm">
            <Home className="w-4 h-4" />Arena Home
          </button>
        </motion.div>
      </div>
    </div>
    </>
  );
}
