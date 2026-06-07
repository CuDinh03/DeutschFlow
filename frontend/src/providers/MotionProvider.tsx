'use client'

// Honour the OS `prefers-reduced-motion` setting across every Framer Motion animation in the
// tree. Without this provider, Framer's animations play regardless of user preference (WCAG
// 2.3.3 Animation from Interactions failure) — and the app uses framer-motion on most pages
// for transitions, parallax-style reveals, and shimmer effects.
//
// `MotionConfig reducedMotion="user"` makes Framer respect the system setting automatically;
// no per-component changes needed at call sites.

import { MotionConfig } from 'framer-motion'
import type { ReactNode } from 'react'

export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>
}
