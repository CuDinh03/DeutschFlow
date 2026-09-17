/**
 * `lib/activation.ts` — sổ activation phía client (Đợt 1 kế hoạch onboarding 17/09).
 * Hai bất biến: gửi đúng hợp đồng `{kind, meta?}` tới đúng endpoint, và KHÔNG BAO GIỜ ném —
 * sổ đo không được chặn màn ăn mừng của người học.
 */
const postMock = jest.fn()
jest.mock('@/lib/api', () => ({ __esModule: true, default: { post: (...a: unknown[]) => postMock(...a) } }))

import { recordCoreDone, recordFirstLesson } from '@/lib/activation'

describe('recordFirstLesson', () => {
  beforeEach(() => postMock.mockReset())

  it('POST /onboarding/first-lesson/complete với kind + meta, trả kết quả server', async () => {
    postMock.mockResolvedValue({ data: { activatedAt: '2026-09-17T13:00:00Z', firstTime: true, completedActivities: ['FIRST_LESSON:FIRST_SENTENCE'] } })
    const r = await recordFirstLesson('FIRST_SENTENCE', { mode: 'echo' })
    expect(postMock).toHaveBeenCalledWith('/onboarding/first-lesson/complete', { kind: 'FIRST_SENTENCE', meta: { mode: 'echo' } })
    expect(r?.firstTime).toBe(true)
  })

  it('không có meta thì không gửi trường meta', async () => {
    postMock.mockResolvedValue({ data: { activatedAt: null, firstTime: false, completedActivities: [] } })
    await recordFirstLesson('PLACEMENT')
    expect(postMock).toHaveBeenCalledWith('/onboarding/first-lesson/complete', { kind: 'PLACEMENT' })
  })

  it.each([
    ['404 backend cũ', { response: { status: 404 } }],
    ['mất mạng', new Error('Network Error')],
    ['500', { response: { status: 500 } }],
  ])('%s → trả null, KHÔNG ném', async (_n, err) => {
    postMock.mockRejectedValue(err)
    await expect(recordFirstLesson('FIRST_SENTENCE')).resolves.toBeNull()
  })
})

describe('recordCoreDone', () => {
  beforeEach(() => postMock.mockReset())

  it('POST /onboarding/progress/core-done, trả kết quả', async () => {
    postMock.mockResolvedValue({ data: { coreCompletedAt: '2026-09-17T13:05:00Z', firstTime: true } })
    const r = await recordCoreDone()
    expect(postMock).toHaveBeenCalledWith('/onboarding/progress/core-done')
    expect(r?.firstTime).toBe(true)
  })

  it('lỗi → null, không ném', async () => {
    postMock.mockRejectedValue(new Error('boom'))
    await expect(recordCoreDone()).resolves.toBeNull()
  })
})
