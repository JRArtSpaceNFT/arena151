// ═══════════════════════════════════════════════════════════════
// POKÉBATTLE — BATTLE ENGINE
// ═══════════════════════════════════════════════════════════════

import type { ActiveCreature, Arena, BattleLogEntry, BattleState, Move, PokemonType, Trainer } from '@/lib/game-types'
import { MOVE_MAP } from '@/lib/data/moves'
import { CREATURES } from '@/lib/data/creatures'
import { getPersonality, getPersonalityMultiplier } from '@/lib/data/personalities'
import { getAnnouncerLine } from '@/lib/data/announcer'

// ── TYPE CHART ────────────────────────────────────────────────
// TYPE_CHART[attackingType][defendingType] = multiplier
const TYPE_CHART: Record<string, Record<string, number>> = {
  normal:   { ghost: 0, rock: 0.5, steel: 0.5 },
  fire:     { fire: 0.5, water: 0.5, rock: 0.5, dragon: 0.5, grass: 2, ice: 2, bug: 2, steel: 2 },
  water:    { water: 0.5, grass: 0.5, dragon: 0.5, fire: 2, ground: 2, rock: 2 },
  electric: { electric: 0.5, grass: 0.5, dragon: 0.5, ground: 0, water: 2, flying: 2 },
  grass:    { fire: 0.5, grass: 0.5, poison: 0.5, flying: 0.5, bug: 0.5, dragon: 0.5, steel: 0.5, water: 2, ground: 2, rock: 2 },
  ice:      { water: 0.5, ice: 0.5, steel: 0.5, fire: 0.5, grass: 2, ground: 2, flying: 2, dragon: 2 },
  fighting: { poison: 0.5, bug: 0.5, flying: 0.5, psychic: 0.5, ghost: 0, normal: 2, ice: 2, rock: 2, dark: 2, steel: 2 },
  poison:   { poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0, grass: 2 },
  ground:   { grass: 0.5, bug: 0.5, flying: 0, fire: 2, electric: 2, poison: 2, rock: 2, steel: 2 },
  flying:   { electric: 0.5, rock: 0.5, steel: 0.5, grass: 2, fighting: 2, bug: 2 },
  psychic:  { psychic: 0.5, steel: 0.5, dark: 0, fighting: 2, poison: 2 },
  bug:      { fire: 0.5, flying: 0.5, fighting: 0.5, ghost: 0.5, steel: 0.5, poison: 0.5, grass: 2, psychic: 2, dark: 2 },
  rock:     { fighting: 0.5, ground: 0.5, steel: 0.5, fire: 2, ice: 2, flying: 2, bug: 2 },
  ghost:    { normal: 0, fighting: 0, ghost: 2, psychic: 2, dark: 0.5 },
  dragon:   { steel: 0.5, dragon: 2 },
  dark:     { fighting: 0.5, dark: 0.5, ghost: 2, psychic: 2 },
  steel:    { fire: 0.5, water: 0.5, electric: 0.5, steel: 0.5, ice: 2, rock: 2 },
}

export function getTypeMultiplier(attackType: PokemonType, defenseTypes: PokemonType[]): number {
  const chart = TYPE_CHART[attackType] ?? {}
  let multiplier = 1
  for (const dt of defenseTypes) {
    multiplier *= chart[dt] ?? 1
  }
  return multiplier
}

// ── HP SCALING ────────────────────────────────────────────────
export const HP_SCALE = 1

// ── CREATE ACTIVE CREATURE ────────────────────────────────────
export function createActiveCreature(creatureId: number, rng?: () => number): ActiveCreature {
  const creature = CREATURES.find(c => c.id === creatureId)
  if (!creature) throw new Error(`Creature ${creatureId} not found`)

  const assignedMoves: Move[] = creature.movePool
    .map(id => MOVE_MAP[id])
    .filter(Boolean)

  const isShiny = (rng ?? Math.random)() < 1 / 256
  const maxHp = creature.baseHp * HP_SCALE

  return {
    creature,
    currentHp: maxHp,
    maxHp,
    momentum: false,
    shiny: isShiny,
    assignedMoves,
    kos: 0,
    damageDealt: 0,
    turnsAlive: 0,
    trainerPassiveApplied: false,
    firstAttackDone: false,
    entryHealDone: false,
    ashBoostAvailable: false,
    giovanniFirstDone: false,
  }
}

// ── STATUS TRACKING (local to engine) ────────────────────────
type Status = 'none' | 'sleep' | 'paralyzed' | 'poisoned' | 'burned' | 'frozen' | 'confused'

interface BattleCreatureState {
  healUsed: boolean  // Recover/Rest/Soft-Boiled limited to once per match
  lastMoveId?: string
  lastMoveCount?: number
  ac: ActiveCreature
  status: Status
  statusTurns: number
  ultimateUsed: boolean
  tempAtkBoost: number
  sleepTurns: number
  flinched: boolean
  confuseTurns: number
  sleepUsedAgainst: string | null  // creature name that was already put to sleep — can't re-use sleep on same target
  consecutiveCrits: number
  // Stat stages (-3 to +3)
  atkStage: number
  defStage: number
  speStage: number
  // PP tracking
  ppMap: Record<string, number>
  // Ditto: has Transform been used yet?
  dittoTransformed: boolean
  // Ditto: used follow-up attack after Transform this turn — skip next attack opportunity
  dittoSkipNextAttack: boolean
  // Consecutive-attack tracking: did this side land an attack last turn?
  lastTurnActuallyAttacked: boolean
  // Was this side's skip last turn excused (sleep / paralysis)? If so, opponent may go again.
  lastTurnSkipWasExcused: boolean
}

function buildPpMap(moves: Move[]): Record<string, number> {
  const map: Record<string, number> = {}
  for (const m of moves) {
    if (m.pp !== undefined) { map[m.id] = m.pp; continue }
    if (m.ultimateFlag) { map[m.id] = 1; continue }
    if (m.power === 0) { map[m.id] = 15; continue }
    if (m.power >= 90) { map[m.id] = 8; continue }
    if (m.power >= 60) { map[m.id] = 12; continue }
    map[m.id] = 20
  }
  return map
}

function stageMult(stage: number): number {
  return stage >= 0 ? (2 + stage) / 2 : 2 / (2 + Math.abs(stage))
}

function initBCS(ac: ActiveCreature): BattleCreatureState {
  return {
    ac, status: 'none', statusTurns: 0, ultimateUsed: false, healUsed: false,
    tempAtkBoost: 0, sleepTurns: 0, sleepUsedAgainst: null,
    flinched: false, confuseTurns: 0, consecutiveCrits: 0,
    atkStage: 0, defStage: 0, speStage: 0,
    ppMap: buildPpMap(ac.assignedMoves),
    dittoTransformed: false,
    dittoSkipNextAttack: false,
    lastTurnActuallyAttacked: false,
    lastTurnSkipWasExcused: false,
  }
}

// ── PASSIVE EFFECT ON DAMAGE ──────────────────────────────────
function applyPassiveBonus(bcs: BattleCreatureState, moveType: PokemonType): number {
  const ek = bcs.ac.creature.passive.effectKey
  const hp = bcs.ac.currentHp
  const maxHp = bcs.ac.maxHp
  const hpRatio = hp / maxHp

  switch (ek) {
    case 'blaze':
    case 'blaze_strong':
      if (moveType === 'fire' && hpRatio < 0.33) return ek === 'blaze_strong' ? 0.08 : 0.05
      break
    case 'torrent':
    case 'torrent_strong':
      if (moveType === 'water' && hpRatio < 0.33) return ek === 'torrent_strong' ? 0.08 : 0.05
      break
    case 'overgrow':
      if (moveType === 'grass' && hpRatio < 0.33) return 0.05
      break
    case 'swarm_strong':
      if (moveType === 'bug' && hpRatio < 0.33) return 0.08
      break
    case 'flash_fire':
      if (moveType === 'fire') return 0.10
      break
    case 'sheer_force':
      return 0.08
    case 'adaptability':
      return 0.10  // extra STAB (handled below separately, but add here too)
    case 'moxie':
      if (bcs.ac.kos > 0) return bcs.ac.kos * 0.10
      break
  }
  return 0
}

function applyArenaBonus(arena: Arena, moveType: PokemonType): number {
  if (arena.bonusTypes.includes(moveType)) return arena.bonusAmount
  return 0
}

// ── TRAINER ABILITY EFFECTS ───────────────────────────────────
function applyTrainerAtkBonus(
  bcs: BattleCreatureState,
  trainer: Trainer,
  move: Move,
  isCrit: boolean,
  arena: Arena,
): number {
  const ek = trainer.ability.effectKey
  const ct = bcs.ac.creature.types
  const val = trainer.ability.value

  switch (ek) {
    case 'tidal_focus':
      if (ct.includes('water')) return val
      break
    case 'burning_spirit':
      if (ct.includes('fire') && move.isSignature) return val
      break
    case 'stone_discipline':
      // def bonus, not atk
      break
    case 'dragon_aura':
      if (ct.includes('dragon') || ct.includes('flying')) return val
      break
    case 'iron_fist':
      if ((ct.includes('fighting') || ct.includes('rock')) && isCrit) return val
      break
    case 'power_surge':
      if (ct.includes('electric')) return val
      break
    case 'rival_pressure':
      if (bcs.ac.kos > 0 && bcs.ac.momentum) return val
      break
    case 'heavy_command':
      if ((ct.includes('ground')) && !bcs.ac.giovanniFirstDone) return val
      break
    case 'champion_focus':
      if (isCrit) return 0.05  // crit chance bonus AND crit damage boost for Blue
      break
    case 'battle_heart':
      if (bcs.ac.ashBoostAvailable) return val
      break
  }
  return 0
}

function applyTrainerDefBonus(bcs: BattleCreatureState, trainer: Trainer, arena: Arena): number {
  const ek = trainer.ability.effectKey
  const ct = bcs.ac.creature.types
  const val = trainer.ability.value

  switch (ek) {
    case 'stone_discipline':
      if (ct.includes('rock') || ct.includes('ground')) return val
      break
    case 'frozen_grace':
      if ((ct.includes('ice') || ct.includes('water')) &&
          (arena.bonusTypes.includes('ice') || arena.bonusTypes.includes('water'))) return val
      break
  }
  return 0
}

const STRUGGLE: Move = { id: 'struggle', name: 'Struggle', type: 'normal', power: 40, accuracy: 100, category: 'physical', animationKey: 'tackle' }

// ── PICK MOVE (AI / deterministic best) ──────────────────────
function pickMove(
  attackerBCS: BattleCreatureState,
  defenderBCS: BattleCreatureState,
  arena: Arena,
  trainerAtk: Trainer,
  rng: () => number,
): Move {
  // Ditto: force Transform on first move if not yet transformed
  if (attackerBCS.ac.creature.id === 132 && !attackerBCS.dittoTransformed) {
    const transformMove = attackerBCS.ac.assignedMoves.find(m => m.id === 'transform')
    if (transformMove) return transformMove
  }

  const SLEEP_MOVES = new Set(['sleep_powder', 'sing', 'hypnosis', 'spore', 'lovely_kiss'])

  // Filter to moves with PP remaining
  // Block sleep moves if: target is already asleep OR this attacker already used sleep on this specific target
  const allMoves = attackerBCS.ac.assignedMoves.filter(m => {
    if ((attackerBCS.ppMap[m.id] ?? 0) <= 0) return false
    if (SLEEP_MOVES.has(m.id) && defenderBCS.status === 'sleep') return false
    if (SLEEP_MOVES.has(m.id) && attackerBCS.sleepUsedAgainst === defenderBCS.ac.creature.name) return false
    return true
  })
  if (allMoves.length === 0) return STRUGGLE

  const moves = allMoves.filter(m => m.power > 0)
  if (moves.length === 0) {
    return allMoves[0]
  }

  const hpRatio = attackerBCS.ac.currentHp / attackerBCS.ac.maxHp

  // Use ultimate if HP < 30% and not yet used
  const ultMove = moves.find(m => m.ultimateFlag && !attackerBCS.ultimateUsed)
  if (ultMove && hpRatio < 0.30) {
    return ultMove
  }

  // Weighted random move selection — avoids spamming same move
  const lastMoveId = attackerBCS.lastMoveId
  const repeatCount = attackerBCS.lastMoveCount ?? 0

  const personality = getPersonality(attackerBCS.ac.creature.id)

  const scored = allMoves
    .filter(m => !(m.ultimateFlag && attackerBCS.ultimateUsed))
    // Ultimates are reserved for crisis moments only (< 30% HP) — prevents OHKOs on turn 1
    .filter(m => !(m.ultimateFlag && hpRatio >= 0.30))
    // Heal status moves limited to once per match
    .filter(m => !(m.effectType === 'heal' && m.category === 'status' && attackerBCS.healUsed))
    // Never use heal moves at full HP — pointless
    .filter(m => !(m.effectType === 'heal' && m.category === 'status' && attackerBCS.ac.currentHp >= attackerBCS.ac.maxHp))
    .map(m => {
      const tm = getTypeMultiplier(m.type, defenderBCS.ac.creature.types)
      const isStatus = m.power === 0
      const isUlt = m.ultimateFlag ?? false
      const acc = m.accuracy === 999 ? 100 : m.accuracy
      // Status moves get base score of 30 so tricksters can actually pick them
      let score = (isStatus ? 30 : m.power) * (isStatus ? 1 : tm) * (acc / 100)
      score *= getPersonalityMultiplier(personality, m.power, acc, isUlt, isStatus, hpRatio)
      // Hard block: can never use the same move twice in a row
      if (m.id === lastMoveId) {
        score = 0
      }
      return { move: m, score: Math.max(score, 0.1) }
    })

  // Filter out hard-blocked moves (score === 0), fall back to full list if all blocked
  const eligible = scored.filter(s => s.score > 0)
  const pool = eligible.length > 0 ? eligible : scored

  if (pool.length === 0) return moves[0]

  // Weighted random: higher score = more likely
  const total = pool.reduce((sum, s) => sum + s.score, 0)
  let rand = rng() * total
  for (const s of pool) {
    rand -= s.score
    if (rand <= 0) return s.move
  }
  return pool[pool.length - 1].move
}

// ── LOG ID COUNTER ────────────────────────────────────────────
let _logId = 0
function nextId() { return ++_logId }

// ── APPLY ENTRY EFFECTS ───────────────────────────────────────
function applyEntryEffects(
  bcs: BattleCreatureState,
  trainer: Trainer,
  arena: Arena,
  log: BattleLogEntry[],
  side: 'A' | 'B',
): void {
  // Shiny bonus
  if (bcs.ac.shiny) {
    const boost = 0.03
    bcs.ac.creature = {
      ...bcs.ac.creature,
      baseAtk: Math.floor(bcs.ac.creature.baseAtk * (1 + boost)),
      baseDef: Math.floor(bcs.ac.creature.baseDef * (1 + boost)),
      baseSpe: Math.floor(bcs.ac.creature.baseSpe * (1 + boost)),
    }
    log.push({
      id: nextId(), type: 'shiny', side,
      text: `✨ ${bcs.ac.creature.name} is SHINY! All stats +3%!`,
      commentary: 'A rare and powerful variant appears!',
      creatureName: bcs.ac.creature.name,
    })
    log.push({ id: nextId(), type: 'announcer', side, text: getAnnouncerLine('shiny') })
  }

  // Natural Calm (Erika): Grass creatures heal 4% HP on entry
  if (trainer.ability.effectKey === 'natural_calm' && bcs.ac.creature.types.includes('grass') && !bcs.ac.entryHealDone) {
    const heal = Math.floor(bcs.ac.maxHp * 0.04)
    bcs.ac.currentHp = Math.min(bcs.ac.maxHp, bcs.ac.currentHp + heal)
    bcs.ac.entryHealDone = true
    log.push({
      id: nextId(), type: 'trainer_passive', side,
      text: `🌿 ${bcs.ac.creature.name} restored ${heal} HP from Natural Calm!`,
      creatureName: bcs.ac.creature.name,
    })
  }

  // Natural Cure passive: cure status on entry
  const passiveEk = bcs.ac.creature.passive.effectKey
  if ((passiveEk === 'heal_status' || passiveEk === 'heal_status_boost') && bcs.status !== 'none') {
    bcs.status = 'none'
    log.push({
      id: nextId(), type: 'trainer_passive', side,
      text: `💊 ${bcs.ac.creature.name}'s Natural Cure removed its status condition!`,
      creatureName: bcs.ac.creature.name,
    })
  }

  // Momentum (from previous KO)
  if (bcs.ac.momentum) {
    log.push({
      id: nextId(), type: 'trainer_passive', side,
      text: `⚡ ${bcs.ac.creature.name} enters with MOMENTUM! (+5% ATK)`,
      creatureName: bcs.ac.creature.name,
    })
  }
}

// ── SIMULATE A SINGLE ATTACK ──────────────────────────────────
function simulateAttack(
  attackerBCS: BattleCreatureState,
  defenderBCS: BattleCreatureState,
  move: Move,
  arena: Arena,
  trainerAtk: Trainer,
  trainerDef: Trainer,
  side: 'A' | 'B',
  log: BattleLogEntry[],
  crowdMeter: { value: number },
  weather: string = 'none',
  rng: () => number = Math.random.bind(Math),
): void {
  // Skip if attacker fainted
  if (attackerBCS.ac.currentHp <= 0) return

  // Decrement PP (Struggle has no PP)
  if (move.id !== 'struggle' && attackerBCS.ppMap[move.id] !== undefined) {
    attackerBCS.ppMap[move.id] = Math.max(0, attackerBCS.ppMap[move.id] - 1)
  }

  // Sleep: skip 2–3 moves, then wake up
  if (attackerBCS.status === 'sleep') {
    attackerBCS.sleepTurns++
    const wakeTurn = attackerBCS.ac.creature.sleepDuration ?? 2 // set once on apply; default 2
    if (attackerBCS.sleepTurns >= wakeTurn) {
      attackerBCS.status = 'none'
      attackerBCS.sleepTurns = 0
      delete (attackerBCS.ac.creature as any).sleepDuration
      log.push({
        id: nextId(), type: 'move', side,
        text: `☀️ ${attackerBCS.ac.creature.name} woke up!`,
        creatureName: attackerBCS.ac.creature.name,
      })
    } else {
      log.push({
        id: nextId(), type: 'move', side,
        text: `😴 ${attackerBCS.ac.creature.name} is fast asleep! It missed its move!`,
        creatureName: attackerBCS.ac.creature.name,
      })
    }
    return
  }

  // Accuracy check — floor at 88 so even wild inaccurate moves (Thunder 70%) hit most of the time
  const accuracy = move.accuracy === 999 ? 100 : move.accuracy
  const effectiveAccuracy = accuracy < 100 ? Math.max(accuracy, 88) : 100
  const trainerAccBonus = trainerAtk.ability.effectKey === 'professor_strategy' ? trainerAtk.ability.value : 0
  const accCheck = rng() * 100
  if (accCheck > effectiveAccuracy + trainerAccBonus * 100) {
    log.push({
      id: nextId(), type: 'move', side,
      text: `💨 ${attackerBCS.ac.creature.name} used ${move.name} but it missed!`,
      moveName: move.name,
      creatureName: attackerBCS.ac.creature.name,
    })
    return
  }

  // Status-only moves
  if (move.power === 0) {
    if (move.effectType === 'status') {
      if (move.id === 'sleep_powder' || move.id === 'sing' || move.id === 'hypnosis' || move.id === 'spore' || move.id === 'lovely_kiss') {
        if (defenderBCS.status === 'sleep') {
          // Already asleep — move does nothing, log it as a wasted turn
          log.push({
            id: nextId(), type: 'move', side,
            text: `💤 ${attackerBCS.ac.creature.name} used ${move.name}... but ${defenderBCS.ac.creature.name} is already asleep!`,
            moveName: move.name,
            creatureName: attackerBCS.ac.creature.name,
            defenderName: defenderBCS.ac.creature.name,
          })
        } else if (defenderBCS.ac.creature.passive.effectKey === 'sleep_immune') {
          log.push({
            id: nextId(), type: 'move', side,
            text: `🛡️ ${defenderBCS.ac.creature.name} is immune to sleep!`,
            creatureName: defenderBCS.ac.creature.name,
          })
        } else if (defenderBCS.status === 'none') {
          defenderBCS.status = 'sleep'
          defenderBCS.sleepTurns = 0
          attackerBCS.sleepUsedAgainst = defenderBCS.ac.creature.name  // lock: can't sleep this target again
          ;(defenderBCS.ac.creature as any).sleepDuration = rng() < 0.5 ? 2 : 3 // 2 or 3 missed moves
          log.push({
            id: nextId(), type: 'move', side,
            text: `💤 ${attackerBCS.ac.creature.name} used ${move.name}! ${defenderBCS.ac.creature.name} fell asleep!`,
            moveName: move.name,
            creatureName: attackerBCS.ac.creature.name,
            defenderName: defenderBCS.ac.creature.name,
          })
        } else {
          // Target has a different status — sleep move fails, show miss
          log.push({
            id: nextId(), type: 'move', side,
            text: `💨 ${attackerBCS.ac.creature.name} used ${move.name} but it missed!`,
            moveName: move.name,
            creatureName: attackerBCS.ac.creature.name,
          })
        }
      } else if (move.id === 'confuse_ray' || move.id === 'supersonic') {
        if (defenderBCS.status !== 'confused') {
          defenderBCS.status = 'confused'
          defenderBCS.confuseTurns = 2 + Math.floor(rng() * 2)
          log.push({
            id: nextId(), type: 'move', side,
            text: `😵 ${attackerBCS.ac.creature.name} used ${move.name}! ${defenderBCS.ac.creature.name} is now confused!`,
            moveName: move.name, creatureName: attackerBCS.ac.creature.name, defenderName: defenderBCS.ac.creature.name,
            // statusAfter is stamped by the caller in the main loop (below)
          })
        } else {
          log.push({
            id: nextId(), type: 'move', side,
            text: `😵 ${attackerBCS.ac.creature.name} used ${move.name}... but ${defenderBCS.ac.creature.name} is already confused!`,
            moveName: move.name, creatureName: attackerBCS.ac.creature.name, defenderName: defenderBCS.ac.creature.name,
          })
        }
      } else if (move.id === 'swords_dance') {
        attackerBCS.atkStage = Math.min(3, attackerBCS.atkStage + 2)
        log.push({ id: nextId(), type: 'move', side, text: `⚔️ ${attackerBCS.ac.creature.name} used Swords Dance! Attack sharply rose!`, moveName: move.name, creatureName: attackerBCS.ac.creature.name })
      } else if (move.id === 'calm_mind') {
        attackerBCS.atkStage = Math.min(3, attackerBCS.atkStage + 1)
        attackerBCS.defStage = Math.min(3, attackerBCS.defStage + 1)
        log.push({ id: nextId(), type: 'move', side, text: `🧘 ${attackerBCS.ac.creature.name} used Calm Mind! Sp.Atk and Sp.Def rose!`, moveName: move.name, creatureName: attackerBCS.ac.creature.name })
      } else if (move.id === 'agility' || move.id === 'dragon_dance') {
        attackerBCS.speStage = Math.min(3, attackerBCS.speStage + 2)
        if (move.id === 'dragon_dance') attackerBCS.atkStage = Math.min(3, attackerBCS.atkStage + 1)
        log.push({ id: nextId(), type: 'move', side, text: `💨 ${attackerBCS.ac.creature.name} used ${move.name}! Speed sharply rose!`, moveName: move.name, creatureName: attackerBCS.ac.creature.name })
      } else if (move.id === 'harden' || move.id === 'withdraw' || move.id === 'defense_curl') {
        attackerBCS.defStage = Math.min(3, attackerBCS.defStage + 1)
        log.push({ id: nextId(), type: 'move', side, text: `🛡️ ${attackerBCS.ac.creature.name} used ${move.name}! Defense rose!`, moveName: move.name, creatureName: attackerBCS.ac.creature.name })
      } else if (move.id === 'amnesia' || move.id === 'barrier' || move.id === 'acid_armor') {
        attackerBCS.defStage = Math.min(3, attackerBCS.defStage + 2)
        log.push({ id: nextId(), type: 'move', side, text: `🧱 ${attackerBCS.ac.creature.name} used ${move.name}! Def sharply rose!`, moveName: move.name, creatureName: attackerBCS.ac.creature.name })
      } else if (move.id === 'growl' || move.id === 'leer') {
        defenderBCS.atkStage = Math.max(-3, defenderBCS.atkStage - 1)
        log.push({ id: nextId(), type: 'move', side, text: `📉 ${attackerBCS.ac.creature.name} used ${move.name}! Enemy Attack fell!`, moveName: move.name, creatureName: attackerBCS.ac.creature.name })
      } else if (move.id === 'transform') {
        // ── DITTO LIVE TRANSFORM ─────────────────────────────────
        // Pick a random Pokémon from all 151 (excluding Ditto itself)
        const candidates = CREATURES.filter(c => c.id !== 132)
        const target = candidates[Math.floor(rng() * candidates.length)]
        const isMythical = target.id === 150 || target.id === 151
        // Clone creature so we don't mutate the global CREATURES singleton
        attackerBCS.ac.creature = { ...attackerBCS.ac.creature }
        // Store Ditto's original sprite so BattleScreen can show it pre-transform
        ;(attackerBCS.ac.creature as any)._dittoPreTransformSprite = attackerBCS.ac.creature.spriteUrl
        ;(attackerBCS.ac.creature as any)._dittoTransformedInto = target.name
        ;(attackerBCS.ac.creature as any)._dittoTransformSpriteUrl = target.spriteUrl
        // Take on target's stats/types/moves/sprite — keep Ditto's own HP (fairer)
        attackerBCS.ac.creature.baseAtk = target.baseAtk
        attackerBCS.ac.creature.baseDef = target.baseDef
        attackerBCS.ac.creature.baseSpe = target.baseSpe
        ;(attackerBCS.ac.creature as any).types = target.types
        ;(attackerBCS.ac.creature as any).passive = target.passive
        ;(attackerBCS.ac.creature as any).spriteUrl = target.spriteUrl
        // Rebuild moves and PP map from target
        attackerBCS.ac.assignedMoves = target.movePool.map(id => MOVE_MAP[id]).filter(Boolean)
        attackerBCS.ppMap = buildPpMap(attackerBCS.ac.assignedMoves)
        attackerBCS.dittoTransformed = true
        // +20 HP bonus on transform to compensate for being attacked twice
        const hpBonus = 20
        attackerBCS.ac.currentHp = Math.min(attackerBCS.ac.currentHp + hpBonus, attackerBCS.ac.maxHp)
        // Log entries — use 'dittoTransform' type so BattleScreen can intercept
        log.push({
          id: nextId(), type: 'move', side,
          text: `🌀 Ditto used TRANSFORM! (+${hpBonus} HP)`,
          moveName: 'Transform',
          creatureName: 'Ditto',
          commentary: 'Something is about to happen...',
        })
        // The reveal entry — BattleScreen swaps the sprite when this fires
        log.push({
          id: nextId(), type: isMythical ? 'ultimate' : 'shiny', side,
          text: isMythical
            ? `🌟 UNBELIEVABLE!!! Ditto transformed into ${target.name}!!!`
            : `✨ Ditto transformed into ${target.name}!`,
          commentary: isMythical
            ? 'A legendary pull — the crowd loses its mind!'
            : `Ditto takes on the full power of ${target.name}!`,
          creatureName: 'Ditto',
          // Custom field: signals BattleScreen to reveal the new sprite on this entry
          ...(({ dittoRevealSide: side, dittoRevealSprite: target.spriteUrl }) as any),
        })
        // ── Immediately attack with a move from the new form ──────
        // After this follow-up, Ditto's next attack opportunity is skipped (opponent goes next)
        const followUpMove = attackerBCS.ac.assignedMoves.find(m => m.power > 0) ?? attackerBCS.ac.assignedMoves[0]
        if (followUpMove) {
          simulateAttack(attackerBCS, defenderBCS, followUpMove, arena, trainerAtk, trainerDef, side, log, crowdMeter, weather, rng)
          attackerBCS.dittoSkipNextAttack = true
        }
      } else if (move.id === 'sunny_day') {
        // weather handled outside, just log here
        log.push({ id: nextId(), type: 'move', side, text: `☀️ ${attackerBCS.ac.creature.name} used Sunny Day! The sunlight turned harsh!`, moveName: move.name, creatureName: attackerBCS.ac.creature.name })
      } else if (move.id === 'rain_dance') {
        log.push({ id: nextId(), type: 'move', side, text: `🌧️ ${attackerBCS.ac.creature.name} used Rain Dance! It started to rain!`, moveName: move.name, creatureName: attackerBCS.ac.creature.name })
      } else if (move.id === 'sandstorm') {
        log.push({ id: nextId(), type: 'move', side, text: `🌪️ ${attackerBCS.ac.creature.name} used Sandstorm! A sandstorm brewed!`, moveName: move.name, creatureName: attackerBCS.ac.creature.name })
      } else if (move.id === 'stun_spore' || move.id === 'glare' || move.id === 'thunder_wave') {
        if (defenderBCS.status === 'none') {
          defenderBCS.status = 'paralyzed'
          log.push({
            id: nextId(), type: 'move', side,
            text: `⚡ ${attackerBCS.ac.creature.name} used ${move.name}! ${defenderBCS.ac.creature.name} is paralyzed!`,
            moveName: move.name,
            creatureName: attackerBCS.ac.creature.name,
            defenderName: defenderBCS.ac.creature.name,
          })
        }
      } else if (move.id === 'toxic') {
        const poisonChance = trainerAtk.ability.effectKey === 'toxic_tactics' ? 1.0 : 0.9
        if (defenderBCS.status === 'none' && rng() < poisonChance) {
          defenderBCS.status = 'poisoned'
          log.push({
            id: nextId(), type: 'move', side,
            text: `☠️ ${attackerBCS.ac.creature.name} used Toxic! ${defenderBCS.ac.creature.name} was badly poisoned!`,
            moveName: move.name,
            creatureName: attackerBCS.ac.creature.name,
            defenderName: defenderBCS.ac.creature.name,
          })
        }
      } else {
        log.push({
          id: nextId(), type: 'move', side,
          text: `${attackerBCS.ac.creature.name} used ${move.name}!`,
          moveName: move.name,
          creatureName: attackerBCS.ac.creature.name,
        })
      }
    } else if (move.effectType === 'heal') {
      const isStatusHeal = move.category === 'status' // Recover, Rest, Soft-Boiled — not Mega Drain
      if (isStatusHeal && attackerBCS.healUsed) {
        log.push({
          id: nextId(), type: 'move', side,
          text: `⚡ ${attackerBCS.ac.creature.name} tried to use ${move.name}, but it has no energy left! (1 use per match)`,
          moveName: move.name,
          creatureName: attackerBCS.ac.creature.name,
        })
      } else {
        // Announce the move call first
        log.push({
          id: nextId(), type: 'move', side,
          text: `${attackerBCS.ac.creature.name} used ${move.name}!`,
          moveName: move.name,
          creatureName: attackerBCS.ac.creature.name,
        })
        const healAmt = Math.floor(attackerBCS.ac.maxHp * 0.50)
        attackerBCS.ac.currentHp = Math.min(attackerBCS.ac.maxHp, attackerBCS.ac.currentHp + healAmt)
        if (isStatusHeal) attackerBCS.healUsed = true
        // Then the heal result
        log.push({
          id: nextId(), type: 'move', side,
          text: `💚 ${attackerBCS.ac.creature.name} restored ${healAmt} HP!${isStatusHeal ? ' (1 use per match)' : ''}`,
          moveName: move.name,
          creatureName: attackerBCS.ac.creature.name,
        })
      }
    } else {
      log.push({
        id: nextId(), type: 'move', side,
        text: `${attackerBCS.ac.creature.name} used ${move.name}!`,
        moveName: move.name,
        creatureName: attackerBCS.ac.creature.name,
      })
    }
    // Post-status move: consume ultimate flag
    if (move.ultimateFlag) attackerBCS.ultimateUsed = true
    return
  }

  // Damage moves
  const isUltimate = move.ultimateFlag ?? false
  if (isUltimate && attackerBCS.ultimateUsed) {
    // Pick a non-ultimate fallback
    const fallback = attackerBCS.ac.assignedMoves.find(m => !m.ultimateFlag && m.power > 0) ?? attackerBCS.ac.assignedMoves[0]
    simulateAttack(attackerBCS, defenderBCS, fallback, arena, trainerAtk, trainerDef, side, log, crowdMeter)
    return
  }
  if (isUltimate) attackerBCS.ultimateUsed = true

  // Track move usage for variety enforcement
  attackerBCS.lastMoveCount = (attackerBCS.lastMoveId === move.id) ? (attackerBCS.lastMoveCount ?? 0) + 1 : 1
  attackerBCS.lastMoveId = move.id

  // Critical hit
  const critBaseChance = 0.06
  const critTrainerBonus = trainerAtk.ability.effectKey === 'champion_focus' ? 0.02 : 0
  const noGuardCrit = attackerBCS.ac.creature.passive.effectKey === 'no_guard_crit' ? 0.05 : 0
  const isCrit = rng() < (critBaseChance + critTrainerBonus + noGuardCrit)
  // Shell Armor: no crits
  const defEk = defenderBCS.ac.creature.passive.effectKey
  const noCrit = defEk === 'no_crit' || defEk === 'no_crit_def'

  // Type multiplier
  let typeMultiplier = getTypeMultiplier(move.type, defenderBCS.ac.creature.types)

  // Tinted Lens: not-very-effective moves deal normal damage
  if (attackerBCS.ac.creature.passive.effectKey === 'tinted_lens' && typeMultiplier < 1) {
    typeMultiplier = 1
  }

  // Mold Breaker: ignore passives
  const ignorePatch = attackerBCS.ac.creature.passive.effectKey === 'mold_break'

  // Ground immune
  if (!ignorePatch && defEk === 'ground_immune' && move.type === 'ground') typeMultiplier = 0
  if (!ignorePatch && defEk === 'ground_immune_spd' && move.type === 'ground') typeMultiplier = 0
  if (!ignorePatch && defEk === 'ground_immune_def' && move.type === 'ground') typeMultiplier = 0
  // Water absorb
  if (!ignorePatch && (defEk === 'water_absorb' || defEk === 'water_absorb2' || defEk === 'water_absorb3') && move.type === 'water') {
    const healAmt = Math.floor(defenderBCS.ac.maxHp * 0.10)
    defenderBCS.ac.currentHp = Math.min(defenderBCS.ac.maxHp, defenderBCS.ac.currentHp + healAmt)
    log.push({
      id: nextId(), type: 'move', side,
      text: `💧 ${defenderBCS.ac.creature.name} absorbed the water attack and healed ${healAmt} HP!`,
      creatureName: defenderBCS.ac.creature.name,
    })
    return
  }
  // Electric absorb
  if (!ignorePatch && defEk === 'elec_absorb' && move.type === 'electric') {
    const healAmt = Math.floor(defenderBCS.ac.maxHp * 0.10)
    defenderBCS.ac.currentHp = Math.min(defenderBCS.ac.maxHp, defenderBCS.ac.currentHp + healAmt)
    log.push({
      id: nextId(), type: 'move', side,
      text: `⚡ ${defenderBCS.ac.creature.name} absorbed the electric attack and healed ${healAmt} HP!`,
      creatureName: defenderBCS.ac.creature.name,
    })
    return
  }
  // Lightning Rod: electric immune
  if (!ignorePatch && (defEk === 'lightning_rod' || defEk === 'lightning_rod_atk') && move.type === 'electric') {
    typeMultiplier = 0
    log.push({
      id: nextId(), type: 'move', side,
      text: `⚡ ${defenderBCS.ac.creature.name}'s Lightning Rod absorbed the electric attack!`,
      creatureName: defenderBCS.ac.creature.name,
    })
    return
  }

  if (typeMultiplier === 0) {
    log.push({
      id: nextId(), type: 'move', side,
      text: `🚫 ${attackerBCS.ac.creature.name} used ${move.name}... It had no effect on ${defenderBCS.ac.creature.name}!`,
      moveName: move.name,
      creatureName: attackerBCS.ac.creature.name,
      defenderName: defenderBCS.ac.creature.name,
    })
    return
  }

  // Atk/Def values
  let atk = attackerBCS.ac.creature.baseAtk
  let def = defenderBCS.ac.creature.baseDef

  // Stat stages
  atk = Math.floor(atk * stageMult(attackerBCS.atkStage))
  def = Math.floor(def * stageMult(defenderBCS.defStage))

  // Trainer def bonus
  const defBonus = applyTrainerDefBonus(defenderBCS, trainerDef, arena)
  def = Math.floor(def * (1 + defBonus))

  const passiveBonus = applyPassiveBonus(attackerBCS, move.type)
  const arenaBonus = applyArenaBonus(arena, move.type)
  const trainerBonus = applyTrainerAtkBonus(attackerBCS, trainerAtk, move, isCrit, arena)
  const momentumBonus = attackerBCS.ac.momentum ? 0.05 : 0
  const tempBoost = attackerBCS.tempAtkBoost

  // Weather multiplier
  let weatherMult = 1
  if (weather === 'sunny') {
    if (move.type === 'fire') weatherMult = 1.5
    else if (move.type === 'water') weatherMult = 0.5
  } else if (weather === 'rain') {
    if (move.type === 'water') weatherMult = 1.5
    else if (move.type === 'fire') weatherMult = 0.5
  } else if (weather === 'sand') {
    if (move.type === 'rock' || move.type === 'ground' || move.type === 'steel') weatherMult = 1.2
  } else if (weather === 'hail') {
    if (move.type === 'ice') weatherMult = 1.2
  }

  const msEk = defenderBCS.ac.creature.passive.effectKey
  const multiscaleActive = (msEk === 'multiscale') && (defenderBCS.ac.currentHp >= defenderBCS.ac.maxHp)

  atk = Math.floor(atk * (1 + passiveBonus + arenaBonus + trainerBonus + momentumBonus + tempBoost))

  const DAMAGE_SCALE = 0.42

  // ── Multi-hit moves ────────────────────────────────────────
  const multiHit: Record<string, [number, number]> = {
    twineedle: [2, 2], pin_missile: [2, 5], fury_attack: [2, 5],
    double_kick: [2, 2], bone_rush: [2, 5], barrage: [2, 5], comet_punch: [2, 5],
  }
  const hitRange = multiHit[move.id]
  let hitCount = 1
  if (hitRange) {
    hitCount = hitRange[0] + Math.floor(rng() * (hitRange[1] - hitRange[0] + 1))
  }

  let damage = 0
  for (let h = 0; h < hitCount; h++) {
    const rf = 0.85 + rng() * 0.15
    let d = Math.floor((atk / Math.max(def, 1)) * move.power * typeMultiplier * rf * DAMAGE_SCALE * weatherMult)
    if (multiscaleActive && h === 0) d = Math.floor(d * 0.75)
    if (isCrit && !noCrit && h === 0) {
      const critMult = 1.5
      const ironFistBonus = (trainerAtk.ability.effectKey === 'iron_fist') &&
        (attackerBCS.ac.creature.types.includes('fighting') || attackerBCS.ac.creature.types.includes('rock')) ? trainerAtk.ability.value : 0
      d = Math.floor(d * (critMult + ironFistBonus))
    }
    // Ultimate move bonus: +5% damage (the epic factor)
    if (isUltimate) d = Math.floor(d * 1.05)
    const maxHit = Math.floor(defenderBCS.ac.maxHp * 0.70)
    d = Math.min(d, maxHit)
    d = Math.max(1, d)
    damage += d
  }

  // Mega Drain: heal attacker for 50% of damage
  const isMegaDrain = move.id === 'mega_drain' || move.effectType === 'heal'

  defenderBCS.ac.currentHp = Math.max(0, defenderBCS.ac.currentHp - damage)
  attackerBCS.ac.damageDealt += damage

  if (isMegaDrain) {
    const healAmt = Math.floor(damage * 0.5)
    attackerBCS.ac.currentHp = Math.min(attackerBCS.ac.maxHp, attackerBCS.ac.currentHp + healAmt)
  }

  // Struggle recoil
  if (move.id === 'struggle') {
    const recoil = Math.max(1, Math.floor(damage * 0.25))
    attackerBCS.ac.currentHp = Math.max(0, attackerBCS.ac.currentHp - recoil)
  }

  // After first attack
  attackerBCS.ac.firstAttackDone = true
  if (trainerAtk.ability.effectKey === 'heavy_command' && !attackerBCS.ac.giovanniFirstDone) {
    attackerBCS.ac.giovanniFirstDone = true
  }
  if (trainerAtk.ability.effectKey === 'battle_heart' && attackerBCS.ac.ashBoostAvailable) {
    attackerBCS.ac.ashBoostAvailable = false
  }

  // Update crowd meter
  if (isCrit) crowdMeter.value = Math.min(100, crowdMeter.value + 15)
  if (isUltimate) crowdMeter.value = Math.min(100, crowdMeter.value + 20)
  if (typeMultiplier >= 2) crowdMeter.value = Math.min(100, crowdMeter.value + 10)

  // Flame Body: burn attacker on contact
  if ((defEk === 'flame_body') && rng() < 0.30 && attackerBCS.status === 'none') {
    attackerBCS.status = 'burned'
  }
  // Static: paralyze attacker on contact
  if ((defEk === 'static' || defEk === 'static_spd' || defEk === 'static2') && rng() < 0.10 && attackerBCS.status === 'none') {
    attackerBCS.status = 'paralyzed'
  }
  // Poison Touch
  if ((defEk === 'poison_touch') && rng() < 0.10 && attackerBCS.status === 'none') {
    attackerBCS.status = 'poisoned'
  }

  // ── STATUS & SECONDARY PROCS FROM ATTACKS ────────────────────
  const defAlive = defenderBCS.ac.currentHp > 0
  const prevDefStatus = defenderBCS.status

  // 1. Status from move type (only if defender has no existing status)
  if (defAlive && defenderBCS.status === 'none') {
    if (move.type === 'poison' && move.id !== 'toxic') {
      const chance = (move.id === 'poison_sting' || move.id === 'sludge_bomb' || move.id === 'sludge') ? 0.15 : 0.10
      if (rng() < chance) { defenderBCS.status = 'poisoned'; defenderBCS.statusTurns = 0 }
    } else if (move.type === 'electric') {
      if (rng() < 0.10) { defenderBCS.status = 'paralyzed'; defenderBCS.statusTurns = 0 }
    } else if (move.type === 'fire') {
      if (rng() < 0.10) { defenderBCS.status = 'burned'; defenderBCS.statusTurns = 0 }
    } else if (move.type === 'ice') {
      // 5% freeze — rare but dramatic
      if (rng() < 0.05) { defenderBCS.status = 'frozen'; defenderBCS.statusTurns = 0 }
    }
  }

  // 2. Confusion proc from psychic/water moves
  if (defAlive && defenderBCS.status !== 'confused') {
    if (move.id === 'psybeam' || move.id === 'confusion') {
      if (rng() < 0.15) {
        defenderBCS.status = 'confused'
        defenderBCS.confuseTurns = 2
      }
    }
  }

  // 3. Flinch from high-impact physical moves
  const flinchMoves = new Set(['rock_slide','body_slam','stomp','crabhammer','bone_club','headbutt','bite','crunch','air_slash','iron_head'])
  if (defAlive && !defenderBCS.flinched && flinchMoves.has(move.id)) {
    if (rng() < 0.30) defenderBCS.flinched = true
  } else if (defAlive && !defenderBCS.flinched && move.category === 'physical' && move.power >= 90) {
    if (rng() < 0.10) defenderBCS.flinched = true
  }

  // 4. Recoil damage for certain moves
  const recoilMoves: Record<string, number> = {
    double_edge: 0.33, volt_tackle: 0.25, submission: 0.25,
    hi_jump_kick: 0.33, take_down: 0.25, brave_bird: 0.33,
  }
  if (recoilMoves[move.id]) {
    const recoilAmt = Math.max(1, Math.floor(damage * recoilMoves[move.id]))
    attackerBCS.ac.currentHp = Math.max(0, attackerBCS.ac.currentHp - recoilAmt)
  }

  // 5. Explosion / Self-Destruct — attacker faints after use
  if (move.id === 'explosion' || move.id === 'self_destruct') {
    attackerBCS.ac.currentHp = 0
  }

  // Build effectiveness text
  let effectText = ''
  if (typeMultiplier >= 2) effectText = ' It\'s super effective!'
  else if (typeMultiplier < 1 && typeMultiplier > 0) effectText = ' It\'s not very effective...'
  if (isCrit && !noCrit) effectText += ' Critical hit!'

  // Status proc messages
  if (defenderBCS.status !== prevDefStatus) {
    if (defenderBCS.status === 'poisoned')  effectText += ` ☠️ ${defenderBCS.ac.creature.name} was poisoned!`
    if (defenderBCS.status === 'paralyzed') effectText += ` ⚡ ${defenderBCS.ac.creature.name} was paralyzed!`
    if (defenderBCS.status === 'burned')    effectText += ` 🔥 ${defenderBCS.ac.creature.name} was burned!`
    if (defenderBCS.status === 'frozen')    effectText += ` 🧊 ${defenderBCS.ac.creature.name} was frozen solid!`
    if (defenderBCS.status === 'confused')  effectText += ` 😵 ${defenderBCS.ac.creature.name} became confused!`
  }
  if (recoilMoves[move.id] && attackerBCS.ac.currentHp > 0) {
    effectText += ` (${attackerBCS.ac.creature.name} took recoil!)`
  }

  const superEffLines = [
    "The crowd goes WILD!", "That's gonna leave a mark!", "Devastating blow!",
    "Right in the weak spot!", "SUPER EFFECTIVE!", "That hit like a truck!",
    "The arena shakes!", "Unreal power!", "This battle is ELECTRIC!",
    "Incredible type advantage!", "The crowd is on their feet!", "Massive damage!",
  ]
  const critLines = [
    "Perfect strike!", "Unbelievable precision!", "Right on the money!",
    "A critical hit lands!", "Dead on target!", "Incredible timing!",
    "The crowd holds its breath!", "Pinpoint accuracy!", "A devastating critical!",
  ]
  const normalLines = [
    "A solid hit!", "Clean strike.", "The battle intensifies.",
    "Neither side is backing down.", "Steady pressure.", "Well-executed.",
    "The momentum shifts.", undefined, undefined, undefined,
  ]
  const lowHpLines = [
    "Fighting on pure instinct!", "Refusing to go down!", "Heart of a champion!", "On the ropes but still swinging!"
  ]
  const isLowHp = attackerBCS.ac.currentHp / attackerBCS.ac.maxHp < 0.25
  const pool = typeMultiplier >= 2 ? superEffLines : isCrit ? critLines : normalLines
  let commentary: string | undefined = pool[Math.floor(rng() * pool.length)]
  if (isLowHp && rng() < 0.5) {
    const drama = lowHpLines[Math.floor(rng() * lowHpLines.length)]
    commentary = commentary ? `${drama} ${commentary}` : drama
  }

  log.push({
    id: nextId(),
    type: isCrit ? 'critical' : isUltimate ? 'ultimate' : 'damage',
    side,
    text: move.id === 'struggle'
      ? `${attackerBCS.ac.creature.name} has no moves left and used Struggle!${effectText} (-${damage} HP)`
      : hitCount > 1
        ? `${attackerBCS.ac.creature.name} used ${move.name}! Hit ${hitCount} times!${effectText} (-${damage} HP)`
        : `${attackerBCS.ac.creature.name} used ${move.name}!${effectText} (-${damage} HP)`,
    commentary,
    damage,
    isCrit: isCrit && !noCrit,
    isUltimate,
    moveName: move.name,
    creatureName: attackerBCS.ac.creature.name,
    defenderName: defenderBCS.ac.creature.name,
    hpAfter: { A: 0, B: 0 }, // filled in by caller
    crowdMeterAfter: crowdMeter.value,
  })

  // ── ANNOUNCER + TRAINER REACTIONS ──────────────────────────
  if (isUltimate) {
    log.push({ id: nextId(), type: 'announcer', side, text: getAnnouncerLine('ultimate') })
    if (trainerAtk.battleReactions?.onUltimate?.length) {
      const lines = trainerAtk.battleReactions.onUltimate
      log.push({ id: nextId(), type: 'trainer_react', side, text: `${trainerAtk.name}: "${lines[Math.floor(rng() * lines.length)]}"` })
    }
  } else if (isCrit && !noCrit) {
    if (rng() < 0.7) log.push({ id: nextId(), type: 'announcer', side, text: getAnnouncerLine('critHit') })
    if (rng() < 0.5 && trainerAtk.battleReactions?.onCrit?.length) {
      const lines = trainerAtk.battleReactions.onCrit
      log.push({ id: nextId(), type: 'trainer_react', side, text: `${trainerAtk.name}: "${lines[Math.floor(rng() * lines.length)]}"` })
    }
  } else if (typeMultiplier >= 2) {
    if (rng() < 0.5) log.push({ id: nextId(), type: 'announcer', side, text: getAnnouncerLine('superEffective') })
    if (rng() < 0.4 && trainerAtk.battleReactions?.onSuperEffective?.length) {
      const lines = trainerAtk.battleReactions.onSuperEffective
      log.push({ id: nextId(), type: 'trainer_react', side, text: `${trainerAtk.name}: "${lines[Math.floor(rng() * lines.length)]}"` })
    }
  } else if (rng() < 0.06) {
    log.push({ id: nextId(), type: 'announcer', side, text: getAnnouncerLine('general') })
  }

  // Status applied announcer (only if new status was applied)
  if (defenderBCS.status !== prevDefStatus && defenderBCS.status !== 'none' && rng() < 0.55) {
    log.push({ id: nextId(), type: 'announcer', side, text: getAnnouncerLine('statusApplied') })
  }

  // Low HP defending trainer reaction
  if (defenderBCS.ac.currentHp > 0 && defenderBCS.ac.currentHp / defenderBCS.ac.maxHp < 0.30 && rng() < 0.35) {
    const defTrainer = side === 'A' ? trainerDef : trainerAtk
    if (defTrainer.battleReactions?.onLowHp?.length) {
      const lines = defTrainer.battleReactions.onLowHp
      const defSide: 'A' | 'B' = side === 'A' ? 'B' : 'A'
      log.push({ id: nextId(), type: 'trainer_react', side: defSide, text: `${defTrainer.name}: "${lines[Math.floor(rng() * lines.length)]}"` })
    }
  }

  // Crowd roar at 100
  if (crowdMeter.value >= 100) {
    crowdMeter.value = 0
    attackerBCS.tempAtkBoost += 0.05
    log.push({
      id: nextId(), type: 'crowd_roar', side,
      text: `🎉 CROWD ROAR! The audience erupts! ${attackerBCS.ac.creature.name} gains +5% ATK!`,
      crowdMeterAfter: 0,
    })
    log.push({ id: nextId(), type: 'announcer', side, text: getAnnouncerLine('crowdRoar') })
  }
}

// ── APPLY TURN-END STATUS DAMAGE ─────────────────────────────
function applyStatusDamage(bcs: BattleCreatureState, side: 'A' | 'B', log: BattleLogEntry[], rng: () => number = Math.random.bind(Math)): void {
  // Poison: 3% per full turn
  if (bcs.status === 'poisoned') {
    const dmg = Math.max(1, Math.floor(bcs.ac.maxHp * 0.03))
    bcs.ac.currentHp = Math.max(0, bcs.ac.currentHp - dmg)
    log.push({
      id: nextId(), type: 'status_damage', side,
      text: `☠️ ${bcs.ac.creature.name} is hurt by poison! (-${dmg} HP)`,
      damage: dmg, creatureName: bcs.ac.creature.name,
    })
  }
  // Burn: 3% per full turn
  else if (bcs.status === 'burned') {
    const dmg = Math.max(1, Math.floor(bcs.ac.maxHp * 0.03))
    bcs.ac.currentHp = Math.max(0, bcs.ac.currentHp - dmg)
    log.push({
      id: nextId(), type: 'status_damage', side,
      text: `🔥 ${bcs.ac.creature.name} is scorched by its burn! (-${dmg} HP)`,
      damage: dmg, creatureName: bcs.ac.creature.name,
    })
  }

  // Paralysis: expires after 1 full turn
  if (bcs.status === 'paralyzed') {
    bcs.statusTurns++
    if (bcs.statusTurns >= 1) {
      bcs.status = 'none'
      bcs.statusTurns = 0
      log.push({
        id: nextId(), type: 'move', side,
        text: `✨ ${bcs.ac.creature.name}'s paralysis wore off!`,
        creatureName: bcs.ac.creature.name,
      })
    }
  }

  // Shed skin: chance to recover
  const passiveEk = bcs.ac.creature.passive.effectKey
  if (passiveEk === 'shed_skin' && rng() < 0.33 && bcs.status !== 'none') {
    bcs.status = 'none'
    log.push({
      id: nextId(), type: 'move', side,
      text: `🐍 ${bcs.ac.creature.name}'s Shed Skin cured its status condition!`,
      creatureName: bcs.ac.creature.name,
    })
  }

  // Regen
  if (passiveEk === 'regen' || passiveEk === 'regenerator_t') {
    const heal = Math.floor(bcs.ac.maxHp * 0.05)
    if (bcs.ac.currentHp > 0) {
      bcs.ac.currentHp = Math.min(bcs.ac.maxHp, bcs.ac.currentHp + heal)
    }
  }

  // Harvest/Regen
  if (passiveEk === 'harvest' && rng() < 0.50 && bcs.ac.currentHp > 0) {
    const heal = Math.floor(bcs.ac.maxHp * 0.05)
    bcs.ac.currentHp = Math.min(bcs.ac.maxHp, bcs.ac.currentHp + heal)
  }
}

// ── CHECK ASH BOOST TRIGGER ───────────────────────────────────
function checkAshBoost(bcs: BattleCreatureState, trainer: Trainer): void {
  if (trainer.ability.effectKey === 'battle_heart' &&
      bcs.ac.currentHp / bcs.ac.maxHp < 0.25 &&
      !bcs.ac.ashBoostAvailable) {
    bcs.ac.ashBoostAvailable = true
  }
}

// ── RESOLVE FULL BATTLE ───────────────────────────────────────
export function resolveBattle(
  teamA: ActiveCreature[],
  teamB: ActiveCreature[],
  arena: Arena,
  trainerA: Trainer,
  trainerB: Trainer,
  rng?: () => number,
): BattleState {
  const _rng: () => number = rng ?? Math.random.bind(Math)
  _logId = 0
  const log: BattleLogEntry[] = []
  const crowdMeter = { value: 0 }

  // ── HELPER: safely clone a creature so we never mutate the global CREATURES array ──
  function cloneCreature(ac: ActiveCreature): void {
    ac.creature = { ...ac.creature }
  }

  // ── ASH + PIKACHU EASTER EGG ──────────────────────────────────
  // If Ash is trainer A and Pikachu is in slot 0 → special sprite + 5% stat boost
  console.log('[PIKACHU EGG] trainerA.id=', trainerA.id, 'slot0 id=', teamA[0]?.creature?.id, 'slot0 name=', teamA[0]?.creature?.name)
  const ashPikachuEgg =
    trainerA.id === 'ash' &&
    teamA.length > 0 &&
    teamA[0].creature.id === 25

  // Bind _rng locally so it can be captured in closures below
  const rngFn = _rng

  console.log('[PIKACHU EGG] ashPikachuEgg=', ashPikachuEgg)

  if (ashPikachuEgg) {
    const pika = teamA[0]
    cloneCreature(pika)
    const boost = 1.02
    pika.maxHp = Math.floor(pika.maxHp * boost)
    pika.currentHp = pika.maxHp
    pika.creature.baseAtk = Math.floor(pika.creature.baseAtk * boost)
    pika.creature.baseDef = Math.floor(pika.creature.baseDef * boost)
    pika.creature.baseSpe = Math.floor(pika.creature.baseSpe * boost)
    ;(pika.creature as any).spriteUrl = '/pikachu_ash_cap.png'
    ;(pika.creature as any)._ashCapBoost = true
    // Inject Unbreakable Thunder as Ash Pikachu's signature ultimate
    const unbreakableThunder = MOVE_MAP['unbreakable_thunder']
    if (unbreakableThunder && !pika.assignedMoves.find(m => m.id === 'unbreakable_thunder')) {
      // Replace the weakest move to make room
      pika.assignedMoves = [...pika.assignedMoves.slice(0, -1), unbreakableThunder]
    }
    console.log('[PIKACHU EGG] Applied! spriteUrl=', pika.creature.spriteUrl)
  }

  // ── MR. FUJI CHARMANDER EASTER EGG ───────────────────────────
  // If Mr. Fuji has Charmander in any slot → special Cubone outfit sprite + 2.5% boost
  if (trainerA.id === 'fuji' || trainerB.id === 'fuji') {
    const fujiTeam = trainerA.id === 'fuji' ? teamA : teamB
    for (const ac of fujiTeam) {
      if (ac.creature.id === 4) {
        cloneCreature(ac)
        const boost = 1.025
        ac.maxHp = Math.floor(ac.maxHp * boost)
        ac.currentHp = ac.maxHp
        ac.creature.baseAtk = Math.floor(ac.creature.baseAtk * boost)
        ac.creature.baseDef = Math.floor(ac.creature.baseDef * boost)
        ac.creature.baseSpe = Math.floor(ac.creature.baseSpe * boost)
        ;(ac.creature as any).spriteUrl = '/Charmander_Fuji.png'
        ;(ac.creature as any)._fujiCharmander = true
      }
    }
  }

  // ── SQUIRTLE SQUAD EASTER EGG (1 in 25 chance) ───────────────
  for (const ac of [...teamA, ...teamB]) {
    if (ac.creature.id === 7 && rngFn() < 0.10) {
      cloneCreature(ac)
      const boost = 1.05
      ac.maxHp = Math.floor(ac.maxHp * boost)
      ac.currentHp = ac.maxHp
      ac.creature.baseAtk = Math.floor(ac.creature.baseAtk * boost)
      ac.creature.baseDef = Math.floor(ac.creature.baseDef * boost)
      ac.creature.baseSpe = Math.floor(ac.creature.baseSpe * boost)
      ;(ac.creature as any).spriteUrl = '/squirtle_squad.png'
      ;(ac.creature as any)._squirtleSquad = true
    }
  }

  // ── SPECIAL PSYDUCK EASTER EGG ───────────────────────────────
  // If a trainer has BOTH Psyduck (54) AND Shellder (90) → special Psyduck sprite + 5% all stats
  for (const team of [teamA, teamB]) {
    const hasShellder = team.some(ac => ac.creature.id === 90)
    if (!hasShellder) continue
    for (const ac of team) {
      if (ac.creature.id === 54) {
        cloneCreature(ac)
        const boost = 1.05
        ac.maxHp = Math.floor(ac.maxHp * boost)
        ac.currentHp = ac.maxHp
        ac.creature.baseAtk = Math.floor(ac.creature.baseAtk * boost)
        ac.creature.baseDef = Math.floor(ac.creature.baseDef * boost)
        ac.creature.baseSpe = Math.floor(ac.creature.baseSpe * boost)
        ;(ac.creature as any).spriteUrl = '/Psyduck_Special.png'
        ;(ac.creature as any)._specialPsyduck = true
      }
    }
  }

  // (Team Rocket Meowth easter egg removed)

  // Ditto enters as himself — Transform happens live on first move (see simulateAttack)

  // Init battle states (after easter egg so stat boosts are included)
  const statesA: BattleCreatureState[] = teamA.map(initBCS)
  const statesB: BattleCreatureState[] = teamB.map(initBCS)

  let activeA = 0
  let activeB = 0
  let turn = 0
  let pendingArenaEventTurn = -1
  let arenaEventFired = false   // only fires once per game
  let arenaEventUnlocked = false // unlocks when either side's 3rd Pokémon enters
  let weather: 'none' | 'sunny' | 'rain' | 'sand' | 'hail' = 'none'
  let weatherTurns = 0

  log.push({
    id: nextId(), type: 'intro',
    text: `⚔️ BATTLE BEGIN! ${trainerA.name} vs ${trainerB.name} in ${arena.name}!`,
    commentary: `The arena is ${arena.name}. Type bonuses: ${arena.bonusTypes.join(', ')}.`,
  })

  // Ash's special opening line when Pikachu leads
  if (ashPikachuEgg) {
    log.push({
      id: nextId(), type: 'trainer_react', side: 'A',
      text: `Ash: "Alright Pikachu, let's show them what we can do!"`,
    })
    log.push({
      id: nextId(), type: 'shiny', side: 'A',
      text: `🧢 Ash's PIKACHU! All stats +5%! A true Pokémon Master's partner!`,
      commentary: 'The bond between trainer and Pokémon, embodied.',
      creatureName: 'Pikachu',
    })
  }

  // Squirtle Squad log entries
  for (const [ac, side] of [...teamA.map(a => [a, 'A'] as const), ...teamB.map(b => [b, 'B'] as const)]) {
    if ((ac.creature as any)._squirtleSquad) {
      log.push({
        id: nextId(), type: 'shiny', side,
        text: `😎 SQUIRTLE SQUAD! This Squirtle rolled up with the crew! All stats +5%!`,
        commentary: 'One in twenty-five. The rarest of Squirtles.',
        creatureName: 'Squirtle',
      })
    }
  }

  // Special Psyduck log entries
  for (const [ac, side] of [...teamA.map(a => [a, 'A'] as const), ...teamB.map(b => [b, 'B'] as const)]) {
    if ((ac.creature as any)._specialPsyduck) {
      log.push({
        id: nextId(), type: 'shiny', side,
        text: `🦆 SPECIAL PSYDUCK! Shellder's power has awakened something inside this Psyduck! All stats +5%!`,
        commentary: 'When Psyduck meets Shellder, strange things happen.',
        creatureName: 'Psyduck',
      })
    }
  }

  // Apply entry effects for first creatures
  applyEntryEffects(statesA[activeA], trainerA, arena, log, 'A')
  applyEntryEffects(statesB[activeB], trainerB, arena, log, 'B')

  log.push({
    id: nextId(), type: 'intro',
    text: `${trainerA.name} sends out ${statesA[activeA].ac.creature.name}! ${trainerB.name} sends out ${statesB[activeB].ac.creature.name}!`,
    hpAfter: { A: statesA[activeA].ac.currentHp, B: statesB[activeB].ac.currentHp },
  })

  // Track which side just sent in a fresh Pokémon after a KO — they go first that turn
  let freshEntrySide: 'A' | 'B' | null = null

  // Battle loop
  while (activeA < statesA.length && activeB < statesB.length) {
    turn++
    if (turn > 500) break // safety limit

    const bcsA = statesA[activeA]
    const bcsB = statesB[activeB]

    // Speed determines who goes first (with stat stages + paralysis)
    // Exception: if a Pokémon just entered after a KO, it goes first that turn
    const spdA = bcsA.ac.creature.baseSpe * stageMult(bcsA.speStage) * (bcsA.status === 'paralyzed' ? 0.5 : 1)
    const spdB = bcsB.ac.creature.baseSpe * stageMult(bcsB.speStage) * (bcsB.status === 'paralyzed' ? 0.5 : 1)

    const firstSide: 'A' | 'B' = freshEntrySide === 'A' ? 'A'
      : freshEntrySide === 'B' ? 'B'
      : spdA >= spdB ? 'A' : 'B'
    freshEntrySide = null  // consume — only applies for one turn

    const pairs: [BattleCreatureState, BattleCreatureState, 'A' | 'B'][] =
      firstSide === 'A'
        ? [[bcsA, bcsB, 'A'], [bcsB, bcsA, 'B']]
        : [[bcsB, bcsA, 'B'], [bcsA, bcsB, 'A']]

    const tookTurn = new Set<'A' | 'B'>()  // sides that have already acted this turn

    // Per-turn tracking for consecutive-attack enforcement
    // attackedThisTurn[side] = actually fired a move; skipExcused[side] = skip was sleep/paralysis
    const attackedThisTurn: Record<'A' | 'B', boolean> = { A: false, B: false }
    const skipExcused: Record<'A' | 'B', boolean> = { A: false, B: false }

    for (const [attBCS, defBCS, attkSide] of pairs) {
      if (attBCS.ac.currentHp <= 0 || defBCS.ac.currentHp <= 0) continue
      // Hard rule: each side acts at most once per turn
      if (tookTurn.has(attkSide)) continue
      tookTurn.add(attkSide)

      // ── CONSECUTIVE ATTACK GUARD ─────────────────────────────
      // A Pokémon cannot attack two turns in a row unless the opponent's last skip
      // was excused (sleep or paralysis). Flinch, freeze, confusion, etc. do NOT excuse it.
      const defSide: 'A' | 'B' = attkSide === 'A' ? 'B' : 'A'
      const defBCSPrev = attkSide === 'A' ? bcsB : bcsA
      if (
        attBCS.lastTurnActuallyAttacked &&
        !defBCSPrev.lastTurnActuallyAttacked &&
        !defBCSPrev.lastTurnSkipWasExcused
      ) {
        // Forced yield — opponent's skip was unexcused; attacker must wait this turn
        attBCS.lastTurnActuallyAttacked = false
        attBCS.lastTurnSkipWasExcused = false
        log.push({
          id: nextId(), type: 'move', side: attkSide,
          text: `⏳ ${attBCS.ac.creature.name} waits for its opponent to recover!`,
          creatureName: attBCS.ac.creature.name,
        })
        continue
      }

      // ── PRE-MOVE STATUS CHECKS ───────────────────────────────
      // Pick the intended move first so we can stamp lastMoveId even on skipped turns,
      // preventing the AI from repeating the same move after a forced skip.
      const intendedMove = pickMove(attBCS, defBCS, arena, attkSide === 'A' ? trainerA : trainerB, rngFn)

      // Flinch: skip this attack (cleared immediately) — NOT an excused skip
      if (attBCS.flinched) {
        attBCS.flinched = false
        attBCS.lastMoveId = intendedMove.id  // count as used so next turn picks something different
        attBCS.lastMoveCount = 1
        attBCS.lastTurnActuallyAttacked = false
        attBCS.lastTurnSkipWasExcused = false
        log.push({
          id: nextId(), type: 'move', side: attkSide,
          text: `😨 ${attBCS.ac.creature.name} flinched and couldn't move!`,
          creatureName: attBCS.ac.creature.name,
        })
        continue
      }

      // Frozen: skip exactly 1 move then auto-thaw — NOT an excused skip
      if (attBCS.status === 'frozen') {
        attBCS.status = 'none'
        attBCS.statusTurns = 0
        attBCS.lastMoveId = intendedMove.id  // count as used so next turn picks something different
        attBCS.lastMoveCount = 1
        attBCS.lastTurnActuallyAttacked = false
        attBCS.lastTurnSkipWasExcused = false
        log.push({
          id: nextId(), type: 'move', side: attkSide,
          text: `🧊 ${attBCS.ac.creature.name} is frozen solid and can't move! It thawed out after!`,
          creatureName: attBCS.ac.creature.name,
        })
        continue
      }

      // Paralysis: 25% chance to skip — EXCUSED skip
      if (attBCS.status === 'paralyzed' && rngFn() < 0.25) {
        attBCS.lastMoveId = intendedMove.id  // count as used so next turn picks something different
        attBCS.lastMoveCount = 1
        attBCS.lastTurnActuallyAttacked = false
        attBCS.lastTurnSkipWasExcused = true  // paralysis = excused, opponent may go again
        log.push({
          id: nextId(), type: 'move', side: attkSide,
          text: `⚡ ${attBCS.ac.creature.name} is paralyzed and can't move!`,
          creatureName: attBCS.ac.creature.name,
        })
        continue
      }

      // Ditto Transform follow-up: skip this attack so the opponent goes next — NOT excused
      if (attBCS.dittoSkipNextAttack) {
        attBCS.dittoSkipNextAttack = false
        attBCS.lastMoveId = intendedMove.id
        attBCS.lastMoveCount = 1
        attBCS.lastTurnActuallyAttacked = false
        attBCS.lastTurnSkipWasExcused = false
        log.push({
          id: nextId(), type: 'move', side: attkSide,
          text: `🌀 ${attBCS.ac.creature.name} is adjusting to its new form...`,
          creatureName: attBCS.ac.creature.name,
        })
        continue
      }

      // Confusion: 33% chance to hurt self instead of attacking
      if (attBCS.status === 'confused') {
        attBCS.confuseTurns--
        if (attBCS.confuseTurns <= 0) {
          attBCS.status = 'none'
          attBCS.confuseTurns = 0
          log.push({
            id: nextId(), type: 'move', side: attkSide,
            text: `✨ ${attBCS.ac.creature.name} snapped out of confusion!`,
            creatureName: attBCS.ac.creature.name,
          })
        } else if (rngFn() < 0.33) {
          const selfDmg = Math.max(1, Math.floor(attBCS.ac.maxHp * 0.07))
          attBCS.ac.currentHp = Math.max(0, attBCS.ac.currentHp - selfDmg)
          log.push({
            id: nextId(), type: 'damage', side: attkSide,
            text: `😵 ${attBCS.ac.creature.name} is confused! It hurt itself! (-${selfDmg} HP)`,
            damage: selfDmg,
            creatureName: attBCS.ac.creature.name,
            hpAfter: { A: statesA[activeA].ac.currentHp, B: statesB[activeB].ac.currentHp },
          })
          continue
        } else {
          log.push({
            id: nextId(), type: 'move', side: attkSide,
            text: `😵 ${attBCS.ac.creature.name} is confused but snapped out of it this turn!`,
            creatureName: attBCS.ac.creature.name,
          })
        }
      }

      // Check Ash boost trigger
      checkAshBoost(attBCS, attkSide === 'A' ? trainerA : trainerB)

      const move = intendedMove

      // Sleep skip is excused (handled inside simulateAttack); mark before calling
      const willSleepSkip = attBCS.status === 'sleep'
      if (willSleepSkip) {
        attBCS.lastTurnActuallyAttacked = false
        attBCS.lastTurnSkipWasExcused = true
      } else {
        // Will actually attack
        attBCS.lastTurnActuallyAttacked = true
        attBCS.lastTurnSkipWasExcused = false
        attackedThisTurn[attkSide] = true
      }

      // Handle weather-setting moves
      if (move.id === 'sunny_day') { weather = 'sunny'; weatherTurns = 5 }
      else if (move.id === 'rain_dance') { weather = 'rain'; weatherTurns = 5 }
      else if (move.id === 'sandstorm') { weather = 'sand'; weatherTurns = 5 }

      simulateAttack(attBCS, defBCS, move, arena, attkSide === 'A' ? trainerA : trainerB, attkSide === 'B' ? trainerA : trainerB, attkSide, log, crowdMeter, weather, rngFn)

      // Stamp hpAfter + statusAfter on last attack OR status move entry
      for (let i = log.length - 1; i >= 0; i--) {
        const e = log[i]
        if (e.type === 'damage' || e.type === 'critical' || e.type === 'ultimate') {
          e.hpAfter = { A: statesA[activeA].ac.currentHp, B: statesB[activeB].ac.currentHp }
          e.statusAfter = { A: statesA[activeA].status, B: statesB[activeB].status }
          break
        }
        // Also stamp move-type entries that carry a defenderName (status was applied to them)
        if (e.type === 'move' && e.defenderName) {
          e.statusAfter = { A: statesA[activeA].status, B: statesB[activeB].status }
          break
        }
      }
    }

    // Turn-end: status damage, regen, paralysis expiry
    applyStatusDamage(bcsA, 'A', log, rngFn)
    applyStatusDamage(bcsB, 'B', log, rngFn)

    // Weather end-of-turn
    if (weather !== 'none') {
      const w = weather as 'sunny' | 'rain' | 'sand' | 'hail'
      if (w === 'sand' || w === 'hail') {
        for (const [bcs, side] of [[bcsA, 'A'], [bcsB, 'B']] as [BattleCreatureState, 'A'|'B'][]) {
          const types = bcs.ac.creature.types
          const immune = w === 'sand'
            ? (types.includes('rock') || types.includes('ground') || types.includes('steel'))
            : types.includes('ice')
          if (!immune && bcs.ac.currentHp > 0) {
            const dmg = Math.max(1, Math.floor(bcs.ac.maxHp * 0.03))
            bcs.ac.currentHp = Math.max(0, bcs.ac.currentHp - dmg)
            const icon = w === 'sand' ? '🌪️' : '❄️'
            log.push({ id: nextId(), type: 'status_damage', side, text: `${icon} ${bcs.ac.creature.name} is buffeted by the ${w}! (-${dmg} HP)`, damage: dmg, creatureName: bcs.ac.creature.name })
          }
        }
      }
      weatherTurns--
      if (weatherTurns <= 0) {
        log.push({ id: nextId(), type: 'move', side: 'A', text: `🌤️ The weather cleared up!` })
        weather = 'none'
      }
    }

    // Increment turns alive
    if (bcsA.ac.currentHp > 0) bcsA.ac.turnsAlive++
    if (bcsB.ac.currentHp > 0) bcsB.ac.turnsAlive++

    // ── ARENA EVENT TELEGRAPH + FIRE ─────────────────────────
    // Unlocks once either side's 3rd Pokémon (index 2) has entered battle
    if (!arenaEventUnlocked && (activeA >= 2 || activeB >= 2)) {
      arenaEventUnlocked = true
    }

    // Telegraph: fires once, only after unlock, never again after it's been scheduled
    if (arena.event && arenaEventUnlocked && !arenaEventFired && pendingArenaEventTurn < 0) {
      pendingArenaEventTurn = turn + 1
      const telegraphMsg = arena.event.telegraphText ?? `Something stirs in the arena...`
      log.push({
        id: nextId(), type: 'arena_telegraph',
        text: `🌀 ${telegraphMsg}`,
        commentary: `Something is about to happen...`,
      })
    }

    if (pendingArenaEventTurn === turn && arena.event && !arenaEventFired) {
      pendingArenaEventTurn = -1
      arenaEventFired = true
      const ev = arena.event
      log.push({
        id: nextId(), type: 'arena_event',
        text: `🌍 ARENA EVENT: ${ev.name}! ${ev.description}`,
        commentary: `The arena itself intervenes!`,
      })
      log.push({
        id: nextId(), type: 'announcer', side: 'A',
        text: getAnnouncerLine('arenaEvent'),
      })
      if (ev.effect === 'damage_both') {
        const dmg = Math.floor(bcsA.ac.maxHp * 0.05)
        bcsA.ac.currentHp = Math.max(0, bcsA.ac.currentHp - dmg)
        bcsB.ac.currentHp = Math.max(0, bcsB.ac.currentHp - dmg)
      } else if (ev.effect === 'heal_small' || ev.effect === 'heal_grass') {
        const heal = Math.floor(bcsA.ac.maxHp * 0.05)
        bcsA.ac.currentHp = Math.min(bcsA.ac.maxHp, bcsA.ac.currentHp + heal)
        bcsB.ac.currentHp = Math.min(bcsB.ac.maxHp, bcsB.ac.currentHp + heal)
      }
      crowdMeter.value = Math.min(100, crowdMeter.value + 10)
    }

    // Check KOs — reset stat stages on KO/swap
    if (bcsA.ac.currentHp <= 0) {
      bcsA.atkStage = 0; bcsA.defStage = 0; bcsA.speStage = 0
      log.push({
        id: nextId(), type: 'ko', side: 'A',
        text: `💀 ${bcsA.ac.creature.name} was knocked out!`,
        creatureName: bcsA.ac.creature.name,
        hpAfter: { A: 0, B: statesB[activeB].ac.currentHp },
      })
      log.push({ id: nextId(), type: 'announcer', side: 'B', text: getAnnouncerLine('knockOut') })
      crowdMeter.value = Math.min(100, crowdMeter.value + 25)
      // Momentum for B's active
      bcsB.ac.kos++
      bcsB.ac.momentum = true

      // ✨ EASTER EGG: Magikarp scores a KO → evolves into Gyarados with full HP!
      if (bcsB.ac.creature.id === 129) {
        log.push({
          id: nextId(), type: 'announcer', side: 'B',
          text: '✨ WAIT... MAGIKARP IS... EVOLVING?!',
          commentary: 'The impossible is happening.',
        })
        log.push({
          id: nextId(), type: 'announcer', side: 'B',
          text: '🌊 MAGIKARP EVOLVED INTO GYARADOS!! THE CROWD GOES ABSOLUTELY INSANE!!!',
          commentary: 'A once-in-a-lifetime moment.',
        })
        const gyarados = createActiveCreature(130)
        gyarados.kos = bcsB.ac.kos
        gyarados.momentum = true
        gyarados.damageDealt = bcsB.ac.damageDealt
        // Replace Magikarp in statesB with Gyarados
        statesB[activeB] = initBCS(gyarados)
        statesB[activeB].ac.momentum = true
        log.push({
          id: nextId(), type: 'swap', side: 'B',
          text: `🐉 GYARADOS emerges from the water with a ROAR! Full HP restored! The arena shakes!`,
          creatureName: 'Gyarados',
          hpAfter: { A: 0, B: statesB[activeB].ac.currentHp },
        })
        crowdMeter.value = 100
      }

      activeA++
      if (activeA < statesA.length) {
        freshEntrySide = 'A'  // new Pokémon goes first next turn
        // New opponent for B — reset B's sleep lock so it can use sleep again
        statesB[activeB].sleepUsedAgainst = null
        // Reset consecutive-attack tracking for the new entrant
        statesA[activeA].lastTurnActuallyAttacked = false
        statesA[activeA].lastTurnSkipWasExcused = false
        applyEntryEffects(statesA[activeA], trainerA, arena, log, 'A')
        log.push({
          id: nextId(), type: 'swap', side: 'A',
          text: `${trainerA.name} sends out ${statesA[activeA].ac.creature.name}!`,
          creatureName: statesA[activeA].ac.creature.name,
          hpAfter: { A: statesA[activeA].ac.currentHp, B: statesB[activeB].ac.currentHp },
        })
        if (activeA === statesA.length - 1 && trainerA.battleReactions?.onAceEnter?.length) {
          const lines = trainerA.battleReactions.onAceEnter
          log.push({ id: nextId(), type: 'trainer_react', side: 'A', text: `${trainerA.name}: "${lines[Math.floor(rngFn() * lines.length)]}"` })
        }
      }
    }

    if (bcsB.ac.currentHp <= 0) {
      bcsB.atkStage = 0; bcsB.defStage = 0; bcsB.speStage = 0
      log.push({
        id: nextId(), type: 'ko', side: 'B',
        text: `💀 ${bcsB.ac.creature.name} was knocked out!`,
        creatureName: bcsB.ac.creature.name,
        hpAfter: { A: statesA[activeA].ac.currentHp, B: 0 },
      })
      log.push({ id: nextId(), type: 'announcer', side: 'A', text: getAnnouncerLine('knockOut') })
      crowdMeter.value = Math.min(100, crowdMeter.value + 25)
      // Momentum for A's active
      if (activeA < statesA.length) {
        statesA[activeA].ac.kos++
        statesA[activeA].ac.momentum = true

        // ✨ EASTER EGG: Magikarp scores a KO → evolves into Gyarados with full HP!
        if (statesA[activeA].ac.creature.id === 129) {
          log.push({
            id: nextId(), type: 'announcer', side: 'A',
            text: '✨ WAIT... MAGIKARP IS... EVOLVING?!',
            commentary: 'The impossible is happening.',
          })
          log.push({
            id: nextId(), type: 'announcer', side: 'A',
            text: '🌊 MAGIKARP EVOLVED INTO GYARADOS!! THE CROWD GOES ABSOLUTELY INSANE!!!',
            commentary: 'A once-in-a-lifetime moment.',
          })
          const gyarados = createActiveCreature(130)
          gyarados.kos = statesA[activeA].ac.kos
          gyarados.momentum = true
          gyarados.damageDealt = statesA[activeA].ac.damageDealt
          statesA[activeA] = initBCS(gyarados)
          statesA[activeA].ac.momentum = true
          log.push({
            id: nextId(), type: 'swap', side: 'A',
            text: `🐉 GYARADOS emerges from the water with a ROAR! Full HP restored! The arena shakes!`,
            creatureName: 'Gyarados',
            hpAfter: { A: statesA[activeA].ac.currentHp, B: statesB[activeB].ac.currentHp },
          })
          crowdMeter.value = 100
        }
      }

      activeB++
      if (activeB < statesB.length) {
        freshEntrySide = 'B'  // new Pokémon goes first next turn
        // New opponent for A — reset A's sleep lock so it can use sleep again
        if (activeA < statesA.length) statesA[activeA].sleepUsedAgainst = null
        // Reset consecutive-attack tracking for the new entrant
        statesB[activeB].lastTurnActuallyAttacked = false
        statesB[activeB].lastTurnSkipWasExcused = false
        applyEntryEffects(statesB[activeB], trainerB, arena, log, 'B')
        log.push({
          id: nextId(), type: 'swap', side: 'B',
          text: `${trainerB.name} sends out ${statesB[activeB].ac.creature.name}!`,
          creatureName: statesB[activeB].ac.creature.name,
          hpAfter: { A: activeA < statesA.length ? statesA[activeA].ac.currentHp : 0, B: statesB[activeB].ac.currentHp },
        })
        if (activeB === statesB.length - 1 && trainerB.battleReactions?.onAceEnter?.length) {
          const lines = trainerB.battleReactions.onAceEnter
          log.push({ id: nextId(), type: 'trainer_react', side: 'B', text: `${trainerB.name}: "${lines[Math.floor(rngFn() * lines.length)]}"` })
        }
      }
    }
  }

  // Bind rngFn for closures in the battle loop (used below via local capture)
  void rngFn // ensure no lint warnings on unused variable in hoisting

  // Determine winner
  // If both teams ran out simultaneously (e.g. mutual explosion/recoil KO),
  // the side with Pokémon remaining wins; if truly tied, B wins (last attacker rule).
  const aEliminated = activeA >= statesA.length
  const bEliminated = activeB >= statesB.length
  const winner: 'A' | 'B' = aEliminated && !bEliminated ? 'B'
    : !aEliminated && bEliminated ? 'A'
    : !aEliminated && !bEliminated ? 'A'  // safety fallback — should not happen
    : 'B'  // both eliminated simultaneously → B wins (last attacker)

  log.push({
    id: nextId(), type: 'win',
    text: `🏆 ${winner === 'A' ? trainerA.name : trainerB.name} WINS!`,
    commentary: 'An epic battle has concluded!',
    side: winner,
  })

  return {
    teamA: statesA.map(s => s.ac),
    teamB: statesB.map(s => s.ac),
    activeA: Math.min(activeA, statesA.length - 1),
    activeB: Math.min(activeB, statesB.length - 1),
    turn,
    log,
    crowdMeter: crowdMeter.value,
    winner,
    phase: 'finished',
    arenaEventTriggered: pendingArenaEventTurn > 0,
  }
}
