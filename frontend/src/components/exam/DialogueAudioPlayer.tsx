'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Lock, Play, Square, Users, Volume2 } from 'lucide-react'
import { speakExamLine, stopExamTts } from '@/components/features/exam-speaking/examTts'
import { canPlayAgain, normalizeTurns, playsLeft, type AudioTurn } from './audioScript'

interface DialogueAudioPlayerProps {
  turns: AudioTurn[]
  label?: string
  maxPlays?: number
  /**
   * Cổng nghi thức của Teil chưa mở (đang đọc Ansage / đang đếm ngược đọc câu hỏi). Nút phát khoá
   * và nói rõ vì sao — không phải "hết lượt".
   */
  locked?: boolean
  /** Thu gọn cho bài nghe của MỘT câu (Teil 1/3 telc): không liệt kê người nói khi chỉ có một lượt. */
  compact?: boolean
}

/**
 * Hörtext đọc bằng giọng persona (server, hai giọng; rơi xuống giọng máy khi server hỏng).
 *
 * Ban đầu chỉ cho hội thoại Teil 2 telc — 10 câu trên 25 điểm, một giọng đọc liền mạch biến phần
 * nặng điểm nhất thành đoán mò. Từ 17/09/2026 dùng cho cả bài của từng câu Teil 1/3 (câu dẫn tình
 * huống bằng giọng người dẫn, rồi bài bằng giọng người nói), nên có `compact` và `locked`.
 *
 * 🔑 **Tên người nói luôn hiện trên màn hình** khi có nhiều hơn một lượt, kể cả khi chỉ còn một
 * giọng máy. Server TTS hỏng là chuyện có thật; lúc đó nếu màn hình cũng không nói ai đang nói thì
 * học viên mất trắng 25 điểm vì một sự cố hạ tầng.
 */
export function DialogueAudioPlayer({ turns, label, maxPlays, locked = false, compact = false }: DialogueAudioPlayerProps) {
  const t = useTranslations('v2.student.examResult.audioPlayer')
  const lines = normalizeTurns(turns)
  const [playsUsed, setPlaysUsed] = useState(0)
  const [activeLine, setActiveLine] = useState(-1)
  const [playing, setPlaying] = useState(false)
  const runRef = useRef(0)

  const left = playsLeft(maxPlays, playsUsed)
  const exhausted = !canPlayAgain(maxPlays, playsUsed)
  // Câu dẫn tình huống không phải nhân vật: một câu dẫn + một bài vẫn là "một người nói".
  const speakerCount = turns.filter((turn) => turn.kind !== 'LEAD_IN' && turn.text?.trim()).length
  const showLines = !compact || speakerCount > 1

  // Rời trang giữa chừng mà không dừng thì giọng vẫn đọc tiếp ở trang sau.
  useEffect(() => () => { runRef.current += 1; stopExamTts() }, [])

  const stop = useCallback(() => {
    runRef.current += 1
    stopExamTts()
    setPlaying(false)
    setActiveLine(-1)
  }, [])

  const play = useCallback(async () => {
    if (locked || !canPlayAgain(maxPlays, playsUsed)) return
    runRef.current += 1
    const run = runRef.current
    setPlaysUsed((n) => n + 1)
    setPlaying(true)
    for (let i = 0; i < lines.length; i++) {
      if (runRef.current !== run) return // bị dừng giữa chừng
      setActiveLine(i)
      await speakExamLine(lines[i].speaker, lines[i].text)
    }
    if (runRef.current !== run) return
    setPlaying(false)
    setActiveLine(-1)
  }, [lines, maxPlays, playsUsed, locked])

  const disabled = !playing && (locked || exhausted)
  const hint = locked
    ? t('lockedHint')
    : exhausted
      ? t('playsExhaustedHint')
      : left !== null
        ? t('playsLeft', { n: left })
        : t('status.idle')

  if (compact && !showLines) {
    return (
      <div className="mb-3 flex w-max max-w-full flex-wrap items-center gap-2 rounded-xl border border-sky-100 bg-sky-50 px-3 py-2">
        <button
          type="button"
          onClick={playing ? stop : play}
          disabled={disabled}
          className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-500 transition-colors hover:bg-sky-600 disabled:opacity-40"
          aria-label={playing ? t('stop') : t('play')}
        >
          {playing ? <Square size={11} className="text-white" />
            : locked ? <Lock size={11} className="text-white" />
            : <Play size={12} className="ml-0.5 text-white" />}
        </button>
        <span className="text-xs font-medium text-sky-700">{label ?? t('defaultLabel')}</span>
        <span className="text-xs font-semibold text-sky-500">{hint}</span>
      </div>
    )
  }

  return (
    <div className="mb-6 rounded-2xl border border-sky-100 bg-sky-50 p-4">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={playing ? stop : play}
          disabled={disabled}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-sky-500 shadow-md shadow-sky-200 transition-all hover:bg-sky-600 active:scale-95 disabled:opacity-40"
          aria-label={playing ? t('stop') : t('play')}
        >
          {playing ? <Square size={16} className="text-white" />
            : locked ? <Lock size={16} className="text-white" />
            : <Play size={20} className="ml-0.5 text-white" />}
        </button>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-sky-700">
            {speakerCount > 1
              ? <Users size={14} className="shrink-0" aria-hidden />
              : <Volume2 size={14} className="shrink-0" aria-hidden />}
            {label ?? (speakerCount > 1 ? t('dialogueLabel') : t('defaultLabel'))}
          </p>
          <p className="mt-0.5 text-xs italic text-sky-500">{hint}</p>
        </div>
      </div>

      {/* Ai đang nói — phải đọc được cả khi chỉ còn một giọng máy.
          CỐ Ý không in lời thoại: đây là bài NGHE, in ra là phát không đáp án. */}
      {showLines && (
        <ol className="space-y-1.5 border-t border-sky-100 pt-3">
          {lines.map((line, idx) => {
            const source = turns[idx]
            const speakerName = source?.kind === 'LEAD_IN'
              ? t('leadIn')
              : source?.name ?? t(line.speaker === 'PRUEFER' ? 'speakerA' : 'speakerB')
            return (
              <li
                key={idx}
                className={`flex min-w-0 items-baseline gap-2 rounded-lg px-2 py-1 transition-colors ${
                  activeLine === idx ? 'bg-sky-100' : ''
                }`}
              >
                <span className={`shrink-0 text-xs font-bold ${source?.kind === 'LEAD_IN' ? 'text-sky-400' : 'text-sky-600'}`}>
                  {speakerName}
                </span>
                <span aria-hidden className="shrink-0 text-sky-300">
                  {activeLine === idx ? '▶' : '·'}
                </span>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
