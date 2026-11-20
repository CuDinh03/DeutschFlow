// Bộ lưu gói đánh dấu bài đọc (Đợt 4f, 20/11/2026) — phần thuần của `hooks/usePassageMarks.ts`, theo kiểu
// `createDraftAutosaver` (`lib/mockRun.ts`): hẹn lưu sau một quãng im, lưu NỐI ĐUÔI (không bao giờ hai PUT
// bay cùng lúc — tới server sai thứ tự thì gói cũ thắng vì server ghi đè cả gói), lưu ngay khi rời màn,
// và phân loại lỗi: lỗi mạng / 5xx giữ "chưa lưu" để lần tô sau hoặc lúc rời màn thử lại; 4xx thì KHÔNG
// gửi lại cùng gói (400 = gói không hợp lệ, gửi lại vẫn hỏng); 409 = lượt thi đã đóng/huỷ ⇒ ngừng hẳn.

export const MARKS_AUTOSAVE_MS = 800
export const MAX_UNDO = 60

/** `error` = lỗi mạng/5xx, sẽ thử lại · `rejected` = server từ chối gói này · `closed` = lượt thi đã đóng. */
export type MarksSaveState = 'idle' | 'saving' | 'saved' | 'error' | 'rejected' | 'closed'

export type SaveFailure = 'retry' | 'rejected' | 'closed'

/** Phân loại lỗi lưu theo mã HTTP (axios: `err.response.status`). Không có mã = lỗi mạng ⇒ thử lại. */
export function classifySaveError(err: unknown): SaveFailure {
  const status = (err as { response?: { status?: unknown } } | null)?.response?.status
  if (typeof status !== 'number') return 'retry'
  if (status === 409) return 'closed'
  if (status >= 400 && status < 500 && status !== 408 && status !== 429) return 'rejected'
  return 'retry'
}

export interface MarksSaver<P> {
  /** Gói vừa đổi: hẹn lưu sau quãng im. Đã `closed` thì bỏ qua. */
  change(pack: P): void
  /** Lưu ngay phần chưa lưu, CHỜ cả lần lưu đang bay. */
  flush(): Promise<void>
  isDirty(): boolean
  /** Rời nguồn này (đổi Teil / rời màn): lưu nốt phần chưa lưu rồi ngừng nhận thay đổi. */
  close(): Promise<void>
}

export function createMarksSaver<P>(opts: {
  save: (pack: P) => Promise<unknown>
  onState?: (s: MarksSaveState) => void
  delayMs?: number
}): MarksSaver<P> {
  const delayMs = opts.delayMs ?? MARKS_AUTOSAVE_MS
  let latest: P | null = null
  let dirty = false
  let closed = false
  let stopped = false // 409: lượt đã đóng — không lưu gì nữa
  let inFlight: Promise<void> | null = null
  let timer: ReturnType<typeof setTimeout> | null = null

  const setState = (s: MarksSaveState) => opts.onState?.(s)
  const clearTimer = () => {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }

  const run = async (): Promise<void> => {
    while (dirty && !stopped && latest !== null) {
      const pack = latest
      dirty = false
      setState('saving')
      try {
        await opts.save(pack)
        setState(dirty ? 'saving' : 'saved')
      } catch (err) {
        const kind = classifySaveError(err)
        if (kind === 'retry') {
          // Giữ "chưa lưu" — chỉ khi chưa có gói mới hơn thì gói này mới là cái cần lưu lại.
          dirty = true
          setState('error')
          return
        }
        if (kind === 'closed') {
          stopped = true
          dirty = false
          setState('closed')
          return
        }
        // 4xx khác: gói này hỏng, gửi lại vẫn hỏng. Có thay đổi mới trong lúc chờ thì lưu tiếp.
        setState('rejected')
        if (!dirty) return
      }
    }
  }

  const flush = async (): Promise<void> => {
    clearTimer()
    while (inFlight) await inFlight
    if (!dirty || stopped) return
    inFlight = run().finally(() => {
      inFlight = null
    })
    await inFlight
  }

  return {
    change(pack: P) {
      if (closed || stopped) return
      latest = pack
      dirty = true
      clearTimer()
      timer = setTimeout(() => {
        timer = null
        void flush()
      }, delayMs)
    },
    flush,
    isDirty: () => dirty,
    async close() {
      if (closed) return
      await flush()
      closed = true
      clearTimer()
    },
  }
}

/** Ngăn hoàn tác (tối đa `max` bước, bỏ bước cũ nhất). */
export interface UndoStack<P> {
  push(p: P): void
  pop(): P | undefined
  clear(): void
  depth(): number
}

export function createUndoStack<P>(max = MAX_UNDO): UndoStack<P> {
  let items: P[] = []
  return {
    push(p) {
      items = [...items, p].slice(-max)
    },
    pop() {
      const last = items[items.length - 1]
      items = items.slice(0, -1)
      return last
    },
    clear() {
      items = []
    },
    depth: () => items.length,
  }
}
