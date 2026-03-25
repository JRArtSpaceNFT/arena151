'use client'
import { motion, AnimatePresence } from 'framer-motion'

export interface FaceZoomEvent {
  trainerName: string
  trainerColor: string
  spriteUrl: string | undefined
  side: 'A' | 'B'
  label: string  // e.g. "CRITICAL HIT!", "K.O.!", "ULTIMATE!", "LEGENDARY WIN!"
  uid: number
}

interface Props {
  event: FaceZoomEvent | null
}

// Speed lines component — radiating from center
function SpeedLines({ color }: { color: string }) {
  const lines = Array.from({ length: 24 })
  return (
    <svg
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
      viewBox="0 0 400 400"
    >
      {lines.map((_, i) => {
        const angle = (i / 24) * 360
        const rad = angle * Math.PI / 180
        const x1 = 200 + Math.cos(rad) * 40
        const y1 = 200 + Math.sin(rad) * 40
        const x2 = 200 + Math.cos(rad) * 280
        const y2 = 200 + Math.sin(rad) * 280
        return (
          <line
            key={i}
            x1={x1} y1={y1} x2={x2} y2={y2}
            stroke={color}
            strokeWidth={i % 3 === 0 ? 3 : 1}
            opacity={i % 3 === 0 ? 0.8 : 0.35}
          />
        )
      })}
    </svg>
  )
}

export default function AnimeFaceZoom({ event }: Props) {
  if (!event) return null

  const isLeft = event.side === 'A'
  const accentColor = event.trainerColor

  return (
    <AnimatePresence>
      <motion.div
        key={event.uid}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        style={{
          position: 'fixed', inset: 0,
          zIndex: 45,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
          overflow: 'hidden',
        }}
      >
        {/* Dark vignette overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.85) 100%)',
        }} />

        {/* Speed lines */}
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1.2, opacity: 0.6 }}
          exit={{ scale: 1.5, opacity: 0 }}
          transition={{ duration: 0.25 }}
          style={{ position: 'absolute', inset: 0 }}
        >
          <SpeedLines color={accentColor} />
        </motion.div>

        {/* Manga-style halftone dots bg */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `radial-gradient(${accentColor}22 1px, transparent 1px)`,
          backgroundSize: '18px 18px',
          opacity: 0.5,
        }} />

        {/* Main trainer face zoom card */}
        <motion.div
          initial={{ scale: 0.3, opacity: 0, rotate: isLeft ? -8 : 8 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          exit={{ scale: 1.4, opacity: 0, y: -30 }}
          transition={{
            type: 'spring', stiffness: 400, damping: 28,
          }}
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 0,
          }}
        >
          {/* Action label — manga style, top */}
          <motion.div
            initial={{ x: isLeft ? -80 : 80, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.1, type: 'spring', stiffness: 500, damping: 30 }}
            style={{
              background: accentColor,
              color: '#ffffff',
              fontFamily: '"Impact", "Arial Black", sans-serif',
              fontSize: 22,
              fontWeight: 900,
              letterSpacing: '0.12em',
              padding: '6px 24px',
              borderRadius: 2,
              textTransform: 'uppercase',
              boxShadow: `0 4px 0 ${accentColor}88, 0 0 24px ${accentColor}`,
              border: '3px solid white',
              marginBottom: -4,
              zIndex: 2,
              whiteSpace: 'nowrap',
            }}
          >
            {event.label}
          </motion.div>

          {/* Trainer portrait — thick manga border */}
          <div style={{
            width: 260,
            height: 320,
            border: `8px solid ${accentColor}`,
            outline: '4px solid white',
            overflow: 'hidden',
            position: 'relative',
            background: `linear-gradient(135deg, ${accentColor}22, ${accentColor}44)`,
            boxShadow: `0 0 40px ${accentColor}, 0 0 80px ${accentColor}88`,
          }}>
            {/* Diagonal stripe accent (manga style) */}
            <div style={{
              position: 'absolute', inset: 0,
              backgroundImage: `repeating-linear-gradient(
                45deg,
                ${accentColor}15 0px,
                ${accentColor}15 4px,
                transparent 4px,
                transparent 20px
              )`,
            }} />

            {event.spriteUrl ? (
              <motion.img
                src={event.spriteUrl}
                alt={event.trainerName}
                initial={{ scale: 1.8, y: 40 }}
                animate={{ scale: 2.4, y: 20 }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  objectPosition: 'top',
                  imageRendering: 'pixelated',
                  filter: `drop-shadow(0 0 16px ${accentColor})`,
                }}
              />
            ) : (
              <div style={{
                width: '100%', height: '100%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 96, fontWeight: 900, color: accentColor,
              }}>
                {event.trainerName[0]}
              </div>
            )}
          </div>

          {/* Trainer name — bottom */}
          <motion.div
            initial={{ x: isLeft ? 80 : -80, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.12, type: 'spring', stiffness: 500, damping: 30 }}
            style={{
              background: '#0a0a0f',
              border: `3px solid ${accentColor}`,
              color: accentColor,
              fontFamily: '"Impact", "Arial Black", sans-serif',
              fontSize: 18,
              fontWeight: 900,
              letterSpacing: '0.15em',
              padding: '5px 22px',
              textTransform: 'uppercase',
              marginTop: -4,
              zIndex: 2,
              boxShadow: `0 0 16px ${accentColor}66`,
              whiteSpace: 'nowrap',
            }}
          >
            {event.trainerName}
          </motion.div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
