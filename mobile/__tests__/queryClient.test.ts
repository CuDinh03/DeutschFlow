import {
  queryClient,
  invalidateMessagingQueries,
  invalidateNotificationQueries,
  MESSAGING_QUERY_KEYS,
  NOTIFICATION_QUERY_KEYS,
} from '@/lib/queryClient'

describe('queryClient invalidation helpers', () => {
  test('invalidateMessagingQueries invalidates every messaging key', () => {
    const spy = jest.spyOn(queryClient, 'invalidateQueries').mockReturnValue(Promise.resolve())
    invalidateMessagingQueries()

    const invalidatedKeys = spy.mock.calls.map((call) => call[0]?.queryKey)
    for (const key of MESSAGING_QUERY_KEYS) {
      expect(invalidatedKeys).toContainEqual(key)
    }
    // Prefix keys let a mounted ['message-thread', userId] / ['class-channel', classId] refresh.
    expect(invalidatedKeys).toContainEqual(['message-thread'])
    expect(invalidatedKeys).toContainEqual(['class-channel'])
    expect(invalidatedKeys).toContainEqual(['conversations'])
    expect(invalidatedKeys).toContainEqual(['messages-unread'])
    spy.mockRestore()
  })

  test('invalidateNotificationQueries stays scoped to notification keys', () => {
    const spy = jest.spyOn(queryClient, 'invalidateQueries').mockReturnValue(Promise.resolve())
    invalidateNotificationQueries()

    const invalidatedKeys = spy.mock.calls.map((call) => call[0]?.queryKey)
    expect(invalidatedKeys).toEqual(NOTIFICATION_QUERY_KEYS.map((k) => [...k]))
    spy.mockRestore()
  })
})
