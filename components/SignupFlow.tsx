'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Check, User, Mail, AtSign, Heart, Lock, Eye, EyeOff, Upload, Wallet, Copy, AlertCircle } from 'lucide-react';
import { useArenaStore } from '@/lib/store';
import { DEFAULT_AVATARS } from '@/lib/constants';
import { getAvatarOptions } from '@/lib/trainer-avatars';
import { POKEMON_DATABASE } from '@/lib/pokemon-data';
import { getPokemonSpriteUrl } from '@/lib/pokemon-data';
import { validateUsername } from '@/lib/moderation';
import { registerUser, loginUser, initiatePasswordReset, getSession } from '@/lib/auth';
import PokemonSelector from './PokemonSelector';
import type { PokemonType } from '@/types';

type FlowMode = 'login' | 'signup' | 'forgot';

export default function SignupFlow() {
  const { setTrainer, setScreen, testingMode } = useArenaStore();
  const [mode, setMode] = useState<FlowMode>('login');
  const [step, setStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const totalSteps = 6;

  // Age verification gate — must pass before seeing signup form
  const [ageVerified, setAgeVerified] = useState<boolean | null>(null);
  const [ageDenied, setAgeDenied] = useState(false);
  // ToS acceptance
  const [tosAccepted, setTosAccepted] = useState(false);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    displayName: '',
    username: '',
    bio: '',
    avatar: DEFAULT_AVATARS[0],
    customAvatarPreview: '',
    favoritePokemon: {
      id: 25,
      name: 'Pikachu',
      sprite: '',
      types: ['electric' as PokemonType],
      stats: { hp: 35, attack: 55, defense: 40, spAttack: 50, spDefense: 50, speed: 90 },
    },
  });

  const [forgotEmail, setForgotEmail] = useState('');

  // Load session on mount
  useState(() => {
    const session = getSession();
    if (session) {
      applySession(session);
    }
  });

  function applySession(session: any) {
    const favPokemon = POKEMON_DATABASE.find(p => p.id === session.favoritePokemonId);
    setTrainer({
      id: session.id,
      email: session.email,
      username: session.username,
      displayName: session.displayName,
      bio: session.bio,
      avatar: session.avatar,
      favoritePokemon: {
        id: session.favoritePokemonId,
        name: session.favoritePokemonName,
        sprite: '',
        types: session.favoritePokemonTypes as PokemonType[],
        stats: { hp: 100, attack: 100, defense: 100, spAttack: 100, spDefense: 100, speed: 100 },
      },
      joinedDate: new Date(session.joinedDate),
      record: { wins: session.wins, losses: session.losses },
      internalWalletId: session.internalWalletId,
      balance: session.balance,
      earnings: session.earnings ?? 0,
      badges: session.badges ?? [],
    });
    setScreen('profile');
  }

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      setError('Please upload a JPG, PNG, WebP, or GIF image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be under 5MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setFormData(f => ({ ...f, customAvatarPreview: dataUrl, avatar: dataUrl }));
      setError('');
    };
    reader.readAsDataURL(file);
  };

  const canProceed = () => {
    switch (step) {
      case 1: return formData.email && formData.email.includes('@') && formData.password.length >= 6 && formData.password === formData.confirmPassword;
      case 2: return formData.displayName.trim().length >= 2 && formData.username.trim().length >= 3 && !error;
      case 3: return !!formData.avatar;
      case 4: return !!formData.favoritePokemon;
      case 5: return tosAccepted;
      case 6: return true;
      default: return false;
    }
  };

  const handleUsernameChange = (val: string) => {
    setFormData(f => ({ ...f, username: val.toLowerCase() }));
    if (val.length >= 3) {
      const result = validateUsername(val);
      setError(result.valid ? '' : result.error || '');
    } else {
      setError('');
    }
  };

  const handleNext = () => {
    setError('');
    if (step < totalSteps) {
      setStep(step + 1);
    } else {
      handleCreateAccount();
    }
  };

  const handleCreateAccount = () => {
    setIsLoading(true);
    const result = registerUser({
      email: formData.email,
      password: formData.password,
      username: formData.username,
      displayName: formData.displayName,
      bio: formData.bio,
      avatar: formData.avatar,
      favoritePokemonId: formData.favoritePokemon.id,
      favoritePokemonName: formData.favoritePokemon.name,
      favoritePokemonTypes: formData.favoritePokemon.types,
      testingMode,
    });
    setIsLoading(false);
    if (!result.success) {
      setError(result.error || 'Something went wrong.');
      return;
    }
    applySession(result.user!);
  };

  const handleLogin = () => {
    setIsLoading(true);
    setError('');
    const result = loginUser(formData.email, formData.password);
    setIsLoading(false);
    if (!result.success) {
      setError(result.error || 'Login failed.');
      return;
    }
    applySession(result.user!);
  };

  const handleForgotPassword = () => {
    if (!forgotEmail.includes('@')) { setError('Please enter a valid email.'); return; }
    initiatePasswordReset(forgotEmail);
    setSuccess('If an account exists with that email, a reset link has been sent.');
    setError('');
  };

  const copyAddress = () => {
    navigator.clipboard.writeText('arena151_' + formData.email.replace(/[^a-z0-9]/gi, ''));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── LOGIN MODE ──────────────────────────────────────────────
  if (mode === 'login') {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 relative overflow-hidden">
        {/* Background image */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/SICK.jpg" alt="" className="absolute inset-0 w-full h-full object-cover" aria-hidden="true" />
        <div className="absolute inset-0 bg-black/50" />
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="relative z-10 max-w-md w-full">
          <div className="text-center mb-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/Arena151Logo.png" alt="Arena 151" className="h-24 mx-auto mb-2 object-contain" />
            <p className="text-slate-300">Sign in to your trainer account</p>
          </div>

          <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800/50 rounded-2xl p-8">
            {error && (
              <div className="flex items-center gap-3 bg-red-950/50 border border-red-500/50 rounded-lg p-3 mb-4 text-red-300 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-semibold mb-2 text-slate-300">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input type="email" value={formData.email} onChange={e => setFormData(f => ({ ...f, email: e.target.value }))}
                    placeholder="trainer@example.com"
                    className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-blue-500 transition-colors"
                    onKeyPress={e => e.key === 'Enter' && handleLogin()} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2 text-slate-300">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input type={showPassword ? 'text' : 'password'} value={formData.password} onChange={e => setFormData(f => ({ ...f, password: e.target.value }))}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-12 py-3 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-blue-500 transition-colors"
                    onKeyPress={e => e.key === 'Enter' && handleLogin()} />
                  <button onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            <button onClick={handleLogin} disabled={isLoading}
              className="w-full py-4 rounded-lg font-bold tracking-wide uppercase bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 shadow-lg shadow-blue-500/30 transition-all disabled:opacity-50 mb-4">
              {isLoading ? 'Signing In...' : 'Sign In'}
            </button>

            <div className="flex items-center justify-between text-sm">
              <button onClick={() => { setMode('forgot'); setError(''); }} className="text-blue-400 hover:text-blue-300 transition-colors">
                Forgot password?
              </button>
              <button onClick={() => { setMode('signup'); setStep(1); setError(''); }} className="text-cyan-400 hover:text-cyan-300 transition-colors font-semibold">
                Create account →
              </button>
            </div>
          </div>


        </motion.div>
      </div>
    );
  }

  // ── FORGOT PASSWORD MODE ────────────────────────────────────
  if (mode === 'forgot') {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 relative overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/SICK.jpg" alt="" className="absolute inset-0 w-full h-full object-cover" aria-hidden="true" />
        <div className="absolute inset-0 bg-black/50" />
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="relative z-10 max-w-md w-full">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-black text-white mb-2">Reset Password</h1>
            <p className="text-slate-400">Enter your registered email to receive reset instructions</p>
          </div>

          <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800/50 rounded-2xl p-8">
            {error && <div className="flex items-center gap-3 bg-red-950/50 border border-red-500/50 rounded-lg p-3 mb-4 text-red-300 text-sm"><AlertCircle className="w-4 h-4" />{error}</div>}
            {success && <div className="bg-green-950/50 border border-green-500/50 rounded-lg p-4 mb-4 text-green-300 text-sm">{success}</div>}

            {!success && (
              <>
                <div className="mb-6">
                  <label className="block text-sm font-semibold mb-2 text-slate-300">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input type="email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)}
                      placeholder="trainer@example.com"
                      className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-blue-500 transition-colors" />
                  </div>
                </div>
                <button onClick={handleForgotPassword}
                  className="w-full py-4 rounded-lg font-bold tracking-wide uppercase bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 shadow-lg transition-all mb-4">
                  Send Reset Instructions
                </button>
              </>
            )}

            <button onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
              className="w-full py-3 text-slate-400 hover:text-white text-sm transition-colors">
              ← Back to sign in
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ── AGE VERIFICATION GATE ──────────────────────────────────
  if (ageVerified === null || ageDenied) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 relative overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/SICK.jpg" alt="" className="absolute inset-0 w-full h-full object-cover" aria-hidden="true" />
        <div className="absolute inset-0 bg-black/70" />
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="relative z-10 max-w-md w-full">
          <div className="text-center mb-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/Arena151Logo.png" alt="Arena 151" className="h-20 mx-auto mb-3 object-contain" />
          </div>
          <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800/50 rounded-2xl p-8 text-center">
            {ageDenied ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="text-5xl mb-4">🚫</div>
                <h2 className="text-2xl font-black text-white mb-3">Access Restricted</h2>
                <p className="text-slate-300 mb-6">You must be 18 or older to use Arena 151.</p>
                <button
                  onClick={() => { setAgeDenied(false); setMode('login'); }}
                  className="w-full py-3 rounded-lg font-bold text-slate-400 border border-slate-700 hover:border-slate-500 transition-all text-sm"
                >
                  ← Back to Login
                </button>
              </motion.div>
            ) : (
              <>
                <div className="text-5xl mb-4">🔞</div>
                <h2 className="text-2xl font-black text-white mb-3">Age Verification Required</h2>
                <p className="text-slate-300 mb-2">Are you 18 or older?</p>
                <p className="text-slate-500 text-sm mb-8">
                  This platform involves skill-based wagering. You must be 18 years or older and in a jurisdiction where
                  skill-based wagering is permitted to create an account.
                </p>
                <div className="space-y-3">
                  <button
                    onClick={() => setAgeVerified(true)}
                    className="w-full py-4 rounded-xl font-black tracking-wide uppercase text-white transition-all bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 shadow-lg shadow-blue-500/30 hover:scale-105 active:scale-95"
                  >
                    ✅ I am 18 or older — Continue
                  </button>
                  <button
                    onClick={() => setAgeDenied(true)}
                    className="w-full py-3 rounded-xl font-bold text-slate-400 border border-slate-700 hover:border-red-500/50 hover:text-red-300 transition-all text-sm"
                  >
                    I am under 18 — Exit
                  </button>
                </div>
              </>
            )}
          </div>
          <div className="text-center mt-4">
            <button onClick={() => setMode('login')} className="text-sm text-slate-500 hover:text-slate-300 transition-colors">
              Already have an account? Sign in
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ── SIGNUP MODE ─────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center p-8 relative overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/SICK.jpg" alt="" className="absolute inset-0 w-full h-full object-cover" aria-hidden="true" />
      <div className="absolute inset-0 bg-black/50" />

      <div className="relative z-10 max-w-2xl w-full">
        {/* Progress */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center justify-between mb-3">
            {[1, 2, 3, 4, 5, 6].map(s => (
              <div key={s} className="flex items-center flex-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-all ${s <= step ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg shadow-blue-500/50' : 'bg-slate-800 text-slate-500'}`}>
                  {s < step ? <Check className="w-4 h-4" /> : s}
                </div>
                {s < 6 && <div className={`h-1 flex-1 mx-1 transition-all ${s < step ? 'bg-gradient-to-r from-blue-500 to-cyan-500' : 'bg-slate-800'}`} />}
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xs text-slate-500 mt-1">
            <span>Account</span><span>Identity</span><span>Avatar</span><span>Pokémon</span><span>Terms</span><span>Wallet</span>
          </div>
        </motion.div>

        <motion.div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800/50 rounded-2xl p-8 mb-6">
          {error && <div className="flex items-center gap-3 bg-red-950/50 border border-red-500/50 rounded-lg p-3 mb-6 text-red-300 text-sm"><AlertCircle className="w-4 h-4 flex-shrink-0" />{error}</div>}

          <AnimatePresence mode="wait">
            {/* STEP 1 — Email & Password */}
            {step === 1 && (
              <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className="flex items-center gap-3 mb-6"><Mail className="w-8 h-8 text-blue-400" /><h2 className="text-3xl font-bold">Create Account</h2></div>
                <p className="text-slate-400 mb-6">Start your trainer journey. Already have an account? <button onClick={() => setMode('login')} className="text-blue-400 hover:text-blue-300">Sign in instead.</button></p>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold mb-2">Email <span className="text-red-400">*</span></label>
                    <div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input type="email" placeholder="trainer@example.com" value={formData.email}
                        onChange={e => setFormData(f => ({ ...f, email: e.target.value }))}
                        className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-blue-500 transition-colors" autoFocus />
                    </div>
                    <p className="text-xs text-slate-500 mt-1">Required • Private • Used for login and recovery</p>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2">Password <span className="text-red-400">*</span></label>
                    <div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input type={showPassword ? 'text' : 'password'} placeholder="Minimum 6 characters" value={formData.password}
                        onChange={e => setFormData(f => ({ ...f, password: e.target.value }))}
                        className="w-full pl-10 pr-12 py-3 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-blue-500 transition-colors" />
                      <button onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">{showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2">Confirm Password <span className="text-red-400">*</span></label>
                    <div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input type={showPassword ? 'text' : 'password'} placeholder="Repeat your password" value={formData.confirmPassword}
                        onChange={e => setFormData(f => ({ ...f, confirmPassword: e.target.value }))}
                        className={`w-full pl-10 pr-4 py-3 bg-slate-800 border rounded-lg focus:outline-none transition-colors ${formData.confirmPassword && formData.password !== formData.confirmPassword ? 'border-red-500' : 'border-slate-700 focus:border-blue-500'}`} />
                    </div>
                    {formData.confirmPassword && formData.password !== formData.confirmPassword && <p className="text-xs text-red-400 mt-1">Passwords do not match.</p>}
                  </div>
                </div>
              </motion.div>
            )}

            {/* STEP 2 — Identity */}
            {step === 2 && (
              <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className="flex items-center gap-3 mb-6"><User className="w-8 h-8 text-blue-400" /><h2 className="text-3xl font-bold">Your Identity</h2></div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold mb-2 flex items-center gap-2"><User className="w-4 h-4 text-blue-400" />Display Name <span className="text-red-400">*</span></label>
                    <input type="text" placeholder="Ash Ketchum" value={formData.displayName}
                      onChange={e => setFormData(f => ({ ...f, displayName: e.target.value }))}
                      className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-blue-500 transition-colors" />
                    <p className="text-xs text-slate-500 mt-1">Required • Public</p>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2 flex items-center gap-2"><AtSign className="w-4 h-4 text-blue-400" />Username <span className="text-red-400">*</span></label>
                    <input type="text" placeholder="champion_ash" value={formData.username}
                      onChange={e => handleUsernameChange(e.target.value)}
                      className={`w-full px-4 py-3 bg-slate-800 border rounded-lg focus:outline-none transition-colors ${error ? 'border-red-500' : 'border-slate-700 focus:border-blue-500'}`} />
                    <p className="text-xs text-slate-500 mt-1">Required • Public • Letters, numbers, _ and - only</p>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2">Bio <span className="text-slate-500 font-normal">(optional)</span></label>
                    <textarea placeholder="Tell trainers about yourself..." value={formData.bio}
                      onChange={e => setFormData(f => ({ ...f, bio: e.target.value }))}
                      className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-blue-500 transition-colors resize-none" rows={3} maxLength={160} />
                    <p className="text-xs text-slate-500 mt-1">{formData.bio.length}/160 • Optional • Public</p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* STEP 3 — Avatar */}
            {step === 3 && (
              <motion.div key="s3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className="flex items-center gap-3 mb-6"><Upload className="w-8 h-8 text-blue-400" /><h2 className="text-3xl font-bold">Your Avatar</h2></div>
                <p className="text-slate-400 mb-6">Upload your own photo or choose a default trainer portrait.</p>

                {/* Upload section */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-600 hover:border-blue-500 rounded-xl p-6 text-center cursor-pointer transition-all mb-6 group"
                >
                  {formData.customAvatarPreview ? (
                    <div className="flex items-center gap-4 justify-center">
                      <img src={formData.customAvatarPreview} alt="Your avatar" className="w-20 h-20 rounded-xl object-cover border-4 border-blue-500 shadow-lg shadow-blue-500/30" />
                      <div className="text-left">
                        <p className="font-bold text-green-400">Custom photo uploaded!</p>
                        <p className="text-sm text-slate-400">Click to change</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-10 h-10 mx-auto mb-2 text-slate-500 group-hover:text-blue-400 transition-colors" />
                      <p className="font-semibold text-slate-300 group-hover:text-white transition-colors">Upload your photo</p>
                      <p className="text-xs text-slate-500 mt-1">JPG, PNG, WebP or GIF • Max 5MB</p>
                    </>
                  )}
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />

                <div className="relative mb-4">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-700" /></div>
                  <div className="relative flex justify-center"><span className="bg-slate-900 px-4 text-xs text-slate-500">OR CHOOSE A DEFAULT</span></div>
                </div>

                <div className="grid grid-cols-6 gap-3">
                  {getAvatarOptions().map((opt) => (
                    <motion.div key={opt.value} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                      onClick={() => setFormData(f => ({ ...f, avatar: opt.value, customAvatarPreview: '' }))}
                      className={`aspect-square rounded-xl cursor-pointer overflow-hidden border-2 transition-all ${!formData.customAvatarPreview && formData.avatar === opt.value ? 'border-blue-500 shadow-lg shadow-blue-500/50' : 'border-slate-700 hover:border-slate-500 opacity-60 hover:opacity-100'}`}>
                      {opt.type === 'image' ? (
                        <img src={opt.value} alt="Trainer" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-2xl">{opt.value}</div>
                      )}
                    </motion.div>
                  ))}
                </div>
                <p className="text-xs text-slate-500 mt-4">Public • Can be changed later in profile settings</p>
              </motion.div>
            )}

            {/* STEP 4 — Favorite Pokémon */}
            {step === 4 && (
              <motion.div key="s4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className="flex items-center gap-3 mb-6"><Heart className="w-8 h-8 text-red-400" /><h2 className="text-3xl font-bold">Favorite Pokémon</h2></div>
                <p className="text-slate-400 mb-6">Choose your signature Pokémon — shown on your public trainer profile. Search all 151 or browse.</p>
                <PokemonSelector
                  selectedId={formData.favoritePokemon.id}
                  onSelect={p => setFormData(f => ({ ...f, favoritePokemon: { id: p.id, name: p.name, sprite: '', types: p.types as PokemonType[], stats: { hp: 100, attack: 100, defense: 100, spAttack: 100, spDefense: 100, speed: 100 } } }))}
                />
                <p className="text-xs text-slate-500 mt-4">Public • Shown on your trainer card and match reveals</p>
              </motion.div>
            )}

            {/* STEP 5 — Terms of Service */}
            {step === 5 && (
              <motion.div key="s5" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-3xl">📋</span>
                  <h2 className="text-2xl font-bold">Terms of Service</h2>
                </div>
                <p className="text-slate-400 text-sm mb-4">Please read and agree to our Terms of Service before creating your account.</p>

                {/* Scrollable ToS content */}
                <div className="bg-slate-900/80 border border-slate-700 rounded-xl p-4 mb-4 overflow-y-auto text-xs text-slate-300 space-y-3 leading-relaxed"
                  style={{ maxHeight: '320px' }}>
                  <p className="font-black text-white text-sm text-center">ARENA 151 — TERMS OF SERVICE &amp; LEGAL AGREEMENT</p>

                  <div>
                    <p className="font-bold text-white mb-1">1. ELIGIBILITY</p>
                    <p>You must be 18 years of age or older. By creating an account you confirm you are of legal age and that skill-based wagering is permitted in your jurisdiction.</p>
                  </div>

                  <div>
                    <p className="font-bold text-white mb-1">2. SKILL-BASED WAGERING</p>
                    <p>Arena 151 is a skill-based game. Battle outcomes are determined by team composition, strategic drafting, and move selection — not pure chance. However, as with any competition, outcomes are not guaranteed.</p>
                  </div>

                  <div>
                    <p className="font-bold text-white mb-1">3. FAIR GAMING &amp; RANDOM MECHANICS</p>
                    <ul className="space-y-1 ml-2">
                      {[
                        'All AI opponents are generated using a deterministic algorithm with no preferential treatment',
                        'Move selection uses a weighted random system based on type matchups, stats, and momentum — the same rules apply to every player equally',
                        'No player, moderator, or Arena 151 staff member can influence battle outcomes',
                        'All randomness uses client-side seeded RNG — results can be independently verified',
                      ].map((item, i) => <li key={i} className="flex gap-1.5"><span className="shrink-0 mt-0.5">•</span><span>{item}</span></li>)}
                    </ul>
                  </div>

                  <div>
                    <p className="font-bold text-white mb-1">4. HOUSE FEES</p>
                    <ul className="space-y-1 ml-2">
                      <li className="flex gap-1.5"><span className="shrink-0 mt-0.5">•</span><span>Arena 151 charges a 5% house fee on all wagered battles. Example: two players wager 1 SOL each (2 SOL pot) → winner receives 1.9 SOL, 0.1 SOL goes to Arena 151.</span></li>
                      <li className="flex gap-1.5"><span className="shrink-0 mt-0.5">•</span><span>A 0.5% processing fee applies to all withdrawals. Example: withdraw 10 SOL → receive 9.95 SOL.</span></li>
                      <li className="flex gap-1.5"><span className="shrink-0 mt-0.5">•</span><span>Free (no-wager) battles have no fees.</span></li>
                    </ul>
                  </div>

                  <div>
                    <p className="font-bold text-white mb-1">5. DEPOSITS &amp; WITHDRAWALS</p>
                    <ul className="space-y-1 ml-2">
                      <li className="flex gap-1.5"><span className="shrink-0 mt-0.5">•</span><span>Minimum withdrawal: $10 USD equivalent in SOL</span></li>
                      <li className="flex gap-1.5"><span className="shrink-0 mt-0.5">•</span><span>Withdrawals are processed manually and may take 1-3 business days</span></li>
                      <li className="flex gap-1.5"><span className="shrink-0 mt-0.5">•</span><span>Arena 151 is not responsible for funds sent to incorrect wallet addresses</span></li>
                    </ul>
                  </div>

                  <div>
                    <p className="font-bold text-white mb-1">6. RESPONSIBLE GAMING</p>
                    <p>Only wager what you can afford to lose. If you believe you have a gambling problem, please seek help at ncpgambling.org or 1-800-522-4700.</p>
                  </div>

                  <div>
                    <p className="font-bold text-white mb-1">7. PROHIBITED CONDUCT</p>
                    <ul className="space-y-1 ml-2">
                      {[
                        'Collusion, match-fixing, or multi-accounting is prohibited and will result in permanent ban',
                        'Exploiting bugs or glitches to gain unfair advantage is prohibited',
                        'Any attempt to manipulate game outcomes will result in account suspension and potential legal action',
                      ].map((item, i) => <li key={i} className="flex gap-1.5"><span className="shrink-0 mt-0.5">•</span><span>{item}</span></li>)}
                    </ul>
                  </div>

                  <div>
                    <p className="font-bold text-white mb-1">8. LIMITATION OF LIABILITY</p>
                    <p>Arena 151 is provided &quot;as is.&quot; We are not liable for losses incurred through gameplay, technical issues, or market fluctuations in SOL value.</p>
                  </div>

                  <div>
                    <p className="font-bold text-white mb-1">9. CHANGES TO TERMS</p>
                    <p>Arena 151 reserves the right to modify these terms at any time. Continued use constitutes acceptance.</p>
                  </div>

                  <p className="text-slate-400 text-center pt-2 border-t border-slate-700">
                    By checking the box below, you confirm you have read, understood, and agree to these Terms of Service.
                  </p>
                </div>

                {/* Checkbox */}
                <label className="flex items-start gap-3 cursor-pointer group">
                  <div
                    onClick={() => setTosAccepted(v => !v)}
                    className={`mt-0.5 w-5 h-5 rounded border-2 shrink-0 flex items-center justify-center transition-all ${tosAccepted ? 'bg-blue-600 border-blue-500' : 'border-slate-600 group-hover:border-blue-500'}`}
                  >
                    {tosAccepted && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <span className="text-sm text-slate-300 leading-relaxed">
                    I have read and agree to the Terms of Service and confirm I am <span className="font-bold text-white">18 years of age or older</span>.
                  </span>
                </label>
              </motion.div>
            )}

            {/* STEP 6 — Wallet */}
            {step === 6 && (
              <motion.div key="s6" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className="flex items-center gap-3 mb-6"><Wallet className="w-8 h-8 text-purple-400" /><h2 className="text-3xl font-bold">Fund Your Account</h2></div>
                <div className="bg-purple-950/30 border-2 border-purple-500/50 rounded-xl p-6 mb-6">
                  <p className="text-slate-300 mb-4">Send <span className="font-bold text-purple-400">SOL</span> to your Arena 151 wallet to start battling. You can also skip this for now.</p>
                  <div className="bg-slate-900/80 rounded-lg p-4 border border-slate-700 mb-4">
                    <p className="text-xs text-slate-500 mb-2">Your Wallet Address</p>
                    <div className="flex items-center gap-3">
                      <code className="flex-1 font-mono text-sm text-slate-200 break-all">{`arena151_${formData.email.replace(/[^a-z0-9]/gi, '')}`}</code>
                      <button onClick={copyAddress} className="flex-shrink-0 px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors flex items-center gap-2 text-sm font-bold">
                        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}{copied ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1 text-sm text-slate-400">
                    <p>⚠️ <span className="font-bold text-purple-300">SOL ONLY</span></p>
                    <p>💰 Minimum: 0.01 SOL • ⚡ Confirms in ~1 min</p>
                  </div>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 text-sm text-slate-400">
                  You can deposit more SOL anytime from your trainer profile.
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-center">
            {step > 1 ? (
              <button onClick={() => { setStep(s => s - 1); setError(''); }}
                className="px-6 py-3 bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-lg font-semibold hover:border-blue-500/50 transition-all">Back</button>
            ) : (
              <button onClick={() => { setMode('login'); setError(''); }}
                className="px-6 py-3 bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-lg font-semibold hover:border-blue-500/50 transition-all">Sign In Instead</button>
            )}
            <button onClick={handleNext} disabled={!canProceed() || isLoading}
              className={`px-8 py-3 rounded-lg font-bold tracking-wide uppercase text-sm transition-all bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 shadow-lg shadow-blue-500/50 flex items-center gap-2 ${(!canProceed() || isLoading) ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 active:scale-95'}`}>
              {isLoading ? 'Creating...' : step === totalSteps ? '⚔️ Enter the Arena' : 'Continue'}
              {!isLoading && <ChevronRight className="w-5 h-5" />}
            </button>
          </div>
          {/* Skip for now — only on wallet step */}
          {step === totalSteps && (
            <div className="text-center">
              <button
                onClick={handleCreateAccount}
                disabled={isLoading}
                className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
              >
                Skip for now → &nbsp;
                <span className="text-slate-600 text-xs">You can deposit SOL anytime from your profile</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
