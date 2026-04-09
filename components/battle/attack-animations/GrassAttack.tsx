/**
 * Grass Attack Animation
 * Leaves, vines, razor leaf projectiles, nature energy
 */

'use client'

import { motion } from 'framer-motion'

interface GrassAttackProps {
  from: 'left' | 'right'
  onComplete?: () => void
}

export function GrassAttack({ from, onComplete }: GrassAttackProps) {
  const startX = from === 'left' ? 15 : 85
  const endX = from === 'left' ? 70 : 30

  return (
    <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
      {/* Swirling leaves projectiles */}
      {Array.from({ length: 15 }).map((_, i) => {
        const spiralOffset = Math.sin(i * 0.8) * 10
        const delayOffset = i * 0.04
        
        return (
          <motion.div
            key={`leaf-${i}`}
            initial={{
              x: `${startX}%`,
              y: '50%',
              scale: 0,
              opacity: 0,
              rotate: 0,
            }}
            animate={{
              x: `${endX}%`,
              y: `${45 + spiralOffset}%`,
              scale: [0, 1.2, 1],
              opacity: [0, 1, 0],
              rotate: [0, 360 * 2],
            }}
            transition={{
              duration: 0.8,
              delay: delayOffset,
              ease: 'easeOut',
            }}
            onAnimationComplete={i === 14 ? onComplete : undefined}
            className="absolute"
          >
            {/* Leaf SVG */}
            <svg width="24" height="24" viewBox="0 0 24 24">
              <path
                d="M12 2 Q18 8, 22 12 Q18 16, 12 22 Q8 18, 6 12 Q8 8, 12 2 Z"
                fill="linear-gradient(135deg, #22C55E 0%, #16A34A 100%)"
                style={{
                  fill: i % 2 === 0 ? '#22C55E' : '#16A34A',
                  filter: 'drop-shadow(0 0 4px rgba(34, 197, 94, 0.8))',
                }}
              />
            </svg>
          </motion.div>
        )
      })}

      {/* Razor leaf cutting trail */}
      <motion.div
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: [0, 0.8, 0] }}
        transition={{ duration: 0.6 }}
        className="absolute inset-0"
      >
        <svg className="w-full h-full">
          <motion.path
            d={`M ${startX} 50 Q ${(startX + endX) / 2} ${40} ${endX} 45`}
            stroke="#22C55E"
            strokeWidth="3"
            fill="none"
            strokeDasharray="8 4"
            style={{
              filter: 'drop-shadow(0 0 8px rgba(34, 197, 94, 0.8))',
            }}
          />
        </svg>
      </motion.div>

      {/* Vine whip effect */}
      {[0, 1, 2].map((vineIndex) => {
        const yOffset = (vineIndex - 1) * 8
        return (
          <motion.div
            key={`vine-${vineIndex}`}
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ 
              scaleX: [0, 1, 0.8],
              opacity: [0, 0.9, 0],
            }}
            transition={{ 
              duration: 0.5,
              delay: vineIndex * 0.1,
            }}
            className="absolute h-2"
            style={{
              left: from === 'left' ? `${startX}%` : undefined,
              right: from === 'right' ? `${100 - startX}%` : undefined,
              top: `${45 + yOffset}%`,
              width: `${Math.abs(endX - startX)}%`,
              background: `linear-gradient(90deg, 
                rgba(34, 197, 94, 0.8) 0%, 
                rgba(22, 163, 74, 0.6) 50%, 
                rgba(21, 128, 61, 0.4) 100%)`,
              transformOrigin: from === 'left' ? 'left center' : 'right center',
              borderRadius: '2px',
              boxShadow: '0 0 8px rgba(34, 197, 94, 0.6)',
            }}
          />
        )
      })}

      {/* Impact burst - petals and leaves */}
      {Array.from({ length: 16 }).map((_, i) => {
        const angle = (i / 16) * 360
        const distance = 30 + Math.random() * 25
        const endXPos = endX + Math.cos((angle * Math.PI) / 180) * (distance / 10)
        const endYPos = 45 + Math.sin((angle * Math.PI) / 180) * (distance / 10)
        
        return (
          <motion.div
            key={`petal-${i}`}
            initial={{
              x: `${endX}%`,
              y: '45%',
              scale: 0,
              opacity: 0,
              rotate: 0,
            }}
            animate={{
              x: `${endXPos}%`,
              y: `${endYPos}%`,
              scale: [0, 1, 0.5],
              opacity: [0, 1, 0],
              rotate: [0, 360 + Math.random() * 180],
            }}
            transition={{
              duration: 0.8,
              delay: 0.5 + i * 0.02,
              ease: 'easeOut',
            }}
            className="absolute w-3 h-3"
            style={{
              background: i % 3 === 0 ? '#22C55E' : i % 3 === 1 ? '#84CC16' : '#16A34A',
              borderRadius: i % 2 === 0 ? '50% 0 50% 0' : '0 50% 0 50%',
              filter: 'drop-shadow(0 0 3px rgba(34, 197, 94, 0.8))',
            }}
          />
        )
      })}

      {/* Nature energy pulse */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ 
          scale: [0, 2, 2.5],
          opacity: [0, 0.7, 0],
        }}
        transition={{ duration: 0.7, delay: 0.4 }}
        className="absolute"
        style={{
          left: `${endX}%`,
          top: '45%',
          width: 120,
          height: 120,
          background: 'radial-gradient(circle, rgba(34, 197, 94, 0.5) 0%, rgba(132, 204, 22, 0.3) 40%, transparent 70%)',
          transform: 'translate(-50%, -50%)',
          filter: 'blur(10px)',
        }}
      />
    </div>
  )
}
