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
          quality={85}
          sizes="100vw"
          style={{
            objectFit: 'fill',
            userSelect: 'none',
          }}
          draggable={false}
          placeholder="blur"
          blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
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

      {/* Discord link — bottom right corner */}
      <a
        href="https://discord.gg/QxZJUCzT"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          position: 'fixed',
          bottom: 20,
          right: 20,
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 18px',
          background: 'rgba(88, 101, 242, 0.95)',
          border: '2px solid rgba(255,255,255,0.2)',
          borderRadius: 10,
          color: '#fff',
          fontSize: 14,
          fontWeight: 700,
          textDecoration: 'none',
          boxShadow: '0 4px 16px rgba(88,101,242,0.5)',
          transition: 'all 0.2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 6px 20px rgba(88,101,242,0.7)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 4px 16px rgba(88,101,242,0.5)';
        }}
      >
        <svg width="20" height="20" viewBox="0 0 71 55" fill="none" xmlns="http://www.w3.org/2000/svg">
          <g clipPath="url(#clip0)">
            <path d="M60.1045 4.8978C55.5792 2.8214 50.7265 1.2916 45.6527 0.41542C45.5603 0.39851 45.468 0.440769 45.4204 0.525289C44.7963 1.6353 44.105 3.0834 43.6209 4.2216C38.1637 3.4046 32.7345 3.4046 27.3892 4.2216C26.905 3.0581 26.1886 1.6353 25.5617 0.525289C25.5141 0.443589 25.4218 0.40133 25.3294 0.41542C20.2584 1.2888 15.4057 2.8186 10.8776 4.8978C10.8384 4.9147 10.8048 4.9429 10.7825 4.9795C1.57795 18.7309 -0.943561 32.1443 0.293408 45.3914C0.299005 45.4562 0.335386 45.5182 0.385761 45.5576C6.45866 50.0174 12.3413 52.7249 18.1147 54.5195C18.2071 54.5477 18.305 54.5139 18.3638 54.4378C19.7295 52.5728 20.9469 50.6063 21.9907 48.5383C22.0523 48.4172 21.9935 48.2735 21.8676 48.2256C19.9366 47.4931 18.0979 46.6 16.3292 45.5858C16.1893 45.5041 16.1781 45.304 16.3068 45.2082C16.679 44.9293 17.0513 44.6391 17.4067 44.3461C17.471 44.2926 17.5606 44.2813 17.6362 44.3151C29.2558 49.6202 41.8354 49.6202 53.3179 44.3151C53.3935 44.2785 53.4831 44.2898 53.5502 44.3433C53.9057 44.6363 54.2779 44.9293 54.6529 45.2082C54.7816 45.304 54.7732 45.5041 54.6333 45.5858C52.8646 46.6197 51.0259 47.4931 49.0921 48.2228C48.9662 48.2707 48.9102 48.4172 48.9718 48.5383C50.038 50.6034 51.2554 52.5699 52.5959 54.435C52.6519 54.5139 52.7526 54.5477 52.845 54.5195C58.6464 52.7249 64.529 50.0174 70.6019 45.5576C70.6551 45.5182 70.6887 45.459 70.6943 45.3942C72.1747 30.0791 68.2147 16.7757 60.1968 4.9823C60.1772 4.9429 60.1437 4.9147 60.1045 4.8978ZM23.7259 37.3253C20.2276 37.3253 17.3451 34.1136 17.3451 30.1693C17.3451 26.225 20.1717 23.0133 23.7259 23.0133C27.308 23.0133 30.1626 26.2532 30.1066 30.1693C30.1066 34.1136 27.28 37.3253 23.7259 37.3253ZM47.3178 37.3253C43.8196 37.3253 40.9371 34.1136 40.9371 30.1693C40.9371 26.225 43.7636 23.0133 47.3178 23.0133C50.9 23.0133 53.7545 26.2532 53.6986 30.1693C53.6986 34.1136 50.9 37.3253 47.3178 37.3253Z" fill="white"/>
          </g>
          <defs>
            <clipPath id="clip0">
              <rect width="71" height="55" fill="white"/>
            </clipPath>
          </defs>
        </svg>
        <span>Join Discord</span>
      </a>
    </div>
  );
}
