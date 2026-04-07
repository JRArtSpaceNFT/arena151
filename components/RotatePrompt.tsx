'use client';

import { useEffect, useState } from 'react';

export default function RotatePrompt() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const isMobile = () => {
      return (window.innerWidth <= 1024 && window.innerHeight <= 1024) &&
             ('ontouchstart' in window || navigator.maxTouchPoints > 0);
    };
    const isPortrait = () => window.innerHeight > window.innerWidth;

    const check = () => {
      setShow(isMobile() && isPortrait());
    };

    check();
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
    return () => {
      window.removeEventListener('resize', check);
      window.removeEventListener('orientationchange', check);
    };
  }, []);

  if (!show) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 99999,
      background: '#0f172a',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '24px',
    }}>
      <style>{`
        @keyframes rotatePhone {
          0%, 35% { transform: rotate(0deg); }
          65%, 100% { transform: rotate(-90deg); }
        }
      `}</style>
      <div style={{
        fontSize: '80px',
        lineHeight: 1,
        animation: 'rotatePhone 2s ease-in-out infinite',
        display: 'inline-block',
        transformOrigin: 'center center',
      }}>
        📱
      </div>
      <div style={{
        fontFamily: '"Impact", "Arial Black", sans-serif',
        fontSize: 'clamp(18px, 5vw, 28px)',
        fontWeight: 900,
        color: '#f59e0b',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        textAlign: 'center',
        padding: '0 24px',
      }}>
        Rotate for best experience
      </div>
      <div style={{
        fontSize: 'clamp(13px, 3vw, 16px)',
        color: 'rgba(255,255,255,0.6)',
        textAlign: 'center',
        padding: '0 32px',
        lineHeight: 1.5,
      }}>
        Arena 151 is designed for landscape mode
      </div>
    </div>
  );
}
