'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { defaultTarget, type ExamBudget, type TeilLoss } from './examBudget'

/**
 * Khối "Ngân sách điểm" trên màn kết quả đề telc (LT1, 22/10/2026): điểm đã mất theo Teil (xếp theo
 * điểm, kèm trọng số câu) và mục tiêu xếp loại người học chọn → được mất tối đa bao nhiêu điểm, kèm
 * một cách chia ví dụ. Đề Goethe không có `budget` nên không thấy khối này.
 */
export function ExamBudgetPanel({ budget }: { budget: ExamBudget }) {
  const t = useTranslations('v2.student.mockExamRun')
  const tParts = useTranslations('v2.student.examResult.parts')
  const locale = useLocale()
  const [grade, setGrade] = useState<string | null>(() => defaultTarget(budget.targets))

  const fmt = (n: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(n)
  const part = (section: string) => (tParts.has(section) ? tParts(section) : section)
  const target = budget.targets.find((x) => x.grade === grade) ?? null

  return (
    <section className="rounded-ga border border-ga-line bg-ga-card p-4 lg:p-6">
      <h3 className="ga-ui mb-1 text-ga-caption font-bold uppercase tracking-wide text-ga-muted">{t('budgetTitle')}</h3>
      <p className="ga-ui mb-5 text-ga-small text-ga-muted">{t('budgetHint', { total: fmt(budget.totalMax) })}</p>

      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h4 className="ga-ui text-ga-body font-semibold text-ga-ink">{t('budgetLostTitle')}</h4>
        <p className="ga-ui text-ga-small text-ga-muted">
          {t('budgetLostTotal', { lost: fmt(budget.lost), total: fmt(budget.totalMax) })}
          {budget.pending && <> · {t('budgetLostPending')}</>}
        </p>
      </div>
      <ul className="mb-6 space-y-2.5">
        {budget.losses.map((row) => (
          <LossRow key={`${row.section}-${row.teil ?? 'all'}`} row={row} label={rowLabel(row)} fmt={fmt} />
        ))}
      </ul>

      {budget.targets.length > 0 && (
        <div className="border-t border-ga-line pt-5">
          <h4 className="ga-ui mb-1 text-ga-body font-semibold text-ga-ink">{t('budgetTargetTitle')}</h4>
          <p className="ga-ui mb-3 text-ga-small text-ga-muted">{t('budgetTargetHint')}</p>
          <div className="mb-4 flex flex-wrap gap-2" role="radiogroup" aria-label={t('budgetTargetTitle')}>
            {budget.targets.map((x) => (
              <button
                key={x.grade}
                type="button"
                role="radio"
                aria-checked={grade === x.grade}
                onClick={() => setGrade(x.grade)}
                className={`ga-ui min-h-11 border px-3 py-2 text-ga-small font-semibold transition-colors lg:min-h-0 ${
                  grade === x.grade
                    ? 'border-ga-ink bg-ga-ink text-ga-bg'
                    : 'border-ga-line text-ga-muted hover:border-ga-ink hover:text-ga-ink'
                }`}
              >
                {t(`grades.${x.grade}`)}
              </button>
            ))}
          </div>
          {target && (
            <div className="space-y-2">
              <p className="ga-ui text-ga-body text-ga-ink">
                {t('budgetTargetAllowance', {
                  grade: t(`grades.${target.grade}`),
                  min: fmt(target.minPoints),
                  total: fmt(budget.totalMax),
                  maxLoss: fmt(target.maxLoss),
                })}
              </p>
              <p className={`ga-ui text-ga-small font-semibold ${target.remaining >= 0 ? 'text-ga-green' : 'text-ga-red'}`}>
                {target.remaining >= 0
                  ? t('budgetTargetLeft', { lost: fmt(budget.lost), left: fmt(target.remaining) })
                  : t('budgetTargetOver', { lost: fmt(budget.lost), over: fmt(-target.remaining) })}
              </p>
              <p className="ga-ui pt-2 text-ga-small text-ga-muted">{t('budgetTargetExample')}</p>
              <ul className="grid gap-1.5 sm:grid-cols-2">
                {target.example.map((s) => (
                  <li key={s.section} className="ga-ui border-l-2 border-ga-border pl-3 text-ga-small text-ga-ink">
                    {t('budgetTargetShare', { part: part(s.section), n: fmt(s.maxLoss) })}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  )

  function rowLabel(row: TeilLoss) {
    return row.teil != null ? t('budgetRowTeil', { part: part(row.section), n: row.teil }) : part(row.section)
  }
}

function LossRow({ row, label, fmt }: { row: TeilLoss; label: string; fmt: (n: number) => string }) {
  const t = useTranslations('v2.student.mockExamRun')
  const lostShare = !row.pending && row.max > 0 ? Math.min(1, (row.lost ?? 0) / row.max) : 0

  let detail: string
  if (row.pending) {
    detail = row.section === 'SPRECHEN'
      ? t('budgetRowPendingSpeaking')
      : row.section === 'SCHREIBEN' ? t('budgetRowPendingWriting') : t('budgetRowPendingOther')
  } else if (row.items != null && row.correct != null) {
    detail = row.pointPerItem != null
      ? t('budgetRowItems', { correct: row.correct, items: row.items, perItem: fmt(row.pointPerItem) })
      : t('budgetRowItemsMixed', { correct: row.correct, items: row.items })
  } else {
    detail = t('budgetRowScore', { earned: fmt(row.earned ?? 0), max: fmt(row.max) })
  }

  return (
    <li className="min-w-0">
      <div className="flex items-baseline justify-between gap-3">
        <p className="ga-ui min-w-0 break-words text-ga-small font-semibold text-ga-ink">{label}</p>
        <p
          className={`ga-ui shrink-0 text-ga-small font-bold ${
            row.pending ? 'text-ga-muted' : (row.lost ?? 0) > 0 ? 'text-ga-red' : 'text-ga-green'
          }`}
        >
          {row.pending ? '—' : (row.lost ?? 0) > 0 ? `−${fmt(row.lost ?? 0)}` : t('budgetRowNone')}
        </p>
      </div>
      <div className="mt-1 h-1.5 w-full bg-ga-surface" aria-hidden>
        <div className="h-full bg-ga-red" style={{ width: `${Math.round(lostShare * 100)}%` }} />
      </div>
      <p className="ga-ui mt-1 text-ga-caption text-ga-muted">{detail}</p>
    </li>
  )
}
