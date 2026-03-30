'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useArenaStore } from '@/lib/store';

const LIVE_EVENTS = [
  { trainer: 'TrainerRed', action: 'just won', detail: 'Indigo Plateau', emoji: '🏆', color: 'text-green-400' },
  { trainer: 'MistyFan99', action: 'is on a 5-win streak at', detail: 'Cerulean City Arena', emoji: '🔥', color: 'text-orange-400' },
  { trainer: 'DragonMaster', action: 'defeated', detail: 'Lance with a 3-0 sweep', emoji: '⚔️', color: 'text-red-400' },
  { trainer: 'PikaMaster', action: 'just lost at', detail: 'Viridian Ground Arena', emoji: '💫', color: 'text-slate-400' },
  { trainer: 'AshKetchum99', action: 'is battling in', detail: 'Final Four Ice Arena', emoji: '❄️', color: 'text-cyan-400' },
  { trainer: 'GaryOakFan', action: 'won 3 in a row at', detail: 'Vermilion Electric Arena', emoji: '⚡', color: 'text-yellow-400' },
  { trainer: 'EeveeLover', action: 'just joined the queue for', detail: 'Master Ball Room', emoji: '👑', color: 'text-purple-400' },
  { trainer: 'ChaosAgent', action: 'pulled off a comeback win at', detail: 'Team Rocket Hideout', emoji: '😈', color: 'text-red-400' },
  { trainer: 'IceQueenFan', action: 'is on a 8-win streak in', detail: 'Elite Clash', emoji: '🌟', color: 'text-amber-400' },
  { trainer: 'BrockArmy', action: 'just lost to', detail: 'Mewtwo at the Underground Lab', emoji: '💀', color: 'text-slate-400' },
  { trainer: 'SabrinaMain', action: 'swept with Alakazam at', detail: 'Saffron Psychic Chamber', emoji: '🔮', color: 'text-fuchsia-400' },
  { trainer: 'BlazeMaster', action: 'won with a last-second Charizard at', detail: 'Cinnabar Volcano', emoji: '🌋', color: 'text-orange-400' },
  { trainer: 'GhostWhisperer', action: 'poisoned their way to victory at', detail: 'Fuchsia Poison Dojo', emoji: '☠️', color: 'text-purple-400' },
  { trainer: 'LaprasRider', action: 'just claimed first place on', detail: 'the Leaderboard', emoji: '🥇', color: 'text-yellow-400' },
  { trainer: 'DragonTamer', action: 'challenged', detail: 'Victory Road for the 10th time', emoji: '🐉', color: 'text-green-400' },
  { trainer: 'RocketAgent47', action: 'lost a close one at', detail: 'Pewter City Rock Arena', emoji: '🪨', color: 'text-slate-400' },
  { trainer: 'NidokingMain', action: 'is dominating', detail: 'Gym Challenger tier', emoji: '👊', color: 'text-green-400' },
  { trainer: 'StarmieGod', action: 'just swept 4-0 at', detail: 'Cerulean Water Arena', emoji: '💧', color: 'text-blue-400' },
];

export default function DraftModeIntro() {
  const { currentTrainer, setScreen } = useArenaStore();
  const [liveIdx, setLiveIdx] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const iv = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setLiveIdx(i => (i + 1) % LIVE_EVENTS.length);
        setVisible(true);
      }, 300);
    }, 2600);
    return () => clearInterval(iv);
  }, []);

  const ev = LIVE_EVENTS[liveIdx];

  return (
    <div className="h-screen flex flex-col relative overflow-hidden bg-black">

      {/* Background image — fills screen, centered/cropped */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: 'url(/road-to-victory-bg.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center top',
          backgroundRepeat: 'no-repeat',
        }}
      />

      {/* Invisible hit zones — positioned to match the three buttons baked into the image.
          The image is 1584×656. Buttons row is at ~76% top, ~9.5% tall.
          We use a max-width container to match the image's aspect ratio scaling. */}
      <div className="absolute inset-0 flex items-end justify-center pb-[10%]">
        <div className="relative w-full max-w-[1584px] mx-auto" style={{ aspectRatio: '1584/656' }}>

          {/* ENTER THE ARENA — green button, left ~22.4%, width ~16.7% */}
          <button
            onClick={() => currentTrainer ? setScreen('room-select') : setScreen('signup')}
            aria-label="Enter the Arena"
            className="absolute cursor-pointer rounded-md transition-all hover:bg-white/10 active:bg-white/20 focus:outline-none focus:ring-2 focus:ring-green-400/60"
            style={{
              left: '22.4%',
              top: '76.2%',
              width: '16.7%',
              height: '9.5%',
            }}
          />

          {/* VIEW PROFILE — blue button, left ~40.9%, width ~14.2% */}
          <button
            onClick={() => setScreen(currentTrainer ? 'profile' : 'signup')}
            aria-label="View Profile"
            className="absolute cursor-pointer rounded-md transition-all hover:bg-white/10 active:bg-white/20 focus:outline-none focus:ring-2 focus:ring-blue-400/60"
            style={{
              left: '40.9%',
              top: '76.2%',
              width: '14.2%',
              height: '9.5%',
            }}
          />

          {/* LEADERBOARD — gold button, left ~56.9%, width ~14.9% */}
          <button
            onClick={() => setScreen('leaderboard')}
            aria-label="Leaderboard"
            className="absolute cursor-pointer rounded-md transition-all hover:bg-white/10 active:bg-white/20 focus:outline-none focus:ring-2 focus:ring-amber-400/60"
            style={{
              left: '56.9%',
              top: '76.2%',
              width: '14.9%',
              height: '9.5%',
            }}
          />

        </div>
      </div>

      {/* Live Activity Feed — floats at very bottom */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="absolute bottom-0 left-0 right-0 px-4 py-2 flex items-center gap-3"
        style={{
          background: 'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(8px)',
          borderTop: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse shrink-0" />
        <span className="text-xs font-black text-green-400 uppercase tracking-widest shrink-0">Live</span>
        <div className="flex-1 overflow-hidden h-5">
          <AnimatePresence mode="wait">
            {visible && (
              <motion.div
                key={liveIdx}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
                className="flex items-center gap-2 text-xs"
              >
                <span>{ev.emoji}</span>
                <span className={`font-black ${ev.color}`}>{ev.trainer}</span>
                <span className="text-slate-400">{ev.action}</span>
                <span className="font-bold text-white">{ev.detail}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <span className="text-xs text-slate-500 shrink-0">247 online</span>
      </motion.div>

    </div>
  );
}
