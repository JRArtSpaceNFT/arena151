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
                  <div className="text-center border-b border-slate-700 pb-3">
                    <p className="font-black text-white text-sm">ARENA 151</p>
                    <p className="font-black text-white text-sm">TERMS OF SERVICE AND LEGAL AGREEMENT</p>
                    <p className="text-slate-500 mt-1">Effective Date: April 2, 2025</p>
                  </div>

                  <p className="text-slate-400">Welcome to Arena 151. These Terms of Service and Legal Agreement govern your access to and use of the Arena 151 website, application, game services, wallet features, battle system, and any related products or services we provide, collectively referred to as the Service. By creating an account, accessing the Service, connecting a wallet, entering a battle, depositing funds, withdrawing funds, or otherwise using Arena 151, you agree to be bound by these Terms. If you do not agree, do not use the Service.</p>

                  {[
                    {
                      n: '1', title: 'ELIGIBILITY',
                      body: <><p>To use Arena 151, you must meet all of the following requirements:</p><ul className="space-y-1 ml-2 mt-1">{['You must be at least 18 years old, or the age of legal majority in your jurisdiction, whichever is greater','You must have full legal capacity to enter into a binding agreement','You must not be located in, reside in, or access the Service from any jurisdiction where participation in skill-based paid competitions, digital asset transactions, or similar activities is prohibited or restricted','You must not be prohibited from using the Service under any applicable law, regulation, sanctions program, or court order'].map((t,i)=><li key={i} className="flex gap-1.5"><span className="shrink-0">•</span><span>{t}</span></li>)}</ul><p className="mt-1">By using the Service, you represent and warrant that you satisfy all eligibility requirements and that your use of Arena 151 is lawful in your jurisdiction. Arena 151 reserves the right to restrict, suspend, deny, or terminate access to any user at any time if eligibility cannot be verified or if we believe continued access may create legal, regulatory, security, or operational risk.</p></>
                    },
                    {
                      n: '2', title: 'NATURE OF THE SERVICE',
                      body: <p>Arena 151 is a competitive digital battle platform in which players assemble teams, make strategic decisions, and compete in head-to-head or AI-based battles. Depending on the game mode, players may participate in free battles or paid skill-based contests. Arena 151 is intended to reward strategic skill, roster construction, tactical decision making, matchup knowledge, and performance under competitive conditions. Arena 151 is not a financial product, bank account, brokerage, custodial wallet, or investment platform. Nothing on the Service constitutes financial advice, legal advice, tax advice, or a guarantee of winnings or profits.</p>
                    },
                    {
                      n: '3', title: 'SKILL-BASED COMPETITION',
                      body: <><p>Arena 151 is designed as a skill-based competition platform. Outcomes are intended to be materially influenced by player judgment, team construction, strategic drafting, move selection, matchup understanding, and other gameplay decisions. By participating in any paid battle or prize-based contest, you acknowledge and agree that:</p><ul className="space-y-1 ml-2 mt-1">{['Winning is not guaranteed','Losses are possible','Results may depend on your decisions, your opponent\'s decisions, platform rules, and in-game mechanics','You are voluntarily risking entry fees or digital assets in exchange for the opportunity to compete for prizes'].map((t,i)=><li key={i} className="flex gap-1.5"><span className="shrink-0">•</span><span>{t}</span></li>)}</ul><p className="mt-1">You further understand that even in a skill-based system, some mechanics may include randomized or probabilistic elements that operate consistently across all participants under the same ruleset.</p></>
                    },
                    {
                      n: '4', title: 'FAIR PLAY, MATCH INTEGRITY, AND GAME MECHANICS',
                      body: <><p>Arena 151 is committed to competitive integrity. All players are subject to the same rules, battle logic, and system constraints. You acknowledge and agree that:</p><ul className="space-y-1 ml-2 mt-1">{['Battle outcomes are determined by the game engine according to Arena 151\'s rules and mechanics','AI behavior, move logic, stat interactions, drafting systems, and battle calculations may rely on deterministic systems, weighted systems, or other rule-based decision models established by Arena 151','Certain gameplay events may involve probability-based mechanics, provided such mechanics are applied uniformly and are not manipulated to favor any player','Arena 151 may update balancing, mechanics, battle logic, matchmaking rules, and gameplay systems at any time in order to improve fairness, security, or game quality'].map((t,i)=><li key={i} className="flex gap-1.5"><span className="shrink-0">•</span><span>{t}</span></li>)}</ul><p className="mt-1">Arena 151 reserves the right to investigate any match, audit battle activity, invalidate suspicious results, cancel contests, or withhold payouts where there is evidence of cheating, system abuse, fraud, collusion, technical manipulation, or violation of these Terms.</p></>
                    },
                    {
                      n: '5', title: 'ACCOUNTS AND WALLET CONNECTIONS',
                      body: <><p>You are solely responsible for: maintaining the confidentiality of your account credentials and wallet access; all activity that occurs under your account; ensuring your wallet address is accurate before sending or receiving funds; and maintaining the security of your device, seed phrase, and login credentials. Arena 151 is not responsible for unauthorized access resulting from your failure to safeguard your credentials. You may not share accounts, sell accounts, or permit another person to use your account.</p></>
                    },
                    {
                      n: '6', title: 'DEPOSITS, ENTRY FEES, WAGERS, AND PRIZE POOLS',
                      body: <><p>By entering a paid battle, you understand and agree that your entry fee or wager is placed at risk once the contest begins. Prize distributions will be governed by the rules displayed at the time of entry. Arena 151 may deduct platform fees, processing fees, and other disclosed charges before distributing winnings. If a battle is canceled, interrupted, voided, or invalidated, Arena 151 may determine whether to refund entry fees, replay the battle, split the prize pool, or take another commercially reasonable action.</p></>
                    },
                    {
                      n: '7', title: 'FEES',
                      body: <><p>Current fees include:</p><ul className="space-y-1 ml-2 mt-1">{['A 5% house fee on paid wager battles. Example: two players each contribute 1 SOL (2 SOL pot) → winner receives 1.9 SOL, Arena 151 retains 0.1 SOL.','A 0.5% processing fee on all withdrawals. Example: withdraw 10 SOL → receive 9.95 SOL.','No fees for free battles unless otherwise stated.'].map((t,i)=><li key={i} className="flex gap-1.5"><span className="shrink-0">•</span><span>{t}</span></li>)}</ul><p className="mt-1">All fees may be changed at any time upon notice. Blockchain network fees, gas fees, and third-party wallet fees are your sole responsibility.</p></>
                    },
                    {
                      n: '8', title: 'WITHDRAWALS AND PAYOUTS',
                      body: <><p>Minimum withdrawal thresholds apply ($10 USD equivalent). Withdrawals may require identity verification or manual review and may take 1–3 business days. Arena 151 may delay, reject, freeze, or cancel withdrawals where fraud, suspicious activity, legal risk, or violations of these Terms are suspected. Arena 151 is not responsible for lost funds resulting from incorrect wallet addresses, incompatible wallets, user error, or blockchain congestion. Transactions sent to incorrect addresses may be irreversible.</p></>
                    },
                    {
                      n: '9', title: 'NO CUSTODIAL RELATIONSHIP',
                      body: <p>Unless Arena 151 expressly states otherwise in writing, Arena 151 is not acting as your bank, trustee, escrow agent, broker, fiduciary, or financial custodian. Any balances or credits shown on the Service reflect gameplay or account status and may not represent segregated funds held on your behalf unless explicitly stated.</p>
                    },
                    {
                      n: '10', title: 'COMPLIANCE, VERIFICATION, AND RESTRICTED JURISDICTIONS',
                      body: <><p>Arena 151 reserves the right to implement identity verification, age verification, wallet screening, sanctions screening, or enhanced due diligence. You may not use the Service if you are located in a restricted jurisdiction, using a VPN or proxy to conceal your location in violation of these Terms, listed on applicable sanctions lists, or acting on behalf of another person in a prohibited location.</p></>
                    },
                    {
                      n: '11', title: 'PROHIBITED CONDUCT',
                      body: <><p>You agree not to engage in: cheating or obtaining unfair advantages; collusion or match-fixing; multi-accounting; account sharing or impersonation; exploiting bugs or glitches; reverse engineering the platform; using bots, scripts, or automation tools; interfering with servers or matchmaking; fraudulent chargebacks; money laundering or use of stolen funds; harassing or threatening staff or other users; or circumventing security or verification systems. Violations may result in account suspension, permanent ban, cancellation of winnings, or referral to law enforcement.</p></>
                    },
                    {
                      n: '12', title: 'BATTLE CANCELLATIONS, DISCONNECTS, AND TECHNICAL FAILURES',
                      body: <p>Arena 151 does not guarantee uninterrupted access. Matches may be affected by downtime, bugs, internet failures, or blockchain delays. Arena 151 reserves the right to void matches, replay contests, refund entry fees, or award results based on available data. Arena 151&apos;s internal system records may be used to resolve disputes.</p>
                    },
                    {
                      n: '13', title: 'PROMOTIONS, REWARDS, AND BONUSES',
                      body: <p>Arena 151 may offer promotions, bonuses, referral programs, or special events subject to additional terms and anti-abuse measures. Arena 151 may revoke promotional benefits if the promotion was abused, manipulated, or awarded in error. Promotions have no cash value unless explicitly stated.</p>
                    },
                    {
                      n: '14', title: 'REFUND POLICY',
                      body: <p>Except where required by law or expressly stated in writing, all entry fees, purchases, deposits, and digital asset transactions are final and nonrefundable. Refunds may be considered only where a contest is canceled before it begins, a duplicate charge is caused by a verified system error, or a technical malfunction materially prevented fair participation. Arena 151 retains sole discretion regarding refunds.</p>
                    },
                    {
                      n: '15', title: 'INTELLECTUAL PROPERTY',
                      body: <p>All Arena 151 branding, software, game logic, battle mechanics, visual assets, and content are owned by or licensed to Arena 151 and protected by applicable intellectual property laws. You may not copy, reproduce, distribute, or create derivative works from any part of the Service except as expressly permitted.</p>
                    },
                    {
                      n: '16', title: 'THIRD PARTY SERVICES AND BLOCKCHAIN RISKS',
                      body: <><p>Arena 151 may rely on third-party infrastructure including wallets, blockchain networks, hosting providers, and analytics vendors. Arena 151 is not responsible for the acts, omissions, or failures of third parties. You acknowledge the inherent risks of blockchain and digital assets including volatility, network congestion, irreversible transactions, and security vulnerabilities in third-party wallets.</p></>
                    },
                    {
                      n: '17', title: 'TAXES',
                      body: <p>You are solely responsible for determining what taxes apply to your use of Arena 151, including taxes arising from winnings, withdrawals, rewards, or digital asset transactions. Arena 151 may collect tax-related information, issue forms, or report information to authorities where required by law.</p>
                    },
                    {
                      n: '18', title: 'RESPONSIBLE PLAY',
                      body: <><p>Arena 151 encourages responsible participation. Only enter paid contests with funds you can afford to lose. If you believe you may have a problem with compulsive gambling or problematic wagering behavior, seek professional support immediately.</p><p className="mt-1 font-semibold text-white">National Problem Gambling Helpline: 1-800-522-4700 · ncpgambling.org</p></>
                    },
                    {
                      n: '19', title: 'SUSPENSION AND TERMINATION',
                      body: <p>Arena 151 may suspend or terminate your account at any time, with or without notice, if you violate these Terms, we suspect fraud or unlawful activity, your conduct creates risk for other users or the platform, or we are required to do so by law or court order. Arena 151 may freeze pending balances during investigation and retain records as required by law.</p>
                    },
                    {
                      n: '20', title: 'DISCLAIMER OF WARRANTIES',
                      body: <p>The Service is provided on an &quot;as is&quot; and &quot;as available&quot; basis. To the fullest extent permitted by law, Arena 151 disclaims all warranties, express or implied, including any implied warranties of merchantability, fitness for a particular purpose, availability, accuracy, or uninterrupted operation.</p>
                    },
                    {
                      n: '21', title: 'LIMITATION OF LIABILITY',
                      body: <><p>To the fullest extent permitted by law, Arena 151 and its owners, officers, employees, contractors, affiliates, and partners shall not be liable for any indirect, incidental, consequential, special, or punitive damages, including lost profits, lost digital assets, or gameplay losses. Arena 151&apos;s total aggregate liability for any claim shall not exceed the greater of: the total fees paid by you to Arena 151 in the 3 months preceding the claim, or $100 USD.</p></>
                    },
                    {
                      n: '22', title: 'INDEMNIFICATION',
                      body: <p>You agree to defend, indemnify, and hold harmless Arena 151 and its owners, affiliates, officers, employees, and partners from any claims, liabilities, damages, losses, costs, and expenses arising out of your use or misuse of the Service, violation of these Terms, or violation of any law or third-party right.</p>
                    },
                    {
                      n: '23', title: 'PRIVACY AND DATA USE',
                      body: <p>By using the Service, you acknowledge that Arena 151 may collect, use, store, and share information necessary to operate the platform, protect users, comply with law, detect fraud, and improve the Service. This may include account data, wallet addresses, IP information, device information, gameplay data, match history, and transaction records.</p>
                    },
                    {
                      n: '24', title: 'CHANGES TO THE SERVICE AND THESE TERMS',
                      body: <p>Arena 151 may modify, suspend, or discontinue any aspect of the Service at any time. Arena 151 may revise these Terms at any time — updated Terms become effective when posted. Your continued use of the Service after revised Terms are posted constitutes your acceptance. If you do not agree to revised Terms, you must stop using the Service.</p>
                    },
                    {
                      n: '25', title: 'SEVERABILITY AND ENTIRE AGREEMENT',
                      body: <p>If any provision of these Terms is found to be unlawful or unenforceable, the remaining provisions shall remain in full force and effect. These Terms constitute the entire agreement between you and Arena 151 regarding the Service and supersede all prior understandings relating to the same subject matter.</p>
                    },
                    {
                      n: '26', title: 'CONTACT',
                      body: <><p>For questions, disputes, or support inquiries:</p><ul className="space-y-1 ml-2 mt-1"><li className="flex gap-1.5"><span className="shrink-0">•</span><span>General support: <span className="text-blue-400">support@arena151.gg</span></span></li><li className="flex gap-1.5"><span className="shrink-0">•</span><span>Legal &amp; AML inquiries: <span className="text-blue-400">legal@arena151.gg</span></span></li></ul></>
                    },
                  ].map(({ n, title, body }) => (
                    <div key={n}>
                      <p className="font-bold text-white mb-1">{n}. {title}</p>
                      <div className="text-slate-300">{body}</div>
                    </div>
                  ))}

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
