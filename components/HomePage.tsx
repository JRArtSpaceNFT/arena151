'use client';

import { useEffect } from 'react';
import { useArenaStore } from '@/lib/store';
import { playMusic, resumeAudioContext } from '@/lib/audio/musicEngine';
import { getSession } from '@/lib/auth';
import type { PokemonType } from '@/types';
import { trackSession } from '@/lib/battleStats';

export default function HomePage() {
  const { setScreen, setTrainer, currentTrainer } = useArenaStore();

  // Restore session on load
  useEffect(() => {
    getSession().then(session => {
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
          badges: session.badges ?? [],
        });
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Track session for stats
  useEffect(() => {
    trackSession();
  }, []);

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
    const navigate = () => {
      if (currentTrainer) {
        setScreen('draft-mode-intro');
      } else {
        setScreen('signup');
      }
    };

    try {
      const audio = new Audio('/pikachu sounds.mp3');
      audio.currentTime = 0;
      audio.play().catch(() => {});
      // Cut audio after 2s, then navigate after another 0.5s
      setTimeout(() => { audio.pause(); }, 2500);
      setTimeout(navigate, 3000);
    } catch (e) {
      navigate();
    }
  };

  return (
    <div className="h-screen w-screen overflow-hidden relative">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/Perfect.png"
        alt="Arena 151 — Draft Battle Conquer"
        className="absolute inset-0 w-full h-full select-none"
        style={{ objectFit: 'contain', objectPosition: 'center center' }}
        draggable={false}
      />

      {/* Enter Arena — invisible click zone over the button in the image (desktop) */}
      <button
        onClick={handleEnterArena}
        aria-label="Enter the Arena"
        className="absolute hidden sm:block"
        style={{
          top: '42%',
          left: '39%',
          width: '22%',
          height: '10%',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
        }}
      />

      {/* Mobile "ENTER ARENA" button — always visible on small screens */}
      <button
        onClick={handleEnterArena}
        aria-label="Enter the Arena"
        className="sm:hidden absolute"
        style={{
          bottom: '12%',
          left: '50%',
          transform: 'translateX(-50%)',
          minWidth: 200,
          minHeight: 52,
          padding: '14px 32px',
          background: 'linear-gradient(135deg, #7c3aed, #5b21b6)',
          border: '2px solid rgba(255,255,255,0.3)',
          borderRadius: 12,
          color: '#fff',
          fontSize: 18,
          fontWeight: 900,
          fontFamily: '"Impact", "Arial Black", sans-serif',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          cursor: 'pointer',
          boxShadow: '0 0 32px rgba(124,58,237,0.6), 0 4px 16px rgba(0,0,0,0.6)',
          whiteSpace: 'nowrap',
          zIndex: 10,
        }}
      >
        ENTER ARENA
      </button>
    </div>
  );
}
