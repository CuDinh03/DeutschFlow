// Khoá hợp đồng client Luyện thi Nói ↔ backend /api/speaking/exam/**
// (ExamSpeakingController): path, body shape, và multipart audio đúng khoá 'audio'.

jest.mock('@/lib/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn() },
}))

import api from '@/lib/api'
import { examSpeakingApi } from '@/lib/examSpeakingApi'

const get = api.get as unknown as jest.Mock
const post = api.post as unknown as jest.Mock
const put = api.put as unknown as jest.Mock

beforeEach(() => {
  get.mockReset()
  post.mockReset()
  put.mockReset()
})

describe('examSpeakingApi', () => {
  test('listBlueprints lọc theo provider/level và mặc định []', async () => {
    get.mockResolvedValue({ data: undefined })
    expect(await examSpeakingApi.listBlueprints({ provider: 'GOETHE', level: 'B1' })).toEqual([])
    expect(get).toHaveBeenCalledWith('/speaking/exam/blueprints', { params: { provider: 'GOETHE', level: 'B1' } })
  })

  test('createSession gửi đúng body {provider, level, mode}', async () => {
    post.mockResolvedValue({ data: { id: 9 } })
    await examSpeakingApi.createSession({ provider: 'GOETHE', level: 'B1', mode: 'MOCK' })
    expect(post).toHaveBeenCalledWith(
      '/speaking/exam/sessions',
      { provider: 'GOETHE', level: 'B1', mode: 'MOCK' },
      expect.objectContaining({ timeout: expect.any(Number) }),
    )
  })

  test('choose gửi {teilNo, index} — hợp đồng choice của Teil 1-trong-N', async () => {
    post.mockResolvedValue({ data: { id: 9 } })
    await examSpeakingApi.choose(9, 2, 1)
    expect(post).toHaveBeenCalledWith('/speaking/exam/sessions/9/choice', { teilNo: 2, index: 1 })
  })

  test('audioTurn: multipart khoá "audio", đúng path turns, timeout dài cho lượt AI', async () => {
    post.mockResolvedValue({ data: { transcript: 'x', session: { id: 9 } } })
    await examSpeakingApi.audioTurn(9, 'file:///tmp/turn.m4a')

    const [path, form, cfg] = post.mock.calls[0]
    expect(path).toBe('/speaking/exam/sessions/9/turns')
    expect(cfg).toMatchObject({
      headers: { 'Content-Type': 'multipart/form-data' },
      params: { lang: 'vi' },
    })
    expect(cfg.timeout).toBeGreaterThanOrEqual(45_000)
    // FormData: phần tử duy nhất tên 'audio' — server đọc @RequestParam("audio").
    // (Type FormData của RN không khai keys(); trong jest chạy FormData của Node.)
    const entries = [...(form as unknown as { keys(): IterableIterator<string> }).keys()]
    expect(entries).toEqual(['audio'])
  })

  test('advance/finish/regrade POST đúng path phiên', async () => {
    post.mockResolvedValue({ data: { id: 9 } })
    await examSpeakingApi.advance(9)
    await examSpeakingApi.finish(9)
    await examSpeakingApi.regrade(9)
    expect(post.mock.calls.map((c) => c[0])).toEqual([
      '/speaking/exam/sessions/9/advance',
      '/speaking/exam/sessions/9/finish',
      '/speaking/exam/sessions/9/regrade',
    ])
  })

  test('saveNotes PUT {notes}; getResult/listResults/weakness GET đúng path', async () => {
    put.mockResolvedValue({ data: { id: 9 } })
    get.mockResolvedValue({ data: {} })
    await examSpeakingApi.saveNotes(9, 'ghi chú')
    await examSpeakingApi.getResult(9)
    await examSpeakingApi.listResults()
    await examSpeakingApi.getWeakness({ level: 'B1' })
    expect(put).toHaveBeenCalledWith('/speaking/exam/sessions/9/notes', { notes: 'ghi chú' })
    expect(get.mock.calls.map((c) => c[0])).toEqual([
      '/speaking/exam/sessions/9/result',
      '/speaking/exam/results',
      '/speaking/exam/weakness',
    ])
  })
})
