import type { SkillNode } from './skillTreeApi'

// Picks the node to advance to after finishing a lesson, for the post-completion
// "Bài tiếp theo" action. Prefer an in-progress node, then the first available
// (unlocked-not-started) one; nodes are pre-sorted by day_number ASC (backend), so
// the first match is the earliest. `excludeId` drops the just-finished node so we
// never point back at it. Returns undefined when nothing is left to start (end of the
// unlocked path) → the caller hides the "next" button and only offers "Về lộ trình".
//
// Kept generic over the node shape so it stays pure and unit-testable with minimal
// fixtures ({ id, status }), while returning the caller's full SkillNode when given one.
export function findNextNode<T extends Pick<SkillNode, 'id' | 'status'>>(
  nodes: T[],
  excludeId?: number,
): T | undefined {
  const candidates = excludeId == null ? nodes : nodes.filter((n) => n.id !== excludeId)
  return (
    candidates.find((n) => n.status === 'IN_PROGRESS') ??
    candidates.find((n) => n.status === 'AVAILABLE')
  )
}
