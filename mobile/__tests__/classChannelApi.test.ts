jest.mock('@/lib/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), delete: jest.fn() },
}))

import api from '@/lib/api'
import { classChannelApi } from '@/lib/classChannelApi'

const get = api.get as unknown as jest.Mock
const post = api.post as unknown as jest.Mock
const del = api.delete as unknown as jest.Mock

beforeEach(() => {
  get.mockReset()
  post.mockReset()
  del.mockReset()
})

describe('classChannelApi', () => {
  test('list hits the channel messages endpoint and defaults to []', async () => {
    get.mockResolvedValue({ data: undefined })
    expect(await classChannelApi.list(10)).toEqual([])
    expect(get).toHaveBeenCalledWith('/v2/classes/10/channel/messages')
  })

  test('post sends the body to the channel messages endpoint', async () => {
    post.mockResolvedValue({ data: { id: 1, mine: true } })
    const m = await classChannelApi.post(10, 'chào cả lớp')
    expect(post).toHaveBeenCalledWith('/v2/classes/10/channel/messages', { body: 'chào cả lớp' })
    expect(m.mine).toBe(true)
  })

  test('remove soft-deletes via the DELETE endpoint', async () => {
    del.mockResolvedValue({ data: { id: 1, deleted: true } })
    const m = await classChannelApi.remove(10, 1)
    expect(del).toHaveBeenCalledWith('/v2/classes/10/channel/messages/1')
    expect(m.deleted).toBe(true)
  })
})
