'use client'

import { useTranslations } from 'next-intl'
import { Minus, Plus } from 'lucide-react'
import {
  DIFFICULTY_LABEL,
  DIFFICULTY_PRESETS,
  type DifficultyPlan,
} from '@/lib/adminExamStudioApi'
import { DIFFICULTY_ORDER, checkMatrix, samePlan, scalePlan, setPlanLevel } from '@/lib/examStudioLogic'
import { GaCap } from '@/components/ui-v2'
import { cn } from '@/lib/utils'
import { Note } from './ui'

interface Props {
  plan: DifficultyPlan
  onChange: (plan: DifficultyPlan) => void
  mode: 'EXAM' | 'PRACTICE'
  itemCount: number
  disabled?: boolean
}

/** Ma trận độ khó 4 bậc: bốn ô tăng/giảm, mẫu nhanh, tổng trực tiếp + cảnh báo. */
export function DifficultyMatrix({ plan, onChange, mode, itemCount, disabled }: Props) {
  const t = useTranslations('v2.adminContent.examStudio')
  const check = checkMatrix(plan, mode, itemCount)
  const max = Math.max(itemCount * 2, 10)

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {DIFFICULTY_ORDER.map((lv) => {
          const v = plan[lv] ?? 0
          const inputId = `matrix-${lv}`
          return (
            <div key={lv} className="rounded-ga border border-ga-line bg-ga-card px-3 py-2.5">
              <label htmlFor={inputId} className="ga-ui mb-1.5 block text-ga-caption font-semibold text-ga-muted">
                {DIFFICULTY_LABEL[lv]}
              </label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  aria-label={t('matrix.decrease', { level: DIFFICULTY_LABEL[lv] })}
                  disabled={disabled || v <= 0}
                  onClick={() => onChange(setPlanLevel(plan, lv, v - 1, max))}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-ga border border-ga-line text-ga-ink hover:bg-ga-surface disabled:opacity-40"
                >
                  <Minus size={14} aria-hidden />
                </button>
                <input
                  id={inputId}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={max}
                  value={v}
                  disabled={disabled}
                  onChange={(e) => onChange(setPlanLevel(plan, lv, Number.parseInt(e.target.value, 10), max))}
                  className="ga-ui h-9 w-12 rounded-ga border border-ga-line bg-ga-bg text-center text-ga-body font-semibold text-ga-ink outline-none focus:border-ga-accent"
                />
                <button
                  type="button"
                  aria-label={t('matrix.increase', { level: DIFFICULTY_LABEL[lv] })}
                  disabled={disabled || v >= max}
                  onClick={() => onChange(setPlanLevel(plan, lv, v + 1, max))}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-ga border border-ga-line text-ga-ink hover:bg-ga-surface disabled:opacity-40"
                >
                  <Plus size={14} aria-hidden />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <p
        aria-live="polite"
        className={cn('ga-ui text-ga-small font-semibold', check.sumError || check.empty ? 'text-ga-red' : 'text-ga-green')}
      >
        {t('matrix.total', { total: check.total, itemCount })}
        {mode === 'PRACTICE' && <span className="font-normal text-ga-muted"> · {t('matrix.practiceFree')}</span>}
      </p>
      {check.sumError && <Note tone="red">{t('matrix.sumError', { itemCount })}</Note>}
      {!check.sumError && check.empty && <Note tone="red">{t('matrix.empty')}</Note>}
      {check.expertWarning && <Note tone="yellow">{t('matrix.expertWarning')}</Note>}

      <div>
        <GaCap className="mb-1.5 block">{t('matrix.presets')}</GaCap>
        <div className="flex flex-wrap gap-1.5">
          {DIFFICULTY_PRESETS.map((preset) => {
            // Mẫu viết cho Teil 5 câu → co giãn theo số câu (Teil 10 câu: 4-4-2-0…).
            const p = { ...preset, plan: scalePlan(preset.plan, itemCount) }
            const on = samePlan(p.plan, plan)
            return (
              <button
                key={p.key}
                type="button"
                disabled={disabled}
                aria-pressed={on}
                onClick={() => onChange({ ...p.plan })}
                className={cn(
                  'ga-ui min-h-9 rounded-ga border px-2.5 py-1 text-ga-caption font-semibold transition-colors disabled:opacity-50',
                  on ? 'border-ga-ink bg-ga-ink text-ga-bg' : 'border-ga-line bg-ga-card text-ga-ink hover:bg-ga-surface',
                )}
              >
                {p.label}{' '}
                <span className={on ? 'opacity-80' : 'text-ga-muted'}>
                  {DIFFICULTY_ORDER.map((k) => p.plan[k]).join('-')}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
