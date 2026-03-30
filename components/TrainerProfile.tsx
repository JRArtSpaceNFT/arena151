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
  if (wins >= 30) return 'text-yellow-600';
  if (wins >= 15) return 'text-cyan-600';
  if (wins >= 5) return 'text-purple-600';
  return 'text-slate-500';
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
  { opponent: 'TrainerRed', result: 'win' as const },
  { opponent: 'GaryOak', result: 'loss' as const },
  { opponent: 'MistyW', result: 'win' as const },
  { opponent: 'BrockS', result: 'loss' as const },
  { opponent: 'DragonTamer', result: 'win' as const },
];

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

  const handleLogout = () => {
    clearSession();
    clearTrainer();
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
    if (view === 'withdraw') {
      setWithdrawAddr(''); setWithdrawAmount('');
      setWithdrawStep('form'); setWithdrawError('');
    }
  };

  const parsedAmount = parseFloat(withdrawAmount) || 0;
  const netAmount = Math.max(0, parsedAmount - WITHDRAWAL_FEE_SOL);
  const minAmountRequired = MIN_WITHDRAWAL_SOL + WITHDRAWAL_FEE_SOL;

  const validateWithdraw = () => {
    if (!isValidSolAddress(withdrawAddr)) { setWithdrawError('Please enter a valid Solana wallet address.'); return false; }
    if (parsedAmount <= 0) { setWithdrawError('Please enter an amount to withdraw.'); return false; }
    if (netAmount < MIN_WITHDRAWAL_SOL) { setWithdrawError(`Minimum withdrawal is $${MIN_WITHDRAWAL_USD} worth of SOL. Net after fee would be ${netAmount.toFixed(4)} SOL.`); return false; }
    if (!currentTrainer || parsedAmount > currentTrainer.balance) { setWithdrawError('Insufficient balance.'); return false; }
    setWithdrawError(''); return true;
  };

  const handleWithdrawNext = () => { if (validateWithdraw()) setWithdrawStep('confirm'); };
  const handleWithdrawConfirm = () => {
    if (!currentTrainer) return;
    const updated = { ...currentTrainer, balance: currentTrainer.balance - parsedAmount };
    setTrainer(updated);
    updateUser(currentTrainer.id, { balance: updated.balance });
    setWithdrawStep('success');
  };
  const handleWithdrawClose = () => {
    setWalletView(null);
    setWithdrawAddr(''); setWithdrawAmount('');
    setWithdrawStep('form'); setWithdrawError('');
  };

  if (!currentTrainer) return null;

  const wins = currentTrainer.record.wins;
  const trainerLevel = getTrainerLevel(wins);
  const trainerTitle = getTrainerTitle(wins);
  const titleColor = getTitleColor(wins);
  const partnerType = currentTrainer.favoritePokemon.types[0];
  const typeColor = TYPE_COLORS[partnerType] ?? '#6366f1';
  const earnings = currentTrainer.earnings ?? 0;
  const isProfit = earnings >= 0;
  const earnedBadges = GYM_BADGES.filter(b => wins >= b.wins).length;

  return (
    <div
      className="h-screen overflow-hidden relative flex flex-col"
      style={{
        background: 'linear-gradient(160deg, #e0f2fe 0%, #bae6fd 25%, #ddd6fe 60%, #fce7f3 100%)',
      }}
    >
      {/* Subtle cloud/pokeball decorations */}
      <div className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-20 pointer-events-none"
        style={{ background: `radial-gradient(circle, ${typeColor}, transparent)`, transform: 'translate(30%, -30%)' }} />
      <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full opacity-15 pointer-events-none"
        style={{ background: 'radial-gradient(circle, #818cf8, transparent)', transform: 'translate(-30%, 30%)' }} />

      {/* Badge Announcement Overlay */}
      <AnimatePresence>
        {badgeAnnouncement !== null && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
            onClick={() => setBadgeAnnouncement(null)}
          >
            <motion.div
              initial={{ scale: 0.5, y: 60 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.5, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className="text-center px-10 py-10 rounded-3xl max-w-sm mx-4 bg-white shadow-2xl border-4"
              style={{ borderColor: typeColor }}
              onClick={e => e.stopPropagation()}
            >
              <div className="text-5xl mb-3">🎉</div>
              <h2 className="text-3xl font-black text-slate-800 mb-1">BADGE EARNED!</h2>
              <img src={GYM_BADGES[badgeAnnouncement].file} alt="" className="w-24 h-24 mx-auto my-4 object-contain" />
              <p className="text-yellow-600 font-black text-xl mb-4">🏅 {GYM_BADGES[badgeAnnouncement].name}</p>
              <button onClick={() => setBadgeAnnouncement(null)}
                className="px-8 py-3 rounded-xl font-black text-white text-sm uppercase tracking-wide"
                style={{ background: `linear-gradient(135deg, ${typeColor}, #6366f1)` }}>
                Let's Go! ⚡
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Avatar Picker Modal */}
      <AnimatePresence>
        {showAvatarPicker && (
          <>
            <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setShowAvatarPicker(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[420px] bg-white border border-slate-200 rounded-2xl p-4 shadow-2xl"
            >
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

      {/* ── Top nav bar ──────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2 shrink-0">
        <motion.button whileTap={{ scale: 0.97 }} onClick={() => setScreen('draft-mode-intro')}
          className="flex items-center gap-1.5 bg-white/70 backdrop-blur border border-white/80 px-3 py-1.5 rounded-xl text-slate-700 text-sm font-bold shadow-sm hover:bg-white transition-all">
          <ArrowLeft className="w-4 h-4" /> Arena
        </motion.button>
        <div className="flex items-center gap-2 bg-white/60 backdrop-blur border border-white/80 px-3 py-1.5 rounded-xl shadow-sm">
          <Wallet className="w-4 h-4 text-purple-500" />
          <span className="font-black text-slate-800 text-sm">{currentTrainer.balance.toFixed(3)} SOL</span>
          {!testingMode && <span className="text-xs text-slate-400">≈ ${(currentTrainer.balance * SOL_PRICE_USD).toFixed(0)}</span>}
        </div>
        <motion.button whileTap={{ scale: 0.97 }} onClick={handleLogout}
          className="flex items-center gap-1.5 bg-white/70 backdrop-blur border border-white/80 px-3 py-1.5 rounded-xl text-slate-500 text-sm font-bold shadow-sm hover:text-red-500 hover:border-red-300 transition-all">
          <LogOut className="w-4 h-4" /> Out
        </motion.button>
      </div>

      {/* ── Main content — two columns ──────────────────── */}
      <div className="flex-1 overflow-hidden px-4 pb-3 grid grid-cols-5 gap-3 min-h-0">

        {/* LEFT COLUMN — Avatar + Stats + Badges */}
        <div className="col-span-2 flex flex-col gap-2.5 min-h-0">

          {/* Trainer card */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="bg-white/70 backdrop-blur-md border border-white/90 rounded-2xl p-4 shadow-md flex items-center gap-4">
            {/* Avatar */}
            <div className="relative shrink-0">
              <motion.div whileHover={{ scale: 1.05 }} onClick={() => setShowAvatarPicker(true)}
                className="w-20 h-20 rounded-2xl overflow-hidden cursor-pointer relative group border-4 shadow-lg"
                style={{ borderColor: typeColor }}>
                {currentTrainer.avatar?.startsWith('data:') || currentTrainer.avatar?.startsWith('/') ? (
                  <img src={currentTrainer.avatar} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center text-4xl">
                    {currentTrainer.avatar || '🧑'}
                  </div>
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl">
                  <Camera className="w-5 h-5 text-white" />
                </div>
              </motion.div>
            </div>
            {/* Identity */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-black text-slate-800 truncate">{currentTrainer.displayName}</h1>
                <span className="px-2 py-0.5 rounded-full text-xs font-black text-white shadow" style={{ background: typeColor }}>
                  LVL {trainerLevel}
                </span>
              </div>
              <p className={`text-xs font-bold ${titleColor}`}>{trainerTitle}</p>
              <p className="text-xs text-slate-400">@{currentTrainer.username}</p>
              {currentTrainer.bio && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{currentTrainer.bio}</p>}
            </div>
            {/* Partner */}
            <div className="shrink-0 flex flex-col items-center">
              <motion.img
                src={getPokemonSpriteUrl(currentTrainer.favoritePokemon.id)}
                alt={currentTrainer.favoritePokemon.name}
                className="w-16 h-16 object-contain"
                style={{ imageRendering: 'pixelated', filter: `drop-shadow(0 0 6px ${typeColor})` }}
                animate={{ y: [0, -4, 0] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
              />
              <p className="text-xs font-bold text-slate-600 mt-0.5">{currentTrainer.favoritePokemon.name}</p>
            </div>
          </motion.div>

          {/* Stats row */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            className="grid grid-cols-3 gap-2">
            {/* Wins */}
            <div className="bg-white/70 backdrop-blur border border-green-200 rounded-xl p-3 shadow-sm text-center">
              <div className="flex items-center justify-center gap-1 mb-1"><Trophy className="w-3.5 h-3.5 text-green-500" /><span className="text-xs font-bold text-green-600 uppercase">Wins</span></div>
              <p className="text-2xl font-black text-green-600">{wins}</p>
            </div>
            {/* Losses */}
            <div className="bg-white/70 backdrop-blur border border-red-200 rounded-xl p-3 shadow-sm text-center">
              <div className="flex items-center justify-center gap-1 mb-1"><Target className="w-3.5 h-3.5 text-red-400" /><span className="text-xs font-bold text-red-500 uppercase">Losses</span></div>
              <p className="text-2xl font-black text-red-500">{currentTrainer.record.losses}</p>
            </div>
            {/* P&L */}
            <div className={`bg-white/70 backdrop-blur border rounded-xl p-3 shadow-sm text-center ${isProfit ? 'border-green-200' : 'border-red-200'}`}>
              <div className={`flex items-center justify-center gap-1 mb-1 ${isProfit ? 'text-green-500' : 'text-red-400'}`}>
                {isProfit ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                <span className="text-xs font-bold uppercase">P&L</span>
              </div>
              <p className={`text-lg font-black ${isProfit ? 'text-green-600' : 'text-red-500'}`}>
                {isProfit ? '+' : ''}{earnings.toFixed(2)}
              </p>
              <p className="text-xs text-slate-400">SOL</p>
            </div>
          </motion.div>

          {/* Gym Badges */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="bg-white/70 backdrop-blur-md border border-white/90 rounded-2xl p-3 shadow-md flex-1">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-black text-slate-700">🏅 Gym Badges</h2>
              <span className="text-xs text-slate-400 font-bold">{earnedBadges}/8</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {GYM_BADGES.map((badge) => {
                const earned = wins >= badge.wins;
                return (
                  <motion.div key={badge.name} whileHover={{ scale: earned ? 1.12 : 1.03 }}
                    className="flex flex-col items-center gap-1" title={earned ? badge.name : `${badge.name} — ${badge.wins} wins`}>
                    <div className="relative">
                      {earned && (
                        <motion.div className="absolute inset-0 rounded-full blur-sm"
                          style={{ background: typeColor, opacity: 0.4 }}
                          animate={{ opacity: [0.3, 0.6, 0.3] }} transition={{ duration: 2, repeat: Infinity }} />
                      )}
                      <img src={badge.file} alt={badge.name}
                        className="w-10 h-10 object-contain relative z-10"
                        style={earned ? {} : { filter: 'grayscale(100%) brightness(0.4)', opacity: 0.5 }} />
                    </div>
                    <p className={`text-xs font-bold text-center leading-none ${earned ? 'text-yellow-600' : 'text-slate-400'}`} style={{ fontSize: '9px' }}>
                      {badge.name.replace(' Badge', '')}
                    </p>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        </div>

        {/* RIGHT COLUMN — Wallet + Recent Battles */}
        <div className="col-span-3 flex flex-col gap-2.5 min-h-0">

          {/* Battle Funds */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            className="bg-white/70 backdrop-blur-md border border-white/90 rounded-2xl shadow-md overflow-hidden">
            <div className="px-4 py-3 flex items-center justify-between border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-purple-500" />
                <span className="font-black text-slate-700 text-sm">Battle Funds</span>
                <span className="text-sm font-bold text-slate-800">{currentTrainer.balance.toFixed(4)} SOL</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => openWalletView('deposit')}
                  className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all flex items-center gap-1 ${walletView === 'deposit' ? 'text-white shadow' : 'bg-slate-100 text-slate-600 hover:bg-purple-50 hover:text-purple-600'}`}
                  style={walletView === 'deposit' ? { background: 'linear-gradient(135deg,#7c3aed,#6d28d9)' } : {}}>
                  <ArrowDown className="w-3 h-3" /> Deposit
                </button>
                <button onClick={() => openWalletView('withdraw')} disabled={testingMode}
                  className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all flex items-center gap-1 disabled:opacity-40 ${walletView === 'withdraw' ? 'text-white shadow' : 'bg-slate-100 text-slate-600 hover:bg-orange-50 hover:text-orange-600'}`}
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
                      <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                        <p className="text-green-600 font-black text-lg mb-1">🎮 Testing Mode</p>
                        <p className="text-slate-500 text-sm">Unlimited funds — {currentTrainer.balance.toLocaleString()} SOL</p>
                      </div>
                    ) : (
                      <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                        <p className="text-slate-600 text-sm mb-3">Send <span className="font-bold text-purple-600">SOL</span> to your Arena 151 wallet:</p>
                        <div className="bg-white rounded-lg p-3 border border-slate-200 flex items-center gap-2 mb-3">
                          <code className="flex-1 font-mono text-xs text-slate-700 break-all">{currentTrainer.internalWalletId}</code>
                          <button onClick={copyAddress} className="shrink-0 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 rounded-lg text-white text-xs font-bold flex items-center gap-1">
                            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />} {copied ? 'Copied!' : 'Copy'}
                          </button>
                        </div>
                        <div className="flex gap-2 text-xs">
                          <div className="flex-1 bg-white rounded-lg p-2 border border-slate-100 text-center"><p className="text-purple-500 font-bold">SOL only</p></div>
                          <div className="flex-1 bg-white rounded-lg p-2 border border-slate-100 text-center"><p className="text-purple-500 font-bold">Min 0.01 SOL</p></div>
                          <div className="flex-1 bg-white rounded-lg p-2 border border-slate-100 text-center"><p className="text-purple-500 font-bold">~1 min confirm</p></div>
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
                      <div className="text-center py-4">
                        <div className="text-4xl mb-2">✅</div>
                        <p className="font-black text-slate-700 mb-1">Withdrawal Submitted</p>
                        <p className="text-xs text-slate-400 mb-3">{netAmount.toFixed(4)} SOL sent after fee</p>
                        <button onClick={handleWithdrawClose} className="px-6 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl font-bold text-sm transition-all">Done</button>
                      </div>
                    )}
                    {withdrawStep === 'confirm' && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-3 text-xs text-red-600">
                          <p className="font-black mb-1">⚠️ Double-check your address — withdrawals are irreversible</p>
                          <p className="font-mono break-all text-red-500">{withdrawAddr}</p>
                        </div>
                        <div className="grid grid-cols-3 gap-2 mb-3 text-center text-xs">
                          <div className="bg-slate-50 rounded-lg p-2"><p className="text-slate-400">You send</p><p className="font-black text-slate-700">{parsedAmount.toFixed(4)} SOL</p></div>
                          <div className="bg-slate-50 rounded-lg p-2"><p className="text-slate-400">Fee</p><p className="font-black text-orange-500">−{WITHDRAWAL_FEE_SOL}</p></div>
                          <div className="bg-green-50 rounded-lg p-2 border border-green-200"><p className="text-slate-400">You get</p><p className="font-black text-green-600">{netAmount.toFixed(4)} SOL</p></div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => setWithdrawStep('form')} className="flex-1 py-2 rounded-xl border border-slate-200 text-slate-500 font-bold text-sm transition-all hover:border-slate-400">← Back</button>
                          <button onClick={handleWithdrawConfirm} className="flex-1 py-2 rounded-xl font-black text-white text-sm" style={{ background: 'linear-gradient(135deg,#ea580c,#c2410c)' }}>Confirm</button>
                        </div>
                      </motion.div>
                    )}
                    {withdrawStep === 'form' && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 mb-3 flex gap-2 text-xs text-orange-600">
                          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                          <p><span className="font-bold">SOL only.</span> Wrong address = permanent loss. Verify carefully.</p>
                        </div>
                        <input type="text" value={withdrawAddr} onChange={e => setWithdrawAddr(e.target.value)}
                          placeholder="Solana wallet address"
                          className="w-full bg-white border border-slate-200 focus:border-orange-400 rounded-lg px-3 py-2 font-mono text-xs text-slate-700 placeholder:text-slate-300 outline-none mb-2 transition-colors" />
                        <div className="relative mb-2">
                          <input type="number" value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)}
                            placeholder={`Min ${minAmountRequired.toFixed(4)} SOL`}
                            className="w-full bg-white border border-slate-200 focus:border-orange-400 rounded-lg px-3 py-2 text-sm text-slate-700 placeholder:text-slate-300 outline-none transition-colors pr-14" />
                          <button onClick={() => setWithdrawAmount((currentTrainer.balance - WITHDRAWAL_FEE_SOL).toFixed(4))}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-orange-500 font-black">MAX</button>
                        </div>
                        {withdrawError && <div className="bg-red-50 border border-red-200 rounded-lg p-2 mb-2 text-xs text-red-500 flex gap-1"><X className="w-3 h-3 shrink-0 mt-0.5" />{withdrawError}</div>}
                        <button onClick={handleWithdrawNext}
                          className="w-full py-2 rounded-xl font-black text-white text-sm" style={{ background: 'linear-gradient(135deg,#ea580c,#c2410c)' }}>
                          Review →
                        </button>
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Recent Battles */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="bg-white/70 backdrop-blur-md border border-white/90 rounded-2xl shadow-md overflow-hidden flex-1">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-yellow-500" />
              <span className="font-black text-slate-700 text-sm">Recent Battles</span>
            </div>
            <div className="divide-y divide-slate-100">
              {MOCK_BATTLES.map((battle, idx) => {
                const isWin = battle.result === 'win';
                return (
                  <motion.div key={idx} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + idx * 0.05 }}
                    className="flex items-center justify-between px-4 py-2.5"
                    style={{ borderLeft: `3px solid ${isWin ? 'rgba(74,222,128,0.7)' : 'rgba(248,113,113,0.7)'}` }}>
                    <div className="flex items-center gap-3">
                      <span className="text-base">{isWin ? '🏆' : '💀'}</span>
                      <span className="font-bold text-slate-700 text-sm">vs {battle.opponent}</span>
                    </div>
                    <span className={`text-xs font-black px-2.5 py-1 rounded-full ${isWin ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-500'}`}>
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
