'use client'

// Teacher competency overview (Phase 2c): read-side of the ledger. For each can-do of the class's
// lessons, a mastery bar (mastered / in-progress / not-started across enrolled students) so the
// teacher can spot which competencies to remediate. Grouped by lesson.

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import type { ClassCompetency, CanDoCompetency } from '@/lib/teacherCompetencyApi'

const VIOLET = 'var(--ga-violet)'

interface LessonGroup {
  key: number
  lessonTitle: string
  items: CanDoCompetency[]
}

export function CompetencyTab({ competency }: { competency: ClassCompetency | null }) {
  const t = useTranslations('v2.teacher.tcReports')

  const groups = useMemo<LessonGroup[]>(() => {
    if (!competency) return []
    const byLesson = new Map<number, LessonGroup>()
    const order: number[] = []
    for (const it of competency.items) {
      const key = it.lessonId ?? -1
      if (!byLesson.has(key)) {
        byLesson.set(key, { key, lessonTitle: it.lessonTitle, items: [] })
        order.push(key)
      }
      byLesson.get(key)!.items.push(it)
    }
    return order.map((k) => byLesson.get(k)!)
  }, [competency])

  if (!competency || competency.items.length === 0) {
    return (
      <div className="border border-dashed border-ga-line px-10 py-[40px] text-center text-[14px] text-ga-muted">
        {t('competency.empty')}
      </div>
    )
  }

  const enrolled = competency.enrolledCount

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="ga-ui text-[13px] text-ga-muted">{t('competency.enrolledLabel', { count: enrolled })}</span>
        <div className="flex items-center gap-3 text-[11px] text-ga-muted">
          <Legend color="var(--ga-green)" label={t('competency.legendMastered')} />
          <Legend color="var(--ga-gold)" label={t('competency.legendInProgress')} />
          <Legend color="var(--ga-side-active)" label={t('competency.legendNotStarted')} />
        </div>
      </div>

      {groups.map((g) => (
        <div key={g.key} className="border border-ga-line bg-ga-card">
          <div className="border-b border-ga-line px-4 py-2 text-[12px] font-bold uppercase tracking-[0.06em]" style={{ color: VIOLET, background: 'var(--ga-violet-soft)' }}>
            {g.lessonTitle || t('competency.ungrouped')}
          </div>
          {g.items.map((it, i) => {
            const notStarted = Math.max(0, enrolled - it.mastered - it.inProgress)
            const pct = (n: number) => (enrolled > 0 ? (n / enrolled) * 100 : 0)
            return (
              <div key={it.canDoStatementId} className="px-4 py-3" style={{ borderTop: i ? '1px solid var(--ga-line)' : 'none' }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <span className="text-[13px] leading-[1.5] text-ga-ink">{it.text}</span>
                    <span className="ml-1.5 inline-flex gap-1 align-middle">
                      {it.cefrLevel && (
                        <span className="ga-ui rounded-ga px-1 text-[9px] font-bold" style={{ background: 'var(--ga-violet-soft)', color: VIOLET }}>{it.cefrLevel}</span>
                      )}
                      {it.skillTag && (
                        <span className="ga-ui rounded-ga px-1 text-[9px] font-bold uppercase text-ga-subtle" style={{ background: 'var(--ga-side-active)' }}>{it.skillTag}</span>
                      )}
                    </span>
                  </div>
                  <span className="shrink-0 text-[12px] font-semibold" style={{ color: 'var(--ga-green)' }}>
                    {t('competency.masteredCount', { mastered: it.mastered, total: enrolled })}
                  </span>
                </div>
                <div className="mt-2 flex h-2 overflow-hidden rounded-ga" style={{ background: 'var(--ga-side-active)' }} role="img" aria-label={t('competency.masteredCount', { mastered: it.mastered, total: enrolled })}>
                  <div style={{ width: `${pct(it.mastered)}%`, background: 'var(--ga-green)' }} />
                  <div style={{ width: `${pct(it.inProgress)}%`, background: 'var(--ga-gold)' }} />
                  <div style={{ width: `${pct(notStarted)}%`, background: 'transparent' }} />
                </div>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
      {label}
    </span>
  )
}
