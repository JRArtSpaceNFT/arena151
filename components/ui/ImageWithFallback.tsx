'use client'

import { useState } from 'react'
import Image, { ImageProps } from 'next/image'

interface ImageWithFallbackProps extends Omit<ImageProps, 'src' | 'onError'> {
  src: string
  fallbackSrc?: string
}

/**
 * Image component with automatic fallback on load error
 * Shows loading skeleton while image loads
 */
export function ImageWithFallback({
  src,
  alt,
  fallbackSrc = '/placeholder.png',
  className,
  ...props
}: ImageWithFallbackProps) {
  const [imgSrc, setImgSrc] = useState(src)
  const [loading, setLoading] = useState(true)
  
  return (
    <div className="relative">
      {loading && (
        <div className="absolute inset-0 bg-slate-800 animate-pulse rounded" />
      )}
      <Image
        {...props}
        src={imgSrc}
        alt={alt}
        className={className}
        onError={() => {
          if (imgSrc !== fallbackSrc) {
            setImgSrc(fallbackSrc)
          }
        }}
        onLoad={() => setLoading(false)}
      />
    </div>
  )
}
