// Local-first chat outbox — the single source of truth for messages the user has SENT but the
// server has not yet acknowledged. An item is rendered optimistically the instant it is enqueued
// (status 'sending'), removed from the outbox on server ack, or flipped to 'failed' for a
// tap-to-retry / auto-retry-on-foreground. The store (useChatOutboxStore) persists these to MMKV
// so a send survives an app kill and drives the flush loop.
//
// This module is PURE — no native imports — so the reducers below are unit-tested directly. All
// updates return new arrays (never mutate) so zustand/react see a fresh reference and re-render.

export type OutboxKind = 'dm' | 'class'
// 'sending'  — POST in flight (optimistic bubble)
// 'failed'   — POST rejected; visible with a retry affordance (never silently dropped)
// 'confirmed'— POST acknowledged (we know the real server id) but a poll refetch has not yet
//              surfaced it. We keep it as a "shadow" so the message stays on screen no matter how
//              a concurrent/stale thread refetch reorders against our send — it is only dropped
//              once a genuine server fetch actually contains it (reconcileConfirmed).
export type OutboxStatus = 'sending' | 'failed' | 'confirmed'

/** One un-acknowledged send. `tempId` is a stable client id used as the optimistic bubble key. */
export interface OutboxItem {
  tempId: string
  kind: OutboxKind
  targetId: number // recipient userId (dm) or classId (class)
  body: string
  createdAt: string // ISO — orders optimistic bubbles and survives reload
  status: OutboxStatus
  serverId?: number // set once 'confirmed' — the real message id, used to key the shadow + dedupe
  // Only meaningful once `status === 'failed'`: whether an automatic flush (foreground/focus)
  // should re-attempt it. A network/timeout/5xx failure is transient (true); a 4xx rejection
  // (e.g. blocked, not a classmate) is permanent (false) → manual tap-to-retry only, so a
  // rejected message never loops forever on every app resume.
  retryable?: boolean
}

/** Add `item`, or replace an existing one with the same tempId (idempotent re-enqueue). */
export function upsertItem(items: readonly OutboxItem[], item: OutboxItem): OutboxItem[] {
  return [...items.filter((i) => i.tempId !== item.tempId), item]
}

/** Flip an item's status (e.g. back to 'sending' on a (re)try). */
export function setItemStatus(
  items: readonly OutboxItem[],
  tempId: string,
  status: OutboxStatus,
): OutboxItem[] {
  return items.map((i) => (i.tempId === tempId ? { ...i, status } : i))
}

/** Mark an item failed, recording whether an automatic flush may re-attempt it. */
export function markFailed(
  items: readonly OutboxItem[],
  tempId: string,
  retryable: boolean,
): OutboxItem[] {
  return items.map((i) => (i.tempId === tempId ? { ...i, status: 'failed', retryable } : i))
}

/** Acknowledge a send: keep it as a shadow (keyed by the real id) until a poll surfaces it. */
export function markConfirmed(
  items: readonly OutboxItem[],
  tempId: string,
  serverId: number,
): OutboxItem[] {
  return items.map((i) => (i.tempId === tempId ? { ...i, status: 'confirmed', serverId } : i))
}

/**
 * Drop the confirmed shadows for one channel that a genuine server fetch now contains (matched by
 * serverId) — the real row has taken over, so the shadow is redundant. Returns the SAME array
 * reference when nothing changed, so callers can skip a no-op state update. Only ever removes
 * 'confirmed' items, never a still-'sending'/'failed' one.
 */
export function reconcileConfirmed(
  items: readonly OutboxItem[],
  kind: OutboxKind,
  targetId: number,
  serverIds: readonly number[],
): OutboxItem[] {
  const present = new Set(serverIds)
  const next = items.filter(
    (i) =>
      !(
        i.kind === kind &&
        i.targetId === targetId &&
        i.status === 'confirmed' &&
        i.serverId != null &&
        present.has(i.serverId)
      ),
  )
  return next.length === items.length ? (items as OutboxItem[]) : next
}

/**
 * Whether an automatic flush should re-attempt this item. Only a still-'sending' item (interrupted
 * before it got a response) or a transiently-'failed' one — never a 'confirmed' shadow (already
 * sent → re-sending would duplicate) and never a permanently-rejected 4xx.
 */
export function isAutoRetryable(item: OutboxItem): boolean {
  if (item.status === 'sending') return true
  if (item.status === 'failed') return item.retryable !== false
  return false // 'confirmed'
}

/** The pending/failed sends belonging to one open channel (a DM thread or a class channel). */
export function itemsForChannel(
  items: readonly OutboxItem[],
  kind: OutboxKind,
  targetId: number,
): OutboxItem[] {
  return items.filter((i) => i.kind === kind && i.targetId === targetId)
}
