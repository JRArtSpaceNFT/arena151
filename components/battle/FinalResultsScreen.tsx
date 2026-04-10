'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useArenaStore } from '@/lib/store'
import type { SettledMatchResult } from '@/lib/store'
import { updateUser } from '@/lib/auth'
import { playMusic } from '@/lib/audio/musicEngine'
import { supabase } from '@/lib/supabase'
import { useGameStore } from '@/lib/game-store'
import { ARENA_BADGES, ROOM_TIERS } from '@/lib/constants'

// ─────────────────────────────────────────────────────────────────
// ARENA 151 FINAL RESULTS SCREEN
// One unified screen with: hero, match summary, rewards, stats, badges, actions
// ─────────────────────────────────────────────────────────────────

// Badge Ceremony Overlay
function BadgeCeremony({ arenaId, onDismiss }: { arenaId: string; onDismiss: () => void }) {
  const badge = ARENA_BADGES[arenaId]
  if (!badge) return null
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(8px)' }}
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
        const angle = (i / 24) * 360
        const dist = 160 + (i % 3) * 40
        const x = Math.cos((angle * Math.PI) / 180) * dist
        const y = Math.sin((angle * Math.PI) / 180) * dist
        const colors = [badge.color, '#fbbf24', '#ffffff', '#f0abfc', '#38bdf8']
        return (
          <motion.div key={i}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{ x, y, opacity: 0, scale: 0.3 }}
            transition={{ duration: 1.0, delay: 0.2 + i * 0.02, ease: 'easeOut' }}
            className="absolute rounded-full"
            style={{ width: 8, height: 8, background: colors[i % colors.length] }}
          />
        )
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
        <motion.p
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-xs font-black uppercase tracking-widest mb-4"
          style={{ color: badge.color, letterSpacing: '0.2em' }}
        >
          🏅 Badge Earned!
        </motion.p>

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
  )
}

// Battle Stats Panel
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

  const damageA = teamA.reduce((s, ac) => s + ((ac as any).totalDamage ?? 0), 0)
  const damageB = teamB.reduce((s, ac) => s + ((ac as any).totalDamage ?? 0), 0)
  const takenA = teamA.reduce((s, ac) => s + ((ac as any).damageTaken ?? 0), 0)
  const takenB = teamB.reduce((s, ac) => s + ((ac as any).damageTaken ?? 0), 0)

  return (
    <div style={{
      background: 'rgba(0,0,0,0.6)',
      border: '1px solid rgba(255,255,255,0.15)',
      borderRadius: 12,
      padding: '12px 16px',
    }}>
      {/* Header */}
      <div style={{
        fontSize: 11,
        color: 'rgba(255,255,255,0.5)',
        textTransform: 'uppercase',
        letterSpacing: '0.2em',
        marginBottom: 12,
        textAlign: 'center',
        fontWeight: 700,
      }}>Battle Statistics</div>

      {/* Single horizontal row layout matching screenshot */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
      }}>
        {/* MVP Pokemon with sprite */}
        {mvp && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
            minWidth: 80,
          }}>
            <img
              src={mvp.creature.spriteUrl}
              alt={mvp.creature.name}
              style={{
                width: 48,
                height: 48,
                imageRendering: 'pixelated',
              }}
            />
            <div style={{
              fontSize: 11,
              fontWeight: 800,
              color: '#f1f5f9',
            }}>{mvp.creature.name}</div>
            <div style={{
              fontSize: 9,
              fontWeight: 700,
              color: 'rgba(255,255,255,0.4)',
              textTransform: 'uppercase',
            }}>MVP</div>
          </div>
        )}

        {/* Vertical divider */}
        <div style={{
          width: 1,
          height: 60,
          background: 'rgba(255,255,255,0.1)',
        }} />

        {/* Stats - simplified (opponent stats are redundant) */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}>
          {/* Damage Dealt */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', minWidth: 110 }}>Damage Dealt</span>
            <span style={{ fontSize: 20, fontWeight: 900, color: '#22c55e' }}>{damageA}</span>
          </div>

          {/* Damage Taken */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', minWidth: 110 }}>Damage Taken</span>
            <span style={{ fontSize: 20, fontWeight: 900, color: '#ef4444' }}>{takenA}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ emoji, label, value }: { emoji: string; label: string; value: string | number }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)', borderRadius: 8,
      padding: 6, textAlign: 'center',
    }}>
      <div style={{ fontSize: 14, marginBottom: 3 }}>{emoji}</div>
      <div style={{ fontSize: 12, fontWeight: 800, color: '#f1f5f9', marginBottom: 2 }}>{value}</div>
      <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.35)' }}>{label}</div>
    </div>
  )
}

function StatCardWithSprite({ creature, label }: { creature: any; label: string }) {
  if (!creature) return null
  
  const imageUrl = creature.creature.spriteUrl || creature.creature.sprite || `/pokemon/${creature.creature.slug}.png`
  
  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)', borderRadius: 8,
      padding: 6, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center',
    }}>
      <div style={{ width: 48, height: 48, marginBottom: 3, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <img 
          src={imageUrl}
          alt={creature.creature.name}
          style={{
            maxWidth: 48,
            maxHeight: 48,
            objectFit: 'contain',
            imageRendering: 'pixelated',
          }}
          onError={(e) => {
            console.error('MVP sprite failed to load:', imageUrl)
            const img = e.target as HTMLImageElement
            img.style.display = 'none'
          }}
        />
      </div>
      <div style={{ fontSize: 11, fontWeight: 800, color: '#f1f5f9', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{creature.creature.name.slice(0, 9)}</div>
      <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.35)' }}>{label}</div>
    </div>
  )
}

function ComparisonRow({ label, value, align }: { label: string; value: number; align: 'left' | 'right' }) {
  return (
    <div style={{ marginBottom: 6, textAlign: align }}>
      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginRight: align === 'right' ? 8 : 0, marginLeft: align === 'left' ? 8 : 0 }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 800, color: '#f1f5f9' }}>{value}</span>
    </div>
  )
}

export default function FinalResultsScreen() {
  const { currentMatch, currentTrainer, setTrainer, setScreen, clearMatch, lastMatchWinner, settledMatchResult, setSettledMatchResult, setLastMatchWinner } = useArenaStore()
  const { p1Trainer, p2Trainer, arena, gameMode, battleState } = useGameStore()
  
  // CRITICAL FIX: Read winner from battleState, not lastMatchWinner (which is never set)
  const actualWinner = battleState?.winner === 'A' ? 1 : battleState?.winner === 'B' ? 2 : null
  
  console.log('[FinalResultsScreen] Winner detection:', {
    battleStateWinner: battleState?.winner,
    actualWinner,
    settledMatchResult: settledMatchResult?.iWon,
    lastMatchWinner,
  })
  
  const [isVictory] = useState(() => {
    // For real-money matches with settled results
    if (settledMatchResult) return settledMatchResult.iWon
    // For all other matches (practice, friend, quick), read from battleState
    const victory = actualWinner === 1
    console.log('[FinalResultsScreen] Calculated isVictory:', victory)
    return victory
  })
  const [newBadgeArena, setNewBadgeArena] = useState<string | null>(null)

  // ── Practice mode synthetic match ──
  const isPracticeMode = gameMode === 'practice'
  const practiceMatch = isPracticeMode && arena && p1Trainer ? {
    matchId: 'practice-' + Date.now(),
    player1: {
      id: p1Trainer.id,
      username: p1Trainer.name,
      displayName: p1Trainer.name,
      email: '', bio: '', avatar: '🎮',
      favoritePokemon: null as never,
      joinedDate: new Date(),
      record: { wins: 0, losses: 0 },
      internalWalletId: '', balance: 0, earnings: 0, badges: [],
    },
    player2: {
      id: p2Trainer?.id ?? 'ai',
      username: p2Trainer?.name ?? 'AI',
      displayName: p2Trainer?.name ?? 'AI Opponent',
      email: '', bio: '', avatar: '🤖',
      favoritePokemon: null as never,
      joinedDate: new Date(),
      record: { wins: 0, losses: 0 },
      internalWalletId: '', balance: 0, earnings: 0, badges: [],
    },
    room: {
      id: arena.id,
      name: arena.name,
      entryFee: 0,
      prizePool: 0,
      tier: 'practice' as const,
    },
    iWon: isVictory,
    payoutDelta: 0,
    settlementTx: null,
  } : null

  const practiceTrainer = isPracticeMode && p1Trainer ? {
    id: p1Trainer.id,
    username: p1Trainer.name,
    displayName: p1Trainer.name,
    email: '', bio: '', avatar: '🎮',
    favoritePokemon: null as never,
    joinedDate: new Date(),
    record: { wins: 0, losses: 0 },
    internalWalletId: '', balance: 0, earnings: 0, badges: [],
  } : null

  // ── Post-refresh settled resume path ──
  const resolvedFromServer = !currentMatch && settledMatchResult && !isPracticeMode

  const syntheticMatch = resolvedFromServer ? (() => {
    const r = settledMatchResult as SettledMatchResult
    const room = r.roomId ? ROOM_TIERS[r.roomId] : null
    if (!r.myProfile || !room) return null
    const myTrainer = {
      id: r.myProfile.id,
      username: r.myProfile.username,
      displayName: r.myProfile.displayName,
      email: '', bio: '',
      avatar: r.myProfile.avatar,
      favoritePokemon: null as never,
      joinedDate: new Date(),
      record: { wins: r.myProfile.wins, losses: r.myProfile.losses },
      internalWalletId: '',
      balance: r.myProfile.balance,
      earnings: 0,
      badges: r.myProfile.badges,
    }
    const oppTrainer = r.opponentProfile ? {
      id: r.opponentProfile.id,
      username: r.opponentProfile.username,
      displayName: r.opponentProfile.displayName,
      email: '', bio: '', avatar: '😎', favoritePokemon: null as never,
      joinedDate: new Date(),
      record: { wins: 0, losses: 0 },
      internalWalletId: '', balance: 0, earnings: 0, badges: [],
    } : null
    return {
      matchId: settledMatchResult?.battleSeed ?? '',
      player1: myTrainer,
      player2: oppTrainer ?? myTrainer,
      room,
      iWon: r.iWon,
      payoutDelta: r.payoutDelta,
      settlementTx: r.settlementTx,
    }
  })() : null

  const syntheticTrainer = resolvedFromServer && settledMatchResult?.myProfile ? {
    id: settledMatchResult.myProfile.id,
    username: settledMatchResult.myProfile.username,
    displayName: settledMatchResult.myProfile.displayName,
    email: '', bio: '',
    avatar: settledMatchResult.myProfile.avatar,
    favoritePokemon: null as never,
    joinedDate: new Date(),
    record: { wins: settledMatchResult.myProfile.wins, losses: settledMatchResult.myProfile.losses },
    internalWalletId: '', balance: settledMatchResult.myProfile.balance, earnings: 0,
    badges: settledMatchResult.myProfile.badges,
  } : null

  const effectiveMatch = currentMatch ?? syntheticMatch ?? practiceMatch as typeof currentMatch
  const effectiveTrainer = currentTrainer ?? syntheticTrainer ?? practiceTrainer as typeof currentTrainer
  const effectiveVictory = resolvedFromServer ? (settledMatchResult?.iWon ?? false) : isVictory

  // Determine trainer background image - ALWAYS show current player's trainer
  const winnerTrainer = effectiveVictory ? p1Trainer : p2Trainer // Keep for share text
  
  // Determine which trainer is the current player and which is opponent
  const isPlayerP1 = currentTrainer?.id === p1Trainer?.id
  const isPlayerP2 = currentTrainer?.id === p2Trainer?.id
  const myTrainer = isPlayerP1 ? p1Trainer : isPlayerP2 ? p2Trainer : effectiveTrainer
  const opponentTrainer = isPlayerP1 ? p2Trainer : isPlayerP2 ? p1Trainer : p2Trainer
  
  // VICTORY = show MY trainer celebrating | DEFEAT = show OPPONENT trainer celebrating
  const bgTrainer = effectiveVictory ? myTrainer : opponentTrainer
  const trainerSlug = (bgTrainer && 'username' in bgTrainer) ? bgTrainer.username?.toLowerCase().replace(/\s+/g, '-') : 'ash'
  // Both victory and defeat images show the WINNER celebrating
  const trainerBg = `/trainer-results/${trainerSlug}-win.png`
  const fallbackBg = '/victory-bg.png'
  
  console.log('[FinalResultsScreen] victory:', effectiveVictory, 'bgTrainer:', trainerSlug, 'trainerBg:', trainerBg)

  useEffect(() => {
    playMusic('victory')
    
    // CRITICAL: Set lastMatchWinner so other screens know the result
    if (actualWinner) {
      setLastMatchWinner(actualWinner as 1 | 2)
    }
  }, [actualWinner, setLastMatchWinner])

  useEffect(() => {
    if (!effectiveMatch || !effectiveTrainer) return
    if (resolvedFromServer) {
      const arenaId = effectiveMatch.room.id as string
      const existingBadges: string[] = effectiveTrainer.badges ?? []
      const isFirstBadgeEarn = effectiveVictory && ARENA_BADGES[arenaId] && !existingBadges.includes(arenaId)
      if (isFirstBadgeEarn) setTimeout(() => setNewBadgeArena(arenaId), 1400)
      return
    }
    if (!currentMatch || !currentTrainer) return

    const isRealMoneyGame = currentMatch.room.entryFee > 0

    if (isRealMoneyGame) {
      const isBotMatch = currentMatch.player2.id.startsWith('bot_')
      const hasServerMatchId = currentMatch.matchId &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(currentMatch.matchId)

      if (!isBotMatch && hasServerMatchId) {
        const claimedWinnerId = isVictory ? currentTrainer.id : currentMatch.player2.id

        const pollForSettlement = async (headers: Record<string, string>) => {
          for (let i = 0; i < 30; i++) {
            await new Promise(r => setTimeout(r, 2000))
            try {
              const statusRes = await fetch(`/api/match/${currentMatch.matchId}/status`, { headers })
              const statusData = await statusRes.json()
              if (statusData.status === 'settlement_pending') {
                const settleRes = await fetch('/api/settle', {
                  method: 'POST',
                  headers,
                  body: JSON.stringify({ matchId: currentMatch.matchId }),
                })
                return settleRes.json()
              }
              if (statusData.status === 'settled') return statusData
              if (['voided', 'manual_review', 'settlement_failed'].includes(statusData.status)) break
            } catch (pollErr) {
              console.error('[FinalResultsScreen] poll error:', pollErr)
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
            const resultRes = await fetch(`/api/match/${currentMatch.matchId}/result`, {
              method: 'POST',
              headers,
              body: JSON.stringify({ winnerId: claimedWinnerId }),
            })
            const resultData = await resultRes.json()

            let data: Record<string, unknown> | null = null
            if (resultData.status === 'settlement_pending') {
              const settleRes = await fetch('/api/settle', {
                method: 'POST',
                headers,
                body: JSON.stringify({ matchId: currentMatch.matchId }),
              })
              data = await settleRes.json()
            } else if (resultData.status === 'result_pending') {
              data = await pollForSettlement(headers)
            }

            if (data?.ok && !data.alreadySettled && data.winnerBalanceAfter !== undefined) {
              const updatedBalance = isVictory ? data.winnerBalanceAfter : data.loserBalanceAfter
              if (updatedBalance !== undefined) {
                setTrainer({ ...currentTrainer, balance: updatedBalance as number })
              }
            }
          } catch (err) {
            console.error('[FinalResultsScreen] settle error:', err)
          }
        })
      } else if (!isBotMatch && !hasServerMatchId) {
        console.error('[FinalResultsScreen] BLOCKED: Real-money match has no server matchId.')
      }
    }

    const arenaId = currentMatch.room.id as string
    const existingBadges: string[] = currentTrainer.badges ?? []
    const isFirstBadgeEarn = isVictory && ARENA_BADGES[arenaId] && !existingBadges.includes(arenaId)
    const updatedBadges = isFirstBadgeEarn ? [...existingBadges, arenaId] : existingBadges

    const updatedTrainer = {
      ...currentTrainer,
      record: {
        wins: isVictory ? currentTrainer.record.wins + 1 : currentTrainer.record.wins,
        losses: !isVictory ? currentTrainer.record.losses + 1 : currentTrainer.record.losses,
      },
      balance: currentTrainer.balance,
      earnings: currentTrainer.earnings ?? 0,
      badges: updatedBadges,
    }

    setTrainer(updatedTrainer)
    updateUser(effectiveTrainer.id, {
      wins: updatedTrainer.record.wins,
      losses: updatedTrainer.record.losses,
      ...(isRealMoneyGame ? {} : { balance: updatedTrainer.balance, earnings: updatedTrainer.earnings }),
      badges: updatedBadges,
    })

    if (isFirstBadgeEarn) {
      setTimeout(() => setNewBadgeArena(arenaId), 1400)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    return () => {
      if (settledMatchResult) setSettledMatchResult(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleReturnHome = () => {
    clearMatch()
    setScreen('draft-mode-intro')
  }

  const handleRematch = () => {
    clearMatch()
    setScreen('room-select')
  }

  const handleShare = () => {
    const trainerName = winnerTrainer?.name ?? 'Unknown Trainer'
    const arenaName = effectiveMatch?.room.name ?? 'Arena 151'
    const payout = effectiveVictory ? effectiveMatch?.room.prizePool : effectiveMatch?.room.entryFee
    const text = encodeURIComponent(
      effectiveVictory
        ? `Just won in Arena 151! 🏆 My trainer ${trainerName} crushed it in ${arenaName}! +${payout} SOL 💰 Play at https://arena151.xyz #Arena151 #Pokemon`
        : `Great battle in Arena 151! ${trainerName} fought hard in ${arenaName}. Ready for the rematch! 💪 Play at https://arena151.xyz #Arena151 #Pokemon`
    )
    window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank', 'noopener,noreferrer')
  }

  if (!effectiveMatch || !effectiveTrainer) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-950 overflow-hidden">
        <div className="text-center">
          <div className="text-4xl mb-4">⏳</div>
          <p className="text-slate-400 font-mono">Loading match result...</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <style>{`
        html, body { overflow-y: auto !important; height: auto !important; }
      `}</style>

      <AnimatePresence>
        {newBadgeArena && (
          <BadgeCeremony arenaId={newBadgeArena} onDismiss={() => setNewBadgeArena(null)} />
        )}
      </AnimatePresence>

      <div style={{
        minHeight: '100dvh',
        position: 'relative',
        overflowY: 'visible',
      }}>
        {/* Background image — trainer-specific win/loss */}
        <div style={{
          position: 'fixed', inset: 0,
          backgroundImage: `url(${fallbackBg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          zIndex: 0,
        }}>
          <img
            src={trainerBg}
            alt="trainer background"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center',
            }}
            onError={(e) => {
              // Hide image on error, fallback gradient shows through
              e.currentTarget.style.display = 'none'
            }}
          />
        </div>

        {/* Dark overlay for legibility */}
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1 }} />

        {/* Content */}
        <div style={{
          position: 'relative', zIndex: 2,
          padding: 'clamp(12px, 2vh, 20px) clamp(12px, 3vw, 24px)',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
        }}>
          <div style={{ width: '100%', maxWidth: 720 }}>

            {/* ── 1. TOP HERO SECTION ── */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              style={{
                textAlign: 'center',
                marginBottom: 12,
              }}
            >
              <div style={{
                fontFamily: '"Impact","Arial Black",sans-serif',
                fontSize: 'clamp(28px, 4.5vh, 44px)',
                fontWeight: 900,
                letterSpacing: '0.06em',
                color: effectiveVictory ? '#fbbf24' : '#a855f7',
                textShadow: effectiveVictory
                  ? '0 0 40px rgba(251,191,36,0.9), 4px 4px 0 rgba(0,0,0,0.9)'
                  : '0 0 40px rgba(168,85,247,0.9), 4px 4px 0 rgba(0,0,0,0.9)',
                lineHeight: 1,
                marginBottom: 6,
              }}>
                {effectiveVictory ? 'VICTORY!' : 'DEFEAT'}
              </div>
              <div style={{ fontSize: 16, color: '#fff', fontWeight: 700, marginBottom: 4 }}>
                {effectiveVictory ? 'You defeated' : 'You were defeated by'} {effectiveMatch.player2.displayName}
              </div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>
                {effectiveMatch.room.name}
              </div>
              {effectiveMatch.room.entryFee > 0 && (
                <div style={{
                  fontSize: 'clamp(20px, 3.5vh, 32px)',
                  fontWeight: 900,
                  color: effectiveVictory ? '#22c55e' : '#ef4444',
                  fontFamily: '"Impact",sans-serif',
                  textShadow: '2px 2px 0 rgba(0,0,0,0.8)',
                }}>
                  {effectiveVictory ? '+' : '-'}{effectiveVictory ? effectiveMatch.room.prizePool : effectiveMatch.room.entryFee} SOL
                </div>
              )}
            </motion.div>

            {/* ── 2. MATCH SUMMARY STRIP ── */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              style={{
                display: 'flex',
                justifyContent: 'space-around',
                background: 'rgba(0,0,0,0.5)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 12,
                padding: 10,
                marginBottom: 12,
              }}
            >
              <SummaryItem label="Match Type" value="Wager Battle" />
              <SummaryItem label="Arena" value={effectiveMatch.room.name.replace(' Arena', '')} />
              <SummaryItem label="Wager" value={`${effectiveMatch.room.entryFee} SOL`} />
            </motion.div>

            {/* ── 3. REWARDS AND ECONOMY PANEL ── */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              style={{
                background: effectiveVictory ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                border: `2px solid ${effectiveVictory ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'}`,
                borderRadius: 12,
                padding: 14,
                marginBottom: 12,
              }}
            >
              <div style={{
                fontSize: 11, color: 'rgba(255,255,255,0.5)',
                textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 8, textAlign: 'center',
              }}>
                {effectiveVictory ? '🎉 Rewards' : '💔 Result'}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>
                    {effectiveVictory ? 'Your Payout' : 'Entry Fee'}
                  </div>
                  <div style={{
                    fontSize: 28, fontWeight: 900,
                    color: effectiveVictory ? '#22c55e' : '#ef4444',
                    fontFamily: '"Impact",sans-serif',
                  }}>
                    {effectiveVictory ? '+' : '-'}{effectiveVictory ? effectiveMatch.room.prizePool : effectiveMatch.room.entryFee} SOL
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>
                    Record
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 900, fontFamily: 'monospace' }}>
                    <span style={{ color: '#22c55e' }}>{effectiveTrainer.record.wins + (effectiveVictory ? 1 : 0)}W</span>
                    <span style={{ color: 'rgba(255,255,255,0.3)' }}> – </span>
                    <span style={{ color: '#ef4444' }}>{effectiveTrainer.record.losses + (!effectiveVictory ? 1 : 0)}L</span>
                  </div>
                </div>
              </div>

              {/* Badge or next badge progress */}
              {effectiveVictory && ARENA_BADGES[effectiveMatch.room.id as string] ? (
                <div style={{
                  background: 'rgba(255,255,255,0.1)',
                  borderRadius: 8,
                  padding: 10,
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: 12, color: '#fbbf24', fontWeight: 700 }}>
                    🏅 {ARENA_BADGES[effectiveMatch.room.id as string].name} Earned!
                  </div>
                </div>
              ) : null}
            </motion.div>

            {/* ── 4. BATTLE STATS PANEL ── */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              style={{ marginBottom: 12 }}
            >
              <BattleStatsSection />
            </motion.div>

            {/* ── 5. ACTION BUTTONS ── */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                alignItems: 'center',
              }}
            >
              <button
                onClick={handleRematch}
                style={{
                  width: '100%',
                  maxWidth: 320,
                  padding: '14px 36px',
                  background: effectiveVictory
                    ? 'linear-gradient(135deg, #d97706, #92400e)'
                    : 'linear-gradient(135deg, #7c3aed, #5b21b6)',
                  border: 'none', borderRadius: 10, color: '#fff',
                  fontSize: 16, fontWeight: 900, cursor: 'pointer',
                  fontFamily: '"Impact","Arial Black",sans-serif', letterSpacing: '0.08em',
                  boxShadow: effectiveVictory ? '0 0 30px rgba(217,119,6,0.6)' : '0 0 30px rgba(124,58,237,0.6)',
                }}
              >
                PLAY AGAIN
              </button>

              <div style={{ display: 'flex', gap: 10, width: '100%', maxWidth: 320 }}>
                <button
                  onClick={handleReturnHome}
                  style={{
                    flex: 1,
                    padding: '12px 24px',
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.2)', borderRadius: 10, color: 'rgba(255,255,255,0.9)',
                    fontSize: 14, fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  Arena Home
                </button>
                <button
                  onClick={handleShare}
                  style={{
                    flex: 1,
                    padding: '12px 24px',
                    background: 'rgba(0,0,0,0.6)',
                    border: '1px solid rgba(255,255,255,0.2)', borderRadius: 10, color: 'rgba(255,255,255,0.9)',
                    fontSize: 14, fontWeight: 700, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.74l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                  Share
                </button>
              </div>
            </motion.div>

          </div>
        </div>
      </div>
    </>
  )
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 13, fontWeight: 800, color: '#f1f5f9' }}>
        {value}
      </div>
    </div>
  )
}
