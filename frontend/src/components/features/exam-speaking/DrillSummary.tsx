'use client'

import { useTranslations } from 'next-intl'
import { GaCap } from '@/components/ui-v2'
import type { RoomLine } from '@/types/exam-speaking'

interface Props {
  lines: RoomLine[]
}

/** Tổng kết drill: điểm nhanh trung bình + lỗi cần ôn (không in điểm/band chính thức — chỉ mock mới có). */
export function DrillSummary({ lines }: Props) {
  const t = useTranslations('v2.student.examSpeaking.drill')
  const scored = lines.filter((l) => l.role === 'CANDIDATE' && typeof l.eval?.score === 'number')
  const avg = scored.length ? scored.reduce((s, l) => s + (l.eval?.score ?? 0), 0) / scored.length : null
  const corrections = new Map<string, { original: string; correction: string; code: string }>()
  scored.forEach((l) => l.eval?.corrections?.forEach((c) => corrections.set(c.original.toLowerCase(), c)))
  return (
    <section className="space-y-4" data-testid="drill-summary">
      <div className="rounded-ga border-2 border-ga-ink bg-ga-card p-5 shadow-[6px_6px_0_0_var(--ga-yellow)]">
        <GaCap className="mb-1 block">{t('cap')}</GaCap>
        <p className="font-ga-display text-[34px] font-semibold leading-none text-ga-ink">
          {avg === null ? '–' : avg.toFixed(1)}
          <span className="text-[16px] font-medium text-ga-muted"> / 10</span>
        </p>
        <p className="ga-ui mt-2 text-[13px] text-ga-muted">{t('turns', { n: scored.length })}</p>
      </div>
      {corrections.size > 0 && (
        <div className="rounded-ga border border-ga-line bg-ga-card p-4">
          <p className="font-ga-display mb-2 text-[18px] font-medium text-ga-ink">{t('toReview')}</p>
          <ul className="space-y-1.5">
            {Array.from(corrections.values()).map((c, i) => (
              <li key={i} className="ga-ui text-[13.5px]">
                <span className="text-ga-red line-through">{c.original}</span>
                <span className="mx-1.5 text-ga-muted">→</span>
                <span className="font-semibold text-ga-green">{c.correction}</span>
                <span className="ml-1.5 text-[11px] text-ga-muted">{c.code}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="ga-ui rounded-ga bg-ga-surface p-3 text-[12.5px] text-ga-muted">{t('note')}</p>
    </section>
  )
}
