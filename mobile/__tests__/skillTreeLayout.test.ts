import { buildTreeLayout, trunkPath } from '@/components/skill-tree/layout'
import type { SkillNode } from '@/lib/skillTreeApi'

const FOLIAGE = ['#a', '#b', '#c'] as const

function node(id: number, cefr: string, status: SkillNode['status'], day = id): SkillNode {
  return { id, title: `Node ${id}`, cefrLevel: cefr, status, dayNumber: day, tags: [] }
}

// A1 (all done), A2 (in progress), B1 (locked).
const sample: SkillNode[] = [
  node(1, 'A1', 'COMPLETED'),
  node(2, 'A1', 'COMPLETED'),
  node(3, 'A2', 'IN_PROGRESS'),
  node(4, 'A2', 'AVAILABLE'),
  node(5, 'B1', 'LOCKED'),
]

describe('buildTreeLayout — bottom-up orientation (Pha 1)', () => {
  test('lower CEFR levels sit lower on the canvas (larger y) than higher ones', () => {
    const { tiers } = buildTreeLayout(sample, 360, FOLIAGE)
    const byLevel = Object.fromEntries(tiers.map((t) => [t.level, t.milestoneY]))
    expect(byLevel.A1).toBeGreaterThan(byLevel.A2)
    expect(byLevel.A2).toBeGreaterThan(byLevel.B1)
  })

  test('tiers are ordered A1 → A2 → B1', () => {
    const { tiers } = buildTreeLayout(sample, 360, FOLIAGE)
    expect(tiers.map((t) => t.level)).toEqual(['A1', 'A2', 'B1'])
  })

  test('the lowest level sits just above the ground, the crown above the top', () => {
    const { tiers, groundY, topY, height } = buildTreeLayout(sample, 360, FOLIAGE)
    const lowest = tiers[0].milestoneY
    expect(lowest).toBeLessThan(groundY)
    expect(groundY).toBeLessThan(height)
    // top tier's branch rows must clear the crown anchor
    expect(topY).toBeLessThan(tiers[tiers.length - 1].milestoneY)
  })

  test('goal label is the highest CEFR level present', () => {
    expect(buildTreeLayout(sample, 360, FOLIAGE).goalLabel).toBe('B1')
  })
})

describe('buildTreeLayout — milestone state (3 computable states, H4)', () => {
  test('all-completed → passed, mixed/unlocked → in_progress, all-locked → locked', () => {
    const { tiers } = buildTreeLayout(sample, 360, FOLIAGE)
    const byLevel = Object.fromEntries(tiers.map((t) => [t.level, t.state]))
    expect(byLevel.A1).toBe('passed')
    expect(byLevel.A2).toBe('in_progress')
    expect(byLevel.B1).toBe('locked')
  })

  test('AVAILABLE alone makes a level in_progress (depends on C1 UNLOCKED→AVAILABLE)', () => {
    const { tiers } = buildTreeLayout([node(1, 'A1', 'AVAILABLE')], 360, FOLIAGE)
    expect(tiers[0].state).toBe('in_progress')
  })
})

describe('buildTreeLayout — running-sum heights (H1)', () => {
  test('a level with more lessons occupies more vertical space', () => {
    const few = buildTreeLayout([node(1, 'A1', 'AVAILABLE')], 360, FOLIAGE)
    const many = buildTreeLayout(
      Array.from({ length: 9 }, (_, i) => node(i + 1, 'A1', 'AVAILABLE')),
      360,
      FOLIAGE,
    )
    expect(many.height).toBeGreaterThan(few.height)
  })
})

describe('trunkPath', () => {
  test('produces a closed SVG path', () => {
    const d = trunkPath(180, 1000, 200)
    expect(d.startsWith('M ')).toBe(true)
    expect(d.trimEnd().endsWith('Z')).toBe(true)
  })
})
