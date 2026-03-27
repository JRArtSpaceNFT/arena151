'use client';

import { useEffect } from 'react';
import { useArenaStore } from '@/lib/store';
import { playMusic, resumeAudioContext } from '@/lib/audio/musicEngine';
import { getSession } from '@/lib/auth';
import type { PokemonType } from '@/types';

export default function HomePage() {
  const { setScreen, setTrainer, currentTrainer } = useArenaStore();

  // Restore session on load
  useEffect(() => {
    const session = getSession();
    if (session) {
      setTrainer({
        id: session.id,
        email: session.email,
        username: session.username,
        displayName: session.displayName,
        bio: session.bio,
        avatar: session.avatar,
        favoritePokemon: {
          id: session.favoritePokemonId,
          name: session.favoritePokemonName,
          sprite: '',
          types: session.favoritePokemonTypes as PokemonType[],
          stats: { hp: 100, attack: 100, defense: 100, spAttack: 100, spDefense: 100, speed: 100 },
        },
        joinedDate: new Date(session.joinedDate),
        record: { wins: session.wins, losses: session.losses },
        internalWalletId: session.internalWalletId,
        balance: session.balance,
        earnings: session.earnings ?? 0,
      });
    }
  }, [setTrainer]);

  // Start intro music on first interaction
  useEffect(() => {
    const startMusic = () => {
      resumeAudioContext();
      playMusic('menu');
      document.removeEventListener('click', startMusic);
      document.removeEventListener('keydown', startMusic);
    };
    document.addEventListener('click', startMusic);
    document.addEventListener('keydown', startMusic);
    return () => {
      document.removeEventListener('click', startMusic);
      document.removeEventListener('keydown', startMusic);
    };
  }, []);

  const handleEnterArena = () => {
    if (currentTrainer) {
      setScreen('draft-mode-intro');
    } else {
      setScreen('signup');
    }
  };

  return (
    <div className="h-screen w-screen overflow-hidden relative">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/NewBackground2.png"
        alt="Arena 151 — Draft Battle Conquer"
        className="absolute inset-0 w-full h-full select-none"
        style={{ objectFit: 'contain', objectPosition: 'center center' }}
        draggable={false}
      />

      {/* Enter Arena — invisible click zone, tracks center of image */}
      <button
        onClick={handleEnterArena}
        aria-label="Enter the Arena"
        className="absolute"
        style={{
          top: '84%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '34%',
          height: '9%',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
        }}
      />
    </div>
  );
}
