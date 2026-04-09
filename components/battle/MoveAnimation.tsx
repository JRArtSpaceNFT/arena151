'use client'
import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect, useRef } from 'react'

export interface MoveAnimState {
  animKey: string
  side: 'A' | 'B'
  id: string
}

interface Props {
  anim: MoveAnimState | null
}

// Map animation keys to sprite effects
const EFFECT_MAP: Record<string, { 
  path: string
  variant: string
  frameCount: number
  screenShake?: 'light' | 'medium' | 'heavy'
  screenFlash?: string
  impactOnTarget?: boolean
  fullScreenEffect?: 'thunder_flash' | 'surf_wave' | 'blizzard_storm' | 'fire_engulf' | 'earthquake_shake'
}> = {
  // ═══════════════════════════════════════════════════════════════
  // FIRE MOVES - Orange/Red/Yellow
  // ═══════════════════════════════════════════════════════════════
  fire: { path: 'Explosions/stylized_explosion_001', variant: 'small_yellow', frameCount: 9, screenShake: 'light', screenFlash: 'rgba(255,150,0,0.3)', impactOnTarget: true },
  fire_stream: { path: 'Explosions/stylized_explosion_002', variant: 'small_yellow', frameCount: 9, screenShake: 'medium', screenFlash: 'rgba(255,150,0,0.4)', impactOnTarget: true },
  fire_small: { path: 'Explosions/stylized_explosion_001', variant: 'small_yellow', frameCount: 9, screenShake: 'light', screenFlash: 'rgba(255,150,0,0.25)', impactOnTarget: true },
  fire_blast: { path: 'Explosions/epic_explosion_001', variant: 'large_orange', frameCount: 13, screenShake: 'heavy', screenFlash: 'rgba(255,100,0,0.5)', impactOnTarget: true, fullScreenEffect: 'fire_engulf' },
  mega_fire: { path: 'Explosions/epic_explosion_002', variant: 'large_orange', frameCount: 13, screenShake: 'heavy', screenFlash: 'rgba(255,100,0,0.6)', impactOnTarget: true, fullScreenEffect: 'fire_engulf' },
  fire_spin: { path: 'Explosions/symmetrical_explosion_001', variant: 'large_orange', frameCount: 13, screenShake: 'medium', screenFlash: 'rgba(255,150,0,0.4)', impactOnTarget: true },
  
  // ═══════════════════════════════════════════════════════════════
  // ELECTRIC MOVES - Yellow/White
  // ═══════════════════════════════════════════════════════════════
  lightning: { path: 'Lightning/lightning_strike_001', variant: 'large_yellow', frameCount: 8, screenShake: 'medium', screenFlash: 'rgba(255,255,200,0.7)', impactOnTarget: true, fullScreenEffect: 'thunder_flash' },
  electric: { path: 'Lightning/lightning_burst_001', variant: 'large_violet', frameCount: 8, screenShake: 'medium', screenFlash: 'rgba(255,255,100,0.6)', impactOnTarget: true, fullScreenEffect: 'thunder_flash' },
  thunder: { path: 'Lightning/lightning_burst_003', variant: 'large_violet', frameCount: 8, screenShake: 'heavy', screenFlash: 'rgba(255,255,255,0.8)', impactOnTarget: true, fullScreenEffect: 'thunder_flash' },
  mega_thunder: { path: 'Lightning/lightning_burst_002', variant: 'large_yellow', frameCount: 8, screenShake: 'heavy', screenFlash: 'rgba(255,255,255,0.9)', impactOnTarget: true, fullScreenEffect: 'thunder_flash' },
  lightning_small: { path: 'Lightning/lightning_strike_001', variant: 'large_yellow', frameCount: 8, screenShake: 'light', screenFlash: 'rgba(255,255,200,0.4)', impactOnTarget: true },
  
  // ═══════════════════════════════════════════════════════════════
  // WATER MOVES - Blue
  // ═══════════════════════════════════════════════════════════════
  water_jet: { path: 'Impacts/directional_impact_001', variant: 'small_blue', frameCount: 8, screenShake: 'light', screenFlash: 'rgba(0,120,255,0.3)', impactOnTarget: true },
  surf_wave: { path: 'Impacts/directional_impact_003', variant: 'large_blue', frameCount: 8, screenShake: 'heavy', screenFlash: 'rgba(0,120,255,0.5)', impactOnTarget: true, fullScreenEffect: 'surf_wave' },
  water_blast: { path: 'Impacts/directional_impact_003', variant: 'large_blue', frameCount: 8, screenShake: 'heavy', screenFlash: 'rgba(0,120,255,0.6)', impactOnTarget: true, fullScreenEffect: 'surf_wave' },
  bubbles: { path: 'Impacts/directional_impact_001', variant: 'small_blue', frameCount: 8, screenShake: 'light', screenFlash: 'rgba(100,180,255,0.25)', impactOnTarget: true },
  tsunami: { path: 'Impacts/directional_impact_003', variant: 'large_blue', frameCount: 8, screenShake: 'heavy', screenFlash: 'rgba(0,100,200,0.7)', impactOnTarget: true, fullScreenEffect: 'surf_wave' },
  waterfall: { path: 'Impacts/directional_impact_002', variant: 'small_blue', frameCount: 8, screenShake: 'medium', screenFlash: 'rgba(0,140,255,0.4)', impactOnTarget: true },
  water: { path: 'Impacts/directional_impact_001', variant: 'small_blue', frameCount: 8, screenShake: 'light', screenFlash: 'rgba(0,120,255,0.3)', impactOnTarget: true },
  
  // ═══════════════════════════════════════════════════════════════
  // ICE MOVES - Light Blue/Cyan
  // ═══════════════════════════════════════════════════════════════
  ice_beam: { path: 'Impacts/directional_impact_001', variant: 'small_blue', frameCount: 8, screenShake: 'medium', screenFlash: 'rgba(180,230,255,0.5)', impactOnTarget: true },
  blizzard: { path: 'Impacts/directional_impact_003', variant: 'large_blue', frameCount: 8, screenShake: 'heavy', screenFlash: 'rgba(200,240,255,0.6)', impactOnTarget: true, fullScreenEffect: 'blizzard_storm' },
  
  // ═══════════════════════════════════════════════════════════════
  // GRASS MOVES - Green
  // ═══════════════════════════════════════════════════════════════
  vines: { path: 'Impacts/directional_impact_002', variant: 'small_blue', frameCount: 8, screenShake: 'light', screenFlash: 'rgba(100,200,100,0.3)', impactOnTarget: true },
  leaves: { path: 'Impacts/directional_impact_001', variant: 'small_blue', frameCount: 8, screenShake: 'light', screenFlash: 'rgba(120,220,120,0.3)', impactOnTarget: true },
  solar_beam: { path: 'Lightning/lightning_strike_001', variant: 'large_yellow', frameCount: 8, screenShake: 'heavy', screenFlash: 'rgba(255,255,150,0.6)', impactOnTarget: true },
  powder: { path: 'Smoke Bursts/symmetrical_smoke_burst_001', variant: 'large_brown', frameCount: 10, screenShake: 'light', screenFlash: 'rgba(150,200,100,0.2)', impactOnTarget: true },
  
  // ═══════════════════════════════════════════════════════════════
  // PSYCHIC MOVES - Purple/Pink
  // ═══════════════════════════════════════════════════════════════
  psychic: { path: 'Magic Bursts/round_sparkle_burst_001', variant: 'large_violet', frameCount: 17, screenShake: 'medium', screenFlash: 'rgba(200,100,255,0.4)', impactOnTarget: true },
  psychic_pulse: { path: 'Magic Bursts/round_sparkle_burst_002', variant: 'large_violet', frameCount: 17, screenShake: 'medium', screenFlash: 'rgba(200,100,255,0.3)', impactOnTarget: true },
  psychic_small: { path: 'Magic Bursts/round_sparkle_burst_001', variant: 'large_violet', frameCount: 17, screenShake: 'light', screenFlash: 'rgba(200,100,255,0.25)', impactOnTarget: true },
  mind_break: { path: 'Magic Bursts/round_sparkle_burst_003', variant: 'large_violet', frameCount: 17, screenShake: 'heavy', screenFlash: 'rgba(168,85,247,0.5)', impactOnTarget: true },
  teleport: { path: 'Magic Bursts/round_sparkle_burst_001', variant: 'large_violet', frameCount: 17, screenShake: 'light', screenFlash: 'rgba(200,100,255,0.2)', impactOnTarget: true },
  aura: { path: 'Magic Bursts/round_sparkle_burst_002', variant: 'large_violet', frameCount: 17, screenShake: 'medium', screenFlash: 'rgba(100,150,255,0.4)', impactOnTarget: true },
  
  // ═══════════════════════════════════════════════════════════════
  // GHOST/DARK MOVES - Purple/Black
  // ═══════════════════════════════════════════════════════════════
  ghost: { path: 'Fantasy Spells/spell_death_001', variant: 'small_red', frameCount: 50, screenShake: 'medium', screenFlash: 'rgba(120,50,180,0.4)', impactOnTarget: true },
  ghost_ball: { path: 'Fantasy Spells/spell_death_001', variant: 'large_red', frameCount: 50, screenShake: 'heavy', screenFlash: 'rgba(109,40,217,0.5)', impactOnTarget: true },
  ghost_wave: { path: 'Fantasy Spells/spell_death_001', variant: 'small_red', frameCount: 50, screenShake: 'medium', screenFlash: 'rgba(120,50,180,0.35)', impactOnTarget: true },
  nightmare: { path: 'Fantasy Spells/spell_death_001', variant: 'large_red', frameCount: 50, screenShake: 'heavy', screenFlash: 'rgba(80,20,140,0.6)', impactOnTarget: true },
  dark: { path: 'Smoke Bursts/symmetrical_smoke_burst_001', variant: 'large_brown', frameCount: 10, screenShake: 'medium', screenFlash: 'rgba(50,20,80,0.5)', impactOnTarget: true },
  
  // ═══════════════════════════════════════════════════════════════
  // POISON MOVES - Purple/Green
  // ═══════════════════════════════════════════════════════════════
  poison: { path: 'Fantasy Spells/spell_poison_001', variant: 'small_green', frameCount: 17, screenShake: 'light', screenFlash: 'rgba(150,100,200,0.3)', impactOnTarget: true },
  poison_splash: { path: 'Fantasy Spells/spell_poison_001', variant: 'small_green', frameCount: 17, screenShake: 'medium', screenFlash: 'rgba(140,90,190,0.4)', impactOnTarget: true },
  toxic: { path: 'Fantasy Spells/spell_poison_001', variant: 'small_green', frameCount: 17, screenShake: 'medium', screenFlash: 'rgba(130,70,170,0.45)', impactOnTarget: true },
  
  // ═══════════════════════════════════════════════════════════════
  // GROUND/ROCK MOVES - Brown/Gray
  // ═══════════════════════════════════════════════════════════════
  quake: { path: 'Explosions/epic_explosion_001', variant: 'large_orange', frameCount: 13, screenShake: 'heavy', screenFlash: 'rgba(150,100,50,0.5)', impactOnTarget: true, fullScreenEffect: 'earthquake_shake' },
  dig: { path: 'Smoke Bursts/symmetrical_smoke_burst_001', variant: 'large_brown', frameCount: 10, screenShake: 'medium', screenFlash: 'rgba(120,90,60,0.3)', impactOnTarget: true },
  rocks: { path: 'Impacts/directional_impact_003', variant: 'large_blue', frameCount: 8, screenShake: 'medium', screenFlash: 'rgba(140,120,100,0.4)', impactOnTarget: true },
  mud: { path: 'Smoke Bursts/symmetrical_smoke_burst_001', variant: 'large_brown', frameCount: 10, screenShake: 'light', screenFlash: 'rgba(100,80,60,0.3)', impactOnTarget: true },
  ground: { path: 'Explosions/stylized_explosion_001', variant: 'small_yellow', frameCount: 9, screenShake: 'medium', screenFlash: 'rgba(140,110,80,0.35)', impactOnTarget: true },
  
  // ═══════════════════════════════════════════════════════════════
  // FIGHTING MOVES - Red
  // ═══════════════════════════════════════════════════════════════
  fighting: { path: 'Impacts/directional_impact_003', variant: 'large_blue', frameCount: 8, screenShake: 'heavy', screenFlash: 'rgba(239,68,68,0.4)', impactOnTarget: true },
  punch: { path: 'Impacts/directional_impact_002', variant: 'small_blue', frameCount: 8, screenShake: 'medium', screenFlash: 'rgba(239,68,68,0.35)', impactOnTarget: true },
  punch_heavy: { path: 'Impacts/directional_impact_003', variant: 'large_blue', frameCount: 8, screenShake: 'heavy', screenFlash: 'rgba(220,38,38,0.5)', impactOnTarget: true },
  kick: { path: 'Impacts/directional_impact_002', variant: 'small_blue', frameCount: 8, screenShake: 'medium', screenFlash: 'rgba(239,68,68,0.3)', impactOnTarget: true },
  grapple: { path: 'Impacts/directional_impact_003', variant: 'large_blue', frameCount: 8, screenShake: 'heavy', screenFlash: 'rgba(220,38,38,0.4)', impactOnTarget: true },
  
  // ═══════════════════════════════════════════════════════════════
  // FLYING MOVES - Light Gray/White
  // ═══════════════════════════════════════════════════════════════
  flying: { path: 'Smoke Bursts/symmetrical_smoke_burst_001', variant: 'large_brown', frameCount: 10, screenShake: 'light', screenFlash: 'rgba(200,220,240,0.3)', impactOnTarget: true },
  wind: { path: 'Smoke Bursts/symmetrical_smoke_burst_001', variant: 'large_brown', frameCount: 10, screenShake: 'light', screenFlash: 'rgba(200,220,240,0.25)', impactOnTarget: true },
  sky_attack: { path: 'Explosions/epic_explosion_001', variant: 'large_orange', frameCount: 13, screenShake: 'heavy', screenFlash: 'rgba(180,200,220,0.5)', impactOnTarget: true },
  sky_wrath: { path: 'Explosions/epic_explosion_002', variant: 'large_orange', frameCount: 13, screenShake: 'heavy', screenFlash: 'rgba(180,200,220,0.6)', impactOnTarget: true },
  
  // ═══════════════════════════════════════════════════════════════
  // DRAGON MOVES - Purple/Blue
  // ═══════════════════════════════════════════════════════════════
  dragon: { path: 'Explosions/stylized_explosion_002', variant: 'small_yellow', frameCount: 9, screenShake: 'medium', screenFlash: 'rgba(130,80,200,0.4)', impactOnTarget: true },
  dragon_breath: { path: 'Explosions/stylized_explosion_002', variant: 'small_yellow', frameCount: 9, screenShake: 'medium', screenFlash: 'rgba(130,80,200,0.35)', impactOnTarget: true },
  
  // ═══════════════════════════════════════════════════════════════
  // BUG MOVES - Green/Yellow
  // ═══════════════════════════════════════════════════════════════
  bug: { path: 'Impacts/directional_impact_001', variant: 'small_blue', frameCount: 8, screenShake: 'light', screenFlash: 'rgba(150,180,80,0.3)', impactOnTarget: true },
  sting: { path: 'Impacts/directional_impact_001', variant: 'small_blue', frameCount: 8, screenShake: 'light', screenFlash: 'rgba(150,180,80,0.3)', impactOnTarget: true },
  string: { path: 'Smoke Bursts/symmetrical_smoke_burst_001', variant: 'large_brown', frameCount: 10, screenShake: 'light', screenFlash: 'rgba(200,200,150,0.2)', impactOnTarget: true },
  
  // ═══════════════════════════════════════════════════════════════
  // NORMAL/GENERIC MOVES - Gray
  // ═══════════════════════════════════════════════════════════════
  normal: { path: 'Impacts/directional_impact_001', variant: 'small_blue', frameCount: 8, screenShake: 'light', screenFlash: 'rgba(148,163,184,0.2)', impactOnTarget: true },
  tackle: { path: 'Impacts/directional_impact_001', variant: 'small_blue', frameCount: 8, screenShake: 'light', screenFlash: 'rgba(148,163,184,0.3)', impactOnTarget: true },
  tackle_heavy: { path: 'Impacts/directional_impact_003', variant: 'large_blue', frameCount: 8, screenShake: 'heavy', screenFlash: 'rgba(239,68,68,0.4)', impactOnTarget: true },
  slash: { path: 'Impacts/directional_impact_002', variant: 'small_blue', frameCount: 8, screenShake: 'medium', screenFlash: 'rgba(239,68,68,0.3)', impactOnTarget: true },
  bite: { path: 'Impacts/directional_impact_002', variant: 'small_blue', frameCount: 8, screenShake: 'medium', screenFlash: 'rgba(100,60,140,0.35)', impactOnTarget: true },
  
  // ═══════════════════════════════════════════════════════════════
  // SPECIAL/STATUS MOVES
  // ═══════════════════════════════════════════════════════════════
  explosion: { path: 'Explosions/epic_explosion_001', variant: 'large_orange', frameCount: 13, screenShake: 'heavy', screenFlash: 'rgba(255,100,0,0.6)', impactOnTarget: true, fullScreenEffect: 'fire_engulf' },
  hyper_beam: { path: 'Lightning/lightning_strike_001', variant: 'large_yellow', frameCount: 8, screenShake: 'heavy', screenFlash: 'rgba(255,200,100,0.6)', impactOnTarget: true },
  tri_attack: { path: 'Magic Bursts/round_sparkle_burst_002', variant: 'large_violet', frameCount: 17, screenShake: 'medium', screenFlash: 'rgba(200,150,255,0.4)', impactOnTarget: true },
  stars: { path: 'Magic Bursts/round_sparkle_burst_001', variant: 'large_violet', frameCount: 17, screenShake: 'light', screenFlash: 'rgba(255,255,200,0.3)', impactOnTarget: true },
  heal: { path: 'Magic Bursts/round_sparkle_burst_001', variant: 'large_violet', frameCount: 17, screenShake: 'light', screenFlash: 'rgba(150,255,150,0.3)', impactOnTarget: true },
  sound: { path: 'Smoke Bursts/symmetrical_smoke_burst_001', variant: 'large_brown', frameCount: 10, screenShake: 'light', screenFlash: 'rgba(200,200,255,0.25)', impactOnTarget: true },
  lick: { path: 'Impacts/directional_impact_001', variant: 'small_blue', frameCount: 8, screenShake: 'light', screenFlash: 'rgba(200,150,250,0.25)', impactOnTarget: true },
  rage: { path: 'Impacts/directional_impact_002', variant: 'small_blue', frameCount: 8, screenShake: 'medium', screenFlash: 'rgba(255,100,100,0.35)', impactOnTarget: true },
}

const SHAKE_INTENSITIES = {
  light: { x: [-2, 2, -2, 2, 0], y: [-1, 1, -1, 1, 0] },
  medium: { x: [-4, 4, -4, 4, -2, 2, 0], y: [-3, 3, -3, 3, -1, 1, 0] },
  heavy: { x: [-8, 8, -8, 8, -6, 6, -4, 4, 0], y: [-6, 6, -6, 6, -4, 4, -2, 2, 0] },
}

function SpriteAnimation({ 
  path, 
  variant,
  frameCount,
  side,
  impactOnTarget,
  onComplete 
}: { 
  path: string
  variant: string
  frameCount: number
  side: 'A' | 'B'
  impactOnTarget?: boolean
  onComplete?: () => void 
}) {
  const [currentFrame, setCurrentFrame] = useState(0)
  const [targetPosition, setTargetPosition] = useState<{ x: number; y: number } | null>(null)
  const attackingFromLeft = side === 'A'
  
  // Calculate target Pokémon position dynamically
  useEffect(() => {
    const targetSide = attackingFromLeft ? 'B' : 'A'
    
    const findPokemonSprite = () => {
      const battleContainer = document.querySelector('[data-battle-container]')
      if (!battleContainer) return null
      
      const creatureDisplays = Array.from(battleContainer.querySelectorAll('[data-creature-display]'))
      const targetDisplay = creatureDisplays.find(el => 
        el.getAttribute('data-side') === targetSide
      )
      
      if (!targetDisplay) return null
      
      const sprite = targetDisplay.querySelector('img[alt*="sprite"]') as HTMLImageElement
      if (!sprite) return null
      
      const rect = sprite.getBoundingClientRect()
      return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      }
    }
    
    const position = findPokemonSprite()
    if (position) {
      setTargetPosition(position)
    } else {
      setTargetPosition({ 
        x: window.innerWidth / 2 + (attackingFromLeft ? 170 : -170), 
        y: window.innerHeight * 0.45 
      })
    }
  }, [attackingFromLeft])
  
  useEffect(() => {
    const fps = 30
    const interval = setInterval(() => {
      setCurrentFrame(prev => {
        if (prev >= frameCount - 1) {
          clearInterval(interval)
          onComplete?.()
          return prev
        }
        return prev + 1
      })
    }, 1000 / fps)
    
    return () => clearInterval(interval)
  }, [frameCount, onComplete])
  
  const folderName = path.split('/').pop()!
  const framePath = `/effects/${path}/${folderName}_${variant}/frame${String(currentFrame).padStart(4, '0')}.png`
  
  if (!targetPosition) return null
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.3 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.5 }}
      transition={{ duration: 0.15 }}
      style={{
        position: 'fixed',
        left: targetPosition.x,
        top: targetPosition.y,
        transform: 'translate(-50%, -50%)',
        width: 300,
        height: 300,
        pointerEvents: 'none',
        zIndex: 25,
      }}
    >
      <img 
        src={framePath}
        alt="attack effect"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          imageRendering: 'pixelated',
          filter: 'drop-shadow(0 0 15px rgba(255,255,255,0.6))',
        }}
        onError={(e) => {
          const img = e.target as HTMLImageElement
          img.style.display = 'none'
        }}
      />
    </motion.div>
  )
}

// Full-screen elemental effects
function FullScreenEffect({ type }: { type: 'thunder_flash' | 'surf_wave' | 'blizzard_storm' | 'fire_engulf' | 'earthquake_shake' }) {
  if (type === 'thunder_flash') {
    return (
      <>
        {/* Jagged lightning bolts across screen */}
        <motion.svg
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0.7, 1, 0] }}
          transition={{ duration: 0.6, times: [0, 0.1, 0.3, 0.5, 1] }}
          style={{
            position: 'fixed',
            inset: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: 28,
          }}
        >
          <path
            d="M 50 0 L 45 30 L 55 30 L 48 60 L 58 60 L 50 100"
            stroke="#FFFF00"
            strokeWidth="4"
            fill="none"
            filter="url(#glow)"
          />
          <path
            d="M 150 0 L 145 25 L 152 25 L 148 50 L 155 50 L 150 100"
            stroke="#FFFFFF"
            strokeWidth="3"
            fill="none"
            filter="url(#glow)"
          />
          <defs>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
        </motion.svg>
        
        {/* Full yellow flash */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0.5, 1, 0] }}
          transition={{ duration: 0.5, times: [0, 0.1, 0.3, 0.5, 1] }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'radial-gradient(circle, rgba(255,255,200,0.9) 0%, rgba(255,255,100,0.5) 50%, transparent 100%)',
            pointerEvents: 'none',
            zIndex: 27,
          }}
        />
      </>
    )
  }
  
  if (type === 'surf_wave') {
    return (
      <>
        {/* Giant blue wave sweeping across screen */}
        <motion.div
          initial={{ x: '-100%', opacity: 0 }}
          animate={{ x: '100%', opacity: [0, 1, 1, 0] }}
          transition={{ duration: 1.2, ease: 'easeInOut' }}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '150%',
            height: '100%',
            background: 'linear-gradient(90deg, transparent 0%, rgba(0,120,255,0.7) 20%, rgba(0,180,255,0.8) 50%, rgba(0,120,255,0.7) 80%, transparent 100%)',
            pointerEvents: 'none',
            zIndex: 28,
            clipPath: 'polygon(0 30%, 100% 40%, 100% 100%, 0 100%)',
          }}
        />
        
        {/* Water droplets */}
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ y: -50, x: Math.random() * window.innerWidth, opacity: 0 }}
            animate={{ y: window.innerHeight + 50, opacity: [0, 1, 1, 0] }}
            transition={{ duration: 1 + Math.random() * 0.5, delay: Math.random() * 0.3 }}
            style={{
              position: 'fixed',
              width: 8,
              height: 16,
              borderRadius: '50%',
              background: 'rgba(100,180,255,0.7)',
              pointerEvents: 'none',
              zIndex: 29,
            }}
          />
        ))}
      </>
    )
  }
  
  if (type === 'blizzard_storm') {
    return (
      <>
        {/* Swirling ice shards */}
        {[...Array(30)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ 
              x: Math.random() * window.innerWidth, 
              y: -20,
              rotate: 0,
              opacity: 0
            }}
            animate={{ 
              y: window.innerHeight + 20,
              x: Math.random() * window.innerWidth,
              rotate: 360,
              opacity: [0, 1, 1, 0]
            }}
            transition={{ 
              duration: 1.5 + Math.random() * 0.8, 
              delay: Math.random() * 0.5,
              ease: 'linear'
            }}
            style={{
              position: 'fixed',
              width: 12,
              height: 12,
              background: 'rgba(200,240,255,0.8)',
              clipPath: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)',
              pointerEvents: 'none',
              zIndex: 28,
              filter: 'drop-shadow(0 0 4px rgba(255,255,255,0.8))',
            }}
          />
        ))}
        
        {/* Cyan tint */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.6, 0.4, 0] }}
          transition={{ duration: 1.5 }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'radial-gradient(circle, rgba(180,230,255,0.5) 0%, rgba(200,240,255,0.3) 100%)',
            pointerEvents: 'none',
            zIndex: 27,
          }}
        />
      </>
    )
  }
  
  if (type === 'fire_engulf') {
    return (
      <>
        {/* Fire expanding from center */}
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: [0, 2.5, 3], opacity: [0, 0.8, 0] }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            width: '100%',
            height: '100%',
            transform: 'translate(-50%, -50%)',
            background: 'radial-gradient(circle, rgba(255,150,0,0.9) 0%, rgba(255,100,0,0.6) 40%, transparent 70%)',
            pointerEvents: 'none',
            zIndex: 28,
          }}
        />
        
        {/* Embers rising */}
        {[...Array(25)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ 
              x: window.innerWidth / 2 + (Math.random() - 0.5) * 400,
              y: window.innerHeight * 0.6,
              opacity: 1
            }}
            animate={{ 
              y: -50,
              x: window.innerWidth / 2 + (Math.random() - 0.5) * 600,
              opacity: [1, 0.8, 0]
            }}
            transition={{ 
              duration: 1.5 + Math.random() * 0.5,
              delay: Math.random() * 0.4,
              ease: 'easeOut'
            }}
            style={{
              position: 'fixed',
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: i % 3 === 0 ? '#FFAA00' : '#FF6600',
              pointerEvents: 'none',
              zIndex: 29,
              boxShadow: '0 0 8px rgba(255,150,0,0.8)',
            }}
          />
        ))}
      </>
    )
  }
  
  if (type === 'earthquake_shake') {
    return (
      <>
        {/* Ground cracks spreading */}
        <motion.svg
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0.7, 0] }}
          transition={{ duration: 1.5 }}
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: 28,
          }}
        >
          <motion.path
            d="M 0 80 Q 25 75, 50 82 T 100 78 T 150 85 T 200 80"
            stroke="#996633"
            strokeWidth="3"
            fill="none"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.8 }}
          />
          <motion.path
            d="M 20 85 Q 45 82, 70 87 T 120 83 T 170 88"
            stroke="#885522"
            strokeWidth="2"
            fill="none"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.8, delay: 0.1 }}
          />
        </motion.svg>
        
        {/* Dust explosion */}
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: [0, 2, 2.5], opacity: [0, 0.7, 0] }}
          transition={{ duration: 1.2 }}
          style={{
            position: 'fixed',
            bottom: 0,
            left: '50%',
            width: '120%',
            height: '60%',
            transform: 'translateX(-50%)',
            background: 'radial-gradient(ellipse at bottom, rgba(150,100,50,0.6) 0%, transparent 60%)',
            pointerEvents: 'none',
            zIndex: 27,
          }}
        />
      </>
    )
  }
  
  return null
}

// Screen effects wrapper
function ScreenEffects({ 
  shake, 
  flash,
  fullScreenEffect
}: { 
  shake?: 'light' | 'medium' | 'heavy'
  flash?: string 
  fullScreenEffect?: 'thunder_flash' | 'surf_wave' | 'blizzard_storm' | 'fire_engulf' | 'earthquake_shake'
}) {
  return (
    <>
      {/* Screen flash */}
      {flash && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0] }}
          transition={{ duration: 0.3, times: [0, 0.1, 1] }}
          style={{
            position: 'fixed',
            inset: 0,
            background: flash,
            pointerEvents: 'none',
            zIndex: 30,
          }}
        />
      )}
      
      {/* Full-screen effect */}
      {fullScreenEffect && <FullScreenEffect type={fullScreenEffect} />}
    </>
  )
}

// Fallback CSS animation for moves without sprites
function FallbackAnimation({ animKey, side }: { animKey: string; side: 'A' | 'B' }) {
  const [targetPosition, setTargetPosition] = useState<{ x: number; y: number } | null>(null)
  const attackingFromLeft = side === 'A'
  
  useEffect(() => {
    const targetSide = attackingFromLeft ? 'B' : 'A'
    const battleContainer = document.querySelector('[data-battle-container]')
    if (!battleContainer) return
    
    const creatureDisplays = Array.from(battleContainer.querySelectorAll('[data-creature-display]'))
    const targetDisplay = creatureDisplays.find(el => el.getAttribute('data-side') === targetSide)
    if (!targetDisplay) return
    
    const sprite = targetDisplay.querySelector('img[alt*="sprite"]') as HTMLImageElement
    if (!sprite) return
    
    const rect = sprite.getBoundingClientRect()
    setTargetPosition({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    })
  }, [attackingFromLeft])
  
  if (!targetPosition) return null
  
  return (
    <>
      <motion.div
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: [0, 1, 0.6, 0], scale: [0, 1.8, 2.2, 0] }}
        transition={{ duration: 0.5, delay: 0.05 }}
        style={{
          position: 'fixed',
          left: targetPosition.x,
          top: targetPosition.y,
          width: 120,
          height: 120,
          borderRadius: '50%',
          background: 'radial-gradient(circle, #fff, #94a3b8)',
          boxShadow: '0 0 60px #94a3b8',
          transform: 'translate(-50%,-50%)',
          pointerEvents: 'none',
          zIndex: 25,
        }}
      />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.4, 0] }}
        transition={{ duration: 0.3, delay: 0.2 }}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(255,255,255,0.3)',
          pointerEvents: 'none',
          zIndex: 30,
        }}
      />
    </>
  )
}

export default function MoveAnimation({ anim }: Props) {
  const [showEffect, setShowEffect] = useState(true)
  
  useEffect(() => {
    if (anim) {
      setShowEffect(true)
      console.log('🎬 Animation triggered:', anim.animKey, 'from side', anim.side)
      const timeout = setTimeout(() => setShowEffect(false), 2500)
      return () => clearTimeout(timeout)
    }
  }, [anim])
  
  if (!anim || !showEffect) return null
  
  const effect = EFFECT_MAP[anim.animKey]
  
  if (!effect) {
    console.warn('⚠️ No effect mapped for:', anim.animKey, '— using fallback')
  }
  
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={anim.id}
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 20,
        }}
      >
        {/* Screen effects (shake + flash + full-screen) */}
        {effect && (
          <ScreenEffects 
            shake={effect.screenShake} 
            flash={effect.screenFlash}
            fullScreenEffect={effect.fullScreenEffect}
          />
        )}
        
        {/* Sprite animation */}
        {effect ? (
          <SpriteAnimation
            path={effect.path}
            variant={effect.variant}
            frameCount={effect.frameCount}
            side={anim.side}
            impactOnTarget={effect.impactOnTarget}
            onComplete={() => setShowEffect(false)}
          />
        ) : (
          <FallbackAnimation animKey={anim.animKey} side={anim.side} />
        )}
      </motion.div>
    </AnimatePresence>
  )
}
