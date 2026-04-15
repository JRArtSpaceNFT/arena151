'use client';

import { useEffect, useRef } from 'react';
import { useArenaStore } from '@/lib/store';
import HomePage from '@/components/HomePage';
import SignupFlow from '@/components/SignupFlow';
import TrainerProfile from '@/components/TrainerProfile';
import DraftModeIntro from '@/components/DraftModeIntro';
import RoomSelect from '@/components/RoomSelect';
import QueueScreen from '@/components/QueueScreen';
import MatchFound from '@/components/MatchFound';
import VersusScreen from '@/components/VersusScreen';
import ResultScreen from '@/components/ResultScreen';
import GlobalChat from '@/components/GlobalChat';
import ProfessorOak from '@/components/ProfessorOak';
import GameWrapper from '@/components/battle/GameWrapper';
import PracticeGameWrapper from '@/components/battle/PracticeGameWrapper';
import FriendGameWrapper from '@/components/battle/FriendGameWrapper';
import FriendBattle from '@/components/FriendBattle';
import Leaderboard from '@/components/Leaderboard';
import BattleGuide from '@/components/BattleGuide';
import FairGaming from '@/components/FairGaming';

const CROWD_SCREENS = new Set(['draft-mode-intro', 'profile', 'leaderboard']);

export default function ArenaApp() {
  const currentScreen = useArenaStore((state) => state.currentScreen);
  const setServerMatch = useArenaStore((state) => state.setServerMatch);
  const setIsMatchJoiner = useArenaStore((state) => state.setIsMatchJoiner);
  const serverMatchId = useArenaStore((state) => state.serverMatchId);
  const crowdRef = useRef<HTMLAudioElement | null>(null);

  // Restore active paid match from sessionStorage on page load.
  // Prevents refresh from creating a duplicate match and locking funds twice.
  useEffect(() => {
    if (typeof window === 'undefined') return // SSR guard
    if (serverMatchId) return // already set (no-op)
    const savedMatchId = sessionStorage.getItem('arena_matchId')
    const savedSeed    = sessionStorage.getItem('arena_seed')
    const savedJoiner  = sessionStorage.getItem('arena_isJoiner') === '1'
    if (savedMatchId && savedSeed) {
      console.log('[App] Restoring active paid match from sessionStorage:', savedMatchId)
      setServerMatch(savedMatchId, savedSeed)
      setIsMatchJoiner(savedJoiner)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    // Create the audio element once
    if (!crowdRef.current) {
      const audio = new Audio('/music/Crowd Cheer Sound Effect.mp3');
      audio.volume = 0.26;
      audio.loop = false;
      audio.addEventListener('timeupdate', () => {
        if (audio.currentTime >= 10) audio.currentTime = 0;
      });
      crowdRef.current = audio;
    }

    const audio = crowdRef.current;

    if (CROWD_SCREENS.has(currentScreen)) {
      if (audio.paused) {
        audio.play().catch(() => {});
      }
    } else {
      if (!audio.paused) {
        audio.pause();
      }
    }
  }, [currentScreen]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (crowdRef.current) {
        crowdRef.current.pause();
        crowdRef.current.src = '';
      }
    };
  }, []);

  return (
    <main className="min-h-screen">
      {/* All components now eager-loaded for instant navigation */}
      {currentScreen === 'home' && <HomePage />}
      {currentScreen === 'signup' && <SignupFlow />}
        {currentScreen === 'profile' && <TrainerProfile />}
        {currentScreen === 'draft-mode-intro' && <DraftModeIntro />}
        {currentScreen === 'room-select' && <RoomSelect />}
        {currentScreen === 'queue' && <QueueScreen />}
        {currentScreen === 'match-found' && <MatchFound />}
        {currentScreen === 'versus' && <VersusScreen />}
        {currentScreen === 'game' && <GameWrapper />}
        {currentScreen === 'practice-game' && <PracticeGameWrapper />}
        {currentScreen === 'friend-game' && <FriendGameWrapper />}
        {currentScreen === 'friend-battle' && <FriendBattle />}
        {currentScreen === 'result' && <ResultScreen />}
        {currentScreen === 'leaderboard' && <Leaderboard />}
        {currentScreen === 'battle-guide' && <BattleGuide />}
        {currentScreen === 'fair-gaming' && <FairGaming />}
        
        {/* Professor Oak AI Assistant - Always available except during game */}
        {currentScreen !== 'game' && currentScreen !== 'practice-game' && currentScreen !== 'friend-game' && <ProfessorOak />}

        {/* Global chat - only show on draft-mode-intro (Road to Victory) */}
        {currentScreen === 'draft-mode-intro' && <GlobalChat />}
    </main>
  );
}
