'use client'

import * as React from 'react'
import { getPracticeMarks, practiceMarksPath, savePracticeMarks } from '@/lib/telcPracticeApi'
import { sendKeepalive } from '@/lib/exam/keepalive'
import { dropStale, emptyPack, hasContent, parsePack, type MarksPack } from './marksModel'

export const MARKS_AUTOSAVE_MS = 1500
const MAX_UNDO = 60

export type MarksSaveState = 'idle' | 'saving' | 'saved' | 'error'

export interface PassageMarks {
  /** Đã tải xong (hoặc không có gì để tải). */
  ready: boolean
  pack: MarksPack
  /** Chữ của từng khối (`ctx`, `q:<id>`) — mô hình cần để kiểm/ghi hash. */
  texts: Record<string, string>
  saveState: MarksSaveState
  /** Lúc tải có khối đã đổi chữ ⇒ đánh dấu của khối đó bị bỏ (báo một dòng). */
  staleDropped: boolean
  /** Ẩn tạm mọi đánh dấu để đọc lại bài sạch (không lưu). */
  hidden: boolean
  setHidden: (v: boolean) => void
  /** Đổi gói (một bước hoàn tác) rồi hẹn lưu. */
  apply: (next: (p: MarksPack) => MarksPack) => void
  undo: () => void
  canUndo: boolean
  /** Sau "Làm lại" bỏ đánh dấu: xoá trên máy, không gửi (server đã xoá). */
  clearLocal: () => void
}

interface Options {
  examId: number
  teilKey: string | null
  texts: Record<string, string>
  enabled: boolean
}

/**
 * Đánh dấu bài đọc của một Teil luyện (`GET/PUT /mock-exams/practice/{examId}/teile/{key}/marks`).
 * Lưu kiểu như `usePracticeDraft`: hẹn 1,5 s sau lần đổi cuối, lưu ngay khi ẩn tab / đóng trang bằng
 * `keepalive`. Lưu lỗi ⇒ giữ bản trên máy, `saveState = 'error'`, lần đổi sau thử lại.
 */
export function usePassageMarks({ examId, teilKey, texts, enabled }: Options): PassageMarks {
  const [pack, setPack] = React.useState<MarksPack>(emptyPack)
  const [ready, setReady] = React.useState(!enabled)
  const [saveState, setSaveState] = React.useState<MarksSaveState>('idle')
  const [staleDropped, setStaleDropped] = React.useState(false)
  const [hidden, setHidden] = React.useState(false)
  const [undoDepth, setUndoDepth] = React.useState(0)
  const undoStack = React.useRef<MarksPack[]>([])
  const dirty = React.useRef(false)
  const timer = React.useRef<number | null>(null)
  const live = React.useRef({ examId, teilKey, pack, enabled })
  live.current = { examId, teilKey, pack, enabled }
  const textsRef = React.useRef(texts)
  textsRef.current = texts

  // ── tải ──────────────────────────────────────────────────────────────────
  React.useEffect(() => {
    undoStack.current = []
    setUndoDepth(0)
    dirty.current = false
    setPack(emptyPack())
    setStaleDropped(false)
    if (!enabled || !teilKey) {
      setReady(true)
      return
    }
    setReady(false)
    let cancelled = false
    getPracticeMarks(examId, teilKey)
      .then((res) => {
        if (cancelled) return
        const { pack: clean, dropped } = dropStale(parsePack(res.marks), textsRef.current)
        setPack(clean)
        setStaleDropped(dropped)
        if (dropped) {
          dirty.current = true // lưu lại bản đã bỏ khối lệch
          schedule()
        }
      })
      .catch(() => {
        /* chưa tải được: bắt đầu trống, lần lưu sau ghi đè — giống bản nháp đáp án */
      })
      .finally(() => !cancelled && setReady(true))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId, teilKey, enabled])

  // ── lưu ──────────────────────────────────────────────────────────────────
  const flush = React.useCallback(async () => {
    const l = live.current
    if (!l.enabled || !l.teilKey || !dirty.current) return
    dirty.current = false
    setSaveState('saving')
    try {
      await savePracticeMarks(l.examId, l.teilKey, l.pack)
      setSaveState(dirty.current ? 'saving' : 'saved')
    } catch {
      dirty.current = true
      setSaveState('error')
    }
  }, [])

  const schedule = React.useCallback(() => {
    if (timer.current != null) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      timer.current = null
      void flush()
    }, MARKS_AUTOSAVE_MS)
  }, [flush])

  // Đóng / ẩn tab: gửi bằng keepalive (axios chết theo trang).
  React.useEffect(() => {
    const leave = () => {
      const l = live.current
      if (!dirty.current || !l.enabled || !l.teilKey) return
      dirty.current = false
      sendKeepalive('PUT', practiceMarksPath(l.examId, l.teilKey), { marks: l.pack })
    }
    const onVisibility = () => document.visibilityState === 'hidden' && leave()
    window.addEventListener('pagehide', leave)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('pagehide', leave)
      document.removeEventListener('visibilitychange', onVisibility)
      if (timer.current != null) window.clearTimeout(timer.current)
      leave() // rời màn trong lúc chờ hẹn giờ
    }
  }, [])

  // Đọc gói mới nhất từ ref (không trong hàm cập nhật của setState: StrictMode gọi hàm đó hai lần
  // ⇒ ngăn hoàn tác bị đẩy đôi). Ghi lại vào ref ngay để hai thao tác liền nhau nối đúng.
  const apply = React.useCallback(
    (next: (p: MarksPack) => MarksPack) => {
      const cur = live.current.pack
      const out = next(cur)
      if (out === cur) return
      undoStack.current.push(cur)
      if (undoStack.current.length > MAX_UNDO) undoStack.current.shift()
      live.current.pack = out
      setPack(out)
      setUndoDepth(undoStack.current.length)
      dirty.current = true
      schedule()
    },
    [schedule],
  )

  const undo = React.useCallback(() => {
    const prev = undoStack.current.pop()
    setUndoDepth(undoStack.current.length)
    if (!prev) return
    live.current.pack = prev
    setPack(prev)
    dirty.current = true
    schedule()
  }, [schedule])

  const clearLocal = React.useCallback(() => {
    if (timer.current != null) window.clearTimeout(timer.current)
    dirty.current = false
    undoStack.current = []
    setUndoDepth(0)
    setPack(emptyPack())
    setSaveState('idle')
  }, [])

  return {
    ready,
    pack,
    texts,
    saveState,
    staleDropped,
    hidden,
    setHidden,
    apply,
    undo,
    canUndo: undoDepth > 0,
    clearLocal,
  }
}

export { hasContent }
