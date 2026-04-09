/**
 * Arena Reactions System
 * Environment responds to elemental attacks
 * Based on Section 7 of the battle VFX spec
 */

'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect } from 'react'

interface ArenaReaction {
  id: string
  element: string
  type: 'temporary' | 'stacking' | 'persistent'
  intensity: number
  position: { x: number; y: number }
  createdAt: number
}

interface ArenaReactionsProps {
  reactions: ArenaReaction[]
}

export default function ArenaReactions({ reactions }: ArenaReactionsProps) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <AnimatePresence>
        {reactions.map((reaction) => (
          <ArenaReactionEffect key={reaction.id} reaction={reaction} />
        ))}
      </AnimatePresence>
    </div>
  )
}

function ArenaReactionEffect({ reaction }: { reaction: ArenaReaction }) {
  const [opacity, setOpacity] = useState(1)

  useEffect(() => {
    // Fade out temporary reactions after duration
    if (reaction.type === 'temporary') {
      const fadeDelay = 1000 + reaction.intensity * 500
      setTimeout(() => {
        setOpacity(0)
      }, fadeDelay)
    }
  }, [reaction])

  switch (reaction.element) {
    case 'fire':
      return <FireReaction reaction={reaction} opacity={opacity} />
    case 'electric':
      return <ElectricReaction reaction={reaction} opacity={opacity} />
    case 'water':
      return <WaterReaction reaction={reaction} opacity={opacity} />
    case 'ice':
      return <IceReaction reaction={reaction} opacity={opacity} />
    case 'ground':
    case 'rock':
      return <EarthReaction reaction={reaction} opacity={opacity} />
    case 'dark':
    case 'ghost':
      return <DarkReaction reaction={reaction} opacity={opacity} />
    default:
      return null
  }
}

// ═══════════════════════════════════════════════════════════════
// FIRE - Scorches ground, throws embers, heat shimmer
// ═══════════════════════════════════════════════════════════════

function FireReaction({ reaction, opacity }: { reaction: ArenaReaction; opacity: number }) {
  return (
    <>
      {/* Scorch mark */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: opacity * 0.6 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.4 }}
        className="absolute rounded-full"
        style={{
          left: `${reaction.position.x}%`,
          top: `${reaction.position.y}%`,
          width: `${60 + reaction.intensity * 30}px`,
          height: `${60 + reaction.intensity * 30}px`,
          transform: 'translate(-50%, -50%)',
          background: 'radial-gradient(circle, rgba(0,0,0,0.6) 0%, transparent 70%)',
          border: '2px solid rgba(255, 102, 0, 0.4)',
        }}
      />

      {/* Rising embers */}
      {Array.from({ length: Math.floor(reaction.intensity * 10) }).map((_, i) => (
        <motion.div
          key={i}
          initial={{
            left: `${reaction.position.x + (Math.random() - 0.5) * 10}%`,
            top: `${reaction.position.y}%`,
            opacity: 0.8,
          }}
          animate={{
            top: `${reaction.position.y - 30}%`,
            opacity: 0,
          }}
          transition={{
            duration: 2 + Math.random(),
            delay: Math.random() * 0.5,
            repeat: Infinity,
          }}
          className="absolute w-1 h-1 rounded-full"
          style={{
            backgroundColor: '#FF6600',
            boxShadow: '0 0 4px #FF6600',
          }}
        />
      ))}

      {/* Heat shimmer */}
      <motion.div
        animate={{
          opacity: [0.3, 0.15, 0.3],
          scaleY: [1, 1.05, 1],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="absolute"
        style={{
          left: `${reaction.position.x}%`,
          top: `${reaction.position.y}%`,
          width: `${80 + reaction.intensity * 40}px`,
          height: `${100}px`,
          transform: 'translate(-50%, -50%)',
          background: 'linear-gradient(to top, rgba(255, 102, 0, 0.1), transparent)',
          filter: 'blur(8px)',
        }}
      />
    </>
  )
}

// ═══════════════════════════════════════════════════════════════
// ELECTRIC - Flickers lights, arcs across metal, static
// ═══════════════════════════════════════════════════════════════

function ElectricReaction({ reaction, opacity }: { reaction: ArenaReaction; opacity: number }) {
  return (
    <>
      {/* Electric pulse */}
      <motion.div
        initial={{ scale: 0, opacity: 1 }}
        animate={{ scale: [1, 2, 1], opacity: [1, 0, 1] }}
        transition={{
          duration: 0.4,
          repeat: 3,
          repeatDelay: 0.1,
        }}
        className="absolute rounded-full border-2"
        style={{
          left: `${reaction.position.x}%`,
          top: `${reaction.position.y}%`,
          width: `${40 + reaction.intensity * 20}px`,
          height: `${40 + reaction.intensity * 20}px`,
          transform: 'translate(-50%, -50%)',
          borderColor: '#00FFFF',
          boxShadow: '0 0 20px #00FFFF',
        }}
      />

      {/* Lightning arcs */}
      {Array.from({ length: 3 }).map((_, i) => (
        <motion.svg
          key={i}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0] }}
          transition={{
            duration: 0.2,
            delay: i * 0.15,
            repeat: 2,
          }}
          className="absolute"
          style={{
            left: `${reaction.position.x}%`,
            top: `${reaction.position.y}%`,
            width: '100px',
            height: '100px',
            transform: 'translate(-50%, -50%) rotate(' + (i * 60) + 'deg)',
          }}
        >
          <path
            d="M50,50 Q60,30 70,10"
            stroke="#FFFFFF"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
            filter="url(#glow)"
          />
          <defs>
            <filter id="glow">
              <feGaussianBlur stdDeviation="2" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
        </motion.svg>
      ))}

      {/* Screen-wide flicker */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.3, 0, 0.2, 0] }}
        transition={{ duration: 0.5 }}
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(circle at center, rgba(255, 255, 255, 0.1), transparent 60%)',
        }}
      />
    </>
  )
}

// ═══════════════════════════════════════════════════════════════
// WATER - Splashes floor, droplets, wet reflections, mist
// ═══════════════════════════════════════════════════════════════

function WaterReaction({ reaction, opacity }: { reaction: ArenaReaction; opacity: number }) {
  return (
    <>
      {/* Puddle forming */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1.5, opacity: opacity * 0.4 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 1 }}
        className="absolute rounded-full"
        style={{
          left: `${reaction.position.x}%`,
          top: `${reaction.position.y}%`,
          width: `${80 + reaction.intensity * 40}px`,
          height: `${40 + reaction.intensity * 20}px`,
          transform: 'translate(-50%, -50%)',
          background: 'radial-gradient(ellipse, rgba(0, 102, 204, 0.3) 0%, transparent 70%)',
          border: '1px solid rgba(0, 102, 204, 0.4)',
        }}
      />

      {/* Water droplets */}
      {Array.from({ length: Math.floor(reaction.intensity * 15) }).map((_, i) => (
        <motion.div
          key={i}
          initial={{
            left: `${reaction.position.x + (Math.random() - 0.5) * 20}%`,
            top: `${reaction.position.y - 20}%`,
            opacity: 0.7,
          }}
          animate={{
            top: `${reaction.position.y + 10}%`,
            opacity: 0,
          }}
          transition={{
            duration: 0.8 + Math.random() * 0.4,
            delay: Math.random() * 0.3,
          }}
          className="absolute w-1.5 h-2 rounded-full"
          style={{
            backgroundColor: '#66CCFF',
            boxShadow: '0 0 3px rgba(102, 204, 255, 0.6)',
          }}
        />
      ))}

      {/* Mist cloud */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 2, opacity: opacity * 0.2 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 2 }}
        className="absolute rounded-full"
        style={{
          left: `${reaction.position.x}%`,
          top: `${reaction.position.y}%`,
          width: `${120}px`,
          height: `${120}px`,
          transform: 'translate(-50%, -50%)',
          background: 'radial-gradient(circle, rgba(102, 204, 255, 0.15), transparent 70%)',
          filter: 'blur(20px)',
        }}
      />

      {/* Ripples */}
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          initial={{ scale: 0, opacity: 0.6 }}
          animate={{ scale: 2 + i, opacity: 0 }}
          transition={{ duration: 1.5, delay: i * 0.2 }}
          className="absolute rounded-full border"
          style={{
            left: `${reaction.position.x}%`,
            top: `${reaction.position.y}%`,
            width: `${60}px`,
            height: `${30}px`,
            transform: 'translate(-50%, -50%)',
            borderColor: 'rgba(0, 102, 204, 0.4)',
            borderWidth: '1px',
          }}
        />
      ))}
    </>
  )
}

// ═══════════════════════════════════════════════════════════════
// ICE - Frost spreads, ice crystals form, cold fog
// ═══════════════════════════════════════════════════════════════

function IceReaction({ reaction, opacity }: { reaction: ArenaReaction; opacity: number }) {
  return (
    <>
      {/* Frost pattern */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1.5, opacity: opacity * 0.5 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 1.2 }}
        className="absolute"
        style={{
          left: `${reaction.position.x}%`,
          top: `${reaction.position.y}%`,
          width: `${100 + reaction.intensity * 50}px`,
          height: `${100 + reaction.intensity * 50}px`,
          transform: 'translate(-50%, -50%)',
          background: `
            radial-gradient(circle, rgba(204, 255, 255, 0.3) 0%, transparent 50%),
            conic-gradient(from 0deg, transparent, rgba(204, 255, 255, 0.2), transparent),
            conic-gradient(from 60deg, transparent, rgba(204, 255, 255, 0.2), transparent),
            conic-gradient(from 120deg, transparent, rgba(204, 255, 255, 0.2), transparent)
          `,
          borderRadius: '50%',
        }}
      />

      {/* Ice crystals */}
      {Array.from({ length: 8 }).map((_, i) => {
        const angle = (i / 8) * 360
        return (
          <motion.div
            key={i}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: opacity * 0.7 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, delay: i * 0.05 }}
            className="absolute"
            style={{
              left: `${reaction.position.x}%`,
              top: `${reaction.position.y}%`,
              width: '20px',
              height: '20px',
              transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(-${30 + reaction.intensity * 10}px)`,
            }}
          >
            <div
              className="w-2 h-4"
              style={{
                background: 'linear-gradient(to bottom, rgba(204, 255, 255, 0.8), transparent)',
                boxShadow: '0 0 8px rgba(204, 255, 255, 0.6)',
              }}
            />
          </motion.div>
        )
      })}

      {/* Cold fog */}
      <motion.div
        animate={{
          opacity: [opacity * 0.2, opacity * 0.3, opacity * 0.2],
          scale: [1, 1.2, 1],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="absolute"
        style={{
          left: `${reaction.position.x}%`,
          top: `${reaction.position.y}%`,
          width: `${150}px`,
          height: `${80}px`,
          transform: 'translate(-50%, -50%)',
          background: 'radial-gradient(ellipse, rgba(204, 255, 255, 0.2), transparent 70%)',
          filter: 'blur(25px)',
        }}
      />
    </>
  )
}

// ═══════════════════════════════════════════════════════════════
// EARTH - Ground cracks, dust explosion, debris
// ═══════════════════════════════════════════════════════════════

function EarthReaction({ reaction, opacity }: { reaction: ArenaReaction; opacity: number }) {
  return (
    <>
      {/* Ground crack */}
      <motion.svg
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: opacity * 0.7 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.6 }}
        className="absolute"
        style={{
          left: `${reaction.position.x}%`,
          top: `${reaction.position.y}%`,
          width: `${150}px`,
          height: `${150}px`,
          transform: 'translate(-50%, -50%)',
        }}
      >
        <motion.path
          d="M75,75 L75,10 M75,75 L110,40 M75,75 L40,40"
          stroke="rgba(0,0,0,0.6)"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
        />
      </motion.svg>

      {/* Dust cloud */}
      <motion.div
        initial={{ scale: 0, opacity: 0.6 }}
        animate={{ scale: 3, opacity: 0 }}
        transition={{ duration: 2 }}
        className="absolute rounded-full"
        style={{
          left: `${reaction.position.x}%`,
          top: `${reaction.position.y}%`,
          width: `${100}px`,
          height: `${100}px`,
          transform: 'translate(-50%, -50%)',
          background: 'radial-gradient(circle, rgba(153, 102, 51, 0.4), transparent 60%)',
          filter: 'blur(15px)',
        }}
      />
    </>
  )
}

// ═══════════════════════════════════════════════════════════════
// DARK - Dims lights, shadow tendrils, void distortion
// ═══════════════════════════════════════════════════════════════

function DarkReaction({ reaction, opacity }: { reaction: ArenaReaction; opacity: number }) {
  return (
    <>
      {/* Shadow expansion */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 2, opacity: opacity * 0.5 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 1.5 }}
        className="absolute rounded-full"
        style={{
          left: `${reaction.position.x}%`,
          top: `${reaction.position.y}%`,
          width: `${120 + reaction.intensity * 60}px`,
          height: `${120 + reaction.intensity * 60}px`,
          transform: 'translate(-50%, -50%)',
          background: 'radial-gradient(circle, rgba(51, 0, 51, 0.7) 0%, transparent 70%)',
        }}
      />

      {/* Shadow tendrils */}
      {Array.from({ length: 6 }).map((_, i) => {
        const angle = (i / 6) * 360
        return (
          <motion.div
            key={i}
            initial={{ scaleY: 0, opacity: 0 }}
            animate={{ scaleY: 1, opacity: opacity * 0.6 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, delay: i * 0.08 }}
            className="absolute"
            style={{
              left: `${reaction.position.x}%`,
              top: `${reaction.position.y}%`,
              width: '4px',
              height: `${60 + reaction.intensity * 30}px`,
              transformOrigin: 'top center',
              transform: `translate(-50%, 0) rotate(${angle}deg)`,
              background: 'linear-gradient(to bottom, rgba(51, 0, 51, 0.8), transparent)',
              filter: 'blur(3px)',
            }}
          />
        )
      })}

      {/* Reality distortion */}
      <motion.div
        animate={{
          scale: [1, 1.1, 1],
          opacity: [opacity * 0.3, opacity * 0.5, opacity * 0.3],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="absolute rounded-full"
        style={{
          left: `${reaction.position.x}%`,
          top: `${reaction.position.y}%`,
          width: `${80}px`,
          height: `${80}px`,
          transform: 'translate(-50%, -50%)',
          background: 'radial-gradient(circle, rgba(99, 0, 99, 0.3), transparent 60%)',
          filter: 'blur(20px)',
        }}
      />
    </>
  )
}
