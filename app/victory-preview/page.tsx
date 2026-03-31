'use client'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const TRAINERS = [
  { id: 'red',         name: 'Red',           color: '#ef4444', spriteUrl: '/trainers/red.png',         winQuote: '... [He tips his cap and disappears into the silence of Mt. Silver.]' },
  { id: 'ash',         name: 'Ash',           color: '#3b82f6', spriteUrl: '/trainers/ash.png',         winQuote: 'I knew Pikachu believed in me! The real victory was the friends I made!' },
  { id: 'gary',        name: 'Gary',          color: '#a855f7', spriteUrl: '/trainers/gary.png',        winQuote: 'Did you really think you had a chance? Smell ya later, loser.' },
  { id: 'oak',         name: 'Prof. Oak',     color: '#84cc16', spriteUrl: '/trainers/oak.png',         winQuote: 'Fascinating data! I may need to update my Pokédex after witnessing this.' },
  { id: 'brock',       name: 'Brock',         color: '#92400e', spriteUrl: '/trainers/brock.png',       winQuote: 'Rock solid. Literally. Better luck next decade.' },
  { id: 'misty',       name: 'Misty',         color: '#0ea5e9', spriteUrl: '/trainers/misty.png',       winQuote: "Was that even a battle? I've fought tougher Magikarps." },
  { id: 'surge',       name: 'Lt. Surge',     color: '#eab308', spriteUrl: '/trainers/surge.png',       winQuote: "HAHA! That's what happens when you bring a rowboat to a warship!" },
  { id: 'erika',       name: 'Erika',         color: '#22c55e', spriteUrl: '/trainers/erika.png',       winQuote: 'Oh my, was that over already? I nearly dozed off.' },
  { id: 'koga',        name: 'Koga',          color: '#a16207', spriteUrl: '/trainers/koga.png',        winQuote: 'Poison... patience... perfection. You had none of these.' },
  { id: 'sabrina',     name: 'Sabrina',       color: '#e879f9', spriteUrl: '/trainers/sabrina.png',     winQuote: 'I saw your defeat before you made your first move.' },
  { id: 'blaine',      name: 'Blaine',        color: '#f97316', spriteUrl: '/trainers/blaine.png',      winQuote: 'HOT DAMN! You just got burned by the master of fire!' },
  { id: 'giovanni',    name: 'Giovanni',      color: '#6b7280', spriteUrl: '/trainers/giovanni.png',    winQuote: "The strong take what they want. That's simply how the world works." },
  { id: 'lorelei',     name: 'Lorelei',       color: '#38bdf8', spriteUrl: '/trainers/lorelei.png',     winQuote: "Ice doesn't melt. Neither does my contempt for weak trainers." },
  { id: 'bruno',       name: 'Bruno',         color: '#dc2626', spriteUrl: '/trainers/bruno.png',       winQuote: "Power and discipline. You had neither. Train harder." },
  { id: 'agatha',      name: 'Agatha',        color: '#7c3aed', spriteUrl: '/trainers/agatha.png',      winQuote: 'Even my ghosts are stronger than you, dearie. Run along.' },
  { id: 'fuji',        name: 'Mr. Fuji',      color: '#a78bfa', spriteUrl: '/trainers/fuji.png',        winQuote: "I have made peace with what I've done. My Pokémon still fight on." },
  { id: 'jessie-james',name: 'Jessie & James',color: '#e11d48', spriteUrl: '/trainers/jessie-james.png',winQuote: "Prepare for trouble — make it double! We actually won for once!" },
  { id: 'lance',       name: 'Lance',         color: '#b91c1c', spriteUrl: '/trainers/lance.png',       winQuote: "Dragon Masters don't lose. That's not arrogance — it's the truth." },
]

// Per-trainer size/position overrides
const TRAINER_OVERRIDES: Record<string, { height?: string; left?: string; bottom?: string }> = {
  'gary':        { height: '50vh', left: '41%' },
  'surge':       { height: '50vh', left: '41%' },
  'koga':        { left: '42%' },
  'sabrina':     { height: '48vh', left: '42%' },
  'blaine':      { height: '50vh' },
  'giovanni':    { height: '50vh', left: '41%' },
  'lorelei':     { height: '52vh', left: '40%' },
  'bruno':       { height: '50vh', left: '41%' },
  'jessie-james':{ height: '72vh', bottom: '20%', left: '38%' },
}

function SpeedLines({ color }: { color: string }) {
  return (
    <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      viewBox="0 0 800 600" preserveAspectRatio="xMidYMid slice">
      {Array.from({ length: 32 }).map((_, i) => {
        const angle = (i / 32) * 360
        const rad = angle * Math.PI / 180
        const cx = 400, cy = 300
        return (
          <line key={i}
            x1={cx + Math.cos(rad) * 80} y1={cy + Math.sin(rad) * 60}
            x2={cx + Math.cos(rad) * 600} y2={cy + Math.sin(rad) * 500}
            stroke={color}
            strokeWidth={i % 4 === 0 ? 4 : i % 2 === 0 ? 2 : 1}
            opacity={i % 4 === 0 ? 0.6 : 0.2}
          />
        )
      })}
    </svg>
  )
}

function VictoryView({ trainer, loserName }: { trainer: typeof TRAINERS[0], loserName: string }) {
  const [showQuote, setShowQuote] = useState(false)
  const [displayed, setDisplayed] = useState('')
  const [showButton, setShowButton] = useState(false)
  const wColor = trainer.color
  const quote = trainer.winQuote

  useEffect(() => {
    setShowQuote(false); setDisplayed(''); setShowButton(false)
    const t = setTimeout(() => setShowQuote(true), 600)
    return () => clearTimeout(t)
  }, [trainer.id])

  useEffect(() => {
    if (!showQuote) return
    setDisplayed('')
    let i = 0
    const iv = setInterval(() => {
      i++
      setDisplayed(quote.slice(0, i))
      if (i >= quote.length) { clearInterval(iv); setTimeout(() => setShowButton(true), 300) }
    }, 28)
    return () => clearInterval(iv)
  }, [showQuote, trainer.id])

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative', background: '#000' }}>

      {/* Background */}
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'url(/victory-bg.png)', backgroundSize: 'cover', backgroundPosition: 'center' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} />
      <div style={{ position: 'absolute', inset: 0, opacity: 0.5 }}><SpeedLines color={wColor} /></div>
      <div style={{ position: 'absolute', inset: 0, backgroundImage: `radial-gradient(${wColor}18 1.5px, transparent 1.5px)`, backgroundSize: '22px 22px' }} />

      {/* Name + WINS — top center */}
      <motion.div key={trainer.id + '-name'}
        initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, type: 'spring', stiffness: 300, damping: 28 }}
        style={{ position: 'absolute', top: '4%', left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 10 }}
      >
        <div style={{ fontFamily: '"Impact","Arial Black",sans-serif', fontSize: 64, fontWeight: 900, lineHeight: 0.95, color: wColor, textShadow: `0 0 40px ${wColor}, 4px 4px 0 rgba(0,0,0,0.9)`, textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'center' }}>
          {trainer.name}
        </div>
        <div style={{ fontFamily: '"Impact","Arial Black",sans-serif', fontSize: 28, fontWeight: 900, color: '#fff', letterSpacing: '0.5em', textTransform: 'uppercase', textShadow: '2px 2px 0 rgba(0,0,0,0.8)' }}>
          WINS!
        </div>
        <div style={{ color: '#94a3b8', fontSize: 12, fontWeight: 600, letterSpacing: '0.15em', marginTop: 4, textTransform: 'uppercase' }}>
          defeated {loserName}
        </div>
      </motion.div>

      {/* Trainer sprite */}
      {(() => {
        const ov = TRAINER_OVERRIDES[trainer.id] ?? {}
        const spriteH = ov.height ?? '58vh'
        const spriteLeft = ov.left ?? '39%'
        const spriteBottom = ov.bottom ?? '28%'
        return (
          <motion.div key={trainer.id + '-sprite'}
            initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 220, damping: 22, delay: 0.05 }}
            style={{ position: 'absolute', bottom: spriteBottom, left: spriteLeft, transform: 'translateX(-50%)', zIndex: 5 }}
          >
            <div style={{ position: 'absolute', bottom: -8, left: '50%', transform: 'translateX(-50%)', width: 260, height: 60, background: `radial-gradient(ellipse, ${wColor}77 0%, transparent 70%)`, filter: 'blur(12px)', pointerEvents: 'none' }} />
            <img src={trainer.spriteUrl} alt={trainer.name} style={{
              height: spriteH,
              width: 'auto', objectFit: 'contain', objectPosition: 'bottom center',
              imageRendering: 'pixelated',
              filter: `drop-shadow(0 0 28px ${wColor}) drop-shadow(0 0 56px ${wColor}88)`,
              display: 'block',
            }} />
          </motion.div>
        )
      })()}

      {/* Speech bubble */}
      <AnimatePresence>
        {showQuote && (
          <motion.div key={trainer.id + '-quote'}
            initial={{ opacity: 0, x: 20, scale: 0.9 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0 }}
            transition={{ type: 'spring', stiffness: 280, damping: 26 }}
            style={{ position: 'absolute', top: '27%', left: '60%', maxWidth: '26%', zIndex: 10 }}
          >
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', top: 22, left: -20, width: 0, height: 0, borderTop: '12px solid transparent', borderBottom: '12px solid transparent', borderRight: '20px solid #181818' }} />
              <div style={{ position: 'absolute', top: 24, left: -15, width: 0, height: 0, borderTop: '10px solid transparent', borderBottom: '10px solid transparent', borderRight: '16px solid #f8f8e0' }} />
              <div style={{ background: '#f8f8e0', border: '4px solid #181818', borderRadius: 6, padding: '16px 20px', boxShadow: '5px 5px 0 #181818' }}>
                <div style={{ fontFamily: '"Courier New",monospace', fontSize: 15, fontWeight: 700, color: '#181818', letterSpacing: '0.02em', lineHeight: 1.6, minHeight: 48 }}>
                  &ldquo;{displayed}
                  <motion.span animate={{ opacity: [1, 0, 1] }} transition={{ duration: 0.55, repeat: Infinity }} style={{ marginLeft: 1 }}>▎</motion.span>
                  &rdquo;
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* VIEW RESULTS */}
      <AnimatePresence>
        {showButton && (
          <motion.button key={trainer.id + '-btn'}
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            whileHover={{ scale: 1.06, boxShadow: `0 0 32px ${wColor}aa` }} whileTap={{ scale: 0.96 }}
            onClick={() => {}}
            style={{ position: 'absolute', bottom: '3%', left: 0, right: 0, marginLeft: '6%', marginRight: 'auto', width: 'fit-content', zIndex: 20, padding: '14px 48px', background: wColor, border: '3px solid white', borderRadius: 4, color: '#fff', fontSize: 18, fontWeight: 900, fontFamily: '"Impact","Arial Black",sans-serif', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', boxShadow: `0 5px 0 rgba(0,0,0,0.5), 0 0 22px ${wColor}77`, whiteSpace: 'nowrap' }}
          >
            VIEW RESULTS →
          </motion.button>
        )}
      </AnimatePresence>

      {/* Trainer switcher */}
      <div style={{ position: 'absolute', bottom: '3%', right: '2%', zIndex: 30, display: 'flex', gap: 6 }}>
        <button onClick={() => {}} style={{ background: 'rgba(0,0,0,0.7)', border: '2px solid #fff4', color: '#fff', padding: '6px 14px', borderRadius: 4, fontFamily: '"Impact",sans-serif', fontSize: 13, cursor: 'pointer', letterSpacing: '0.05em' }}>
          ◀ PREV
        </button>
        <button onClick={() => {}} style={{ background: 'rgba(0,0,0,0.7)', border: '2px solid #fff4', color: '#fff', padding: '6px 14px', borderRadius: 4, fontFamily: '"Impact",sans-serif', fontSize: 13, cursor: 'pointer', letterSpacing: '0.05em' }}>
          NEXT ▶
        </button>
      </div>

    </div>
  )
}

export default function VictoryPreviewPage() {
  const [idx, setIdx] = useState(0)
  const trainer = TRAINERS[idx]
  const loser = TRAINERS[(idx + 1) % TRAINERS.length]

  return (
    <div style={{ position: 'relative' }}>
      <VictoryView trainer={trainer} loserName={loser.name} />
      {/* Overlay prev/next with working handlers */}
      <div style={{ position: 'fixed', bottom: '3%', right: '2%', zIndex: 100, display: 'flex', gap: 6 }}>
        <button
          onClick={() => setIdx(i => (i - 1 + TRAINERS.length) % TRAINERS.length)}
          style={{ background: 'rgba(0,0,0,0.8)', border: '2px solid rgba(255,255,255,0.3)', color: '#fff', padding: '8px 16px', borderRadius: 4, fontFamily: '"Impact",sans-serif', fontSize: 13, cursor: 'pointer', letterSpacing: '0.05em' }}
        >◀ PREV</button>
        <button
          onClick={() => setIdx(i => (i + 1) % TRAINERS.length)}
          style={{ background: 'rgba(0,0,0,0.8)', border: '2px solid rgba(255,255,255,0.3)', color: '#fff', padding: '8px 16px', borderRadius: 4, fontFamily: '"Impact",sans-serif', fontSize: 13, cursor: 'pointer', letterSpacing: '0.05em' }}
        >NEXT ▶</button>
        <span style={{ background: 'rgba(0,0,0,0.7)', border: '2px solid rgba(255,255,255,0.2)', color: '#94a3b8', padding: '8px 12px', borderRadius: 4, fontFamily: '"Impact",sans-serif', fontSize: 12, letterSpacing: '0.05em' }}>
          {idx + 1}/{TRAINERS.length}
        </span>
      </div>
    </div>
  )
}
