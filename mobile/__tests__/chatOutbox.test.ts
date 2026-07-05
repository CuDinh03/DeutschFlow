import {
  type OutboxItem,
  isAutoRetryable,
  itemsForChannel,
  markConfirmed,
  markFailed,
  reconcileConfirmed,
  setItemStatus,
  upsertItem,
} from '@/lib/chatOutbox'

const item = (over: Partial<OutboxItem> = {}): OutboxItem => ({
  tempId: 'tmp-1',
  kind: 'dm',
  targetId: 5,
  body: 'xin chào',
  createdAt: '2026-07-05T10:00:00.000Z',
  status: 'sending',
  ...over,
})

describe('chatOutbox reducers', () => {
  it('upsertItem appends a new item and never mutates the input', () => {
    const items = [item({ tempId: 'tmp-1' })]
    const next = upsertItem(items, item({ tempId: 'tmp-2', body: 'hai' }))
    expect(next).toHaveLength(2)
    expect(items).toHaveLength(1) // immutable
    expect(next.map((i) => i.tempId)).toEqual(['tmp-1', 'tmp-2'])
  })

  it('upsertItem replaces an item with the same tempId (idempotent re-enqueue)', () => {
    const items = [item({ tempId: 'tmp-1', body: 'old' })]
    const next = upsertItem(items, item({ tempId: 'tmp-1', body: 'new' }))
    expect(next).toHaveLength(1)
    expect(next[0].body).toBe('new')
  })

  it('setItemStatus flips only the targeted item', () => {
    const items = [item({ tempId: 'tmp-1', status: 'failed' }), item({ tempId: 'tmp-2', status: 'sending' })]
    const next = setItemStatus(items, 'tmp-1', 'sending')
    expect(next.find((i) => i.tempId === 'tmp-1')?.status).toBe('sending')
    expect(next.find((i) => i.tempId === 'tmp-2')?.status).toBe('sending')
  })

  it('markConfirmed records the real server id and keeps the item as a shadow', () => {
    const next = markConfirmed([item({ tempId: 'tmp-1' })], 'tmp-1', 100)
    expect(next[0]).toMatchObject({ status: 'confirmed', serverId: 100 })
  })

  it('markFailed records retryability; isAutoRetryable gates the auto-flush', () => {
    const items = [item({ tempId: 'tmp-1', status: 'sending' })]
    const transient = markFailed(items, 'tmp-1', true)
    const permanent = markFailed(items, 'tmp-1', false)
    expect(transient[0]).toMatchObject({ status: 'failed', retryable: true })
    expect(permanent[0]).toMatchObject({ status: 'failed', retryable: false })
    // sending → always; transient failure → yes; 4xx rejection → no; confirmed → no (already sent).
    expect(isAutoRetryable(item({ status: 'sending' }))).toBe(true)
    expect(isAutoRetryable(transient[0])).toBe(true)
    expect(isAutoRetryable(permanent[0])).toBe(false)
    expect(isAutoRetryable(item({ status: 'confirmed', serverId: 100 }))).toBe(false)
  })

  describe('reconcileConfirmed', () => {
    it('drops confirmed shadows the server now contains, for that channel only', () => {
      const items = [
        item({ tempId: 'a', kind: 'dm', targetId: 5, status: 'confirmed', serverId: 100 }),
        item({ tempId: 'b', kind: 'dm', targetId: 5, status: 'sending' }),
        item({ tempId: 'c', kind: 'dm', targetId: 9, status: 'confirmed', serverId: 100 }), // other thread
      ]
      const next = reconcileConfirmed(items, 'dm', 5, [100, 200])
      expect(next.map((i) => i.tempId)).toEqual(['b', 'c']) // 'a' retired; 'b' still sending; 'c' other channel
    })

    it('returns the SAME reference when nothing is reconciled (no needless state update)', () => {
      const items = [item({ status: 'confirmed', serverId: 100 })]
      expect(reconcileConfirmed(items, 'dm', 5, [999])).toBe(items)
    })

    it('never drops a still-sending or failed item even if an id coincidentally matches', () => {
      const items = [item({ tempId: 'a', status: 'sending', serverId: undefined })]
      expect(reconcileConfirmed(items, 'dm', 5, [100])).toBe(items)
    })
  })

  it('itemsForChannel filters by kind AND targetId', () => {
    const items = [
      item({ tempId: 'a', kind: 'dm', targetId: 5 }),
      item({ tempId: 'b', kind: 'dm', targetId: 9 }),
      item({ tempId: 'c', kind: 'class', targetId: 5 }),
    ]
    expect(itemsForChannel(items, 'dm', 5).map((i) => i.tempId)).toEqual(['a'])
    expect(itemsForChannel(items, 'class', 5).map((i) => i.tempId)).toEqual(['c'])
    expect(itemsForChannel(items, 'dm', 999)).toEqual([])
  })
})
