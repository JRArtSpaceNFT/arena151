'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Target, Heart, Wallet, ArrowLeft, Copy, Check, LogOut, Camera, Upload, AlertTriangle, ArrowDown, X, ShieldAlert, TrendingUp, TrendingDown } from 'lucide-react';
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

export default function TrainerProfile() {
  const { currentTrainer, setScreen, setTrainer, clearTrainer, testingMode } = useArenaStore();

  // ── avatar picker ──
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  return (
    <div className="min-h-screen p-8 pokeball-pattern relative overflow-hidden">
      {/* Ambient effects */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-3xl" />

      <div className="relative z-10 max-w-5xl mx-auto">

        {/* Top nav */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="mb-6 flex items-center justify-between">
          <button
            onClick={() => setScreen('draft-mode-intro')}
            className="flex items-center gap-2 glass-panel px-4 py-2 rounded-lg hover:border-blue-500/50 transition-all"
          >
            <ArrowLeft className="w-5 h-5" />Back to Arena
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-700 text-slate-400 hover:text-red-400 hover:border-red-500/50 transition-all text-sm"
          >
            <LogOut className="w-4 h-4" />Sign Out
          </button>
        </motion.div>

        {/* ── Profile Header ─────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel rounded-2xl p-8 mb-6 relative overflow-hidden"
        >
          {/* Favorite Pokémon glow */}
          <div
            className="absolute top-0 right-0 w-96 h-96 opacity-10 blur-3xl"
            style={{ background: `radial-gradient(circle, ${TYPE_COLORS[currentTrainer.favoritePokemon.types[0]]}, transparent)` }}
          />

          <div className="relative z-10 flex flex-col md:flex-row gap-8">
            {/* Avatar */}
            <div className="flex-shrink-0 relative">
              <motion.div
                whileHover={{ scale: 1.05 }}
                onClick={() => setShowAvatarPicker(true)}
                className="w-40 h-40 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-800 border-4 border-blue-500 shadow-xl shadow-blue-500/30 overflow-hidden cursor-pointer relative group"
              >
                {currentTrainer.avatar?.startsWith('data:') || currentTrainer.avatar?.startsWith('/') ? (
                  <img src={currentTrainer.avatar} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-7xl">{currentTrainer.avatar || '🧑‍🦱'}</div>
                )}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                  <Camera className="w-8 h-8 text-white" />
                  <span className="text-xs text-white font-bold">Change Photo</span>
                </div>
              </motion.div>

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

            {/* Info */}
            <div className="flex-1">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h1 className="text-4xl font-black mb-2">{currentTrainer.displayName}</h1>
                  <p className="text-lg text-blue-400">@{currentTrainer.username}</p>
                </div>
                <div className="glass-panel px-4 py-2 rounded-lg">
                  <div className="flex items-center gap-2 text-sm">
                    <Wallet className="w-4 h-4 text-purple-400" />
                    <span className="font-bold">{currentTrainer.balance.toFixed(3)} SOL</span>
                  </div>
                </div>
              </div>

              {currentTrainer.bio && (
                <p className="text-slate-300 mb-6 max-w-2xl">{currentTrainer.bio}</p>
              )}

              {/* Stats + Favorite Pokémon */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="glass-panel p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-1 text-green-400">
                    <Trophy className="w-4 h-4" />
                    <span className="text-xs font-semibold uppercase">Wins</span>
                  </div>
                  <p className="text-2xl font-black">{currentTrainer.record.wins}</p>
                </div>
                <div className="glass-panel p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-1 text-red-400">
                    <Target className="w-4 h-4" />
                    <span className="text-xs font-semibold uppercase">Losses</span>
                  </div>
                  <p className="text-2xl font-black">{currentTrainer.record.losses}</p>
                </div>
                {/* P&L card */}
                {(() => {
                  const earnings = currentTrainer.earnings ?? 0;
                  const isProfit = earnings >= 0;
                  return (
                    <div className="glass-panel p-4 rounded-lg">
                      <div className={`flex items-center gap-2 mb-1 ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
                        {isProfit ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                        <span className="text-xs font-semibold uppercase">P&amp;L</span>
                      </div>
                      <p className={`text-2xl font-black ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
                        {isProfit ? '+' : ''}{earnings.toFixed(3)}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">SOL</p>
                      <p className={`text-xs mt-0.5 ${isProfit ? 'text-green-600' : 'text-red-600'}`}>
                        {isProfit ? '+' : ''}${(earnings * SOL_PRICE_USD).toFixed(2)} USD
                      </p>
                    </div>
                  );
                })()}
                <div className="glass-panel p-4 rounded-lg flex flex-col items-center justify-center gap-1 relative overflow-hidden">
                  <div
                    className="absolute inset-0 opacity-10"
                    style={{ background: `radial-gradient(circle, ${TYPE_COLORS[currentTrainer.favoritePokemon.types[0]]}, transparent)` }}
                  />
                  <div className="flex items-center gap-2 mb-1 text-yellow-400 relative z-10">
                    <Heart className="w-4 h-4 fill-yellow-400" />
                    <span className="text-xs font-semibold uppercase">Favorite</span>
                  </div>
                  <img
                    src={getPokemonSpriteUrl(currentTrainer.favoritePokemon.id)}
                    alt={currentTrainer.favoritePokemon.name}
                    className="w-12 h-12 object-contain relative z-10"
                    style={{ imageRendering: 'pixelated' }}
                  />
                  <p className="text-xs font-bold relative z-10 text-white">{currentTrainer.favoritePokemon.name}</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── Wallet Section ─────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-slate-900/50 backdrop-blur-xl border border-slate-800/50 rounded-2xl overflow-hidden"
        >
          {/* Wallet header with paired action buttons */}
          <div className="p-6 border-b border-slate-800/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Wallet className="w-5 h-5 text-purple-400" />
                Wallet
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
              <button
                onClick={() => openWalletView('deposit')}
                className={`px-5 py-2.5 rounded-lg font-bold text-sm transition-all flex items-center gap-2 ${
                  walletView === 'deposit'
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/40'
                    : 'bg-slate-800 border border-slate-700 text-slate-300 hover:border-purple-500/60 hover:text-purple-300'
                }`}
              >
                <ArrowDown className="w-4 h-4" />
                Deposit SOL
              </button>
              <button
                onClick={() => openWalletView('withdraw')}
                disabled={testingMode}
                title={testingMode ? 'Withdrawals disabled in testing mode' : undefined}
                className={`px-5 py-2.5 rounded-lg font-bold text-sm transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed ${
                  walletView === 'withdraw'
                    ? 'bg-orange-600 text-white shadow-lg shadow-orange-500/40'
                    : 'bg-slate-800 border border-slate-700 text-slate-300 hover:border-orange-500/60 hover:text-orange-300'
                }`}
              >
                <ArrowDown className="w-4 h-4 rotate-180" />
                Withdraw SOL
              </button>
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
                      <button
                        onClick={handleWithdrawClose}
                        className="px-8 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg font-bold transition-all"
                      >
                        Done
                      </button>
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
                        <button
                          onClick={() => setWithdrawStep('form')}
                          className="flex-1 py-3 rounded-lg border border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200 font-bold transition-all"
                        >
                          ← Go Back
                        </button>
                        <button
                          onClick={handleWithdrawConfirm}
                          className="flex-1 py-3 rounded-lg bg-orange-600 hover:bg-orange-500 font-black text-white transition-all shadow-lg shadow-orange-500/30"
                        >
                          Confirm Withdrawal
                        </button>
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

                      <button
                        onClick={handleWithdrawNext}
                        className="w-full py-3 rounded-lg bg-orange-600 hover:bg-orange-500 font-black text-white transition-all shadow-lg shadow-orange-500/30"
                      >
                        Review Withdrawal →
                      </button>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

      </div>
    </div>
  );
}
