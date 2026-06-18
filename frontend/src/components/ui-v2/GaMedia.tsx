/* eslint-disable @next/next/no-img-element */
import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * GaMedia — image/avatar/video frame with a striped placeholder fallback.
 * Manifest: variants image|avatar|video, states placeholder|loaded.
 * (Plain <img> on purpose — these render remote S3/CDN URLs of unknown size.)
 */
export interface GaMediaProps {
  variant?: 'image' | 'avatar' | 'video'
  src?: string | null
  alt?: string
  className?: string
}

const STRIPE =
  'repeating-linear-gradient(45deg, var(--ga-side-active) 0 8px, var(--ga-card) 8px 16px)'

export function GaMedia({ variant = 'image', src, alt = '', className }: GaMediaProps) {
  const shape = variant === 'avatar' ? 'rounded-ga-pill aspect-square' : 'rounded-ga aspect-video'
  return (
    <div
      className={cn('relative overflow-hidden border border-ga-line bg-ga-card', shape, className)}
      style={src ? undefined : { backgroundImage: STRIPE }}
    >
      {src ? (
        <img src={src} alt={alt} className="h-full w-full object-cover" />
      ) : (
        <span className="absolute inset-0 grid place-items-center text-[11px] font-semibold uppercase tracking-[0.08em] text-ga-subtle">
          {variant}
        </span>
      )}
    </div>
  )
}
