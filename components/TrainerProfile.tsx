'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy, Target, Wallet, ArrowLeft, Copy, Check, LogOut, Camera, Upload,
  AlertTriangle, ArrowDown, X, TrendingUp, TrendingDown, Swords,
} from 'lucide-react';
import { useArenaStore } from '@/lib/store';
import { TYPE_COLORS } from '@/lib/constants';
import { getPokemonSpriteUrl, POKEMON_DATABASE } from '@/lib/pokemon-data';
import { clearSession, updateUser } from '@/lib/auth';
import { getAvatarOptions } from '@/lib/trainer-avatars';
import { getBattleLog, timeAgo } from '@/lib/battleStats';
import type { BattleLogEntry } from '@/lib/battleStats';

const SOL_PRICE_USD = 150;
const WITHDRAWAL_FEE_PCT = 0.005; // 0.5% processing fee
const MIN_WITHDRAWAL_USD = 10;
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

// Gym badges — earned by winning in the corresponding arena (not by win count)
const GYM_BADGES = [
  { arenaId: 'pewter-city',    name: 'Boulder Badge', file: '/BoulderBadge.png', type: 'rock',     color: '#a8a29e', city: 'Pewter'    },
  { arenaId: 'cerulean-city',  name: 'Cascade Badge', file: '/CascadeBadge.png', type: 'water',    color: '#38bdf8', city: 'Cerulean'  },
  { arenaId: 'vermilion-city', name: 'Thunder Badge', file: '/ThunderBadge.png', type: 'electric', color: '#facc15', city: 'Vermilion' },
  { arenaId: 'celadon-city',   name: 'Rainbow Badge', file: '/RainbowBadge.png', type: 'grass',    color: '#86efac', city: 'Celadon'   },
  { arenaId: 'fuchsia-city',   name: 'Soul Badge',    file: '/SoulBadge.png',    type: 'poison',   color: '#c084fc', city: 'Fuchsia'   },
  { arenaId: 'saffron-city',   name: 'Marsh Badge',   file: '/MarshBadge.png',   type: 'psychic',  color: '#f0abfc', city: 'Saffron'   },
  { arenaId: 'cinnabar-island',name: 'Volcano Badge', file: '/VolcanoBadge.png', type: 'fire',     color: '#fb923c', city: 'Cinnabar'  },
  { arenaId: 'viridian-city',  name: 'Earth Badge',   file: '/EarthBadge.png',   type: 'ground',   color: '#fbbf24', city: 'Viridian'  },
];



// ── Floating particle background ──
function Particles({ color }: { color: string }) {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: 8 }).map((_, i) => (
        <motion.div key={i}
          className="absolute rounded-full opacity-20"
          style={{
            width: 4 + (i % 3) * 3,
            height: 4 + (i % 3) * 3,
            background: color,
            left: `${10 + i * 11}%`,
            top: `${20 + (i % 4) * 20}%`,
          }}
          animate={{ y: [0, -14, 0], opacity: [0.1, 0.3, 0.1] }}
          transition={{ duration: 3 + i * 0.5, repeat: Infinity, delay: i * 0.4, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}

// ── Pokéball divider ──
function PokeBallDivider({ color }: { color: string }) {
  return (
    <div className="flex items-center gap-2 my-1">
      <div className="flex-1 h-px" style={{ background: `linear-gradient(to right, transparent, ${color}44)` }} />
      <div className="w-3 h-3 rounded-full border-2 flex items-center justify-center shrink-0" style={{ borderColor: `${color}88` }}>
        <div className="w-1 h-1 rounded-full" style={{ background: `${color}99` }} />
      </div>
      <div className="flex-1 h-px" style={{ background: `linear-gradient(to left, transparent, ${color}44)` }} />
    </div>
  );
}

// ── Badge tile ──
function BadgeTile({ badge, earned }: { badge: typeof GYM_BADGES[0]; earned: boolean }) {
  const [hovered, setHovered] = useState(false);
  return (
    <motion.div
      className="flex flex-col items-center justify-center gap-1 py-1 cursor-default"
      whileHover={{ scale: 1.12 }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      title={earned ? badge.name : `${badge.name} — Win in ${badge.city} City to earn`}
    >
      <div className="relative flex items-center justify-center">
        {earned && (
          <motion.div className="absolute inset-0 rounded-full blur-md"
            style={{ background: badge.color }}
            animate={{ opacity: [0.35, 0.7, 0.35] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        )}
        <img src={badge.file} alt={badge.name}
          className="w-12 h-12 object-contain relative z-10 transition-all duration-300"
          style={earned
            ? { filter: `drop-shadow(0 0 6px ${badge.color})`, imageRendering: 'pixelated' }
            : hovered
              ? { filter: `grayscale(60%) brightness(0.65) drop-shadow(0 0 4px ${badge.color})`, opacity: 0.75, imageRendering: 'pixelated' }
              : { filter: 'grayscale(100%) brightness(0.3)', opacity: 0.35, imageRendering: 'pixelated' }
          }
        />

      </div>
      <p className="text-center font-black leading-none" style={{ fontSize: '8px', color: earned ? badge.color : '#475569', letterSpacing: '0.03em' }}>
        {badge.city}
      </p>
    </motion.div>
  );
}

export default function TrainerProfile() {
  const { currentTrainer, setScreen, setTrainer, clearTrainer, testingMode } = useArenaStore();
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [showPokemonPicker, setShowPokemonPicker] = useState(false);
  const [pokemonSearch, setPokemonSearch] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [badgeAnnouncement, setBadgeAnnouncement] = useState<number | null>(null);
  const prevWinsRef = useRef<number | null>(null);

  // Badge announcement on profile load (legacy, kept for safety — main ceremony fires in ResultScreen)
  useEffect(() => {
    if (!currentTrainer || prevWinsRef.current !== null) return;
    prevWinsRef.current = currentTrainer.record.wins;
  }, [currentTrainer]);

  const [recentBattles, setRecentBattles] = useState<BattleLogEntry[]>([]);
  useEffect(() => {
    setRecentBattles(getBattleLog().slice(0, 10));
  }, []);

  const [walletView, setWalletView] = useState<WalletView>(null);
  const [copied, setCopied] = useState(false);
  const [withdrawAddr, setWithdrawAddr] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawStep, setWithdrawStep] = useState<WithdrawStep>('form');
  const [withdrawError, setWithdrawError] = useState('');

  const copyAddress = () => {
    if (!currentTrainer) return;
    navigator.clipboard.writeText(currentTrainer.internalWalletId);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };
  const handleLogout = () => { clearSession().then(() => { clearTrainer(); setScreen('home'); }); };
  const handleAvatarChange = (newAvatar: string) => {
    if (!currentTrainer) return;
    const updated = { ...currentTrainer, avatar: newAvatar };
    setTrainer(updated);
    updateUser(currentTrainer.id, { avatar: newAvatar }); // fire-and-forget
    setShowAvatarPicker(false);
  };
  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !['image/jpeg','image/png','image/webp','image/gif'].includes(file.type) || file.size > 5*1024*1024) return;
    const reader = new FileReader();
    reader.onload = (ev) => handleAvatarChange(ev.target?.result as string);
    reader.readAsDataURL(file);
  };
  const handlePokemonChange = (pokemon: typeof POKEMON_DATABASE[0]) => {
    if (!currentTrainer) return;
    const updated = {
      ...currentTrainer,
      favoritePokemon: {
        id: pokemon.id,
        name: pokemon.name,
        sprite: getPokemonSpriteUrl(pokemon.id),
        types: pokemon.types as any,
        stats: { hp: 100, attack: 100, defense: 100, spAttack: 100, spDefense: 100, speed: 100 },
      },
    };
    setTrainer(updated);
    updateUser(currentTrainer.id, { favoritePokemonId: pokemon.id, favoritePokemonName: pokemon.name, favoritePokemonTypes: pokemon.types }); // fire-and-forget
    setShowPokemonPicker(false);
    setPokemonSearch('');
  };

  const openWalletView = (view: WalletView) => {
    setWalletView(walletView === view ? null : view);
    if (view === 'withdraw') { setWithdrawAddr(''); setWithdrawAmount(''); setWithdrawStep('form'); setWithdrawError(''); }
  };

  const parsedAmount = parseFloat(withdrawAmount) || 0;
  const withdrawFee = parsedAmount * WITHDRAWAL_FEE_PCT;
  const netAmount = Math.max(0, parsedAmount - withdrawFee);
  const minAmountRequired = MIN_WITHDRAWAL_SOL;

  const validateWithdraw = () => {
    if (!isValidSolAddress(withdrawAddr)) { setWithdrawError('Please enter a valid Solana wallet address.'); return false; }
    if (parsedAmount <= 0) { setWithdrawError('Please enter an amount.'); return false; }
    if (parsedAmount < MIN_WITHDRAWAL_SOL) { setWithdrawError(`Minimum withdrawal is $${MIN_WITHDRAWAL_USD} USD (~${MIN_WITHDRAWAL_SOL.toFixed(4)} SOL).`); return false; }
    if (!currentTrainer || parsedAmount > currentTrainer.balance) { setWithdrawError('Insufficient balance.'); return false; }
    setWithdrawError(''); return true;
  };
  const handleWithdrawNext = () => { if (validateWithdraw()) setWithdrawStep('confirm'); };
  const [isLoading, setIsLoading] = useState(false);

  const handleWithdrawConfirm = async () => {
    if (!currentTrainer) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentTrainer.id,
          toAddress: withdrawAddr,
          amountSol: parsedAmount,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setWithdrawError(data.error || 'Withdrawal failed.');
        setWithdrawStep('form');
      } else {
        const updated = { ...currentTrainer, balance: currentTrainer.balance - parsedAmount };
        setTrainer(updated);
        setWithdrawStep('success');
      }
    } catch {
      setWithdrawError('Network error. Please try again.');
      setWithdrawStep('form');
    } finally {
      setIsLoading(false);
    }
  };
  const handleWithdrawClose = () => { setWalletView(null); setWithdrawAddr(''); setWithdrawAmount(''); setWithdrawStep('form'); setWithdrawError(''); };

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
  const trainerBadges: string[] = currentTrainer.badges ?? [];
  const earnedBadges = GYM_BADGES.filter(b => trainerBadges.includes(b.arenaId)).length;
  const nextBadge = GYM_BADGES.find(b => !trainerBadges.includes(b.arenaId));
  const nextBadgeProgress = nextBadge ? Math.min(100, Math.round((earnedBadges / GYM_BADGES.length) * 100)) : 100;

  return (
    <div className="h-screen overflow-hidden flex flex-col" style={{ background: 'linear-gradient(160deg, #0f0c24 0%, #151030 40%, #0d1a2e 80%, #0a0a1a 100%)' }}>

      {/* ── Badge Announcement ── */}
      <AnimatePresence>
        {badgeAnnouncement !== null && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
            onClick={() => setBadgeAnnouncement(null)}>
            <motion.div initial={{ scale: 0.4, rotate: -8 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0.5, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 280, damping: 18 }}
              className="text-center px-10 py-10 rounded-3xl max-w-sm mx-4 shadow-2xl border-2 relative overflow-hidden"
              style={{ background: 'linear-gradient(135deg, #1a0a2e, #0d1a2e)', borderColor: GYM_BADGES[badgeAnnouncement].color }}
              onClick={e => e.stopPropagation()}>
              <Particles color={GYM_BADGES[badgeAnnouncement].color} />
              <div className="text-5xl mb-3">🎉</div>
              <h2 className="text-3xl font-black text-white mb-1 uppercase tracking-wider">Badge Earned!</h2>
              <motion.img src={GYM_BADGES[badgeAnnouncement].file} alt="" className="w-28 h-28 mx-auto my-4 object-contain"
                animate={{ rotate: [0, 5, -5, 0], scale: [1, 1.08, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                style={{ filter: `drop-shadow(0 0 20px ${GYM_BADGES[badgeAnnouncement].color})` }}
              />
              <p className="font-black text-xl mb-5" style={{ color: GYM_BADGES[badgeAnnouncement].color }}>
                🏅 {GYM_BADGES[badgeAnnouncement].name}
              </p>
              <button onClick={() => setBadgeAnnouncement(null)}
                className="px-8 py-3 rounded-xl font-black text-white text-sm uppercase tracking-widest shadow-lg"
                style={{ background: `linear-gradient(135deg, ${GYM_BADGES[badgeAnnouncement].color}, #7c3aed)` }}>
                Let's Go! ⚡
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Avatar Picker ── */}
      <AnimatePresence>
        {showAvatarPicker && (
          <>
            <div className="fixed inset-0 z-40 bg-black/60" onClick={() => setShowAvatarPicker(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[420px] rounded-2xl p-4 shadow-2xl border"
              style={{ background: 'linear-gradient(135deg, #1a1040, #0d1a2e)', borderColor: `${typeColor}44` }}>
              <p className="font-black text-sm mb-3 text-white uppercase tracking-wider">Choose Your Avatar</p>
              <button onClick={() => fileInputRef.current?.click()}
                className="w-full mb-3 py-2 px-4 border-2 border-dashed rounded-xl text-sm transition-all flex items-center justify-center gap-2"
                style={{ borderColor: `${typeColor}44`, color: typeColor }}>
                <Upload className="w-4 h-4" /> Upload your own photo
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
              <div className="grid grid-cols-6 gap-2">
                {getAvatarOptions().map((opt) => (
                  <motion.button key={opt.value} whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.95 }}
                    onClick={() => handleAvatarChange(opt.value)}
                    className="aspect-square rounded-xl overflow-hidden border-2 transition-all"
                    style={{ borderColor: currentTrainer.avatar === opt.value ? typeColor : 'rgba(255,255,255,0.1)' }}>
                    {opt.type === 'image'
                      ? <img src={opt.value} alt="Avatar" className="w-full h-full object-cover" />
                      : <div className="w-full h-full bg-white/10 flex items-center justify-center text-2xl">{opt.value}</div>}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Pokémon Picker Modal ── */}
      <AnimatePresence>
        {showPokemonPicker && (
          <>
            <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" onClick={() => { setShowPokemonPicker(false); setPokemonSearch(''); }} />
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 16 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 rounded-2xl shadow-2xl border flex flex-col"
              style={{
                width: 480,
                maxWidth: '92vw',
                maxHeight: '72vh',
                background: 'linear-gradient(160deg, #1a1040 0%, #0d0a2e 100%)',
                borderColor: `${typeColor}44`,
              }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 shrink-0 border-b" style={{ borderColor: `${typeColor}22` }}>
                <p className="font-black text-white text-sm uppercase tracking-wider">Choose Your Partner Pokémon</p>
                <button onClick={() => { setShowPokemonPicker(false); setPokemonSearch(''); }}
                  className="text-white/40 hover:text-white/80 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              {/* Search */}
              <div className="px-4 py-2.5 shrink-0 border-b" style={{ borderColor: `${typeColor}22` }}>
                <input
                  type="text"
                  value={pokemonSearch}
                  onChange={e => setPokemonSearch(e.target.value)}
                  placeholder="Search Pokémon..."
                  autoFocus
                  className="w-full rounded-xl px-3 py-2 text-sm outline-none placeholder:text-white/25"
                  style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${typeColor}33`, color: 'rgba(255,255,255,0.85)' }}
                />
              </div>
              {/* Grid */}
              <div className="flex-1 overflow-y-auto p-3">
                <div className="grid grid-cols-6 gap-2">
                  {POKEMON_DATABASE
                    .filter(p => p.name.toLowerCase().includes(pokemonSearch.toLowerCase()))
                    .map(p => {
                      const isSelected = currentTrainer?.favoritePokemon.id === p.id;
                      const pTypeColor = TYPE_COLORS[p.types[0]] ?? '#6366f1';
                      return (
                        <motion.button
                          key={p.id}
                          whileHover={{ scale: 1.08 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handlePokemonChange(p)}
                          className="flex flex-col items-center gap-1 p-1.5 rounded-xl transition-all"
                          style={{
                            background: isSelected ? `${pTypeColor}22` : 'rgba(255,255,255,0.04)',
                            border: `1px solid ${isSelected ? pTypeColor : 'rgba(255,255,255,0.08)'}`,
                            boxShadow: isSelected ? `0 0 10px ${pTypeColor}44` : 'none',
                          }}
                          title={p.name}
                        >
                          <img
                            src={getPokemonSpriteUrl(p.id)}
                            alt={p.name}
                            className="w-10 h-10 object-contain"
                            style={{
                              imageRendering: 'pixelated',
                              filter: isSelected ? `drop-shadow(0 0 4px ${pTypeColor})` : 'none',
                            }}
                          />
                          <span className="text-white/60 font-bold leading-none text-center" style={{ fontSize: 8 }}>
                            {p.name}
                          </span>
                        </motion.button>
                      );
                    })}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Top nav ── */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2 shrink-0">
        <motion.button whileTap={{ scale: 0.97 }} onClick={() => setScreen('draft-mode-intro')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-bold transition-all border"
          style={{ background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)' }}>
          <ArrowLeft className="w-4 h-4" /> Arena
        </motion.button>
        <div />
        <motion.button whileTap={{ scale: 0.97 }} onClick={handleLogout}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-bold transition-all border"
          style={{ background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.5)' }}>
          <LogOut className="w-4 h-4" /> Sign Out
        </motion.button>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 overflow-hidden px-4 pb-4 grid grid-cols-5 gap-3 min-h-0">

        {/* ═══ LEFT COLUMN ═══ */}
        <div className="col-span-2 flex flex-col gap-3 min-h-0">

          {/* ── Trainer Hero Card ── */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl p-4 shadow-xl flex flex-col items-center text-center relative overflow-hidden shrink-0"
            style={{ background: 'linear-gradient(160deg, #1a1040 0%, #0d1a3e 60%, #1a0a2e 100%)', border: `1px solid ${typeColor}33` }}>
            <Particles color={typeColor} />
            {/* Type glow */}
            <div className="absolute inset-0 pointer-events-none"
              style={{ background: `radial-gradient(ellipse at 50% 0%, ${typeColor}22 0%, transparent 65%)` }} />

            {/* Avatar */}
            <div className="relative mb-3 z-10">
              {/* Outer ring glow */}
              <motion.div className="absolute -inset-2 rounded-full blur-xl"
                style={{ background: typeColor, opacity: 0.25 }}
                animate={{ opacity: [0.15, 0.4, 0.15] }}
                transition={{ duration: 2.5, repeat: Infinity }}
              />
              {/* Hexagon-inspired border frame */}
              <div className="absolute -inset-1 rounded-full" style={{ background: `conic-gradient(${typeColor}, #7c3aed, ${typeColor})`, padding: 2, borderRadius: '50%' }}>
                <div className="w-full h-full rounded-full" style={{ background: '#0d1a3e' }} />
              </div>
              <motion.div whileHover={{ scale: 1.05 }} onClick={() => setShowAvatarPicker(true)}
                className="w-24 h-24 rounded-full overflow-hidden cursor-pointer relative group z-10"
                style={{ boxShadow: `0 0 24px ${typeColor}66` }}>
                {currentTrainer.avatar?.startsWith('data:') || currentTrainer.avatar?.startsWith('/') ? (
                  <img src={currentTrainer.avatar} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-4xl"
                    style={{ background: `linear-gradient(135deg, ${typeColor}33, #7c3aed33)` }}>
                    {currentTrainer.avatar || '🧑'}
                  </div>
                )}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-full">
                  <Camera className="w-5 h-5 text-white" />
                </div>
              </motion.div>
            </div>

            {/* Trainer ID card feel */}
            <div className="z-10 w-full">
              <div className="text-xs font-black uppercase tracking-widest mb-0.5" style={{ color: `${typeColor}99` }}>
                Trainer ID
              </div>
              <h1 className="text-xl font-black text-white mb-0.5 tracking-wide">{currentTrainer.displayName}</h1>
              <p className="text-xs mb-3" style={{ color: 'rgba(255,255,255,0.35)' }}>@{currentTrainer.username}</p>

              <PokeBallDivider color={typeColor} />

              {/* Partner + Win Rate */}
              <div className="flex items-center justify-center gap-2 mt-2">
                <motion.div
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border cursor-pointer group relative"
                  style={{ background: `${typeColor}11`, borderColor: `${typeColor}33` }}
                  whileHover={{ scale: 1.04, boxShadow: `0 0 12px ${typeColor}44`, borderColor: typeColor }}
                  onClick={() => setShowPokemonPicker(true)}
                  title="Click to change your partner Pokémon"
                >
                  <motion.img
                    src={getPokemonSpriteUrl(currentTrainer.favoritePokemon.id)}
                    alt={currentTrainer.favoritePokemon.name}
                    className="w-7 h-7 object-contain"
                    style={{ imageRendering: 'pixelated', filter: `drop-shadow(0 0 4px ${typeColor})` }}
                    animate={{ y: [0, -3, 0] }} transition={{ duration: 2, repeat: Infinity }}
                  />
                  <span className="text-xs font-bold text-white/70">{currentTrainer.favoritePokemon.name}</span>

                </motion.div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border"
                  style={{ background: 'rgba(251,191,36,0.08)', borderColor: 'rgba(251,191,36,0.25)' }}>
                  <span className="text-xs font-black text-amber-400">{winRate}% WR</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* ── Stat Cards ── */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            className="grid grid-cols-3 gap-2 shrink-0">
            {/* Wins */}
            <div className="rounded-xl p-3 text-center relative overflow-hidden"
              style={{ background: 'linear-gradient(160deg, #052e16 0%, #0a1a10 100%)', border: '1px solid rgba(74,222,128,0.2)' }}>
              <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(74,222,128,0.15), transparent 70%)' }} />
              <div className="flex items-center justify-center gap-1 mb-1 relative z-10">
                <Trophy className="w-3 h-3 text-green-400" />
                <span className="text-xs font-black text-green-400 uppercase tracking-wider">Wins</span>
              </div>
              <p className="text-4xl font-black text-green-400 relative z-10" style={{ textShadow: '0 0 20px rgba(74,222,128,0.5)' }}>{wins}</p>
            </div>
            {/* Losses */}
            <div className="rounded-xl p-3 text-center relative overflow-hidden"
              style={{ background: 'linear-gradient(160deg, #2d0a0a 0%, #1a0a0a 100%)', border: '1px solid rgba(248,113,113,0.2)' }}>
              <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(248,113,113,0.15), transparent 70%)' }} />
              <div className="flex items-center justify-center gap-1 mb-1 relative z-10">
                <Target className="w-3 h-3 text-red-400" />
                <span className="text-xs font-black text-red-400 uppercase tracking-wider">Losses</span>
              </div>
              <p className="text-4xl font-black text-red-400 relative z-10" style={{ textShadow: '0 0 20px rgba(248,113,113,0.5)' }}>{losses}</p>
            </div>
            {/* P&L */}
            <div className="rounded-xl p-3 text-center relative overflow-hidden"
              style={{
                background: isProfit ? 'linear-gradient(160deg, #052e16 0%, #0a1a10 100%)' : 'linear-gradient(160deg, #2d0a0a 0%, #1a0a0a 100%)',
                border: `1px solid ${isProfit ? 'rgba(74,222,128,0.2)' : 'rgba(248,113,113,0.2)'}`,
              }}>
              <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at 50% 0%, ${isProfit ? 'rgba(74,222,128,0.12)' : 'rgba(248,113,113,0.12)'}, transparent 70%)` }} />
              {/* shimmer */}
              <motion.div className="absolute inset-0 opacity-0"
                style={{ background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.06) 50%, transparent 60%)' }}
                animate={{ opacity: [0, 1, 0], x: ['-100%', '200%'] }}
                transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 3 }}
              />
              <div className="flex items-center justify-center gap-1 mb-1 relative z-10">
                {isProfit ? <TrendingUp className="w-3 h-3 text-green-400" /> : <TrendingDown className="w-3 h-3 text-red-400" />}
                <span className={`text-xs font-black uppercase tracking-wider ${isProfit ? 'text-green-400' : 'text-red-400'}`}>P&L</span>
              </div>
              <p className={`text-2xl font-black relative z-10 ${isProfit ? 'text-green-400' : 'text-red-400'}`}
                style={{ textShadow: `0 0 16px ${isProfit ? 'rgba(74,222,128,0.5)' : 'rgba(248,113,113,0.5)'}` }}>
                {isProfit ? '+' : ''}{earnings.toFixed(2)}
              </p>
              <p className="text-xs relative z-10" style={{ color: 'rgba(255,255,255,0.3)' }}>SOL</p>
            </div>
          </motion.div>

          {/* ── Gym Badges ── */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="rounded-2xl p-3 shadow-xl flex-1 flex flex-col relative overflow-hidden min-h-0"
            style={{ background: 'linear-gradient(160deg, #1a1040 0%, #0d0a2e 100%)', border: '1px solid rgba(168,85,247,0.2)' }}>
            <Particles color="#a855f7" />

            <div className="flex items-center justify-between mb-2 shrink-0 relative z-10">
              <span className="font-black text-white uppercase tracking-wider text-xs">Kanto Journey</span>
              <span className="text-xs font-black px-2 py-0.5 rounded-full" style={{ background: 'rgba(168,85,247,0.15)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.3)' }}>
                {earnedBadges}/8
              </span>
            </div>

            {/* Journey path — 4 per row */}
            <div className="grid grid-cols-4 gap-1 flex-1 content-center relative z-10">
              {GYM_BADGES.map((badge) => {
                const earned = trainerBadges.includes(badge.arenaId);
                return <BadgeTile key={badge.name} badge={badge} earned={earned} />;
              })}
            </div>


          </motion.div>
        </div>

        {/* ═══ RIGHT COLUMN ═══ */}
        <div className="col-span-3 flex flex-col gap-3 min-h-0">

          {/* ── Battle Funds ── */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            className="rounded-2xl shadow-xl shrink-0 relative overflow-hidden"
            style={{ background: 'linear-gradient(160deg, #1a0a2e 0%, #2d0a1e 100%)', border: '1px solid rgba(236,72,153,0.25)' }}>
            {/* Shimmer on funds */}
            <motion.div className="absolute inset-0 pointer-events-none"
              style={{ background: 'linear-gradient(105deg, transparent 30%, rgba(236,72,153,0.06) 50%, transparent 70%)' }}
              animate={{ x: ['-100%', '200%'] }}
              transition={{ duration: 3, repeat: Infinity, repeatDelay: 4 }}
            />
            <div className="px-4 py-3 flex items-center justify-between border-b relative z-10" style={{ borderColor: 'rgba(236,72,153,0.15)' }}>
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-pink-400" />
                <span className="font-black text-white text-sm uppercase tracking-wider">Battle Funds</span>
                <span className="font-black text-pink-300 text-sm" style={{ textShadow: '0 0 12px rgba(236,72,153,0.5)' }}>
                  {currentTrainer.balance.toFixed(4)} SOL
                </span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => openWalletView('deposit')}
                  className="px-3 py-1.5 rounded-lg font-black text-xs transition-all flex items-center gap-1 border"
                  style={walletView === 'deposit'
                    ? { background: 'linear-gradient(135deg,#7c3aed,#6d28d9)', color: '#fff', borderColor: 'transparent' }
                    : { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)', borderColor: 'rgba(255,255,255,0.1)' }}>
                  <ArrowDown className="w-3 h-3" /> Deposit
                </button>
                <button onClick={() => openWalletView('withdraw')} disabled={testingMode}
                  className="px-3 py-1.5 rounded-lg font-black text-xs transition-all flex items-center gap-1 disabled:opacity-40 border"
                  style={walletView === 'withdraw'
                    ? { background: 'linear-gradient(135deg,#ea580c,#c2410c)', color: '#fff', borderColor: 'transparent' }
                    : { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)', borderColor: 'rgba(255,255,255,0.1)' }}>
                  <ArrowDown className="w-3 h-3 rotate-180" /> Withdraw
                </button>
              </div>
            </div>

            <AnimatePresence>
              {walletView === 'deposit' && (
                <motion.div key="deposit" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden relative z-10">
                  <div className="p-4">
                    {testingMode ? (
                      <div className="rounded-xl p-3 text-center border" style={{ background: 'rgba(74,222,128,0.08)', borderColor: 'rgba(74,222,128,0.2)' }}>
                        <p className="text-green-400 font-black">🎮 Testing Mode — {currentTrainer.balance.toLocaleString()} SOL</p>
                      </div>
                    ) : (
                      <div className="rounded-xl p-3 border" style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(168,85,247,0.2)' }}>
                        <p className="text-white/50 text-xs mb-2">Send <span className="font-black text-purple-400">SOL</span> to your Arena 151 wallet:</p>
                        <div className="rounded-lg p-2.5 flex items-center gap-2 mb-2 border" style={{ background: 'rgba(0,0,0,0.3)', borderColor: 'rgba(255,255,255,0.08)' }}>
                          <code className="flex-1 font-mono text-xs text-white/50 break-all">{currentTrainer.internalWalletId}</code>
                          <button onClick={copyAddress} className="shrink-0 px-3 py-1.5 rounded-lg text-white text-xs font-black flex items-center gap-1"
                            style={{ background: 'linear-gradient(135deg,#7c3aed,#6d28d9)' }}>
                            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />} {copied ? 'Copied!' : 'Copy'}
                          </button>
                        </div>
                        <div className="flex gap-1.5 text-xs">
                          {['SOL only', 'Min 0.01 SOL', '~1 min'].map(t => (
                            <div key={t} className="flex-1 rounded-lg p-1.5 text-center border text-center" style={{ background: 'rgba(168,85,247,0.08)', borderColor: 'rgba(168,85,247,0.15)' }}>
                              <span className="text-purple-400 font-bold">{t}</span>
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
                <motion.div key="withdraw" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden relative z-10">
                  <div className="p-4">
                    {withdrawStep === 'success' && (
                      <div className="text-center py-2">
                        <div className="text-3xl mb-1">✅</div>
                        <p className="font-black text-white text-sm mb-1">Withdrawal Submitted</p>
                        <p className="text-xs text-white/40 mb-2">{netAmount.toFixed(4)} SOL received (0.5% fee applied)</p>
                        <button onClick={handleWithdrawClose} className="px-5 py-1.5 rounded-xl font-black text-sm border" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', borderColor: 'rgba(255,255,255,0.1)' }}>Done</button>
                      </div>
                    )}
                    {withdrawStep === 'confirm' && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        <div className="rounded-xl p-2.5 mb-2 text-xs border" style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.2)', color: '#f87171' }}>
                          <p className="font-black mb-0.5">⚠️ Irreversible — verify address first</p>
                          <p className="font-mono break-all">{withdrawAddr}</p>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5 mb-2 text-center text-xs">
                          {[['Send', parsedAmount.toFixed(4), 'text-white/60'], ['Fee (0.5%)', `−${withdrawFee.toFixed(4)}`, 'text-orange-400'], ['Receive', netAmount.toFixed(4), 'text-green-400']].map(([l, v, c]) => (
                            <div key={l} className="rounded-lg p-2 border" style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)' }}>
                              <p className="text-white/40">{l}</p><p className={`font-black ${c}`}>{v}</p>
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => setWithdrawStep('form')} disabled={isLoading} className="flex-1 py-1.5 rounded-xl font-bold text-xs border disabled:opacity-40" style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.5)', borderColor: 'rgba(255,255,255,0.1)' }}>← Back</button>
                          <button onClick={handleWithdrawConfirm} disabled={isLoading} className="flex-1 py-1.5 rounded-xl font-black text-white text-xs disabled:opacity-60" style={{ background: 'linear-gradient(135deg,#ea580c,#c2410c)' }}>{isLoading ? 'Sending…' : 'Confirm'}</button>
                        </div>
                      </motion.div>
                    )}
                    {withdrawStep === 'form' && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        <div className="rounded-xl p-2.5 mb-2 flex gap-1.5 text-xs border" style={{ background: 'rgba(234,88,12,0.08)', borderColor: 'rgba(234,88,12,0.2)', color: '#fb923c' }}>
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          <p><span className="font-black">SOL only.</span> Wrong address = permanent loss.</p>
                        </div>
                        <input type="text" value={withdrawAddr} onChange={e => setWithdrawAddr(e.target.value)} placeholder="Solana wallet address"
                          className="w-full rounded-lg px-3 py-2 font-mono text-xs placeholder:text-white/20 outline-none mb-1.5 transition-colors"
                          style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)' }} />
                        <div className="relative mb-1.5">
                          <input type="number" value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)}
                            placeholder={`Min ${minAmountRequired.toFixed(4)} SOL (~$${MIN_WITHDRAWAL_USD})`}
                            className="w-full rounded-lg px-3 py-2 text-sm placeholder:text-white/20 outline-none transition-colors pr-12"
                            style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)' }} />
                          <button onClick={() => setWithdrawAmount(currentTrainer.balance.toFixed(4))}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-black" style={{ color: '#fb923c' }}>MAX</button>
                        </div>
                        {withdrawError && (
                          <div className="rounded-lg p-2 mb-1.5 text-xs flex gap-1 border" style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.2)', color: '#f87171' }}>
                            <X className="w-3 h-3 shrink-0 mt-0.5" />{withdrawError}
                          </div>
                        )}
                        {parsedAmount > 0 && (
                          <p className="text-xs text-center mb-1.5 text-orange-300/70">
                            Send {parsedAmount.toFixed(4)} SOL → Receive {netAmount.toFixed(4)} SOL (0.5% fee)
                          </p>
                        )}
                        <button onClick={handleWithdrawNext} className="w-full py-2 rounded-xl font-black text-white text-sm" style={{ background: 'linear-gradient(135deg,#ea580c,#c2410c)' }}>Review →</button>
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* ── Recent Battles ── */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="rounded-2xl shadow-xl flex-1 flex flex-col overflow-hidden min-h-0 relative"
            style={{ background: 'linear-gradient(160deg, #0d1a2e 0%, #1a0a1e 100%)', border: '1px solid rgba(239,68,68,0.2)' }}>

            {/* Header */}
            <div className="px-4 py-3 shrink-0 relative" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Swords className="w-4 h-4 text-rose-400" />
                  <span className="font-black text-white uppercase tracking-wider text-sm">Recent Battles</span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span>
                    <span className="font-black text-green-400">{wins}W</span>
                    <span className="text-white/30 mx-1">·</span>
                    <span className="font-black text-red-400">{losses}L</span>
                  </span>
                  <span className="font-black px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}>
                    {winRate}% WR
                  </span>
                </div>
              </div>
            </div>

            {/* Battle rows — real data from localStorage */}
            <div className="flex-1 overflow-y-auto">
              {recentBattles.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-10 gap-3">
                  <div className="text-4xl opacity-30">⚔️</div>
                  <p className="font-black text-white/30 text-sm uppercase tracking-wider">No battles yet</p>
                  <p className="text-xs text-white/20 text-center px-6">
                    Complete your first battle and your real match history will appear here.
                  </p>
                </div>
              ) : (
                recentBattles.map((battle, idx) => {
                  const isWin = battle.winner === currentTrainer?.displayName ||
                                battle.winner === currentTrainer?.username;
                  const opponent = isWin ? battle.loser : battle.winner;
                  return (
                    <motion.div key={idx}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.15 + idx * 0.05 }}
                      whileHover={{ backgroundColor: 'rgba(255,255,255,0.04)', x: 2 }}
                      className="flex items-center justify-between px-4 py-3 cursor-default transition-colors relative"
                      style={{
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        borderLeft: `3px solid ${isWin ? '#4ade80' : '#f87171'}`,
                      }}>
                      <div className="absolute left-0 top-0 bottom-0 w-16 pointer-events-none"
                        style={{ background: `linear-gradient(to right, ${isWin ? 'rgba(74,222,128,0.06)' : 'rgba(248,113,113,0.06)'}, transparent)` }} />

                      <div className="flex items-center gap-3 relative z-10">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-lg"
                          style={{ background: isWin ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)', border: `1px solid ${isWin ? 'rgba(74,222,128,0.2)' : 'rgba(248,113,113,0.2)'}` }}>
                          {battle.arenaEmoji ?? '⚔️'}
                        </div>
                        <div>
                          <p className="font-black text-white text-sm">
                            <span style={{ color: 'rgba(255,255,255,0.5)' }}>
                              {isWin ? battle.winner : battle.loser}
                            </span>
                            <span className="text-white/30 mx-1">vs</span>
                            <span style={{ color: isWin ? '#86efac' : '#fca5a5' }}>{opponent}</span>
                          </p>
                          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>{battle.arena}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 relative z-10">
                        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>{timeAgo(battle.timestamp)}</span>
                        <motion.span
                          className="text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider"
                          style={isWin
                            ? { background: 'rgba(74,222,128,0.15)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)', textShadow: '0 0 8px rgba(74,222,128,0.5)' }
                            : { background: 'rgba(248,113,113,0.12)', color: '#f87171', border: '1px solid rgba(248,113,113,0.25)' }
                          }
                          whileHover={{ scale: 1.05 }}
                        >
                          {isWin ? '✓ WIN' : '✗ LOSS'}
                        </motion.span>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </motion.div>

        </div>
      </div>
    </div>
  );
}
