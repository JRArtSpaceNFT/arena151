/**
 * Battle VFX Layer - Visual Effects Overlay
 * Renders screen effects, particles, and camera transforms
 */

'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useState } from 'react'

interface BattleVFXLayerProps {
  screenShake: { x: number; y: number }
  screenFlash: { opacity: number; color: string }
  screenTint: { opacity: number; color: string }
  cameraZoom: number
  hitStop: boolean
  children: React.ReactNode
}

export default function BattleVFXLayer({
  screenShake,
  screenFlash,
  screenTint,
  cameraZoom,
  hitStop,
  children,
}: BattleVFXLayerProps) {
  // Camera transform
  const cameraTransform = `
    translate(${screenShake.x}px, ${screenShake.y}px) 
    scale(${1 + cameraZoom / 100})
  `

  // Freeze everything during hit stop
  const pointerEvents = hitStop ? 'none' : 'auto'
  const animationPlayState = hitStop ? 'paused' : 'running'

  return (
    <div className="relative w-full h-full overflow-hidden">
      {/* Screen Flash Overlay */}
      <AnimatePresence>
        {screenFlash.opacity > 0 && (
          <motion.div
            key="flash"
            initial={{ opacity: 0 }}
            animate={{ opacity: screenFlash.opacity }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.05 }}
            className="absolute inset-0 z-[9998] pointer-events-none"
            style={{ backgroundColor: screenFlash.color }}
          />
        )}
      </AnimatePresence>

      {/* Screen Tint Overlay */}
      <motion.div
        className="absolute inset-0 z-[9997] pointer-events-none"
        style={{ 
          backgroundColor: screenTint.color,
          opacity: screenTint.opacity,
        }}
        animate={{ opacity: screenTint.opacity }}
        transition={{ duration: 0.3 }}
      />

      {/* Battle Content with Camera Transform */}
      <div
        style={{
          transform: cameraTransform,
          transition: hitStop ? 'none' : 'transform 0.1s ease-out',
          pointerEvents,
          animationPlayState,
        }}
      >
        {children}
      </div>

      {/* Vignette Effect */}
      <div 
        className="absolute inset-0 pointer-events-none z-[9996]"
        style={{
          background: 'radial-gradient(circle at center, transparent 40%, rgba(0,0,0,0.3) 100%)',
        }}
      />
    </div>
  )
}
