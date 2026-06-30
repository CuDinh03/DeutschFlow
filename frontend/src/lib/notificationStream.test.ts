import { describe, it, expect } from 'vitest'
import { parseUnreadCount, parseSseDataLines } from './notificationStream'

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

// The realtime-disabling bug was an event-NAME drift (backend `unreadCount` vs client
// `unread`), so pin the name extraction too — not just the numeric parsing.
describe('parseSseDataLines', () => {
  it('extracts the backend unread-count frame (event name + bare-int data)', () => {
    const frame = parseSseDataLines(['event:unreadCount', 'data:3'])
    expect(frame.eventName).toBe('unreadCount')
    expect(frame.data).toBe('3')
    // End-to-end: the dispatch the client actually performs.
    expect(parseUnreadCount(frame.data)).toBe(3)
  })

  it('still extracts the forward-compat `unread` event name', () => {
    expect(parseSseDataLines(['event:unread', 'data:5']).eventName).toBe('unread')
  })

  it('distinguishes the heartbeat `ping` frame (must NOT be treated as a count)', () => {
    const frame = parseSseDataLines(['event:ping', 'data:ok'])
    expect(frame.eventName).toBe('ping')
    // `ping`/`ok` must never resolve to a count.
    expect(parseUnreadCount(frame.data)).toBeNull()
  })

  it('ignores SSE comment lines and trims the leading space after `data:`', () => {
    const frame = parseSseDataLines([':heartbeat-comment', 'event:unreadCount', 'data: 7'])
    expect(frame.eventName).toBe('unreadCount')
    expect(frame.data).toBe('7')
  })
})
