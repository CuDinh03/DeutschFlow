import { levelStateOf, levelsFromTree } from '@/lib/levelState'
import type { SkillNode } from '@/lib/skillTreeApi'

type StatusRow = Pick<SkillNode, 'status'>
const s = (status: SkillNode['status']): StatusRow => ({ status })

type LevelRow = Pick<SkillNode, 'status' | 'cefrLevel'>
const n = (cefrLevel: string, status: SkillNode['status']): LevelRow => ({ cefrLevel, status })

describe('levelStateOf', () => {
  test("'current' when any node is in progress or available to start", () => {
    expect(levelStateOf([s('COMPLETED'), s('IN_PROGRESS')])).toBe('current')
    expect(levelStateOf([s('COMPLETED'), s('AVAILABLE'), s('LOCKED')])).toBe('current')
  })

  test("'done' when every node is completed", () => {
    expect(levelStateOf([s('COMPLETED'), s('COMPLETED')])).toBe('done')
  })

  test("'locked' when all nodes are locked", () => {
    expect(levelStateOf([s('LOCKED'), s('LOCKED')])).toBe('locked')
  })

  test("empty → 'locked'", () => {
    expect(levelStateOf([])).toBe('locked')
  })
})

describe('levelsFromTree', () => {
  test('groups by CEFR level in canonical order with per-level state', () => {
    const nodes = [
      n('A1', 'COMPLETED'),
      n('A1', 'COMPLETED'),
      n('A2', 'IN_PROGRESS'),
      n('B1', 'LOCKED'),
    ]
    expect(levelsFromTree(nodes)).toEqual([
      { level: 'A1', state: 'done' },
      { level: 'A2', state: 'current' },
      { level: 'B1', state: 'locked' },
    ])
  })

  test('orders levels A1 < A2 < B1 < B2 regardless of node order', () => {
    const nodes = [n('B2', 'LOCKED'), n('A1', 'AVAILABLE'), n('B1', 'LOCKED'), n('A2', 'LOCKED')]
    expect(levelsFromTree(nodes).map((l) => l.level)).toEqual(['A1', 'A2', 'B1', 'B2'])
  })

  test('skips nodes with an empty cefrLevel and sorts unknown levels last', () => {
    const nodes = [n('', 'AVAILABLE'), n('Z9', 'AVAILABLE'), n('A1', 'AVAILABLE')]
    expect(levelsFromTree(nodes).map((l) => l.level)).toEqual(['A1', 'Z9'])
  })

  test('empty tree → no levels', () => {
    expect(levelsFromTree([])).toEqual([])
  })
})
