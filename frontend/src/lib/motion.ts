// Shared Framer Motion spring presets — mirrors iOS DF.Spring constants.
// gentle ≈ SwiftUI spring(response: 0.5, dampingFraction: 0.8)
// snappy ≈ SwiftUI spring(response: 0.3, dampingFraction: 0.75)
export const spring = {
  gentle: { type: 'spring', stiffness: 280, damping: 24 } as const,
  snappy: { type: 'spring', stiffness: 380, damping: 28 } as const,
  micro:  { type: 'spring', stiffness: 500, damping: 35 } as const,
  nav:    { type: 'spring', stiffness: 320, damping: 24 } as const,
} as const

export const fadeUp = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0  },
  exit:    { opacity: 0, y: -8 },
} as const

export const stagger = (children = 0.08) => ({
  animate: { transition: { staggerChildren: children } },
})
