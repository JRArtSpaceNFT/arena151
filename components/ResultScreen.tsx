'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, TrendingUp, Home, RotateCcw } from 'lucide-react';
import { useArenaStore } from '@/lib/store';
import type { SettledMatchResult } from '@/lib/store';
import { updateUser } from '@/lib/auth';
import { playMusic, isMusicMuted } from '@/lib/audio/musicEngine';
import { supabase } from '@/lib/supabase';
import { useGameStore } from '@/lib/game-store';
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

function BattleStatsSection() {
  const { battleState } = useGameStore()
  if (!battleState) return null

  const teamA = battleState.teamA
  const teamB = battleState.teamB
  const allCreatures = [...teamA, ...teamB]

  // MVP = most KOs, tiebreak by damage
  const mvp = allCreatures.reduce((best, ac) => {
    if (!best) return ac
    const bestKos = (best as any).kos ?? 0
    const acKos = (ac as any).kos ?? 0
    if (acKos > bestKos) return ac
    if (acKos === bestKos && ((ac as any).totalDamage ?? 0) > ((best as any).totalDamage ?? 0)) return ac
    return best
  }, null as typeof allCreatures[0] | null)

  const topDamage = allCreatures.reduce((best, ac) =>
    ((ac as any).totalDamage ?? 0) > ((best as any).totalDamage ?? 0) ? ac : best
  , allCreatures[0])

  const totalTurns = battleState.turn ?? 0
  const totalKos = allCreatures.reduce((s, ac) => s + ((ac as any).kos ?? 0), 0)

  const stats = [
    { label: 'Turns', value: totalTurns, emoji: '⚔️' },
    { label: 'Total KOs', value: totalKos, emoji: '💀' },
    { label: 'MVP', value: mvp?.creature.name ?? '—', emoji: '⭐' },
    { label: 'Top Damage', value: topDamage?.creature.name ?? '—', emoji: '💥' },
  ]

  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 10,
      padding: 'clamp(10px,1.5vh,16px)',
      marginBottom: 0,
    }}>
      <div style={{
        fontSize: 'clamp(9px,1.2vh,11px)', color: 'rgba(255,255,255,0.35)',
        textTransform: 'uppercase' as const, letterSpacing: '0.12em', marginBottom: 10, textAlign: 'center' as const,
      }}>Battle Stats</div>
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr',
        gap: 8,
      }}>
        {stats.map(s => (
          <div key={s.label} style={{
            background: 'rgba(255,255,255,0.04)', borderRadius: 8,
            padding: 'clamp(6px,1vh,10px)', textAlign: 'center' as const,
          }}>
            <div style={{ fontSize: 'clamp(14px,2.2vh,18px)', marginBottom: 3 }}>{s.emoji}</div>
            <div style={{ fontSize: 'clamp(12px,1.8vh,16px)', fontWeight: 800, color: '#f1f5f9' }}>{s.value}</div>
            <div style={{ fontSize: 'clamp(9px,1.2vh,11px)', color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
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

  // Play victory music on mount — continues from BattleScreen/VictoryScreen/DefeatScreen
  // Only start it if nothing is already playing (e.g. coming from VictoryScreen which already set it)
  useEffect(() => {
    playMusic('victory')
  }, [])

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
      <div className="h-screen flex items-center justify-center bg-slate-950 overflow-hidden">
        <div className="text-center">
          <div className="text-4xl mb-4">⏳</div>
          <p className="text-slate-400 font-mono">Loading match result...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Override global overflow:hidden so this page can scroll */}
      <style>{`
        html, body { overflow-y: auto !important; height: auto !important; }
      `}</style>

      {/* Badge ceremony overlay */}
      <AnimatePresence>
        {newBadgeArena && (
          <BadgeCeremony arenaId={newBadgeArena} onDismiss={() => setNewBadgeArena(null)} />
        )}
      </AnimatePresence>

      <div style={{
        minHeight: '100dvh',
        background: effectiveVictory
          ? 'linear-gradient(160deg, #1a0f00 0%, #0f0a00 40%, #0a0a0f 100%)'
          : 'linear-gradient(160deg, #0a000f 0%, #050010 40%, #0a0a0f 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: 'clamp(12px, 2vh, 24px) clamp(12px, 3vw, 24px)',
        overflowY: 'visible',
        position: 'relative',
      }}>
        {/* Background glow */}
        <div style={{
          position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
          background: effectiveVictory
            ? 'radial-gradient(ellipse at 50% 0%, rgba(251,191,36,0.15) 0%, transparent 60%)'
            : 'radial-gradient(ellipse at 50% 0%, rgba(124,58,237,0.12) 0%, transparent 60%)',
        }} />

        <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 680 }}>

          {/* ── RESULT HEADER ── */}
          <div style={{ textAlign: 'center', marginBottom: 'clamp(12px,2vh,20px)' }}>
            <div style={{ fontSize: 'clamp(36px,7vh,64px)', marginBottom: 6 }}>
              {effectiveVictory ? '🏆' : '💀'}
            </div>
            <div style={{
              fontFamily: '"Impact","Arial Black",sans-serif',
              fontSize: 'clamp(28px,5vh,52px)',
              fontWeight: 900,
              letterSpacing: '0.06em',
              color: effectiveVictory ? '#fbbf24' : '#a855f7',
              textShadow: effectiveVictory
                ? '0 0 30px rgba(251,191,36,0.8), 3px 3px 0 rgba(0,0,0,0.8)'
                : '0 0 30px rgba(168,85,247,0.8), 3px 3px 0 rgba(0,0,0,0.8)',
              lineHeight: 1,
            }}>
              {effectiveVictory ? 'VICTORY!' : 'DEFEAT'}
            </div>
            <div style={{ fontSize: 'clamp(11px,1.6vh,14px)', color: 'rgba(255,255,255,0.5)', marginTop: 6, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              {effectiveMatch.room.name}
            </div>
          </div>

          {/* ── PLAYERS ROW ── */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 14, padding: 'clamp(10px,1.5vh,16px)',
            marginBottom: 'clamp(10px,1.5vh,16px)',
          }}>
            {/* Player 1 */}
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{
                width: 'clamp(40px,6vh,56px)', height: 'clamp(40px,6vh,56px)',
                borderRadius: 10, overflow: 'hidden',
                border: `2px solid ${effectiveVictory ? '#22c55e' : '#475569'}`,
                margin: '0 auto 6px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 24, background: 'rgba(255,255,255,0.06)',
              }}>
                {effectiveTrainer?.avatar?.startsWith('data:') || effectiveTrainer?.avatar?.startsWith('/')
                  ? <img src={effectiveTrainer.avatar} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span>{effectiveTrainer?.avatar || '🧑'}</span>}
              </div>
              <div style={{ fontSize: 'clamp(11px,1.5vh,14px)', fontWeight: 800, color: '#f1f5f9' }}>{effectiveMatch.player1.displayName}</div>
              {effectiveVictory && <div style={{ fontSize: 10, color: '#22c55e', fontWeight: 700, marginTop: 2 }}>✓ WINNER</div>}
            </div>

            {/* VS */}
            <div style={{ textAlign: 'center', flexShrink: 0 }}>
              <div style={{
                width: 'clamp(32px,5vh,44px)', height: 'clamp(32px,5vh,44px)', borderRadius: '50%',
                background: 'linear-gradient(135deg, #7c3aed, #ef4444)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: '"Impact",sans-serif', fontWeight: 900, color: '#fff',
                fontSize: 'clamp(11px,2vh,15px)', margin: '0 auto 4px',
              }}>VS</div>
            </div>

            {/* Player 2 */}
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{
                width: 'clamp(40px,6vh,56px)', height: 'clamp(40px,6vh,56px)',
                borderRadius: 10, overflow: 'hidden',
                border: `2px solid ${!effectiveVictory ? '#22c55e' : '#475569'}`,
                margin: '0 auto 6px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 24, background: 'rgba(255,255,255,0.06)',
              }}>
                <span>😎</span>
              </div>
              <div style={{ fontSize: 'clamp(11px,1.5vh,14px)', fontWeight: 800, color: '#f1f5f9' }}>{effectiveMatch.player2.displayName}</div>
              {!effectiveVictory && <div style={{ fontSize: 10, color: '#22c55e', fontWeight: 700, marginTop: 2 }}>✓ WINNER</div>}
            </div>
          </div>

          {/* ── SOL RESULT + RECORD ── */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr',
            gap: 10, marginBottom: 'clamp(10px,1.5vh,16px)',
          }}>
            <div style={{
              background: effectiveVictory ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
              border: `1px solid ${effectiveVictory ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
              borderRadius: 10, padding: 'clamp(8px,1.2vh,14px)', textAlign: 'center',
            }}>
              <div style={{ fontSize: 'clamp(9px,1.2vh,11px)', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                {effectiveVictory ? 'Prize Won' : 'Entry Fee'}
              </div>
              <div style={{
                fontSize: 'clamp(20px,3.5vh,30px)', fontWeight: 900,
                color: effectiveVictory ? '#22c55e' : '#ef4444',
                fontFamily: '"Impact",sans-serif',
              }}>
                {effectiveVictory ? '+' : '-'}{effectiveVictory ? effectiveMatch.room.prizePool : effectiveMatch.room.entryFee} SOL
              </div>
            </div>
            <div style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 10, padding: 'clamp(8px,1.2vh,14px)', textAlign: 'center',
            }}>
              <div style={{ fontSize: 'clamp(9px,1.2vh,11px)', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Record</div>
              <div style={{ fontSize: 'clamp(16px,2.8vh,24px)', fontWeight: 900, fontFamily: 'monospace' }}>
                <span style={{ color: '#22c55e' }}>{effectiveTrainer.record.wins + (effectiveVictory ? 1 : 0)}W</span>
                <span style={{ color: 'rgba(255,255,255,0.3)' }}> – </span>
                <span style={{ color: '#ef4444' }}>{effectiveTrainer.record.losses + (!effectiveVictory ? 1 : 0)}L</span>
              </div>
            </div>
          </div>

          {/* ── BATTLE STATS ── */}
          <BattleStatsSection />

          {/* ── ACTION BUTTONS ── */}
          <div style={{
            display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap',
            marginTop: 'clamp(10px,1.5vh,18px)',
          }}>
            <button
              onClick={handleRematch}
              style={{
                padding: 'clamp(10px,1.5vh,14px) clamp(20px,3vw,36px)',
                background: effectiveVictory
                  ? 'linear-gradient(135deg, #d97706, #92400e)'
                  : 'linear-gradient(135deg, #7c3aed, #5b21b6)',
                border: 'none', borderRadius: 10, color: '#fff',
                fontSize: 'clamp(12px,1.8vh,15px)', fontWeight: 900, cursor: 'pointer',
                fontFamily: '"Impact","Arial Black",sans-serif', letterSpacing: '0.08em',
                boxShadow: effectiveVictory ? '0 0 20px rgba(217,119,6,0.5)' : '0 0 20px rgba(124,58,237,0.5)',
              }}
            >
              ⚔️ BATTLE AGAIN
            </button>
            <button
              onClick={handleReturnHome}
              style={{
                padding: 'clamp(10px,1.5vh,14px) clamp(20px,3vw,36px)',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, color: 'rgba(255,255,255,0.8)',
                fontSize: 'clamp(12px,1.8vh,15px)', fontWeight: 700, cursor: 'pointer',
              }}
            >
              🏠 Arena Home
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
