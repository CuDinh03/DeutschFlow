'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Mic, CheckCircle2 } from 'lucide-react'
import { classifyMicError } from '@/lib/micErrors'
import { GaBtn } from '@/components/ui-v2'

interface Props {
  /** Gọi khi mic mở được thành công (stream cấp quyền OK). */
  onPassed: () => void
  passed: boolean
}

const METER_BARS = 12
const CHECK_MS = 2500

/**
 * Mic-Check trước mock (N0.7): mock CHỈ nhận audio và đồng hồ Teil là giờ thật, nên phải chứng
 * minh mic mở được TRƯỚC khi vào phòng — không để cháy phiên vì quyền trình duyệt/OS.
 * Mở stream ~2,5s + vẽ mức âm qua AnalyserNode để người dùng thấy mic thật sự nghe được mình.
 */
export function MicCheck({ onPassed, passed }: Props) {
  const t = useTranslations('v2.student.examSpeaking.micCheck')
  const [checking, setChecking] = useState(false)
  const [level, setLevel] = useState(0)
  const [heard, setHeard] = useState(false)
  const [errorKind, setErrorKind] = useState<string | null>(null)
  const cleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => () => cleanupRef.current?.(), [])

  const start = useCallback(async () => {
    setErrorKind(null)
    setChecking(true)
    setHeard(false)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const ctx = new Ctx()
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      ctx.createMediaStreamSource(stream).connect(analyser)
      const data = new Uint8Array(analyser.frequencyBinCount)
      let raf = 0
      const tick = () => {
        analyser.getByteTimeDomainData(data)
        let peak = 0
        for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i] - 128) / 128)
        setLevel(peak)
        if (peak > 0.06) setHeard(true)
        raf = requestAnimationFrame(tick)
      }
      tick()
      const stop = () => {
        cancelAnimationFrame(raf)
        stream.getTracks().forEach((tr) => tr.stop())
        void ctx.close()
        cleanupRef.current = null
      }
      cleanupRef.current = stop
      window.setTimeout(() => {
        stop()
        setChecking(false)
        // Mở được stream = quyền OK = đạt; mức âm chỉ là phản hồi trực quan thêm.
        onPassed()
      }, CHECK_MS)
    } catch (e) {
      setChecking(false)
      setErrorKind(classifyMicError(e).kind)
    }
  }, [onPassed])

  if (passed) {
    return (
      <p className="ga-ui flex items-center gap-2 text-[13.5px] font-semibold text-ga-green" data-testid="mic-check-passed">
        <CheckCircle2 size={16} aria-hidden /> {t('passed')}
      </p>
    )
  }

  return (
    <div className="rounded-ga border border-ga-line bg-ga-card p-4" data-testid="mic-check">
      <p className="ga-ui mb-2 text-[13.5px] font-semibold text-ga-ink">{t('title')}</p>
      <p className="ga-ui mb-3 text-[13px] text-ga-muted">{t('desc')}</p>
      {checking ? (
        <div className="flex items-center gap-2" data-testid="mic-check-meter" aria-live="polite">
          <Mic size={16} aria-hidden className="text-ga-red" />
          <div className="flex h-6 flex-1 items-end gap-0.5">
            {Array.from({ length: METER_BARS }, (_, i) => (
              <span
                key={i}
                className={`w-full rounded-sm transition-[height] duration-75 ${level * METER_BARS > i ? 'bg-ga-green' : 'bg-ga-line'}`}
                style={{ height: `${20 + i * 6}%` }}
              />
            ))}
          </div>
          <span className="ga-ui text-[12.5px] text-ga-muted">{heard ? t('heard') : t('speakNow')}</span>
        </div>
      ) : (
        <GaBtn variant="ink" size="md" onClick={() => void start()} data-testid="mic-check-start">
          <Mic size={15} aria-hidden className="mr-1.5" /> {t('start')}
        </GaBtn>
      )}
      {errorKind && (
        <p className="ga-ui mt-2 text-[12.5px] text-ga-red" data-testid="mic-check-error">
          {t(`failed.${errorKind === 'denied' ? 'denied' : 'other'}`)}
        </p>
      )}
    </div>
  )
}
