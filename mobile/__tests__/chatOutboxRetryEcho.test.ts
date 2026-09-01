// Khoá luật khớp "tiếng vọng server" khi RETRY tin nhắn (soát 02/09, F-13):
// POST timeout không có nghĩa server chưa lưu — resend mù là tin ĐÔI, nhưng
// nhận vơ echo sai là MẤT tin. Các ca dưới đây khoá cả hai phía.

import {
  collectUsedServerIds,
  findRetryEcho,
  RETRY_ECHO_CLOCK_SKEW_MS,
  type OutboxItem,
  type RetryEchoCandidate,
} from '@/lib/chatOutbox'

const T0 = '2026-09-02T10:00:00.000Z'
const t = (offsetMs: number) => new Date(new Date(T0).getTime() + offsetMs).toISOString()

const item = (over: Partial<OutboxItem> = {}): OutboxItem => ({
  tempId: 'tmp-1',
  kind: 'dm',
  targetId: 7,
  body: 'Hallo, wie geht es dir?',
  createdAt: T0,
  status: 'failed',
  retryable: true,
  ...over,
})

const echo = (id: number, over: Partial<RetryEchoCandidate> = {}): RetryEchoCandidate => ({
  id,
  body: 'Hallo, wie geht es dir?',
  mine: true,
  createdAt: t(1000),
  ...over,
})

describe('findRetryEcho', () => {
  test('khớp echo mine + trùng body + sinh sau lúc gửi → trả id', () => {
    expect(findRetryEcho(item(), [echo(101)], new Set())).toBe(101)
  })

  test('KHÔNG khớp: tin của người kia (mine=false) dù trùng body — kẻo mất tin của mình', () => {
    expect(findRetryEcho(item(), [echo(101, { mine: false })], new Set())).toBeUndefined()
  })

  test('KHÔNG khớp: body khác / body null (tin đã xoá)', () => {
    expect(findRetryEcho(item(), [echo(101, { body: 'khác hẳn' })], new Set())).toBeUndefined()
    expect(findRetryEcho(item(), [echo(101, { body: null })], new Set())).toBeUndefined()
  })

  test('KHÔNG khớp: echo CŨ HƠN lúc bấm gửi quá skew — tin trùng nội dung từ hôm trước', () => {
    const old = echo(101, { createdAt: t(-RETRY_ECHO_CLOCK_SKEW_MS - 60_000) })
    expect(findRetryEcho(item(), [old], new Set())).toBeUndefined()
  })

  test('trong biên skew (đồng hồ lệch nhẹ) vẫn khớp', () => {
    const slightlyBefore = echo(101, { createdAt: t(-RETRY_ECHO_CLOCK_SKEW_MS + 60_000) })
    expect(findRetryEcho(item(), [slightlyBefore], new Set())).toBe(101)
  })

  test('id đã bị item khác chiếm (usedServerIds) thì bỏ qua', () => {
    expect(findRetryEcho(item(), [echo(101)], new Set([101]))).toBeUndefined()
  })

  test('hai item trùng body ghép 1-1 theo thứ tự: item cũ lấy id nhỏ, item mới lấy id còn lại', () => {
    const candidates = [echo(102, { createdAt: t(2000) }), echo(101, { createdAt: t(1000) })]

    const first = findRetryEcho(item({ tempId: 'tmp-1', createdAt: T0 }), candidates, new Set())
    expect(first).toBe(101)

    // Caller cập nhật used sau khi confirm item đầu (markConfirmed → serverId).
    const second = findRetryEcho(
      item({ tempId: 'tmp-2', createdAt: t(500) }),
      candidates,
      new Set([101]),
    )
    expect(second).toBe(102)
  })
})

describe('collectUsedServerIds', () => {
  test('gom serverId của các item đã confirmed, bỏ qua item chưa có', () => {
    const items: OutboxItem[] = [
      item({ tempId: 'a', status: 'confirmed', serverId: 11 }),
      item({ tempId: 'b' }),
      item({ tempId: 'c', status: 'confirmed', serverId: 12 }),
    ]
    expect([...collectUsedServerIds(items)].sort()).toEqual([11, 12])
  })
})
