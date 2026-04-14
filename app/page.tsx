'use client';

import { useEffect, useRef, lazy, Suspense } from 'react';
import { useArenaStore } from '@/lib/store';
import HomePage from '@/components/HomePage';

// ── Code Splitting: Lazy load heavy components ──
// Only HomePage is eager-loaded (critical path)
// Everything else loads on-demand when user navigates
const SignupFlow = lazy(() => import('@/components/SignupFlow'));
const TrainerProfile = lazy(() => import('@/components/TrainerProfile'));
const DraftModeIntro = lazy(() => import('@/components/DraftModeIntro'));
const RoomSelect = lazy(() => import('@/components/RoomSelect'));
const QueueScreen = lazy(() => import('@/components/QueueScreen'));
const MatchFound = lazy(() => import('@/components/MatchFound'));
const VersusScreen = lazy(() => import('@/components/VersusScreen'));
const ResultScreen = lazy(() => import('@/components/ResultScreen'));
const GlobalChat = lazy(() => import('@/components/GlobalChat'));
const ProfessorOak = lazy(() => import('@/components/ProfessorOak'));
const GameWrapper = lazy(() => import('@/components/battle/GameWrapper'));
const PracticeGameWrapper = lazy(() => import('@/components/battle/PracticeGameWrapper'));
const FriendGameWrapper = lazy(() => import('@/components/battle/FriendGameWrapper'));
const FriendBattle = lazy(() => import('@/components/FriendBattle'));
const Leaderboard = lazy(() => import('@/components/Leaderboard'));
const BattleGuide = lazy(() => import('@/components/BattleGuide'));
const FairGaming = lazy(() => import('@/components/FairGaming'));

// Minimal loading indicator - no jarring text, just a subtle fade
function LoadingScreen() {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'linear-gradient(180deg, #0f172a 0%, #020617 100%)',
      opacity: 0.95,
    }} />
  );
}

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
      {/* Home is eager-loaded (no Suspense needed) */}
      {currentScreen === 'home' && <HomePage />}
      
      {/* All other screens are lazy-loaded */}
      <Suspense fallback={null}>
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
      </Suspense>
    </main>
  );
}
