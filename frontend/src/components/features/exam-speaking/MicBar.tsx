'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Mic, Square, Keyboard, Send, Loader2 } from 'lucide-react'
import { DEFAULT_MAX_RECORDING_MS, startRecorder, type RecorderHandle } from '@/lib/voiceRecorder'
import { classifyMicError, type MicErrorKind } from '@/lib/micErrors'
import { useMicPermission } from '@/hooks/useMicPermission'
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

/** mm:ss cho đồng hồ đếm ngược của lượt thu. */
function mmss(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

/** Thanh thu âm bấm-để-nói / bấm-để-gửi + fallback bàn phím (drill). Trạng thái qua role="status". */
export function MicBar({ disabled, busy, allowText, onAudio, onText, hint }: Props) {
  const t = useTranslations('v2.student.examSpeaking.mic')
  const [recording, setRecording] = useState(false)
  const [remainingMs, setRemainingMs] = useState(DEFAULT_MAX_RECORDING_MS)
  const [textMode, setTextMode] = useState(false)
  const [text, setText] = useState('')
  const [error, setError] = useState<{ kind: MicErrorKind; message: string } | null>(null)
  const recorderRef = useRef<RecorderHandle | null>(null)
  const micPermission = useMicPermission()

  // `onAudio` của ExamRoom đổi identity mỗi lần session thay đổi, nhưng callback đã nằm trong
  // recorder từ lúc bắt đầu thu. Đi qua ref để lượt nộp luôn dùng bản mới nhất thay vì bản
  // đóng băng lúc bấm mic (nếu không, applyTurn ghép lượt vào đúng Teil cũ).
  const onAudioRef = useRef(onAudio)
  onAudioRef.current = onAudio

  // Chống bấm kép: `start()` có một khe `await` (getUserMedia) mà trong đó nút vẫn còn trên màn
  // hình. Hai lần chạm nhanh trên mobile sẽ tạo HAI MediaRecorder trên hai stream, ref chỉ giữ
  // cái sau — cái trước thu mãi không ai dừng và giữ mic sáng. Cờ này khoá ngay từ lần chạm đầu.
  const startingRef = useRef(false)
  const unmountedRef = useRef(false)

  useEffect(() => {
    unmountedRef.current = false
    // Unmount = huỷ, KHÔNG phải dừng-và-nộp: người dùng rời màn hình thì lượt nói dở dang không
    // được tự gửi (và setState sau unmount cũng không hợp lệ). `cancel()` vẫn trả mic về OS.
    return () => {
      unmountedRef.current = true
      recorderRef.current?.cancel()
      recorderRef.current = null
    }
  }, [])

  // Người dùng vừa cấp quyền trong cài đặt trình duyệt → lỗi "denied" hết hiệu lực, tự dọn (QS-1).
  useEffect(() => {
    if (micPermission === 'granted') {
      setError((prev) => (prev?.kind === 'denied' ? null : prev))
    }
  }, [micPermission])

  const start = useCallback(async () => {
    if (startingRef.current || recorderRef.current) return
    startingRef.current = true
    setError(null)
    setRemainingMs(DEFAULT_MAX_RECORDING_MS)
    try {
      const handle = await startRecorder(
        (blob) => {
          recorderRef.current = null
          setRecording(false)
          setRemainingMs(DEFAULT_MAX_RECORDING_MS)
          // Recorder bảo đảm callback này chạy tối đa MỘT lần cho mỗi lần thu, nên dù hết giờ
          // và người dùng bấm dừng cùng lúc thì lượt vẫn chỉ nộp một lần.
          if (blob.size > 0) {
            void onAudioRef.current(blob)
            return
          }
          // Không nộp blob rỗng — nhưng cũng KHÔNG được im lặng. Trước đây nhánh này trả UI về
          // trạng thái nghỉ không một lời nào: học viên nói xong, bấm dừng, và không có gì xảy
          // ra. Mic bị OS thu hồi giữa chừng hoặc watchdog chốt sổ trước khi có chunk nào đều
          // rơi vào đây, nên phải hiện lỗi có nút thử lại.
          setError({ kind: 'unknown', message: t('errors.unknown') })
        },
        {
          maxDurationMs: DEFAULT_MAX_RECORDING_MS,
          // Recorder tick nhanh hơn giây để đồng hồ không trễ nhịp, nhưng chỉ nhận state khi chữ
          // số hiển thị thật sự đổi — 180 lần render thay vì 720 trong ba phút cầm máy.
          onTick: (elapsed) =>
            setRemainingMs((prev) => {
              const next = Math.max(0, DEFAULT_MAX_RECORDING_MS - elapsed)
              return Math.ceil(prev / 1000) === Math.ceil(next / 1000) ? prev : next
            }),
        },
      )
      // Component đã unmount trong lúc chờ getUserMedia → huỷ ngay, đừng để mic sáng mồ côi.
      if (unmountedRef.current) {
        handle.cancel()
        return
      }
      recorderRef.current = handle
      setRecording(true)
    } catch (e) {
      const info = classifyMicError(e)
      setError({ kind: info.kind, message: t(`errors.${info.kind}`) })
      setTextMode(allowText)
    } finally {
      startingRef.current = false
    }
  }, [allowText, t])

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
        {busy ? (
          t('sending')
        ) : recording ? (
          // tabular-nums + span riêng: đồng hồ đổi mỗi giây mà không làm câu chữ nhảy trên mobile.
          <>
            {t('recording')}{' '}
            <span className="font-semibold tabular-nums text-ga-ink" data-testid="mic-remaining">
              {mmss(remainingMs)}
            </span>
          </>
        ) : (
          hint
        )}
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
      {error && (
        <div className="mt-2" data-testid="mic-error">
          <p className="ga-ui text-[12.5px] text-ga-red">{error.message}</p>
          {error.kind === 'denied' && (
            <ol className="ga-ui mt-1.5 list-decimal space-y-0.5 pl-5 text-[12.5px] text-ga-muted" data-testid="mic-denied-steps">
              <li>{t('deniedSteps.site')}</li>
              <li>{t('deniedSteps.browser')}</li>
              <li>{t('deniedSteps.os')}</li>
            </ol>
          )}
          <button
            type="button"
            className="ga-ui mt-1.5 text-[12.5px] font-semibold text-ga-ink underline underline-offset-2"
            onClick={() => {
              setTextMode(false)
              void start()
            }}
            data-testid="mic-retry"
          >
            {t('retry')}
          </button>
        </div>
      )}
    </div>
  )
}
