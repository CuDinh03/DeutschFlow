'use client'

import { useCallback, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Play, Square, Users } from 'lucide-react'
import { speakExamLine, stopExamTts } from '@/components/features/exam-speaking/examTts'
import { canPlayAgain, normalizeTurns, playsLeft, type AudioTurn } from './audioScript'

interface DialogueAudioPlayerProps {
  turns: AudioTurn[]
  label?: string
  maxPlays?: number
}

/**
 * Hörtext hai người nói. Hörverstehen Teil 2 của telc là một hội thoại dài — 10 câu trên 25 điểm —
 * nên một giọng đọc liền mạch biến phần nặng điểm nhất thành đoán mò.
 *
 * Dùng lại đúng cascade giọng của phòng thi (`speakExamLine`: giọng persona từ server, rơi xuống
 * giọng máy khi server hỏng), nên không dựng thêm hạ tầng và web với app ra cùng một cặp giọng.
 *
 * 🔑 **Tên người nói luôn hiện trên màn hình**, kể cả khi chỉ còn một giọng máy. Server TTS hỏng là
 * chuyện có thật; lúc đó nếu màn hình cũng không nói ai đang nói thì học viên mất trắng 25 điểm vì
 * một sự cố hạ tầng.
 */
export function DialogueAudioPlayer({ turns, label, maxPlays }: DialogueAudioPlayerProps) {
  const t = useTranslations('v2.student.examResult.audioPlayer')
  const lines = normalizeTurns(turns)
  const [playsUsed, setPlaysUsed] = useState(0)
  const [activeLine, setActiveLine] = useState(-1)
  const [playing, setPlaying] = useState(false)
  const runRef = useRef(0)

  const left = playsLeft(maxPlays, playsUsed)
  const exhausted = !canPlayAgain(maxPlays, playsUsed)

  const stop = useCallback(() => {
    runRef.current += 1
    stopExamTts()
    setPlaying(false)
    setActiveLine(-1)
  }, [])

  const play = useCallback(async () => {
    if (!canPlayAgain(maxPlays, playsUsed)) return
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
  }, [lines, maxPlays, playsUsed])

  return (
    <div className="mb-6 rounded-2xl border border-sky-100 bg-sky-50 p-4">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <button
          onClick={playing ? stop : play}
          disabled={exhausted && !playing}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-sky-500 shadow-md shadow-sky-200 transition-all hover:bg-sky-600 active:scale-95 disabled:opacity-40"
          aria-label={playing ? t('stop') : t('play')}
        >
          {playing ? <Square size={16} className="text-white" /> : <Play size={20} className="ml-0.5 text-white" />}
        </button>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-sky-700">
            <Users size={14} className="shrink-0" aria-hidden /> {label ?? t('dialogueLabel')}
          </p>
          <p className="mt-0.5 text-xs italic text-sky-500">
            {exhausted
              ? t('playsExhaustedHint')
              : left !== null
                ? t('playsLeft', { n: left })
                : t('status.idle')}
          </p>
        </div>
      </div>

      {/* Ai đang nói — phải đọc được cả khi chỉ còn một giọng máy.
          CỐ Ý không in lời thoại: đây là bài NGHE, in ra là phát không đáp án. */}
      <ol className="space-y-1.5 border-t border-sky-100 pt-3">
        {lines.map((line, idx) => {
          const speakerName = turns[idx]?.name
          return (
            <li
              key={idx}
              className={`flex min-w-0 items-baseline gap-2 rounded-lg px-2 py-1 transition-colors ${
                activeLine === idx ? 'bg-sky-100' : ''
              }`}
            >
              <span className="shrink-0 text-xs font-bold text-sky-600">
                {speakerName ?? t(line.speaker === 'PRUEFER' ? 'speakerA' : 'speakerB')}
              </span>
              <span aria-hidden className="shrink-0 text-sky-300">
                {activeLine === idx ? '▶' : '·'}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
