'use client'

import { useTranslations } from 'next-intl'
import { Bot, Sparkles } from 'lucide-react'
import type { DrillTurnEval, RoomLine } from '@/types/exam-speaking'

interface Props {
  lines: RoomLine[]
  mode: 'DRILL' | 'MOCK'
}

/** Transcript phòng thi. Drill: thẻ chấm nhanh dưới mỗi lượt. Mock: KHÔNG sửa lỗi giữa chừng (đúng thi thật). */
export function ExamTranscript({ lines, mode }: Props) {
  const t = useTranslations('v2.student.examSpeaking.room')
  return (
    <ol className="space-y-3" aria-live="polite" data-testid="exam-transcript">
      {lines.map((l) => (
        <li key={l.id} className={l.role === 'CANDIDATE' ? 'flex justify-end' : 'flex justify-start'}>
          <div className={`max-w-[92%] ${l.role === 'CANDIDATE' ? 'text-right' : ''}`}>
            <div
              className={`ga-ui inline-block rounded-ga px-3.5 py-2.5 text-[14.5px] leading-relaxed ${
                l.role === 'CANDIDATE'
                  ? 'bg-ga-yellow-soft text-ga-ink'
                  : l.role === 'PRUEFER'
                    ? 'bg-ga-ink text-ga-bg'
                    : 'border-2 border-ga-accent bg-ga-accent-soft text-ga-ink'
              }`}
              data-role={l.role}
            >
              {l.role === 'CANDIDATE' || l.role === 'PRUEFER' ? (
                <span className="mr-2 text-[11px] font-semibold uppercase tracking-wide opacity-70">
                  {l.role === 'CANDIDATE' ? t('you') : t('pruefer')}
                </span>
              ) : (
                // Partner là AI đóng vai bạn thi — chip accent + icon để phân vai ngay khi lướt transcript.
                <span className="mr-2 inline-flex translate-y-[-1px] items-center gap-1 rounded-full bg-ga-accent px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-ga-accent-ink">
                  <Bot size={11} aria-hidden /> {t('partnerAi')}
                </span>
              )}
              {l.text}
            </div>
            {typeof l.latencyMs === 'number' && l.role !== 'CANDIDATE' && (
              <p className="ga-ui mt-0.5 text-[11px] text-ga-muted" data-testid="turn-latency">
                ⏱ {(l.latencyMs / 1000).toFixed(1)}s
              </p>
            )}
            {mode === 'DRILL' && l.role === 'CANDIDATE' && l.eval && <DrillEvalCard eval={l.eval} />}
          </div>
        </li>
      ))}
    </ol>
  )
}

function DrillEvalCard({ eval: ev }: { eval: DrillTurnEval }) {
  const t = useTranslations('v2.student.examSpeaking.room')
  if (ev.error) {
    return <p className="ga-ui mt-1 text-left text-[12.5px] text-ga-muted">{ev.error}</p>
  }
  return (
    <div className="mt-2 rounded-ga border border-ga-line bg-ga-card p-3 text-left" data-testid="drill-eval">
      <div className="flex items-center gap-2">
        <Sparkles size={14} className="text-ga-accent" aria-hidden />
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
              <span className="ml-1.5 text-[11px] text-ga-muted">{c.code}</span>
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
