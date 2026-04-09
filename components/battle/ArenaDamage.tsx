/**
 * Arena Damage System - Environmental destruction during battle
 * Shows progressive damage to the arena based on total damage dealt
 */

'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useState } from 'react'

interface ArenaDamageProps {
  totalDamageDealt: number  // Cumulative damage across the entire battle
  arenaType?: string        // Different arenas have different damage patterns
}

interface CrackPattern {
  id: string
  x: number
  y: number
  rotation: number
  scale: number
  type: 'small' | 'medium' | 'large' | 'crater'
}

interface DebrisParticle {
  id: string
  x: number
  y: number
  vx: number
  vy: number
  size: number
  rotation: number
  color: string
}

export default function ArenaDamage({ totalDamageDealt, arenaType = 'default' }: ArenaDamageProps) {
  const [cracks, setCracks] = useState<CrackPattern[]>([])
  const [debris, setDebris] = useState<DebrisParticle[]>([])
  const [dustClouds, setDustClouds] = useState<{ id: string; x: number; y: number }[]>([])
  const [shakeIntensity, setShakeIntensity] = useState(0)

  // Calculate damage tier
  const getDamageTier = () => {
    if (totalDamageDealt < 200) return 0
    if (totalDamageDealt < 400) return 1
    if (totalDamageDealt < 700) return 2
    if (totalDamageDealt < 1000) return 3
    return 4
  }

  const tier = getDamageTier()

  useEffect(() => {
    // Add cracks progressively as damage accumulates
    const newCracks: CrackPattern[] = []
    
    // Tier 1: Minor cracks
    if (tier >= 1 && cracks.length < 3) {
      for (let i = cracks.length; i < 3; i++) {
        newCracks.push({
          id: `crack-1-${i}`,
          x: Math.random() * 100,
          y: 60 + Math.random() * 30,
          rotation: Math.random() * 360,
          scale: 0.6 + Math.random() * 0.4,
          type: 'small',
        })
      }
    }

    // Tier 2: Medium cracks
    if (tier >= 2 && cracks.length < 6) {
      for (let i = 3; i < 6; i++) {
        newCracks.push({
          id: `crack-2-${i}`,
          x: Math.random() * 100,
          y: 50 + Math.random() * 40,
          rotation: Math.random() * 360,
          scale: 0.8 + Math.random() * 0.5,
          type: 'medium',
        })
      }
    }

    // Tier 3: Large cracks
    if (tier >= 3 && cracks.length < 9) {
      for (let i = 6; i < 9; i++) {
        newCracks.push({
          id: `crack-3-${i}`,
          x: Math.random() * 100,
          y: 40 + Math.random() * 50,
          rotation: Math.random() * 360,
          scale: 1 + Math.random() * 0.6,
          type: 'large',
        })
      }
    }

    // Tier 4: Craters
    if (tier >= 4 && cracks.length < 12) {
      for (let i = 9; i < 12; i++) {
        newCracks.push({
          id: `crack-4-${i}`,
          x: Math.random() * 100,
          y: 30 + Math.random() * 60,
          rotation: Math.random() * 360,
          scale: 1.2 + Math.random() * 0.8,
          type: 'crater',
        })
      }
    }

    if (newCracks.length > 0) {
      setCracks([...cracks, ...newCracks])
      
      // Spawn debris when new damage appears
      const newDebris: DebrisParticle[] = []
      for (let i = 0; i < 15; i++) {
        newDebris.push({
          id: `debris-${Date.now()}-${i}`,
          x: 50 + (Math.random() - 0.5) * 40,
          y: 70,
          vx: (Math.random() - 0.5) * 100,
          vy: -Math.random() * 150 - 50,
          size: Math.random() * 6 + 2,
          rotation: Math.random() * 360,
          color: arenaType === 'ice' ? '#E0F2FE' : arenaType === 'forest' ? '#86EFAC' : '#A8A29E',
        })
      }
      setDebris(newDebris)

      // Spawn dust cloud
      setDustClouds([
        { id: `dust-${Date.now()}`, x: 50 + (Math.random() - 0.5) * 30, y: 65 },
      ])

      // Clear debris and dust after animation
      setTimeout(() => setDebris([]), 2000)
      setTimeout(() => setDustClouds([]), 3000)

      // Screen shake on major damage
      if (tier >= 2) {
        setShakeIntensity(tier * 2)
        setTimeout(() => setShakeIntensity(0), 300)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tier])

  return (
    <div 
      className="absolute inset-0 pointer-events-none overflow-hidden"
      style={{
        transform: `translate(${Math.random() * shakeIntensity - shakeIntensity/2}px, ${Math.random() * shakeIntensity - shakeIntensity/2}px)`,
        transition: 'transform 0.05s',
      }}
    >
      {/* Floor cracks */}
      {cracks.map((crack) => (
        <motion.div
          key={crack.id}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 0.7, scale: crack.scale }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="absolute"
          style={{
            left: `${crack.x}%`,
            top: `${crack.y}%`,
            transform: `translate(-50%, -50%) rotate(${crack.rotation}deg)`,
          }}
        >
          {crack.type === 'crater' ? (
            <div
              className="rounded-full"
              style={{
                width: '80px',
                height: '80px',
                background: 'radial-gradient(circle, rgba(0,0,0,0.5) 0%, transparent 70%)',
                boxShadow: 'inset 0 0 20px rgba(0,0,0,0.8)',
              }}
            />
          ) : (
            <svg
              width={crack.type === 'large' ? 120 : crack.type === 'medium' ? 80 : 50}
              height={crack.type === 'large' ? 120 : crack.type === 'medium' ? 80 : 50}
              viewBox="0 0 100 100"
            >
              <path
                d={
                  crack.type === 'large'
                    ? 'M10,50 Q30,30 50,50 T90,50 M50,10 L50,90'
                    : crack.type === 'medium'
                    ? 'M20,50 Q40,40 60,50 T80,50'
                    : 'M30,50 L70,50'
                }
                stroke="rgba(0,0,0,0.6)"
                strokeWidth={crack.type === 'large' ? 3 : 2}
                fill="none"
                strokeLinecap="round"
              />
            </svg>
          )}
        </motion.div>
      ))}

      {/* Flying debris */}
      <AnimatePresence>
        {debris.map((d) => (
          <motion.div
            key={d.id}
            initial={{
              left: `${d.x}%`,
              top: `${d.y}%`,
              opacity: 1,
              rotate: d.rotation,
            }}
            animate={{
              left: `${d.x + d.vx / 10}%`,
              top: `${d.y + d.vy / 10}%`,
              opacity: 0,
              rotate: d.rotation + 360,
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2, ease: 'easeOut' }}
            className="absolute"
            style={{
              width: d.size,
              height: d.size,
              backgroundColor: d.color,
              borderRadius: Math.random() > 0.5 ? '50%' : '0',
            }}
          />
        ))}
      </AnimatePresence>

      {/* Dust clouds */}
      <AnimatePresence>
        {dustClouds.map((dust) => (
          <motion.div
            key={dust.id}
            initial={{ scale: 0, opacity: 0.6 }}
            animate={{ scale: 3, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2, ease: 'easeOut' }}
            className="absolute"
            style={{
              left: `${dust.x}%`,
              top: `${dust.y}%`,
              width: '60px',
              height: '60px',
              background: 'radial-gradient(circle, rgba(120,113,108,0.4) 0%, transparent 70%)',
              borderRadius: '50%',
              transform: 'translate(-50%, -50%)',
            }}
          />
        ))}
      </AnimatePresence>

      {/* Major damage overlay (tiers 3+) */}
      {tier >= 3 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.15 }}
          className="absolute inset-0 bg-gradient-to-b from-transparent via-black/20 to-black/40"
        />
      )}
    </div>
  )
}
