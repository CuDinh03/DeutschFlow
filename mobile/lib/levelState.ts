import type { SkillNode } from './skillTreeApi'

export type LevelState = 'done' | 'current' | 'locked'

// CEFR ordering for sorting levels a learner's tree spans. Unknown levels sort last.
const CEFR_ORDER = ['A0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2']

// A CEFR level's unlock state, derived from its skill-tree nodes — mirrors the backend's
// TreeLevelDto.status without a separate /roadmap/tree fetch, reusing the already-cached
// ['skill-tree'] data. 'current' = has an unlocked node (in progress or available to start);
// 'done' = every node completed; 'locked' = all nodes still locked.
export function levelStateOf(nodes: Pick<SkillNode, 'status'>[]): LevelState {
  if (nodes.some((n) => n.status === 'IN_PROGRESS' || n.status === 'AVAILABLE')) return 'current'
  if (nodes.length > 0 && nodes.every((n) => n.status === 'COMPLETED')) return 'done'
  return 'locked'
}

export interface CefrLevelState {
  level: string
  state: LevelState
}

// The distinct CEFR levels the tree spans, in canonical order, each with its unlock state.
// Drives the grammar screen's per-level gating (locked levels shown dimmed, "Mở khi đạt …").
export function levelsFromTree(nodes: Pick<SkillNode, 'status' | 'cefrLevel'>[]): CefrLevelState[] {
  const byLevel = new Map<string, Pick<SkillNode, 'status'>[]>()
  for (const n of nodes) {
    const key = n.cefrLevel
    if (!key) continue
    const list = byLevel.get(key)
    if (list) list.push(n)
    else byLevel.set(key, [n])
  }
  const rank = (l: string) => {
    const i = CEFR_ORDER.indexOf(l)
    return i === -1 ? CEFR_ORDER.length : i
  }
  return [...byLevel.keys()]
    .sort((a, b) => rank(a) - rank(b))
    .map((level) => ({ level, state: levelStateOf(byLevel.get(level) ?? []) }))
}
