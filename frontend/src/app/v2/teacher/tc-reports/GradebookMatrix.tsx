'use client'

import { TkBadge } from '@/components/ui-v2'
import type { GradebookAssignment, GradebookStudent } from '@/lib/teacherGradebookApi'
import { GradebookCellBadge } from './GradebookCellBadge'
import { resolveSkillKey, type SkillKey } from './gradebookModel'
import { ScoreBadge } from './reportShared'

const HEADER_CLASSES =
  'whitespace-nowrap border-b border-ga-line px-4 py-3 align-bottom text-[11px] font-semibold uppercase tracking-[0.08em] text-ga-muted'

export interface GradebookMatrixProps {
  /** Students (rows). */
  students: GradebookStudent[]
  /** The assignment columns to show — already windowed + filtered by the parent. */
  assignments: GradebookAssignment[]
  t: (k: string) => string
  skillLabel: (key: SkillKey) => string
}

/**
 * The classic student × assignment matrix, but only the parent-supplied column window is in the
 * DOM. The student column is sticky-left and the "Điểm TB" column is sticky-right, so both the
 * row identity and the headline number stay visible no matter how many columns scroll between them.
 */
export function GradebookMatrix({ students, assignments, t, skillLabel }: GradebookMatrixProps) {
  return (
    <div className="overflow-x-auto border border-ga-line">
      <table className="w-full border-collapse text-left text-[13px]">
        <thead>
          <tr className="bg-ga-side-active">
            <th className={`sticky left-0 z-30 bg-ga-side-active ${HEADER_CLASSES}`}>
              {t('gradebook.studentColumn')}
            </th>
            {assignments.map((assignment) => {
              const skillKey = resolveSkillKey(assignment.skill)
              return (
                <th
                  key={assignment.id}
                  title={assignment.topic}
                  className="border-b border-ga-line px-4 py-3 align-bottom"
                >
                  <div className="max-w-[170px] truncate text-[13px] font-semibold text-ga-ink">
                    {assignment.topic}
                  </div>
                  {skillKey && (
                    <TkBadge
                      tone="neutral"
                      variant="soft"
                      className="mt-1 px-1.5 py-0 text-[10px]"
                    >
                      {skillLabel(skillKey)}
                    </TkBadge>
                  )}
                </th>
              )
            })}
            <th className={`sticky right-0 z-20 bg-ga-side-active ${HEADER_CLASSES} text-center`}>
              {t('gradebook.avgScoreColumn')}
            </th>
          </tr>
        </thead>
        <tbody>
          {students.map((student, rowIndex) => {
            const rowBg = rowIndex % 2 === 1 ? 'bg-ga-side-active' : 'bg-ga-card'
            return (
              <tr key={student.studentId} className={rowBg}>
                {/* z-20 keeps the sticky-left student column above the sticky-right avg column (z-10)
                    when both pin into the same space on a narrow viewport; max-width + truncate stop a
                    long name/email from ballooning the column into that overlap. */}
                <th
                  scope="row"
                  className={`sticky left-0 z-20 max-w-[220px] border-b border-ga-line px-4 py-2.5 text-left align-top font-normal ${rowBg}`}
                >
                  <p className="truncate font-semibold text-ga-ink">{student.name}</p>
                  <p className="truncate text-[12px] text-ga-subtle">{student.email}</p>
                </th>
                {assignments.map((assignment) => (
                  <td
                    key={assignment.id}
                    className="border-b border-ga-line px-4 py-2.5 align-top"
                  >
                    <GradebookCellBadge cell={student.cells[String(assignment.id)]} t={t} />
                  </td>
                ))}
                <td
                  className={`sticky right-0 z-10 border-b border-ga-line px-4 py-2.5 text-center align-top ${rowBg}`}
                >
                  <ScoreBadge score={student.avgScore} scale={100} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
