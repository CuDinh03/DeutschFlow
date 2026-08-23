'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Mic, Square, Keyboard, Send, Loader2 } from 'lucide-react'
import { startRecorder, type RecorderHandle } from '@/lib/voiceRecorder'
import { classifyMicError } from '@/lib/micErrors'
import { GaBtn } from '@/components/ui-v2'

interface Props {
  disabled: boolean
  busy: boolean
  /** Cho phép nhập text thay mic (drill; mock chỉ nhận audio — chống dán văn bản). */
  allowText: boolean
  onAudio: (blob: Blob) => Promise<void>
  onText: (text: string) => Promise<void>
  hint: string
}

/** Thanh thu âm bấm-để-nói / bấm-để-gửi + fallback bàn phím (drill). Trạng thái qua role="status". */
export function MicBar({ disabled, busy, allowText, onAudio, onText, hint }: Props) {
  const t = useTranslations('v2.student.examSpeaking.mic')
  const [recording, setRecording] = useState(false)
  const [textMode, setTextMode] = useState(false)
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const recorderRef = useRef<RecorderHandle | null>(null)

  useEffect(() => () => recorderRef.current?.stop(), [])

  const start = useCallback(async () => {
    setError(null)
    try {
      recorderRef.current = await startRecorder((blob) => {
        recorderRef.current = null
        setRecording(false)
        if (blob.size > 0) void onAudio(blob)
      })
      setRecording(true)
    } catch (e) {
      const info = classifyMicError(e)
      setError(t(`errors.${info.kind}`))
      setTextMode(allowText)
    }
  }, [allowText, onAudio, t])

  const stop = useCallback(() => {
    recorderRef.current?.stop()
  }, [])

  const submitText = useCallback(async () => {
    const v = text.trim()
    if (!v) return
    setText('')
    await onText(v)
  }, [onText, text])

  return (
    <div className="rounded-ga border border-ga-line bg-ga-card p-3" data-testid="mic-bar">
      <p className="ga-ui mb-2 text-[13px] text-ga-muted" role="status">
        {busy ? t('sending') : recording ? t('recording') : hint}
      </p>
      {textMode ? (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            void submitText()
          }}
        >
          <input
            className="ga-ui min-h-[44px] flex-1 rounded-ga border border-ga-line bg-ga-bg px-3 text-[14.5px] text-ga-ink"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t('textPlaceholder')}
            disabled={disabled || busy}
            aria-label={t('textPlaceholder')}
            data-testid="mic-text-input"
          />
          <GaBtn type="submit" variant="ink" size="lg" disabled={disabled || busy || !text.trim()} data-testid="mic-text-send">
            {busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Send size={16} aria-hidden />}
            <span className="ml-1.5">{t('send')}</span>
          </GaBtn>
          <GaBtn type="button" variant="ghost" size="lg" onClick={() => setTextMode(false)} aria-label={t('useMic')}>
            <Mic size={16} aria-hidden />
          </GaBtn>
        </form>
      ) : (
        <div className="flex items-center gap-2">
          {recording ? (
            <GaBtn type="button" variant="yellow" size="lg" className="flex-1" onClick={stop} data-testid="mic-stop">
              <Square size={16} aria-hidden />
              <span className="ml-2 inline-flex items-center gap-2">
                {t('stopSend')}
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ga-red opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-ga-red" />
                </span>
              </span>
            </GaBtn>
          ) : (
            <GaBtn type="button" variant="ink" size="lg" className="flex-1" onClick={() => void start()} disabled={disabled || busy} data-testid="mic-start">
              {busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Mic size={16} aria-hidden />}
              <span className="ml-2">{busy ? t('sending') : t('start')}</span>
            </GaBtn>
          )}
          {allowText && !recording && (
            <GaBtn type="button" variant="ghost" size="lg" onClick={() => setTextMode(true)} aria-label={t('useText')} data-testid="mic-text-mode">
              <Keyboard size={16} aria-hidden />
            </GaBtn>
          )}
        </div>
      )}
      {error && <p className="ga-ui mt-2 text-[12.5px] text-ga-red">{error}</p>}
    </div>
  )
}
