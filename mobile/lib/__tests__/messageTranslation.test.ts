// K4 (22/10/2026): nút "Dịch" dưới câu trợ lý — API dịch theo yêu cầu + id tin nhắn khi mở lại phiên.
const postMock = jest.fn()
jest.mock('@/lib/api', () => ({
  __esModule: true,
  default: { post: (...a: unknown[]) => postMock(...a), get: jest.fn() },
}))
jest.mock('expo-file-system/legacy', () => ({}))

import { speakingApi, type AiSpeakingMessage } from '../speakingApi'
import { mapMessagesToTurns } from '../speakingChat'

describe('dịch câu trợ lý (K4)', () => {
  beforeEach(() => postMock.mockReset())

  test('translateMessage gọi đúng phiên/tin, mặc định tiếng Việt, trả text', async () => {
    postMock.mockResolvedValue({ data: { messageId: 345, lang: 'vi', text: 'Bạn ghi chép bàn giao ca thế nào?' } })
    const text = await speakingApi.translateMessage(12, 345)
    expect(text).toBe('Bạn ghi chép bàn giao ca thế nào?')
    const [url, body, config] = postMock.mock.calls[0]
    expect(url).toBe('/ai-speaking/sessions/12/messages/345/translation')
    expect(body).toBeNull()
    expect(config).toMatchObject({ params: { lang: 'vi' } })
  })

  test('mở lại phiên: lượt trợ lý mang messageId từ server', () => {
    const msg = (over: Partial<AiSpeakingMessage>): AiSpeakingMessage => ({
      id: 0, role: 'USER', userText: null, aiSpeechDe: null, correction: null, explanationVi: null,
      grammarPoint: null, newWord: null, userInterestDetected: null, assistantAction: null,
      ...over,
    } as AiSpeakingMessage)
    const turns = mapMessagesToTurns([
      msg({ id: 1, role: 'ASSISTANT', aiSpeechDe: 'Guten Tag!' }),
      msg({ id: 2, role: 'USER', userText: 'Hallo' }),
      msg({ id: 3, role: 'ASSISTANT', aiSpeechDe: 'Erzählen Sie mehr.' }),
    ])
    expect(turns.filter((t) => t.role === 'assistant').map((t) => t.feedback?.messageId)).toEqual([1, 3])
  })
})
