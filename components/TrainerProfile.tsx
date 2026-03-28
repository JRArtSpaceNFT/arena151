'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy, Target, Wallet, ArrowLeft, Copy, Check, LogOut, Camera, Upload,
  AlertTriangle, ArrowDown, X, ShieldAlert, TrendingUp, TrendingDown, Heart,
} from 'lucide-react';
import { useArenaStore } from '@/lib/store';
import { TYPE_COLORS } from '@/lib/constants';
import { getPokemonSpriteUrl } from '@/lib/pokemon-data';
import { clearSession, updateUser } from '@/lib/auth';
import { getAvatarOptions } from '@/lib/trainer-avatars';

// ─── Withdrawal constants (mock — replace with live price feed in production) ───
const SOL_PRICE_USD = 150; // approximate USD per SOL
const WITHDRAWAL_FEE_SOL = 0.001; // network/processing fee
const MIN_WITHDRAWAL_USD = 5;
const MIN_WITHDRAWAL_SOL = MIN_WITHDRAWAL_USD / SOL_PRICE_USD; // ≈ 0.0334 SOL

// Very basic Solana address check: base58, 32–44 chars
const isValidSolAddress = (addr: string) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr.trim());

type WalletView = 'deposit' | 'withdraw' | null;
type WithdrawStep = 'form' | 'confirm' | 'success';

// ─── Trainer rank helpers ────────────────────────────────────────────────────
function getTrainerLevel(wins: number) {
  return Math.min(99, Math.floor(wins / 5) + 1);
}

function getTrainerTitle(wins: number) {
  if (wins >= 30) return 'Champion';
  if (wins >= 15) return 'Elite Contender';
  if (wins >= 5) return 'Gym Challenger';
  return 'Rookie Trainer';
}

function getTitleColor(wins: number) {
  if (wins >= 30) return 'text-yellow-400';
  if (wins >= 15) return 'text-cyan-400';
  if (wins >= 5) return 'text-purple-400';
  return 'text-slate-400';
}

type RankInfo = { label: string; color: string; isRainbow?: boolean };
function getRankInfo(wins: number): RankInfo {
  if (wins >= 50) return { label: 'Champion', color: '#ffd700', isRainbow: true };
  if (wins >= 30) return { label: 'Elite', color: 'cyan' };
  if (wins >= 15) return { label: 'Gold', color: '#ffd700' };
  if (wins >= 5) return { label: 'Silver', color: '#c0c0c0' };
  return { label: 'Bronze', color: '#cd7f32' };
}

function getBgGradient(wins: number) {
  if (wins >= 15) {
    return 'from-orange-950 via-red-950 to-slate-950';
  }
  if (wins >= 5) {
    return 'from-indigo-950 via-purple-950 to-slate-950';
  }
  return 'from-blue-950 via-teal-950 to-slate-950';
}

// ─── Gym Badge definitions (5 wins each, in order) ───────────────────────────
const GYM_BADGES = [
  { name: 'Boulder Badge', file: '/BoulderBadge.png', wins: 5 },
  { name: 'Cascade Badge', file: '/CascadeBadge.png', wins: 10 },
  { name: 'Thunder Badge', file: '/ThunderBadge.png', wins: 15 },
  { name: 'Rainbow Badge', file: '/RainbowBadge.png', wins: 20 },
  { name: 'Soul Badge',    file: '/SoulBadge.png',    wins: 25 },
  { name: 'Marsh Badge',   file: '/MarshBadge.png',   wins: 30 },
  { name: 'Volcano Badge', file: '/VolcanoBadge.png', wins: 35 },
  { name: 'Earth Badge',   file: '/EarthBadge.png',   wins: 40 },
];

// ─── Static mock battle history ──────────────────────────────────────────────
const MOCK_BATTLES = [
  { opponent: 'TrainerRed', result: 'win' as const },
  { opponent: 'GaryOak', result: 'loss' as const },
  { opponent: 'MistyW', result: 'win' as const },
  { opponent: 'BrockS', result: 'loss' as const },
  { opponent: 'DragonTamer', result: 'win' as const },
];

// ─── Floating particle data (fixed to avoid hydration mismatch) ───────────────
const PARTICLES = [
  { x: '8%',  y: '12%', size: 3, duration: 6,  delay: 0   },
  { x: '22%', y: '34%', size: 2, duration: 8,  delay: 1   },
  { x: '41%', y: '8%',  size: 4, duration: 7,  delay: 0.5 },
  { x: '57%', y: '25%', size: 2, duration: 9,  delay: 2   },
  { x: '73%', y: '15%', size: 3, duration: 6,  delay: 1.5 },
  { x: '88%', y: '40%', size: 2, duration: 8,  delay: 0.8 },
  { x: '15%', y: '65%', size: 3, duration: 7,  delay: 3   },
  { x: '32%', y: '78%', size: 2, duration: 10, delay: 1.2 },
  { x: '50%', y: '55%', size: 4, duration: 6,  delay: 2.5 },
  { x: '67%', y: '70%', size: 2, duration: 9,  delay: 0.3 },
  { x: '80%', y: '82%', size: 3, duration: 7,  delay: 1.8 },
  { x: '95%', y: '60%', size: 2, duration: 8,  delay: 0.6 },
];

// ─────────────────────────────────────────────────────────────────────────────

export default function TrainerProfile() {
  const { currentTrainer, setScreen, setTrainer, clearTrainer, testingMode } = useArenaStore();

  // ── avatar picker ──
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── badge announcement ──
  const [badgeAnnouncement, setBadgeAnnouncement] = useState<number | null>(null); // index into GYM_BADGES

  // Check on mount if player just crossed a badge threshold
  const prevWinsRef = useRef<number | null>(null);
  if (currentTrainer && prevWinsRef.current === null) {
    // On first render: check if wins just hit a badge milestone (within the last 5 wins)
    const wins = currentTrainer.record.wins;
    const badgeIdx = GYM_BADGES.findIndex(b => wins === b.wins);
    if (badgeIdx !== -1) {
      // Show announcement once — use sessionStorage so it only fires once per login
      const key = `badge_announced_${badgeIdx}`;
      if (typeof window !== 'undefined' && !sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, '1');
        setTimeout(() => setBadgeAnnouncement(badgeIdx), 800);
      }
    }
    prevWinsRef.current = wins;
  }

  // ── wallet ──
  const [walletView, setWalletView] = useState<WalletView>(null);
  const [copied, setCopied] = useState(false);

  // ── withdrawal form ──
  const [withdrawAddr, setWithdrawAddr] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawStep, setWithdrawStep] = useState<WithdrawStep>('form');
  const [withdrawError, setWithdrawError] = useState('');

  // ─────────────────────────────────────────────

  const copyAddress = () => {
    if (!currentTrainer) return;
    navigator.clipboard.writeText(currentTrainer.internalWalletId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLogout = () => {
    clearSession();   // wipe localStorage
    clearTrainer();   // wipe Zustand in-memory state
    setScreen('home');
  };

  const handleAvatarChange = (newAvatar: string) => {
    if (!currentTrainer) return;
    const updated = { ...currentTrainer, avatar: newAvatar };
    setTrainer(updated);
    updateUser(currentTrainer.id, { avatar: newAvatar });
    setShowAvatarPicker(false);
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) return;
    if (file.size > 5 * 1024 * 1024) return;
    const reader = new FileReader();
    reader.onload = (ev) => handleAvatarChange(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const openWalletView = (view: WalletView) => {
    setWalletView(walletView === view ? null : view);
    // reset withdrawal state when toggling
    if (view === 'withdraw') {
      setWithdrawAddr('');
      setWithdrawAmount('');
      setWithdrawStep('form');
      setWithdrawError('');
    }
  };

  // ── Withdrawal validation & submit ──
  const parsedAmount = parseFloat(withdrawAmount) || 0;
  const netAmount = Math.max(0, parsedAmount - WITHDRAWAL_FEE_SOL);
  const minAmountRequired = MIN_WITHDRAWAL_SOL + WITHDRAWAL_FEE_SOL; // must send enough that net ≥ MIN

  const validateWithdraw = () => {
    if (!isValidSolAddress(withdrawAddr)) {
      setWithdrawError('Please enter a valid Solana wallet address.');
      return false;
    }
    if (parsedAmount <= 0) {
      setWithdrawError('Please enter an amount to withdraw.');
      return false;
    }
    if (netAmount < MIN_WITHDRAWAL_SOL) {
      setWithdrawError(
        `Minimum withdrawal is $${MIN_WITHDRAWAL_USD} worth of SOL (~${MIN_WITHDRAWAL_SOL.toFixed(4)} SOL). Your net amount after the ${WITHDRAWAL_FEE_SOL} SOL fee would be ${netAmount.toFixed(4)} SOL.`
      );
      return false;
    }
    if (!currentTrainer || parsedAmount > currentTrainer.balance) {
      setWithdrawError('Insufficient balance.');
      return false;
    }
    setWithdrawError('');
    return true;
  };

  const handleWithdrawNext = () => {
    if (validateWithdraw()) setWithdrawStep('confirm');
  };

  const handleWithdrawConfirm = () => {
    if (!currentTrainer) return;
    // Deduct from balance (mock — real impl would submit on-chain)
    const updated = { ...currentTrainer, balance: currentTrainer.balance - parsedAmount };
    setTrainer(updated);
    updateUser(currentTrainer.id, { balance: updated.balance });
    setWithdrawStep('success');
  };

  const handleWithdrawClose = () => {
    setWalletView(null);
    setWithdrawAddr('');
    setWithdrawAmount('');
    setWithdrawStep('form');
    setWithdrawError('');
  };

  // ─────────────────────────────────────────────

  if (!currentTrainer) return null;

  const wins = currentTrainer.record.wins;
  const trainerLevel = getTrainerLevel(wins);
  const trainerTitle = getTrainerTitle(wins);
  const titleColor = getTitleColor(wins);
  const rankInfo = getRankInfo(wins);
  const bgGradient = getBgGradient(wins);
  const partnerType = currentTrainer.favoritePokemon.types[0];
  const typeColor = TYPE_COLORS[partnerType] ?? '#6366f1';
  const earnings = currentTrainer.earnings ?? 0;
  const isProfit = earnings >= 0;

  return (
    <div className={`min-h-screen relative overflow-hidden bg-gradient-to-b ${bgGradient}`}>

      {/* ── Badge Unlock Announcement ──────────────────────── */}
      <AnimatePresence>
        {badgeAnnouncement !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
            onClick={() => setBadgeAnnouncement(null)}
          >
            <motion.div
              initial={{ scale: 0.5, y: 60 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className="text-center px-10 py-12 rounded-3xl max-w-sm mx-4"
              style={{
                background: 'linear-gradient(135deg, rgba(15,15,40,0.98), rgba(30,15,60,0.98))',
                border: `2px solid ${typeColor}`,
                boxShadow: `0 0 60px ${typeColor}55, 0 0 120px ${typeColor}22`,
              }}
              onClick={e => e.stopPropagation()}
            >
              <motion.div
                animate={{ rotate: [0, -8, 8, -8, 8, 0], scale: [1, 1.2, 1.2, 1.2, 1.2, 1] }}
                transition={{ duration: 0.8, delay: 0.3 }}
                className="text-6xl mb-4"
              >
                🎉
              </motion.div>
              <h2 className="text-3xl font-black text-white mb-1">LEVEL UP!</h2>
              <p className="text-lg font-bold mb-6" style={{ color: typeColor }}>
                You reached Level {getTrainerLevel(wins)}!
              </p>
              <div className="relative mb-6">
                <motion.div
                  className="absolute inset-0 rounded-full blur-2xl"
                  style={{ background: typeColor, opacity: 0.4 }}
                  animate={{ opacity: [0.3, 0.6, 0.3] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={GYM_BADGES[badgeAnnouncement].file}
                  alt={GYM_BADGES[badgeAnnouncement].name}
                  className="w-28 h-28 mx-auto object-contain relative z-10"
                />
              </div>
              <p className="text-yellow-300 font-black text-xl mb-1">
                🏅 {GYM_BADGES[badgeAnnouncement].name} Earned!
              </p>
              <p className="text-slate-400 text-sm mb-8">
                You're unstoppable, Trainer. Keep battling!
              </p>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setBadgeAnnouncement(null)}
                className="px-8 py-3 rounded-xl font-black text-white text-sm uppercase tracking-wide"
                style={{ background: `linear-gradient(135deg, ${typeColor}, #6366f1)` }}
              >
                Let's Go! ⚡
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Floating particle dots ─────────────────────────── */}
      {PARTICLES.map((p, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full pointer-events-none"
          style={{
            left: p.x,
            top: p.y,
            width: p.size,
            height: p.size,
            background: typeColor,
            opacity: 0.35,
          }}
          animate={{ y: [0, -18, 0], opacity: [0.25, 0.5, 0.25] }}
          transition={{ duration: p.duration, delay: p.delay, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}

      {/* Ambient glows */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full blur-3xl opacity-20"
        style={{ background: `radial-gradient(circle, ${typeColor}, transparent)` }} />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-slate-900/60 rounded-full blur-3xl" />

      <div className="relative z-10 max-w-5xl mx-auto px-4 py-8">

        {/* ── Top nav ─────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="mb-6 flex items-center justify-between"
        >
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => setScreen('draft-mode-intro')}
            className="flex items-center gap-2 bg-black/30 backdrop-blur-md border border-white/10 px-4 py-2 rounded-xl hover:border-white/30 transition-all text-slate-200"
          >
            <ArrowLeft className="w-5 h-5" />Back to Arena
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-black/30 backdrop-blur-md border border-slate-700 text-slate-400 hover:text-red-400 hover:border-red-500/50 transition-all text-sm"
          >
            <LogOut className="w-4 h-4" />Sign Out
          </motion.button>
        </motion.div>

        {/* ── Trainer Card ─────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl p-8 mb-6 relative overflow-hidden"
          style={{
            background: 'rgba(15,15,25,0.65)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: `1.5px solid ${typeColor}55`,
            boxShadow: `0 8px 40px ${typeColor}22, 0 2px 8px rgba(0,0,0,0.5)`,
          }}
        >
          {/* Partner type glow behind card */}
          <div
            className="absolute top-0 right-0 w-96 h-96 opacity-10 blur-3xl pointer-events-none"
            style={{ background: `radial-gradient(circle, ${typeColor}, transparent)` }}
          />

          <div className="relative z-10 flex flex-col md:flex-row gap-8">

            {/* ── Avatar ──────────────────────────────────── */}
            <div className="flex-shrink-0 relative flex flex-col items-center gap-3">
              {/* Glowing aura ring */}
              <div className="relative">
                <motion.div
                  className="absolute inset-0 rounded-full"
                  style={{ boxShadow: `0 0 24px 8px ${typeColor}88`, border: `2px solid ${typeColor}66` }}
                  animate={{ opacity: [0.5, 1, 0.5], scale: [1, 1.06, 1] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                />
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  onClick={() => setShowAvatarPicker(true)}
                  className="w-40 h-40 rounded-full overflow-hidden cursor-pointer relative group border-4"
                  style={{ borderColor: typeColor }}
                >
                  {currentTrainer.avatar?.startsWith('data:') || currentTrainer.avatar?.startsWith('/') ? (
                    <img src={currentTrainer.avatar} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-7xl">
                      {currentTrainer.avatar || '🧑‍🦱'}
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 rounded-full">
                    <Camera className="w-8 h-8 text-white" />
                    <span className="text-xs text-white font-bold">Change Photo</span>
                  </div>
                </motion.div>
              </div>

              {/* Avatar picker modal */}
              <AnimatePresence>
                {showAvatarPicker && (
                  <>
                    <div className="fixed inset-0 z-40 bg-black/60" onClick={() => setShowAvatarPicker(false)} />
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9, y: 10 }}
                      className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[420px] bg-slate-900 border border-slate-700 rounded-2xl p-4 shadow-2xl"
                    >
                      <p className="font-bold text-sm mb-3 text-slate-300">Choose your avatar</p>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full mb-3 py-2 px-4 border-2 border-dashed border-slate-600 hover:border-blue-500 rounded-xl text-sm text-slate-400 hover:text-blue-400 transition-all flex items-center justify-center gap-2"
                      >
                        <Upload className="w-4 h-4" /> Upload your own photo
                      </button>
                      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
                      <div className="grid grid-cols-6 gap-2">
                        {getAvatarOptions().map((opt) => (
                          <motion.button
                            key={opt.value}
                            whileHover={{ scale: 1.08 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleAvatarChange(opt.value)}
                            className={`aspect-square rounded-xl overflow-hidden border-2 transition-all ${currentTrainer.avatar === opt.value ? 'border-blue-500 shadow-lg shadow-blue-500/40' : 'border-slate-700 hover:border-slate-500'}`}
                          >
                            {opt.type === 'image' ? (
                              <img src={opt.value} alt="Avatar" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-slate-800 flex items-center justify-center text-2xl">{opt.value}</div>
                            )}
                          </motion.button>
                        ))}
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            {/* ── Trainer Identity ─────────────────────────── */}
            <div className="flex-1">
              {/* Name + level badge */}
              <div className="flex items-start justify-between mb-2 flex-wrap gap-3">
                <div>
                  <div className="flex items-center gap-3 mb-1 flex-wrap">
                    <h1 className="text-4xl font-black text-white">{currentTrainer.displayName}</h1>
                    <span
                      className="px-3 py-1 rounded-full text-sm font-black text-white"
                      style={{ background: typeColor, boxShadow: `0 0 12px ${typeColor}88` }}
                    >
                      LVL {trainerLevel}
                    </span>
                  </div>
                  <p className={`text-base font-bold ${titleColor} mb-1`}>{trainerTitle}</p>

                  {/* Username + rank badge */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-slate-400">@{currentTrainer.username}</span>
                    {rankInfo.isRainbow ? (
                      <span
                        className="px-2 py-0.5 rounded-full text-xs font-black"
                        style={{
                          background: 'linear-gradient(90deg,#ff6b6b,#ffd93d,#6bcb77,#4d96ff,#cc5de8)',
                          color: '#fff',
                          boxShadow: '0 0 8px rgba(255,150,50,0.6)',
                        }}
                      >
                        ★ {rankInfo.label}
                      </span>
                    ) : (
                      <span
                        className="px-2 py-0.5 rounded-full text-xs font-black"
                        style={{ color: rankInfo.color, border: `1px solid ${rankInfo.color}`, boxShadow: `0 0 6px ${rankInfo.color}55` }}
                      >
                        ★ {rankInfo.label}
                      </span>
                    )}
                  </div>
                </div>

                <div
                  className="px-4 py-2 rounded-xl text-sm"
                  style={{
                    background: 'rgba(0,0,0,0.4)',
                    border: `1px solid ${typeColor}44`,
                  }}
                >
                  <div className="flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-purple-400" />
                    <span className="font-bold text-white">{currentTrainer.balance.toFixed(3)} SOL</span>
                  </div>
                </div>
              </div>

              {currentTrainer.bio && (
                <p className="text-slate-300 mb-5 max-w-2xl">{currentTrainer.bio}</p>
              )}

              {/* ── Stats — Game Badge Style ─────────────────── */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {/* Wins */}
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  className="p-4 rounded-xl"
                  style={{
                    background: 'rgba(0,0,0,0.4)',
                    border: '1px solid rgba(74,222,128,0.35)',
                    boxShadow: '0 0 12px rgba(74,222,128,0.12)',
                  }}
                >
                  <div className="flex items-center gap-2 mb-1 text-green-400">
                    <Trophy className="w-4 h-4" />
                    <span className="text-xs font-semibold uppercase">Wins</span>
                  </div>
                  <p className="text-2xl font-black text-green-300">{wins}</p>
                </motion.div>

                {/* Losses */}
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  className="p-4 rounded-xl"
                  style={{
                    background: 'rgba(0,0,0,0.4)',
                    border: '1px solid rgba(248,113,113,0.25)',
                    boxShadow: '0 0 12px rgba(248,113,113,0.08)',
                  }}
                >
                  <div className="flex items-center gap-2 mb-1 text-red-400">
                    <Target className="w-4 h-4" />
                    <span className="text-xs font-semibold uppercase">Losses</span>
                  </div>
                  <p className="text-2xl font-black text-red-300">{currentTrainer.record.losses}</p>
                </motion.div>

                {/* P&L */}
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  className="p-4 rounded-xl"
                  style={{
                    background: 'rgba(0,0,0,0.4)',
                    border: isProfit ? '1px solid rgba(74,222,128,0.35)' : '1px solid rgba(248,113,113,0.35)',
                    boxShadow: isProfit ? '0 0 12px rgba(74,222,128,0.12)' : '0 0 12px rgba(248,113,113,0.12)',
                  }}
                >
                  <div className={`flex items-center gap-2 mb-1 ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
                    {isProfit ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    <span className="text-xs font-semibold uppercase">P&amp;L</span>
                  </div>
                  <p className={`text-2xl font-black ${isProfit ? 'text-green-300' : 'text-red-300'}`}>
                    {isProfit ? '+' : ''}{earnings.toFixed(3)}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">SOL</p>
                  <p className={`text-xs mt-0.5 ${isProfit ? 'text-green-500' : 'text-red-500'}`}>
                    {isProfit ? '+' : ''}${(earnings * SOL_PRICE_USD).toFixed(2)} USD
                  </p>
                </motion.div>

                {/* Partner Pokémon */}
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  className="p-4 rounded-xl flex flex-col items-center justify-center gap-1 relative overflow-hidden"
                  style={{
                    background: 'rgba(0,0,0,0.4)',
                    border: `1px solid ${typeColor}55`,
                    boxShadow: `0 0 16px ${typeColor}22`,
                  }}
                >
                  <div className="absolute inset-0 opacity-10 pointer-events-none"
                    style={{ background: `radial-gradient(circle, ${typeColor}, transparent)` }} />
                  <div className="flex items-center gap-2 mb-1 relative z-10" style={{ color: typeColor }}>
                    <Heart className="w-4 h-4 fill-current" />
                    <span className="text-xs font-semibold uppercase">Partner</span>
                  </div>
                  <motion.img
                    src={getPokemonSpriteUrl(currentTrainer.favoritePokemon.id)}
                    alt={currentTrainer.favoritePokemon.name}
                    className="w-20 h-20 object-contain relative z-10"
                    style={{ imageRendering: 'pixelated', filter: `drop-shadow(0 0 8px ${typeColor})` }}
                    animate={{ y: [0, -5, 0] }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                  />
                  <p className="text-xs font-bold relative z-10 text-white">{currentTrainer.favoritePokemon.name}</p>
                </motion.div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── Gym Badges ─────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="rounded-2xl p-6"
          style={{
            background: 'rgba(15,15,25,0.65)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <h2 className="text-xl font-bold flex items-center gap-2 mb-5">
            <span className="text-2xl">🏅</span>
            Gym Badges
            <span className="ml-auto text-sm font-normal text-slate-400">{Math.min(8, Math.floor(wins / 5))}/8 earned</span>
          </h2>
          <div className="grid grid-cols-4 md:grid-cols-8 gap-4">
            {GYM_BADGES.map((badge, idx) => {
              const earned = wins >= badge.wins;
              return (
                <motion.div
                  key={badge.name}
                  whileHover={{ scale: earned ? 1.1 : 1.03 }}
                  className="flex flex-col items-center gap-2"
                  title={earned ? badge.name : `${badge.name} — Win ${badge.wins} battles to unlock`}
                >
                  <div className="relative">
                    {earned && (
                      <motion.div
                        className="absolute inset-0 rounded-full blur-md"
                        style={{ background: typeColor, opacity: 0.5 }}
                        animate={{ opacity: [0.35, 0.65, 0.35] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      />
                    )}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={badge.file}
                      alt={badge.name}
                      className="w-14 h-14 object-contain relative z-10 transition-all duration-300"
                      style={earned ? {} : { filter: 'grayscale(100%) brightness(0.25)', opacity: 0.5 }}
                    />
                  </div>
                  <p className={`text-xs font-bold text-center leading-tight ${earned ? 'text-yellow-300' : 'text-slate-600'}`}>
                    {badge.name.replace(' Badge', '')}
                  </p>
                </motion.div>
              );
            })}
          </div>
          {wins < 5 && (
            <p className="text-center text-xs text-slate-500 mt-4">Win 5 battles to earn your first badge!</p>
          )}
        </motion.div>

        {/* ── Battle Funds (Wallet) ─────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl overflow-hidden mb-6"
          style={{
            background: 'rgba(15,15,25,0.65)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          {/* Wallet header with paired action buttons */}
          <div className="p-6 border-b border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Wallet className="w-5 h-5 text-purple-400" />
                Battle Funds
              </h2>
              <p className="text-sm text-slate-400 mt-0.5">
                Balance: <span className="font-bold text-white">{currentTrainer.balance.toFixed(4)} SOL</span>
                {!testingMode && (
                  <span className="text-slate-500 ml-2">≈ ${(currentTrainer.balance * SOL_PRICE_USD).toFixed(2)} USD</span>
                )}
              </p>
            </div>

            {/* Paired deposit / withdraw CTAs */}
            <div className="flex gap-2">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => openWalletView('deposit')}
                className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${
                  walletView === 'deposit'
                    ? 'text-white shadow-lg shadow-purple-500/40'
                    : 'bg-slate-800 border border-slate-700 text-slate-300 hover:border-purple-500/60 hover:text-purple-300'
                }`}
                style={walletView === 'deposit' ? {
                  background: 'linear-gradient(135deg,#7c3aed,#6d28d9)',
                } : {}}
              >
                <ArrowDown className="w-4 h-4" />
                Add Battle Funds
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => openWalletView('withdraw')}
                disabled={testingMode}
                title={testingMode ? 'Withdrawals disabled in testing mode' : undefined}
                className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed ${
                  walletView === 'withdraw'
                    ? 'text-white shadow-lg shadow-orange-500/40'
                    : 'bg-slate-800 border border-slate-700 text-slate-300 hover:border-orange-500/60 hover:text-orange-300'
                }`}
                style={walletView === 'withdraw' ? {
                  background: 'linear-gradient(135deg,#ea580c,#c2410c)',
                } : {}}
              >
                <ArrowDown className="w-4 h-4 rotate-180" />
                Withdraw Winnings
              </motion.button>
            </div>
          </div>

          {/* ── Deposit Panel ── */}
          <AnimatePresence>
            {walletView === 'deposit' && (
              <motion.div
                key="deposit"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="p-6">
                  {testingMode ? (
                    <div className="bg-green-950/30 border-2 border-green-500/50 rounded-xl p-8">
                      <p className="text-green-400 font-bold text-2xl mb-3">🎮 Testing Mode Active</p>
                      <p className="text-slate-300 text-lg mb-4">Your account has unlimited funds for testing purposes.</p>
                      <div className="bg-slate-900/50 rounded-lg p-4">
                        <p className="text-sm text-slate-400 mb-2">Current Balance</p>
                        <p className="text-4xl font-black text-green-400">{currentTrainer.balance.toLocaleString()} SOL</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="bg-purple-950/30 border-2 border-purple-500/50 rounded-xl p-6 mb-4">
                        <p className="text-slate-300 mb-4 text-lg">
                          Send <span className="font-bold text-purple-400">SOL</span> to your Arena 151 wallet address:
                        </p>
                        <div className="bg-slate-900/80 rounded-lg p-6 border border-slate-700 mb-4">
                          <p className="text-xs text-slate-500 mb-3 uppercase font-semibold">Your Wallet Address</p>
                          <div className="flex items-center gap-3">
                            <code className="flex-1 font-mono text-lg text-slate-200 break-all">
                              {currentTrainer.internalWalletId}
                            </code>
                            <button
                              onClick={copyAddress}
                              className="flex-shrink-0 px-6 py-3 bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors flex items-center gap-2 font-bold"
                            >
                              {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                              <span>{copied ? 'Copied!' : 'Copy'}</span>
                            </button>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                          <div className="bg-slate-900/50 rounded-lg p-4">
                            <p className="text-purple-300 font-bold mb-1">⚠️ SOL ONLY</p>
                            <p className="text-slate-400">Do not send other tokens</p>
                          </div>
                          <div className="bg-slate-900/50 rounded-lg p-4">
                            <p className="text-purple-300 font-bold mb-1">💰 Min Deposit</p>
                            <p className="text-slate-400">0.01 SOL</p>
                          </div>
                          <div className="bg-slate-900/50 rounded-lg p-4">
                            <p className="text-purple-300 font-bold mb-1">⚡ Confirmation</p>
                            <p className="text-slate-400">~1 minute</p>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Withdraw Panel ── */}
          <AnimatePresence>
            {walletView === 'withdraw' && (
              <motion.div
                key="withdraw"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="p-6">
                  {/* ── Success state ── */}
                  {withdrawStep === 'success' && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="text-center py-10"
                    >
                      <div className="text-6xl mb-4">✅</div>
                      <h3 className="text-2xl font-black mb-2">Withdrawal Submitted</h3>
                      <p className="text-slate-400 mb-1">
                        <span className="font-bold text-white">{parsedAmount.toFixed(4)} SOL</span> sent to
                      </p>
                      <p className="font-mono text-sm text-slate-400 break-all max-w-md mx-auto mb-6">{withdrawAddr}</p>
                      <p className="text-slate-500 text-sm mb-8">You received {netAmount.toFixed(4)} SOL after the {WITHDRAWAL_FEE_SOL} SOL network fee.</p>
                      <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={handleWithdrawClose}
                        className="px-8 py-3 bg-slate-700 hover:bg-slate-600 rounded-xl font-bold transition-all"
                      >
                        Done
                      </motion.button>
                    </motion.div>
                  )}

                  {/* ── Confirm step ── */}
                  {withdrawStep === 'confirm' && (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                      {/* Big warning banner */}
                      <div className="bg-red-950/40 border-2 border-red-500/70 rounded-xl p-5 mb-6">
                        <div className="flex items-start gap-3">
                          <ShieldAlert className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="font-black text-red-400 text-lg mb-2">⚠️ Review carefully before confirming</p>
                            <ul className="text-sm text-red-300/90 space-y-1.5">
                              <li>• <strong>This withdrawal is SOL only.</strong> No other tokens are supported.</li>
                              <li>• You are responsible for confirming the destination address is correct.</li>
                              <li>• Sending to the wrong address is <strong>irreversible</strong>.</li>
                              <li>• Network fees are deducted automatically from your withdrawal amount.</li>
                              <li>• Arena 151 is not liable for funds sent to incorrect addresses.</li>
                            </ul>
                          </div>
                        </div>
                      </div>

                      {/* Summary card */}
                      <div className="bg-slate-900/80 border border-slate-700 rounded-xl p-5 mb-6 space-y-4">
                        <h3 className="font-bold text-slate-300 uppercase text-xs tracking-widest">Withdrawal Summary</h3>

                        <div>
                          <p className="text-xs text-slate-500 mb-1">Destination Address</p>
                          <p className="font-mono text-sm text-slate-200 break-all bg-slate-800/60 rounded-lg px-3 py-2">{withdrawAddr}</p>
                        </div>

                        <div className="grid grid-cols-3 gap-3 text-center">
                          <div className="bg-slate-800/60 rounded-lg p-3">
                            <p className="text-xs text-slate-500 mb-1">You Send</p>
                            <p className="font-black text-white">{parsedAmount.toFixed(4)}</p>
                            <p className="text-xs text-slate-400">SOL</p>
                          </div>
                          <div className="bg-slate-800/60 rounded-lg p-3">
                            <p className="text-xs text-slate-500 mb-1">Network Fee</p>
                            <p className="font-black text-orange-400">− {WITHDRAWAL_FEE_SOL}</p>
                            <p className="text-xs text-slate-400">SOL</p>
                          </div>
                          <div className="bg-slate-800/60 rounded-lg p-3 border border-green-500/30">
                            <p className="text-xs text-slate-500 mb-1">You Receive</p>
                            <p className="font-black text-green-400">{netAmount.toFixed(4)}</p>
                            <p className="text-xs text-slate-400">SOL</p>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <motion.button
                          whileTap={{ scale: 0.97 }}
                          onClick={() => setWithdrawStep('form')}
                          className="flex-1 py-3 rounded-xl border border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200 font-bold transition-all"
                        >
                          ← Go Back
                        </motion.button>
                        <motion.button
                          whileTap={{ scale: 0.97 }}
                          onClick={handleWithdrawConfirm}
                          className="flex-1 py-3 rounded-xl font-black text-white transition-all shadow-lg shadow-orange-500/30"
                          style={{ background: 'linear-gradient(135deg,#ea580c,#c2410c)' }}
                        >
                          Confirm Withdrawal
                        </motion.button>
                      </div>
                    </motion.div>
                  )}

                  {/* ── Form step ── */}
                  {withdrawStep === 'form' && (
                    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
                      {/* SOL-only notice */}
                      <div className="bg-orange-950/30 border border-orange-500/40 rounded-xl p-4 mb-5 flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-orange-200/80">
                          <p className="font-bold text-orange-300 mb-1">SOL Withdrawals Only</p>
                          <p>You must send to a valid <strong>Solana (SOL) wallet address</strong>. Sending to any other network will result in permanent loss of funds. You are responsible for verifying the destination address.</p>
                        </div>
                      </div>

                      {/* Destination address */}
                      <div className="mb-4">
                        <label className="block text-sm font-bold text-slate-300 mb-2">
                          Destination SOL Wallet Address
                        </label>
                        <input
                          type="text"
                          value={withdrawAddr}
                          onChange={(e) => setWithdrawAddr(e.target.value)}
                          placeholder="Enter a valid Solana wallet address"
                          className="w-full bg-slate-900/80 border border-slate-700 focus:border-orange-500/60 rounded-lg px-4 py-3 font-mono text-sm text-slate-200 placeholder:text-slate-600 outline-none transition-colors"
                        />
                      </div>

                      {/* Amount */}
                      <div className="mb-4">
                        <label className="block text-sm font-bold text-slate-300 mb-2">
                          Amount to Withdraw (SOL)
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            value={withdrawAmount}
                            onChange={(e) => setWithdrawAmount(e.target.value)}
                            placeholder={`Min ${minAmountRequired.toFixed(4)} SOL`}
                            min={minAmountRequired}
                            max={currentTrainer.balance}
                            step="0.0001"
                            className="w-full bg-slate-900/80 border border-slate-700 focus:border-orange-500/60 rounded-lg px-4 py-3 text-slate-200 placeholder:text-slate-600 outline-none transition-colors pr-24"
                          />
                          <button
                            onClick={() => setWithdrawAmount((currentTrainer.balance - WITHDRAWAL_FEE_SOL).toFixed(4))}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-orange-400 hover:text-orange-300 font-bold transition-colors"
                          >
                            MAX
                          </button>
                        </div>
                      </div>

                      {/* Live fee / net preview */}
                      {parsedAmount > 0 && (
                        <div className="grid grid-cols-3 gap-2 mb-4 text-center text-xs">
                          <div className="bg-slate-800/60 rounded-lg p-2.5">
                            <p className="text-slate-500 mb-0.5">You Send</p>
                            <p className="font-bold text-white">{parsedAmount.toFixed(4)} SOL</p>
                          </div>
                          <div className="bg-slate-800/60 rounded-lg p-2.5">
                            <p className="text-slate-500 mb-0.5">Network Fee</p>
                            <p className="font-bold text-orange-400">− {WITHDRAWAL_FEE_SOL} SOL</p>
                          </div>
                          <div className="bg-slate-800/60 rounded-lg p-2.5">
                            <p className="text-slate-500 mb-0.5">You Receive</p>
                            <p className={`font-bold ${netAmount >= MIN_WITHDRAWAL_SOL ? 'text-green-400' : 'text-red-400'}`}>
                              {netAmount.toFixed(4)} SOL
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Rules notice */}
                      <div className="bg-slate-800/40 rounded-lg p-4 mb-5 text-xs text-slate-400 space-y-1">
                        <p>• <strong className="text-slate-300">Minimum withdrawal:</strong> ${MIN_WITHDRAWAL_USD} USD equivalent (~{MIN_WITHDRAWAL_SOL.toFixed(4)} SOL after fees)</p>
                        <p>• <strong className="text-slate-300">Network fee:</strong> {WITHDRAWAL_FEE_SOL} SOL, automatically deducted from your withdrawal</p>
                        <p>• <strong className="text-slate-300">Your balance:</strong> {currentTrainer.balance.toFixed(4)} SOL available</p>
                      </div>

                      {/* Error */}
                      {withdrawError && (
                        <div className="bg-red-950/30 border border-red-500/50 rounded-lg p-3 mb-4 text-sm text-red-300 flex items-start gap-2">
                          <X className="w-4 h-4 flex-shrink-0 mt-0.5" />
                          {withdrawError}
                        </div>
                      )}

                      <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={handleWithdrawNext}
                        className="w-full py-3 rounded-xl font-black text-white transition-all shadow-lg shadow-orange-500/30"
                        style={{ background: 'linear-gradient(135deg,#ea580c,#c2410c)' }}
                      >
                        Review Withdrawal →
                      </motion.button>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* ── Recent Battles ─────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-2xl overflow-hidden"
          style={{
            background: 'rgba(15,15,25,0.65)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div className="p-6 border-b border-white/5">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-400" />
              Recent Battles
            </h2>
          </div>

          <div className="divide-y divide-white/5">
            {MOCK_BATTLES.map((battle, idx) => {
              const isWin = battle.result === 'win';
              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.25 + idx * 0.07 }}
                  className="flex items-center justify-between px-6 py-4"
                  style={{
                    borderLeft: isWin
                      ? '3px solid rgba(74,222,128,0.7)'
                      : '3px solid rgba(248,113,113,0.7)',
                    boxShadow: isWin
                      ? 'inset 4px 0 12px rgba(74,222,128,0.06)'
                      : 'inset 4px 0 12px rgba(248,113,113,0.06)',
                  }}
                >
                  <div className="flex items-center gap-4">
                    <span className="text-xl">{isWin ? '🏆' : '💀'}</span>
                    <div>
                      <p className="font-bold text-white text-sm">vs {battle.opponent}</p>
                    </div>
                  </div>
                  <span
                    className={`text-xs font-black px-3 py-1 rounded-full ${
                      isWin ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'
                    }`}
                  >
                    {isWin ? 'WIN' : 'LOSS'}
                  </span>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

      </div>
    </div>
  );
}
