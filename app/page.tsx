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
import ProfessorOak from '@/components/ProfessorOak';
import GameWrapper from '@/components/battle/GameWrapper';
import Leaderboard from '@/components/Leaderboard';
import BattleGuide from '@/components/BattleGuide';

const CROWD_SCREENS = new Set(['draft-mode-intro', 'profile', 'leaderboard']);

export default function ArenaApp() {
  const currentScreen = useArenaStore((state) => state.currentScreen);
  const crowdRef = useRef<HTMLAudioElement | null>(null);

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
      {currentScreen === 'home' && <HomePage />}
      {currentScreen === 'signup' && <SignupFlow />}
      {currentScreen === 'profile' && <TrainerProfile />}
      {currentScreen === 'draft-mode-intro' && <DraftModeIntro />}
      {currentScreen === 'room-select' && <RoomSelect />}
      {currentScreen === 'queue' && <QueueScreen />}
      {currentScreen === 'match-found' && <MatchFound />}
      {currentScreen === 'versus' && <VersusScreen />}
      {currentScreen === 'game' && <GameWrapper />}
      {currentScreen === 'result' && <ResultScreen />}
      {currentScreen === 'leaderboard' && <Leaderboard />}
      {currentScreen === 'battle-guide' && <BattleGuide />}
      
      {/* Professor Oak AI Assistant - Always available except during game */}
      {currentScreen !== 'game' && <ProfessorOak />}
    </main>
  );
}
