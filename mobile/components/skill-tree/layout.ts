// Pure geometry for the bottom-up "Cây học tập" tree. No React, no SVG — just
// numbers, so it is unit-testable (spec §7 M1: invariants, not screenshots).
//
// Bottom-up model (spec §2): the lowest CEFR level sits on the ground; each
// higher level stacks upward and the crown (goal) caps the top. A tier's height
// is a running-sum f(branch count) — never a fixed `i * gap` — so a level with
// many lessons grows taller instead of overflowing into the level above (H1).

import type { SkillNode } from '@/lib/skillTreeApi'

export const CEFR_ORDER = ['A0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2']

export type MilestoneState = 'passed' | 'in_progress' | 'locked'

const BRANCH_SIZE = 3 // lessons per branch cluster
const ROW = 150 // vertical space one branch row occupies
const MS_BAND = 72 // milestone disc band at a tier's base
const TOP_PAD = 96 // room above the highest tier for the crown
const BOTTOM_PAD = 80 // room below the lowest tier for ground + sprout

export interface BranchRow {
  nodes: SkillNode[]
  side: -1 | 1
  foliage: string
  /** vertical centre of the foliage cluster */
  y: number
}

export interface TierLayout {
  level: string
  state: MilestoneState
  /** milestone disc centre y — near the tier's base, closest to the ground */
  milestoneY: number
  branchRows: BranchRow[]
}

export interface TreeLayout {
  tiers: TierLayout[]
  groundY: number
  /** y of the highest tier's top edge; the crown anchors above this */
  topY: number
  height: number
  cx: number
  /** label shown on the crown — the highest CEFR level present (the goal) */
  goalLabel: string
}

// A tier is `passed` only when every lesson is complete; `in_progress` once any
// lesson is unlocked/started; otherwise `locked`. AVAILABLE counts as in-progress
// because the level is reachable (depends on the C1 UNLOCKED→AVAILABLE fix).
function milestoneState(nodes: SkillNode[]): MilestoneState {
  if (nodes.length > 0 && nodes.every((n) => n.status === 'COMPLETED')) return 'passed'
  if (nodes.some((n) => n.status === 'IN_PROGRESS' || n.status === 'AVAILABLE' || n.status === 'COMPLETED'))
    return 'in_progress'
  return 'locked'
}

function cefrRank(level: string): number {
  const i = CEFR_ORDER.indexOf(level)
  return i === -1 ? 99 : i
}

export function buildTreeLayout(
  nodes: SkillNode[],
  width: number,
  foliagePalette: readonly string[],
): TreeLayout {
  const cx = width / 2

  const grouped: Record<string, SkillNode[]> = {}
  for (const n of nodes) (grouped[n.cefrLevel || '—'] ??= []).push(n)
  const levels = Object.keys(grouped).sort((a, b) => cefrRank(a) - cefrRank(b))

  let foliageI = 0
  const built = levels.map((level) => {
    const lv = grouped[level].slice().sort((a, b) => a.dayNumber - b.dayNumber)
    const branches: Omit<BranchRow, 'y'>[] = []
    for (let i = 0; i < lv.length; i += BRANCH_SIZE) {
      branches.push({
        nodes: lv.slice(i, i + BRANCH_SIZE),
        side: branches.length % 2 === 0 ? -1 : 1,
        foliage: foliagePalette[foliageI++ % foliagePalette.length],
      })
    }
    return { level, branches, state: milestoneState(lv) }
  })

  const tierHeight = (branchCount: number) => MS_BAND + branchCount * ROW
  const totalContent = built.reduce((sum, t) => sum + tierHeight(t.branches.length), 0)
  const height = TOP_PAD + totalContent + BOTTOM_PAD
  const groundY = height - BOTTOM_PAD

  // Place bottom-up: the first (lowest) level sits on the ground; later levels
  // stack upward by subtracting their measured height.
  let yBottom = groundY
  const tiers: TierLayout[] = built.map((t) => {
    const milestoneY = yBottom - MS_BAND / 2
    const branchRows: BranchRow[] = t.branches.map((b, i) => ({
      ...b,
      y: yBottom - MS_BAND - i * ROW - ROW / 2,
    }))
    yBottom -= tierHeight(t.branches.length)
    return { level: t.level, state: t.state, milestoneY, branchRows }
  })

  const topY = yBottom
  const goalLabel = levels.length > 0 ? levels[levels.length - 1] : ''
  return { tiers, groundY, topY, height, cx, goalLabel }
}

// Tapered bark-ribbon trunk: wide at the base (ground), thin at the crown, with
// a gentle sway that fades out toward the top. Returns an SVG path `d`.
export function trunkPath(cx: number, groundY: number, topY: number): string {
  const baseW = 46
  const topW = 14
  const yb = groundY + 18 // sink slightly into the ground mound
  const yt = topY - 8
  const N = 12
  const swayAt = (t: number) => Math.sin(t * 2.4) * 8 * (1 - t)
  const widthAt = (t: number) => baseW + (topW - baseW) * t
  const yAt = (t: number) => yb + (yt - yb) * t

  const pts: [number, number][] = []
  for (let i = 0; i <= N; i++) {
    const t = i / N
    pts.push([cx - widthAt(t) / 2 + swayAt(t), yAt(t)])
  }
  for (let i = N; i >= 0; i--) {
    const t = i / N
    pts.push([cx + widthAt(t) / 2 + swayAt(t), yAt(t)])
  }
  return 'M ' + pts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' L ') + ' Z'
}
