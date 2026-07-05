jest.mock('@/lib/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}))

import api from '@/lib/api'
import { messagesApi } from '@/lib/messagesApi'

const get = api.get as unknown as jest.Mock
const post = api.post as unknown as jest.Mock

beforeEach(() => {
  get.mockReset()
  post.mockReset()
})

describe('messagesApi endpoints', () => {
  test('conversations() hits /messages/conversations and defaults to []', async () => {
    get.mockResolvedValue({ data: undefined })
    expect(await messagesApi.conversations()).toEqual([])
    expect(get).toHaveBeenCalledWith('/messages/conversations')
  })

  test('unreadCount() returns the count field, 0 when absent', async () => {
    get.mockResolvedValue({ data: { count: 3 } })
    expect(await messagesApi.unreadCount()).toBe(3)
    get.mockResolvedValue({ data: {} })
    expect(await messagesApi.unreadCount()).toBe(0)
    expect(get).toHaveBeenCalledWith('/messages/unread-count')
  })

  test('thread(userId) hits /messages/with/{userId} with no params (full fetch)', async () => {
    get.mockResolvedValue({ data: [] })
    await messagesApi.thread(42)
    expect(get).toHaveBeenCalledWith('/messages/with/42', undefined)
  })

  test('thread(userId, afterId) sends the delta cursor as ?afterId', async () => {
    get.mockResolvedValue({ data: [] })
    await messagesApi.thread(42, 100)
    expect(get).toHaveBeenCalledWith('/messages/with/42', { params: { afterId: 100 } })
  })

  test('send(recipientId, body) POSTs the payload', async () => {
    post.mockResolvedValue({ data: { id: 1, mine: true } })
    const msg = await messagesApi.send(42, 'Hallo')
    expect(post).toHaveBeenCalledWith('/messages', { recipientId: 42, body: 'Hallo' })
    expect(msg.mine).toBe(true)
  })

  test('markRead(userId) POSTs to the read endpoint', async () => {
    post.mockResolvedValue({ data: undefined })
    await messagesApi.markRead(42)
    expect(post).toHaveBeenCalledWith('/messages/with/42/read')
  })
})
