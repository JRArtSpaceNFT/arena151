// ═══════════════════════════════════════════════════════════════
// POKÉBATTLE — TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════

export type PokemonType =
  | 'normal' | 'fire' | 'water' | 'electric' | 'grass' | 'ice'
  | 'fighting' | 'poison' | 'ground' | 'flying' | 'psychic' | 'bug'
  | 'rock' | 'ghost' | 'dragon' | 'dark' | 'steel'

export type MoveCategory = 'physical' | 'special' | 'status'

export type Screen =
  | 'home' | 'trainer_select' | 'coin_toss' | 'draft'
  | 'lineup' | 'arena_reveal' | 'pretalk' | 'bet' | 'battle' | 'result' | 'rules'
  | 'story_intro' | 'story_team_select' | 'story_journey' | 'story_trainer_intro' 
  | 'story_badge_reward' | 'story_hall_of_fame'
  | 'friend_battle_lobby'

export type GameMode = 'local_2p' | 'vs_ai' | 'story' | 'practice' | 'friend_battle' | 'paid_pvp'
export type AIDifficulty = 'easy' | 'normal' | 'hard'
export type CoinSide = 'red' | 'white'

// ── TRAINER ────────────────────────────────────────────────────
export interface TrainerBattleReactions {
  onCrit: string[]
  onSuperEffective: string[]
  onUltimate: string[]
  onLowHp: string[]
  onAceEnter: string[]
}

export interface TrainerAbility {
  name: string
  description: string
  effectKey: string  // used by battle engine
  value: number      // percentage value of the bonus (e.g. 0.05 = 5%)
}

export interface Trainer {
  id: string
  name: string
  color: string        // CSS color for accent
  bgColor: string      // CSS gradient or bg
  flavorText: string
  ability: TrainerAbility
  spriteUrl?: string
  winQuote?: string
  koPhrases: string[]
  talkLines: string[]
  battleReactions?: TrainerBattleReactions
  entranceScene?: string
  // Dossier fields
  title?: string        // e.g. "Water Gym Leader"
  location?: string     // e.g. "Cerulean City"
  battleStyles?: string[]  // e.g. ["💧 Water Specialist", "⚡ Speed Trainer", "🧠 Tactical"]
  signaturePokemon?: number[]  // Pokémon IDs (for sprites)
  winBg?: string   // path to win background image (e.g. '/trainer-bgs/red-win.jpg')
  lossBg?: string  // path to loss background image
}

// ── MOVE ──────────────────────────────────────────────────────
export interface Move {
  id: string
  name: string
  type: PokemonType
  power: number         // 0 for status moves
  accuracy: number      // 0-100
  pp?: number           // PP (optional, for display)
  category?: MoveCategory
  effectType?: 'damage' | 'status' | 'heal' | 'boost' | 'lower_enemy' | 'sleep'
  effectValue?: number
  isSignature?: boolean
  ultimateFlag?: boolean
  animationKey: string
  description?: string
}

// ── PASSIVE ───────────────────────────────────────────────────
export interface Passive {
  id: string
  name: string
  description: string
  effectKey: string
  value: number
}

// ── CREATURE ──────────────────────────────────────────────────
export interface Creature {
  id: number           // Pokedex number
  name: string
  types: PokemonType[]
  pointCost: number
  baseHp: number
  baseAtk: number
  baseDef: number
  baseSpe: number
  passive: Passive
  movePool: string[]   // Move IDs
  spriteUrl: string
  sleepDuration?: number  // set at sleep-apply time; how many turns to stay asleep
}

// ── ARENA ─────────────────────────────────────────────────────
export interface ArenaEvent {
  name: string
  description: string
  chance: number       // 0-1 per turn
  effect: string
  telegraphText?: string
}

export interface Arena {
  id: string
  name: string
  type: PokemonType | 'normal'
  bonusTypes: PokemonType[]
  bonusAmount: number  // default 0.05 = 5%
  bgGradient: string   // CSS gradient
  image?: string       // path to arena background image
  event?: ArenaEvent
}

// ── BATTLE TYPES ──────────────────────────────────────────────
export interface ActiveCreature {
  creature: Creature
  currentHp: number
  maxHp: number
  momentum: boolean
  shiny: boolean
  assignedMoves: Move[]
  kos: number
  damageDealt: number
  turnsAlive: number
  trainerPassiveApplied: boolean
  firstAttackDone: boolean
  entryHealDone: boolean
  ashBoostAvailable: boolean
  giovanniFirstDone: boolean
}

export type BattleEventType =
  | 'intro' | 'move' | 'damage' | 'ko' | 'swap' | 'critical'
  | 'ultimate' | 'shiny' | 'arena_event' | 'crowd_roar' | 'clutch'
  | 'trainer_passive' | 'win'
  | 'arena_telegraph' | 'trainer_react' | 'announcer'
  | 'status_damage'

export interface BattleLogEntry {
  id: number
  type: BattleEventType
  side?: 'A' | 'B'
  text: string
  commentary?: string
  damage?: number
  isCrit?: boolean
  isUltimate?: boolean
  moveName?: string
  creatureName?: string
  defenderName?: string
  hpAfter?: { A: number; B: number }
  crowdMeterAfter?: number
  statusAfter?: { A: string; B: string }
}

export interface BattleState {
  teamA: ActiveCreature[]
  teamB: ActiveCreature[]
  activeA: number
  activeB: number
  turn: number
  log: BattleLogEntry[]
  crowdMeter: number
  winner?: 'A' | 'B'
  phase: 'intro' | 'battle' | 'finished'
  arenaEventTriggered: boolean
}

// ── GAME STORE STATE ──────────────────────────────────────────
export interface BetInfo {
  amount: number
  side: 'p1' | 'p2'
}

export interface MatchResults {
  winner: 1 | 2
  mvp: ActiveCreature
  mostDamage: ActiveCreature
  mostKOs: ActiveCreature
  longestSurvival: ActiveCreature
  bestValue: ActiveCreature
  p1BetResult?: number   // positive = won, negative = lost
  p2BetResult?: number
}
