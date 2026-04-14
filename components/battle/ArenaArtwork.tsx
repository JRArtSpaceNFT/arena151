'use client'

import React from 'react'
import type { Arena } from '@/lib/game-types'

export default function ArenaArtwork({
  arena,
  width = 400,
  height = 200,
}: {
  arena: Arena
  width?: number
  height?: number
}) {
  return (
    <img
      src={`/arenas/${arena.id}.webp`}
      alt={arena.name}
      width={width}
      height={height}
      style={{
        display: 'block',
        imageRendering: 'pixelated',
        objectFit: 'cover',
        width,
        height,
      }}
    />
  )
}
