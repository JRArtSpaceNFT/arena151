'use client'

import { useEffect, useRef, useState } from 'react'

// Fixed design resolution — the game always renders at this size
const DESIGN_W = 1440
const DESIGN_H = 900

export default function ScaleWrapper({ children }: { children: React.ReactNode }) {
  const [scale, setScale] = useState(1)
  const [offsetX, setOffsetX] = useState(0)
  const [offsetY, setOffsetY] = useState(0)

  useEffect(() => {
    function update() {
      const scaleX = window.innerWidth / DESIGN_W
      const scaleY = window.innerHeight / DESIGN_H
      const s = Math.min(scaleX, scaleY)
      setScale(s)
      setOffsetX((window.innerWidth - DESIGN_W * s) / 2)
      setOffsetY((window.innerHeight - DESIGN_H * s) / 2)
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        position: 'fixed',
        top: 0,
        left: 0,
        background: '#020617', // letterbox color
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: offsetY,
          left: offsetX,
          width: DESIGN_W,
          height: DESIGN_H,
          transformOrigin: 'top left',
          transform: `scale(${scale})`,
          overflow: 'hidden',
        }}
      >
        {children}
      </div>
    </div>
  )
}
