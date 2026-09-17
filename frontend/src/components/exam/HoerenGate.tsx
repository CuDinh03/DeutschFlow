'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Headphones, Timer } from 'lucide-react'
import { speakExamLine, stopExamTts } from '@/components/features/exam-speaking/examTts'
import { NARRATOR_ROLE, type HoerenGatePhase, type HoerenGateSpec } from './audioScript'

interface HoerenGateProps {
  teilNo: number
  spec: HoerenGateSpec
  phase: HoerenGatePhase
  onPhaseChange: (phase: HoerenGatePhase) => void
}

/**
 * Cổng nghi thức của một Teil nghe telc: bấm bắt đầu → giọng người dẫn đọc Ansage → đếm ngược
 * thời gian đọc câu hỏi (nút nghe khoá) → đọc câu khung (Teil 1) → nghe được.
 *
 * Vì sao phải có: băng đề thật cho đúng 30 giây (Teil 1) / một phút (Teil 2) để đọc câu hỏi trước
 * khi phát, và bài Teil 1 chỉ phát MỘT lần. Học viên luyện trên app mà đọc câu hỏi thoải mái rồi
 * mới bấm nghe là đang luyện một bài dễ hơn bài sẽ thi — rồi bất ngờ trong phòng thi.
 *
 * Đọc bằng đúng cascade giọng phòng thi (`speakExamLine`): server TTS hỏng thì rơi xuống giọng máy,
 * giọng máy cũng không có thì lời hứa của `speakExamLine` vẫn resolve ⇒ cổng KHÔNG BAO GIỜ kẹt ở
 * pha đọc. Rời trang giữa chừng thì dừng giọng.
 */
export function HoerenGate({ teilNo, spec, phase, onPhaseChange }: HoerenGateProps) {
  const t = useTranslations('v2.student.mockExamRun')
  const [secondsLeft, setSecondsLeft] = useState(spec.readingSeconds)
  const runRef = useRef(0)
  const phaseRef = useRef(phase)
  phaseRef.current = phase

  useEffect(() => () => { runRef.current += 1; stopExamTts() }, [])

  const countdown = useCallback((run: number) =>
    new Promise<void>((resolve) => {
      let left = spec.readingSeconds
      setSecondsLeft(left)
      if (left <= 0) { resolve(); return }
      const timer = setInterval(() => {
        if (runRef.current !== run) { clearInterval(timer); resolve(); return }
        left -= 1
        setSecondsLeft(left)
        if (left <= 0) { clearInterval(timer); resolve() }
      }, 1000)
    }), [spec.readingSeconds])

  const start = useCallback(async () => {
    if (phaseRef.current !== 'idle') return
    runRef.current += 1
    const run = runRef.current
    onPhaseChange('ansage')
    await speakExamLine(NARRATOR_ROLE, spec.ansage)
    if (runRef.current !== run) return
    if (spec.readingSeconds > 0) {
      onPhaseChange('reading')
      await countdown(run)
      if (runRef.current !== run) return
    }
    if (spec.framing) {
      onPhaseChange('framing')
      await speakExamLine(NARRATOR_ROLE, spec.framing)
      if (runRef.current !== run) return
    }
    onPhaseChange('ready')
  }, [spec, countdown, onPhaseChange])

  return (
    <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4" role="status" aria-live="polite">
      <div className="flex flex-wrap items-center gap-3">
        {phase === 'idle' ? (
          <button
            type="button"
            onClick={start}
            className="ga-ui inline-flex min-h-11 items-center gap-2 rounded-ga bg-ga-ink px-4 text-ga-small font-semibold text-white transition-opacity hover:opacity-90"
          >
            <Headphones size={16} aria-hidden /> {t('hoerenStart', { n: teilNo })}
          </button>
        ) : (
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-200 text-amber-900">
            {phase === 'reading' ? <Timer size={18} aria-hidden /> : <Headphones size={18} aria-hidden />}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="ga-ui text-ga-body font-semibold text-amber-900">
            {phase === 'idle' && t('hoerenHidden')}
            {phase === 'ansage' && t('hoerenAnsage')}
            {phase === 'reading' && t('hoerenReading', { s: secondsLeft })}
            {phase === 'framing' && t('hoerenFraming')}
            {phase === 'ready' && t('hoerenReady')}
          </p>
          {phase === 'idle' && spec.readingSeconds > 0 && (
            <p className="ga-ui mt-0.5 text-ga-caption text-amber-800">
              {t('hoerenIdleHint', { s: spec.readingSeconds })}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
