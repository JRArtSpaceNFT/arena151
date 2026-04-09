/**
 * Battle VFX Hook - Cinematic Battle Effects
 * Handles screen shake, flashes, camera movement, and impact effects
 */

import { useState, useEffect, useRef, useCallback } from 'react'

export interface VFXTrigger {
  type: 'attack' | 'impact' | 'critical' | 'ko'
  element?: string
  power?: number
  isCritical?: boolean
  isSuperEffective?: boolean
}

export function useBattleVFX() {
  const [screenShake, setScreenShake] = useState({ x: 0, y: 0 })
  const [screenFlash, setScreenFlash] = useState({ opacity: 0, color: '#FFFFFF' })
  const [screenTint, setScreenTint] = useState({ opacity: 0, color: '#FFFFFF' })
  const [cameraZoom, setCameraZoom] = useState(0)
  const [hitStop, setHitStop] = useState(false)
  
  const shakeRef = useRef({ x: 0, y: 0, intensity: 0 })
  const animFrameRef = useRef<number | undefined>(undefined)

  // Screen shake animation loop
  useEffect(() => {
    if (shakeRef.current.intensity <= 0) return

    const animate = () => {
      if (shakeRef.current.intensity > 0.1) {
        // Random shake
        shakeRef.current.x = (Math.random() - 0.5) * shakeRef.current.intensity
        shakeRef.current.y = (Math.random() - 0.5) * shakeRef.current.intensity
        shakeRef.current.intensity *= 0.9 // Decay
        
        setScreenShake({ x: shakeRef.current.x, y: shakeRef.current.y })
        animFrameRef.current = requestAnimationFrame(animate)
      } else {
        shakeRef.current = { x: 0, y: 0, intensity: 0 }
        setScreenShake({ x: 0, y: 0 })
      }
    }

    animFrameRef.current = requestAnimationFrame(animate)
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    }
  }, [shakeRef.current.intensity])

  // Trigger screen shake
  const triggerShake = useCallback((intensity: number) => {
    shakeRef.current.intensity = intensity
  }, [])

  // Trigger screen flash
  const triggerFlash = useCallback((color: string, opacity: number, duration: number = 50) => {
    setScreenFlash({ opacity, color })
    setTimeout(() => setScreenFlash({ opacity: 0, color }), duration)
  }, [])

  // Trigger screen tint
  const triggerTint = useCallback((color: string, opacity: number, duration: number = 300) => {
    setScreenTint({ opacity, color })
    setTimeout(() => setScreenTint(prev => ({ ...prev, opacity: 0 })), duration)
  }, [])

  // Trigger camera zoom
  const triggerZoom = useCallback((amount: number, duration: number = 100) => {
    setCameraZoom(amount)
    setTimeout(() => setCameraZoom(0), duration)
  }, [])

  // Trigger hit stop (freeze frame)
  const triggerHitStop = useCallback((duration: number) => {
    setHitStop(true)
    setTimeout(() => setHitStop(false), duration)
  }, [])

  // Get element color
  const getElementColor = (element?: string): string => {
    const colors: Record<string, string> = {
      fire: '#FF6600',
      water: '#0066CC',
      electric: '#FFFF00',
      grass: '#22C55E',
      ice: '#CCFFFF',
      fighting: '#DC2626',
      poison: '#A855F7',
      psychic: '#EC4899',
      dark: '#330033',
      dragon: '#7C3AED',
      normal: '#9CA3AF',
    }
    return colors[element?.toLowerCase() || 'normal'] || '#FFFFFF'
  }

  // Main VFX trigger function
  const triggerVFX = useCallback((config: VFXTrigger) => {
    const power = config.power || 50
    const tier = power > 100 ? 'special' : power > 70 ? 'heavy' : power > 40 ? 'medium' : 'light'
    
    // Determine intensities based on tier
    const shakePower = tier === 'special' ? 20 : tier === 'heavy' ? 12 : tier === 'medium' ? 7 : 3
    const flashOpacity = tier === 'special' ? 1.0 : tier === 'heavy' ? 0.9 : tier === 'medium' ? 0.7 : 0.5
    const hitstopDuration = tier === 'special' ? 150 : tier === 'heavy' ? 120 : tier === 'medium' ? 80 : 30
    const zoomAmount = tier === 'special' ? 25 : tier === 'heavy' ? 15 : tier === 'medium' ? 10 : 5

    // Boost for critical hits
    const critMultiplier = config.isCritical ? 1.5 : 1

    if (config.type === 'impact') {
      const elementColor = getElementColor(config.element)
      
      // Screen flash
      triggerFlash(elementColor, flashOpacity * critMultiplier, 50)
      
      // Screen shake
      triggerShake(shakePower * critMultiplier)
      
      // Hit stop
      triggerHitStop(hitstopDuration * critMultiplier)
      
      // Camera zoom
      triggerZoom(zoomAmount * critMultiplier, 100)
      
      // Element tint
      triggerTint(elementColor, 0.2, 300)
    }

    if (config.type === 'critical') {
      // Special critical hit VFX
      triggerFlash('#FFD700', 1.0, 100)
      triggerShake(15)
      triggerHitStop(150)
      triggerZoom(20, 150)
    }

    if (config.type === 'ko') {
      // Dramatic KO effects
      triggerFlash('#000000', 0.8, 200)
      triggerShake(25)
      triggerHitStop(300)
    }
  }, [triggerFlash, triggerShake, triggerHitStop, triggerZoom, triggerTint])

  return {
    screenShake,
    screenFlash,
    screenTint,
    cameraZoom,
    hitStop,
    triggerVFX,
    triggerShake,
    triggerFlash,
    triggerTint,
    triggerZoom,
    triggerHitStop,
  }
}
