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
