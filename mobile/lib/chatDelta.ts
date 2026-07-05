// Incremental (delta) polling helpers for the DM thread, plus an adaptive poll cadence shared by
// both chat screens. Pure — no imports beyond the Message type — so the merge/cursor/backoff logic
// is unit-tested directly and can't regress the "instant + never lost" guarantees from Tier 1.
import type { Message } from './messagesApi'

/** Highest message id in a thread snapshot (0 when empty) — the delta cursor sent as `afterId`. */
export function maxMessageId(messages: readonly Message[]): number {
  let max = 0
  for (const m of messages) if (m.id > max) max = m.id
  return max
}

/**
 * Merge a delta (messages newer than the cursor) into the cached thread, upsert by id, oldest-first
 * — the canonical order the server returns and the inverted list expects. Returns the SAME `prev`
 * reference when the delta is empty so react-query treats the poll as a no-op (no re-render churn).
 * Upsert (delta wins on an id collision) keeps it correct even if a cursor were ever stale.
 */
export function mergeThreadById(prev: readonly Message[], delta: readonly Message[]): Message[] {
  if (delta.length === 0) return prev as Message[]
  const byId = new Map<number, Message>()
  for (const m of prev) byId.set(m.id, m)
  for (const m of delta) byId.set(m.id, m)
  return [...byId.values()].sort((a, b) => a.id - b.id)
}

// Poll cadence backs off as a thread stays quiet — snappy right after activity, calm when idle —
// to save battery and data. Reset to the fast tier on any activity (send / focus / new messages).
const POLL_FAST_MS = 4_000
const POLL_MED_MS = 8_000
const POLL_SLOW_MS = 15_000
const POLL_IDLE_MS = 30_000

/** Adaptive poll interval (ms) from how long since the thread last changed. */
export function adaptivePollMs(msSinceActivity: number): number {
  if (msSinceActivity < 20_000) return POLL_FAST_MS
  if (msSinceActivity < 60_000) return POLL_MED_MS
  if (msSinceActivity < 300_000) return POLL_SLOW_MS
  return POLL_IDLE_MS
}
