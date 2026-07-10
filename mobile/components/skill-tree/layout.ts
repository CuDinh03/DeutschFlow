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

// View-only maturity preview (the A0·Mầm / Hiện tại / C1·Cây lớn tabs). Overrides
// how levels are classified for RENDER only — it never changes lesson data/gating.
//   mam     → force every level locked → a bare sprout (what a brand-new tree looks like)
//   current → the learner's actual progress
//   big     → force every level passed → the full grown tree (the goal preview)
export type PreviewStage = 'mam' | 'current' | 'big'

const BRANCH_SIZE = 3 // lessons per branch cluster
const ROW = 150 // vertical space one branch row occupies
const MS_BAND = 72 // milestone disc band at a tier's base
const TOP_PAD = 96 // room above the highest tier for the crown
const BOTTOM_PAD = 80 // room below the lowest tier for ground + sprout
const SKELETON_BAND = 116 // compact vertical space per not-yet-reached (future) level
const CURRENT_FOLIAGE_FLOOR = 0.25 // current level's foliage opacity at 0% done (→ 1.0 at 100%)

export interface BranchRow {
  nodes: SkillNode[]
  side: -1 | 1
  /** vertical centre of the foliage cluster */
  y: number
}

export interface TierLayout {
  level: string
  state: MilestoneState
  /** milestone disc centre y — near the tier's base, closest to the ground */
  milestoneY: number
  branchRows: BranchRow[]
  /** false = a not-yet-reached (locked) level, drawn as a faint skeleton with no
   *  branches; true = a reached level drawn with full branches/foliage. */
  grown: boolean
  /** completed/total for this level (0..1) — drives the current level's foliage
   *  density so the tree visibly fills in week-to-week before the next level-up. */
  fillRatio: number
  /** foliage opacity coefficient (0..1) the renderer applies to this level's
   *  clusters: passed level = 1 (lush); current (in-progress) = floor→1 by
   *  fillRatio; future (skeleton) = 0 (no foliage drawn). Pure-layer so it is
   *  unit-tested alongside the geometry. */
  foliageScale: number
}

export interface TreeLayout {
  tiers: TierLayout[]
  groundY: number
  /** y of the top edge of the whole canvas (above the faint skeleton); the crown anchors here */
  topY: number
  /** y of the top edge of the GROWN (solid) trunk — where the faint future trunk begins */
  grownTopY: number
  height: number
  cx: number
  /** label shown on the crown — the highest CEFR level present (the goal) */
  goalLabel: string
  /** true once the goal (highest) level is fully passed — crown renders solid, else faint */
  goalReached: boolean
  /** true when at least one level has grown (reached). When false (cold-start: every
   *  level still locked), the living trunk must be suppressed so only the sprout +
   *  faint skeleton show — `grownTopY` equals `groundY` and a solid trunk would be a
   *  degenerate, inverted ribbon painted into the ground mound. */
  hasGrown: boolean
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

export function buildTreeLayout(nodes: SkillNode[], width: number, preview: PreviewStage = 'current'): TreeLayout {
  const cx = width / 2

  const grouped: Record<string, SkillNode[]> = {}
  for (const n of nodes) (grouped[n.cefrLevel || '—'] ??= []).push(n)
  const levels = Object.keys(grouped).sort((a, b) => cefrRank(a) - cefrRank(b))

  const built = levels.map((level) => {
    const lv = grouped[level].slice().sort((a, b) => a.dayNumber - b.dayNumber || a.sortOrder - b.sortOrder)
    const branches: Omit<BranchRow, 'y'>[] = []
    for (let i = 0; i < lv.length; i += BRANCH_SIZE) {
      branches.push({
        nodes: lv.slice(i, i + BRANCH_SIZE),
        side: branches.length % 2 === 0 ? -1 : 1,
      })
    }
    // Maturity preview overrides classification for render only (mam=all locked,
    // big=all passed), else use the learner's real progress.
    const state =
      preview === 'big' ? 'passed' : preview === 'mam' ? 'locked' : milestoneState(lv)
    const completed =
      preview === 'big' ? lv.length : preview === 'mam' ? 0 : lv.filter((n) => n.status === 'COMPLETED').length
    // A level "grows" once it is reachable (passed or in-progress); levels still
    // fully locked are the unreached future, drawn as a faint skeleton (spec §2:
    // the tree grows from a sprout to the CURRENT level, the goal floats above).
    const grown = state !== 'locked'
    const fillRatio = lv.length > 0 ? completed / lv.length : 0
    // Foliage coefficient: passed = lush (1); current level fills floor→1 by its
    // completion; future = none (no clusters drawn).
    const foliageScale = !grown
      ? 0
      : state === 'in_progress'
        ? CURRENT_FOLIAGE_FLOOR + (1 - CURRENT_FOLIAGE_FLOOR) * fillRatio
        : 1
    return { level, branches, state, grown, fillRatio, foliageScale }
  })

  // Grown levels carry their full measured height; future levels collapse to a
  // compact faint band so the skeleton + crown sit just above the living tree.
  const tierHeight = (branchCount: number) => MS_BAND + branchCount * ROW
  const totalContent = built.reduce(
    (sum, t) => sum + (t.grown ? tierHeight(t.branches.length) : SKELETON_BAND),
    0,
  )
  const height = TOP_PAD + totalContent + BOTTOM_PAD
  const groundY = height - BOTTOM_PAD

  // Place bottom-up: the lowest level sits on the ground; later levels stack
  // upward. Grown levels get branch rows; future (skeleton) levels get just a
  // faint milestone band. `grownTopY` marks where the solid trunk ends and the
  // faint "still to grow" trunk begins.
  let yBottom = groundY
  let grownTopY = groundY
  const tiers: TierLayout[] = built.map((t) => {
    if (t.grown) {
      const milestoneY = yBottom - MS_BAND / 2
      const branchRows: BranchRow[] = t.branches.map((b, i) => ({
        ...b,
        y: yBottom - MS_BAND - i * ROW - ROW / 2,
      }))
      yBottom -= tierHeight(t.branches.length)
      grownTopY = yBottom
      return { level: t.level, state: t.state, milestoneY, branchRows, grown: true, fillRatio: t.fillRatio, foliageScale: t.foliageScale }
    }
    const milestoneY = yBottom - SKELETON_BAND / 2
    yBottom -= SKELETON_BAND
    return { level: t.level, state: t.state, milestoneY, branchRows: [], grown: false, fillRatio: t.fillRatio, foliageScale: t.foliageScale }
  })

  const topY = yBottom
  const goalLabel = levels.length > 0 ? levels[levels.length - 1] : ''
  const goalReached = built.length > 0 && built[built.length - 1].state === 'passed'
  const hasGrown = built.some((t) => t.grown)
  return { tiers, groundY, topY, grownTopY, height, cx, goalLabel, goalReached, hasGrown }
}

// The "recommended next" lesson = the first AVAILABLE node in CEFR-then-day
// order. Lower levels are fully COMPLETED so their nodes are never AVAILABLE,
// which means the first AVAILABLE node always lands in the current (in_progress)
// tier — the design's pass-2 result without needing the design-only `chosenByUser`
// field (spec H2). Returns null when nothing is unlocked-not-started.
export function recommendedNodeId(nodes: SkillNode[]): number | null {
  let best: SkillNode | null = null
  for (const n of nodes) {
    if (n.status !== 'AVAILABLE') continue
    if (
      best === null ||
      cefrRank(n.cefrLevel) < cefrRank(best.cefrLevel) ||
      (cefrRank(n.cefrLevel) === cefrRank(best.cefrLevel) && n.dayNumber < best.dayNumber)
    ) {
      best = n
    }
  }
  return best ? best.id : null
}

// The lesson to recentre on for "Về bài đang học". Prefer the IN_PROGRESS lesson the
// learner is actively studying (CEFR-then-day order) — the ordinary frontier once a lesson
// is opened and its successor is still locked, i.e. exactly when NO node is AVAILABLE and
// recommendedNodeId returns null. Fall back to the recommended next-to-start node otherwise.
// recommendedNodeId is left AVAILABLE-only so the "next" ring/companion keep their meaning.
export function focusTargetId(nodes: SkillNode[]): number | null {
  let best: SkillNode | null = null
  for (const n of nodes) {
    if (n.status !== 'IN_PROGRESS') continue
    if (
      best === null ||
      cefrRank(n.cefrLevel) < cefrRank(best.cefrLevel) ||
      (cefrRank(n.cefrLevel) === cefrRank(best.cefrLevel) && n.dayNumber < best.dayNumber)
    ) {
      best = n
    }
  }
  return best ? best.id : recommendedNodeId(nodes)
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
