import { create } from 'zustand'
import { MMKV } from 'react-native-mmkv'
import { queryClient } from '@/lib/queryClient'
import { isAxiosErr } from '@/lib/api'
import { messagesApi } from '@/lib/messagesApi'
import { classChannelApi } from '@/lib/classChannelApi'
import {
  isAutoRetryable,
  markConfirmed,
  markFailed,
  type OutboxItem,
  type OutboxKind,
  reconcileConfirmed,
  setItemStatus,
  upsertItem,
} from '@/lib/chatOutbox'

// Local-first send outbox. A tapped "Send" enqueues an item here and returns immediately — the
// screen renders it optimistically (see chatBubbles) while this store drives the actual POST in
// the background, promoting the item into the react-query cache on success or flagging it 'failed'
// for retry. Persisted to MMKV so a send survives an app kill; flushed on app-foreground and on
// screen focus. Mirrors the useSrsOfflineStore pattern (MMKV enqueue + sync-on-foreground).

const storage = new MMKV({ id: 'chat-outbox' })
const KEY = 'outbox_v1'

// In-flight tempIds — kept in memory (not persisted) so a concurrent flush never double-sends the
// same item. Cleared in the finally of each attempt.
const inFlight = new Set<string>()

let seq = 0
function newTempId(): string {
  seq += 1
  return `tmp-${Date.now()}-${seq}`
}

function load(): OutboxItem[] {
  try {
    const raw = storage.getString(KEY)
    return raw ? (JSON.parse(raw) as OutboxItem[]) : []
  } catch {
    return []
  }
}

/**
 * A failure is worth auto-retrying only when it's transient: no HTTP response (offline/timeout)
 * or a 5xx. A 4xx means the server deliberately rejected the message (not a classmate, blocked,
 * validation) — retrying it on every resume would loop forever, so those are manual-retry only.
 */
function isTransientFailure(err: unknown): boolean {
  if (!isAxiosErr(err)) return false
  const status = err.response?.status
  return status == null || status >= 500
}

interface ChatOutboxState {
  items: OutboxItem[]
  /** Enqueue + optimistically render + fire the send. */
  send: (kind: OutboxKind, targetId: number, body: string) => void
  /** Re-attempt a single failed item (tap-to-retry on its bubble). */
  retry: (tempId: string) => void
  /** Re-attempt every not-in-flight item — called on app-foreground and screen focus. */
  flush: () => void
  /** Drop confirmed shadows a real server fetch now contains — called with the fetched ids. */
  reconcile: (kind: OutboxKind, targetId: number, serverIds: readonly number[]) => void
}

export const useChatOutboxStore = create<ChatOutboxState>((set, get) => {
  function commit(next: OutboxItem[]): void {
    storage.set(KEY, JSON.stringify(next))
    set({ items: next })
  }

  async function attempt(item: OutboxItem): Promise<void> {
    if (inFlight.has(item.tempId)) return
    inFlight.add(item.tempId)
    // Reflect the (re)try in the UI: an item that was 'failed' shows as 'sending' again.
    commit(setItemStatus(get().items, item.tempId, 'sending'))
    try {
      const real =
        item.kind === 'dm'
          ? await messagesApi.send(item.targetId, item.body)
          : await classChannelApi.post(item.targetId, item.body)
      // Keep the acknowledged message as a shadow (keyed by its real id) until a genuine poll
      // surfaces it — never write it into the query cache ourselves, so a stale in-flight refetch
      // resolving late can't clobber it out of existence.
      commit(markConfirmed(get().items, item.tempId, real.id))
      if (item.kind === 'dm') {
        // The conversation list preview / unread badge derive from the thread — refresh them.
        void queryClient.invalidateQueries({ queryKey: ['conversations'] })
      }
    } catch (err) {
      // Keep the message visible (never silently drop the user's words) so they can retry.
      commit(markFailed(get().items, item.tempId, isTransientFailure(err)))
    } finally {
      inFlight.delete(item.tempId)
    }
  }

  return {
    items: load(),

    send: (kind, targetId, body) => {
      const item: OutboxItem = {
        tempId: newTempId(),
        kind,
        targetId,
        body,
        createdAt: new Date().toISOString(),
        status: 'sending',
      }
      commit(upsertItem(get().items, item))
      void attempt(item)
    },

    retry: (tempId) => {
      const item = get().items.find((i) => i.tempId === tempId)
      if (item) void attempt(item)
    },

    flush: () => {
      for (const item of get().items) {
        if (!inFlight.has(item.tempId) && isAutoRetryable(item)) void attempt(item)
      }
    },

    reconcile: (kind, targetId, serverIds) => {
      const cur = get().items
      const next = reconcileConfirmed(cur, kind, targetId, serverIds)
      if (next !== cur) commit(next)
    },
  }
})
