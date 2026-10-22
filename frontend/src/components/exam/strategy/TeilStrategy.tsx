'use client'

import { useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { ChevronDown } from 'lucide-react'
import { fetchExamStrategies, findStrategy, type TeilStrategyDto } from './examStrategy'

/**
 * Chiến thuật một Teil (LT2, 22/10/2026), thu gọn mặc định để không chiếm giờ làm bài. Học viên
 * thấy nội dung khi Teil đã được duyệt, chưa duyệt thì một dòng "Sắp có"; admin/giáo viên thấy bản
 * nháp kèm nhãn để duyệt ngay trong đề. Đề chưa có bộ chiến thuật (Goethe) thì không hiện gì.
 */
export function TeilStrategy({
  provider,
  level,
  section,
  teil,
  defaultOpen = false,
  summaryLabel,
  hideComingSoon = false,
}: {
  provider?: string | null
  level?: string | null
  section: string
  teil: number
  defaultOpen?: boolean
  /** Thay dòng tiêu đề mặc định (vd. "Chiến thuật Nói · Teil 2" khi nhiều Teil đứng cạnh nhau). */
  summaryLabel?: string
  /** Ẩn dòng "Sắp có" — dùng khi khối này chỉ là phần phụ (dòng điểm mất của LT1). */
  hideComingSoon?: boolean
}) {
  const t = useTranslations('v2.student.examStrategy')
  const locale = useLocale()
  const lang = locale === 'vi' ? 'vi' : 'en'
  const [strategy, setStrategy] = useState<TeilStrategyDto | null>(null)

  useEffect(() => {
    if (!provider || !level) return
    let alive = true
    void fetchExamStrategies(provider, level, lang).then((list) => {
      if (alive) setStrategy(findStrategy(list, section, teil))
    })
    return () => {
      alive = false
    }
  }, [provider, level, lang, section, teil])

  if (!strategy) return null

  if (strategy.status === 'COMING_SOON' || !strategy.content) {
    if (hideComingSoon) return null
    return <p className="ga-ui mt-2 text-ga-caption text-ga-subtle">{t('comingSoon')}</p>
  }

  const c = strategy.content
  return (
    <details open={defaultOpen} className="group mt-3 border border-ga-line bg-ga-surface">
      <summary className="ga-ui flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 py-2 text-ga-small font-semibold text-ga-ink lg:min-h-0">
        <ChevronDown size={14} className="shrink-0 transition-transform group-open:rotate-180" aria-hidden />
        <span className="min-w-0 flex-1">{summaryLabel ?? t('summary')}</span>
        {strategy.status === 'DRAFT' && (
          <span className="shrink-0 border border-ga-yellow bg-ga-yellow-soft px-1.5 py-0.5 text-ga-caption text-ga-ink">
            {t('draft')}
          </span>
        )}
      </summary>
      <div className="ga-ui space-y-3 border-t border-ga-line px-3 py-3 text-ga-small text-ga-ink">
        <div>
          <p className="font-semibold">{c.title}</p>
          <p className="mt-0.5 text-ga-muted">{c.format}</p>
        </div>
        <div>
          <p className="mb-1 text-ga-caption font-bold uppercase tracking-wide text-ga-muted">{t('steps')}</p>
          <ol className="list-decimal space-y-1 pl-5">
            {c.steps.map((s) => <li key={s}>{s}</li>)}
          </ol>
        </div>
        <div>
          <p className="mb-1 text-ga-caption font-bold uppercase tracking-wide text-ga-muted">{t('traps')}</p>
          <ul className="list-disc space-y-1 pl-5">
            {c.traps.map((s) => <li key={s}>{s}</li>)}
          </ul>
        </div>
        <div>
          <p className="mb-1 text-ga-caption font-bold uppercase tracking-wide text-ga-muted">{t('fixes')}</p>
          <ul className="space-y-1.5">
            {c.fixes.map((f) => (
              <li key={f.cause} className="border-l-2 border-ga-border pl-3">
                <span className="font-semibold">{f.cause}</span>
                <span className="text-ga-muted"> → {f.fix}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </details>
  )
}
