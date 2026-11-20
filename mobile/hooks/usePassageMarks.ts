// Bút đánh dấu của một Teil (Đợt 4c 19/11, mở rộng Đợt 4f 20/11/2026) — bản app của `usePassageMarks` web.
// Nơi lưu: luyện Teil (`/mock-exams/practice/{examId}/teile/{key}/marks`, bài chẩn đoán dùng chung) hoặc
// một lượt thi thử (`/mock-exams/attempts/{attemptId}/teile/{key}/marks`). Tải gói đã lưu (web hoặc app),
// áp bút, hoàn tác, ẩn tạm; lưu qua `createMarksSaver` (lib/marksSaver.ts: hẹn giờ, nối đuôi, phân loại
// lỗi). Tải lỗi thì KHÔNG cho tô (tô trên gói rỗng rồi lưu là xoá mất đánh dấu đã làm trên web).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AppState } from 'react-native'
import { getAttemptMarks, getPracticeMarks, saveAttemptMarks, savePracticeMarks } from '@/lib/telcPracticeApi'
import { applyPen, applyPenWord, dropStale, emptyPack, isStruck, MAX_MARKS, parsePack, setStruck, type MarksPack, type Pen, type Piece } from '@/lib/passageMarks'
import { createMarksSaver, createUndoStack, type MarksSaver, type MarksSaveState } from '@/lib/marksSaver'

export { MARKS_AUTOSAVE_MS, type MarksSaveState } from '@/lib/marksSaver'

export type MarksStatus = 'off' | 'loading' | 'ready' | 'error'

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

const NO_STRIKE: Record<string, string[]> = {}

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
  /** Áp bút đang chọn lên cả một câu (nhấn giữ). */
  tap: (piece: Piece) => void
  /** Áp bút đang chọn lên một từ (chạm) — nối với mảnh cùng bút liền kề, như bôi chọn trên web. */
  tapWord: (piece: Piece) => void
  isStruck: (itemId: string, opt: string) => boolean
  /** Phương án này gạch bỏ được không (luật server: câu có `options` riêng dạng đối tượng). */
  canStrike: (itemId: string, opt: string) => boolean
  /** Gạch bỏ / bỏ gạch một phương án. */
  toggleStrike: (itemId: string, opt: string) => void
  /** Lưu ngay phần chưa lưu (rời màn). */
  flush: () => Promise<void>
}

export function usePassageMarks({
  source,
  texts,
  strike = NO_STRIKE,
}: {
  source: MarksSource | null
  texts: Record<string, string>
  /** Phương án gạch bỏ được theo câu (`lib/marksBlocks.strikeOptions`). */
  strike?: Record<string, string[]>
}): MarksLayer {
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
  const undoStack = useRef(createUndoStack<MarksPack>())
  const latest = useRef(pack)
  const saver = useRef<MarksSaver<MarksPack> | null>(null)
  const sourceRef = useRef(source)
  sourceRef.current = source
  const textsRef = useRef(texts)
  textsRef.current = texts

  // Một bộ lưu cho mỗi nguồn; đổi nguồn / rời màn thì lưu nốt vào nguồn cũ rồi đóng.
  useEffect(() => {
    const src = sourceRef.current
    if (!src) return
    const s = createMarksSaver<MarksPack>({ save: (p) => save(src, p), onState: setSaveState })
    saver.current = s
    setSaveState('idle')
    return () => {
      if (saver.current === s) saver.current = null
      void s.close()
    }
  }, [key])

  useEffect(() => {
    undoStack.current.clear()
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

  const flush = useCallback(async () => {
    await saver.current?.flush()
  }, [])

  const commit = useCallback((next: MarksPack) => {
    const cur = latest.current
    if (next === cur) return
    undoStack.current.push(cur)
    setUndoDepth(undoStack.current.depth())
    latest.current = next
    setPack(next)
    saver.current?.change(next)
  }, [])

  const editable = status === 'ready' && !hidden

  const applyWith = useCallback(
    (piece: Piece, fn: typeof applyPen) => {
      if (!editable) return
      const cur = latest.current
      const next = fn(cur, textsRef.current, piece, pen)
      // Chặn theo gói MỚI: một lần chạm có thể tách mảnh (+1) và thêm mảnh (+1) ⇒ vượt 300, server trả 400.
      const over = next.marks.length > cur.marks.length && next.marks.length > MAX_MARKS
      setFull(over)
      if (!over) commit(next)
    },
    [editable, pen, commit],
  )
  const tap = useCallback((piece: Piece) => applyWith(piece, applyPen), [applyWith])
  const tapWord = useCallback((piece: Piece) => applyWith(piece, applyPenWord), [applyWith])

  const canStrike = useCallback((itemId: string, opt: string) => strike[itemId]?.includes(opt) ?? false, [strike])

  const toggleStrike = useCallback(
    (itemId: string, opt: string) => {
      // Như `tap`: đang ẩn đánh dấu thì không sửa gì (gạch bỏ cũng là đánh dấu).
      if (!editable || !canStrike(itemId, opt)) return
      const cur = latest.current
      commit(setStruck(cur, itemId, opt, !isStruck(cur, itemId, opt)))
    },
    [editable, canStrike, commit],
  )

  const undo = useCallback(() => {
    if (!editable) return
    const prev = undoStack.current.pop()
    setUndoDepth(undoStack.current.depth())
    if (!prev) return
    latest.current = prev
    setPack(prev)
    setFull(false)
    saver.current?.change(prev)
  }, [editable])

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') void flush()
    })
    return () => sub.remove()
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
      tapWord,
      isStruck: struck,
      canStrike,
      toggleStrike,
      flush,
    }),
    [pack, texts, status, pen, hidden, dropped, saveState, full, undoDepth, undo, retry, tap, tapWord, struck, canStrike, toggleStrike, flush],
  )
}
