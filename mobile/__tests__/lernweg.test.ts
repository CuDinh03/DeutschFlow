// Khoá hợp đồng + helpers cụm Lernweg v2.

jest.mock('@/lib/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}))

import api from '@/lib/api'
import { lernwegApi, type TreeDto } from '@/lib/lernwegApi'
import { currentLevel, milestoneLabel, skillPracticeRoute, treeProgress } from '@/lib/lernwegUi'

const get = api.get as unknown as jest.Mock

beforeEach(() => get.mockReset())

describe('lernwegApi — path đúng RoadmapTreeController', () => {
  test('tree() GET /roadmap/tree; node() encode id', async () => {
    get.mockResolvedValue({ data: {} })
    await lernwegApi.tree()
    await lernwegApi.node('b1/hoeren 01')
    expect(get.mock.calls.map((c) => c[0])).toEqual([
      '/roadmap/tree',
      '/roadmap/tree/node/b1%2Fhoeren%2001',
    ])
  })
})

const tree: Pick<TreeDto, 'path'> = {
  path: [
    {
      level: 'A2', status: 'completed', milestone: null,
      branches: [{
        skill: 'HOEREN', label: 'Nghe', status: 'matured', nodeCap: 8,
        shoots: [{
          topicId: 't1', topicLabel: 'Alltag', topicGroup: null, unlockOrder: 1, chosenByUser: true,
          nodes: [
            { id: 'n1', title: 'x', state: 'completed' },
            { id: 'n2', title: 'y', state: 'completed' },
          ],
        }],
      }],
    },
    {
      level: 'B1', status: 'current', milestone: { id: 'm', title: 'Cổng B1', state: 'in_progress', passedAt: null, unlocksWhen: null },
      branches: [{
        skill: 'SPRECHEN', label: 'Nói', status: 'growing', nodeCap: 8,
        shoots: [{
          topicId: 't2', topicLabel: 'Im Restaurant', topicGroup: null, unlockOrder: 1, chosenByUser: false,
          nodes: [
            { id: 'n3', title: 'z', state: 'in_progress' },
            { id: 'n4', title: 'w', state: 'available' },
            { id: 'n5', title: 'v', state: 'locked' },
          ],
        }],
      }],
    },
    // Level khoá: branches RỖNG theo hợp đồng — không được làm hỏng phép đếm.
    { level: 'B2', status: 'locked', milestone: null, branches: [] },
  ],
}

describe('treeProgress + currentLevel', () => {
  test('đếm completed/tổng xuyên path; level locked branches rỗng an toàn', () => {
    expect(treeProgress(tree)).toEqual({ done: 2, total: 5 })
    expect(treeProgress(null)).toEqual({ done: 0, total: 0 })
  })
  test('currentLevel trả level status=current', () => {
    expect(currentLevel(tree)?.level).toBe('B1')
    expect(currentLevel({ path: [] })).toBeNull()
  })
})

describe('skillPracticeRoute — mọi kỹ năng đều có nơi luyện, không bao giờ 404', () => {
  test.each([
    ['SPRECHEN', '/(student)/speaking'],
    ['WORTSCHATZ', '/(student)/vocabulary'],
    ['GRAMMATIK', '/(student)/grammar'],
    ['HOEREN', '/(student)/video-lesson'],
    ['hoeren', '/(student)/video-lesson'],
    ['SCHREIBEN_LA_GI_DO', '/(student)/learn'],
  ])('%s → %s', (skill, route) => {
    expect(skillPracticeRoute(skill)).toBe(route)
  })
})

describe('milestoneLabel', () => {
  test('4 trạng thái cổng cấp đều có nhãn tiếng Việt', () => {
    for (const s of ['passed', 'ready', 'in_progress', 'locked']) {
      expect(milestoneLabel(s)).not.toBe(s)
    }
  })
})
