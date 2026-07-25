// MB-3 (R-M3): hợp đồng của các helper outbox lượt speaking — giữ câu user khi gửi lỗi, đánh dấu
// failed, gửi lại, và dedupe chống double-charge (R-M5). Test tầng reducer thuần (nhanh, không render).
import {
  makeUserTurn,
  setTurnStatus,
  attachFeedbackToTurn,
  serverHasUserText,
  mergeFailedTurns,
  mapMessagesToTurns,
  type ChatTurn,
} from '@/lib/speakingChat'
import type { AiChatResponse, AiSpeakingMessage } from '@/lib/speakingApi'

describe('speakingChat outbox helpers (MB-3)', () => {
  it('makeUserTurn: user turn đang gửi, có id, không mutate', () => {
    const t = makeUserTurn('  Hallo  ')
    expect(t.role).toBe('user')
    expect(t.status).toBe('sending')
    expect(t.content).toBe('  Hallo  ') // giữ nguyên; trim chỉ dùng khi so khớp
    expect(typeof t.id).toBe('string')
    expect(t.id.length).toBeGreaterThan(0)
  })

  it('makeUserTurn: id duy nhất giữa các lần gọi', () => {
    expect(makeUserTurn('a').id).not.toBe(makeUserTurn('a').id)
  })

  it('setTurnStatus: đổi đúng id sang failed + retryable, id khác giữ nguyên, không mutate input', () => {
    const input: ChatTurn[] = [
      { id: 'x', role: 'user', content: 'A', status: 'sending' },
      { id: 'y', role: 'user', content: 'B', status: 'sending' },
    ]
    const out = setTurnStatus(input, 'x', 'failed', true)
    expect(out[0]).toMatchObject({ id: 'x', status: 'failed', retryable: true })
    expect(out[1]).toEqual(input[1]) // không đụng turn khác
    expect(input[0].status).toBe('sending') // input bất biến
  })

  it('setTurnStatus: khi sang "sent" thì xoá retryable', () => {
    const input: ChatTurn[] = [{ id: 'x', role: 'user', content: 'A', status: 'failed', retryable: true }]
    const out = setTurnStatus(input, 'x', 'sent')
    expect(out[0].status).toBe('sent')
    expect(out[0].retryable).toBeUndefined()
  })

  it('attachFeedbackToTurn: gắn feedback vào đúng id', () => {
    const input: ChatTurn[] = [
      { id: 'x', role: 'user', content: 'A' },
      { id: 'y', role: 'user', content: 'B' },
    ]
    const fb = { correction: 'A!', explanationVi: 'vì...' } as AiChatResponse
    const out = attachFeedbackToTurn(input, 'y', fb)
    expect(out[0].feedback).toBeUndefined()
    expect(out[1].feedback).toBe(fb)
  })

  it('serverHasUserText: khớp theo nội dung trim', () => {
    const server: ChatTurn[] = [
      { id: 's0', role: 'user', content: 'Ich spiele Tennis' },
      { id: 's1', role: 'assistant', content: 'Schön!' },
    ]
    expect(serverHasUserText(server, '  Ich spiele Tennis  ')).toBe(true)
    expect(serverHasUserText(server, 'Ich spiele Fußball')).toBe(false)
  })

  it('mergeFailedTurns: giữ orphan failed chưa lên server, loại orphan đã có trên server', () => {
    const server: ChatTurn[] = [
      { id: 's0', role: 'user', content: 'Câu đã lưu' },
      { id: 's1', role: 'assistant', content: 'reply' },
    ]
    const prev: ChatTurn[] = [
      { id: 'p0', role: 'user', content: 'Câu đã lưu', status: 'failed', retryable: true }, // trùng → loại
      { id: 'p1', role: 'user', content: 'Câu chưa lưu', status: 'failed', retryable: true }, // giữ
      { id: 'p2', role: 'user', content: 'Sending dở', status: 'sending' }, // chỉ giữ 'failed', bỏ qua
    ]
    const out = mergeFailedTurns(server, prev)
    expect(out).toHaveLength(3) // 2 server + 1 orphan failed chưa lưu
    expect(out.filter((t) => t.status === 'failed').map((t) => t.content)).toEqual(['Câu chưa lưu'])
  })

  it('mergeFailedTurns: không có orphan → trả nguyên serverTurns (cùng reference)', () => {
    const server: ChatTurn[] = [{ id: 's0', role: 'user', content: 'X' }]
    const prev: ChatTurn[] = [{ id: 's0', role: 'user', content: 'X' }]
    expect(mergeFailedTurns(server, prev)).toBe(server)
  })

  it('mapMessagesToTurns: mỗi turn có id duy nhất + giữ hợp đồng correction gắn user turn trước', () => {
    const messages: AiSpeakingMessage[] = [
      { role: 'USER', userText: 'ich spiele gern' } as AiSpeakingMessage,
      {
        role: 'ASSISTANT',
        aiSpeechDe: 'Toll!',
        correction: 'Ich spiele gern.',
        explanationVi: 'viết hoa + chấm',
      } as AiSpeakingMessage,
    ]
    const turns = mapMessagesToTurns(messages)
    const ids = turns.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length) // id duy nhất
    const userTurn = turns.find((t) => t.role === 'user')
    expect(userTurn?.feedback?.correction).toBe('Ich spiele gern.') // hợp đồng cũ giữ nguyên
  })
})
