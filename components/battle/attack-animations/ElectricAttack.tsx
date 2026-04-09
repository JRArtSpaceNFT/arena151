/**
 * Electric Attack Animation
 * Jagged lightning bolts, electric sparks, screen flash
 */

'use client'

import { motion } from 'framer-motion'

interface ElectricAttackProps {
  from: 'left' | 'right'
  onComplete?: () => void
}

export function ElectricAttack({ from, onComplete }: ElectricAttackProps) {
  const startX = from === 'left' ? 15 : 85
  const endX = from === 'left' ? 70 : 30

  // Generate jagged lightning path
  const generateLightningPath = (startX: number, startY: number, endX: number, endY: number, segments: number = 8) => {
    let path = `M ${startX} ${startY}`
    const deltaX = (endX - startX) / segments
    const deltaY = (endY - startY) / segments
    
    let currentX = startX
    let currentY = startY
    
    for (let i = 0; i < segments; i++) {
      const offsetX = (Math.random() - 0.5) * 40
      const offsetY = (Math.random() - 0.5) * 40
      currentX += deltaX
      currentY += deltaY
      path += ` L ${currentX + offsetX} ${currentY + offsetY}`
    }
    
    path += ` L ${endX} ${endY}`
    return path
  }

  return (
    <div className="absolute inset-0 pointer-events-none z-30">
      {/* Screen-wide electric flash */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.8, 0.4, 0.7, 0] }}
        transition={{ duration: 0.3, times: [0, 0.1, 0.2, 0.3, 1] }}
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(circle, rgba(255, 255, 255, 0.6) 0%, rgba(255, 255, 0, 0.3) 40%, transparent 70%)',
        }}
      />

      {/* Main lightning bolt */}
      <svg className="absolute inset-0 w-full h-full">
        <defs>
          <filter id="electricGlow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* Primary bolt */}
        <motion.path
          d={generateLightningPath(startX, 50, endX, 45, 12)}
          stroke="#FFFFFF"
          strokeWidth="4"
          fill="none"
          filter="url(#electricGlow)"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ 
            pathLength: [0, 1, 1, 0],
            opacity: [0, 1, 1, 0],
          }}
          transition={{ duration: 0.4, times: [0, 0.2, 0.8, 1] }}
          onAnimationComplete={onComplete}
          style={{
            filter: 'drop-shadow(0 0 8px #FFFF00) drop-shadow(0 0 16px #00FFFF)',
          }}
        />

        {/* Secondary branching bolts */}
        {Array.from({ length: 3 }).map((_, i) => {
          const branchStart = startX + ((endX - startX) / 4) * (i + 1)
          const branchEndX = branchStart + (Math.random() - 0.5) * 30
          const branchEndY = 45 + (Math.random() - 0.5) * 40
          
          return (
            <motion.path
              key={i}
              d={generateLightningPath(branchStart, 48, branchEndX, branchEndY, 4)}
              stroke="#FFFF00"
              strokeWidth="2"
              fill="none"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ 
                pathLength: [0, 1, 1, 0],
                opacity: [0, 0.8, 0.8, 0],
              }}
              transition={{ duration: 0.3, delay: 0.1 + i * 0.05 }}
              style={{
                filter: 'drop-shadow(0 0 6px #FFFF00)',
              }}
            />
          )
        })}
      </svg>

      {/* Electric sparks */}
      {Array.from({ length: 15 }).map((_, i) => (
        <motion.div
          key={i}
          initial={{
            x: `${endX}%`,
            y: '45%',
            scale: 0,
            opacity: 0,
          }}
          animate={{
            x: `${endX + (Math.random() - 0.5) * 20}%`,
            y: `${45 + (Math.random() - 0.5) * 30}%`,
            scale: [0, 1.5, 0],
            opacity: [0, 1, 0],
            rotate: Math.random() * 360,
          }}
          transition={{
            duration: 0.4,
            delay: 0.2 + i * 0.02,
            ease: 'easeOut',
          }}
          className="absolute"
        >
          {/* Star-shaped spark */}
          <svg width="12" height="12" viewBox="0 0 12 12">
            <path
              d="M6 0 L7 5 L12 6 L7 7 L6 12 L5 7 L0 6 L5 5 Z"
              fill="#FFFF00"
              style={{
                filter: 'drop-shadow(0 0 3px #FFFFFF)',
              }}
            />
          </svg>
        </motion.div>
      ))}

      {/* Impact electric field */}
      <motion.div
        initial={{ opacity: 0, scale: 0 }}
        animate={{ 
          opacity: [0, 0.6, 0],
          scale: [0, 1.5, 2],
        }}
        transition={{ duration: 0.4, delay: 0.3 }}
        className="absolute rounded-full"
        style={{
          left: `${endX}%`,
          top: '45%',
          width: 120,
          height: 120,
          background: 'radial-gradient(circle, rgba(255, 255, 0, 0.4) 0%, transparent 70%)',
          transform: 'translate(-50%, -50%)',
          filter: 'blur(8px)',
        }}
      />
    </div>
  )
}
