'use client'
import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect } from 'react'

interface HypeReaction {
  id: string
  side: 'A' | 'B'
  type: 'emote' | 'phrase' | 'gg'
  content: string
  timestamp: number
}

interface LiveHypeReactionsProps {
  /** Expose trigger function via ref or callback */
  onMount?: (triggerFn: (side: 'A' | 'B', type: 'emote' | 'phrase' | 'gg', content?: string) => void) => void
}

const EMOTES = ['🔥', '💀', '😤', '👑', '⚡', '💪', '😱', '🎯', '💥', '🌟', '😎', '🤯', '👊', '🙌', '💯']

const TRAINER_PHRASES = {
  A: [
    "Let's go!",
    "Not even close!",
    "Too easy!",
    "Calculated!",
    "Unstoppable!",
    "GG EZ",
    "Outplayed!",
  ],
  B: [
    "Nice try!",
    "Still standing!",
    "Not done yet!",
    "Here we go!",
    "Comeback time!",
    "Believe it!",
    "Let's do this!",
  ],
}

export default function LiveHypeReactions({ onMount }: LiveHypeReactionsProps) {
  const [reactions, setReactions] = useState<HypeReaction[]>([])

  const triggerReaction = (side: 'A' | 'B', type: 'emote' | 'phrase' | 'gg', content?: string) => {
    const id = `${Date.now()}_${Math.random()}`
    
    let finalContent = content
    
    if (!finalContent) {
      if (type === 'emote') {
        finalContent = EMOTES[Math.floor(Math.random() * EMOTES.length)]
      } else if (type === 'phrase') {
        const phrases = TRAINER_PHRASES[side]
        finalContent = phrases[Math.floor(Math.random() * phrases.length)]
      } else if (type === 'gg') {
        finalContent = 'GG! 🎮'
      }
    }

    const newReaction: HypeReaction = {
      id,
      side,
      type,
      content: finalContent || '🔥',
      timestamp: Date.now(),
    }

    setReactions(prev => [...prev, newReaction])

    // Auto-remove after 3 seconds
    setTimeout(() => {
      setReactions(prev => prev.filter(r => r.id !== id))
    }, 3000)
  }

  useEffect(() => {
    onMount?.(triggerReaction)
  }, [onMount])

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 35,
        overflow: 'hidden',
      }}
    >
      <AnimatePresence>
        {reactions.map(reaction => (
          <Reaction key={reaction.id} reaction={reaction} />
        ))}
      </AnimatePresence>
    </div>
  )
}

function Reaction({ reaction }: { reaction: HypeReaction }) {
  // Position based on side
  const isLeft = reaction.side === 'A'
  
  const startX = isLeft ? '15%' : '85%'
  const endY = -100
  
  // Random horizontal drift
  const driftX = (Math.random() - 0.5) * 100

  return (
    <motion.div
      initial={{
        opacity: 0,
        scale: 0.3,
        x: startX,
        y: '70%',
      }}
      animate={{
        opacity: [0, 1, 1, 0.8, 0],
        scale: [0.3, 1.2, 1, 1, 0.8],
        x: `calc(${startX} + ${driftX}px)`,
        y: endY,
      }}
      exit={{ opacity: 0, scale: 0 }}
      transition={{
        duration: 3,
        ease: 'easeOut',
      }}
      style={{
        position: 'absolute',
        pointerEvents: 'none',
        zIndex: 35,
      }}
    >
      {reaction.type === 'emote' ? (
        <div
          style={{
            fontSize: 48,
            filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.5))',
          }}
        >
          {reaction.content}
        </div>
      ) : (
        <div
          style={{
            padding: '8px 14px',
            background: reaction.side === 'A' 
              ? 'linear-gradient(135deg, #ef4444, #dc2626)' 
              : 'linear-gradient(135deg, #3b82f6, #2563eb)',
            color: '#fff',
            borderRadius: 20,
            fontSize: 14,
            fontWeight: 900,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            border: '2px solid rgba(255,255,255,0.3)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.2)',
            whiteSpace: 'nowrap',
          }}
        >
          {reaction.content}
        </div>
      )}
    </motion.div>
  )
}

/** Hook for easy access to trigger function */
export function useHypeReactions() {
  const [triggerFn, setTriggerFn] = useState<((side: 'A' | 'B', type: 'emote' | 'phrase' | 'gg', content?: string) => void) | null>(null)

  const handleMount = (fn: (side: 'A' | 'B', type: 'emote' | 'phrase' | 'gg', content?: string) => void) => {
    setTriggerFn(() => fn)
  }

  return { triggerFn, handleMount }
}
