'use client'

import { Fragment, useEffect, useRef } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Gauge, Timer } from 'lucide-react'
import { getErrorSnippet } from '@/lib/errors/errorTaxonomy'
import type { DrillTurnEval, RoomLine } from '@/types/exam-speaking'

interface Props {
  lines: RoomLine[]
  mode: 'DRILL' | 'MOCK'
  /** Tên Teil theo số — có thì chèn vạch "Teil n · tên" mỗi lần hội thoại sang Teil mới. */
  teilTitles?: Record<number, string>
}

/**
 * Hội thoại phòng thi dạng bong bóng (mẫu 07/11/2026): lời giám khảo / bạn thi bên trái nền nhạt,
 * lời của bạn bên phải nền navy; lời mới nhô lên và tự cuộn xuống. Drill: thẻ chấm nhanh dưới mỗi
 * lượt. Mock: KHÔNG sửa lỗi giữa chừng (đúng thi thật), nhận xét chỉ có ở kết quả.
 */
export function ExamTranscript({ lines, mode, teilTitles }: Props) {
  const t = useTranslations('v2.student.examSpeaking.room')
  const endRef = useRef<HTMLLIElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'end', behavior: 'smooth' })
  }, [lines.length])

  return (
    <ol className="flex flex-col gap-3" aria-live="polite" data-testid="exam-transcript">
      {lines.map((l, i) => {
        const mine = l.role === 'CANDIDATE'
        const newTeil = teilTitles && (i === 0 || lines[i - 1].teilNo !== l.teilNo)
        return (
          <Fragment key={l.id}>
            {newTeil && (
              <li className="flex justify-center" data-testid="transcript-teil">
                <span className="ga-ui rounded-ga-touch border border-dashed border-ga-line-strong px-3 py-1 text-ga-small text-ga-muted">
                  {t('teilCap', { n: l.teilNo })}
                  {teilTitles[l.teilNo] ? ` · ${teilTitles[l.teilNo]}` : ''}
                </span>
              </li>
            )}
            <li className={`ga-oral-rise flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex max-w-[86%] flex-col ${mine ? 'items-end' : 'items-start'}`}>
                <span className="ga-ui mb-0.5 text-ga-caption font-semibold text-ga-muted">
                  {mine ? t('you') : l.role === 'PRUEFER' ? t('pruefer') : t('partnerAi')}
                </span>
                <div
                  lang="de"
                  className={`rounded-xl px-3 py-2.5 font-ga-display text-[16.5px] leading-normal ${
                    mine ? 'bg-ga-navy text-ga-bg' : 'bg-ga-side-active text-ga-ink'
                  }`}
                  data-role={l.role}
                >
                  {l.text}
                </div>
                {typeof l.latencyMs === 'number' && !mine && (
                  <p className="ga-ui mt-0.5 inline-flex items-center gap-1 text-ga-caption text-ga-muted" data-testid="turn-latency">
                    <Timer size={12} aria-hidden /> {(l.latencyMs / 1000).toFixed(1)}s
                  </p>
                )}
                {mode === 'DRILL' && mine && l.eval && <DrillEvalCard eval={l.eval} />}
              </div>
            </li>
          </Fragment>
        )
      })}
      <li ref={endRef} aria-hidden className="h-px" />
    </ol>
  )
}

function DrillEvalCard({ eval: ev }: { eval: DrillTurnEval }) {
  const t = useTranslations('v2.student.examSpeaking.room')
  const locale = useLocale()
  if (ev.error) {
    return <p className="ga-ui mt-1 text-left text-[12.5px] text-ga-muted">{ev.error}</p>
  }
  return (
    <div className="mt-2 rounded-ga border border-ga-line bg-ga-card p-3 text-left" data-testid="drill-eval">
      <div className="flex items-center gap-2">
        <Gauge size={14} className="text-ga-muted" aria-hidden />
        <span className="font-ga-display text-[16px] font-medium text-ga-ink">
          {t('score', { score: ev.score ?? 0 })}
        </span>
      </div>
      {ev.feedbackVi && <p className="ga-ui mt-1 text-[13.5px] text-ga-ink">{ev.feedbackVi}</p>}
      {ev.corrections && ev.corrections.length > 0 && (
        <ul className="mt-2 space-y-1">
          {ev.corrections.map((c, i) => (
            <li key={i} className="ga-ui text-[13px]">
              <span className="text-ga-red line-through">{c.original}</span>
              <span className="mx-1.5 text-ga-muted">→</span>
              <span className="font-semibold text-ga-green">{c.correction}</span>
              {/* Học viên đọc tên lỗi, không đọc mã máy (WORD_ORDER.V2_MAIN_CLAUSE…). */}
              <span className="ml-1.5 text-[11px] text-ga-muted">{getErrorSnippet(c.code, locale).title}</span>
            </li>
          ))}
        </ul>
      )}
      {ev.redemittel && ev.redemittel.length > 0 && (
        <p className="ga-ui mt-2 text-[12.5px] text-ga-muted">
          <span className="font-semibold text-ga-ink">{t('redemittel')}:</span> {ev.redemittel.join(' · ')}
        </p>
      )}
    </div>
  )
}
