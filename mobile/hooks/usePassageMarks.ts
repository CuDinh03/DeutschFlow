// Bút đánh dấu của một Teil (Đợt 4c 19/11, mở rộng Đợt 4f 20/11/2026) — bản app của `usePassageMarks` web.
// Nơi lưu: luyện Teil (`/mock-exams/practice/{examId}/teile/{key}/marks`, bài chẩn đoán dùng chung) hoặc
// một lượt thi thử (`/mock-exams/attempts/{attemptId}/teile/{key}/marks`). Tải gói đã lưu (web hoặc app),
// áp bút, hoàn tác, ẩn tạm, tự lưu sau 0,8 giây ngưng chạm; app xuống nền hoặc rời màn thì lưu ngay.
// Tải lỗi thì KHÔNG cho tô (tô trên gói rỗng rồi lưu là xoá mất đánh dấu đã làm trên web), chỉ cho thử lại.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AppState } from 'react-native'
import { getAttemptMarks, getPracticeMarks, saveAttemptMarks, savePracticeMarks } from '@/lib/telcPracticeApi'
import { applyPen, dropStale, emptyPack, isStruck, MAX_MARKS, parsePack, setStruck, type MarksPack, type Pen, type Piece } from '@/lib/passageMarks'

export const MARKS_AUTOSAVE_MS = 800
const MAX_UNDO = 60

export type MarksStatus = 'off' | 'loading' | 'ready' | 'error'
export type MarksSaveState = 'idle' | 'saving' | 'saved' | 'error'

/** Nơi lưu gói: luyện Teil (một gói / người × đề × Teil) hoặc một lượt thi thử (một gói / lượt × Teil). */
export type MarksSource =
  | { kind: 'practice'; examId: number; teilKey: string }
  | { kind: 'attempt'; attemptId: number; teilKey: string }

function sourceKeyOf(s: MarksSource | null): string {
  if (!s) return ''
  return s.kind === 'practice' ? `p:${s.examId}:${s.teilKey}` : `a:${s.attemptId}:${s.teilKey}`
}

function load(s: MarksSource) {
  return s.kind === 'practice' ? getPracticeMarks(s.examId, s.teilKey) : getAttemptMarks(s.attemptId, s.teilKey)
}

function save(s: MarksSource, pack: MarksPack) {
  return s.kind === 'practice' ? savePracticeMarks(s.examId, s.teilKey, pack) : saveAttemptMarks(s.attemptId, s.teilKey, pack)
}

/** Lớp đánh dấu truyền xuống thân Teil (`ObjGroupView` nhận qua props — thân Teil không gọi hook). */
export interface MarksLayer {
  pack: MarksPack
  /** Chữ từng khối của Teil (`lib/marksBlocks.marksTexts`). */
  texts: Record<string, string>
  status: MarksStatus
  pen: Pen
  setPen: (pen: Pen) => void
  /** Ẩn tạm mọi đánh dấu để đọc lại bài sạch (không lưu). */
  hidden: boolean
  setHidden: (v: boolean) => void
  /** Lúc tải có khối đã đổi chữ ⇒ đánh dấu của khối đó bị bỏ (báo một dòng). */
  dropped: boolean
  saveState: MarksSaveState
  /** Lần chạm vừa rồi không áp được vì đã đủ giới hạn đánh dấu của server. */
  full: boolean
  canUndo: boolean
  undo: () => void
  retry: () => void
  /** Áp bút đang chọn lên một câu. */
  tap: (piece: Piece) => void
  isStruck: (itemId: string, opt: string) => boolean
  /** Gạch bỏ / bỏ gạch một phương án. */
  toggleStrike: (itemId: string, opt: string) => void
  /** Lưu ngay phần chưa lưu (rời màn). */
  flush: () => Promise<void>
}

export function usePassageMarks({ source, texts }: { source: MarksSource | null; texts: Record<string, string> }): MarksLayer {
  const key = sourceKeyOf(source)
  const [pack, setPack] = useState<MarksPack>(emptyPack)
  const [status, setStatus] = useState<MarksStatus>(source ? 'loading' : 'off')
  const [dropped, setDropped] = useState(false)
  const [saveState, setSaveState] = useState<MarksSaveState>('idle')
  const [pen, setPen] = useState<Pen>('y')
  const [hidden, setHidden] = useState(false)
  const [full, setFull] = useState(false)
  const [undoDepth, setUndoDepth] = useState(0)
  const [attempt, setAttempt] = useState(0)
  const undoStack = useRef<MarksPack[]>([])
  const latest = useRef(pack)
  const dirty = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sourceRef = useRef(source)
  sourceRef.current = source
  const textsRef = useRef(texts)
  textsRef.current = texts

  // Lưu NỐI ĐUÔI: đang có một PUT bay thì chỉ đánh dấu bẩn, xong lượt này mới lưu tiếp — hai PUT chồng
  // nhau mà tới server sai thứ tự thì gói cũ thắng (server ghi đè cả gói).
  const saving = useRef(false)
  const flush = useCallback(async () => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
    const src = sourceRef.current
    if (!src || saving.current || !dirty.current) return
    saving.current = true
    setSaveState('saving')
    try {
      while (dirty.current) {
        dirty.current = false
        try {
          await save(src, latest.current)
          setSaveState(dirty.current ? 'saving' : 'saved')
        } catch {
          dirty.current = true
          setSaveState('error')
          break
        }
      }
    } finally {
      saving.current = false
    }
  }, [])

  const schedule = useCallback(() => {
    dirty.current = true
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => void flush(), MARKS_AUTOSAVE_MS)
  }, [flush])

  useEffect(() => {
    undoStack.current = []
    setUndoDepth(0)
    setFull(false)
    const src = sourceRef.current
    if (!src) {
      setStatus('off')
      return
    }
    let alive = true
    setStatus('loading')
    load(src)
      .then((res) => {
        if (!alive) return
        const fresh = dropStale(parsePack(res?.marks), textsRef.current)
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
  }, [key, attempt])

  const commit = useCallback(
    (next: MarksPack) => {
      const cur = latest.current
      if (next === cur) return
      undoStack.current.push(cur)
      if (undoStack.current.length > MAX_UNDO) undoStack.current.shift()
      setUndoDepth(undoStack.current.length)
      latest.current = next
      setPack(next)
      schedule()
    },
    [schedule],
  )

  const tap = useCallback(
    (piece: Piece) => {
      if (status !== 'ready' || hidden) return
      const cur = latest.current
      const next = applyPen(cur, textsRef.current, piece, pen)
      // Chặn theo gói MỚI: một lần chạm có thể tách mảnh (+1) và thêm mảnh (+1) ⇒ vượt 300, server trả 400.
      const over = next.marks.length > cur.marks.length && next.marks.length > MAX_MARKS
      setFull(over)
      if (!over) commit(next)
    },
    [status, hidden, pen, commit],
  )

  const toggleStrike = useCallback(
    (itemId: string, opt: string) => {
      if (status !== 'ready') return
      const cur = latest.current
      commit(setStruck(cur, itemId, opt, !isStruck(cur, itemId, opt)))
    },
    [status, commit],
  )

  const undo = useCallback(() => {
    const prev = undoStack.current.pop()
    setUndoDepth(undoStack.current.length)
    if (!prev) return
    latest.current = prev
    setPack(prev)
    setFull(false)
    schedule()
  }, [schedule])

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
  const struck = useCallback((itemId: string, opt: string) => isStruck(pack, itemId, opt), [pack])

  return useMemo(
    () => ({
      pack,
      texts,
      status,
      pen,
      setPen,
      hidden,
      setHidden,
      dropped,
      saveState,
      full,
      canUndo: undoDepth > 0,
      undo,
      retry,
      tap,
      isStruck: struck,
      toggleStrike,
      flush,
    }),
    [pack, texts, status, pen, hidden, dropped, saveState, full, undoDepth, undo, retry, tap, struck, toggleStrike, flush],
  )
}
