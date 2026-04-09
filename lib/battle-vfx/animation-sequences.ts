/**
 * Attack Animation Sequencing System
 * Defines the complete timing structure for attack animations
 * Based on Section 2 of the battle VFX spec
 */

export interface AnimationPhase {
  name: string
  duration: number          // milliseconds
  cameraAction?: string
  vfxTriggers?: string[]
  description: string
}

export interface AttackSequence {
  totalDuration: number
  phases: AnimationPhase[]
}

// ═══════════════════════════════════════════════════════════════
// LIGHT ATTACK SEQUENCE (Fast, snappy, ~600ms total)
// ═══════════════════════════════════════════════════════════════

export const LIGHT_ATTACK_SEQUENCE: AttackSequence = {
  totalDuration: 600,
  phases: [
    {
      name: 'anticipation',
      duration: 100,
      cameraAction: 'slight_zoom_in',
      description: 'Quick windup - attacker pulls back slightly',
    },
    {
      name: 'strike',
      duration: 150,
      cameraAction: 'follow',
      vfxTriggers: ['attack_trail', 'motion_blur'],
      description: 'Fast strike motion with trail',
    },
    {
      name: 'impact',
      duration: 50,
      cameraAction: 'punch_in',
      vfxTriggers: ['hit_stop', 'flash', 'shake_light', 'particles_burst'],
      description: 'Impact frame - brief freeze, small shake',
    },
    {
      name: 'recoil',
      duration: 150,
      cameraAction: 'bounce_back',
      vfxTriggers: ['damage_number', 'target_knockback'],
      description: 'Target reacts, damage number appears',
    },
    {
      name: 'settle',
      duration: 150,
      vfxTriggers: ['particles_fade', 'smoke_puff'],
      description: 'Aftermath - particles fade, small smoke',
    },
  ],
}

// ═══════════════════════════════════════════════════════════════
// HEAVY ATTACK SEQUENCE (Powerful, deliberate, ~1200ms total)
// ═══════════════════════════════════════════════════════════════

export const HEAVY_ATTACK_SEQUENCE: AttackSequence = {
  totalDuration: 1200,
  phases: [
    {
      name: 'anticipation',
      duration: 250,
      cameraAction: 'zoom_in_slow',
      vfxTriggers: ['attacker_glow', 'ground_rumble'],
      description: 'Visible windup - attacker charges power',
    },
    {
      name: 'charge',
      duration: 200,
      cameraAction: 'hold_close',
      vfxTriggers: ['charge_particles', 'element_aura', 'screen_tint_start'],
      description: 'Energy builds - particles gather, element glow',
    },
    {
      name: 'launch',
      duration: 200,
      cameraAction: 'snap_zoom_target',
      vfxTriggers: ['burst_particles', 'sound_whoosh'],
      description: 'Release - explosive launch motion',
    },
    {
      name: 'travel',
      duration: 150,
      cameraAction: 'track_projectile',
      vfxTriggers: ['projectile_trail', 'element_particles'],
      description: 'Projectile travels with heavy trail',
    },
    {
      name: 'impact',
      duration: 120,
      cameraAction: 'punch_in_heavy',
      vfxTriggers: ['hit_stop', 'flash_bright', 'shake_heavy', 'distortion_wave'],
      description: 'Major impact - long freeze, big shake, distortion',
    },
    {
      name: 'explosion',
      duration: 200,
      cameraAction: 'shake_decay',
      vfxTriggers: ['explosion_particles', 'debris', 'arena_crack'],
      description: 'Explosion expands - debris flies, arena cracks',
    },
    {
      name: 'aftermath',
      duration: 80,
      vfxTriggers: ['damage_number_huge', 'smoke_cloud', 'embers'],
      description: 'Lingering effects - smoke, embers, huge damage number',
    },
  ],
}

// ═══════════════════════════════════════════════════════════════
// SPECIAL ATTACK SEQUENCE (Ultimate, cinematic, ~2000ms total)
// ═══════════════════════════════════════════════════════════════

export const SPECIAL_ATTACK_SEQUENCE: AttackSequence = {
  totalDuration: 2000,
  phases: [
    {
      name: 'intro',
      duration: 300,
      cameraAction: 'focus_attacker',
      vfxTriggers: ['screen_darken', 'spotlight_attacker', 'name_callout'],
      description: 'Dramatic intro - screen darkens, spotlight, move name appears',
    },
    {
      name: 'anticipation',
      duration: 350,
      cameraAction: 'zoom_in_dramatic',
      vfxTriggers: ['attacker_glow_intense', 'ground_crack', 'wind_surge'],
      description: 'Long windup - visible power buildup, ground cracks',
    },
    {
      name: 'charge',
      duration: 300,
      cameraAction: 'rotate_slight',
      vfxTriggers: ['charge_vortex', 'element_storm', 'screen_shake_building'],
      description: 'Intense charge - vortex forms, element swirls, screen shakes',
    },
    {
      name: 'launch',
      duration: 250,
      cameraAction: 'whip_zoom_to_target',
      vfxTriggers: ['burst_explosion', 'speed_lines', 'element_beam'],
      description: 'Massive launch - camera whips to target, speed lines',
    },
    {
      name: 'travel',
      duration: 200,
      cameraAction: 'follow_fast',
      vfxTriggers: ['massive_trail', 'environment_react', 'buildup_sound'],
      description: 'Fast travel - environment reacts as projectile passes',
    },
    {
      name: 'impact',
      duration: 150,
      cameraAction: 'freeze_zoom',
      vfxTriggers: ['hit_stop_long', 'white_flash', 'time_slow'],
      description: 'Impact freeze - white flash, time slows, long hit-stop',
    },
    {
      name: 'explosion',
      duration: 350,
      cameraAction: 'shake_extreme',
      vfxTriggers: ['massive_explosion', 'shockwave', 'debris_storm', 'arena_shatter'],
      description: 'Huge explosion - shockwave expands, arena shatters',
    },
    {
      name: 'aftermath',
      duration: 100,
      cameraAction: 'settle_slow',
      vfxTriggers: ['damage_number_critical', 'smoke_heavy', 'embers_rain', 'crater'],
      description: 'Dramatic aftermath - crater forms, embers rain, smoke billows',
    },
  ],
}

// ═══════════════════════════════════════════════════════════════
// CRITICAL HIT MODIFICATIONS
// ═══════════════════════════════════════════════════════════════

export const CRITICAL_MODIFIERS = {
  impactDurationMultiplier: 1.5,      // Freeze longer on crits
  particleCountMultiplier: 2,         // Double particles
  flashIntensityBonus: 0.3,           // Extra flash brightness
  shakeIntensityMultiplier: 1.5,      // Bigger shake
  slowMotionOnImpact: true,           // Brief slow-mo on crit impact
  additionalVfx: [
    'golden_flash',
    'star_burst',
    'crit_text_callout',
    'screen_flash_gold',
  ],
}

// ═══════════════════════════════════════════════════════════════
// SUPER EFFECTIVE MODIFICATIONS
// ═══════════════════════════════════════════════════════════════

export const SUPER_EFFECTIVE_MODIFIERS = {
  impactDurationMultiplier: 1.3,
  particleCountMultiplier: 1.5,
  elementIntensityBonus: 0.5,         // Element effects more intense
  additionalVfx: [
    'element_explosion_bonus',
    'super_effective_text',
    'screen_flash_element_color',
    'extra_debris',
  ],
}

// ═══════════════════════════════════════════════════════════════
// COMBO CHAIN MODIFICATIONS
// ═══════════════════════════════════════════════════════════════

export const COMBO_MODIFIERS = {
  2: {
    anticipationReduction: 0.8,       // Faster follow-up
    impactBonus: 1.1,
    additionalVfx: ['combo_text_2'],
  },
  3: {
    anticipationReduction: 0.7,
    impactBonus: 1.2,
    additionalVfx: ['combo_text_3', 'combo_glow'],
  },
  4: {
    anticipationReduction: 0.6,
    impactBonus: 1.4,
    additionalVfx: ['combo_text_4', 'combo_explosion'],
  },
  5: {
    anticipationReduction: 0.5,
    impactBonus: 1.6,
    additionalVfx: ['combo_text_5', 'combo_finisher', 'screen_flash_rainbow'],
  },
}

// ═══════════════════════════════════════════════════════════════
// FINISHER SEQUENCE (Decisive KO, ~2500ms total)
// ═══════════════════════════════════════════════════════════════

export const FINISHER_SEQUENCE: AttackSequence = {
  totalDuration: 2500,
  phases: [
    {
      name: 'tension',
      duration: 200,
      cameraAction: 'zoom_both_fighters',
      vfxTriggers: ['screen_vignette', 'tension_pulse'],
      description: 'Pre-finisher tension - camera shows both fighters',
    },
    {
      name: 'anticipation',
      duration: 400,
      cameraAction: 'slow_zoom_attacker',
      vfxTriggers: ['dramatic_pause', 'wind_buildup', 'attacker_aura'],
      description: 'Long anticipation - dramatic pause, wind builds',
    },
    {
      name: 'charge',
      duration: 350,
      cameraAction: 'tilt_angle',
      vfxTriggers: ['charge_massive', 'environment_react_heavy', 'screen_distortion'],
      description: 'Massive charge - environment reacts, screen distorts',
    },
    {
      name: 'launch',
      duration: 300,
      cameraAction: 'speed_ramp',
      vfxTriggers: ['launch_explosion', 'time_slow_start', 'speed_lines_intense'],
      description: 'Launch with speed ramp - time begins to slow',
    },
    {
      name: 'slow_motion_travel',
      duration: 400,
      cameraAction: 'track_slow',
      vfxTriggers: ['slow_motion_active', 'trail_elongated', 'dramatic_sound'],
      description: 'Slow motion travel - 0.25x speed, elongated trail',
    },
    {
      name: 'impact',
      duration: 250,
      cameraAction: 'freeze_frame',
      vfxTriggers: ['hit_stop_extreme', 'white_out_flash', 'time_freeze'],
      description: 'Impact freeze - white flash, complete time stop',
    },
    {
      name: 'explosion',
      duration: 450,
      cameraAction: 'shake_massive',
      vfxTriggers: ['finisher_explosion', 'shockwave_screen', 'arena_devastate', 'ko_text'],
      description: 'Finisher explosion - arena devastates, K.O. text appears',
    },
    {
      name: 'aftermath',
      duration: 150,
      cameraAction: 'settle_dramatic',
      vfxTriggers: ['smoke_massive', 'debris_settle', 'victor_spotlight'],
      description: 'Dramatic aftermath - smoke clears, spotlight on victor',
    },
  ],
}

// ═══════════════════════════════════════════════════════════════
// HELPER: Get sequence by attack type
// ═══════════════════════════════════════════════════════════════

export function getAttackSequence(
  attackType: 'light' | 'heavy' | 'special' | 'finisher',
  modifiers?: {
    isCritical?: boolean
    isSuperEffective?: boolean
    comboCount?: number
  }
): AttackSequence {
  let sequence: AttackSequence

  switch (attackType) {
    case 'light':
      sequence = LIGHT_ATTACK_SEQUENCE
      break
    case 'heavy':
      sequence = HEAVY_ATTACK_SEQUENCE
      break
    case 'special':
      sequence = SPECIAL_ATTACK_SEQUENCE
      break
    case 'finisher':
      sequence = FINISHER_SEQUENCE
      break
  }

  // Apply modifiers
  if (modifiers?.isCritical || modifiers?.isSuperEffective || modifiers?.comboCount) {
    sequence = applySequenceModifiers(sequence, modifiers)
  }

  return sequence
}

function applySequenceModifiers(
  sequence: AttackSequence,
  modifiers: {
    isCritical?: boolean
    isSuperEffective?: boolean
    comboCount?: number
  }
): AttackSequence {
  const modified = JSON.parse(JSON.stringify(sequence)) as AttackSequence

  // Apply critical modifiers
  if (modifiers.isCritical) {
    const impactPhase = modified.phases.find(p => p.name === 'impact')
    if (impactPhase) {
      impactPhase.duration *= CRITICAL_MODIFIERS.impactDurationMultiplier
      impactPhase.vfxTriggers = [
        ...(impactPhase.vfxTriggers || []),
        ...CRITICAL_MODIFIERS.additionalVfx,
      ]
    }
  }

  // Apply super effective modifiers
  if (modifiers.isSuperEffective) {
    const impactPhase = modified.phases.find(p => p.name === 'impact')
    if (impactPhase) {
      impactPhase.duration *= SUPER_EFFECTIVE_MODIFIERS.impactDurationMultiplier
      impactPhase.vfxTriggers = [
        ...(impactPhase.vfxTriggers || []),
        ...SUPER_EFFECTIVE_MODIFIERS.additionalVfx,
      ]
    }
  }

  // Apply combo modifiers
  if (modifiers.comboCount && modifiers.comboCount >= 2) {
    const comboMod = COMBO_MODIFIERS[modifiers.comboCount as keyof typeof COMBO_MODIFIERS]
    if (comboMod) {
      const anticipationPhase = modified.phases.find(p => p.name === 'anticipation')
      if (anticipationPhase) {
        anticipationPhase.duration *= comboMod.anticipationReduction
      }

      const impactPhase = modified.phases.find(p => p.name === 'impact')
      if (impactPhase) {
        impactPhase.vfxTriggers = [
          ...(impactPhase.vfxTriggers || []),
          ...comboMod.additionalVfx,
        ]
      }
    }
  }

  return modified
}
