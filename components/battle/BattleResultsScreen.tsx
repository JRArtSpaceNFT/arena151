'use client'

/**
 * BattleResultsScreen — The single, unified post-battle results page.
 *
 * Replaces VictoryScreen + DefeatScreen + ResultsScreen.
 * Navigated to directly from battle regardless of win/loss outcome.
 * Plays ending battle music. Shows trainer background (win or loss variant).
 * Fits entirely on one screen, no scrolling.
 */

import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { useGameStore } from '@/lib/game-store'
import { useArenaStore } from '@/lib/store'
import { playMusic } from '@/lib/audio/musicEngine'

export default function BattleResultsScreen() {
  const {
    matchResults,
    battleState,
    p1Trainer,
    p2Trainer,
    p1Coins,
    p2Coins,
    gameMode,
    playAgain,
    navigateTo,
  } = useGameStore()

  const setLastMatchWinner = useArenaStore(s => s.setLastMatchWinner)

  // Always play ending battle music on this screen regardless of win/loss
  useEffect(() => {
    playMusic('victory')
  }, [])

  if (!matchResults || !battleState) {
    return (
      <div style={{
        height: '100dvh', background: '#0a0a0f',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#94a3b8', fontSize: 20,
      }}>
        Loading results...
      </div>
    )
  }

  // ── Determine winner / loser trainers from player 1's perspective ──
  // matchResults.winner: 1 = Team A (p1), 2 = Team B (p2)
  const p1Won = matchResults.winner === 1
  const winnerTrainer = p1Won ? p1Trainer : p2Trainer
  const loserTrainer  = p1Won ? p2Trainer : p1Trainer

  // ── Trainer-specific backgrounds ──
  // winBg/lossBg are optional fields on Trainer. If missing, fallback to solid color.
  // Player 1 is the "viewer" — use their result perspective.
  const bgImage = p1Won
    ? (p1Trainer?.winBg ?? null)
    : (p1Trainer?.lossBg ?? null)

  const accentColor = winnerTrainer?.color ?? '#7c3aed'

  // ── Wager / money section ──
  const hasWager = !!(matchResults.p1BetResult || matchResults.p2BetResult)
  const p1Change = matchResults.p1BetResult ?? 0
  const p2Change = matchResults.p2BetResult ?? 0

  // ── MVP per team ──
  // MVP is the single highest scorer across all creatures.
  // Find team A and team B MVPs separately.
  const teamACreatures = battleState.teamA
  const teamBCreatures = battleState.teamB
  const mvpA = teamACreatures.reduce((b, c) => (c.kos * 100 + c.damageDealt) > (b.kos * 100 + b.damageDealt) ? c : b)
  const mvpB = teamBCreatures.reduce((b, c) => (c.kos * 100 + c.damageDealt) > (b.kos * 100 + b.damageDealt) ? c : b)

  const handleReturnHome = () => {
    setLastMatchWinner(matchResults.winner)
    playAgain()
  }

  const handleBattleAgain = () => {
    setLastMatchWinner(matchResults.winner)
    playAgain()
    // After playAgain resets to 'home', GameWrapper will re-init paid_pvp/practice flow
  }

  const resultLabel = p1Won ? '🏆 VICTORY' : '💀 DEFEAT'
  const resultColor = p1Won ? accentColor : '#ef4444'

  return (
    <div style={{
      width: '100vw',
      height: '100dvh',
      maxHeight: '100dvh',
      overflow: 'hidden',
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
    }}>

      {/* ── Background image (trainer win/loss bg) ── */}
      {bgImage ? (
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `url(${bgImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          zIndex: 0,
        }} />
      ) : (
        <div style={{
          position: 'absolute', inset: 0,
          background: p1Won
            ? `radial-gradient(ellipse at 30% 40%, ${accentColor}33 0%, #0a0a0f 70%)`
            : 'radial-gradient(ellipse at 30% 40%, #3f0a0a 0%, #0a0a0f 70%)',
          zIndex: 0,
        }} />
      )}

      {/* Darkening overlay — keeps all text readable over any background */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'rgba(0,0,0,0.62)',
        zIndex: 1,
      }} />

      {/* ── All content above overlay ── */}
      <div style={{
        position: 'relative', zIndex: 2,
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        padding: 'clamp(10px,1.5vh,18px) clamp(14px,2vw,28px)',
        gap: 'clamp(8px,1.2vh,14px)',
        minHeight: 0,
      }}>

        {/* ── HEADER: Result label + winner name ── */}
        <motion.div
          initial={{ opacity: 0, y: -14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          style={{ textAlign: 'center', flexShrink: 0 }}
        >
          <div style={{
            fontFamily: '"Impact", "Arial Black", sans-serif',
            fontSize: 'clamp(26px, 5.5vh, 52px)',
            fontWeight: 900,
            color: resultColor,
            textShadow: `0 0 30px ${resultColor}99, 3px 3px 0 rgba(0,0,0,0.9)`,
            letterSpacing: '0.1em',
            lineHeight: 1,
          }}>
            {resultLabel}
          </div>
          <div style={{
            fontSize: 'clamp(12px, 2vh, 18px)',
            color: 'rgba(255,255,255,0.6)',
            marginTop: 2,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            fontWeight: 600,
          }}>
            {winnerTrainer?.name} defeated {loserTrainer?.name}
          </div>
        </motion.div>

        {/* ── MAIN CONTENT ROW ── */}
        <div style={{
          display: 'flex',
          gap: 'clamp(10px,1.5vw,20px)',
          flex: 1,
          minHeight: 0,
          alignItems: 'stretch',
        }}>

          {/* LEFT COLUMN: Wager + Team A MVP */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'clamp(8px,1.2vh,12px)',
            flex: 1,
            minWidth: 0,
          }}>

            {/* Wager result — only shown if a bet was placed */}
            {hasWager && (
              <motion.div
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 }}
                style={{
                  background: 'rgba(0,0,0,0.55)',
                  border: '1px solid rgba(251,191,36,0.35)',
                  borderRadius: 10,
                  padding: 'clamp(8px,1.2vh,14px) clamp(10px,1.5vw,18px)',
                  flexShrink: 0,
                }}
              >
                <div style={{
                  fontSize: 'clamp(10px,1.5vh,13px)',
                  color: '#fbbf24',
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  marginBottom: 8,
                }}>
                  💰 Wager Results
                </div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <WagerCard
                    label={p1Trainer?.name ?? 'Player 1'}
                    coins={p1Coins}
                    change={p1Change}
                    color={p1Trainer?.color ?? '#7c3aed'}
                  />
                  <WagerCard
                    label={p2Trainer?.name ?? 'Player 2'}
                    coins={p2Coins}
                    change={p2Change}
                    color={p2Trainer?.color ?? '#ef4444'}
                  />
                </div>
              </motion.div>
            )}

            {/* Team A MVP */}
            <MVPCard
              label={`${p1Trainer?.name ?? 'Team A'} MVP`}
              creature={mvpA}
              color={p1Trainer?.color ?? '#7c3aed'}
              delay={0.2}
              won={p1Won}
            />
          </div>

          {/* CENTER: Battle stats */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'clamp(8px,1.2vh,14px)',
              flexShrink: 0,
              minWidth: 'clamp(120px,18vw,200px)',
            }}
          >
            <div style={{
              background: 'rgba(0,0,0,0.55)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 10,
              padding: 'clamp(10px,1.5vh,18px) clamp(14px,2vw,24px)',
              textAlign: 'center',
              width: '100%',
            }}>
              <div style={{
                fontSize: 'clamp(9px,1.3vh,12px)',
                color: 'rgba(255,255,255,0.4)',
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                marginBottom: 10,
              }}>Battle Stats</div>
              <BattleStat label="Turns" value={battleState.turn} color={accentColor} />
              <BattleStat label="P1 KOs" value={battleState.teamA.reduce((s, c) => s + c.kos, 0)} color={p1Trainer?.color ?? '#7c3aed'} />
              <BattleStat label="P2 KOs" value={battleState.teamB.reduce((s, c) => s + c.kos, 0)} color={p2Trainer?.color ?? '#ef4444'} />
            </div>

            {/* Winner trainer sprite */}
            {winnerTrainer?.spriteUrl && (
              <motion.img
                src={winnerTrainer.spriteUrl}
                alt={winnerTrainer.name}
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.3, type: 'spring', stiffness: 200, damping: 20 }}
                style={{
                  height: 'clamp(80px,16vh,150px)',
                  width: 'auto',
                  imageRendering: 'pixelated',
                  filter: `drop-shadow(0 0 20px ${accentColor}88)`,
                  display: 'block',
                }}
              />
            )}
          </motion.div>

          {/* RIGHT COLUMN: Team B MVP */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'clamp(8px,1.2vh,12px)',
            flex: 1,
            minWidth: 0,
            justifyContent: 'flex-start',
          }}>
            <MVPCard
              label={`${p2Trainer?.name ?? 'Team B'} MVP`}
              creature={mvpB}
              color={p2Trainer?.color ?? '#ef4444'}
              delay={0.3}
              won={!p1Won}
            />
          </div>
        </div>

        {/* ── BUTTONS — pinned at bottom ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          style={{
            display: 'flex',
            gap: 'clamp(10px,2vw,20px)',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <ActionButton
            onClick={handleReturnHome}
            label="🏠 Return to Home"
            color="#334155"
            borderColor="rgba(255,255,255,0.2)"
          />
          <ActionButton
            onClick={handleBattleAgain}
            label="⚔️ Enter Battle Arena Again"
            color={accentColor}
            borderColor={accentColor}
            primary
          />
        </motion.div>

      </div>
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────

function WagerCard({
  label, coins, change, color,
}: {
  label: string
  coins: number
  change: number
  color: string
}) {
  const gained = change > 0
  const lost = change < 0
  return (
    <div style={{
      background: 'rgba(0,0,0,0.4)',
      border: `1px solid ${color}44`,
      borderRadius: 8,
      padding: 'clamp(6px,0.9vh,10px) clamp(10px,1.2vw,16px)',
      textAlign: 'center',
      flex: 1,
      minWidth: 100,
    }}>
      <div style={{ fontSize: 'clamp(9px,1.3vh,12px)', color, fontWeight: 700, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 'clamp(16px,2.5vh,24px)', fontWeight: 900, color: '#fbbf24' }}>
        💰 {coins}
      </div>
      {change !== 0 && (
        <div style={{
          marginTop: 4,
          fontSize: 'clamp(11px,1.6vh,14px)',
          fontWeight: 700,
          color: gained ? '#22c55e' : '#ef4444',
        }}>
          {gained ? `+${change}` : `${change}`} coins
        </div>
      )}
      {change === 0 && (
        <div style={{ marginTop: 4, fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>No bet</div>
      )}
    </div>
  )
}

function MVPCard({
  label, creature, color, delay, won,
}: {
  label: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  creature: any
  color: string
  delay: number
  won: boolean
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      style={{
        background: 'rgba(0,0,0,0.55)',
        border: `1px solid ${color}55`,
        borderRadius: 10,
        padding: 'clamp(10px,1.5vh,16px)',
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Top accent bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 3,
        background: color,
      }} />

      <div style={{
        fontSize: 'clamp(9px,1.3vh,12px)',
        color,
        fontWeight: 700,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
      }}>
        ⭐ {label}
      </div>

      {/* Crown for the winner's MVP */}
      {won && (
        <div style={{ fontSize: 'clamp(14px,2.2vh,20px)' }}>👑</div>
      )}

      <motion.img
        src={creature.creature.spriteUrl}
        alt={creature.creature.name}
        animate={{ y: [0, -5, 0] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          width: 'clamp(56px,10vh,90px)',
          height: 'clamp(56px,10vh,90px)',
          imageRendering: 'pixelated',
          objectFit: 'contain',
          filter: `drop-shadow(0 0 12px ${color}88)`,
        }}
      />

      <div style={{
        fontSize: 'clamp(13px,2vh,18px)',
        fontWeight: 700,
        color: '#f1f5f9',
        textAlign: 'center',
      }}>
        {creature.creature.name}
      </div>

      <div style={{
        display: 'flex',
        gap: 8,
        flexWrap: 'wrap',
        justifyContent: 'center',
      }}>
        <StatPill label="KOs" value={creature.kos} color={color} />
        <StatPill label="DMG" value={creature.damageDealt} color={color} />
        <StatPill label="Turns" value={creature.turnsAlive} color={color} />
      </div>
    </motion.div>
  )
}

function StatPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{
      background: 'rgba(0,0,0,0.4)',
      border: `1px solid ${color}33`,
      borderRadius: 6,
      padding: '3px 8px',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 'clamp(13px,1.9vh,17px)', fontWeight: 900, color }}>{value}</div>
      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em' }}>{label}</div>
    </div>
  )
}

function BattleStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
      <div style={{ fontSize: 'clamp(10px,1.4vh,13px)', color: 'rgba(255,255,255,0.45)' }}>{label}</div>
      <div style={{ fontSize: 'clamp(14px,2.2vh,20px)', fontWeight: 900, color }}>{value}</div>
    </div>
  )
}

function ActionButton({
  onClick, label, color, borderColor, primary,
}: {
  onClick: () => void
  label: string
  color: string
  borderColor: string
  primary?: boolean
}) {
  return (
    <motion.button
      whileHover={{ scale: 1.05, boxShadow: `0 0 24px ${color}88` }}
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      style={{
        padding: 'clamp(10px,1.5vh,16px) clamp(16px,2.5vw,36px)',
        background: primary ? color : 'rgba(0,0,0,0.55)',
        border: `2px solid ${borderColor}`,
        borderRadius: 10,
        color: '#fff',
        fontSize: 'clamp(13px,1.9vh,17px)',
        fontWeight: 700,
        fontFamily: '"Impact", "Arial Black", sans-serif',
        letterSpacing: '0.06em',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        transition: 'background 0.2s',
      }}
    >
      {label}
    </motion.button>
  )
}
