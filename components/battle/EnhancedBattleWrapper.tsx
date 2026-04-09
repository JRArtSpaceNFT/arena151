/**
 * Enhanced Battle Wrapper - Adds cinematic VFX to battles
 * Wraps BattleScreen with visual effects system
 */

'use client'

import { useEffect, useState } from 'react'
import BattleVFXLayer from './BattleVFXLayer'
import BattleParticles from './BattleParticles'
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

  // Watch battle log for new entries and trigger VFX
  useEffect(() => {
    if (!battleState?.log || battleState.log.length === 0) return

    const latestEntry = battleState.log[battleState.log.length - 1]
    
    // Detect attack impacts
    if (latestEntry.text?.includes('used') && latestEntry.text?.includes('!')) {
      const moveName = latestEntry.text.split('used ')[1]?.split('!')[0]
      const move = MOVES.find(m => m.name === moveName)
      
      if (move) {
        const isCritical = latestEntry.text?.includes('Critical hit') || false
        const isSuperEffective = latestEntry.text?.includes('super effective') || false
        
        // Trigger impact VFX
        setTimeout(() => {
          vfx.triggerVFX({
            type: 'impact',
            element: move.type,
            power: move.power,
            isCritical,
            isSuperEffective,
          })

          // Spawn particles
          setParticles({
            element: move.type,
            position: { x: 50, y: 40 },
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

    // Detect KO
    if (latestEntry.text?.includes('fainted')) {
      vfx.triggerVFX({ type: 'ko' })
      setKoText(true)
      setTimeout(() => setKoText(false), 2000)
    }
  }, [battleState?.log, vfx])

  return (
    <BattleVFXLayer
      screenShake={vfx.screenShake}
      screenFlash={vfx.screenFlash}
      screenTint={vfx.screenTint}
      cameraZoom={vfx.cameraZoom}
      hitStop={vfx.hitStop}
    >
      {children}

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
  )
}
