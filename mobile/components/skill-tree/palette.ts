// Skill-tree visual palette — copied verbatim from the design source-of-truth
// `design/v2/native/na-tree.jsx` so the native render keeps hex parity with v2.
// Geometry lives in `layout.ts`; glyph shapes in `glyphs.tsx`.

import type { MilestoneState } from './layout'

// Bark tones for the trunk ribbon + gradient stops.
export const BARK = { dark: '#352B21', mid: '#564636', light: '#6E5A45' } as const

// Foliage tints cycled per branch (topic-group leaves come in Pha 3; until then
// branches cycle this palette so adjacent clusters stay visually distinct).
export const FOLIAGE = ['#8FB36B', '#6FB0A8', '#7FA8D8', '#B79BD8', '#E0A36A', '#9FC27A'] as const

// Milestone disc palette. Pha 1 ships only the three computable states; `ready`
// (branch-maturity gated) is deferred to a later phase (spec H4).
interface MilestonePaint {
  fill: string
  stroke: string
  glow: string | null
  dashed: boolean
}

export const MS_PAL: Record<MilestoneState, MilestonePaint> = {
  passed: { fill: '#FFCD00', stroke: '#B8911C', glow: '#FFCD00', dashed: false },
  in_progress: { fill: '#FBFAF7', stroke: '#161513', glow: null, dashed: false },
  locked: { fill: '#EFEAE0', stroke: '#C9C2B6', glow: null, dashed: true },
}

// Ground mound + sprout colours.
export const GROUND = {
  moundOuter: '#D8C8A8',
  moundInner: '#C9B68F',
  sproutRing: '#6F9460',
} as const

// Crown canopy leaf tints (alternated).
export const CROWN_LEAVES = ['#6FA85B', '#4E7E3C'] as const
