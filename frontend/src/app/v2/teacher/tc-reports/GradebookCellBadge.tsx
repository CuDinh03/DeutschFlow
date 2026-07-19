'use client'

import { TkBadge } from '@/components/ui-v2'
import type { GradebookCell } from '@/lib/teacherGradebookApi'
import { classifyCell } from './gradebookModel'
import { ScoreBadge } from './reportShared'

/**
 * Renders one gradebook cell. The classification (status-first, never score-first) lives in
 * classifyCell so the matrix, the list and the printable sheet all show a cell identically —
 * an AI_GRADED proposal is a badge, never a plain grade; a GRADING_FAILED row is its own badge,
 * never "not submitted".
 */
export function GradebookCellBadge({
  cell,
  t,
}: {
  cell: GradebookCell | undefined
  t: (k: string) => string
}) {
  const { kind, score } = classifyCell(cell)
  switch (kind) {
    case 'empty':
      return <span className="text-ga-subtle">·</span>
    case 'awaitingConfirm':
      return (
        <TkBadge tone="violet" variant="soft">
          {t('gradebook.awaitingConfirm')}
        </TkBadge>
      )
    case 'regradeNeeded':
      return (
        <TkBadge tone="red" variant="soft">
          {t('gradebook.regradeNeeded')}
        </TkBadge>
      )
    case 'submitted':
      return (
        <TkBadge tone="blue" variant="soft">
          {t('gradebook.pendingGrade')}
        </TkBadge>
      )
    case 'score':
      return <ScoreBadge score={score} scale={100} />
    case 'pendingGrade':
      return <span className="text-[12px] text-ga-muted">{t('gradebook.pendingGrade')}</span>
    default: // notSubmitted — PENDING / unknown
      return <span className="text-[12px] text-ga-muted">{t('gradebook.notSubmitted')}</span>
  }
}
