import { findNextNode } from '@/lib/nextNode'
import type { SkillNode } from '@/lib/skillTreeApi'

// findNextNode only reads id + status; build minimal rows.
type Row = Pick<SkillNode, 'id' | 'status'>
const n = (id: number, status: SkillNode['status']): Row => ({ id, status })

describe('findNextNode — post-lesson "Bài tiếp theo" target', () => {
  test('prefers an IN_PROGRESS node over an AVAILABLE one', () => {
    const nodes = [n(1, 'COMPLETED'), n(2, 'AVAILABLE'), n(3, 'IN_PROGRESS')]
    expect(findNextNode(nodes)?.id).toBe(3)
  })

  test('returns the first AVAILABLE node when none are in progress (nodes pre-sorted by day)', () => {
    const nodes = [n(1, 'COMPLETED'), n(2, 'AVAILABLE'), n(3, 'AVAILABLE')]
    expect(findNextNode(nodes)?.id).toBe(2)
  })

  test('excludes the just-finished node so it never points back at it', () => {
    // Node 2 just completed but the cache may still show it AVAILABLE before the refetch settles.
    const nodes = [n(1, 'COMPLETED'), n(2, 'AVAILABLE'), n(3, 'AVAILABLE')]
    expect(findNextNode(nodes, 2)?.id).toBe(3)
  })

  test('skips an excluded IN_PROGRESS node and returns the next candidate', () => {
    const nodes = [n(2, 'IN_PROGRESS'), n(3, 'AVAILABLE')]
    expect(findNextNode(nodes, 2)?.id).toBe(3)
  })

  test('returns undefined at the end of the unlocked path (only LOCKED/COMPLETED left)', () => {
    const nodes = [n(1, 'COMPLETED'), n(2, 'COMPLETED'), n(3, 'LOCKED')]
    expect(findNextNode(nodes, 2)).toBeUndefined()
  })

  test('returns undefined for an empty tree', () => {
    expect(findNextNode([])).toBeUndefined()
  })
})
