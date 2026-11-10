'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { Mic, Square, Keyboard, Send, Loader2 } from 'lucide-react'
import { DEFAULT_MAX_RECORDING_MS, startRecorder, type RecorderHandle } from '@/lib/voiceRecorder'
import { classifyMicError, type MicErrorKind } from '@/lib/micErrors'
import { useMicPermission } from '@/hooks/useMicPermission'
import { createSilenceDetector, peakOf } from '@/lib/exam/silenceDetector'
import { GaBtn } from '@/components/ui-v2'

interface Props {
  disabled: boolean
  busy: boolean
  /** Cho phép nhập text thay mic (drill; mock chỉ nhận audio — chống dán văn bản). */
  allowText: boolean
  onAudio: (blob: Blob) => Promise<void>
  onText: (text: string) => Promise<void>
  /** Gợi ý ngắn cho nút micro (tooltip). */
  hint?: string
  /** Đến lượt thí sinh → vòng vàng quanh nút micro. */
  yourTurn?: boolean
  /** Ô trạng thái bên trái nút micro (phòng thi đặt dải "đến lượt bạn" ở đây). */
  status?: ReactNode
  /** Ô bên phải nút micro (đếm lượt). */
  meta?: ReactNode
  /** Báo phòng thi đang thu để hàng người nói hiện sóng âm ở ô "Bạn". */
  onRecordingChange?: (recording: boolean) => void
  /** Tự dừng và gửi khi đã nói rồi im liền 2 giây (Đợt 5 phòng thi nói; công tắc ở phòng thi). */
  autoStop?: boolean
}

/** Nhịp đọc mức âm cho tự dừng (ms). */
const VAD_TICK_MS = 100

/** mm:ss cho đồng hồ đếm ngược của lượt thu. */
function mmss(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

/**
 * Thanh micro phòng thi (mẫu 07/11/2026): nút tròn 72px ở giữa — đến lượt có vòng vàng, đang thu
 * nền đỏ + vòng đỏ, bấm lại để dừng và gửi; trái là ô trạng thái, phải là đếm lượt. Drill có thêm
 * nút bàn phím để gõ thay nói.
 */
/** Bản ghi ngắn hơn mức này (bấm dừng tay) chắc chắn không có câu nói — không gửi STT. */
export const MIN_TURN_MS = 600

export function MicBar({ disabled, busy, allowText, onAudio, onText, hint, yourTurn = false, status, meta, onRecordingChange, autoStop = false }: Props) {
  const t = useTranslations('v2.student.examSpeaking.mic')
  const [recording, setRecording] = useState(false)
  const [remainingMs, setRemainingMs] = useState(DEFAULT_MAX_RECORDING_MS)
  const [textMode, setTextMode] = useState(false)
  const [text, setText] = useState('')
  const [error, setError] = useState<{ kind: MicErrorKind | 'tooShort'; message: string } | null>(null)
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

  const onRecordingChangeRef = useRef(onRecordingChange)
  onRecordingChangeRef.current = onRecordingChange
  useEffect(() => {
    onRecordingChangeRef.current?.(recording)
  }, [recording])

  // Tự dừng khi im: đọc mức âm của chính recorder đang thu (không mở mic lần hai). Đã nói rồi im liền
  // 2 giây → dừng-và-gửi y như bấm tay; chưa nói gì thì không bao giờ cắt.
  useEffect(() => {
    if (!recording || !autoStop) return
    const handle = recorderRef.current
    if (!handle?.analyser) return
    const detector = createSilenceDetector()
    const buf = new Uint8Array(handle.analyser.fftSize)
    const id = window.setInterval(() => {
      if (recorderRef.current !== handle) return
      handle.analyser.getByteTimeDomainData(buf)
      if (detector.update(peakOf(buf), performance.now())) {
        window.clearInterval(id)
        handle.stop()
      }
    }, VAD_TICK_MS)
    return () => window.clearInterval(id)
  }, [recording, autoStop])

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
        (blob, result) => {
          recorderRef.current = null
          setRecording(false)
          setRemainingMs(DEFAULT_MAX_RECORDING_MS)
          // Recorder bảo đảm callback này chạy tối đa MỘT lần cho mỗi lần thu, nên dù hết giờ
          // và người dùng bấm dừng cùng lúc thì lượt vẫn chỉ nộp một lần.
          // Chạm nhầm (bật rồi tắt ngay) → báo ngay ở máy, không tốn một lượt STT cho bản ghi
          // không có câu nào (plan đường âm thanh §2.2).
          if (blob.size > 0 && result.reason === 'manual' && result.durationMs < MIN_TURN_MS) {
            setError({ kind: 'tooShort', message: t('errors.tooShort') })
            return
          }
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

  const fallbackStatus = (
    <p className="ga-ui text-ga-small text-ga-muted" role="status">
      {busy ? t('sending') : recording ? t('recording') : hint}
    </p>
  )
  const statusNode = status ?? fallbackStatus
  const ringTurn = yourTurn && !disabled && !busy
  const roundBase =
    'relative grid h-16 w-16 shrink-0 place-items-center rounded-full transition-[transform,background-color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus focus-visible:ring-offset-2 lg:h-[72px] lg:w-[72px]'

  return (
    <div className="border-t border-ga-line bg-ga-card px-3 py-3 sm:px-4" data-testid="mic-bar">
      {textMode ? (
        <div className="space-y-2">
          {statusNode}
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              void submitText()
            }}
          >
            <input
              className="ga-ui min-h-11 flex-1 rounded-ga-touch border border-ga-line bg-ga-bg px-3 text-ga-body text-ga-ink"
              lang="de"
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
            <GaBtn type="button" variant="ghost" size="lg" onClick={() => setTextMode(false)} aria-label={t('useMic')} title={t('useMic')}>
              <Mic size={16} aria-hidden />
            </GaBtn>
          </form>
        </div>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 sm:gap-4">
          <div className="min-w-0">{statusNode}</div>
          <div className="flex flex-col items-center gap-1" data-tour="oral-mic">
            {recording ? (
              <button
                type="button"
                onClick={stop}
                aria-label={t('stopSend')}
                aria-pressed
                title={t('stopSend')}
                className={`${roundBase} ga-oral-ring-rec bg-ga-red text-ga-bg active:scale-[0.96]`}
                data-testid="mic-stop"
              >
                <Square size={24} aria-hidden />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void start()}
                disabled={disabled || busy}
                aria-label={busy ? t('sending') : t('start')}
                aria-pressed={false}
                title={hint}
                className={`${roundBase} bg-ga-ink text-ga-bg hover:scale-[1.04] active:scale-[0.96] disabled:opacity-40 disabled:hover:scale-100 ${
                  ringTurn ? 'ga-oral-ring-turn' : ''
                }`}
                data-testid="mic-start"
              >
                {busy ? <Loader2 size={26} className="animate-spin" aria-hidden /> : <Mic size={28} aria-hidden />}
              </button>
            )}
            {recording && (
              <span className="ga-ui text-ga-small font-semibold tabular-nums text-ga-ink" data-testid="mic-remaining">
                <span className="sr-only">{t('recording')} </span>
                {mmss(remainingMs)}
              </span>
            )}
          </div>
          <div className="flex min-w-0 items-center justify-end gap-2">
            {allowText && !recording && (
              <button
                type="button"
                onClick={() => setTextMode(true)}
                aria-label={t('useText')}
                title={t('useText')}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-ga-line bg-ga-card text-ga-muted hover:bg-ga-side-active hover:text-ga-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus"
                data-testid="mic-text-mode"
              >
                <Keyboard size={18} aria-hidden />
              </button>
            )}
            {meta}
          </div>
        </div>
      )}
      {error && (
        <div className="mt-2" data-testid="mic-error">
          <p className="ga-ui text-ga-small text-ga-red">{error.message}</p>
          {error.kind === 'denied' && (
            <ol className="ga-ui mt-1.5 list-decimal space-y-0.5 pl-5 text-ga-small text-ga-muted" data-testid="mic-denied-steps">
              <li>{t('deniedSteps.site')}</li>
              <li>{t('deniedSteps.browser')}</li>
              <li>{t('deniedSteps.os')}</li>
            </ol>
          )}
          <button
            type="button"
            className="ga-ui mt-1.5 text-ga-small font-semibold text-ga-ink underline underline-offset-2"
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
