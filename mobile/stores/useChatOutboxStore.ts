import { create } from 'zustand'
import { MMKV } from 'react-native-mmkv'
import { queryClient } from '@/lib/queryClient'
import { isAxiosErr } from '@/lib/api'
import { messagesApi } from '@/lib/messagesApi'
import { classChannelApi } from '@/lib/classChannelApi'
import {
  collectUsedServerIds,
  findRetryEcho,
  isAutoRetryable,
  markConfirmed,
  markFailed,
  type OutboxItem,
  type OutboxKind,
  reconcileConfirmed,
  RETRY_ECHO_CLOCK_SKEW_MS,
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
  /**
   * Xoá SẠCH outbox (MMKV + state) — gọi khi phiên kết thúc (logout / refresh
   * token chết), qua clearDeviceSessionState. Item không gắn userId nên tin chưa
   * gửi được của tài khoản A mà còn nằm lại sẽ hiện thành bong bóng "của tôi"
   * kèm nút "Gửi lại" dưới tài khoản B trên cùng máy — lộ nguyên văn tin nhắn và
   * mở đường gửi lại dưới danh nghĩa người khác (soát 02/09, F-23). Tin nháp
   * chưa gửi của A bị bỏ có chủ đích: không được phép giữ hộ cho người sau.
   */
  clear: () => void
}

export const useChatOutboxStore = create<ChatOutboxState>((set, get) => {
  function commit(next: OutboxItem[]): void {
    storage.set(KEY, JSON.stringify(next))
    set({ items: next })
  }

  /**
   * F-13 (soát 02/09): trước khi RESEND một item từng thất bại thoáng qua, hỏi
   * server xem tin đã nằm đó chưa — POST timeout/502 không có nghĩa server chưa
   * lưu, và resend mù là người nhận thấy tin ĐÔI. Không có khoá idempotency phía
   * backend (fix gốc, đợt sau) nên đây là chốt chặn phía client:
   *  - class: GET channel messages (không có side effect đánh dấu đã-đọc) → khớp
   *    echo chính xác theo mine+body+thời gian → markConfirmed(id thật).
   *  - dm: conversations() làm bước NGHI VẤN rẻ (summary không có id, không side
   *    effect); chỉ khi lastMessage trùng body mới gọi thread() lấy id chính xác
   *    (thread() đánh dấu tin đến là đã-đọc — chấp nhận trong ca hẹp này, người
   *    dùng vừa nhắn trong thread đó xong).
   * Trả true = đã xác nhận echo, KHÔNG POST nữa. Mọi lỗi fetch → false (cứ POST
   * như thường — đúng lúc offline thì đường resend cũ vẫn phải chạy).
   * Giới hạn còn lại (ghi nhận): dm mà echo KHÔNG phải tin cuối của thread
   * (người kia nhắn chen vào giữa timeout và flush) thì bước nghi vấn bỏ sót →
   * hành vi như trước bản vá.
   */
  async function confirmedByServerEcho(item: OutboxItem): Promise<boolean> {
    try {
      if (item.kind === 'class') {
        const msgs = await classChannelApi.list(item.targetId)
        const echo = findRetryEcho(item, msgs, collectUsedServerIds(get().items))
        if (echo == null) return false
        commit(markConfirmed(get().items, item.tempId, echo))
        return true
      }
      const convs = await messagesApi.conversations()
      const conv = convs.find((c) => c.userId === item.targetId)
      const suspicious =
        conv?.lastMessage === item.body &&
        conv.lastAt != null &&
        new Date(conv.lastAt).getTime() >= new Date(item.createdAt).getTime() - RETRY_ECHO_CLOCK_SKEW_MS
      if (!suspicious) return false
      const msgs = await messagesApi.thread(item.targetId)
      const echo = findRetryEcho(item, msgs, collectUsedServerIds(get().items))
      if (echo == null) return false
      commit(markConfirmed(get().items, item.tempId, echo))
      void queryClient.invalidateQueries({ queryKey: ['conversations'] })
      return true
    } catch {
      return false
    }
  }

  async function attempt(item: OutboxItem, opts?: { retry?: boolean }): Promise<void> {
    if (inFlight.has(item.tempId)) return
    inFlight.add(item.tempId)
    // Reflect the (re)try in the UI: an item that was 'failed' shows as 'sending' again.
    commit(setItemStatus(get().items, item.tempId, 'sending'))
    try {
      if (opts?.retry && (await confirmedByServerEcho(item))) return
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
      if (item) void attempt(item, { retry: true })
    },

    flush: () => {
      // Gom theo thread và xử lý TUẦN TỰ trong mỗi thread: hai item trùng body
      // cùng thread mà check echo song song có thể cùng nhận một echo → một tin
      // biến mất. Tuần tự + usedServerIds (đọc lại sau mỗi confirm) ghép 1-1 đúng.
      const pending = get().items.filter((i) => !inFlight.has(i.tempId) && isAutoRetryable(i))
      const byThread = new Map<string, OutboxItem[]>()
      for (const item of pending) {
        const key = `${item.kind}:${item.targetId}`
        const group = byThread.get(key)
        if (group) group.push(item)
        else byThread.set(key, [item])
      }
      for (const group of byThread.values()) {
        void (async () => {
          const ordered = [...group].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
          for (const item of ordered) {
            await attempt(item, { retry: true })
          }
        })()
      }
    },

    reconcile: (kind, targetId, serverIds) => {
      const cur = get().items
      const next = reconcileConfirmed(cur, kind, targetId, serverIds)
      if (next !== cur) commit(next)
    },

    clear: () => {
      // Attempt đang bay (nếu có) settle vào danh sách rỗng: markConfirmed/markFailed
      // map trên items hiện tại nên item đã xoá chỉ là no-op, không hồi sinh.
      commit([])
    },
  }
})
