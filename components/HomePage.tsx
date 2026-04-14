'use client';

import { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import { useArenaStore } from '@/lib/store';
import { playMusic, resumeAudioContext, getCurrentTrack, getCurrentAudio } from '@/lib/audio/musicEngine';
import { getSession } from '@/lib/auth';
import type { PokemonType } from '@/types';
import { trackSession } from '@/lib/battleStats';

// The home screen was designed at this canvas size (matches Perfect.png dimensions)
const DESIGN_W = 2605;
const DESIGN_H = 1080;

export default function HomePage() {
  const { setScreen, setTrainer, currentTrainer } = useArenaStore();

  // ── Viewport-fit scaling ──────────────────────────────────────────────
  // We treat the home screen as a fixed-size game stage (DESIGN_W × DESIGN_H)
  // and uniformly scale it down to fit the actual browser viewport.
  // This keeps the entire composition visible with no clipping, no scrollbars,
  // and no need to manually resize the window.
  const [scale, setScale] = useState(1);

  const computeScale = useCallback(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const scaleX = vw / DESIGN_W;
    const scaleY = vh / DESIGN_H;
    setScale(Math.min(scaleX, scaleY));
  }, []);

  useEffect(() => {
    computeScale();
    
    // Debounced resize handler to prevent excessive re-renders
    let resizeTimer: NodeJS.Timeout;
    const debouncedResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(computeScale, 100);
    };
    
    window.addEventListener('resize', debouncedResize);
    return () => {
      clearTimeout(resizeTimer);
      window.removeEventListener('resize', debouncedResize);
    };
  }, [computeScale]);

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

  // Start intro music on first interaction.
  // If victory music is already playing (returning from a battle), let it finish naturally
  // then auto-transition to menu music. Don’t cut it short.
  useEffect(() => {
    if (getCurrentTrack() === 'victory') {
      const audio = getCurrentAudio()
      const switchToMenu = () => { playMusic('menu') }
      if (audio) {
        // Let the victory theme play out, then seamlessly switch to menu music
        audio.addEventListener('ended', switchToMenu, { once: true })
        return () => { audio.removeEventListener('ended', switchToMenu) }
      }
      // Fallback: no audio element accessible, switch on next click
      document.addEventListener('click', switchToMenu, { once: true })
      return () => { document.removeEventListener('click', switchToMenu) }
    }

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
    /*
     * Outer shell: fills the full viewport, clips overflow, black letterbox bg.
     * position:relative so the inner stage can absolute-center inside it.
     */
    <div
      style={{
        position: 'fixed',
        inset: 0,
        overflow: 'hidden',
        background: '#000',
      }}
    >
      {/*
       * Inner stage: DESIGN_W × DESIGN_H in layout space, absolutely centered
       * in the shell via top/left 50% + translate(-50%,-50%).
       * Then scale() shrinks it uniformly around its own center.
       * Because translate happens before scale in the transform chain,
       * the visual center stays pinned to the viewport center.
       */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: DESIGN_W,
          height: DESIGN_H,
          transform: `translate(-50%, -50%) scale(${scale})`,
          transformOrigin: 'center center',
        }}
      >
        {/* Full-stage background image — optimized WebP with priority loading */}
        <Image
          src="/Perfect.webp"
          alt="Arena 151 — Draft Battle Conquer"
          fill
          priority
          quality={90}
          sizes="100vw"
          style={{
            objectFit: 'fill',
            userSelect: 'none',
          }}
          draggable={false}
        />

        {/* Enter Arena — click zone positioned exactly over the button in the image.
            These % values map to the image's design canvas (DESIGN_W × DESIGN_H),
            so they stay pixel-perfect regardless of viewport size. */}
        <button
          onClick={handleEnterArena}
          aria-label="Enter the Arena"
          style={{
            position: 'absolute',
            top: '42%',
            left: '39%',
            width: '22%',
            height: '10%',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
          }}
        />
      </div>

      {/* Mobile "ENTER ARENA" button — rendered outside the stage so it
          is always legible at small screen sizes (phone-width viewports). */}
      <button
        onClick={handleEnterArena}
        aria-label="Enter the Arena"
        className="sm:hidden"
        style={{
          position: 'fixed',
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
          textTransform: 'uppercase' as const,
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
