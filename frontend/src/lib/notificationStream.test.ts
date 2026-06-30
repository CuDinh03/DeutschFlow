import { describe, it, expect } from 'vitest'
import { parseUnreadCount } from './notificationStream'

// Regression guard for the SSE contract drift that silently disabled realtime:
// the backend (NotificationSseBroadcaster) emits the unread count as a BARE
// integer under event `unreadCount`, while the client previously only parsed a
// JSON object `{ unreadCount: n }` under event `unread` — so every frame was
// dropped. parseUnreadCount must accept the real backend wire format.
describe('parseUnreadCount', () => {
  it('parses the backend bare-integer payload', () => {
    expect(parseUnreadCount('5')).toBe(5)
    expect(parseUnreadCount('0')).toBe(0)
    expect(parseUnreadCount(' 12 ')).toBe(12)
  })

  it('floors and clamps to a non-negative integer', () => {
    expect(parseUnreadCount('3.9')).toBe(3)
    expect(parseUnreadCount('-4')).toBe(0)
  })

  it('tolerates a JSON object {unreadCount} for forward-compatibility', () => {
    expect(parseUnreadCount('{"unreadCount":7}')).toBe(7)
  })

  it('returns null for empty or unparseable data', () => {
    expect(parseUnreadCount('')).toBeNull()
    expect(parseUnreadCount('   ')).toBeNull()
    expect(parseUnreadCount('abc')).toBeNull()
    expect(parseUnreadCount('{"foo":1}')).toBeNull()
  })
})
