// Core types for Arena 151

export interface Pokemon {
  id: number;
  name: string;
  sprite: string;
  types: PokemonType[];
  stats: {
    hp: number;
    attack: number;
    defense: number;
    spAttack: number;
    spDefense: number;
    speed: number;
  };
}

export type PokemonType =
  | 'normal' | 'fire' | 'water' | 'electric' | 'grass' | 'ice'
  | 'fighting' | 'poison' | 'ground' | 'flying' | 'psychic'
  | 'bug' | 'rock' | 'ghost' | 'dragon' | 'dark' | 'steel' | 'fairy';

export interface Trainer {
  id: string;
  username: string;
  displayName: string;
  email: string;
  bio?: string;
  avatar: string;
  favoritePokemon: Pokemon;
  joinedDate: Date;
  record: {
    wins: number;
    losses: number;
  };
  internalWalletId: string;
  balance: number;
  earnings: number; // net SOL won/lost from battles (positive = profit, negative = loss)
}

export type BattleRoom =
  | 'pallet-town'
  | 'viridian-city'
  | 'pewter-city'
  | 'cerulean-city'
  | 'vermilion-city'
  | 'celadon-city'
  | 'victory-road'
  | 'indigo-plateau';

export interface RoomTier {
  id: BattleRoom;
  name: string;
  tier: number;
  entryFee: number;
  prizePool: number;
  description: string;
  emblem: string;
  color: string;
  glow: string;
}

export interface QueueState {
  isSearching: boolean;
  roomId: BattleRoom | null;
  searchStartTime: number | null;
  currentTrainer: Trainer | null;
}

export interface MatchFound {
  player1: Trainer;
  player2: Trainer;
  room: RoomTier;
  matchId: string;
}

export interface BattleResult {
  winner: Trainer;
  loser: Trainer;
  room: RoomTier;
  timestamp: Date;
}

export type AppScreen =
  | 'home'
  | 'signup'
  | 'profile'
  | 'draft-mode-intro'
  | 'trainer-select'
  | 'team-select'
  | 'room-select'
  | 'queue'
  | 'match-found'
  | 'versus'
  | 'game'
  | 'battle'
  | 'result'
  | 'leaderboard';

export interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  avatar: string;
  message: string;
  timestamp: Date;
  room?: BattleRoom;
}
