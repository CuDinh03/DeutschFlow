jest.mock('@/lib/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}))

import api from '@/lib/api'
import { mapSkillNode, skillTreeApi, type RawSkillNode } from '@/lib/skillTreeApi'

const post = api.post as unknown as jest.Mock

const base: RawSkillNode = { id: 1, title_vi: 'Bảng chữ cái', cefr_level: 'A1', day_number: 1 }

describe('mapSkillNode status normalization (C1)', () => {
  test("maps backend 'UNLOCKED' to the app's 'AVAILABLE'", () => {
    // Backend lifecycle sends UNLOCKED for unlocked-not-started; the app renders
    // 'AVAILABLE' (the tappable bud). Without this, unlocked lessons look locked.
    const node = mapSkillNode({ ...base, user_status: 'UNLOCKED' })
    expect(node.status).toBe('AVAILABLE')
  })

  test('passes through LOCKED / IN_PROGRESS / COMPLETED unchanged', () => {
    expect(mapSkillNode({ ...base, user_status: 'LOCKED' }).status).toBe('LOCKED')
    expect(mapSkillNode({ ...base, user_status: 'IN_PROGRESS' }).status).toBe('IN_PROGRESS')
    expect(mapSkillNode({ ...base, user_status: 'COMPLETED' }).status).toBe('COMPLETED')
  })

  test('falls back to LOCKED for missing/unknown status', () => {
    expect(mapSkillNode(base).status).toBe('LOCKED')
    expect(mapSkillNode({ ...base, user_status: 'SOMETHING_ELSE' }).status).toBe('LOCKED')
  })

  test('prefers user_status over status and is case-insensitive', () => {
    expect(mapSkillNode({ ...base, user_status: 'unlocked', status: 'LOCKED' }).status).toBe('AVAILABLE')
  })

  test('parses tags from a JSON-text array', () => {
    expect(mapSkillNode({ ...base, tags: '["#Alphabet","#A1"]' }).tags).toEqual(['#Alphabet', '#A1'])
  })
})

describe('markNodeComplete (theory-only "mark as learned")', () => {
  beforeEach(() => post.mockReset())

  test('posts to the node complete endpoint and returns the result', async () => {
    post.mockResolvedValue({ data: { completed: true, xpEarned: 100, status: 'COMPLETED' } })

    const result = await skillTreeApi.markNodeComplete(42)

    expect(post).toHaveBeenCalledWith('/skill-tree/42/complete')
    expect(result.completed).toBe(true)
    expect(result.xpEarned).toBe(100)
  })
})

// Chuyển từ skillTreeTopic.test.ts (xoá cùng components/skill-tree ở N15, 05/09): phủ DTO mở rộng.
describe('mapSkillNode — widened DTO parses the full wire shape (Pha 3)', () => {
  const base: RawSkillNode = { id: 1, title_vi: 'Bảng chữ cái', cefr_level: 'A1', day_number: 1 }

  test('parses JSON-text array columns null-safely', () => {
    const n = mapSkillNode({
      ...base,
      core_topics: '["ALPHABET","UMLAUTE"]',
      grammar_points: '["ARTIKEL"]',
      prerequisites_json: '["A1-001"]',
      phase: 'GRUNDLAGEN',
      industry: 'PFLEGE',
      module_title_vi: 'Khởi đầu',
      session_type: 'LESSON',
      sort_order: 3,
      dependencies_met: true,
    })
    expect(n.coreTopics).toEqual(['ALPHABET', 'UMLAUTE'])
    expect(n.grammarPoints).toEqual(['ARTIKEL'])
    expect(n.prerequisites).toEqual(['A1-001'])
    expect(n.phase).toBe('GRUNDLAGEN')
    expect(n.industry).toBe('PFLEGE')
    expect(n.moduleTitle).toBe('Khởi đầu')
    expect(n.sortOrder).toBe(3)
    expect(n.dependenciesMet).toBe(true)
  })

  test('extracts node_code from object-shaped prerequisites (H3)', () => {
    const n = mapSkillNode({ ...base, prerequisites_json: '[{"node_code":"A1-002"},{"code":"A1-003"}]' })
    expect(n.prerequisites).toEqual(['A1-002', 'A1-003'])
  })

  test('malformed JSON text yields empty arrays, never throws', () => {
    const n = mapSkillNode({ ...base, core_topics: 'not json', prerequisites_json: '{' })
    expect(n.coreTopics).toEqual([])
    expect(n.prerequisites).toEqual([])
  })

  test('absent optional fields default cleanly', () => {
    const n = mapSkillNode(base)
    expect(n.phase).toBeNull()
    expect(n.industry).toBeNull()
    expect(n.dependenciesMet).toBe(false)
    expect(n.coreTopics).toEqual([])
  })
})
