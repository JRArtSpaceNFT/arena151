'use client';

import { useEffect, useState, useCallback } from 'react';
import { useArenaStore } from '@/lib/store';
import { playMusic, resumeAudioContext } from '@/lib/audio/musicEngine';
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
    window.addEventListener('resize', computeScale);
    return () => window.removeEventListener('resize', computeScale);
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

  // Scaled stage dimensions in CSS pixels
  const stageW = DESIGN_W * scale;
  const stageH = DESIGN_H * scale;

  return (
    /*
     * Outer shell: fills the full viewport, clips anything that might
     * theoretically bleed out, centers the scaled stage.
     * overflow:hidden on the shell prevents any scrollbars.
     */
    <div
      style={{
        width: '100vw',
        height: '100dvh',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#000',
      }}
    >
      {/*
       * Inner stage: fixed at DESIGN_W × DESIGN_H, then uniformly scaled
       * so the entire composition fits within the viewport.
       * transform-origin: top left + explicit translate keeps centering math simple.
       */}
      <div
        style={{
          position: 'relative',
          width: DESIGN_W,
          height: DESIGN_H,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          // Offset to visually center the scaled stage inside the shell
          marginLeft: (stageW - DESIGN_W) / 2,
          marginTop: (stageH - DESIGN_H) / 2,
          flexShrink: 0,
        }}
      >
        {/* Full-stage background image — no contain/cover needed; stage IS the image size */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/Perfect.png"
          alt="Arena 151 — Draft Battle Conquer"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'fill',
            display: 'block',
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
