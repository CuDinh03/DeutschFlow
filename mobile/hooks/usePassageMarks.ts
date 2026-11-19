// Đánh dấu bài đọc của một Teil luyện (Đợt 4c, 19/11/2026) — tải gói đã lưu (web hoặc app), áp bút, tự
// lưu sau 0,8 giây ngưng chạm; app xuống nền hoặc rời màn thì lưu ngay. Tải lỗi thì KHÔNG cho tô (tô trên
// gói rỗng rồi lưu là xoá mất đánh dấu đã làm trên web), chỉ cho thử lại.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AppState } from 'react-native'
import { getPracticeMarks, savePracticeMarks } from '@/lib/telcPracticeApi'
import { applyPen, CONTEXT_BLOCK, dropStale, emptyPack, MAX_MARKS, parsePack, type MarksPack, type Pen, type Piece } from '@/lib/passageMarks'

export const MARKS_AUTOSAVE_MS = 800

export type MarksStatus = 'off' | 'loading' | 'ready' | 'error'

export function usePassageMarks({ examId, teilKey, context }: { examId: number; teilKey: string; context: string | null }) {
  const [pack, setPack] = useState<MarksPack>(emptyPack)
  const [status, setStatus] = useState<MarksStatus>(context ? 'loading' : 'off')
  const [dropped, setDropped] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const latest = useRef(pack)
  const dirty = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const texts = useMemo(() => {
    const out: Record<string, string> = {}
    if (context) out[CONTEXT_BLOCK] = context
    return out
  }, [context])

  useEffect(() => {
    if (!context || !Number.isFinite(examId)) {
      setStatus('off')
      return
    }
    let alive = true
    setStatus('loading')
    getPracticeMarks(examId, teilKey)
      .then((res) => {
        if (!alive) return
        const fresh = dropStale(parsePack(res?.marks), { [CONTEXT_BLOCK]: context })
        latest.current = fresh.pack
        setPack(fresh.pack)
        setDropped(fresh.dropped)
        setStatus('ready')
      })
      .catch(() => {
        if (alive) setStatus('error')
      })
    return () => {
      alive = false
    }
  }, [examId, teilKey, context, attempt])

  // Lưu NỐI ĐUÔI: đang có một PUT bay thì chỉ đánh dấu bẩn, xong lượt này mới lưu tiếp — hai PUT chồng
  // nhau mà tới server sai thứ tự thì gói cũ thắng (server ghi đè cả gói).
  const saving = useRef(false)
  const flush = useCallback(async () => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
    if (saving.current || !dirty.current) return
    saving.current = true
    try {
      while (dirty.current) {
        dirty.current = false
        try {
          await savePracticeMarks(examId, teilKey, latest.current)
          setSaveFailed(false)
        } catch {
          dirty.current = true
          setSaveFailed(true)
          break
        }
      }
    } finally {
      saving.current = false
    }
  }, [examId, teilKey])

  /** Áp bút lên một câu. Trả `false` khi chưa áp được (chưa tải xong, hoặc đã đủ giới hạn đánh dấu). */
  const apply = useCallback(
    (piece: Piece, pen: Pen): boolean => {
      if (status !== 'ready') return false
      const next = applyPen(latest.current, texts, piece, pen)
      // Chặn theo gói MỚI: một lần chạm có thể tách mảnh (+1) và thêm mảnh (+1) ⇒ vượt 300, server trả 400.
      if (next.marks.length > latest.current.marks.length && next.marks.length > MAX_MARKS) return false
      latest.current = next
      setPack(next)
      dirty.current = true
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => void flush(), MARKS_AUTOSAVE_MS)
      return true
    },
    [status, texts, flush],
  )

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') void flush()
    })
    return () => {
      sub.remove()
      void flush()
    }
  }, [flush])

  const retry = useCallback(() => setAttempt((n) => n + 1), [])

  return { pack, status, dropped, saveFailed, apply, flush, retry }
}
