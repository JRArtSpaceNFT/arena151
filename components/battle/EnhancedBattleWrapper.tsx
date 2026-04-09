/**
 * Enhanced Battle Wrapper - Adds cinematic VFX to battles
 * Wraps BattleScreen with visual effects system
 */

'use client'

import { useEffect, useState, useRef } from 'react'
import BattleVFXLayer from './BattleVFXLayer'
import BattleParticles from './BattleParticles'
import SlowMotionWrapper from './SlowMotionWrapper'
import ArenaDamage from './ArenaDamage'
import AttackTrail from './AttackTrail'
import ImpactDistortion from './ImpactDistortion'
import { useBattleVFX } from '@/hooks/useBattleVFX'
import { useGameStore } from '@/lib/game-store'
import { MOVES } from '@/lib/data/moves'

interface EnhancedBattleWrapperProps {
  children: React.ReactNode
}

export default function EnhancedBattleWrapper({ children }: EnhancedBattleWrapperProps) {
  const { battleState } = useGameStore()
  const vfx = useBattleVFX()
  const [particles, setParticles] = useState<{ element: string; position: { x: number; y: number }; count: number } | null>(null)
  const [criticalText, setCriticalText] = useState<string | null>(null)
  const [koText, setKoText] = useState(false)
  const [totalDamage, setTotalDamage] = useState(0)
  const [attackTrail, setAttackTrail] = useState<{ element: string; from: 'left' | 'right'; power: number; active: boolean } | null>(null)
  const lastLogLengthRef = useRef(0)

  // Watch battle log for new entries and trigger VFX
  useEffect(() => {
    if (!battleState?.log || battleState.log.length === 0) return
    if (battleState.log.length === lastLogLengthRef.current) return

    const latestEntry = battleState.log[battleState.log.length - 1]
    lastLogLengthRef.current = battleState.log.length
    
    // Detect attack impacts
    if (latestEntry.text?.includes('used') && latestEntry.text?.includes('!')) {
      const moveName = latestEntry.text.split('used ')[1]?.split('!')[0]
      const move = MOVES.find(m => m.name === moveName)
      
      if (move) {
        const isCritical = latestEntry.text?.includes('Critical hit') || false
        const isSuperEffective = latestEntry.text?.includes('super effective') || false
        const isP1Attack = latestEntry.side === 'A'
        
        // Track total damage for arena destruction
        const damage = move.power || 0
        setTotalDamage(prev => prev + damage)

        // Show attack trail
        setAttackTrail({
          element: move.type,
          from: isP1Attack ? 'left' : 'right',
          power: move.power || 50,
          active: true,
        })
        setTimeout(() => setAttackTrail(null), 600)
        
        // Trigger impact VFX
        setTimeout(() => {
          vfx.triggerVFX({
            type: 'impact',
            element: move.type,
            power: move.power,
            isCritical,
            isSuperEffective,
            position: { x: isP1Attack ? 70 : 30, y: 45 },
          })

          // Spawn particles
          setParticles({
            element: move.type,
            position: { x: isP1Attack ? 70 : 30, y: 40 },
            count: isCritical ? 100 : 50,
          })

          // Clear particles after animation
          setTimeout(() => setParticles(null), 1000)
        }, 300) // Small delay for attack animation
      }
    }

    // Detect critical hits
    if (latestEntry.text?.includes('Critical hit')) {
      vfx.triggerVFX({ type: 'critical' })
      setCriticalText('CRITICAL!')
      setTimeout(() => setCriticalText(null), 800)
    }

    // Detect KO (potential finisher)
    if (latestEntry.text?.includes('fainted')) {
      // Check if this is the final KO (battle winner decided)
      const isFinisher = battleState.winner !== null
      
      vfx.triggerVFX({ type: isFinisher ? 'finisher' : 'ko' })
      setKoText(true)
      setTimeout(() => setKoText(false), 2000)
    }
  }, [battleState?.log, battleState?.winner, vfx])

  return (
    <SlowMotionWrapper
      isActive={vfx.isSlowMo}
      duration={2000}
      timeScale={0.25}
    >
      <BattleVFXLayer
        screenShake={vfx.screenShake}
        screenFlash={vfx.screenFlash}
        screenTint={vfx.screenTint}
        cameraZoom={vfx.cameraZoom}
        hitStop={vfx.hitStop}
      >
        {/* Arena damage effects */}
        <ArenaDamage totalDamageDealt={totalDamage} />

        {children}

        {/* Attack trail */}
        {attackTrail && (
          <AttackTrail
            element={attackTrail.element}
            from={attackTrail.from}
            power={attackTrail.power}
            isActive={attackTrail.active}
          />
        )}

        {/* Impact distortion */}
        <ImpactDistortion
          isActive={vfx.showDistortion}
          intensity={vfx.distortionIntensity}
          position={{ x: 50, y: 45 }}
        />

        {/* Particles overlay */}
        {particles && (
          <BattleParticles
            element={particles.element}
            position={particles.position}
            count={particles.count}
          />
        )}

        {/* Critical hit text */}
        {criticalText && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[9999]">
            <div 
              className="text-8xl font-black text-yellow-400 animate-ping"
              style={{
                textShadow: '0 0 20px #FFD700, 0 0 40px #FFD700, 0 0 60px #FFD700',
                animation: 'ping 0.5s ease-out',
              }}
            >
              {criticalText}
            </div>
          </div>
        )}

        {/* KO text */}
        {koText && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[9999]">
            <div 
              className="text-9xl font-black text-red-600"
              style={{
                textShadow: '0 0 30px #DC2626, 0 0 60px #DC2626',
                animation: 'bounce 0.5s ease-out',
              }}
            >
              K.O.
            </div>
          </div>
        )}
      </BattleVFXLayer>
    </SlowMotionWrapper>
  )
}
