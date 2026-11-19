// Tự lưu nháp một Teil luyện đề (Đợt 4, 19/11/2026) — bản RN của `usePracticeDraft` web: lưu sau
// 1,5 giây ngưng thao tác; app xuống nền (thay cho `pagehide` của web) hoặc rời màn thì lưu ngay bản
// mới nhất, kể cả khi chỉ đồng hồ đổi (đọc bài lâu mà chưa chạm câu nào vẫn giữ được thời gian).
// Lưu xong thì ghi tiến độ máy chủ trả về vào bộ nhớ đệm để mở lại Teil không nạp bản cũ.
// Lỗi mạng khi lưu nháp không chặn học viên: lần đổi sau hoặc lúc kiểm tra sẽ gửi lại.

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { AppState } from 'react-native'
import { savePracticeDraft, type PracticeProgress } from '@/lib/telcPracticeApi'

export const PRACTICE_AUTOSAVE_MS = 1500

export interface DraftState {
  answers: Record<string, string>
  seconds: number
}

interface Options {
  examId: number
  teilKey: string
  /**
   * Tắt khi chưa nạp xong tiến độ (gửi lúc đó là ghi đè nháp trên máy chủ bằng bài rỗng) và khi Teil
   * đã kiểm tra (server bỏ qua nháp).
   */
  enabled: boolean
  /** Bản mới nhất trên màn (câu trả lời + đồng hồ), đọc lúc app xuống nền hoặc rời màn. */
  latest: { current: DraftState }
  onSaved?: (progress: PracticeProgress) => void
}

export function usePracticeDraft({ examId, teilKey, enabled, latest, onSaved }: Options) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dirty = useRef(false)
  const lastSent = useRef<string | null>(null)
  // Tăng ở mỗi `reset()`: lượt lưu đang bay của thế hệ trước không được hồi sinh nháp cũ.
  const generation = useRef(0)
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled
  const onSavedRef = useRef(onSaved)
  onSavedRef.current = onSaved

  const flush = useCallback(async () => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
    if (!enabledRef.current || !Number.isFinite(examId)) return
    const snap = latest.current
    const sig = JSON.stringify(snap)
    // Không có gì mới (kể cả đồng hồ) thì thôi.
    if (!dirty.current && sig === lastSent.current) return
    const gen = generation.current
    dirty.current = false
    try {
      const saved = await savePracticeDraft(examId, teilKey, snap.answers, snap.seconds)
      if (gen !== generation.current) return
      lastSent.current = sig
      if (saved) onSavedRef.current?.(saved)
    } catch {
      // Giữ cờ để lần sau gửi tiếp — trừ khi đã làm lại Teil trong lúc chờ.
      if (gen === generation.current) dirty.current = true
    }
  }, [examId, teilKey, latest])

  /** Có thay đổi câu trả lời: hẹn lưu sau 1,5 giây ngưng thao tác. */
  const schedule = useCallback(() => {
    if (!enabledRef.current) return
    dirty.current = true
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => void flush(), PRACTICE_AUTOSAVE_MS)
  }, [flush])

  /** Bỏ nháp đang chờ (sau khi kiểm tra hoặc làm lại). */
  const reset = useCallback(() => {
    generation.current += 1
    dirty.current = false
    lastSent.current = null
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }, [])

  /** Bản vừa nạp từ máy chủ coi như đã lưu (không gửi lại khi chưa có gì đổi). */
  const baseline = useCallback(() => {
    lastSent.current = JSON.stringify(latest.current)
    dirty.current = false
  }, [latest])

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') void flush()
    })
    return () => {
      sub.remove()
      void flush()
    }
  }, [flush])

  // Đối tượng ổn định: màn dùng nó trong deps của effect/focus effect.
  return useMemo(() => ({ schedule, flush, reset, baseline }), [schedule, flush, reset, baseline])
}
