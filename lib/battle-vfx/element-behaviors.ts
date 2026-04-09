/**
 * Element-Specific VFX Behaviors
 * Defines unique visual language for each element type
 * Based on Section 4 of the battle VFX spec
 */

import type { ElementType } from './types'

export interface ElementBehavior {
  // Color behavior
  primaryColor: string
  secondaryColor: string
  glowColor: string
  trailColor: string

  // Particle style
  particleShape: 'circle' | 'spark' | 'droplet' | 'shard' | 'ember' | 'wisp'
  particleCount: number
  particleSpeed: 'slow' | 'medium' | 'fast' | 'explosive'
  particleGravity: boolean
  particleLifetime: number  // milliseconds

  // Motion style
  motionPattern: 'straight' | 'arc' | 'wave' | 'spiral' | 'burst' | 'flow'
  motionSpeed: 'slow' | 'medium' | 'fast' | 'instant'
  trailLength: 'none' | 'short' | 'medium' | 'long'

  // Impact style
  impactExplosion: 'small' | 'medium' | 'large' | 'massive'
  impactSound: 'sharp' | 'boom' | 'splash' | 'crack' | 'sizzle' | 'whoosh'
  impactShake: number  // intensity 1-10

  // Lingering aftermath
  aftermathDuration: number  // milliseconds
  aftermathEffects: string[]

  // Screen treatment
  screenTint: string
  screenFlash: string
  screenDistortion: boolean
  chromaticAberration: boolean

  // Camera behavior
  preferredCameraAction: 'punch' | 'zoom' | 'shake' | 'tilt' | 'track'
  cameraIntensity: number  // 1-10

  // Special properties
  environmentInteraction: string[]
  uniqueVisuals: string[]
}

// ═══════════════════════════════════════════════════════════════
// FIRE - Hot, explosive, glowing, expanding, dangerous
// ═══════════════════════════════════════════════════════════════

export const FIRE_BEHAVIOR: ElementBehavior = {
  primaryColor: '#FF6600',
  secondaryColor: '#FFAA00',
  glowColor: '#FFDD00',
  trailColor: '#FF3300',

  particleShape: 'ember',
  particleCount: 150,
  particleSpeed: 'fast',
  particleGravity: false,  // Embers float upward
  particleLifetime: 1200,

  motionPattern: 'burst',
  motionSpeed: 'fast',
  trailLength: 'long',

  impactExplosion: 'large',
  impactSound: 'boom',
  impactShake: 8,

  aftermathDuration: 2000,
  aftermathEffects: [
    'embers_rising',
    'smoke_black',
    'heat_shimmer',
    'scorch_marks',
    'orange_glow_fade',
  ],

  screenTint: 'rgba(255, 102, 0, 0.25)',
  screenFlash: '#FFAA00',
  screenDistortion: true,
  chromaticAberration: false,

  preferredCameraAction: 'shake',
  cameraIntensity: 8,

  environmentInteraction: [
    'scorch_ground',
    'melt_ice',
    'ignite_flammables',
    'heat_waves',
    'smoke_rise',
  ],

  uniqueVisuals: [
    'expanding_fireball',
    'flame_tongues',
    'radial_heat_distortion',
    'embers_spiral_upward',
    'orange_bloom_flash',
  ],
}

// ═══════════════════════════════════════════════════════════════
// THUNDER - Fast, blinding, jagged, electric, screen-piercing
// ═══════════════════════════════════════════════════════════════

export const THUNDER_BEHAVIOR: ElementBehavior = {
  primaryColor: '#FFFFFF',
  secondaryColor: '#00FFFF',
  glowColor: '#FFFF00',
  trailColor: '#66FFFF',

  particleShape: 'spark',
  particleCount: 200,
  particleSpeed: 'explosive',
  particleGravity: false,
  particleLifetime: 400,  // Very brief

  motionPattern: 'straight',
  motionSpeed: 'instant',
  trailLength: 'short',

  impactExplosion: 'medium',
  impactSound: 'crack',
  impactShake: 6,

  aftermathDuration: 800,
  aftermathEffects: [
    'electric_arcs',
    'smoke_white',
    'static_flicker',
    'lightning_fade',
  ],

  screenTint: 'rgba(255, 255, 255, 0.15)',
  screenFlash: '#FFFFFF',
  screenDistortion: true,
  chromaticAberration: true,  // Electric aberration effect

  preferredCameraAction: 'punch',
  cameraIntensity: 9,

  environmentInteraction: [
    'electric_pulse_arena',
    'light_flicker',
    'metal_conduct',
    'arc_to_metal',
  ],

  uniqueVisuals: [
    'jagged_lightning_bolt',
    'branching_arcs',
    'screen_wide_flash',
    'electric_web',
    'spark_shower',
  ],
}

// ═══════════════════════════════════════════════════════════════
// WATER - Forceful, flowing, splashing, pressurized, heavy
// ═══════════════════════════════════════════════════════════════

export const WATER_BEHAVIOR: ElementBehavior = {
  primaryColor: '#0066CC',
  secondaryColor: '#3399FF',
  glowColor: '#66CCFF',
  trailColor: '#0099FF',

  particleShape: 'droplet',
  particleCount: 180,
  particleSpeed: 'medium',
  particleGravity: true,  // Water falls
  particleLifetime: 1500,

  motionPattern: 'flow',
  motionSpeed: 'medium',
  trailLength: 'medium',

  impactExplosion: 'medium',
  impactSound: 'splash',
  impactShake: 5,

  aftermathDuration: 1800,
  aftermathEffects: [
    'water_droplets',
    'splash_ripples',
    'mist_cloud',
    'puddle_form',
    'dripping_water',
  ],

  screenTint: 'rgba(0, 102, 204, 0.18)',
  screenFlash: '#66CCFF',
  screenDistortion: true,  // Water ripple distortion
  chromaticAberration: false,

  preferredCameraAction: 'track',
  cameraIntensity: 6,

  environmentInteraction: [
    'splash_across_floor',
    'water_droplets_on_camera',
    'wet_reflections',
    'mist_linger',
  ],

  uniqueVisuals: [
    'pressurized_jet',
    'splash_explosion',
    'water_sphere',
    'ripple_waves',
    'mist_veil',
  ],
}

// ═══════════════════════════════════════════════════════════════
// ICE - Sharp, crystalline, cold, freezing
// ═══════════════════════════════════════════════════════════════

export const ICE_BEHAVIOR: ElementBehavior = {
  primaryColor: '#CCFFFF',
  secondaryColor: '#99CCFF',
  glowColor: '#FFFFFF',
  trailColor: '#66DDFF',

  particleShape: 'shard',
  particleCount: 120,
  particleSpeed: 'medium',
  particleGravity: true,
  particleLifetime: 1800,

  motionPattern: 'straight',
  motionSpeed: 'medium',
  trailLength: 'short',

  impactExplosion: 'medium',
  impactSound: 'crack',
  impactShake: 7,

  aftermathDuration: 2500,
  aftermathEffects: [
    'ice_shards',
    'frost_spread',
    'cold_mist',
    'frozen_particles',
    'icy_sheen',
  ],

  screenTint: 'rgba(204, 255, 255, 0.2)',
  screenFlash: '#FFFFFF',
  screenDistortion: false,
  chromaticAberration: false,

  preferredCameraAction: 'zoom',
  cameraIntensity: 7,

  environmentInteraction: [
    'frost_ground',
    'freeze_water',
    'ice_crystals_form',
    'cold_fog',
  ],

  uniqueVisuals: [
    'ice_spike_burst',
    'crystalline_shatter',
    'frost_spread_pattern',
    'ice_shard_rain',
    'frozen_explosion',
  ],
}

// ═══════════════════════════════════════════════════════════════
// EARTH - Crushing, dusty, fractured, seismic
// ═══════════════════════════════════════════════════════════════

export const EARTH_BEHAVIOR: ElementBehavior = {
  primaryColor: '#996633',
  secondaryColor: '#CC9966',
  glowColor: '#FFCC99',
  trailColor: '#885522',

  particleShape: 'circle',  // Dust/rocks
  particleCount: 100,
  particleSpeed: 'slow',
  particleGravity: true,
  particleLifetime: 2000,

  motionPattern: 'arc',
  motionSpeed: 'slow',
  trailLength: 'none',

  impactExplosion: 'large',
  impactSound: 'boom',
  impactShake: 10,  // Highest shake

  aftermathDuration: 3000,
  aftermathEffects: [
    'dust_cloud',
    'rocks_settle',
    'ground_cracks',
    'debris_scatter',
    'dust_linger',
  ],

  screenTint: 'rgba(153, 102, 51, 0.22)',
  screenFlash: '#CC9966',
  screenDistortion: true,  // Seismic wave distortion
  chromaticAberration: false,

  preferredCameraAction: 'shake',
  cameraIntensity: 10,

  environmentInteraction: [
    'ground_shatter',
    'crater_form',
    'dust_explosion',
    'rocks_fly',
    'seismic_wave',
  ],

  uniqueVisuals: [
    'boulder_impact',
    'ground_eruption',
    'dust_tsunami',
    'rock_fragments',
    'seismic_ripple',
  ],
}

// ═══════════════════════════════════════════════════════════════
// WIND - Slicing, swirling, dispersive, atmospheric
// ═══════════════════════════════════════════════════════════════

export const WIND_BEHAVIOR: ElementBehavior = {
  primaryColor: '#CCFFCC',
  secondaryColor: '#99FF99',
  glowColor: '#EEFFEE',
  trailColor: '#AAFFAA',

  particleShape: 'wisp',
  particleCount: 160,
  particleSpeed: 'fast',
  particleGravity: false,
  particleLifetime: 1000,

  motionPattern: 'spiral',
  motionSpeed: 'fast',
  trailLength: 'long',

  impactExplosion: 'medium',
  impactSound: 'whoosh',
  impactShake: 4,

  aftermathDuration: 1200,
  aftermathEffects: [
    'wind_swirl',
    'leaves_scatter',
    'air_currents',
    'dispersive_fade',
  ],

  screenTint: 'rgba(204, 255, 204, 0.12)',
  screenFlash: '#EEFFEE',
  screenDistortion: true,  // Air distortion
  chromaticAberration: false,

  preferredCameraAction: 'track',
  cameraIntensity: 5,

  environmentInteraction: [
    'debris_blow',
    'dust_swirl',
    'hair_blow',
    'atmospheric_pressure',
  ],

  uniqueVisuals: [
    'tornado_vortex',
    'slicing_wind_blades',
    'air_pressure_rings',
    'swirling_debris',
    'wind_tunnel_effect',
  ],
}

// ═══════════════════════════════════════════════════════════════
// DARK - Oppressive, shadowy, warping, eerie
// ═══════════════════════════════════════════════════════════════

export const DARK_BEHAVIOR: ElementBehavior = {
  primaryColor: '#330033',
  secondaryColor: '#660066',
  glowColor: '#990099',
  trailColor: '#220022',

  particleShape: 'wisp',
  particleCount: 140,
  particleSpeed: 'slow',
  particleGravity: false,
  particleLifetime: 1600,

  motionPattern: 'wave',
  motionSpeed: 'slow',
  trailLength: 'long',

  impactExplosion: 'medium',
  impactSound: 'whoosh',
  impactShake: 6,

  aftermathDuration: 2200,
  aftermathEffects: [
    'shadow_tendrils',
    'dark_mist',
    'void_pulse',
    'shadow_fade',
  ],

  screenTint: 'rgba(51, 0, 51, 0.35)',  // Heavy darkening
  screenFlash: '#330033',
  screenDistortion: true,  // Reality warp
  chromaticAberration: true,

  preferredCameraAction: 'tilt',
  cameraIntensity: 7,

  environmentInteraction: [
    'dim_lights',
    'shadow_expand',
    'void_sphere',
    'reality_distort',
  ],

  uniqueVisuals: [
    'shadow_wave',
    'void_sphere',
    'tendrils_reach',
    'reality_crack',
    'darkness_consume',
  ],
}

// ═══════════════════════════════════════════════════════════════
// LIGHT - Radiant, explosive, cleansing
// ═══════════════════════════════════════════════════════════════

export const LIGHT_BEHAVIOR: ElementBehavior = {
  primaryColor: '#FFFFFF',
  secondaryColor: '#FFFFCC',
  glowColor: '#FFFF99',
  trailColor: '#FFFFEE',

  particleShape: 'spark',
  particleCount: 180,
  particleSpeed: 'fast',
  particleGravity: false,
  particleLifetime: 900,

  motionPattern: 'burst',
  motionSpeed: 'instant',
  trailLength: 'medium',

  impactExplosion: 'large',
  impactSound: 'sharp',
  impactShake: 7,

  aftermathDuration: 1500,
  aftermathEffects: [
    'radiance_glow',
    'light_rays',
    'sparkles_fade',
    'holy_shimmer',
  ],

  screenTint: 'rgba(255, 255, 255, 0.25)',
  screenFlash: '#FFFFFF',
  screenDistortion: false,
  chromaticAberration: true,  // Prismatic light split

  preferredCameraAction: 'zoom',
  cameraIntensity: 8,

  environmentInteraction: [
    'illuminate_arena',
    'shadows_banish',
    'light_beam',
    'radiance_spread',
  ],

  uniqueVisuals: [
    'radiant_explosion',
    'light_beam_pierce',
    'holy_aura',
    'prismatic_burst',
    'cleansing_wave',
  ],
}

// ═══════════════════════════════════════════════════════════════
// Element behavior lookup
// ═══════════════════════════════════════════════════════════════

export const ELEMENT_BEHAVIORS: Record<string, ElementBehavior> = {
  fire: FIRE_BEHAVIOR,
  electric: THUNDER_BEHAVIOR,
  water: WATER_BEHAVIOR,
  ice: ICE_BEHAVIOR,
  ground: EARTH_BEHAVIOR,
  rock: EARTH_BEHAVIOR,
  flying: WIND_BEHAVIOR,
  grass: WIND_BEHAVIOR,
  bug: WIND_BEHAVIOR,
  dark: DARK_BEHAVIOR,
  ghost: DARK_BEHAVIOR,
  poison: DARK_BEHAVIOR,
  psychic: LIGHT_BEHAVIOR,
  fairy: LIGHT_BEHAVIOR,
  normal: {
    ...WIND_BEHAVIOR,
    primaryColor: '#9CA3AF',
    screenTint: 'rgba(156, 163, 175, 0.08)',
  },
  fighting: {
    ...FIRE_BEHAVIOR,
    primaryColor: '#DC2626',
    impactShake: 9,
  },
  dragon: {
    ...DARK_BEHAVIOR,
    primaryColor: '#7C3AED',
    screenTint: 'rgba(124, 58, 237, 0.22)',
  },
  steel: {
    ...ICE_BEHAVIOR,
    primaryColor: '#94A3B8',
    impactSound: 'sharp',
  },
}

export function getElementBehavior(element: string): ElementBehavior {
  return ELEMENT_BEHAVIORS[element.toLowerCase()] || ELEMENT_BEHAVIORS.normal
}
