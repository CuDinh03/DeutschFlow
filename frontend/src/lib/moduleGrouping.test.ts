import { describe, it, expect } from 'vitest'
import { groupLessonsByModule, swapInOrder } from './moduleGrouping'

const L = (id: number, orderIndex: number, moduleId: number | null) => ({ id, orderIndex, moduleId })
const M = (id: number, orderIndex: number, title: string) => ({ id, orderIndex, title })

describe('groupLessonsByModule', () => {
  it('groups lessons under their module in module + lesson order', () => {
    const modules = [M(2, 1, 'Modul B'), M(1, 0, 'Modul A')]
    const lessons = [L(30, 2, 1), L(10, 0, 1), L(20, 1, 2)]
    const groups = groupLessonsByModule(lessons, modules)

    expect(groups.map((g) => g.module?.title)).toEqual(['Modul A', 'Modul B'])
    expect(groups[0].lessons.map((l) => l.id)).toEqual([10, 30]) // module A, by orderIndex
    expect(groups[1].lessons.map((l) => l.id)).toEqual([20])
  })

  it('puts null-module lessons into a trailing ungrouped group', () => {
    const groups = groupLessonsByModule([L(1, 0, null), L(2, 1, 5)], [M(5, 0, 'M')])
    expect(groups).toHaveLength(2)
    expect(groups[0].module?.id).toBe(5)
    expect(groups[groups.length - 1].module).toBeNull()
    expect(groups[groups.length - 1].lessons.map((l) => l.id)).toEqual([1])
  })

  it('treats a lesson referencing a missing module as ungrouped', () => {
    const groups = groupLessonsByModule([L(1, 0, 999)], [M(5, 0, 'M')])
    // module M is empty; the orphan lesson lands in the ungrouped bucket
    expect(groups.find((g) => g.module?.id === 5)?.lessons).toEqual([])
    expect(groups.find((g) => g.module === null)?.lessons.map((l) => l.id)).toEqual([1])
  })

  it('returns only the ungrouped group when there are no modules', () => {
    const groups = groupLessonsByModule([L(1, 0, null), L(2, 1, null)], [])
    expect(groups).toHaveLength(1)
    expect(groups[0].module).toBeNull()
    expect(groups[0].lessons.map((l) => l.id)).toEqual([1, 2])
  })

  it('keeps an empty module (no lessons) in the result', () => {
    const groups = groupLessonsByModule([], [M(5, 0, 'Empty')])
    expect(groups).toHaveLength(1)
    expect(groups[0].module?.id).toBe(5)
    expect(groups[0].lessons).toEqual([])
  })
})

describe('swapInOrder', () => {
  it('swaps two flat-adjacent lessons', () => {
    const ordered = [L(10, 0, 1), L(20, 1, 1), L(30, 2, 1)]
    const next = swapInOrder(ordered, 10, 20)
    expect(next?.map((l) => l.id)).toEqual([20, 10, 30])
  })

  it('swaps two flat-NON-adjacent lessons without disturbing the lesson between them', () => {
    // L10 and L30 belong to module A; L20 (module B) sits between them in flat order.
    const ordered = [L(10, 0, 1), L(20, 1, 2), L(30, 2, 1)]
    const next = swapInOrder(ordered, 10, 30)
    // Only 10 and 30 swap positions; 20 keeps its slot.
    expect(next?.map((l) => l.id)).toEqual([30, 20, 10])
  })

  it('returns null for a missing id or a self-swap', () => {
    const ordered = [L(10, 0, 1), L(20, 1, 1)]
    expect(swapInOrder(ordered, 10, 999)).toBeNull()
    expect(swapInOrder(ordered, 10, 10)).toBeNull()
  })

  it('moves a lesson down within its module even when its module is non-contiguous in flat order', () => {
    // Regression for the grouped-reorder bug: L1,L3,L5 → module A; L2,L4,L6 → module B.
    const modules = [M(1, 0, 'A'), M(2, 1, 'B')]
    const lessons = [L(1, 0, 1), L(2, 1, 2), L(3, 2, 1), L(4, 3, 2), L(5, 4, 1), L(6, 5, 2)]
    expect(groupLessonsByModule(lessons, modules)[0].lessons.map((l) => l.id)).toEqual([1, 3, 5])

    // Move L1 DOWN within module A → swap with its group-next sibling L3 (flat-non-adjacent).
    const groupA = groupLessonsByModule(lessons, modules)[0]
    const swapped = swapInOrder(
      [...lessons].sort((a, b) => a.orderIndex - b.orderIndex),
      groupA.lessons[0].id,
      groupA.lessons[1].id,
    )!
    const reindexed = swapped.map((l, idx) => ({ ...l, orderIndex: idx }))
    const regrouped = groupLessonsByModule(reindexed, modules)
    // A single swap produces one visible move within the module — L1 now sits below L3.
    expect(regrouped[0].lessons.map((l) => l.id)).toEqual([3, 1, 5])
    // Module B is untouched.
    expect(regrouped[1].lessons.map((l) => l.id)).toEqual([2, 4, 6])
  })
})
