import { buildClassBubbles, buildDmBubbles } from '@/lib/chatBubbles'
import type { OutboxItem } from '@/lib/chatOutbox'
import type { Message } from '@/lib/messagesApi'
import type { ClassMessage } from '@/lib/classChannelApi'

const dm = (over: Partial<Message>): Message => ({
  id: 1, senderId: 5, recipientId: 9, body: 'hi', createdAt: '2026-07-05T10:00:00.000Z', readAt: null, mine: false, ...over,
})
const cls = (over: Partial<ClassMessage>): ClassMessage => ({
  id: 1, senderId: 5, senderName: 'Cô Lan', body: 'hi lớp', createdAt: '2026-07-05T10:00:00.000Z', mine: false, deleted: false, canDelete: false, ...over,
})
const out = (over: Partial<OutboxItem>): OutboxItem => ({
  tempId: 'tmp-1', kind: 'dm', targetId: 9, body: 'đang gửi', createdAt: '2026-07-05T11:00:00.000Z', status: 'sending', ...over,
})

describe('buildDmBubbles', () => {
  it('returns newest-first with optimistic sends above acknowledged history', () => {
    const server = [
      dm({ id: 1, body: 'first', createdAt: '2026-07-05T09:00:00.000Z' }),
      dm({ id: 2, body: 'second', createdAt: '2026-07-05T09:05:00.000Z' }),
    ]
    const outbox = [out({ tempId: 'tmp-9', body: 'pending', createdAt: '2026-07-05T09:10:00.000Z' })]
    const bubbles = buildDmBubbles(server, outbox)
    expect(bubbles.map((b) => b.body)).toEqual(['pending', 'second', 'first'])
    expect(bubbles[0]).toMatchObject({ key: 'tmp-9', tempId: 'tmp-9', mine: true, status: 'sending' })
    expect(bubbles[1]).toMatchObject({ key: 'm2', realId: 2, status: 'sent' })
  })

  it('maps a server message to a report-eligible bubble (realId, no tempId)', () => {
    const [b] = buildDmBubbles([dm({ id: 7, mine: false })], [])
    expect(b.realId).toBe(7)
    expect(b.tempId).toBeUndefined()
    expect(b.status).toBe('sent')
  })

  it('surfaces a failed send so it is never silently dropped', () => {
    const [b] = buildDmBubbles([], [out({ status: 'failed' })])
    expect(b.status).toBe('failed')
    expect(b.mine).toBe(true)
  })

  it('renders a confirmed shadow the server has NOT yet surfaced (never-lost window)', () => {
    // A poll refetch resolving late could clobber our just-sent message out of the cache; the
    // confirmed shadow keeps it on screen, keyed by its real id so the eventual server row
    // replaces it seamlessly.
    const [b] = buildDmBubbles([], [out({ status: 'confirmed', serverId: 100 })])
    expect(b).toMatchObject({ key: 'm100', status: 'sent', mine: true })
    expect(b.tempId).toBeUndefined() // no retry affordance on an acknowledged message
  })

  it('dedupes a confirmed shadow the server already contains (server row wins, same key)', () => {
    const server = [dm({ id: 100, mine: true, body: 'sent!' })]
    const outbox = [out({ status: 'confirmed', serverId: 100 })]
    const bubbles = buildDmBubbles(server, outbox)
    expect(bubbles).toHaveLength(1) // shadow suppressed, only the server row remains
    expect(bubbles[0]).toMatchObject({ key: 'm100', realId: 100 })
  })

  it('handles empty server + empty outbox', () => {
    expect(buildDmBubbles([], [])).toEqual([])
  })
})

describe('buildClassBubbles', () => {
  it('keeps senderName / deleted / canDelete for server rows and omits them for optimistic ones', () => {
    const server = [cls({ id: 1, senderName: 'Cô Lan', deleted: true, canDelete: true, body: null })]
    const outbox = [out({ tempId: 'tmp-c', kind: 'class', targetId: 3, createdAt: '2026-07-05T12:00:00.000Z' })]
    const bubbles = buildClassBubbles(server, outbox)
    expect(bubbles[0]).toMatchObject({ tempId: 'tmp-c', mine: true })
    expect(bubbles[0].senderName).toBeUndefined() // optimistic rows carry no sender label
    expect(bubbles[0].deleted).toBeUndefined()
    expect(bubbles[1]).toMatchObject({ realId: 1, senderName: 'Cô Lan', deleted: true, canDelete: true, body: '' })
  })
})
