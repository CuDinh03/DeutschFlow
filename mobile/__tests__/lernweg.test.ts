// Khoá hợp đồng + hình học cụm Lernweg (đọc /roadmap/me từ 05/09, N1 plan nâng cấp mobile).

jest.mock('@/lib/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}))

import api from '@/lib/api'
import { lernwegApi, ROADMAP_ME_QUERY_KEY, type RoadmapNode } from '@/lib/lernwegApi'
import {
  buildLernwegTree,
  leafStateOf,
  nodeDisplayTitle,
  skillLabel,
  weekOf,
} from '@/lib/lernwegTree'

const get = api.get as unknown as jest.Mock

beforeEach(() => get.mockReset())

describe('lernwegApi — cùng nguồn với web và player mobile', () => {
  test('nodes() GET /roadmap/me (KHÔNG còn /roadmap/tree = cây demo)', async () => {
    get.mockResolvedValue({ data: [] })
    await lernwegApi.nodes()
    expect(get.mock.calls.map((c) => c[0])).toEqual(['/roadmap/me'])
    expect(ROADMAP_ME_QUERY_KEY).toEqual(['roadmap-me'])
  })
})

function node(over: Partial<RoadmapNode> & Pick<RoadmapNode, 'id' | 'cefrLevel'>): RoadmapNode {
  return {
    code: `N${over.id}`,
    title: `Tag ${over.id}`,
    subtitle: `Ngày ${over.id}`,
    emoji: '📘',
    state: 'locked',
    xpReward: 10,
    lessonsTotal: 4,
    lessonsCompleted: 0,
    category: null,
    description: null,
    prerequisiteCode: null,
    orderIndex: null,
    dayNumber: null,
    weekNumber: null,
    progressStatus: 'LOCKED',
    skillCounts: {},
    ...over,
  }
}

describe('leafStateOf — progressStatus trước, state 3 mức là dự phòng, lạ → locked', () => {
  test.each([
    ['COMPLETED', 'locked', 'completed'],
    ['IN_PROGRESS', 'locked', 'in_progress'],
    ['AVAILABLE', 'locked', 'available'],
    ['UNLOCKED', 'locked', 'available'],
    ['LOCKED', 'completed', 'locked'],
    [null, 'completed', 'completed'],
    [null, 'current', 'available'],
    [null, 'locked', 'locked'],
    ['WHATEVER', 'whatever', 'locked'],
  ])('progressStatus=%s state=%s → %s', (progressStatus, state, expected) => {
    expect(leafStateOf({ progressStatus, state })).toBe(expected)
  })
})

describe('weekOf — gương web treeLayout.weekOf', () => {
  test('weekNumber thắng; thiếu thì ceil(day/7); thiếu cả hai thì 5 node/tuần theo thứ tự', () => {
    expect(weekOf({ weekNumber: 3, dayNumber: 1 }, 0)).toBe(3)
    expect(weekOf({ weekNumber: null, dayNumber: 8 }, 0)).toBe(2)
    expect(weekOf({ weekNumber: null, dayNumber: 7 }, 0)).toBe(1)
    expect(weekOf({ weekNumber: null, dayNumber: null }, 4)).toBe(1)
    expect(weekOf({ weekNumber: null, dayNumber: null }, 5)).toBe(2)
  })
})

describe('buildLernwegTree', () => {
  const nodes: RoadmapNode[] = [
    // A2 chưa mở gì — cố tình đưa lên ĐẦU để kiểm sắp xếp theo CEFR
    node({ id: 31, cefrLevel: 'A2', dayNumber: 1, weekNumber: 1 }),
    // A1: tuần 1 xong hết, tuần 2 đang học; ngày trả lộn thứ tự
    node({ id: 3, cefrLevel: 'A1', dayNumber: 3, weekNumber: 1, progressStatus: 'COMPLETED', state: 'completed' }),
    node({ id: 1, cefrLevel: 'A1', dayNumber: 1, weekNumber: 1, progressStatus: 'COMPLETED', state: 'completed' }),
    node({ id: 2, cefrLevel: 'A1', dayNumber: 2, weekNumber: 1, progressStatus: 'COMPLETED', state: 'completed' }),
    node({ id: 8, cefrLevel: 'A1', dayNumber: 8, weekNumber: 2, progressStatus: 'IN_PROGRESS', state: 'current', skillCounts: { HOEREN: 3, LESEN: 2 } }),
    node({ id: 9, cefrLevel: 'A1', dayNumber: 9, weekNumber: 2, progressStatus: 'AVAILABLE', state: 'current' }),
    node({ id: 10, cefrLevel: 'A1', dayNumber: 10, weekNumber: 2 }),
    // A0 nền tảng đã xong, không có trục ngày
    node({ id: 100, cefrLevel: 'A0', progressStatus: 'COMPLETED', state: 'completed', orderIndex: 1 }),
  ]

  test('level theo thứ tự CEFR; trạng thái level + tuần + lá; đếm done/total', () => {
    const tree = buildLernwegTree(nodes)
    expect(tree.levels.map((l) => l.level)).toEqual(['A0', 'A1', 'A2'])
    expect(tree.levels.map((l) => l.status)).toEqual(['completed', 'current', 'locked'])
    expect(tree.currentLevel).toBe('A1')
    expect({ done: tree.done, total: tree.total }).toEqual({ done: 4, total: 8 })

    const a1 = tree.levels[1]
    expect({ done: a1.done, total: a1.total }).toEqual({ done: 3, total: 6 })
    expect(a1.branches.map((b) => [b.label, b.sublabel, b.status])).toEqual([
      ['Tuần 1', 'Ngày 1–3', 'matured'],
      ['Tuần 2', 'Ngày 8–10', 'growing'],
    ])
    // Lá trong tuần sắp theo ngày dù backend trả lộn
    expect(a1.branches[0].leaves.map((l) => l.id)).toEqual([1, 2, 3])
    expect(a1.branches[1].leaves.map((l) => l.state)).toEqual(['in_progress', 'available', 'locked'])
    // Lá mang id SỐ + tiêu đề tiếng Việt + kỹ năng để sheet mở node.tsx / skill-practice
    const leaf8 = a1.branches[1].leaves[0]
    expect(leaf8).toMatchObject({ id: 8, title: 'Ngày 8', titleDe: 'Tag 8', day: 8, skillCounts: { HOEREN: 3, LESEN: 2 } })
  })

  test('level khoá ghi điều kiện mở = hoàn thành level trước; level đầu khoá thì không', () => {
    const tree = buildLernwegTree(nodes)
    expect(tree.levels[2].unlocksWhen).toBe('Hoàn thành A1')
    const onlyLocked = buildLernwegTree([node({ id: 1, cefrLevel: 'B1' })])
    expect(onlyLocked.levels[0].unlocksWhen).toBeNull()
    expect(onlyLocked.levels[0].status).toBe('locked')
  })

  test('không có trục ngày → nhãn "N bài", gom 5 node/tuần', () => {
    const tree = buildLernwegTree([
      node({ id: 100, cefrLevel: 'A0', orderIndex: 1, progressStatus: 'COMPLETED' }),
      node({ id: 101, cefrLevel: 'A0', orderIndex: 2, progressStatus: 'AVAILABLE' }),
    ])
    expect(tree.levels[0].branches.map((b) => [b.label, b.sublabel])).toEqual([['Tuần 1', '2 bài']])
    expect(tree.levels[0].status).toBe('current')
  })

  test('rỗng → cây rỗng, không nổ; tất cả xong → currentLevel = level cuối đã xong', () => {
    expect(buildLernwegTree([])).toEqual({ levels: [], done: 0, total: 0, currentLevel: null })
    const allDone = buildLernwegTree([
      node({ id: 1, cefrLevel: 'A1', progressStatus: 'COMPLETED' }),
      node({ id: 2, cefrLevel: 'A2', progressStatus: 'COMPLETED' }),
    ])
    expect(allDone.currentLevel).toBe('A2')
    expect(allDone.levels.every((l) => l.status === 'completed')).toBe(true)
  })
})

describe('nhãn', () => {
  test('nodeDisplayTitle ưu tiên tiếng Việt, rơi về tiếng Đức', () => {
    expect(nodeDisplayTitle({ title: 'Tag 1', subtitle: 'Ngày 1' })).toBe('Ngày 1')
    expect(nodeDisplayTitle({ title: 'Tag 1', subtitle: '' })).toBe('Tag 1')
  })
  test('skillLabel: 4 kỹ năng + từ vựng/ngữ pháp có tiếng Việt, mã lạ trả nguyên', () => {
    expect(['HOEREN', 'LESEN', 'SPRECHEN', 'SCHREIBEN'].map(skillLabel)).toEqual(['Nghe', 'Đọc', 'Nói', 'Viết'])
    expect(skillLabel('hoeren')).toBe('Nghe')
    expect(skillLabel('PHONETIK')).toBe('PHONETIK')
  })
})
