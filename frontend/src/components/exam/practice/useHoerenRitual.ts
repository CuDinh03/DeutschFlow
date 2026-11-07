'use client'

import * as React from 'react'
import { speakExamLine, stopExamTts } from '@/components/features/exam-speaking/examTts'
import { NARRATOR_ROLE, type HoerenGateSpec } from '@/components/exam/audioScript'

/**
 * Các bước của một Teil nghe (đợt (b), 07/11/2026): `prep` chuẩn bị (chưa bắt đầu, câu hỏi ẩn) →
 * `ansage` giọng người dẫn đọc hướng dẫn → `reading` đếm ngược đọc câu hỏi → `framing` câu khung
 * (Teil 1) → `listen` được nghe. Teil không khai nghi thức (đề Goethe) đi thẳng từ `prep` sang `listen`.
 */
export type RitualPhase = 'prep' | 'ansage' | 'reading' | 'framing' | 'listen'

/**
 * Điều khiển nghi thức của Teil nghe. `enabled = false` (luyện thoải mái, hoặc đã kiểm tra) thì
 * không có nghi thức: vào thẳng `listen`. Bật lại thì quay về `prep`.
 *
 * Giọng đọc dùng đúng `speakExamLine` của phòng thi (server TTS, hỏng thì giọng máy, không có giọng
 * thì lời hứa vẫn resolve) ⇒ không bao giờ kẹt ở một bước. `skip` bỏ bước đang chạy và đi tiếp —
 * chỉ cho ở chế độ luyện. Rời màn giữa chừng thì dừng giọng.
 */
export function useHoerenRitual(spec: HoerenGateSpec | null, enabled: boolean) {
  const [phase, setPhase] = React.useState<RitualPhase>(enabled ? 'prep' : 'listen')
  const [secondsLeft, setSecondsLeft] = React.useState(spec?.readingSeconds ?? 0)
  const runRef = React.useRef(0)

  const steps = React.useMemo<RitualPhase[]>(() => {
    const list: RitualPhase[] = []
    if (spec) {
      list.push('ansage')
      if (spec.readingSeconds > 0) list.push('reading')
      if (spec.framing) list.push('framing')
    }
    list.push('listen')
    return list
  }, [spec])

  React.useEffect(() => () => {
    runRef.current += 1
    stopExamTts()
  }, [])

  // Đổi chế độ (thi thật ⇄ thoải mái) thì huỷ bước đang chạy và đặt lại từ đầu.
  React.useEffect(() => {
    runRef.current += 1
    stopExamTts()
    setPhase(enabled ? 'prep' : 'listen')
    setSecondsLeft(spec?.readingSeconds ?? 0)
  }, [enabled, spec])

  const countdown = React.useCallback(
    (run: number) =>
      new Promise<void>((resolve) => {
        let left = spec?.readingSeconds ?? 0
        setSecondsLeft(left)
        if (left <= 0) {
          resolve()
          return
        }
        const timer = window.setInterval(() => {
          if (runRef.current !== run) {
            window.clearInterval(timer)
            resolve()
            return
          }
          left -= 1
          setSecondsLeft(left)
          if (left <= 0) {
            window.clearInterval(timer)
            resolve()
          }
        }, 1000)
      }),
    [spec],
  )

  const runFrom = React.useCallback(
    async (index: number) => {
      runRef.current += 1
      const run = runRef.current
      stopExamTts()
      for (let i = index; i < steps.length; i++) {
        if (runRef.current !== run) return
        const step = steps[i]
        setPhase(step)
        if (step === 'ansage') await speakExamLine(NARRATOR_ROLE, spec?.ansage ?? '')
        else if (step === 'reading') await countdown(run)
        else if (step === 'framing') await speakExamLine(NARRATOR_ROLE, spec?.framing ?? '')
        else return
      }
    },
    [steps, spec, countdown],
  )

  const begin = React.useCallback(() => {
    if (phase === 'prep') void runFrom(0)
  }, [phase, runFrom])

  const skip = React.useCallback(() => {
    const i = steps.indexOf(phase)
    if (i >= 0 && phase !== 'listen') void runFrom(i + 1)
  }, [phase, steps, runFrom])

  return { phase, secondsLeft, steps, begin, skip }
}
