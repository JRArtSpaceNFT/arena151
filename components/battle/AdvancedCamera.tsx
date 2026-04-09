/**
 * Advanced Camera System
 * Dynamic camera behaviors for battle sequences
 * Based on Section 5 of the battle VFX spec
 */

'use client'

import { useEffect, useState, useRef } from 'react'
import { motion } from 'framer-motion'

interface CameraState {
  x: number
  y: number
  scale: number
  rotation: number
  breathAmount: number
  tensionLevel: number  // 0-1, increases as health gets low
}

interface AdvancedCameraProps {
  mode: 'idle' | 'light_attack' | 'heavy_attack' | 'special_attack' | 'finisher' | 'low_health' | 'victory'
  playerHealth: number  // 0-100
  opponentHealth: number  // 0-100
  children: React.ReactNode
}

export default function AdvancedCamera({ mode, playerHealth, opponentHealth, children }: AdvancedCameraProps) {
  const [camera, setCamera] = useState<CameraState>({
    x: 0,
    y: 0,
    scale: 1,
    rotation: 0,
    breathAmount: 2,
    tensionLevel: 0,
  })

  const breathPhaseRef = useRef(0)
  const driftPhaseRef = useRef(0)

  // Calculate tension based on lowest health
  useEffect(() => {
    const lowestHealth = Math.min(playerHealth, opponentHealth)
    const tensionLevel = lowestHealth < 30 ? (30 - lowestHealth) / 30 : 0
    setCamera(prev => ({ ...prev, tensionLevel }))
  }, [playerHealth, opponentHealth])

  // Idle camera - subtle breathing and drift
  useEffect(() => {
    if (mode !== 'idle') return

    const breathInterval = setInterval(() => {
      breathPhaseRef.current += 0.02
      driftPhaseRef.current += 0.01

      const breathX = Math.sin(breathPhaseRef.current) * camera.breathAmount
      const breathY = Math.cos(breathPhaseRef.current * 0.8) * camera.breathAmount
      const driftX = Math.sin(driftPhaseRef.current * 0.5) * 1.5
      const driftY = Math.cos(driftPhaseRef.current * 0.3) * 1.5

      setCamera(prev => ({
        ...prev,
        x: breathX + driftX,
        y: breathY + driftY,
      }))
    }, 50)

    return () => clearInterval(breathInterval)
  }, [mode, camera.breathAmount])

  // Low health tension - faster breathing, slight shake
  useEffect(() => {
    if (camera.tensionLevel === 0) return

    const tensionInterval = setInterval(() => {
      const tensionShake = (Math.random() - 0.5) * camera.tensionLevel * 3

      setCamera(prev => ({
        ...prev,
        x: prev.x + tensionShake,
        y: prev.y + tensionShake * 0.5,
        breathAmount: 2 + camera.tensionLevel * 2,
      }))
    }, 100)

    return () => clearInterval(tensionInterval)
  }, [camera.tensionLevel])

  // Camera transform based on mode
  const getCameraTransform = () => {
    let transform = `translate(${camera.x}px, ${camera.y}px) scale(${camera.scale}) rotate(${camera.rotation}deg)`

    switch (mode) {
      case 'light_attack':
        // Quick punch in
        return `${transform} scale(${1 + 0.03})`

      case 'heavy_attack':
        // Bigger punch in
        return `${transform} scale(${1 + 0.08})`

      case 'special_attack':
        // Dramatic zoom + slight tilt
        return `${transform} scale(${1 + 0.15}) rotate(${1}deg)`

      case 'finisher':
        // Max zoom + dramatic angle
        return `${transform} scale(${1 + 0.22}) rotate(${2.5}deg)`

      case 'low_health':
        // Closer, tense framing
        return `${transform} scale(${1 + camera.tensionLevel * 0.12})`

      case 'victory':
        // Pull back, settle
        return `${transform} scale(${0.95})`

      default:
        return transform
    }
  }

  // Transition timing based on mode
  const getTransitionDuration = () => {
    switch (mode) {
      case 'light_attack': return '0.15s'
      case 'heavy_attack': return '0.25s'
      case 'special_attack': return '0.4s'
      case 'finisher': return '0.6s'
      case 'low_health': return '0.3s'
      case 'victory': return '1.2s'
      default: return '0.2s'
    }
  }

  return (
    <div
      className="relative w-full h-full overflow-hidden"
      style={{
        transform: getCameraTransform(),
        transition: `transform ${getTransitionDuration()} ease-out`,
      }}
    >
      {children}

      {/* Vignette - intensifies with tension */}
      {camera.tensionLevel > 0 && (
        <motion.div
          animate={{ opacity: camera.tensionLevel * 0.6 }}
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(circle at center, transparent 30%, rgba(0,0,0,0.7) 100%)',
          }}
        />
      )}

      {/* Red edge glow on low health */}
      {camera.tensionLevel > 0.5 && (
        <motion.div
          animate={{
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="absolute inset-0 pointer-events-none"
          style={{
            boxShadow: `inset 0 0 ${80 * camera.tensionLevel}px ${20 * camera.tensionLevel}px rgba(220, 38, 38, ${camera.tensionLevel * 0.6})`,
          }}
        />
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// Camera shake utilities
// ═══════════════════════════════════════════════════════════════

export function useCameraShake() {
  const [shake, setShake] = useState({ x: 0, y: 0 })
  const shakeTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const triggerShake = (intensity: number, duration: number = 300) => {
    if (shakeTimeoutRef.current) clearTimeout(shakeTimeoutRef.current)

    let remaining = duration
    const interval = setInterval(() => {
      if (remaining <= 0) {
        clearInterval(interval)
        setShake({ x: 0, y: 0 })
        return
      }

      const decay = remaining / duration
      setShake({
        x: (Math.random() - 0.5) * intensity * decay,
        y: (Math.random() - 0.5) * intensity * decay,
      })

      remaining -= 50
    }, 50)

    shakeTimeoutRef.current = setTimeout(() => {
      setShake({ x: 0, y: 0 })
    }, duration)
  }

  return { shake, triggerShake }
}

// ═══════════════════════════════════════════════════════════════
// Camera zoom utilities
// ═══════════════════════════════════════════════════════════════

export function useCameraZoom() {
  const [zoom, setZoom] = useState(1)

  const snapZoom = (amount: number, duration: number = 200) => {
    setZoom(1 + amount)
    setTimeout(() => setZoom(1), duration)
  }

  const smoothZoom = (target: number, duration: number = 500) => {
    setZoom(target)
    setTimeout(() => setZoom(1), duration)
  }

  return { zoom, snapZoom, smoothZoom }
}

// ═══════════════════════════════════════════════════════════════
// Camera focus utilities
// ═══════════════════════════════════════════════════════════════

export function useCameraFocus() {
  const [focus, setFocus] = useState<'center' | 'attacker' | 'target' | 'both'>('center')
  const [focusOffset, setFocusOffset] = useState({ x: 0, y: 0 })

  const focusOn = (target: 'center' | 'attacker' | 'target' | 'both') => {
    setFocus(target)

    // Calculate offset based on target
    switch (target) {
      case 'attacker':
        setFocusOffset({ x: -15, y: 0 })
        break
      case 'target':
        setFocusOffset({ x: 15, y: 0 })
        break
      case 'both':
        setFocusOffset({ x: 0, y: 5 })
        break
      default:
        setFocusOffset({ x: 0, y: 0 })
    }
  }

  return { focus, focusOffset, focusOn }
}
