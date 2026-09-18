'use client'

import { useCallback, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Play, Pause, Square, Volume2, VolumeX } from 'lucide-react'
import { useGermanTTS, TTSState } from '@/hooks/useGermanTTS'
import { canPlayAgain, playsLeft } from './audioScript'

interface AudioPlayerProps {
  script: string
  label?: string
  /** compact = small inline pill; default = full card */
  compact?: boolean
  /**
   * Số lần được phát, lấy từ `teil.max_plays` của đề. Hörverstehen telc cho nghe MỘT lần ở Teil 1
   * và hai lần ở Teil 2–3; luyện mà nghe bao nhiêu lần cũng được thì không đo đúng cái đề thật đo.
   *
   * Bỏ trống = không giới hạn — đúng hành vi của mọi đề Goethe hiện có, và cũng là hành vi của màn
   * XEM LẠI sau khi nộp (ở đó không có lý do gì để siết).
   */
  maxPlays?: number
  /** Cổng nghi thức của Teil chưa mở (đang đọc Ansage / đếm ngược đọc câu hỏi): nút khoá, nói rõ lý do. */
  locked?: boolean
}

const LABEL_KEY: Record<TTSState, string> = {
  idle:        'status.idle',
  loading:     'status.loading',
  playing:     'status.playing',
  paused:      'status.paused',
  done:        'status.done',
  unsupported: 'status.unsupported',
}

export function AudioPlayer({ script, label, compact = false, maxPlays, locked = false }: AudioPlayerProps) {
  const t = useTranslations('v2.student.examResult.audioPlayer')
  const { state, progress, speak, pause, resume, stop } = useGermanTTS()
  const [playsUsed, setPlaysUsed] = useState(0)

  const left = playsLeft(maxPlays, playsUsed)
  const exhausted = !canPlayAgain(maxPlays, playsUsed)

  const handlePrimary = useCallback(() => {
    // Tạm dừng rồi phát tiếp KHÔNG tính là một lượt mới — nếu tính thì học viên mất lượt vì lỡ tay.
    if (state === 'playing') { pause(); return }
    if (state === 'paused')  { resume(); return }
    if (locked || !canPlayAgain(maxPlays, playsUsed)) return
    setPlaysUsed((n) => n + 1)
    speak(script)
  }, [state, pause, resume, speak, script, maxPlays, playsUsed, locked])

  const isActive  = state === 'playing' || state === 'paused'
  const isLoading = state === 'loading'
  const disabled  = state === 'unsupported' || ((exhausted || locked) && !isActive)

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-2 mb-3 bg-sky-50 border border-sky-100 px-3 py-2 rounded-xl w-max max-w-full">
        <button
          onClick={handlePrimary}
          disabled={disabled || isLoading}
          className="w-7 h-7 rounded-full bg-sky-500 hover:bg-sky-600 disabled:opacity-40 flex items-center justify-center transition-colors"
          aria-label={t('play')}
        >
          {isLoading
            ? <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
            : state === 'playing'
            ? <Pause size={12} className="text-white" />
            : <Play size={12} className="text-white ml-0.5" />}
        </button>
        {isActive && (
          <button onClick={stop} className="text-sky-400 hover:text-sky-600 transition-colors" aria-label={t('stop')}>
            <Square size={11} />
          </button>
        )}
        <span className="text-xs text-sky-700 font-medium">
          {label ?? t(LABEL_KEY[state])}
        </span>
        {locked && !isActive ? (
          <span className="text-xs font-semibold text-sky-500">{t('lockedHint')}</span>
        ) : left !== null && (
          <span className="text-xs font-semibold text-sky-500">
            {exhausted ? t('playsExhausted') : t('playsLeft', { n: left })}
          </span>
        )}
        {isActive && progress > 0 && (
          <div className="w-16 h-1 bg-sky-200 rounded-full overflow-hidden">
            <div className="h-full bg-sky-500 transition-all" style={{ width: `${progress * 100}%` }} />
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="bg-sky-50 border border-sky-100 rounded-2xl p-4 mb-6">
      <div className="flex items-center gap-3 lg:gap-4">
        {/* Big play button */}
        <button
          onClick={handlePrimary}
          disabled={disabled || isLoading}
          className="w-12 h-12 rounded-full bg-sky-500 hover:bg-sky-600 active:scale-95 disabled:opacity-40 flex items-center justify-center transition-all shadow-md shadow-sky-200 shrink-0"
          aria-label={t('play')}
        >
          {isLoading
            ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            : state === 'playing'
            ? <Pause size={20} className="text-white" />
            : <Play size={20} className="text-white ml-0.5" />}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
            <div className="flex min-w-0 items-center gap-1.5">
              {disabled
                ? <VolumeX size={14} className="text-slate-400" />
                : <Volume2 size={14} className="text-sky-600" />}
              <span className="text-sm font-semibold text-sky-700">
                {label ?? t('defaultLabel')}
              </span>
            </div>
            {isActive && (
              <button onClick={stop} className="text-xs text-sky-400 hover:text-sky-600 flex items-center gap-1 transition-colors">
                <Square size={11} /> {t('stop')}
              </button>
            )}
          </div>

          {/* Progress bar */}
          <div className="h-1.5 bg-sky-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-sky-500 rounded-full transition-all duration-200"
              style={{ width: `${progress * 100}%` }}
            />
          </div>

          <p className="text-xs text-sky-500 mt-1.5 italic">
            {state === 'unsupported'
              ? t('unsupportedHint')
              : locked && !isActive
                ? t('lockedHint')
              : exhausted
                ? t('playsExhaustedHint')
                : left !== null
                  ? `${t(LABEL_KEY[state])} · ${t('playsLeft', { n: left })}`
                  : t(LABEL_KEY[state])}
          </p>
        </div>
      </div>

      {/* Show first sentence as preview */}
      <p className="text-xs text-slate-500 mt-3 pt-3 border-t border-sky-100 line-clamp-2 italic">
        &ldquo;{script.split('.')[0].trim()}.&rdquo;
      </p>
    </div>
  )
}
