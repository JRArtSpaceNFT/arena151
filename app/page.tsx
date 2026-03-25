'use client';

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

export default function ArenaApp() {
  const currentScreen = useArenaStore((state) => state.currentScreen);

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
      
      {/* Professor Oak AI Assistant - Always available except during game */}
      {currentScreen !== 'game' && <ProfessorOak />}
    </main>
  );
}
