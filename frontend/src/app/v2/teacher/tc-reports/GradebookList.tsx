'use client'

import * as React from 'react'
import { format } from 'date-fns'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { TkBadge } from '@/components/ui-v2'
import type { GradebookAssignment, GradebookStudent } from '@/lib/teacherGradebookApi'
import { GradebookCellBadge } from './GradebookCellBadge'
import {
  assignmentStats,
  resolveSkillKey,
  studentStats,
  type SkillKey,
} from './gradebookModel'
import { ScoreBadge } from './reportShared'

type Translate = (k: string, values?: Record<string, string | number>) => string

export type GradebookListGroup = 'byAssignment' | 'byStudent'

export interface GradebookListProps {
  students: GradebookStudent[]
  /** Assignment list, already filtered by the parent (skill + name search). */
  assignments: GradebookAssignment[]
  group: GradebookListGroup
  t: Translate
  skillLabel: (key: SkillKey) => string
}

function formatDue(dueDate: string | null, t: Translate): string {
  if (!dueDate) return t('gradebook.noDueDate')
  const parsed = new Date(dueDate)
  if (Number.isNaN(parsed.getTime())) return t('gradebook.noDueDate')
  return t('gradebook.dueLabel', { date: format(parsed, 'dd/MM/yyyy') })
}

const ROW_BTN_CLASSES =
  'flex w-full items-center gap-3 border-b border-ga-line bg-ga-card px-4 py-3 text-left transition-colors hover:bg-ga-side-active'

/**
 * The inverted, vertical-only view. "By assignment" answers "how is each task going?" (submitted
 * x/y, how many await grading, class average); "by student" answers "how is each learner doing?".
 * Either way the table only ever grows downward, so a class with 60 assignments reads as a scroll
 * list instead of a wall that runs off the right edge.
 */
export function GradebookList({ students, assignments, group, t, skillLabel }: GradebookListProps) {
  const [expanded, setExpanded] = React.useState<Set<string>>(() => new Set())

  // A change of grouping makes the old expand keys meaningless — start collapsed.
  React.useEffect(() => {
    setExpanded(new Set())
  }, [group])

  function toggle(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  if (group === 'byAssignment') {
    if (assignments.length === 0) {
      return (
        <div className="border border-dashed border-ga-line px-10 py-[40px] text-center text-[14px] text-ga-muted">
          {t('gradebook.noMatchingAssignments')}
        </div>
      )
    }
    return (
      <div className="border border-ga-line">
        {assignments.map((assignment) => {
          const key = `a-${assignment.id}`
          const open = expanded.has(key)
          const stats = assignmentStats(students, assignment.id)
          const skillKey = resolveSkillKey(assignment.skill)
          return (
            <div key={assignment.id}>
              <button type="button" onClick={() => toggle(key)} className={ROW_BTN_CLASSES}>
                {open ? (
                  <ChevronDown size={16} className="shrink-0 text-ga-muted" aria-hidden />
                ) : (
                  <ChevronRight size={16} className="shrink-0 text-ga-muted" aria-hidden />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-semibold text-ga-ink">{assignment.topic}</span>
                    {skillKey && (
                      <TkBadge tone="neutral" variant="soft" className="shrink-0 px-1.5 py-0 text-[10px]">
                        {skillLabel(skillKey)}
                      </TkBadge>
                    )}
                  </div>
                  <p className="mt-0.5 text-[12px] text-ga-subtle">{formatDue(assignment.dueDate, t)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-4 text-[12.5px]">
                  <span className="tabular-nums text-ga-muted">
                    {t('gradebook.submittedCount', { submitted: stats.submitted, assigned: stats.assigned })}
                  </span>
                  {stats.awaiting > 0 && (
                    <TkBadge tone="blue" variant="soft" className="px-1.5 py-0 text-[11px]">
                      {t('gradebook.awaitingCount', { count: stats.awaiting })}
                    </TkBadge>
                  )}
                  <span className="w-[68px] text-right">
                    <ScoreBadge score={stats.avgScore} scale={100} />
                  </span>
                </div>
              </button>
              {open && (
                <div className="border-b border-ga-line bg-ga-side-active/40 px-4 py-2">
                  <table className="w-full text-left text-[13px]">
                    <tbody>
                      {students.map((student) => (
                        <tr key={student.studentId} className="border-b border-ga-line/60 last:border-0">
                          <td className="py-2 pr-4">
                            <span className="font-medium text-ga-ink">{student.name}</span>
                          </td>
                          <td className="py-2 text-right">
                            <GradebookCellBadge cell={student.cells[String(assignment.id)]} t={t} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  // group === 'byStudent'
  return (
    <div className="border border-ga-line">
      {students.map((student) => {
        const key = `s-${student.studentId}`
        const open = expanded.has(key)
        const stats = studentStats(student, assignments)
        return (
          <div key={student.studentId}>
            <button type="button" onClick={() => toggle(key)} className={ROW_BTN_CLASSES}>
              {open ? (
                <ChevronDown size={16} className="shrink-0 text-ga-muted" aria-hidden />
              ) : (
                <ChevronRight size={16} className="shrink-0 text-ga-muted" aria-hidden />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-ga-ink">{student.name}</p>
                <p className="mt-0.5 text-[12px] text-ga-subtle">{student.email}</p>
              </div>
              <div className="flex shrink-0 items-center gap-4 text-[12.5px]">
                <span className="tabular-nums text-ga-muted">
                  {t('gradebook.submittedCount', { submitted: stats.submitted, assigned: stats.assigned })}
                </span>
                <span className="w-[68px] text-right">
                  <ScoreBadge score={student.avgScore} scale={100} />
                </span>
              </div>
            </button>
            {open && (
              <div className="border-b border-ga-line bg-ga-side-active/40 px-4 py-2">
                <table className="w-full text-left text-[13px]">
                  <tbody>
                    {assignments.map((assignment) => {
                      const skillKey = resolveSkillKey(assignment.skill)
                      return (
                        <tr key={assignment.id} className="border-b border-ga-line/60 last:border-0">
                          <td className="py-2 pr-4">
                            <span className="text-ga-ink">{assignment.topic}</span>
                            {skillKey && (
                              <TkBadge tone="neutral" variant="soft" className="ml-2 px-1.5 py-0 text-[10px]">
                                {skillLabel(skillKey)}
                              </TkBadge>
                            )}
                          </td>
                          <td className="py-2 text-right">
                            <GradebookCellBadge cell={student.cells[String(assignment.id)]} t={t} />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
