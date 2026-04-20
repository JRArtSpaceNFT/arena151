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
  badges: string[]; // arena IDs for which the trainer has earned the gym badge
  twitterHandle?: string | null;
  
  // X (Twitter) account linking (verified OAuth)
  x_user_id?: string | null;
  x_username?: string | null;
  x_name?: string | null;
  x_profile_image_url?: string | null;
  x_verified_at?: string | null;
}

export type BattleRoom =
  | 'pewter-city'
  | 'cerulean-city'
  | 'vermilion-city'
  | 'celadon-city'
  | 'fuchsia-city'
  | 'saffron-city'
  | 'cinnabar-island'
  | 'viridian-city';

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
  | 'leaderboard'
  | 'battle-guide'
  | 'practice-game'
  | 'friend-battle'
  | 'friend-game'
  | 'fair-gaming';

export interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  avatar: string;
  message: string;
  timestamp: Date;
  room?: BattleRoom;
}
// AppScreen addition handled in place
