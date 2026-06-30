import { buildTreeLayout, trunkPath } from '@/components/skill-tree/layout'
import type { SkillNode } from '@/lib/skillTreeApi'

function node(id: number, cefr: string, status: SkillNode['status'], day = id): SkillNode {
  return {
    id,
    title: `Node ${id}`,
    cefrLevel: cefr,
    status,
    dayNumber: day,
    sortOrder: day,
    tags: [],
    phase: null,
    industry: null,
    moduleTitle: null,
    sessionType: null,
    emoji: null,
    coreTopics: [],
    grammarPoints: [],
    prerequisites: [],
    dependenciesMet: false,
  }
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
    const { tiers } = buildTreeLayout(sample, 360)
    const byLevel = Object.fromEntries(tiers.map((t) => [t.level, t.milestoneY]))
    expect(byLevel.A1).toBeGreaterThan(byLevel.A2)
    expect(byLevel.A2).toBeGreaterThan(byLevel.B1)
  })

  test('tiers are ordered A1 → A2 → B1', () => {
    const { tiers } = buildTreeLayout(sample, 360)
    expect(tiers.map((t) => t.level)).toEqual(['A1', 'A2', 'B1'])
  })

  test('the lowest level sits just above the ground, the crown above the top', () => {
    const { tiers, groundY, topY, height } = buildTreeLayout(sample, 360)
    const lowest = tiers[0].milestoneY
    expect(lowest).toBeLessThan(groundY)
    expect(groundY).toBeLessThan(height)
    // top tier's branch rows must clear the crown anchor
    expect(topY).toBeLessThan(tiers[tiers.length - 1].milestoneY)
  })

  test('goal label is the highest CEFR level present', () => {
    expect(buildTreeLayout(sample, 360).goalLabel).toBe('B1')
  })
})

describe('buildTreeLayout — milestone state (3 computable states, H4)', () => {
  test('all-completed → passed, mixed/unlocked → in_progress, all-locked → locked', () => {
    const { tiers } = buildTreeLayout(sample, 360)
    const byLevel = Object.fromEntries(tiers.map((t) => [t.level, t.state]))
    expect(byLevel.A1).toBe('passed')
    expect(byLevel.A2).toBe('in_progress')
    expect(byLevel.B1).toBe('locked')
  })

  test('AVAILABLE alone makes a level in_progress (depends on C1 UNLOCKED→AVAILABLE)', () => {
    const { tiers } = buildTreeLayout([node(1, 'A1', 'AVAILABLE')], 360)
    expect(tiers[0].state).toBe('in_progress')
  })
})

describe('buildTreeLayout — running-sum heights (H1)', () => {
  test('a level with more lessons occupies more vertical space', () => {
    const few = buildTreeLayout([node(1, 'A1', 'AVAILABLE')], 360)
    const many = buildTreeLayout(
      Array.from({ length: 9 }, (_, i) => node(i + 1, 'A1', 'AVAILABLE')),
      360,
    )
    expect(many.height).toBeGreaterThan(few.height)
  })
})

describe('buildTreeLayout — growth model (mọc từ mầm)', () => {
  test('reached levels grow with branches; fully-locked levels become a faint skeleton (no branches)', () => {
    const byLevel = Object.fromEntries(buildTreeLayout(sample, 360).tiers.map((t) => [t.level, t]))
    expect(byLevel.A1.grown).toBe(true)
    expect(byLevel.A2.grown).toBe(true)
    expect(byLevel.B1.grown).toBe(false)
    expect(byLevel.B1.branchRows).toHaveLength(0)
    expect(byLevel.A2.branchRows.length).toBeGreaterThan(0)
  })

  test('fillRatio = completed / total per level', () => {
    const byLevel = Object.fromEntries(buildTreeLayout(sample, 360).tiers.map((t) => [t.level, t]))
    expect(byLevel.A1.fillRatio).toBe(1) // 2/2 completed
    expect(byLevel.A2.fillRatio).toBe(0) // 0/2 completed
  })

  test('foliageScale: passed lush (1), future none (0), current floored (0..1) at 0%', () => {
    const byLevel = Object.fromEntries(buildTreeLayout(sample, 360).tiers.map((t) => [t.level, t]))
    expect(byLevel.A1.foliageScale).toBe(1)
    expect(byLevel.B1.foliageScale).toBe(0)
    expect(byLevel.A2.foliageScale).toBeGreaterThan(0)
    expect(byLevel.A2.foliageScale).toBeLessThan(1)
  })

  test('current-level foliage fills in as lessons complete (floor → 1)', () => {
    const zero = buildTreeLayout([node(1, 'A1', 'IN_PROGRESS'), node(2, 'A1', 'AVAILABLE')], 360).tiers[0]
    const half = buildTreeLayout([node(1, 'A1', 'COMPLETED'), node(2, 'A1', 'IN_PROGRESS')], 360).tiers[0]
    expect(half.state).toBe('in_progress')
    expect(half.fillRatio).toBe(0.5)
    expect(half.foliageScale).toBeGreaterThan(zero.foliageScale)
    expect(half.foliageScale).toBeLessThan(1)
  })

  test('grownTopY = living trunk top: above ground, below the full top when a skeleton exists', () => {
    const { grownTopY, groundY, topY, tiers } = buildTreeLayout(sample, 360)
    expect(grownTopY).toBeLessThan(groundY) // grew up from the ground
    expect(grownTopY).toBeGreaterThan(topY) // faint skeleton (B1) sits above the living top
    const a2 = tiers.find((t) => t.level === 'A2')!
    expect(grownTopY).toBeLessThan(a2.milestoneY)
  })

  test('no skeleton when every level is reached: grownTopY === topY', () => {
    const all = buildTreeLayout(
      [node(1, 'A1', 'COMPLETED'), node(2, 'A2', 'COMPLETED'), node(3, 'B1', 'IN_PROGRESS')],
      360,
    )
    expect(all.grownTopY).toBe(all.topY)
  })

  test('goalReached only when the highest level is fully passed', () => {
    expect(buildTreeLayout(sample, 360).goalReached).toBe(false) // B1 locked
    expect(buildTreeLayout([node(1, 'A1', 'COMPLETED'), node(2, 'A2', 'COMPLETED')], 360).goalReached).toBe(true)
  })

  test('a future (skeleton) level is more compact than the same level grown', () => {
    const locked = buildTreeLayout([node(1, 'A1', 'IN_PROGRESS'), node(2, 'B1', 'LOCKED')], 360)
    const reached = buildTreeLayout([node(1, 'A1', 'IN_PROGRESS'), node(2, 'B1', 'AVAILABLE')], 360)
    expect(reached.height).toBeGreaterThan(locked.height)
  })

  test('cold-start (every level locked) → nothing grown: hasGrown false, grownTopY === groundY', () => {
    const cold = buildTreeLayout([node(1, 'A1', 'LOCKED'), node(2, 'A2', 'LOCKED')], 360)
    expect(cold.hasGrown).toBe(false)
    expect(cold.grownTopY).toBe(cold.groundY) // renderer suppresses the living trunk here
    expect(cold.tiers.every((t) => !t.grown)).toBe(true)
    expect(buildTreeLayout(sample, 360).hasGrown).toBe(true)
  })

  test('current-level foliageScale at 0% equals the floor exactly (0.25)', () => {
    const zero = buildTreeLayout([node(1, 'A1', 'IN_PROGRESS'), node(2, 'A1', 'AVAILABLE')], 360).tiers[0]
    expect(zero.fillRatio).toBe(0)
    expect(zero.foliageScale).toBeCloseTo(0.25, 5)
  })
})

describe('trunkPath', () => {
  test('produces a closed SVG path', () => {
    const d = trunkPath(180, 1000, 200)
    expect(d.startsWith('M ')).toBe(true)
    expect(d.trimEnd().endsWith('Z')).toBe(true)
  })
})
