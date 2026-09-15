// Hình học thuần của màn Lernweg: từ danh sách phẳng `RoadmapNode[]` (GET /roadmap/me)
// dựng cây level → tuần → lá(bài). Tách khỏi screen để test được — quyết định
// "level nào đang học, lá nào chạm được" không sống trong JSX. Gương cách web gom
// tuần trong `frontend/src/lib/roadmap-tree/treeLayout.ts` (weekNumber → dayNumber
// → thứ tự), để hai nền tảng chia cùng một cây.

import type { RoadmapNode } from './lernwegApi'

export type LeafState = 'completed' | 'in_progress' | 'available' | 'locked'
export type BranchStatus = 'matured' | 'growing' | 'locked'
export type LevelStatus = 'completed' | 'current' | 'locked'

export interface LernwegLeaf {
  /** id SỐ của node — truyền thẳng cho node.tsx / skill-practice. */
  id: number
  code: string
  /** Tiêu đề hiển thị (tiếng Việt, rơi về tiếng Đức nếu thiếu). */
  title: string
  /** Tiêu đề tiếng Đức (phụ). */
  titleDe: string
  emoji: string
  day: number | null
  state: LeafState
  xpReward: number
  lessonsTotal: number
  lessonsCompleted: number
  skillCounts: Record<string, number>
  description: string | null
}

export interface LernwegBranch {
  key: string
  /** "Tuần 2" */
  label: string
  /** "Ngày 8–14" hoặc "5 bài" khi không có trục ngày. */
  sublabel: string
  status: BranchStatus
  leaves: LernwegLeaf[]
}

export interface LernwegLevel {
  level: string
  status: LevelStatus
  done: number
  total: number
  /** Điều kiện mở với level khoá — "Hoàn thành A1"; null nếu không suy ra được. */
  unlocksWhen: string | null
  branches: LernwegBranch[]
}

export interface LernwegTree {
  levels: LernwegLevel[]
  done: number
  total: number
  /** Level đang học (status=current); không có thì level cuối đã xong; rỗng → null. */
  currentLevel: string | null
}

const CEFR_ORDER = ['A0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2']
/** Web (treeLayout.ts) dùng 5 node/tuần khi thiếu cả weekNumber lẫn dayNumber. */
const NODES_PER_WEEK_FALLBACK = 5

const SKILL_LABELS: Record<string, string> = {
  HOEREN: 'Nghe',
  HÖREN: 'Nghe',
  LESEN: 'Đọc',
  SPRECHEN: 'Nói',
  SCHREIBEN: 'Viết',
  WORTSCHATZ: 'Từ vựng',
  GRAMMATIK: 'Ngữ pháp',
}

function cefrRank(level: string): number {
  const i = CEFR_ORDER.indexOf(level)
  return i === -1 ? CEFR_ORDER.length : i
}

/** Nhãn tiếng Việt của mã kỹ năng backend (HOEREN → Nghe); mã lạ trả nguyên. */
export function skillLabel(code: string): string {
  return SKILL_LABELS[code.toUpperCase()] ?? code
}

/** Tiêu đề hiển thị: DTO trả title = tiếng Đức, subtitle = tiếng Việt; app tiếng Việt ưu tiên subtitle. */
export function nodeDisplayTitle(node: Pick<RoadmapNode, 'title' | 'subtitle'>): string {
  return (node.subtitle || node.title || '').trim()
}

/**
 * Trạng thái lá. Ưu tiên `progressStatus` (4 mức, backend đã chuẩn hoá UNLOCKED → AVAILABLE);
 * thiếu thì suy từ `state` 3 mức (current → available). Giá trị lạ → locked (an toàn: không mở
 * nhầm bài chưa được phép).
 */
export function leafStateOf(node: Pick<RoadmapNode, 'state' | 'progressStatus'>): LeafState {
  switch ((node.progressStatus ?? '').toUpperCase()) {
    case 'COMPLETED':
      return 'completed'
    case 'IN_PROGRESS':
      return 'in_progress'
    case 'AVAILABLE':
    case 'UNLOCKED':
      return 'available'
    case 'LOCKED':
      return 'locked'
  }
  switch ((node.state ?? '').toLowerCase()) {
    case 'completed':
      return 'completed'
    case 'current':
      return 'available'
    default:
      return 'locked'
  }
}

/** Tuần của node: weekNumber → suy từ dayNumber → thứ tự trong level (mỗi tuần 5 node), luôn ra số. */
export function weekOf(node: Pick<RoadmapNode, 'weekNumber' | 'dayNumber'>, indexInLevel: number): number {
  if (node.weekNumber != null && node.weekNumber > 0) return node.weekNumber
  if (node.dayNumber != null && node.dayNumber > 0) return Math.ceil(node.dayNumber / 7)
  return Math.floor(indexInLevel / NODES_PER_WEEK_FALLBACK) + 1
}

function branchStatusOf(leaves: LernwegLeaf[]): BranchStatus {
  if (leaves.length > 0 && leaves.every((l) => l.state === 'completed')) return 'matured'
  if (leaves.some((l) => l.state !== 'locked')) return 'growing'
  return 'locked'
}

function levelStatusOf(leaves: LernwegLeaf[]): LevelStatus {
  if (leaves.length > 0 && leaves.every((l) => l.state === 'completed')) return 'completed'
  if (leaves.some((l) => l.state !== 'locked')) return 'current'
  return 'locked'
}

function toLeaf(node: RoadmapNode): LernwegLeaf {
  return {
    id: node.id,
    code: node.code,
    title: nodeDisplayTitle(node),
    titleDe: (node.title ?? '').trim(),
    emoji: node.emoji ?? '',
    day: node.dayNumber != null && node.dayNumber > 0 ? node.dayNumber : null,
    state: leafStateOf(node),
    xpReward: node.xpReward ?? 0,
    lessonsTotal: node.lessonsTotal ?? 0,
    lessonsCompleted: node.lessonsCompleted ?? 0,
    skillCounts: node.skillCounts ?? {},
    description: node.description ?? null,
  }
}

/** Sắp xếp ổn định: level (CEFR) → ngày (null cuối) → orderIndex (null cuối) → id. */
function sortNodes(nodes: readonly RoadmapNode[]): RoadmapNode[] {
  const last = Number.MAX_SAFE_INTEGER
  return [...nodes].sort(
    (a, b) =>
      cefrRank(a.cefrLevel) - cefrRank(b.cefrLevel) ||
      (a.dayNumber ?? last) - (b.dayNumber ?? last) ||
      (a.orderIndex ?? last) - (b.orderIndex ?? last) ||
      a.id - b.id,
  )
}

function dayRangeLabel(leaves: LernwegLeaf[]): string {
  const days = leaves.map((l) => l.day).filter((d): d is number => d != null)
  if (days.length === 0) return `${leaves.length} bài`
  const lo = Math.min(...days)
  const hi = Math.max(...days)
  return lo === hi ? `Ngày ${lo}` : `Ngày ${lo}–${hi}`
}

/** Dựng cây Lernweg từ danh sách phẳng. Danh sách rỗng → cây rỗng (levels [], total 0). */
export function buildLernwegTree(nodes: readonly RoadmapNode[]): LernwegTree {
  const sorted = sortNodes(nodes)
  const byLevel = new Map<string, RoadmapNode[]>()
  for (const n of sorted) {
    const key = (n.cefrLevel ?? '').trim() || '—'
    const list = byLevel.get(key)
    if (list) list.push(n)
    else byLevel.set(key, [n])
  }

  const levels: LernwegLevel[] = []
  let prevLevel: string | null = null
  for (const [level, levelNodes] of byLevel) {
    const byWeek = new Map<number, LernwegLeaf[]>()
    levelNodes.forEach((n, i) => {
      const w = weekOf(n, i)
      const list = byWeek.get(w)
      const leaf = toLeaf(n)
      if (list) list.push(leaf)
      else byWeek.set(w, [leaf])
    })
    const branches: LernwegBranch[] = [...byWeek.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([week, leaves]) => ({
        key: `${level}-w${week}`,
        label: `Tuần ${week}`,
        sublabel: dayRangeLabel(leaves),
        status: branchStatusOf(leaves),
        leaves,
      }))
    const leaves = branches.flatMap((b) => b.leaves)
    const status = levelStatusOf(leaves)
    levels.push({
      level,
      status,
      done: leaves.filter((l) => l.state === 'completed').length,
      total: leaves.length,
      unlocksWhen: status === 'locked' && prevLevel ? `Hoàn thành ${prevLevel}` : null,
      branches,
    })
    prevLevel = level
  }

  const done = levels.reduce((s, l) => s + l.done, 0)
  const total = levels.reduce((s, l) => s + l.total, 0)
  const current = levels.find((l) => l.status === 'current')
  const lastCompleted = [...levels].reverse().find((l) => l.status === 'completed')
  return {
    levels,
    done,
    total,
    currentLevel: current?.level ?? lastCompleted?.level ?? levels[0]?.level ?? null,
  }
}
