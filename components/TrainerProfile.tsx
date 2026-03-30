'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy, Target, Wallet, ArrowLeft, Copy, Check, LogOut, Camera, Upload,
  AlertTriangle, ArrowDown, X, TrendingUp, TrendingDown, ShieldAlert, Star, Swords,
} from 'lucide-react';
import { useArenaStore } from '@/lib/store';
import { TYPE_COLORS } from '@/lib/constants';
import { getPokemonSpriteUrl } from '@/lib/pokemon-data';
import { clearSession, updateUser } from '@/lib/auth';
import { getAvatarOptions } from '@/lib/trainer-avatars';

const SOL_PRICE_USD = 150;
const WITHDRAWAL_FEE_SOL = 0.001;
const MIN_WITHDRAWAL_USD = 5;
const MIN_WITHDRAWAL_SOL = MIN_WITHDRAWAL_USD / SOL_PRICE_USD;
const isValidSolAddress = (addr: string) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr.trim());

type WalletView = 'deposit' | 'withdraw' | null;
type WithdrawStep = 'form' | 'confirm' | 'success';

function getTrainerLevel(wins: number) { return Math.min(99, Math.floor(wins / 5) + 1); }
function getTrainerTitle(wins: number) {
  if (wins >= 30) return 'Champion';
  if (wins >= 15) return 'Elite Contender';
  if (wins >= 5) return 'Gym Challenger';
  return 'Rookie Trainer';
}
function getTitleColor(wins: number) {
  if (wins >= 30) return '#d97706';
  if (wins >= 15) return '#0891b2';
  if (wins >= 5) return '#7c3aed';
  return '#94a3b8';
}

const GYM_BADGES = [
  { name: 'Boulder Badge', file: '/BoulderBadge.png', wins: 5   },
  { name: 'Cascade Badge', file: '/CascadeBadge.png', wins: 19  },
  { name: 'Thunder Badge', file: '/ThunderBadge.png', wins: 33  },
  { name: 'Rainbow Badge', file: '/RainbowBadge.png', wins: 47  },
  { name: 'Soul Badge',    file: '/SoulBadge.png',    wins: 61  },
  { name: 'Marsh Badge',   file: '/MarshBadge.png',   wins: 75  },
  { name: 'Volcano Badge', file: '/VolcanoBadge.png', wins: 89  },
  { name: 'Earth Badge',   file: '/EarthBadge.png',   wins: 100 },
];

const MOCK_BATTLES = [
  { opponent: 'TrainerRed',   result: 'win'  as const, room: 'Indigo Plateau' },
  { opponent: 'GaryOak',      result: 'loss' as const, room: 'Cerulean Arena' },
  { opponent: 'MistyW',       result: 'win'  as const, room: 'Viridian Gym'   },
  { opponent: 'BrockS',       result: 'loss' as const, room: 'Pewter City'    },
  { opponent: 'DragonTamer',  result: 'win'  as const, room: 'Victory Road'   },
];

// Badge colours keyed by filename
const BADGE_COLORS: Record<string, string> = {
  '/BoulderBadge.png': '#a8a878', // rock/grey
  '/CascadeBadge.png': '#6890f0', // water blue
  '/ThunderBadge.png': '#f8d030', // electric yellow
  '/RainbowBadge.png': '#f85888', // poison/pink
  '/SoulBadge.png':    '#a040a0', // poison purple
  '/MarshBadge.png':   '#f08030', // ground orange
  '/VolcanoBadge.png': '#f08030', // fire orange-red
  '/EarthBadge.png':   '#705898', // ground/dark
};

function BadgeTile({ badge, earned, typeColor }: { badge: typeof GYM_BADGES[0]; earned: boolean; typeColor: string }) {
  const [hovered, setHovered] = useState(false);
  const badgeColor = BADGE_COLORS[badge.file] ?? typeColor;
  const showGlow = earned || hovered;

  return (
    <motion.div
      className="flex flex-col items-center justify-center gap-1.5 py-2"
      whileHover={{ scale: 1.1 }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      title={earned ? badge.name : `${badge.name} — ${badge.wins} wins to unlock`}
    >
      <div className="relative flex items-center justify-center">
        {showGlow && (
          <motion.div
            className="absolute inset-0 rounded-full blur-md"
            style={{ background: badgeColor }}
            initial={{ opacity: 0 }}
            animate={{ opacity: earned ? [0.4, 0.7, 0.4] : 0.35 }}
            transition={earned ? { duration: 2, repeat: Infinity } : { duration: 0.2 }}
          />
        )}
        <img
          src={badge.file}
          alt={badge.name}
          className="w-14 h-14 object-contain relative z-10 transition-all duration-200"
          style={earned
            ? {}
            : hovered
              ? { filter: `grayscale(0%) brightness(0.75) drop-shadow(0 0 6px ${badgeColor})`, opacity: 0.85 }
              : { filter: 'grayscale(100%) brightness(0.4)', opacity: 0.45 }
          }
        />
      </div>
      <p
        className="text-center font-bold leading-none"
        style={{ fontSize: '9px', color: earned ? '#d97706' : hovered ? badgeColor : '#94a3b8' }}
      >
        {badge.name.replace(' Badge', '')}
      </p>
    </motion.div>
  );
}

export default function TrainerProfile() {
  const { currentTrainer, setScreen, setTrainer, clearTrainer, testingMode } = useArenaStore();
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [badgeAnnouncement, setBadgeAnnouncement] = useState<number | null>(null);
  const prevWinsRef = useRef<number | null>(null);

  if (currentTrainer && prevWinsRef.current === null) {
    const wins = currentTrainer.record.wins;
    const badgeIdx = GYM_BADGES.findIndex(b => wins === b.wins);
    if (badgeIdx !== -1) {
      const key = `badge_announced_${badgeIdx}`;
      if (typeof window !== 'undefined' && !sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, '1');
        setTimeout(() => setBadgeAnnouncement(badgeIdx), 800);
      }
    }
    prevWinsRef.current = wins;
  }

  const [walletView, setWalletView] = useState<WalletView>(null);
  const [copied, setCopied] = useState(false);
  const [withdrawAddr, setWithdrawAddr] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawStep, setWithdrawStep] = useState<WithdrawStep>('form');
  const [withdrawError, setWithdrawError] = useState('');

  const copyAddress = () => {
    if (!currentTrainer) return;
    navigator.clipboard.writeText(currentTrainer.internalWalletId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLogout = () => { clearSession(); clearTrainer(); setScreen('home'); };

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
    if (view === 'withdraw') { setWithdrawAddr(''); setWithdrawAmount(''); setWithdrawStep('form'); setWithdrawError(''); }
  };

  const parsedAmount = parseFloat(withdrawAmount) || 0;
  const netAmount = Math.max(0, parsedAmount - WITHDRAWAL_FEE_SOL);
  const minAmountRequired = MIN_WITHDRAWAL_SOL + WITHDRAWAL_FEE_SOL;

  const validateWithdraw = () => {
    if (!isValidSolAddress(withdrawAddr)) { setWithdrawError('Please enter a valid Solana wallet address.'); return false; }
    if (parsedAmount <= 0) { setWithdrawError('Please enter an amount.'); return false; }
    if (netAmount < MIN_WITHDRAWAL_SOL) { setWithdrawError(`Minimum withdrawal is $${MIN_WITHDRAWAL_USD} worth of SOL.`); return false; }
    if (!currentTrainer || parsedAmount > currentTrainer.balance) { setWithdrawError('Insufficient balance.'); return false; }
    setWithdrawError(''); return true;
  };

  const handleWithdrawNext = () => { if (validateWithdraw()) setWithdrawStep('confirm'); };
  const handleWithdrawConfirm = () => {
    if (!currentTrainer) return;
    const updated = { ...currentTrainer, balance: currentTrainer.balance - parsedAmount };
    setTrainer(updated); updateUser(currentTrainer.id, { balance: updated.balance });
    setWithdrawStep('success');
  };
  const handleWithdrawClose = () => {
    setWalletView(null); setWithdrawAddr(''); setWithdrawAmount('');
    setWithdrawStep('form'); setWithdrawError('');
  };

  if (!currentTrainer) return null;

  const wins = currentTrainer.record.wins;
  const losses = currentTrainer.record.losses;
  const total = wins + losses;
  const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
  const trainerTitle = getTrainerTitle(wins);
  const titleColor = getTitleColor(wins);
  const partnerType = currentTrainer.favoritePokemon.types[0];
  const typeColor = TYPE_COLORS[partnerType] ?? '#6366f1';
  const earnings = currentTrainer.earnings ?? 0;
  const isProfit = earnings >= 0;
  const earnedBadges = GYM_BADGES.filter(b => wins >= b.wins).length;
  const nextBadge = GYM_BADGES.find(b => wins < b.wins);
  const nextBadgeProgress = nextBadge ? Math.min(100, Math.round((wins / nextBadge.wins) * 100)) : 100;

  return (
    <div className="h-screen overflow-hidden flex flex-col"
      style={{ background: 'linear-gradient(135deg, #dbeafe 0%, #ede9fe 40%, #fce7f3 70%, #fef3c7 100%)' }}>

      {/* Badge Announcement */}
      <AnimatePresence>
        {badgeAnnouncement !== null && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={() => setBadgeAnnouncement(null)}>
            <motion.div initial={{ scale: 0.5 }} animate={{ scale: 1 }} exit={{ scale: 0.5, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className="text-center px-10 py-10 rounded-3xl max-w-sm mx-4 bg-white shadow-2xl border-4"
              style={{ borderColor: typeColor }} onClick={e => e.stopPropagation()}>
              <div className="text-5xl mb-3">🎉</div>
              <h2 className="text-3xl font-black text-slate-800 mb-1">BADGE EARNED!</h2>
              <img src={GYM_BADGES[badgeAnnouncement].file} alt="" className="w-24 h-24 mx-auto my-4 object-contain" />
              <p className="text-yellow-600 font-black text-xl mb-4">🏅 {GYM_BADGES[badgeAnnouncement].name}</p>
              <button onClick={() => setBadgeAnnouncement(null)}
                className="px-8 py-3 rounded-xl font-black text-white text-sm uppercase tracking-wide"
                style={{ background: `linear-gradient(135deg, ${typeColor}, #6366f1)` }}>Let's Go! ⚡</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Avatar Picker */}
      <AnimatePresence>
        {showAvatarPicker && (
          <>
            <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setShowAvatarPicker(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[420px] bg-white border border-slate-200 rounded-2xl p-4 shadow-2xl">
              <p className="font-bold text-sm mb-3 text-slate-700">Choose your avatar</p>
              <button onClick={() => fileInputRef.current?.click()}
                className="w-full mb-3 py-2 px-4 border-2 border-dashed border-slate-300 hover:border-blue-400 rounded-xl text-sm text-slate-500 hover:text-blue-500 transition-all flex items-center justify-center gap-2">
                <Upload className="w-4 h-4" /> Upload your own photo
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
              <div className="grid grid-cols-6 gap-2">
                {getAvatarOptions().map((opt) => (
                  <motion.button key={opt.value} whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.95 }}
                    onClick={() => handleAvatarChange(opt.value)}
                    className={`aspect-square rounded-xl overflow-hidden border-2 transition-all ${currentTrainer.avatar === opt.value ? 'border-blue-500' : 'border-slate-200 hover:border-slate-400'}`}>
                    {opt.type === 'image'
                      ? <img src={opt.value} alt="Avatar" className="w-full h-full object-cover" />
                      : <div className="w-full h-full bg-slate-100 flex items-center justify-center text-2xl">{opt.value}</div>}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Top nav ── */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2 shrink-0">
        <motion.button whileTap={{ scale: 0.97 }} onClick={() => setScreen('draft-mode-intro')}
          className="flex items-center gap-1.5 bg-white/60 backdrop-blur border border-white/80 px-3 py-1.5 rounded-xl text-slate-600 text-sm font-bold shadow-sm hover:bg-white transition-all">
          <ArrowLeft className="w-4 h-4" /> Arena
        </motion.button>
        <div />
        <motion.button whileTap={{ scale: 0.97 }} onClick={handleLogout}
          className="flex items-center gap-1.5 bg-white/60 backdrop-blur border border-white/80 px-3 py-1.5 rounded-xl text-slate-500 text-sm font-bold shadow-sm hover:text-red-500 hover:border-red-200 transition-all">
          <LogOut className="w-4 h-4" /> Sign Out
        </motion.button>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 overflow-hidden px-4 pb-4 grid grid-cols-5 gap-3 min-h-0">

        {/* ═══ LEFT COLUMN ═══ */}
        <div className="col-span-2 flex flex-col gap-3 min-h-0">

          {/* Trainer Hero Card */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl p-4 shadow-md border border-blue-100/80 flex flex-col items-center text-center relative overflow-hidden"
            style={{ background: 'linear-gradient(150deg, #eff6ff 0%, #e0f2fe 50%, #f0f9ff 100%)' }}>
            {/* Soft type glow behind avatar */}
            <div className="absolute inset-0 opacity-20 pointer-events-none"
              style={{ background: `radial-gradient(ellipse at 50% 0%, ${typeColor}, transparent 70%)` }} />

            {/* Avatar — big and prominent */}
            <div className="relative mb-3 z-10">
              <motion.div
                className="absolute inset-0 rounded-full"
                style={{ boxShadow: `0 0 20px 6px ${typeColor}55` }}
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2.5, repeat: Infinity }}
              />
              <motion.div whileHover={{ scale: 1.05 }} onClick={() => setShowAvatarPicker(true)}
                className="w-28 h-28 rounded-full overflow-hidden cursor-pointer relative group border-4 shadow-xl"
                style={{ borderColor: typeColor }}>
                {currentTrainer.avatar?.startsWith('data:') || currentTrainer.avatar?.startsWith('/') ? (
                  <img src={currentTrainer.avatar} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center text-5xl">
                    {currentTrainer.avatar || '🧑'}
                  </div>
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-full">
                  <Camera className="w-6 h-6 text-white" />
                </div>
              </motion.div>
            </div>

            {/* Name + level */}
            <div className="z-10 w-full">
              <div className="flex items-center justify-center gap-2 flex-wrap mb-0.5">
                <h1 className="text-xl font-black text-slate-800">{currentTrainer.displayName}</h1>
              </div>
              <p className="text-sm font-bold mb-0.5" style={{ color: titleColor }}>{trainerTitle}</p>
              <p className="text-xs text-slate-400 mb-3">@{currentTrainer.username}</p>

              {/* Partner + Win Rate inline */}
              <div className="flex items-center justify-center gap-3">
                <div className="flex items-center gap-1.5 bg-white/70 rounded-xl px-3 py-1.5 border border-white shadow-sm">
                  <motion.img
                    src={getPokemonSpriteUrl(currentTrainer.favoritePokemon.id)}
                    alt={currentTrainer.favoritePokemon.name}
                    className="w-8 h-8 object-contain"
                    style={{ imageRendering: 'pixelated', filter: `drop-shadow(0 0 4px ${typeColor})` }}
                    animate={{ y: [0, -3, 0] }} transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                  />
                  <span className="text-xs font-bold text-slate-600">{currentTrainer.favoritePokemon.name}</span>
                </div>
                <div className="flex items-center gap-1.5 bg-white/70 rounded-xl px-3 py-1.5 border border-white shadow-sm">
                  <Star className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-xs font-black text-slate-700">{winRate}% WR</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Stats */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            className="grid grid-cols-3 gap-2 shrink-0">
            <div className="rounded-xl p-3 text-center shadow-sm border border-green-100"
              style={{ background: 'linear-gradient(150deg, #f0fdf4, #dcfce7)' }}>
              <div className="flex items-center justify-center gap-1 mb-1">
                <Trophy className="w-3 h-3 text-green-500" />
                <span className="text-xs font-bold text-green-600 uppercase">Wins</span>
              </div>
              <p className="text-3xl font-black text-green-600">{wins}</p>
            </div>
            <div className="rounded-xl p-3 text-center shadow-sm border border-red-100"
              style={{ background: 'linear-gradient(150deg, #fff1f2, #ffe4e6)' }}>
              <div className="flex items-center justify-center gap-1 mb-1">
                <Target className="w-3 h-3 text-red-400" />
                <span className="text-xs font-bold text-red-500 uppercase">Losses</span>
              </div>
              <p className="text-3xl font-black text-red-500">{losses}</p>
            </div>
            <div className={`rounded-xl p-3 text-center shadow-sm border ${isProfit ? 'border-green-100' : 'border-red-100'}`}
              style={{ background: isProfit ? 'linear-gradient(150deg,#f0fdf4,#dcfce7)' : 'linear-gradient(150deg,#fff1f2,#ffe4e6)' }}>
              <div className={`flex items-center justify-center gap-1 mb-1 ${isProfit ? 'text-green-500' : 'text-red-400'}`}>
                {isProfit ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                <span className="text-xs font-bold uppercase">P&L</span>
              </div>
              <p className={`text-xl font-black ${isProfit ? 'text-green-600' : 'text-red-500'}`}>
                {isProfit ? '+' : ''}{earnings.toFixed(2)}
              </p>
              <p className="text-xs text-slate-400">SOL</p>
            </div>
          </motion.div>

          {/* Gym Badges */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="rounded-2xl p-4 shadow-md border border-purple-100/80 flex-1 flex flex-col"
            style={{ background: 'linear-gradient(150deg, #faf5ff 0%, #ede9fe 50%, #f5f3ff 100%)' }}>
            <div className="flex items-center justify-between mb-3 shrink-0">
              <span className="font-black text-slate-700 text-sm">🏅 Gym Badges</span>
              <span className="text-xs font-bold text-purple-400">{earnedBadges}/8 earned</span>
            </div>
            {/* Badge grid — 4 per row, centered, large */}
            <div className="grid grid-cols-4 gap-2 flex-1 content-center">
              {GYM_BADGES.map((badge) => {
                const earned = wins >= badge.wins;
                return (
                  <BadgeTile key={badge.name} badge={badge} earned={earned} typeColor={typeColor} />
                );
              })}
            </div>
            {/* Next badge progress bar */}
            {nextBadge && (
              <div className="mt-auto shrink-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-slate-500 font-bold">Next: {nextBadge.name}</span>
                  <span className="text-xs font-black" style={{ color: typeColor }}>{wins}/{nextBadge.wins}</span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-white/60 border border-white overflow-hidden">
                  <motion.div className="h-full rounded-full"
                    style={{ background: `linear-gradient(90deg, ${typeColor}, #a855f7)` }}
                    initial={{ width: 0 }}
                    animate={{ width: `${nextBadgeProgress}%` }}
                    transition={{ duration: 0.8, delay: 0.3, ease: 'easeOut' }} />
                </div>
              </div>
            )}
          </motion.div>
        </div>

        {/* ═══ RIGHT COLUMN ═══ */}
        <div className="col-span-3 flex flex-col gap-3 min-h-0">

          {/* Battle Funds */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            className="rounded-2xl shadow-md border border-pink-100/80 overflow-hidden shrink-0"
            style={{ background: 'linear-gradient(150deg, #fff1f2 0%, #fce7f3 50%, #fdf2f8 100%)' }}>
            <div className="px-4 py-3 flex items-center justify-between border-b border-pink-100">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-pink-400" />
                <span className="font-black text-slate-700 text-sm">Battle Funds</span>
                <span className="font-bold text-slate-600 text-sm">{currentTrainer.balance.toFixed(4)} SOL</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => openWalletView('deposit')}
                  className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all flex items-center gap-1 ${walletView === 'deposit' ? 'text-white shadow' : 'bg-white/70 text-slate-600 border border-pink-100 hover:border-purple-300 hover:text-purple-600'}`}
                  style={walletView === 'deposit' ? { background: 'linear-gradient(135deg,#7c3aed,#6d28d9)' } : {}}>
                  <ArrowDown className="w-3 h-3" /> Deposit
                </button>
                <button onClick={() => openWalletView('withdraw')} disabled={testingMode}
                  className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all flex items-center gap-1 disabled:opacity-40 ${walletView === 'withdraw' ? 'text-white shadow' : 'bg-white/70 text-slate-600 border border-pink-100 hover:border-orange-300 hover:text-orange-600'}`}
                  style={walletView === 'withdraw' ? { background: 'linear-gradient(135deg,#ea580c,#c2410c)' } : {}}>
                  <ArrowDown className="w-3 h-3 rotate-180" /> Withdraw
                </button>
              </div>
            </div>

            <AnimatePresence>
              {walletView === 'deposit' && (
                <motion.div key="deposit" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <div className="p-4">
                    {testingMode ? (
                      <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
                        <p className="text-green-600 font-black">🎮 Testing Mode — {currentTrainer.balance.toLocaleString()} SOL</p>
                      </div>
                    ) : (
                      <div className="bg-white/60 border border-purple-100 rounded-xl p-3">
                        <p className="text-slate-500 text-xs mb-2">Send <span className="font-bold text-purple-600">SOL</span> to your Arena 151 wallet:</p>
                        <div className="bg-white rounded-lg p-2.5 border border-slate-100 flex items-center gap-2 mb-2">
                          <code className="flex-1 font-mono text-xs text-slate-600 break-all">{currentTrainer.internalWalletId}</code>
                          <button onClick={copyAddress} className="shrink-0 px-3 py-1.5 bg-purple-500 hover:bg-purple-400 rounded-lg text-white text-xs font-bold flex items-center gap-1">
                            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />} {copied ? 'Copied!' : 'Copy'}
                          </button>
                        </div>
                        <div className="flex gap-1.5 text-xs">
                          {['SOL only', 'Min 0.01 SOL', '~1 min'].map(t => (
                            <div key={t} className="flex-1 bg-white/80 rounded-lg p-1.5 text-center border border-purple-50">
                              <span className="text-purple-500 font-bold">{t}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {walletView === 'withdraw' && (
                <motion.div key="withdraw" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <div className="p-4">
                    {withdrawStep === 'success' && (
                      <div className="text-center py-2">
                        <div className="text-3xl mb-1">✅</div>
                        <p className="font-black text-slate-700 text-sm mb-1">Withdrawal Submitted</p>
                        <p className="text-xs text-slate-400 mb-2">{netAmount.toFixed(4)} SOL sent after fee</p>
                        <button onClick={handleWithdrawClose} className="px-5 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-xl font-bold text-sm">Done</button>
                      </div>
                    )}
                    {withdrawStep === 'confirm' && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        <div className="bg-red-50 border border-red-200 rounded-xl p-2.5 mb-2 text-xs text-red-500">
                          <p className="font-black mb-0.5">⚠️ Irreversible — verify address first</p>
                          <p className="font-mono break-all">{withdrawAddr}</p>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5 mb-2 text-center text-xs">
                          <div className="bg-white/60 rounded-lg p-2"><p className="text-slate-400">Send</p><p className="font-black text-slate-700">{parsedAmount.toFixed(4)}</p></div>
                          <div className="bg-white/60 rounded-lg p-2"><p className="text-slate-400">Fee</p><p className="font-black text-orange-500">−{WITHDRAWAL_FEE_SOL}</p></div>
                          <div className="bg-green-50 rounded-lg p-2 border border-green-200"><p className="text-slate-400">Get</p><p className="font-black text-green-600">{netAmount.toFixed(4)}</p></div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => setWithdrawStep('form')} className="flex-1 py-1.5 rounded-xl border border-slate-200 text-slate-500 font-bold text-xs">← Back</button>
                          <button onClick={handleWithdrawConfirm} className="flex-1 py-1.5 rounded-xl font-black text-white text-xs" style={{ background: 'linear-gradient(135deg,#ea580c,#c2410c)' }}>Confirm</button>
                        </div>
                      </motion.div>
                    )}
                    {withdrawStep === 'form' && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        <div className="bg-orange-50 border border-orange-200 rounded-xl p-2.5 mb-2 flex gap-1.5 text-xs text-orange-600">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          <p><span className="font-bold">SOL only.</span> Wrong address = permanent loss.</p>
                        </div>
                        <input type="text" value={withdrawAddr} onChange={e => setWithdrawAddr(e.target.value)} placeholder="Solana wallet address"
                          className="w-full bg-white border border-slate-200 focus:border-orange-300 rounded-lg px-3 py-2 font-mono text-xs text-slate-700 placeholder:text-slate-300 outline-none mb-1.5 transition-colors" />
                        <div className="relative mb-1.5">
                          <input type="number" value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)}
                            placeholder={`Min ${minAmountRequired.toFixed(4)} SOL`}
                            className="w-full bg-white border border-slate-200 focus:border-orange-300 rounded-lg px-3 py-2 text-sm text-slate-700 placeholder:text-slate-300 outline-none transition-colors pr-12" />
                          <button onClick={() => setWithdrawAmount((currentTrainer.balance - WITHDRAWAL_FEE_SOL).toFixed(4))}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-orange-500 font-black">MAX</button>
                        </div>
                        {withdrawError && <div className="bg-red-50 border border-red-200 rounded-lg p-2 mb-1.5 text-xs text-red-500 flex gap-1"><X className="w-3 h-3 shrink-0 mt-0.5" />{withdrawError}</div>}
                        <button onClick={handleWithdrawNext} className="w-full py-2 rounded-xl font-black text-white text-sm" style={{ background: 'linear-gradient(135deg,#ea580c,#c2410c)' }}>Review →</button>
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Recent Battles — takes all remaining space */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="rounded-2xl shadow-md border border-rose-100/80 flex-1 flex flex-col overflow-hidden min-h-0"
            style={{ background: 'linear-gradient(150deg, #fff1f2 0%, #fce7f3 50%, #fdf2f8 100%)' }}>
            <div className="px-4 py-3 border-b border-pink-100 shrink-0 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Swords className="w-4 h-4 text-rose-400" />
                <span className="font-black text-slate-700 text-sm">Recent Battles</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span><span className="font-black text-green-500">{wins}W</span> · <span className="font-black text-red-400">{losses}L</span></span>
                <span className="font-black text-slate-600">{winRate}% win rate</span>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-pink-50">
              {MOCK_BATTLES.map((battle, idx) => {
                const isWin = battle.result === 'win';
                return (
                  <motion.div key={idx} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + idx * 0.06 }}
                    className="flex items-center justify-between px-4 py-4"
                    style={{ borderLeft: `4px solid ${isWin ? 'rgba(74,222,128,0.6)' : 'rgba(248,113,113,0.6)'}` }}>
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{isWin ? '🏆' : '💀'}</span>
                      <div>
                        <p className="font-black text-slate-700">vs {battle.opponent}</p>
                        <p className="text-xs text-slate-400">{battle.room}</p>
                      </div>
                    </div>
                    <span className={`text-xs font-black px-3 py-1.5 rounded-full ${isWin ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-500'}`}>
                      {isWin ? 'WIN' : 'LOSS'}
                    </span>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>

        </div>
      </div>
    </div>
  );
}
