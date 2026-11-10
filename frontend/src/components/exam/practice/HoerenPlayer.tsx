'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Captions, Lock, Play, Repeat1, Repeat2, Square } from 'lucide-react'
import { cn } from '@/lib/utils'
import { speakExamLine, stopExamTts } from '@/components/features/exam-speaking/examTts'
import { canPlayAgain, normalizeTurns, playsLeft, type AudioTurn } from '@/components/exam/audioScript'
import { MarkLayerContext, MarkedText } from '@/components/exam/marks/MarkedText'
import { blockText } from '@/components/exam/marks/marksBlocks'

interface Props {
  turns: AudioTurn[]
  /** Tên bài nghe ("Đoạn 2 · câu 42", "Interview mit …"). */
  label: string
  /** Lượt nghe của đề (`max_plays`). Bỏ trống = không giới hạn (luyện thoải mái, sau khi kiểm tra). */
  maxPlays?: number
  /** Chưa tới bước nghe: nút khoá. */
  locked?: boolean
  /** Cho xem lời thoại (luyện thoải mái, sau khi kiểm tra). Thi thật thì KHÔNG — in lời là lộ đáp án. */
  transcript?: boolean
  /** Thi thật: không có nút dừng giữa chừng (băng đề không dừng). */
  allowStop?: boolean
  compact?: boolean
  onPlayStart?: () => void
  /** Phát xong một lượt (không tính lượt bị dừng): số lượt đã dùng. */
  onEnded?: (playsUsed: number) => void
  /**
   * Phạm vi khối đánh dấu của lời thoại (đợt 3b): `teil` hoặc id câu ⇒ dòng i là khối `h:<phạm vi>:<i>`.
   * Chỉ có tác dụng khi Teil cấp lớp đánh dấu (`MarkLayerContext`, sau khi kiểm tra).
   */
  markScope?: string
}

/**
 * Trình phát bài nghe của màn luyện thi (đợt (b), 07/11/2026). Đọc bằng giọng phòng thi
 * (`speakExamLine`: server TTS, hỏng thì giọng máy). Mỗi lượt bấm là một lượt nghe; hết lượt thì nút
 * tắt và nói rõ "đã hết lượt". Màn hình luôn cho biết AI đang nói — kể cả khi chỉ còn một giọng máy.
 */
export function HoerenPlayer({ turns, label, maxPlays, locked = false, transcript = false, allowStop = true, compact = false, onPlayStart, onEnded, markScope }: Props) {
  const layer = React.useContext(MarkLayerContext)
  const t = useTranslations('v2.student.practice.hoeren')
  const ta = useTranslations('v2.student.examResult.audioPlayer')
  const lines = normalizeTurns(turns)
  const [used, setUsed] = React.useState(0)
  const [playing, setPlaying] = React.useState(false)
  const [active, setActive] = React.useState(-1)
  const [showText, setShowText] = React.useState(false)
  const runRef = React.useRef(0)

  React.useEffect(() => () => {
    runRef.current += 1
    stopExamTts()
  }, [])

  const left = playsLeft(maxPlays, used)
  const exhausted = !canPlayAgain(maxPlays, used)
  const speakers = turns.filter((x) => x.kind !== 'LEAD_IN' && x.text?.trim()).length

  const stop = () => {
    runRef.current += 1
    stopExamTts()
    setPlaying(false)
    setActive(-1)
  }

  const play = async () => {
    if (playing || locked || exhausted) return
    runRef.current += 1
    const run = runRef.current
    const nextUsed = used + 1
    setUsed(nextUsed)
    setPlaying(true)
    onPlayStart?.()
    for (let i = 0; i < lines.length; i++) {
      if (runRef.current !== run) return
      setActive(i)
      await speakExamLine(lines[i].speaker, lines[i].text)
    }
    if (runRef.current !== run) return
    setPlaying(false)
    setActive(-1)
    onEnded?.(nextUsed)
  }

  const nameOf = (idx: number) => {
    const src = turns[idx]
    if (src?.kind === 'LEAD_IN') return ta('leadIn')
    return src?.name ?? ta(lines[idx]?.speaker === 'PRUEFER' ? 'speakerA' : 'speakerB')
  }

  const status = locked
    ? t('lockedPlay')
    : playing
      ? maxPlays
        ? t('playingOf', { n: used, max: maxPlays })
        : t('playing')
      : left === null
        ? t('unlimited')
        : exhausted
          ? t('exhausted')
          : t('playsLeft', { n: left, max: maxPlays ?? 0 })
  const PlaysIcon = maxPlays === 1 ? Repeat1 : Repeat2

  return (
    <div className={cn('rounded-ga-touch border border-ga-line bg-ga-card', compact ? 'p-2.5' : 'p-4')}>
      <div className="flex items-center gap-3.5">
        <button
          type="button"
          onClick={playing ? (allowStop ? stop : undefined) : play}
          disabled={(!playing && (locked || exhausted)) || (playing && !allowStop)}
          aria-label={playing ? t('stop') : locked ? t('lockedPlay') : exhausted ? t('exhausted') : t('play')}
          className={cn(
            'grid shrink-0 place-items-center rounded-full bg-ga-ink text-ga-card transition-transform duration-150 hover:scale-[1.04] active:scale-95 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus focus-visible:ring-offset-2',
            compact ? 'h-10 w-10' : 'h-14 w-14',
          )}
        >
          {playing ? (
            <Square size={compact ? 14 : 18} aria-hidden fill="currentColor" />
          ) : locked ? (
            <Lock size={compact ? 15 : 20} aria-hidden />
          ) : (
            <Play size={compact ? 16 : 22} aria-hidden fill="currentColor" className="ml-0.5" />
          )}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <b className="ga-ui min-w-0 flex-1 truncate text-ga-body text-ga-ink">{label}</b>
            {maxPlays ? (
              <span className="inline-flex items-center gap-1.5" aria-hidden>
                <PlaysIcon size={15} className="text-ga-muted" />
                {Array.from({ length: maxPlays }, (_, i) => (
                  <span key={i} className={cn('h-2.5 w-2.5 rounded-full', i < (left ?? 0) ? 'bg-ga-ink' : 'border-[1.5px] border-ga-line-strong')} />
                ))}
              </span>
            ) : null}
          </div>
          <p className={cn('ga-ui mt-0.5 flex items-center gap-2 text-ga-small', exhausted && !playing ? 'text-ga-red' : 'text-ga-muted')} aria-live="polite">
            {playing && (
              <span aria-hidden className="inline-flex h-3.5 items-end gap-[2px]">
                {[0, 1, 2, 3].map((i) => (
                  <span key={i} className="w-[3px] animate-pulse rounded-sm bg-ga-navy motion-reduce:animate-none" style={{ height: `${6 + ((i * 5) % 9)}px`, animationDelay: `${i * 150}ms` }} />
                ))}
              </span>
            )}
            {status}
          </p>
        </div>
      </div>

      {(speakers > 1 || (transcript && showText)) && (
        <ol className={cn('ga-ui mt-3 space-y-1 border-t border-ga-line pt-3', compact && 'mt-2 pt-2')}>
          {lines.map((line, idx) => (
            <li key={idx} className={cn('flex min-w-0 gap-2 rounded-ga px-2 py-1 text-ga-small transition-colors', active === idx && 'bg-ga-navy-soft')}>
              <span className={cn('shrink-0 font-semibold', turns[idx]?.kind === 'LEAD_IN' ? 'text-ga-muted' : 'text-ga-navy')}>{nameOf(idx)}</span>
              {transcript && showText ? (
                <span lang="de" className="min-w-0 break-words font-ga-display text-ga-body text-ga-ink">
                  {layer && markScope ? (
                    <MarkedText block={`h:${markScope}:${idx}`} text={blockText(line.text)} layer={layer} />
                  ) : (
                    line.text
                  )}
                </span>
              ) : (
                <span aria-hidden className="text-ga-subtle">{active === idx ? '▶' : '·'}</span>
              )}
            </li>
          ))}
        </ol>
      )}

      {transcript && (
        <button
          type="button"
          onClick={() => setShowText((v) => !v)}
          aria-pressed={showText}
          className="ga-ui mt-2.5 inline-flex min-h-9 items-center gap-1.5 text-ga-small font-semibold text-ga-navy underline decoration-1 underline-offset-[3px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus"
        >
          <Captions size={15} aria-hidden />
          {showText ? t('hideTranscript') : t('transcript')}
        </button>
      )}
    </div>
  )
}
