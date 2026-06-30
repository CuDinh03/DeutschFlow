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

// The 6 topic groups (limb colours) — hex verbatim from na-tree GROUP_COLORS.
// Used in Pha 3 to tint each branch's foliage + topic chip by the lesson's real
// topic group (derived from phase/industry), replacing Pha 2's cosmetic cycling.
export type TopicGroupKey = 'daily' | 'work' | 'travel' | 'medical' | 'culture' | 'exam'

export const GROUP_COLORS: Record<TopicGroupKey, { name: string; leaf: string; dark: string; soft: string }> = {
  daily: { name: 'Đời sống', leaf: '#6FA85B', dark: '#4E7E3C', soft: '#B2D6A1' },
  work: { name: 'Công việc', leaf: '#5B86C9', dark: '#39599C', soft: '#AEC6E8' },
  travel: { name: 'Du lịch', leaf: '#C9963E', dark: '#9C6F23', soft: '#E8C788' },
  medical: { name: 'Y tế', leaf: '#3FA59B', dark: '#287A71', soft: '#98CFC8' },
  culture: { name: 'Văn hóa', leaf: '#9B7BC4', dark: '#74559E', soft: '#CBB7E4' },
  exam: { name: 'Luyện thi', leaf: '#D4A53A', dark: '#A77E1C', soft: '#EED391' },
}

// Skill accent dots on each lesson fruit. COSMETIC in Pha 2 — there is no
// per-node skill on the wire, so the dot is cycled by `dayNumber % 4` (stable
// across re-sorts). Real per-node skill is Pha 3. Hex verbatim from na-tree SKILLS.
export const SKILL_DOTS = [
  { k: 'hoeren', color: '#4F86E0' }, // Nghe
  { k: 'lesen', color: '#5E9150' }, // Đọc
  { k: 'sprechen', color: '#E8853A' }, // Nói
  { k: 'schreiben', color: '#8257D8' }, // Viết
] as const
