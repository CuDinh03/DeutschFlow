import { adaptivePollMs, maxMessageId, mergeThreadById } from '@/lib/chatDelta'
import type { Message } from '@/lib/messagesApi'

const msg = (id: number, body = 'x'): Message => ({
  id, senderId: 1, recipientId: 2, body, createdAt: `2026-07-05T10:00:0${id}.000Z`, readAt: null, mine: false,
})

describe('maxMessageId', () => {
  it('returns the highest id, or 0 for an empty thread', () => {
    expect(maxMessageId([])).toBe(0)
    expect(maxMessageId([msg(3), msg(1), msg(9), msg(2)])).toBe(9)
  })
})

describe('mergeThreadById', () => {
  it('appends a delta and keeps oldest-first order', () => {
    const prev = [msg(1), msg(2)]
    const merged = mergeThreadById(prev, [msg(3), msg(4)])
    expect(merged.map((m) => m.id)).toEqual([1, 2, 3, 4])
  })

  it('returns the SAME reference for an empty delta (no-op poll → no re-render)', () => {
    const prev = [msg(1)]
    expect(mergeThreadById(prev, [])).toBe(prev)
  })

  it('upserts on an id collision (the delta wins — fresher copy)', () => {
    const prev = [msg(1, 'old')]
    const merged = mergeThreadById(prev, [msg(1, 'new')])
    expect(merged).toHaveLength(1)
    expect(merged[0].body).toBe('new')
  })

  it('sorts a delta that arrives out of order', () => {
    const merged = mergeThreadById([msg(1)], [msg(5), msg(3)])
    expect(merged.map((m) => m.id)).toEqual([1, 3, 5])
  })
})

describe('adaptivePollMs', () => {
  it('is snappy right after activity and backs off as the thread goes quiet', () => {
    expect(adaptivePollMs(0)).toBe(4_000)
    expect(adaptivePollMs(19_000)).toBe(4_000)
    expect(adaptivePollMs(20_000)).toBe(8_000)
    expect(adaptivePollMs(59_000)).toBe(8_000)
    expect(adaptivePollMs(60_000)).toBe(15_000)
    expect(adaptivePollMs(299_000)).toBe(15_000)
    expect(adaptivePollMs(300_000)).toBe(30_000)
  })

  it('never returns a non-positive interval', () => {
    expect(adaptivePollMs(0)).toBeGreaterThan(0)
    expect(adaptivePollMs(999_999_999)).toBeGreaterThan(0)
  })
})
