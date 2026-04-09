/**
 * Battle VFX System - Constants & Configuration
 * Defines visual parameters for all elements and attack tiers
 */

import type { ImpactConfig, ElementVFXConfig, ElementType } from './types'

// ═══════════════════════════════════════════════════════════════
// ATTACK TIER CONFIGURATIONS
// ═══════════════════════════════════════════════════════════════

export const IMPACT_TIERS: Record<string, ImpactConfig> = {
  light: {
    shake: 3,
    flash: 0.5,
    hitstop: 30,      // 30ms = ~2 frames at 60fps
    zoom: 5,
    particles: 20,
  },
  medium: {
    shake: 7,
    flash: 0.7,
    hitstop: 80,      // 80ms = ~5 frames
    zoom: 10,
    particles: 50,
  },
  heavy: {
    shake: 12,
    flash: 0.9,
    hitstop: 120,     // 120ms = ~7 frames
    zoom: 15,
    particles: 100,
  },
  special: {
    shake: 20,
    flash: 1.0,
    hitstop: 150,     // 150ms = ~9 frames
    zoom: 25,
    particles: 200,
  },
}

// ═══════════════════════════════════════════════════════════════
// ELEMENT VFX CONFIGURATIONS
// ═══════════════════════════════════════════════════════════════

export const ELEMENT_VFX: Record<ElementType, ElementVFXConfig> = {
  fire: {
    color: '#FF6600',
    glowColor: '#FFCC00',
    particleType: 'ember',
    screenTint: 'rgba(255, 102, 0, 0.2)',
    trailType: 'fire',
  },
  water: {
    color: '#0066CC',
    glowColor: '#CCFFFF',
    particleType: 'droplet',
    screenTint: 'rgba(0, 102, 204, 0.15)',
    trailType: 'water',
  },
  electric: {
    color: '#FFFFFF',
    glowColor: '#00FFFF',
    particleType: 'spark',
    screenTint: 'rgba(255, 255, 255, 0.1)',
    trailType: 'electric',
  },
  grass: {
    color: '#22C55E',
    glowColor: '#84CC16',
    particleType: 'leaf',
    screenTint: 'rgba(34, 197, 94, 0.1)',
    trailType: 'wind',
  },
  ice: {
    color: '#CCFFFF',
    glowColor: '#99CCFF',
    particleType: 'shard',
    screenTint: 'rgba(204, 255, 255, 0.15)',
    trailType: 'energy',
  },
  fighting: {
    color: '#DC2626',
    glowColor: '#EF4444',
    particleType: 'energy',
    screenTint: 'rgba(220, 38, 38, 0.1)',
    trailType: 'energy',
  },
  poison: {
    color: '#A855F7',
    glowColor: '#C084FC',
    particleType: 'smoke',
    screenTint: 'rgba(168, 85, 247, 0.15)',
    trailType: 'shadow',
  },
  ground: {
    color: '#996633',
    glowColor: '#CC9966',
    particleType: 'smoke',
    screenTint: 'rgba(153, 102, 51, 0.15)',
    trailType: 'none',
  },
  flying: {
    color: '#818CF8',
    glowColor: '#C7D2FE',
    particleType: 'energy',
    screenTint: 'rgba(129, 140, 248, 0.1)',
    trailType: 'wind',
  },
  psychic: {
    color: '#EC4899',
    glowColor: '#F9A8D4',
    particleType: 'energy',
    screenTint: 'rgba(236, 72, 153, 0.15)',
    trailType: 'energy',
  },
  bug: {
    color: '#84CC16',
    glowColor: '#BEF264',
    particleType: 'leaf',
    screenTint: 'rgba(132, 204, 22, 0.1)',
    trailType: 'wind',
  },
  rock: {
    color: '#78716C',
    glowColor: '#A8A29E',
    particleType: 'smoke',
    screenTint: 'rgba(120, 113, 108, 0.15)',
    trailType: 'none',
  },
  ghost: {
    color: '#6D28D9',
    glowColor: '#A78BFA',
    particleType: 'shadow',
    screenTint: 'rgba(109, 40, 217, 0.2)',
    trailType: 'shadow',
  },
  dragon: {
    color: '#7C3AED',
    glowColor: '#C4B5FD',
    particleType: 'energy',
    screenTint: 'rgba(124, 58, 237, 0.15)',
    trailType: 'energy',
  },
  dark: {
    color: '#330033',
    glowColor: '#660099',
    particleType: 'shadow',
    screenTint: 'rgba(51, 0, 51, 0.3)',
    trailType: 'shadow',
  },
  steel: {
    color: '#94A3B8',
    glowColor: '#CBD5E1',
    particleType: 'spark',
    screenTint: 'rgba(148, 163, 184, 0.1)',
    trailType: 'energy',
  },
  fairy: {
    color: '#FFCCFF',
    glowColor: '#FFFFFF',
    particleType: 'energy',
    screenTint: 'rgba(255, 204, 255, 0.2)',
    trailType: 'energy',
  },
  normal: {
    color: '#9CA3AF',
    glowColor: '#D1D5DB',
    particleType: 'smoke',
    screenTint: 'rgba(156, 163, 175, 0.05)',
    trailType: 'none',
  },
}

// ═══════════════════════════════════════════════════════════════
// ANIMATION TIMING (milliseconds)
// ═══════════════════════════════════════════════════════════════

export const TIMING = {
  // Light attack
  light: {
    anticipation: 200,
    charge: 0,        // Skip for light attacks
    launch: 200,
    travel: 200,
    impact: 50,
    explosion: 300,
    aftermath: 400,
  },
  // Medium attack
  medium: {
    anticipation: 250,
    charge: 150,
    launch: 250,
    travel: 300,
    impact: 80,
    explosion: 350,
    aftermath: 450,
  },
  // Heavy attack
  heavy: {
    anticipation: 300,
    charge: 200,
    launch: 300,
    travel: 350,
    impact: 120,
    explosion: 400,
    aftermath: 500,
  },
  // Special attack
  special: {
    anticipation: 400,
    charge: 300,
    launch: 350,
    travel: 400,
    impact: 150,
    explosion: 500,
    aftermath: 600,
  },
}

// ═══════════════════════════════════════════════════════════════
// CAMERA SETTINGS
// ═══════════════════════════════════════════════════════════════

export const CAMERA = {
  idle: {
    breatheAmount: 2,    // px
    breatheSpeed: 3000,  // ms per cycle
    driftAmount: 2,
    driftSpeed: 5000,
  },
  lightAttack: {
    anticipationZoom: 5,
    impactPunch: 3,
    recoilDistance: 5,
  },
  heavyAttack: {
    anticipationZoom: 10,
    impactPunch: 10,
    recoilDistance: 15,
  },
  specialAttack: {
    anticipationZoom: 20,
    impactPunch: 15,
    recoilDistance: 25,
    chargeAngle: 3,  // degrees tilt
  },
}

// ═══════════════════════════════════════════════════════════════
// PARTICLE POOL SETTINGS
// ═══════════════════════════════════════════════════════════════

export const PARTICLE_POOL_SIZE = 500
export const MAX_PARTICLES_PER_ATTACK = 200
export const PARTICLE_FADE_DURATION = 500 // ms

// ═══════════════════════════════════════════════════════════════
// SCREEN EFFECT SETTINGS
// ═══════════════════════════════════════════════════════════════

export const FLASH_DURATION = 50      // ms (single frame feel)
export const TINT_FADE_DURATION = 300  // ms
export const SHAKE_DECAY_RATE = 0.9    // multiplier per frame
