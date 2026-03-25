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
  impactOnTarget?: boolean  // NEW: spawn effect ON target instead of traveling
}> = {
  // FIRE
  fire: { path: 'Explosions/stylized_explosion_001', variant: 'small_yellow', frameCount: 9, screenShake: 'light', screenFlash: 'rgba(255,150,0,0.3)', impactOnTarget: true },
  fire_stream: { path: 'Explosions/stylized_explosion_002', variant: 'small_yellow', frameCount: 9, screenShake: 'medium', screenFlash: 'rgba(255,150,0,0.4)', impactOnTarget: true },
  fire_small: { path: 'Explosions/stylized_explosion_001', variant: 'small_yellow', frameCount: 9, screenShake: 'light', screenFlash: 'rgba(255,150,0,0.25)', impactOnTarget: true },
  fire_blast: { path: 'Explosions/epic_explosion_001', variant: 'large_orange', frameCount: 13, screenShake: 'heavy', screenFlash: 'rgba(255,100,0,0.5)', impactOnTarget: true },
  mega_fire: { path: 'Explosions/epic_explosion_002', variant: 'large_orange', frameCount: 13, screenShake: 'heavy', screenFlash: 'rgba(255,100,0,0.6)', impactOnTarget: true },
  fire_spin: { path: 'Explosions/symmetrical_explosion_001', variant: 'large_orange', frameCount: 13, screenShake: 'medium', screenFlash: 'rgba(255,150,0,0.4)', impactOnTarget: true },
  
  // ELECTRIC
  lightning: { path: 'Lightning/lightning_strike_001', variant: 'large_yellow', frameCount: 8, screenShake: 'medium', screenFlash: 'rgba(255,255,255,0.7)', impactOnTarget: true },
  electric: { path: 'Lightning/lightning_burst_001', variant: 'large_violet', frameCount: 8, screenShake: 'medium', screenFlash: 'rgba(255,255,255,0.6)', impactOnTarget: true },
  thunder: { path: 'Lightning/lightning_burst_003', variant: 'large_violet', frameCount: 8, screenShake: 'heavy', screenFlash: 'rgba(255,255,255,0.8)', impactOnTarget: true },
  mega_thunder: { path: 'Lightning/lightning_burst_002', variant: 'large_yellow', frameCount: 8, screenShake: 'heavy', screenFlash: 'rgba(255,255,255,0.9)', impactOnTarget: true },
  
  // EXPLOSIONS
  explosion: { path: 'Explosions/epic_explosion_001', variant: 'large_orange', frameCount: 13, screenShake: 'heavy', screenFlash: 'rgba(255,100,0,0.6)', impactOnTarget: true },
  
  // MAGIC/PSYCHIC
  psychic: { path: 'Magic Bursts/round_sparkle_burst_001', variant: 'large_violet', frameCount: 17, screenShake: 'medium', screenFlash: 'rgba(168,85,247,0.4)', impactOnTarget: true },
  psychic_pulse: { path: 'Magic Bursts/round_sparkle_burst_002', variant: 'large_violet', frameCount: 17, screenShake: 'medium', screenFlash: 'rgba(168,85,247,0.3)', impactOnTarget: true },
  mind_break: { path: 'Magic Bursts/round_sparkle_burst_003', variant: 'large_violet', frameCount: 17, screenShake: 'heavy', screenFlash: 'rgba(168,85,247,0.5)', impactOnTarget: true },
  
  // IMPACTS (melee — spawn on target)
  fighting: { path: 'Impacts/directional_impact_003', variant: 'large_blue', frameCount: 8, screenShake: 'heavy', screenFlash: 'rgba(239,68,68,0.4)', impactOnTarget: true },
  normal: { path: 'Impacts/directional_impact_001', variant: 'small_blue', frameCount: 8, screenShake: 'light', screenFlash: 'rgba(148,163,184,0.2)', impactOnTarget: true },
  tackle: { path: 'Impacts/directional_impact_001', variant: 'small_blue', frameCount: 8, screenShake: 'light', screenFlash: 'rgba(148,163,184,0.3)', impactOnTarget: true },
  tackle_heavy: { path: 'Impacts/directional_impact_003', variant: 'large_blue', frameCount: 8, screenShake: 'heavy', screenFlash: 'rgba(239,68,68,0.4)', impactOnTarget: true },
  slash: { path: 'Impacts/directional_impact_002', variant: 'small_blue', frameCount: 8, screenShake: 'medium', screenFlash: 'rgba(239,68,68,0.3)', impactOnTarget: true },
  
  // SPELLS (spawn on target)
  poison: { path: 'Fantasy Spells/spell_poison_001', variant: 'small_green', frameCount: 17, screenShake: 'light', screenFlash: 'rgba(168,85,247,0.3)', impactOnTarget: true },
  ghost: { path: 'Fantasy Spells/spell_death_001', variant: 'small_red', frameCount: 50, screenShake: 'medium', screenFlash: 'rgba(109,40,217,0.4)', impactOnTarget: true },
  ghost_ball: { path: 'Fantasy Spells/spell_death_001', variant: 'large_red', frameCount: 50, screenShake: 'heavy', screenFlash: 'rgba(109,40,217,0.5)', impactOnTarget: true },
  
  // SMOKE
  dark: { path: 'Smoke Bursts/symmetrical_smoke_burst_001', variant: 'large_brown', frameCount: 10, screenShake: 'medium', screenFlash: 'rgba(0,0,0,0.5)', impactOnTarget: true },
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
    
    // Find the Pokémon sprite element in the DOM
    // BattleScreen renders Pokémon in CreatureDisplay components
    // We'll find the sprite by looking for the img inside the creature display
    const findPokemonSprite = () => {
      const battleContainer = document.querySelector('[data-battle-container]')
      if (!battleContainer) return null
      
      // Find all creature displays
      const creatureDisplays = Array.from(battleContainer.querySelectorAll('[data-creature-display]'))
      
      // Find the target one (side A or B)
      const targetDisplay = creatureDisplays.find(el => 
        el.getAttribute('data-side') === targetSide
      )
      
      if (!targetDisplay) return null
      
      // Find the sprite image
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
      // Fallback to old hardcoded positions if DOM lookup fails
      const fallbackX = attackingFromLeft ? 'calc(50% + 170px)' : 'calc(50% - 170px)'
      console.warn('⚠️ Could not find target Pokémon sprite, using fallback position')
      // Convert fallback to pixel position (approximate)
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
  
  // Build the frame path
  const folderName = path.split('/').pop()! // e.g., "stylized_explosion_001"
  const framePath = `/effects/${path}/${folderName}_${variant}/frame${String(currentFrame).padStart(4, '0')}.png`
  
  if (!targetPosition) {
    return null // Don't render until we have the position
  }
  
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
          console.error('Image failed to load:', framePath)
          const img = e.target as HTMLImageElement
          img.style.display = 'none'
        }}
        onLoad={() => {
          if (currentFrame === 0) {
            console.log('✅ First frame loaded:', framePath)
          }
        }}
      />
    </motion.div>
  )
}

// Screen effects wrapper
function ScreenEffects({ 
  shake, 
  flash 
}: { 
  shake?: 'light' | 'medium' | 'heavy'
  flash?: string 
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
      // Auto-hide after animation completes
      const timeout = setTimeout(() => setShowEffect(false), 2500)
      return () => clearTimeout(timeout)
    }
  }, [anim])
  
  if (!anim || !showEffect) return null
  
  const effect = EFFECT_MAP[anim.animKey]
  
  if (!effect) {
    console.warn('⚠️ No effect mapped for:', anim.animKey)
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
        {/* Screen effects (shake + flash) */}
        {effect && (
          <ScreenEffects 
            shake={effect.screenShake} 
            flash={effect.screenFlash} 
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
