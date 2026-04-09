/**
 * Battle VFX Hook - Centralized visual effects state manager
 * Coordinates screen shake, flash, tint, zoom, hit-stop, and cinematic effects
 */

'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { IMPACT_TIERS, ELEMENT_VFX } from '@/lib/battle-vfx/constants'

interface VFXTrigger {
  type: 'impact' | 'critical' | 'ko' | 'finisher'
  element?: string
  power?: number
  isCritical?: boolean
  isSuperEffective?: boolean
  position?: { x: number; y: number }
}

interface VFXState {
  screenShake: { x: number; y: number }
  screenFlash: { opacity: number; color: string }
  screenTint: { opacity: number; color: string }
  cameraZoom: number
  hitStop: boolean
  isSlowMo: boolean
  showTrail: boolean
  showDistortion: boolean
  distortionIntensity: 'light' | 'medium' | 'heavy' | 'critical'
}

export function useBattleVFX() {
  const [state, setState] = useState<VFXState>({
    screenShake: { x: 0, y: 0 },
    screenFlash: { opacity: 0, color: '#FFFFFF' },
    screenTint: { opacity: 0, color: '#000000' },
    cameraZoom: 0,
    hitStop: false,
    isSlowMo: false,
    showTrail: false,
    showDistortion: false,
    distortionIntensity: 'medium',
  })

  const shakeIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const hitStopTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const flashTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const tintTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const zoomTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (shakeIntervalRef.current) clearInterval(shakeIntervalRef.current)
      if (hitStopTimeoutRef.current) clearTimeout(hitStopTimeoutRef.current)
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current)
      if (tintTimeoutRef.current) clearTimeout(tintTimeoutRef.current)
      if (zoomTimeoutRef.current) clearTimeout(zoomTimeoutRef.current)
    }
  }, [])

  const triggerVFX = useCallback(({ type, element = 'normal', power = 50, isCritical = false, isSuperEffective = false, position }: VFXTrigger) => {
    console.log('[useBattleVFX] triggerVFX called:', { type, element, power, isCritical, isSuperEffective })
    
    // Determine impact tier based on power and modifiers
    let tier: 'light' | 'medium' | 'heavy' | 'special' = 'light'
    if (type === 'finisher' || type === 'ko') {
      tier = 'special'
    } else if (isCritical || isSuperEffective) {
      tier = power > 80 ? 'heavy' : 'medium'
    } else {
      if (power >= 100) tier = 'heavy'
      else if (power >= 60) tier = 'medium'
      else tier = 'light'
    }

    const impactConfig = IMPACT_TIERS[tier]
    const elementConfig = ELEMENT_VFX[element as keyof typeof ELEMENT_VFX] || ELEMENT_VFX.normal

    // Screen shake (2x more intense)
    if (impactConfig.shake > 0) {
      let shakeAmount = impactConfig.shake * 2
      if (shakeIntervalRef.current) clearInterval(shakeIntervalRef.current)
      
      shakeIntervalRef.current = setInterval(() => {
        if (shakeAmount < 0.5) {
          setState(prev => ({ ...prev, screenShake: { x: 0, y: 0 } }))
          if (shakeIntervalRef.current) clearInterval(shakeIntervalRef.current)
          return
        }

        setState(prev => ({
          ...prev,
          screenShake: {
            x: (Math.random() - 0.5) * shakeAmount,
            y: (Math.random() - 0.5) * shakeAmount,
          },
        }))

        shakeAmount *= 0.85 // Decay
      }, 50)
    }

    // Screen flash (more visible)
    if (impactConfig.flash > 0) {
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current)
      
      setState(prev => ({
        ...prev,
        screenFlash: {
          opacity: Math.min(impactConfig.flash * 1.5, 1),
          color: isCritical ? '#FFD700' : isSuperEffective ? '#22C55E' : '#FFFFFF',
        },
      }))

      flashTimeoutRef.current = setTimeout(() => {
        setState(prev => ({ ...prev, screenFlash: { opacity: 0, color: '#FFFFFF' } }))
      }, 150)
    }

    // Screen tint (element color overlay)
    if (elementConfig.screenTint) {
      if (tintTimeoutRef.current) clearTimeout(tintTimeoutRef.current)
      
      setState(prev => ({
        ...prev,
        screenTint: {
          opacity: tier === 'special' ? 0.4 : tier === 'heavy' ? 0.3 : 0.2,
          color: elementConfig.screenTint,
        },
      }))

      tintTimeoutRef.current = setTimeout(() => {
        setState(prev => ({ ...prev, screenTint: { opacity: 0, color: '#000000' } }))
      }, 500)
    }

    // Camera zoom punch (2x more)
    if (impactConfig.zoom > 0) {
      if (zoomTimeoutRef.current) clearTimeout(zoomTimeoutRef.current)
      
      setState(prev => ({ ...prev, cameraZoom: impactConfig.zoom * 2 }))

      zoomTimeoutRef.current = setTimeout(() => {
        setState(prev => ({ ...prev, cameraZoom: 0 }))
      }, 250)
    }

    // Hit-stop (freeze frame)
    if (impactConfig.hitstop > 0) {
      if (hitStopTimeoutRef.current) clearTimeout(hitStopTimeoutRef.current)
      
      setState(prev => ({ ...prev, hitStop: true }))

      hitStopTimeoutRef.current = setTimeout(() => {
        setState(prev => ({ ...prev, hitStop: false }))
      }, impactConfig.hitstop)
    }

    // Impact distortion
    setState(prev => ({
      ...prev,
      showDistortion: true,
      distortionIntensity: isCritical ? 'critical' : tier === 'special' ? 'heavy' : tier === 'heavy' ? 'medium' : 'light',
    }))
    setTimeout(() => {
      setState(prev => ({ ...prev, showDistortion: false }))
    }, 600)

    // Slow-mo for finishers
    if (type === 'finisher' || type === 'ko') {
      setState(prev => ({ ...prev, isSlowMo: true }))
      setTimeout(() => {
        setState(prev => ({ ...prev, isSlowMo: false }))
      }, 2000)
    }

  }, [])

  const reset = useCallback(() => {
    if (shakeIntervalRef.current) clearInterval(shakeIntervalRef.current)
    if (hitStopTimeoutRef.current) clearTimeout(hitStopTimeoutRef.current)
    if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current)
    if (tintTimeoutRef.current) clearTimeout(tintTimeoutRef.current)
    if (zoomTimeoutRef.current) clearTimeout(zoomTimeoutRef.current)

    setState({
      screenShake: { x: 0, y: 0 },
      screenFlash: { opacity: 0, color: '#FFFFFF' },
      screenTint: { opacity: 0, color: '#000000' },
      cameraZoom: 0,
      hitStop: false,
      isSlowMo: false,
      showTrail: false,
      showDistortion: false,
      distortionIntensity: 'medium',
    })
  }, [])

  return {
    ...state,
    triggerVFX,
    reset,
  }
}
