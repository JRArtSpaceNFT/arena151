'use client'
// ═══════════════════════════════════════════════════════════════
// POKÉBATTLE — ZUSTAND GAME STORE
// ═══════════════════════════════════════════════════════════════

import { create } from 'zustand'
import type { Screen, GameMode, Trainer, Creature, ActiveCreature, Arena, BetInfo, BattleState, MatchResults, CoinSide } from '@/lib/game-types'
import { getRandomArena, getArenaById } from '@/lib/data/arenas'
import { TRAINERS } from '@/lib/data/trainers'
import { CREATURES } from '@/lib/data/creatures'
import { createActiveCreature, resolveBattle } from '@/lib/engine/battle'
import { mulberry32, seedFromMatchId } from '@/lib/engine/prng'
import { useArenaStore } from '@/lib/store'
import type { StoryProgress } from '@/lib/data/storyMode'
import { createEmptyProgress, getCurrentOpponent, STORY_OPPONENTS } from '@/lib/data/storyMode'

export interface GameState {
  // Navigation
  screen: Screen

  // Game Mode
  gameMode: GameMode | null

  // Trainers
  p1Trainer: Trainer | null
  p2Trainer: Trainer | null
  trainerSelectPhase: 'p1' | 'p2'  // which player is currently selecting

  // Coin Toss
  p1CoinChoice: CoinSide | null
  p2CoinChoice: CoinSide | null
  coinResult: CoinSide | null
  coinTossWinner: 'p1' | 'p2' | null  // who won, goes first in draft

  // Draft
  draftTeamA: Creature[]  // P1's team
  draftTeamB: Creature[]  // P2's team
  draftCurrentPicker: 'p1' | 'p2'
  redraftingPlayer: 'p1' | 'p2' | null
  draftBudgetA: number
  draftBudgetB: number

  // Lineup (ordered ActiveCreature arrays)
  lineupA: ActiveCreature[]
  lineupB: ActiveCreature[]
  lineupPhase: 'p1' | 'p2' | 'done'

  // Arena
  arena: Arena | null

  // Bets
  p1Bet: BetInfo | null
  p2Bet: BetInfo | null

  // Battle
  battleState: BattleState | null

  // Results
  matchResults: MatchResults | null

  // Coins
  p1Coins: number
  p2Coins: number

  // Story Mode
  storyProgress: StoryProgress | null
  storyMode: boolean

  // Actions
  navigateTo: (screen: Screen) => void
  setGameMode: (mode: GameMode) => void
  selectTrainer: (trainer: Trainer) => void
  setP1CoinChoice: (side: CoinSide) => void
  setP2CoinChoice: (side: CoinSide) => void
  resolveCoinToss: () => void
  draftCreature: (creature: Creature) => void
  removeDraftCreature: (creature: Creature) => void
  triggerAIDraftPick: () => void
  autoFillDraft: (player: 'p1' | 'p2') => void
  redraftTeam: (player: 'p1' | 'p2') => void
  pickAITeamInstantly: () => void
  confirmVsAiDraft: () => void
  proceedFromDraft: () => void
  setDraftTeamOrder: (team: Creature[], player: 'p1' | 'p2') => void
  moveCreatureUp: (index: number, player: 'p1' | 'p2') => void
  moveCreatureDown: (index: number, player: 'p1' | 'p2') => void
  confirmLineup: (player: 'p1' | 'p2') => void
  proceedFromArenaReveal: () => void
  proceedFromPretalk: () => void
  setP1Bet: (bet: BetInfo) => void
  setP2Bet: (bet: BetInfo) => void
  confirmBets: () => void
  startBattle: () => void
  showVictoryScreen: () => void
  showDefeatScreen: () => void
  proceedToResults: () => void
  playAgain: () => void
  // Battle dialogue (rendered at page root to escape overflow:hidden)
  battleDialogue: string | null
  battleDialogueSide: 'A' | 'B'
  battleDialogueKey: number
  showBattleDialogue: (text: string, side: 'A' | 'B') => void
  clearBattleDialogue: () => void
  moveAnim: { animKey: string; side: 'A' | 'B'; id: string } | null
  setMoveAnim: (anim: { animKey: string; side: 'A' | 'B'; id: string } | null) => void
  // Friend Battle Actions
  setOpponentTeamForFriendBattle: (trainerIdB: string, teamIds: number[]) => void
  friendBattleSendReaction: ((type: 'emote' | 'phrase' | 'gg', content: string) => void) | null
  battleReactionTrigger: ((side: 'A' | 'B', type: 'emote' | 'phrase' | 'gg', content?: string) => void) | null

  // Story Mode Actions
  startStoryMode: () => void
  selectStoryTeam: (pokemonIds: number[]) => void
  reorderStoryTeam: (newOrder: number[]) => void
  completeStoryBattle: () => void
  resetStoryMode: () => void
  loadStoryProgress: () => void
  saveStoryProgress: () => void
}

const INITIAL_BUDGET = 75
const INITIAL_COINS = 1000
const TEAM_SIZE = 5  // Draft mode
const STORY_TEAM_SIZE = 6  // Story mode

export const useGameStore = create<GameState>((set, get) => ({
  screen: 'home',
  gameMode: null,
  p1Trainer: null,
  p2Trainer: null,
  trainerSelectPhase: 'p1',
  p1CoinChoice: null,
  p2CoinChoice: null,
  coinResult: null,
  coinTossWinner: null,
  draftTeamA: [],
  draftTeamB: [],
  draftCurrentPicker: 'p1',
  redraftingPlayer: null,
  draftBudgetA: INITIAL_BUDGET,
  draftBudgetB: INITIAL_BUDGET,
  lineupA: [],
  lineupB: [],
  lineupPhase: 'p1',
  arena: null,
  p1Bet: null,
  p2Bet: null,
  battleState: null,
  matchResults: null,
  battleDialogue: null,
  battleDialogueSide: 'A' as 'A' | 'B',
  battleDialogueKey: 0,
  moveAnim: null,
  setMoveAnim: (anim) => set({ moveAnim: anim }),
  p1Coins: INITIAL_COINS,
  p2Coins: INITIAL_COINS,

  // Story Mode state
  storyProgress: null,
  storyMode: false,

  // Friend Battle reactions
  friendBattleSendReaction: null,
  battleReactionTrigger: null,

  navigateTo: (screen) => set({ screen }),

  setGameMode: (mode) => {
    set({ gameMode: mode, screen: 'trainer_select', trainerSelectPhase: 'p1' })
  },

  selectTrainer: (trainer) => {
    const { trainerSelectPhase, gameMode } = get()
    if (trainerSelectPhase === 'p1') {
      if (gameMode === 'paid_pvp') {
        // Paid PvP: P1 picks their own trainer only. No AI. No random.
        // P2 trainer is set by ArenaReveal from seed-derived TRAINERS index.
        // Placeholder is the first trainer that isn't P1's — never used in battle.
        const placeholder = TRAINERS.find(t => t.id !== trainer.id) ?? TRAINERS[0]
        set({
          p1Trainer: trainer,
          p2Trainer: placeholder,
          trainerSelectPhase: 'p2',
          draftCurrentPicker: 'p1',
          screen: 'draft',
        })
      } else if (gameMode === 'friend_battle') {
        // Friend battle: each player is on their own device.
        // P1 picks their trainer and immediately advances to draft.
        // trainerSelectPhase stays 'p1' — there is no local P2 selection.
        // P2's trainer is resolved via server sync in FriendGameWrapper step 1.
        const placeholder = TRAINERS.find(t => t.id !== trainer.id) ?? TRAINERS[0]
        console.log('[FriendBattle] P1 trainer selected:', trainer.id, '→ advancing to draft')
        set({
          p1Trainer: trainer,
          p2Trainer: placeholder,
          trainerSelectPhase: 'p1',  // keep at p1 — no local P2 pick in friend_battle
          draftCurrentPicker: 'p1',
          screen: 'draft',
        })
      } else if (gameMode === 'vs_ai' || gameMode === 'practice') {
        // AI picks randomly for P2 — ONLY for practice/vs_ai modes
        const available = TRAINERS.filter(t => t.id !== trainer.id)
        const aiTrainer = available[Math.floor(Math.random() * available.length)]
        set({
          p1Trainer: trainer,
          p2Trainer: aiTrainer,
          trainerSelectPhase: 'p2',
          draftCurrentPicker: 'p1',
          screen: 'draft',
        })
      } else {
        set({ p1Trainer: trainer, trainerSelectPhase: 'p2' })
      }
    } else {
      set({ p2Trainer: trainer, draftCurrentPicker: 'p1', screen: 'draft' })
    }
  },

  setP1CoinChoice: (side) => set({ p1CoinChoice: side }),
  setP2CoinChoice: (side) => set({ p2CoinChoice: side }),

  resolveCoinToss: () => {
    const result: CoinSide = Math.random() < 0.5 ? 'red' : 'white'
    const { p1CoinChoice } = get()
    const winner: 'p1' | 'p2' = p1CoinChoice === result ? 'p1' : 'p2'
    set({ coinResult: result, coinTossWinner: winner, draftCurrentPicker: winner })
    // Auto-advance to draft after a brief moment (managed by component)
  },

  draftCreature: (creature) => {
    const { draftTeamA, draftBudgetA, gameMode } = get()

    // vs_ai/practice/friend_battle/paid_pvp: P1 always picks freely, no turn blocking
    // In paid_pvp and friend_battle: each player drafts their own team on their own device
    if (gameMode === 'vs_ai' || gameMode === 'practice' || gameMode === 'friend_battle' || gameMode === 'paid_pvp') {
      if (draftTeamA.length >= TEAM_SIZE) return
      if (creature.pointCost > draftBudgetA) return
      if (draftTeamA.find(c => c.id === creature.id)) return

      const newTeamA = [...draftTeamA, creature]
      const newBudgetA = draftBudgetA - creature.pointCost
      // Just update the draft state — player must hit "Confirm Team" to proceed
      set({ draftTeamA: newTeamA, draftBudgetA: newBudgetA })
      return
    }

    // vs_human: keep turn-based logic
    const { draftCurrentPicker, draftTeamB, draftBudgetB, redraftingPlayer } = get()
    if (draftCurrentPicker === 'p1') {
      if (draftTeamA.length >= TEAM_SIZE) return
      if (creature.pointCost > draftBudgetA) return
      if (draftTeamA.find(c => c.id === creature.id)) return
      const newTeamA = [...draftTeamA, creature]
      const nextPicker: 'p1' | 'p2' = newTeamA.length >= TEAM_SIZE ? 'p2' : 'p1'
      set({ draftTeamA: newTeamA, draftBudgetA: draftBudgetA - creature.pointCost, draftCurrentPicker: redraftingPlayer === 'p1' ? 'p1' : nextPicker })
    } else {
      if (draftTeamB.length >= TEAM_SIZE) return
      if (creature.pointCost > draftBudgetB) return
      if (draftTeamB.find(c => c.id === creature.id)) return
      const newTeamB = [...draftTeamB, creature]
      const nextPickerB = redraftingPlayer === 'p2' ? 'p2' : newTeamB.length >= TEAM_SIZE ? 'p1' : 'p2'
      set({ draftTeamB: newTeamB, draftBudgetB: draftBudgetB - creature.pointCost, draftCurrentPicker: nextPickerB })
    }
  },

  pickAITeamInstantly: () => {
    // Picks the AI's full team at once — called on draft mount
    // Only pick as many as needed (guards against double-fire)
    const needed = TEAM_SIZE - get().draftTeamB.length
    for (let i = 0; i < needed; i++) {
      if (get().draftTeamB.length >= TEAM_SIZE) break
      aiDraftPick(get(), set, get)
    }
  },

  removeDraftCreature: (creature) => {
    const { draftCurrentPicker, draftTeamA, draftTeamB, draftBudgetA, draftBudgetB } = get()
    if (draftCurrentPicker === 'p1') {
      if (!draftTeamA.find(c => c.id === creature.id)) return
      set({
        draftTeamA: draftTeamA.filter(c => c.id !== creature.id),
        draftBudgetA: draftBudgetA + creature.pointCost,
      })
    } else {
      if (!draftTeamB.find(c => c.id === creature.id)) return
      set({
        draftTeamB: draftTeamB.filter(c => c.id !== creature.id),
        draftBudgetB: draftBudgetB + creature.pointCost,
      })
    }
  },

  showBattleDialogue: (text, side) => {
    set(s => ({ battleDialogue: text, battleDialogueSide: side, battleDialogueKey: s.battleDialogueKey + 1 }))
  },
  clearBattleDialogue: () => set({ battleDialogue: null }),

  triggerAIDraftPick: () => {
    const state = get()
    // Only fires for vs_ai and practice. Explicitly blocked for paid_pvp and friend_battle.
    if (state.gameMode !== 'vs_ai' && state.gameMode !== 'practice') return
    if (state.draftCurrentPicker !== 'p2') return
    if (state.draftTeamB.length >= TEAM_SIZE) return
    aiDraftPick(state, set, get)
  },

  autoFillDraft: (player) => {
    const state = get()
    const { draftTeamA, draftTeamB, draftBudgetA, draftBudgetB } = state

    if (player === 'p1') {
      let team = [...draftTeamA]
      let budget = draftBudgetA
      while (team.length < TEAM_SIZE) {
        const taken = new Set(team.map(c => c.id))
        const picksLeft = TEAM_SIZE - team.length
        const mustReserve = (picksLeft - 1) * MIN_POKEMON_COST
        const maxSpend = budget - mustReserve
        let candidates = CREATURES.filter(c => !taken.has(c.id) && c.pointCost <= maxSpend)
        if (candidates.length === 0) {
          candidates = CREATURES.filter(c => !taken.has(c.id) && c.pointCost <= budget)
            .sort((a, b) => a.pointCost - b.pointCost).slice(0, 10)
        }
        if (candidates.length === 0) break
        const pick = candidates[Math.floor(Math.random() * candidates.length)]
        team.push(pick)
        budget -= pick.pointCost
      }
      set({ draftTeamA: team, draftBudgetA: budget, draftCurrentPicker: 'p2' })
    } else {
      let team = [...draftTeamB]
      let budget = draftBudgetB
      while (team.length < TEAM_SIZE) {
        const taken = new Set(team.map(c => c.id))
        const picksLeft = TEAM_SIZE - team.length
        const mustReserve = (picksLeft - 1) * MIN_POKEMON_COST
        const maxSpend = budget - mustReserve
        let candidates = CREATURES.filter(c => !taken.has(c.id) && c.pointCost <= maxSpend)
        if (candidates.length === 0) {
          candidates = CREATURES.filter(c => !taken.has(c.id) && c.pointCost <= budget)
            .sort((a, b) => a.pointCost - b.pointCost).slice(0, 10)
        }
        if (candidates.length === 0) break
        const pick = candidates[Math.floor(Math.random() * candidates.length)]
        team.push(pick)
        budget -= pick.pointCost
      }
      set({ draftTeamB: team, draftBudgetB: budget, draftCurrentPicker: 'p1' })
    }
  },

  redraftTeam: (player) => {
    if (player === 'p1') {
      set({ draftTeamA: [], draftBudgetA: INITIAL_BUDGET, draftCurrentPicker: 'p1', redraftingPlayer: 'p1', screen: 'draft' })
    } else {
      set({ draftTeamB: [], draftBudgetB: INITIAL_BUDGET, draftCurrentPicker: 'p2', redraftingPlayer: 'p2', screen: 'draft' })
    }
  },

  confirmVsAiDraft: () => {
    const { draftTeamA, draftTeamB, p1Trainer, p2Trainer, gameMode } = get()
    if (!p1Trainer || !p2Trainer) return
    const lineupA = draftTeamA.map(c => createActiveCreature(c.id))

    if (gameMode === 'paid_pvp' || gameMode === 'friend_battle') {
      // paid_pvp / friend_battle: P2's team comes from the server.
      // Do NOT generate any AI team. lineupB stays empty until ArenaReveal fills it
      // (paid_pvp) or FriendGameWrapper sync fills it (friend_battle).
      // Move to lineup for P1 to order their own team only.
      set({ lineupA, lineupB: [], lineupPhase: 'p1', arena: getRandomArena(), battleState: null, screen: 'lineup' })
      return
    }

    const lineupB = draftTeamB.map(c => createActiveCreature(c.id))
    const shuffledB = [...lineupB].sort(() => Math.random() - 0.5)
    const arena = getRandomArena()
    // Don't pre-compute battleState here — compute after lineup reorder so easter eggs
    // (e.g. Ash + Pikachu slot 1) respect the player's final lineup order.
    set({ lineupA, lineupB: shuffledB, arena, battleState: null, screen: 'arena_reveal' })
  },

  proceedFromDraft: () => {
    const { draftTeamA, draftTeamB } = get()
    // Create ActiveCreatures from drafted teams
    const lineupA = draftTeamA.map(c => createActiveCreature(c.id))
    const lineupB = draftTeamB.map(c => createActiveCreature(c.id))
    set({ lineupA, lineupB, lineupPhase: 'p1', screen: 'lineup', redraftingPlayer: null })
  },

  setDraftTeamOrder: (team, player) => {
    if (player === 'p1') set({ draftTeamA: team })
    else set({ draftTeamB: team })
  },

  moveCreatureUp: (index, player) => {
    const { lineupA, lineupB } = get()
    if (player === 'p1') {
      if (index === 0) return
      const newLineup = [...lineupA]
      ;[newLineup[index - 1], newLineup[index]] = [newLineup[index], newLineup[index - 1]]
      set({ lineupA: newLineup })
    } else {
      if (index === 0) return
      const newLineup = [...lineupB]
      ;[newLineup[index - 1], newLineup[index]] = [newLineup[index], newLineup[index - 1]]
      set({ lineupB: newLineup })
    }
  },

  moveCreatureDown: (index, player) => {
    const { lineupA, lineupB } = get()
    if (player === 'p1') {
      if (index >= lineupA.length - 1) return
      const newLineup = [...lineupA]
      ;[newLineup[index], newLineup[index + 1]] = [newLineup[index + 1], newLineup[index]]
      set({ lineupA: newLineup })
    } else {
      if (index >= lineupB.length - 1) return
      const newLineup = [...lineupB]
      ;[newLineup[index], newLineup[index + 1]] = [newLineup[index + 1], newLineup[index]]
      set({ lineupB: newLineup })
    }
  },

  confirmLineup: (player) => {
    const { lineupPhase, gameMode } = get()
    if (player === 'p1') {
      if (gameMode === 'paid_pvp' || gameMode === 'friend_battle') {
        // paid_pvp / friend_battle: P1 confirms lineup → arena_reveal.
        // No AI lineup shuffle. lineupB is NOT touched here.
        // ArenaReveal (paid_pvp) or FriendGameWrapper sync (friend_battle) fills lineupB.
        set({ lineupPhase: 'done' })
        const arena = getRandomArena()
        set({ arena, screen: 'arena_reveal' })
      } else if (gameMode === 'vs_ai' || gameMode === 'practice') {
        // AI randomizes its lineup
        const { lineupB } = get()
        const shuffled = [...lineupB].sort(() => Math.random() - 0.5)
        set({ lineupB: shuffled, lineupPhase: 'done' })
        // Proceed to arena reveal
        const arena = getRandomArena()
        set({ arena, screen: 'arena_reveal' })
      } else {
        set({ lineupPhase: 'p2' })
      }
    } else {
      set({ lineupPhase: 'done' })
      const arena = getRandomArena()
      set({ arena, screen: 'arena_reveal' })
    }
  },

  // ── Friend Battle: set opponent team fetched from server ──────────────────
  setOpponentTeamForFriendBattle: (trainerIdB, teamIds) => {
    const { TRAINERS: _ } = { TRAINERS }
    const trainerB = TRAINERS.find(t => t.id === trainerIdB) ?? TRAINERS[0]
    const lineupB = teamIds.map(id => createActiveCreature(id))
    console.log('[FriendBattle] Opponent team loaded from server. TrainerB:', trainerIdB, 'Team:', teamIds)
    set({ p2Trainer: trainerB, lineupB })
  },

  proceedFromArenaReveal: () => {
    const { battleState, lineupA, lineupB, arena, p1Trainer, p2Trainer, gameMode } = get()
    if (!arena || !p1Trainer || !p2Trainer) return

    // Friend battle: battle is computed in FriendGameWrapper after lineup_locked sync.
    // ArenaReveal should not trigger battle computation — FriendGameWrapper sets
    // battleState directly and navigates to 'battle' screen.
    if (gameMode === 'friend_battle') {
      // friend_battle: FriendGameWrapper computes battle after lineup_locked sync
      return
    }
    // paid_pvp: ArenaReveal itself calls proceedFromArenaReveal() AFTER setting battleState.
    // If somehow called with no battleState yet (shouldn't happen), allow fallthrough.

    // Use pre-computed battleState if available; compute now for vs_human flow
    if (battleState) {
      set({ battleState, screen: 'battle' })
      return
    }
    // Wire in battleSeed for deterministic server-crosscheck
    const { battleSeed } = useArenaStore.getState()
    const rng = battleSeed
      ? mulberry32(seedFromMatchId(battleSeed))
      : undefined
    const resolvedState = resolveBattle(lineupA, lineupB, arena, p1Trainer, p2Trainer, rng)
    console.log('[FriendBattle] Battle computed. Winner:', resolvedState.winner, 'P1 team size:', lineupA.length, 'P2 team size:', lineupB.length)
    set({ battleState: resolvedState, screen: 'battle' })
  },

  proceedFromPretalk: () => {
    set({ screen: 'battle' })
  },

  setP1Bet: (bet) => set({ p1Bet: bet }),
  setP2Bet: (bet) => set({ p2Bet: bet }),

  confirmBets: () => {
    set({ screen: 'battle' })
  },

  startBattle: () => {
    const { lineupA, lineupB, arena, p1Trainer, p2Trainer } = get()
    if (!arena || !p1Trainer || !p2Trainer) return

    const battleState = resolveBattle(lineupA, lineupB, arena, p1Trainer, p2Trainer)
    set({ battleState })
  },

  showVictoryScreen: () => {
    // Compute matchResults for the unified results page
    const { battleState, p1Bet, p2Bet, p1Coins, p2Coins } = get()
    if (!battleState) { set({ screen: 'result' }); return }
    const allCreatures = [...battleState.teamA, ...battleState.teamB]
    const mvp = allCreatures.reduce((b, c) => (c.kos*100+c.damageDealt) > (b.kos*100+b.damageDealt) ? c : b)
    const mostDamage = allCreatures.reduce((b, c) => c.damageDealt > b.damageDealt ? c : b)
    const mostKOs = allCreatures.reduce((b, c) => c.kos > b.kos ? c : b)
    const longestSurvival = allCreatures.reduce((b, c) => c.turnsAlive > b.turnsAlive ? c : b)
    const bestValue = allCreatures.reduce((b, c) => { const s=(c.kos*100+c.damageDealt)/(c.creature.pointCost||1); const bs=(b.kos*100+b.damageDealt)/(b.creature.pointCost||1); return s>bs?c:b })
    const winner = battleState.winner === 'A' ? 1 : 2 as 1 | 2
    let p1BetResult = 0, p2BetResult = 0, newP1Coins = p1Coins, newP2Coins = p2Coins
    if (p1Bet) { const w=(p1Bet.side==='p1'&&winner===1)||(p1Bet.side==='p2'&&winner===2); p1BetResult=w?p1Bet.amount:-p1Bet.amount; newP1Coins=Math.max(0,p1Coins+p1BetResult) }
    if (p2Bet) { const w=(p2Bet.side==='p1'&&winner===1)||(p2Bet.side==='p2'&&winner===2); p2BetResult=w?p2Bet.amount:-p2Bet.amount; newP2Coins=Math.max(0,p2Coins+p2BetResult) }
    set({ matchResults: { winner, mvp, mostDamage, mostKOs, longestSurvival, bestValue, p1BetResult, p2BetResult }, p1Coins: newP1Coins, p2Coins: newP2Coins, screen: 'result' })
  },
  showDefeatScreen: () => {
    // Go directly to unified final results screen (same as victory)
    const { battleState, p1Bet, p2Bet, p1Coins, p2Coins } = get()
    if (!battleState) { set({ screen: 'result' }); return }

    const allCreatures = [...battleState.teamA, ...battleState.teamB]
    const mvp = allCreatures.reduce((b, c) => (c.kos*100+c.damageDealt) > (b.kos*100+b.damageDealt) ? c : b)
    const mostDamage = allCreatures.reduce((b, c) => c.damageDealt > b.damageDealt ? c : b)
    const mostKOs = allCreatures.reduce((b, c) => c.kos > b.kos ? c : b)
    const longestSurvival = allCreatures.reduce((b, c) => c.turnsAlive > b.turnsAlive ? c : b)
    const bestValue = allCreatures.reduce((b, c) => {
      const s = (c.kos*100+c.damageDealt)/(c.creature.pointCost||1)
      const bs = (b.kos*100+b.damageDealt)/(b.creature.pointCost||1)
      return s > bs ? c : b
    })
    const winner = battleState.winner === 'A' ? 1 : 2 as 1 | 2
    let p1BetResult = 0, p2BetResult = 0, newP1Coins = p1Coins, newP2Coins = p2Coins
    if (p1Bet) { const w = (p1Bet.side==='p1'&&winner===1)||(p1Bet.side==='p2'&&winner===2); p1BetResult = w?p1Bet.amount:-p1Bet.amount; newP1Coins = Math.max(0,p1Coins+p1BetResult) }
    if (p2Bet) { const w = (p2Bet.side==='p1'&&winner===1)||(p2Bet.side==='p2'&&winner===2); p2BetResult = w?p2Bet.amount:-p2Bet.amount; newP2Coins = Math.max(0,p2Coins+p2BetResult) }
    set({ matchResults: { winner, mvp, mostDamage, mostKOs, longestSurvival, bestValue, p1BetResult, p2BetResult }, p1Coins: newP1Coins, p2Coins: newP2Coins, screen: 'result' })
  },

  proceedToResults: () => {
    const { battleState, p1Bet, p2Bet, p1Coins, p2Coins } = get()
    if (!battleState) return

    const allCreatures = [...battleState.teamA, ...battleState.teamB]

    // Find MVPs
    const mvp = allCreatures.reduce((best, c) => {
      const score = c.kos * 100 + c.damageDealt
      const bestScore = best.kos * 100 + best.damageDealt
      return score > bestScore ? c : best
    })

    const mostDamage = allCreatures.reduce((best, c) =>
      c.damageDealt > best.damageDealt ? c : best)

    const mostKOs = allCreatures.reduce((best, c) =>
      c.kos > best.kos ? c : best)

    const longestSurvival = allCreatures.reduce((best, c) =>
      c.turnsAlive > best.turnsAlive ? c : best)

    const bestValue = allCreatures.reduce((best, c) => {
      const score = (c.kos * 100 + c.damageDealt) / (c.creature.pointCost || 1)
      const bestScore = (best.kos * 100 + best.damageDealt) / (best.creature.pointCost || 1)
      return score > bestScore ? c : best
    })

    const winner = battleState.winner === 'A' ? 1 : 2 as 1 | 2

    // Calculate bet payouts
    let p1BetResult = 0
    let p2BetResult = 0
    let newP1Coins = p1Coins
    let newP2Coins = p2Coins

    if (p1Bet) {
      const p1Won = (p1Bet.side === 'p1' && winner === 1) || (p1Bet.side === 'p2' && winner === 2)
      p1BetResult = p1Won ? p1Bet.amount : -p1Bet.amount
      newP1Coins = Math.max(0, p1Coins + p1BetResult)
    }

    if (p2Bet) {
      const p2Won = (p2Bet.side === 'p1' && winner === 1) || (p2Bet.side === 'p2' && winner === 2)
      p2BetResult = p2Won ? p2Bet.amount : -p2Bet.amount
      newP2Coins = Math.max(0, p2Coins + p2BetResult)
    }

    const results: MatchResults = {
      winner,
      mvp,
      mostDamage,
      mostKOs,
      longestSurvival,
      bestValue,
      p1BetResult,
      p2BetResult,
    }

    set({ matchResults: results, p1Coins: newP1Coins, p2Coins: newP2Coins, screen: 'result' })
  },

  playAgain: () => {
    set({
      screen: 'home',
      gameMode: null,
      p1Trainer: null,
      p2Trainer: null,
      trainerSelectPhase: 'p1',
      p1CoinChoice: null,
      p2CoinChoice: null,
      coinResult: null,
      coinTossWinner: null,
      draftTeamA: [],
      draftTeamB: [],
      draftCurrentPicker: 'p1',
      redraftingPlayer: null,
      draftBudgetA: INITIAL_BUDGET,
      draftBudgetB: INITIAL_BUDGET,
      lineupA: [],
      lineupB: [],
      lineupPhase: 'p1',
      arena: null,
      p1Bet: null,
      p2Bet: null,
      battleState: null,
      matchResults: null,
      battleDialogue: null,
      battleDialogueKey: 0,
      friendBattleSendReaction: null,
      battleReactionTrigger: null,
    })
  },

  // ── STORY MODE ACTIONS ────────────────────────────────────────
  
  startStoryMode: () => {
    // Load existing progress or create new
    const saved = localStorage.getItem('arena151_story')
    const progress: StoryProgress = saved ? JSON.parse(saved) : createEmptyProgress()
    
    set({
      storyMode: true,
      storyProgress: progress,
      gameMode: 'story',
      screen: 'story_intro',
    })
  },

  selectStoryTeam: (pokemonIds: number[]) => {
    // pokemonIds should be [25, ...4 more] (Pikachu + 4 chosen)
    const progress = get().storyProgress
    if (!progress) return
    
    progress.lockedTeam = pokemonIds
    progress.teamOrder = [...pokemonIds]  // Copy for reordering
    
    set({ storyProgress: progress })
    get().saveStoryProgress()
    
    // Navigate to journey board
    set({ screen: 'story_journey' })
  },

  reorderStoryTeam: (newOrder: number[]) => {
    const progress = get().storyProgress
    if (!progress) return
    
    progress.teamOrder = newOrder
    set({ storyProgress: progress })
    get().saveStoryProgress()
  },

  completeStoryBattle: () => {
    const progress = get().storyProgress
    if (!progress) return
    
    // Mark current opponent as defeated
    progress.defeatedOpponents[progress.currentOpponentIndex] = true
    
    // Award badge if gym leader (but ALWAYS advance index first)
    const opponent = STORY_OPPONENTS[progress.currentOpponentIndex]
    const hasBadge = opponent.badgeId && !progress.earnedBadges.includes(opponent.badgeId)
    
    if (hasBadge && opponent.badgeId) {
      progress.earnedBadges.push(opponent.badgeId)
    }
    
    // Advance to next opponent BEFORE showing badge screen
    progress.currentOpponentIndex++
    
    // Check if story complete (all 13 defeated)
    if (progress.currentOpponentIndex >= STORY_OPPONENTS.length) {
      progress.completedStory = true
      set({ storyProgress: progress, screen: 'story_hall_of_fame' })
      get().saveStoryProgress()
      return
    }
    
    // Show badge reward if this was a gym leader, otherwise return to journey
    if (hasBadge) {
      set({ storyProgress: progress, screen: 'story_badge_reward' })
      get().saveStoryProgress()
    } else {
      set({ storyProgress: progress, screen: 'story_journey' })
      get().saveStoryProgress()
    }
  },

  resetStoryMode: () => {
    localStorage.removeItem('arena151_story')
    const fresh = createEmptyProgress()
    set({
      storyProgress: fresh,
      screen: 'story_intro',
    })
  },

  loadStoryProgress: () => {
    const saved = localStorage.getItem('arena151_story')
    if (saved) {
      const progress: StoryProgress = JSON.parse(saved)
      set({ storyProgress: progress })
    }
  },

  saveStoryProgress: () => {
    const progress = get().storyProgress
    if (progress) {
      localStorage.setItem('arena151_story', JSON.stringify(progress))
    }
  },
}))

// ── AI DRAFT PICK ─────────────────────────────────────────────
const MIN_POKEMON_COST = 7 // cheapest pokemon in the roster (Caterpie etc.)

function aiDraftPick(
  state: GameState,
  set: (partial: Partial<GameState>) => void,
  _get: () => GameState,
): void {
  const { draftTeamB, draftBudgetB } = state
  // Hard guard — never exceed team size
  if (draftTeamB.length >= TEAM_SIZE) return
  // AI can pick same Pokémon as P1 — only exclude own team dupes
  const taken = new Set(draftTeamB.map(c => c.id))

  // How many picks still needed AFTER this one
  const picksAfterThis = TEAM_SIZE - draftTeamB.length - 1

  // Must reserve enough budget for all remaining picks (each at least MIN_POKEMON_COST)
  const mustReserve = picksAfterThis * MIN_POKEMON_COST
  const maxSpendThisPick = draftBudgetB - mustReserve

  const affordable = CREATURES.filter(c =>
    !taken.has(c.id) &&
    c.pointCost <= maxSpendThisPick
  )

  // Fallback: if budget constraint leaves nothing, just pick cheapest available
  const pickFrom = affordable.length > 0
    ? affordable
    : CREATURES.filter(c => !taken.has(c.id) && c.pointCost <= draftBudgetB)
        .sort((a, b) => a.pointCost - b.pointCost)
        .slice(0, 5)

  if (pickFrom.length === 0) return

  // Pick randomly weighted by point cost (higher = better) from safe options
  const weights = pickFrom.map(c => c.pointCost)
  const totalWeight = weights.reduce((s, w) => s + w, 0)
  let rand = Math.random() * totalWeight
  let picked = pickFrom[0]
  for (let i = 0; i < pickFrom.length; i++) {
    rand -= weights[i]
    if (rand <= 0) { picked = pickFrom[i]; break }
  }

  const newTeamB = [...draftTeamB, picked]
  const newBudgetB = draftBudgetB - picked.pointCost

  // Stay on p2 until full team; then hand back to p1
  const nextPicker: 'p1' | 'p2' = newTeamB.length >= TEAM_SIZE ? 'p1' : 'p2'
  set({ draftTeamB: newTeamB, draftBudgetB: newBudgetB, draftCurrentPicker: nextPicker })
}
