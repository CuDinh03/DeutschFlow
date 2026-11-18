// Tự lưu nháp một Teil luyện đề (Đợt 4, 19/11/2026) — bản RN của `usePracticeDraft` web: lưu sau
// 1,5 giây ngưng thao tác; app xuống nền (thay cho `pagehide` của web) hoặc rời màn thì lưu ngay.
// Lỗi mạng khi lưu nháp không chặn học viên: lần đổi sau hoặc lúc kiểm tra sẽ gửi lại.

import { useCallback, useEffect, useRef } from 'react'
import { AppState } from 'react-native'
import { savePracticeDraft } from '@/lib/telcPracticeApi'

export const PRACTICE_AUTOSAVE_MS = 1500

interface DraftState {
  answers: Record<string, string>
  seconds: number
}

export function usePracticeDraft(examId: number, teilKey: string, enabled: boolean) {
  const pending = useRef<DraftState | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const flush = useCallback(async () => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
    const next = pending.current
    pending.current = null
    if (!next || !Number.isFinite(examId)) return
    try {
      await savePracticeDraft(examId, teilKey, next.answers, next.seconds)
    } catch {
      // Giữ lại để lần sau gửi tiếp, trừ khi đã có bản mới hơn.
      pending.current = pending.current ?? next
    }
  }, [examId, teilKey])

  const schedule = useCallback(
    (answers: Record<string, string>, seconds: number) => {
      if (!enabled) return
      pending.current = { answers, seconds }
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => void flush(), PRACTICE_AUTOSAVE_MS)
    },
    [enabled, flush],
  )

  /** Bỏ nháp đang chờ (sau khi kiểm tra hoặc làm lại). */
  const reset = useCallback(() => {
    pending.current = null
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }, [])

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') void flush()
    })
    return () => {
      sub.remove()
      void flush()
    }
  }, [flush])

  return { schedule, flush, reset }
}
