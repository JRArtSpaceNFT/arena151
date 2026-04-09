/**
 * Slow Motion Wrapper - Cinematic time dilation for finishers
 * Automatically triggers on KO-causing attacks
 */

'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useState, useRef } from 'react'

interface SlowMotionWrapperProps {
  isActive: boolean
  duration?: number      // How long the slow-mo lasts (ms)
  timeScale?: number     // 0.1 = 10% speed, 0.3 = 30% speed
  children: React.ReactNode
  onComplete?: () => void
}

export default function SlowMotionWrapper({
  isActive,
  duration = 2000,
  timeScale = 0.2,
  children,
  onComplete,
}: SlowMotionWrapperProps) {
  const [showEffect, setShowEffect] = useState(false)
  const [timeScaleValue, setTimeScaleValue] = useState(1)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (isActive) {
      setShowEffect(true)
      setTimeScaleValue(timeScale)

      // After duration, restore normal speed
      timerRef.current = setTimeout(() => {
        setTimeScaleValue(1)
        setShowEffect(false)
        onComplete?.()
      }, duration)
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [isActive, duration, timeScale, onComplete])

  return (
    <div
      style={{
        animationPlayState: showEffect ? 'paused' : 'running',
        transition: `all ${showEffect ? '0.5s' : '0.2s'} ease-out`,
      }}
    >
      {children}

      {/* Visual slow-mo overlay effect */}
      <AnimatePresence>
        {showEffect && (
          <>
            {/* Chromatic aberration simulation */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.15 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0 pointer-events-none z-[9995]"
              style={{
                background: 'radial-gradient(circle at center, transparent 20%, rgba(59, 130, 246, 0.1) 100%)',
                mixBlendMode: 'screen',
              }}
            />

            {/* Time dilation vignette */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="absolute inset-0 pointer-events-none z-[9994]"
              style={{
                background: 'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.6) 100%)',
              }}
            />

            {/* Slow-mo indicator text */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
              className="absolute top-8 left-1/2 -translate-x-1/2 z-[9999] pointer-events-none"
            >
              <div
                className="text-2xl font-black tracking-[0.3em] text-white/90 uppercase"
                style={{
                  textShadow: '0 0 20px rgba(255,255,255,0.8), 0 0 40px rgba(59,130,246,0.6)',
                  letterSpacing: '0.3em',
                }}
              >
                FINISHING BLOW
              </div>
            </motion.div>

            {/* Edge glow pulses */}
            <motion.div
              animate={{
                opacity: [0.3, 0.6, 0.3],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              className="absolute inset-0 pointer-events-none z-[9993]"
              style={{
                boxShadow: 'inset 0 0 100px 20px rgba(59, 130, 246, 0.3)',
              }}
            />
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
