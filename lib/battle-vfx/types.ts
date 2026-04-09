/**
 * Battle VFX System - Type Definitions
 * Arena 151 Cinematic Battle System
 */

export type ElementType = 
  | 'fire' 
  | 'water' 
  | 'electric' 
  | 'grass' 
  | 'ice' 
  | 'fighting' 
  | 'poison' 
  | 'ground' 
  | 'flying' 
  | 'psychic' 
  | 'bug' 
  | 'rock' 
  | 'ghost' 
  | 'dragon' 
  | 'dark' 
  | 'steel' 
  | 'fairy'
  | 'normal'

export type AttackTier = 'light' | 'medium' | 'heavy' | 'special'

export interface ImpactConfig {
  shake: number          // Screen shake intensity (px)
  flash: number          // Flash opacity (0-1)
  hitstop: number        // Freeze duration (ms)
  zoom: number           // Camera punch-in (px)
  particles: number      // Particle count
}

export interface ElementVFXConfig {
  color: string          // Primary element color
  glowColor: string      // Glow/highlight color
  particleType: 'ember' | 'spark' | 'droplet' | 'leaf' | 'shard' | 'smoke' | 'energy' | 'shadow'
  screenTint: string     // Background tint color
  trailType: 'fire' | 'electric' | 'water' | 'wind' | 'energy' | 'shadow' | 'none'
}

export interface CameraState {
  x: number
  y: number
  scale: number
  rotation: number
  shake: number
}

export interface ParticleConfig {
  type: string
  position: { x: number; y: number }
  velocity: { x: number; y: number }
  color: string
  size: number
  lifetime: number
  gravity: boolean
}

export interface ScreenEffect {
  type: 'flash' | 'tint' | 'vignette' | 'distortion' | 'blur'
  color?: string
  opacity?: number
  duration: number
  intensity?: number
}

export interface AttackAnimationState {
  phase: 'anticipation' | 'charge' | 'launch' | 'travel' | 'impact' | 'explosion' | 'aftermath'
  element: ElementType
  tier: AttackTier
  isCritical: boolean
  isSuperEffective: boolean
  isFinisher: boolean
  attacker: 'p1' | 'p2'
  target: 'p1' | 'p2'
}
