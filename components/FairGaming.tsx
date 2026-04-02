'use client';

import { motion } from 'framer-motion';
import { ArrowLeft, Shield, Swords, Shuffle, Scale, AlertTriangle } from 'lucide-react';
import { useArenaStore } from '@/lib/store';

export default function FairGaming() {
  const { setScreen } = useArenaStore();

  return (
    <div
      className="min-h-screen text-white overflow-y-auto"
      style={{ background: 'linear-gradient(160deg, #0f0c24 0%, #151030 40%, #0d1a2e 80%, #0a0a1a 100%)' }}
    >
      {/* Header */}
      <div className="sticky top-0 z-10 px-4 py-3 flex items-center gap-3 border-b"
        style={{ background: 'rgba(10,8,30,0.92)', backdropFilter: 'blur(12px)', borderColor: 'rgba(168,85,247,0.2)' }}>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => setScreen('draft-mode-intro')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-bold border transition-all"
          style={{ background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)' }}
        >
          <ArrowLeft className="w-4 h-4" /> Arena
        </motion.button>
        <div>
          <h1 className="font-black text-white text-lg leading-none">Fair Gaming &amp; Legal</h1>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Arena 151 Transparency &amp; Compliance</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-10">

        {/* ── FAIR GAMING CHARTER ── */}
        <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
              style={{ background: 'linear-gradient(135deg, #7c3aed33, #6d28d966)', border: '1px solid rgba(168,85,247,0.3)' }}>
              🎯
            </div>
            <div>
              <h2 className="text-2xl font-black tracking-wide text-white">Fair Gaming Charter</h2>
              <p className="text-sm" style={{ color: 'rgba(168,85,247,0.8)' }}>Transparent, verifiable, and impartial</p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Provably Fair */}
            <div className="rounded-2xl p-5 border"
              style={{ background: 'linear-gradient(135deg, #1a1040, #0d0a2e)', borderColor: 'rgba(168,85,247,0.25)' }}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">🎯</span>
                <h3 className="font-black text-lg text-purple-300">Provably Fair</h3>
              </div>
              <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>
                All battle outcomes are determined by a transparent algorithm. Move selection, damage calculations, and type
                effectiveness use the same mathematical formulas for every player, every battle. No hidden modifiers,
                no house advantages in gameplay.
              </p>
            </div>

            {/* How Battles Work */}
            <div className="rounded-2xl p-5 border"
              style={{ background: 'linear-gradient(135deg, #1a1040, #0d0a2e)', borderColor: 'rgba(99,102,241,0.25)' }}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">⚔️</span>
                <h3 className="font-black text-lg text-indigo-300">How Battles Work</h3>
              </div>
              <ul className="space-y-2 text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>
                {[
                  'Each Pokémon has base stats (HP, Attack, Defense, Speed)',
                  'Moves are selected by weighted random based on: move power, type effectiveness against the current opponent, momentum state, and remaining PP',
                  'Critical hits occur at a fixed 6.25% base rate, modified by certain moves — same as the mainline games',
                  'Status effects (sleep, poison) use fixed probability thresholds',
                  'The drafting system uses a point-based budget (75 points) — every player builds their team under identical constraints',
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="mt-1 shrink-0 w-1.5 h-1.5 rounded-full bg-indigo-400" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Randomness */}
            <div className="rounded-2xl p-5 border"
              style={{ background: 'linear-gradient(135deg, #1a1040, #0d0a2e)', borderColor: 'rgba(56,189,248,0.25)' }}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">🔀</span>
                <h3 className="font-black text-lg text-cyan-300">Randomness</h3>
              </div>
              <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>
                Arena 151 uses a seeded pseudo-random number generator (PRNG). The seed is derived from the match ID and
                timestamp, making it deterministic and reproducible. This means any battle can be independently replayed
                and verified.
              </p>
            </div>

            {/* No Interference */}
            <div className="rounded-2xl p-5 border"
              style={{ background: 'linear-gradient(135deg, #1a1040, #0d0a2e)', borderColor: 'rgba(74,222,128,0.2)' }}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">👨‍⚖️</span>
                <h3 className="font-black text-lg text-green-300">No Interference</h3>
              </div>
              <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>
                No Arena 151 employee, moderator, or automated system has the ability to alter battle outcomes after a
                match begins. The battle engine runs entirely client-side.
              </p>
            </div>
          </div>
        </motion.section>

        {/* Divider */}
        <div className="flex items-center gap-4">
          <div className="flex-1 h-px" style={{ background: 'linear-gradient(to right, transparent, rgba(168,85,247,0.3))' }} />
          <Shield className="w-5 h-5" style={{ color: 'rgba(168,85,247,0.5)' }} />
          <div className="flex-1 h-px" style={{ background: 'linear-gradient(to left, transparent, rgba(168,85,247,0.3))' }} />
        </div>

        {/* ── AML POLICY ── */}
        <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
              style={{ background: 'linear-gradient(135deg, #0f172a, #1e1b4b)', border: '1px solid rgba(99,102,241,0.35)' }}>
              🛡️
            </div>
            <div>
              <h2 className="text-2xl font-black tracking-wide text-white">Anti-Money Laundering Policy</h2>
              <p className="text-sm" style={{ color: 'rgba(99,102,241,0.8)' }}>Committed to preventing illicit financial activity</p>
            </div>
          </div>

          <p className="text-sm mb-5 leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)' }}>
            Arena 151 is committed to preventing the use of our platform for money laundering or illicit financial activity.
          </p>

          <div className="space-y-4">
            {[
              {
                title: '🪪 Identity & Verification',
                color: 'rgba(99,102,241,0.25)',
                items: [
                  'All accounts require a valid email address',
                  'Arena 151 reserves the right to request additional identity verification for large withdrawals (>$500 equivalent)',
                  'We may request government-issued ID for high-volume accounts',
                ],
              },
              {
                title: '📊 Transaction Monitoring',
                color: 'rgba(56,189,248,0.2)',
                items: [
                  'Unusual transaction patterns (rapid deposits/withdrawals, large volumes) are flagged for manual review',
                  'Arena 151 reserves the right to freeze accounts pending investigation',
                ],
              },
              {
                title: '🚫 Prohibited Activities',
                color: 'rgba(239,68,68,0.2)',
                items: [
                  'Using Arena 151 to layer or integrate proceeds of illegal activity',
                  'Creating multiple accounts to circumvent withdrawal limits',
                  'Structuring transactions to avoid reporting thresholds',
                ],
              },
            ].map(({ title, color, items }) => (
              <div key={title} className="rounded-2xl p-5 border"
                style={{ background: 'linear-gradient(135deg, #0d1a2e, #0a0a1a)', borderColor: color }}>
                <h3 className="font-black text-base text-white mb-3">{title}</h3>
                <ul className="space-y-2 text-sm" style={{ color: 'rgba(255,255,255,0.65)' }}>
                  {items.map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="mt-1 shrink-0 w-1.5 h-1.5 rounded-full bg-slate-500" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            {/* Reporting */}
            <div className="rounded-2xl p-5 border"
              style={{ background: 'linear-gradient(135deg, #0d1a2e, #0a0a1a)', borderColor: 'rgba(251,191,36,0.2)' }}>
              <h3 className="font-black text-base text-white mb-2">📋 Reporting</h3>
              <p className="text-sm mb-2" style={{ color: 'rgba(255,255,255,0.65)' }}>
                Arena 151 will cooperate fully with law enforcement requests and may report suspicious activity as required
                by applicable law.
              </p>
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
                For AML-related inquiries:{' '}
                <a href="mailto:legal@arena151.gg" className="text-amber-400 hover:text-amber-300 transition-colors">
                  legal@arena151.gg
                </a>
              </p>
            </div>
          </div>
        </motion.section>

        {/* Divider */}
        <div className="flex items-center gap-4">
          <div className="flex-1 h-px" style={{ background: 'linear-gradient(to right, transparent, rgba(74,222,128,0.3))' }} />
          <span className="text-lg">💚</span>
          <div className="flex-1 h-px" style={{ background: 'linear-gradient(to left, transparent, rgba(74,222,128,0.3))' }} />
        </div>

        {/* ── RESPONSIBLE GAMING ── */}
        <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
              style={{ background: 'linear-gradient(135deg, #052e16, #064e3b)', border: '1px solid rgba(74,222,128,0.3)' }}>
              💚
            </div>
            <div>
              <h2 className="text-2xl font-black tracking-wide text-white">Responsible Gaming</h2>
              <p className="text-sm" style={{ color: 'rgba(74,222,128,0.7)' }}>Your wellbeing comes first</p>
            </div>
          </div>

          <div className="rounded-2xl p-6 border"
            style={{ background: 'linear-gradient(135deg, #052e16, #0a1a10)', borderColor: 'rgba(74,222,128,0.25)' }}>
            <p className="text-sm mb-4 leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>
              We take responsible gaming seriously. If you or someone you know may have a problem:
            </p>
            <ul className="space-y-3 text-sm">
              <li className="flex items-center gap-3">
                <span className="text-green-400 text-lg">📞</span>
                <div>
                  <span className="font-black text-white">National Problem Gambling Helpline: </span>
                  <a href="tel:18005224700" className="text-green-400 hover:text-green-300 font-bold transition-colors">1-800-522-4700</a>
                </div>
              </li>
              <li className="flex items-center gap-3">
                <span className="text-green-400 text-lg">🌐</span>
                <a href="https://ncpgambling.org" target="_blank" rel="noopener noreferrer"
                  className="text-green-400 hover:text-green-300 font-bold transition-colors">ncpgambling.org</a>
              </li>
              <li className="flex items-center gap-3">
                <span className="text-green-400 text-lg">⚙️</span>
                <span style={{ color: 'rgba(255,255,255,0.65)' }}>Set deposit limits in your profile settings</span>
              </li>
              <li className="flex items-center gap-3">
                <span className="text-green-400 text-lg">🚪</span>
                <span style={{ color: 'rgba(255,255,255,0.65)' }}>
                  Self-exclusion available — contact{' '}
                  <a href="mailto:support@arena151.gg" className="text-green-400 hover:text-green-300 transition-colors">
                    support@arena151.gg
                  </a>
                </span>
              </li>
            </ul>
          </div>
        </motion.section>

        {/* ── HOUSE FEES SUMMARY ── */}
        <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
              style={{ background: 'linear-gradient(135deg, #1a0a2e, #2d0a1e)', border: '1px solid rgba(236,72,153,0.3)' }}>
              💰
            </div>
            <div>
              <h2 className="text-2xl font-black tracking-wide text-white">Fee Schedule</h2>
              <p className="text-sm" style={{ color: 'rgba(236,72,153,0.7)' }}>Simple, transparent pricing</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-2xl p-5 border"
              style={{ background: 'linear-gradient(135deg, #1a0a2e, #2d0a1e)', borderColor: 'rgba(236,72,153,0.25)' }}>
              <h3 className="font-black text-pink-300 mb-2">⚔️ Wager Battles</h3>
              <p className="text-3xl font-black text-white mb-1">5%</p>
              <p className="text-xs mb-3" style={{ color: 'rgba(255,255,255,0.5)' }}>house fee on all wagered battles</p>
              <div className="rounded-lg p-3 text-xs" style={{ background: 'rgba(0,0,0,0.3)', color: 'rgba(255,255,255,0.5)' }}>
                <p className="mb-1 font-bold text-white/70">Example:</p>
                <p>2 players × 1 SOL = 2 SOL pot</p>
                <p>Winner receives <span className="text-green-400 font-bold">1.9 SOL</span></p>
                <p>Arena 151 takes <span className="text-pink-400 font-bold">0.1 SOL</span></p>
              </div>
            </div>

            <div className="rounded-2xl p-5 border"
              style={{ background: 'linear-gradient(135deg, #1a0a2e, #1a1040)', borderColor: 'rgba(168,85,247,0.25)' }}>
              <h3 className="font-black text-purple-300 mb-2">💸 Withdrawals</h3>
              <p className="text-3xl font-black text-white mb-1">0.5%</p>
              <p className="text-xs mb-3" style={{ color: 'rgba(255,255,255,0.5)' }}>processing fee on all withdrawals</p>
              <div className="rounded-lg p-3 text-xs" style={{ background: 'rgba(0,0,0,0.3)', color: 'rgba(255,255,255,0.5)' }}>
                <p className="mb-1 font-bold text-white/70">Example:</p>
                <p>Withdraw 10 SOL</p>
                <p>Receive <span className="text-green-400 font-bold">9.95 SOL</span></p>
                <p>Fee: <span className="text-purple-400 font-bold">0.05 SOL</span></p>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-xl p-4 border text-sm text-center"
            style={{ background: 'rgba(74,222,128,0.06)', borderColor: 'rgba(74,222,128,0.15)', color: 'rgba(255,255,255,0.5)' }}>
            ✅ Free (no-wager) practice battles have <span className="text-green-400 font-bold">zero fees</span>
          </div>
        </motion.section>

        {/* Footer */}
        <div className="text-center text-xs pb-8" style={{ color: 'rgba(255,255,255,0.2)' }}>
          Arena 151 · legal@arena151.gg · v1.0
        </div>
      </div>
    </div>
  );
}
