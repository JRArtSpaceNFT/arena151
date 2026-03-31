import type { Arena } from '@/lib/game-types'

export const ARENAS: Arena[] = [
  // Normal
  { id: 'ash_pallet_town', name: 'Pallet Town Field', type: 'normal', bonusTypes: ['normal'], bonusAmount: 0.05, bgGradient: 'linear-gradient(135deg, #16a34a 0%, #065f46 100%)', image: '/arenas/Ash Pallet Town.png', event: { name: 'Gentle Breeze', description: 'A calm wind restores a small amount of HP.', chance: 0.08, effect: 'heal_small', telegraphText: 'A gentle breeze begins to stir in the tall grass...' } },

  // Fire
  { id: 'blaines_gym', name: "Cinnabar Island Volcano Arena", type: 'fire', bonusTypes: ['fire', 'rock'], bonusAmount: 0.05, bgGradient: 'linear-gradient(135deg, #7c2d12 0%, #1c1917 100%)', image: '/arenas/Blaines Gym.png', event: { name: 'Eruption', description: 'Volcanic energy lightly damages both active creatures.', chance: 0.1, effect: 'damage_both', telegraphText: 'The volcanic heat is building beneath your feet...' } },

  // Rock
  { id: 'brocks_gym', name: "Pewter City Rock Arena", type: 'rock', bonusTypes: ['rock', 'ground'], bonusAmount: 0.05, bgGradient: 'linear-gradient(135deg, #57534e 0%, #1c1917 100%)', image: '/arenas/Brocks Gym.png', event: { name: 'Rock Slide', description: 'Boulders crash down, damaging both active creatures.', chance: 0.1, effect: 'damage_both', telegraphText: 'The ground shakes as rocks begin to shift overhead...' } },

  // Fighting / Rock
  { id: 'brunos_stone_arena', name: "Final Four Stone Arena", type: 'fighting', bonusTypes: ['fighting', 'rock'], bonusAmount: 0.05, bgGradient: 'linear-gradient(135deg, #57534e 0%, #1c1917 100%)', image: '/arenas/Brunos Stone Arenea.png', event: { name: 'Rock Slide', description: 'Boulders crash down, damaging both active creatures.', chance: 0.1, effect: 'damage_both', telegraphText: 'The ground shakes as rocks begin to shift overhead...' } },

  // Grass
  { id: 'erikas_gym', name: "Celadon City Grassy Garden", type: 'grass', bonusTypes: ['grass', 'poison'], bonusAmount: 0.05, bgGradient: 'linear-gradient(135deg, #16a34a 0%, #052e16 100%)', image: '/arenas/Erikas Gym.png', event: { name: 'Petal Dance', description: 'Swirling petals restore HP to Grass creatures.', chance: 0.1, effect: 'heal_grass', telegraphText: 'Petals begin to swirl gently through the greenhouse...' } },

  // Normal / Rock
  { id: 'fujis_summit', name: "Lavender Tower Summit", type: 'normal', bonusTypes: ['normal', 'rock'], bonusAmount: 0.05, bgGradient: 'linear-gradient(135deg, #78716c 0%, #1c1917 100%)', image: '/arenas/Fujis Summet.png', event: { name: 'Mountain Wind', description: 'A cold mountain wind chills both creatures, lowering speed.', chance: 0.08, effect: 'damage_both', telegraphText: 'The wind howls across the summit...' } },

  // Ground / Poison
  { id: 'giovannis_gym', name: "Viridian City Ground Arena", type: 'ground', bonusTypes: ['ground', 'poison'], bonusAmount: 0.05, bgGradient: 'linear-gradient(135deg, #44403c 0%, #0c0a09 100%)', image: '/arenas/Giovannias Gym.png', event: { name: 'Earthquake', description: 'The ground ruptures, dealing damage to both active creatures.', chance: 0.12, effect: 'damage_both', telegraphText: 'The floor begins to tremble ominously...' } },

  // Poison
  { id: 'kogas_gym', name: "Fuchsia City Poison Dojo", type: 'poison', bonusTypes: ['poison'], bonusAmount: 0.05, bgGradient: 'linear-gradient(135deg, #5b21b6 0%, #1e1b4b 100%)', image: '/arenas/Kogas Gym.png', event: { name: 'Toxic Spores', description: 'Poison spores fill the air, boosting Poison move damage.', chance: 0.1, effect: 'boost_poison', telegraphText: 'A faint mist drifts through the corridors...' } },

  // Ice
  { id: 'loreleis_ice_arena', name: "Final Four Ice Arena", type: 'ice', bonusTypes: ['ice', 'water'], bonusAmount: 0.05, bgGradient: 'linear-gradient(135deg, #0ea5e9 0%, #0c4a6e 100%)', image: "/arenas/Loreleis Ice Arena.png", event: { name: 'Blizzard', description: 'A sudden blizzard chills both active creatures.', chance: 0.1, effect: 'damage_both', telegraphText: 'The temperature drops sharply as frost forms on the ground...' } },

  // Electric
  { id: 'lt_surge_gym', name: "Vermilion City Electric Arena", type: 'electric', bonusTypes: ['electric'], bonusAmount: 0.05, bgGradient: 'linear-gradient(135deg, #a16207 0%, #1c1917 100%)', image: '/arenas/LtSurgeGym.png', event: { name: 'Power Surge', description: 'Electric surge temporarily boosts Electric move damage.', chance: 0.1, effect: 'boost_electric', telegraphText: 'Static electricity crackles in the air...' } },

  // Psychic
  { id: 'mewtwo_lab', name: "Underground Laboratory", type: 'psychic', bonusTypes: ['psychic'], bonusAmount: 0.05, bgGradient: 'linear-gradient(135deg, #7c3aed 0%, #1e0438 100%)', image: "/arenas/MewTwos Lab.png", event: { name: 'Psychic Surge', description: 'Psychic energy surges, boosting Psychic move damage.', chance: 0.12, effect: 'boost_psychic', telegraphText: 'The air shimmers as psychic energy builds to a crescendo...' } },

  // Water
  { id: 'mistys_gym', name: "Cerulean City Water Arena", type: 'water', bonusTypes: ['water'], bonusAmount: 0.05, bgGradient: 'linear-gradient(135deg, #0369a1 0%, #0c4a6e 100%)', image: "/arenas/MistysGym.png", event: { name: 'Tidal Splash', description: 'A tidal wave temporarily boosts Water move damage.', chance: 0.1, effect: 'boost_water', telegraphText: 'The water in the arena begins to swirl...' } },

  // Poison / Normal
  { id: 'team_rocket_casino', name: 'Team Rocket Hideout', type: 'poison', bonusTypes: ['poison', 'normal'], bonusAmount: 0.05, bgGradient: 'linear-gradient(135deg, #dc2626 0%, #0f0f0f 100%)', image: '/arenas/Team Rocket Casino.png', event: { name: 'Rocket Ambush', description: 'Team Rocket throws a smoke bomb, damaging both active creatures.', chance: 0.12, effect: 'damage_both', telegraphText: 'The lights flicker... something sinister stirs in the shadows...' } },

]

export function getRandomArena(): Arena {
  return ARENAS[Math.floor(Math.random() * ARENAS.length)]
}

export function getArenaById(id: string): Arena | undefined {
  return ARENAS.find(a => a.id === id)
}
