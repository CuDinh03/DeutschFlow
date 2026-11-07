'use client'

import * as React from 'react'
import { savePracticeDraft } from '@/lib/telcPracticeApi'
import { sendKeepalive } from '@/lib/exam/keepalive'
import type { PracticeSaveState } from './PracticeShell'

export const PRACTICE_AUTOSAVE_MS = 1500

interface Options {
  examId: number
  /** Teil đang làm; `null` = không lưu (đang tải, phần Nói của bài chẩn đoán…). */
  teilKey: string | null
  /** Đáp án (trắc nghiệm) hoặc `{ text }` (Viết). Người gọi giữ nguyên tham chiếu khi không đổi. */
  payload: Record<string, string>
  /** Thời gian làm Teil (giây) lúc lưu. */
  elapsed: () => number
  /** Tắt khi Teil đã kiểm tra/chấm: không còn gì là nháp. */
  enabled: boolean
  /**
   * Teil đã có gì đáng lưu (một câu, một chữ, hoặc nháp cũ trên server). Không có thì rời màn KHÔNG
   * tạo hàng tiến độ rỗng — hàng đó sẽ làm Teil hiện "đang làm dở" dù chưa làm gì.
   */
  hasWork: boolean
}

export interface PracticeDraft {
  saveState: PracticeSaveState
  /** Gọi ngay khi người học đổi đáp án/chữ, trước khi đổi state (bật hẹn giờ lưu). */
  markDirty: () => void
  /** Lưu ngay nếu còn gì chưa lưu (đáp án hoặc thời gian). `false` = lưu lỗi, người gọi giữ màn. */
  flush: () => Promise<boolean>
  /** Bỏ trạng thái chưa lưu (sau khi kiểm tra, làm lại, đổi phần). */
  reset: () => void
}

/**
 * Nháp của chế độ luyện Teil và bài chẩn đoán (`PUT /mock-exams/practice/{examId}/teile/{key}/draft`).
 *
 * Sửa ba lỗ của bản cũ (phân tích 07/11/2026): (1) rời màn trong 1,5 s chờ lưu thì hẹn giờ bị huỷ và
 * lần lưu cuối mất — giờ rời màn gửi `keepalive`; (2) thời gian làm bài chỉ lưu khi đáp án đổi — giờ
 * `flush` và lần lưu lúc ẩn tab gửi cả thời gian; (3) đóng tab không lưu — giờ nghe `pagehide` và
 * `visibilitychange`. Server bỏ qua nháp đến muộn của Teil đã kiểm tra, nên lần gửi trễ không đè kết quả.
 */
export function usePracticeDraft({ examId, teilKey, payload, elapsed, enabled, hasWork }: Options): PracticeDraft {
  const [saveState, setSaveState] = React.useState<PracticeSaveState>('idle')
  const dirty = React.useRef(false)
  const pending = React.useRef(false)
  const seq = React.useRef(0)
  const savedSeconds = React.useRef<number | null>(null)

  const live = React.useRef({ examId, teilKey, payload, elapsed, enabled, hasWork })
  live.current = { examId, teilKey, payload, elapsed, enabled, hasWork }

  const needsSave = React.useCallback(() => {
    const l = live.current
    if (!l.enabled || !l.teilKey || !l.hasWork) return false
    // Thời gian lệch dưới 5 s không đáng một request (đồng hồ vừa nhích sau lần lưu lúc thoát).
    return pending.current || savedSeconds.current == null || Math.abs(savedSeconds.current - l.elapsed()) >= 5
  }, [])

  const save = React.useCallback(async (): Promise<boolean> => {
    const l = live.current
    if (!l.teilKey) return true
    const mine = ++seq.current
    const secs = l.elapsed()
    setSaveState('saving')
    try {
      await savePracticeDraft(l.examId, l.teilKey, l.payload, secs)
      if (mine === seq.current) {
        pending.current = false
        savedSeconds.current = secs
        setSaveState('saved')
      }
      return true
    } catch {
      if (mine === seq.current) setSaveState('error')
      return false
    }
  }, [])

  const markDirty = React.useCallback(() => {
    dirty.current = true
  }, [])

  const reset = React.useCallback(() => {
    dirty.current = false
    pending.current = false
    seq.current++
    savedSeconds.current = null
    setSaveState('idle')
  }, [])

  // Đổi Teil (bài chẩn đoán sang phần sau): mốc thời gian đã lưu thuộc Teil cũ.
  React.useEffect(() => {
    savedSeconds.current = null
  }, [teilKey])

  // Lưu sau 1,5 s yên lặng kể từ thay đổi cuối.
  React.useEffect(() => {
    if (!enabled || !teilKey || !dirty.current) return
    pending.current = true
    seq.current++
    setSaveState('saving')
    const id = window.setTimeout(() => void save(), PRACTICE_AUTOSAVE_MS)
    return () => window.clearTimeout(id)
  }, [payload, enabled, teilKey, save])

  const flush = React.useCallback(async () => (needsSave() ? save() : true), [needsSave, save])

  // Rời trang / ẩn tab / rời màn: phần chưa lưu đi bằng keepalive.
  React.useEffect(() => {
    const push = () => {
      if (!needsSave()) return
      const l = live.current
      sendKeepalive('PUT', `/mock-exams/practice/${l.examId}/teile/${l.teilKey}/draft`, {
        answers: l.payload,
        elapsedSeconds: l.elapsed(),
      })
      pending.current = false
      savedSeconds.current = l.elapsed()
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') push()
    }
    window.addEventListener('pagehide', push)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('pagehide', push)
      document.removeEventListener('visibilitychange', onVisibility)
      push()
    }
  }, [needsSave])

  return { saveState, markDirty, flush, reset }
}
