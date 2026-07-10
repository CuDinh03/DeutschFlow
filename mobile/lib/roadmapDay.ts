import type { SkillNode } from './skillTreeApi'

// The "next study day" shown on Home's roadmap tile ("Ngày N").
//
// Bug it fixes: the tile used `inProgress[0]?.dayNumber ?? 1`, so the moment a node
// was completed (backend never auto-sets the next node to IN_PROGRESS — it derives
// it as UNLOCKED/AVAILABLE at read time) the in-progress list emptied and the tile
// snapped back to "Ngày 1", contradicting the rising progress bar.
//
// Fallback order (owner-decided): first IN_PROGRESS → first AVAILABLE → max(COMPLETED)+1 → 1.
// Nodes arrive already sorted by day_number ASC (backend), so the first match in each
// pass is the earliest. `dayNumber` is 0 when the backend row has no day set
// (mapSkillNode default) — treat 0 as absent so it never surfaces as "Ngày 0".
export function nextStudyDay(nodes: Pick<SkillNode, 'status' | 'dayNumber'>[]): number {
  const firstInProgress = nodes.find((n) => n.status === 'IN_PROGRESS' && n.dayNumber > 0)
  if (firstInProgress) return firstInProgress.dayNumber

  const firstAvailable = nodes.find((n) => n.status === 'AVAILABLE' && n.dayNumber > 0)
  if (firstAvailable) return firstAvailable.dayNumber

  const maxCompleted = nodes.reduce(
    (max, n) => (n.status === 'COMPLETED' && n.dayNumber > max ? n.dayNumber : max),
    0,
  )
  return maxCompleted > 0 ? maxCompleted + 1 : 1
}
