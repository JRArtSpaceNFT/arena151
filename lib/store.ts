import { create } from 'zustand';
import type { Trainer, AppScreen, BattleRoom, RoomTier, QueueState, ChatMessage, MatchFound } from '@/types';

interface ArenaState {
  // Current screen
  currentScreen: AppScreen;
  setScreen: (screen: AppScreen) => void;

  // Last battle winner (1 = P1/player, 2 = P2/opponent) — persisted across game reset
  lastMatchWinner: 1 | 2 | null;
  setLastMatchWinner: (winner: 1 | 2 | null) => void;

  // User/Trainer
  currentTrainer: Trainer | null;
  setTrainer: (trainer: Trainer) => void;
  clearTrainer: () => void;
  
  // Testing mode
  testingMode: boolean;
  setTestingMode: (enabled: boolean) => void;
  
  // Queue
  queueState: QueueState;
  startQueue: (room: BattleRoom, trainer: Trainer) => void;
  cancelQueue: () => void;
  
  // Match
  currentMatch: MatchFound | null;
  setMatch: (match: MatchFound) => void;
  clearMatch: () => void;

  // Server match lifecycle (paid matches only — wager > 0)
  serverMatchId: string | null;
  battleSeed: string | null;
  setServerMatch: (matchId: string, seed: string) => void;
  clearServerMatch: () => void;

  // Queue registration state
  queueMatchId: string | null;
  setQueueMatchId: (id: string | null) => void;
  isMatchJoiner: boolean;        // true if this player is P2 (joining an existing match)
  setIsMatchJoiner: (v: boolean) => void;
  
  // Chat
  chatMessages: ChatMessage[];
  addChatMessage: (message: ChatMessage) => void;
  
  // Balance/Wallet
  updateBalance: (amount: number) => void;
}

export const useArenaStore = create<ArenaState>((set) => ({
  currentScreen: 'home',
  setScreen: (screen) => set({ currentScreen: screen }),

  lastMatchWinner: null,
  setLastMatchWinner: (winner) => set({ lastMatchWinner: winner }),

  currentTrainer: null,
  setTrainer: (trainer) => set({ currentTrainer: trainer }),
  clearTrainer: () => set({ currentTrainer: null }),

  testingMode: false, // Production: real money mode
  setTestingMode: (enabled) => set({ testingMode: enabled }),

  queueState: {
    isSearching: false,
    roomId: null,
    searchStartTime: null,
    currentTrainer: null,
  },
  startQueue: (room, trainer) =>
    set({
      queueState: {
        isSearching: true,
        roomId: room,
        searchStartTime: Date.now(),
        currentTrainer: trainer,
      },
    }),
  cancelQueue: () =>
    set({
      queueState: {
        isSearching: false,
        roomId: null,
        searchStartTime: null,
        currentTrainer: null,
      },
    }),

  currentMatch: null,
  setMatch: (match) => set({ currentMatch: match }),
  clearMatch: () => set({ currentMatch: null, queueMatchId: null, isMatchJoiner: false }),

  serverMatchId: null,
  battleSeed: null,
  setServerMatch: (matchId, seed) => set({ serverMatchId: matchId, battleSeed: seed }),
  clearServerMatch: () => set({ serverMatchId: null, battleSeed: null }),

  queueMatchId: null,
  setQueueMatchId: (id) => set({ queueMatchId: id }),
  isMatchJoiner: false,
  setIsMatchJoiner: (v) => set({ isMatchJoiner: v }),

  chatMessages: [],
  addChatMessage: (message) =>
    set((state) => ({
      chatMessages: [...state.chatMessages, message],
    })),

  updateBalance: (amount) =>
    set((state) => ({
      currentTrainer: state.currentTrainer
        ? { ...state.currentTrainer, balance: state.currentTrainer.balance + amount }
        : null,
    })),
}));
