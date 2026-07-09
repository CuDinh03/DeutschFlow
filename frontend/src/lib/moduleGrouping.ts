// Group a class's lessons by curriculum module (Phase 1c). Pure + unit-testable; shared by
// the teacher editor/dashboard and the student views.

export interface LessonModuleGroup<L> {
  /** null = the trailing "ungrouped" bucket (lessons with no/unknown module). */
  module: { id: number; title: string } | null
  lessons: L[]
}

interface ModuleLike {
  id: number
  title: string
  orderIndex: number
}

/**
 * Modules in order_index order, each with its lessons (in orderIndex order). Lessons whose
 * moduleId is null or references a missing module fall into a trailing null group (only added
 * when non-empty). Empty modules are kept (callers that render a lesson list can filter them).
 */
export function groupLessonsByModule<L extends { moduleId: number | null; orderIndex: number }>(
  lessons: L[],
  modules: ModuleLike[],
): LessonModuleGroup<L>[] {
  const sortedLessons = [...lessons].sort((a, b) => a.orderIndex - b.orderIndex)
  const sortedModules = [...modules].sort((a, b) => a.orderIndex - b.orderIndex)
  const known = new Set(sortedModules.map((m) => m.id))

  const groups: LessonModuleGroup<L>[] = sortedModules.map((m) => ({
    module: { id: m.id, title: m.title },
    lessons: sortedLessons.filter((l) => l.moduleId === m.id),
  }))

  const ungrouped = sortedLessons.filter((l) => l.moduleId == null || !known.has(l.moduleId))
  if (ungrouped.length > 0) groups.push({ module: null, lessons: ungrouped })
  return groups
}

/**
 * Swap two lessons (by id) in the flat orderIndex-sorted list and return the new order.
 * The list is rendered GROUPED by module, but orderIndex is a single global sequence — to move a
 * lesson within its module the two group-adjacent lessons may be flat-non-adjacent (other modules'
 * lessons sit between them in orderIndex). Swapping just those two array positions swaps their
 * orderIndex while leaving every other lesson untouched, so only their in-group order changes.
 * Returns null when either id is absent or the two ids are the same (no-op).
 */
export function swapInOrder<L extends { id: number }>(ordered: L[], aId: number, bId: number): L[] | null {
  if (aId === bId) return null
  const ia = ordered.findIndex((l) => l.id === aId)
  const ib = ordered.findIndex((l) => l.id === bId)
  if (ia < 0 || ib < 0) return null
  const next = [...ordered]
  ;[next[ia], next[ib]] = [next[ib], next[ia]]
  return next
}
