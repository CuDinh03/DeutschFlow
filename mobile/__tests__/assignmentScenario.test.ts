// N2 (đợt 2 plan nâng cấp mobile 05/09): bài giao SPEAKING_SCENARIO làm ngay trong app.

jest.mock('@/lib/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), patch: jest.fn() },
  apiMessage: (e: unknown) => (e instanceof Error ? e.message : String(e)),
}))

import api from '@/lib/api'
import { fetchAssignmentScenario, scenarioTopic } from '@/lib/studentClassesApi'
import { speakingApi } from '@/lib/speakingApi'

const get = api.get as unknown as jest.Mock
const post = api.post as unknown as jest.Mock

beforeEach(() => { get.mockReset(); post.mockReset() })

describe('fetchAssignmentScenario — id bài của LỚP, đúng path StudentAssignmentController', () => {
  test('GET /v2/students/assignments/{assignmentId}/scenario', async () => {
    get.mockResolvedValue({ data: { id: 1, assignmentId: 42, topic: 'Im Restaurant', level: 'A2', scenarioDescription: 'x', followUpQuestions: 'y' } })
    const sc = await fetchAssignmentScenario(42)
    expect(get).toHaveBeenCalledWith('/v2/students/assignments/42/scenario')
    expect(sc.level).toBe('A2')
  })
})

describe('scenarioTopic — cùng định dạng chuỗi topic với web', () => {
  test('ghép Chủ đề / Mô tả chi tiết / Gợi ý bằng dòng trống', () => {
    expect(scenarioTopic({ topic: 'Im Restaurant', scenarioDescription: 'Bạn gọi món.', followUpQuestions: 'Was möchten Sie?' }))
      .toBe('Chủ đề: Im Restaurant\n\nMô tả chi tiết: Bạn gọi món.\n\nGợi ý: Was möchten Sie?')
  })
  test('phần thiếu để trống, không in "null"', () => {
    const t = scenarioTopic({ topic: 'X', scenarioDescription: null, followUpQuestions: null })
    expect(t).toBe('Chủ đề: X\n\nMô tả chi tiết: \n\nGợi ý: ')
    expect(t).not.toContain('null')
  })
})

describe('speakingApi.createSession — assignmentId đi vào body (id dòng bài học viên)', () => {
  test('có assignmentId → gửi số; không có → null như trước', async () => {
    post.mockResolvedValue({ data: { id: 9 } })
    await speakingApi.createSession({ topic: 't', cefrLevel: 'A2', persona: 'DEFAULT', sessionMode: 'LESSON', assignmentId: 777 })
    expect(post.mock.calls[0][0]).toBe('/ai-speaking/sessions')
    expect(post.mock.calls[0][1]).toMatchObject({ sessionMode: 'LESSON', persona: 'DEFAULT', assignmentId: 777 })
    await speakingApi.createSession({ topic: 't', cefrLevel: 'A2', persona: 'LUKAS', sessionMode: 'COMMUNICATION' })
    expect(post.mock.calls[1][1]).toMatchObject({ assignmentId: null })
  })
})
