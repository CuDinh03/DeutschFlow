'use client'

import * as React from 'react'
import { format } from 'date-fns'
import { ChevronLeft, ChevronRight, FileDown, Search } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { GaBtn, TkSeg } from '@/components/ui-v2'
import type { Gradebook } from '@/lib/teacherGradebookApi'
import { GradebookList, type GradebookListGroup } from './GradebookList'
import { GradebookMatrix } from './GradebookMatrix'
import {
  filterAssignments,
  lastPageIndex,
  MATRIX_WINDOW_SIZE,
  type SkillFilter,
  type SkillKey,
  windowAt,
} from './gradebookModel'
import { GradebookPrint } from './GradebookPrint'
import { ReportPrintHeader } from './reportShared'

export interface GradebookTabProps {
  gradebook: Gradebook | null
  classDisplayName: string
}

const EMPTY_STATE_CLASSES =
  'border border-dashed border-ga-line px-4 py-[40px] text-center text-[14px] text-ga-muted sm:px-6 lg:px-10'

const VIEW_MODE_STORAGE_KEY = 'df.gradebook.viewMode'
type ViewMode = 'matrix' | 'list'

const SKILL_FILTER_ORDER: readonly SkillFilter[] = [
  'all',
  'horen',
  'lesen',
  'schreiben',
  'sprechen',
  'other',
]

/**
 * The gradebook tab. Two views share one toolbar (a persisted TkSeg): a windowed MATRIX (8
 * assignment columns at a time, sticky student + average columns, skill/name filters) and an
 * inverted LIST (by assignment or by student, vertical-only). The printable sheet is a separate,
 * always-full, chunked block so the PDF keeps every column even though the screen only shows a
 * window.
 */
export function GradebookTab({ gradebook, classDisplayName }: GradebookTabProps) {
  const t = useTranslations('v2.teacher.tcReports')

  const [mode, setMode] = React.useState<ViewMode>('matrix')
  const [listGroup, setListGroup] = React.useState<GradebookListGroup>('byAssignment')
  const [skill, setSkill] = React.useState<SkillFilter>('all')
  const [query, setQuery] = React.useState('')
  // null → follow the default (newest window); a number → the user has paged explicitly.
  const [pageOverride, setPageOverride] = React.useState<number | null>(null)

  // Restore the last-used view once mounted (avoids an SSR/hydration mismatch on localStorage).
  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(VIEW_MODE_STORAGE_KEY)
      if (stored === 'matrix' || stored === 'list') setMode(stored)
    } catch {
      // localStorage may be unavailable (private mode / SSR) — the default view is fine.
    }
  }, [])

  // Memoised so the fallback empty array keeps a stable identity — otherwise the filter useMemo and
  // the page-reset effect below would re-run on every render.
  const assignments = React.useMemo(() => gradebook?.assignments ?? [], [gradebook])
  const students = React.useMemo(() => gradebook?.students ?? [], [gradebook])

  const filtered = React.useMemo(
    () => filterAssignments(assignments, { skill, query }),
    [assignments, skill, query],
  )

  // Any change to the filter (or the loaded class) drops back to the default newest window.
  React.useEffect(() => {
    setPageOverride(null)
  }, [skill, query, assignments])

  function changeMode(next: ViewMode) {
    setMode(next)
    try {
      localStorage.setItem(VIEW_MODE_STORAGE_KEY, next)
    } catch {
      // ignore write failures — persistence is best-effort
    }
  }

  const skillLabel = React.useCallback(
    (key: SkillKey): string => t(`skillLabels.${key}`).split(' ')[0],
    [t],
  )

  const skillFilterLabel = React.useCallback(
    (value: SkillFilter): string => {
      if (value === 'all') return t('gradebook.skillAll')
      if (value === 'other') return t('gradebook.skillOther')
      return skillLabel(value)
    },
    [skillLabel, t],
  )

  if (!gradebook || students.length === 0) {
    return <div className={EMPTY_STATE_CLASSES}>{t('gradebook.emptyStudents')}</div>
  }
  if (assignments.length === 0) {
    return <div className={EMPTY_STATE_CLASSES}>{t('gradebook.emptyAssignments')}</div>
  }

  const summary = t('gradebook.summary', {
    students: students.length,
    assignments: assignments.length,
  })

  const effectivePage = pageOverride ?? lastPageIndex(filtered.length)
  const win = windowAt(filtered, effectivePage)
  const showFilters = mode === 'matrix' || (mode === 'list' && listGroup === 'byAssignment')
  // "By student" always shows the full picture per learner, so it ignores the column filter.
  const listAssignments = listGroup === 'byAssignment' ? filtered : assignments

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <TkSeg<ViewMode>
            aria-label={t('gradebook.viewModeLabel')}
            value={mode}
            onValueChange={changeMode}
            options={[
              { value: 'matrix', label: t('gradebook.viewMatrix') },
              { value: 'list', label: t('gradebook.viewList') },
            ]}
          />
          {mode === 'list' && (
            <TkSeg<GradebookListGroup>
              aria-label={t('gradebook.groupLabel')}
              value={listGroup}
              onValueChange={setListGroup}
              options={[
                { value: 'byAssignment', label: t('gradebook.groupByAssignment') },
                { value: 'byStudent', label: t('gradebook.groupByStudent') },
              ]}
            />
          )}
        </div>
        <GaBtn variant="ghost" size="sm" onClick={() => window.print()}>
          <FileDown size={14} aria-hidden /> {t('gradebook.exportPdf')}
        </GaBtn>
      </div>

      {showFilters && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <TkSeg<SkillFilter>
              aria-label={t('gradebook.filterSkill')}
              value={skill}
              onValueChange={setSkill}
              options={SKILL_FILTER_ORDER.map((value) => ({ value, label: skillFilterLabel(value) }))}
            />
            <label className="flex min-w-0 flex-1 items-center gap-2 rounded-ga border border-ga-line bg-ga-surface px-3 py-2 sm:flex-none">
              <Search size={15} className="text-ga-subtle" aria-hidden />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('gradebook.searchPlaceholder')}
                aria-label={t('gradebook.searchPlaceholder')}
                className="ga-ui min-w-0 border-none bg-transparent text-[13px] text-ga-ink outline-none placeholder:text-ga-subtle"
              />
            </label>
          </div>
          {mode === 'matrix' && win.total > MATRIX_WINDOW_SIZE && (
            <div className="flex items-center gap-2 text-[12.5px] text-ga-muted">
              <span className="tabular-nums">
                {t('gradebook.pageLabel', { from: win.from, to: win.to, total: win.total })}
              </span>
              <GaBtn
                variant="ghost"
                size="sm"
                disabled={win.page <= 0}
                aria-label={t('gradebook.prevPage')}
                onClick={() => setPageOverride(Math.max(0, win.page - 1))}
              >
                <ChevronLeft size={16} aria-hidden />
              </GaBtn>
              <GaBtn
                variant="ghost"
                size="sm"
                disabled={win.page >= win.pageCount - 1}
                aria-label={t('gradebook.nextPage')}
                onClick={() => setPageOverride(Math.min(win.pageCount - 1, win.page + 1))}
              >
                <ChevronRight size={16} aria-hidden />
              </GaBtn>
            </div>
          )}
        </div>
      )}

      <div data-testid="gradebook-screen" className="print:hidden">
        {mode === 'matrix' ? (
          win.items.length > 0 ? (
            <GradebookMatrix
              students={students}
              assignments={win.items}
              t={t}
              skillLabel={skillLabel}
            />
          ) : (
            <div className={EMPTY_STATE_CLASSES}>{t('gradebook.noMatchingAssignments')}</div>
          )
        ) : (
          <GradebookList
            students={students}
            assignments={listAssignments}
            group={listGroup}
            t={t}
            skillLabel={skillLabel}
          />
        )}
        <p className="mt-2 text-[12px] text-ga-subtle">{t('gradebook.avgNote')}</p>
      </div>

      <div className="print-area print-flow hidden print:block" aria-hidden="true">
        <ReportPrintHeader
          title={t('gradebook.printTitle')}
          subtitle={summary}
          metaLine={classDisplayName ? t('classLabel', { name: classDisplayName }) : undefined}
          exportedAtLabel={t('exportedAt', { date: format(new Date(), 'dd/MM/yyyy') })}
        />
        <GradebookPrint gradebook={gradebook} t={t} skillLabel={skillLabel} />
      </div>
    </div>
  )
}
