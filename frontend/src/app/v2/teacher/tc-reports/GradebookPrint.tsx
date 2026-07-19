'use client'

import { TkBadge } from '@/components/ui-v2'
import type { Gradebook } from '@/lib/teacherGradebookApi'
import { GradebookCellBadge } from './GradebookCellBadge'
import { chunk, MATRIX_WINDOW_SIZE, resolveSkillKey, type SkillKey } from './gradebookModel'
import { ScoreBadge } from './reportShared'

const PRINT_HEADER_CLASSES =
  'border border-ga-line px-2 py-1.5 text-left text-[10px] font-semibold uppercase text-ga-muted'
const PRINT_CELL_CLASSES = 'border border-ga-line px-2 py-1 align-top'

export interface GradebookPrintProps {
  gradebook: Gradebook
  t: (k: string) => string
  skillLabel: (key: SkillKey) => string
}

/**
 * Print-only sheet. A landscape A4 page cannot paginate horizontally, so a matrix wider than the
 * page silently loses its rightmost columns on the printed page. We therefore split the columns
 * into fixed groups and print each group as its own page (.print-page-break), repeating the
 * student name and the "Điểm TB" column on every page so each sheet is self-contained. The whole
 * block sits in a `.print-flow` `.print-area`, which drops the `position: fixed` overlay that
 * would otherwise collapse every group onto a single page.
 */
export function GradebookPrint({ gradebook, t, skillLabel }: GradebookPrintProps) {
  const groups = chunk(gradebook.assignments, MATRIX_WINDOW_SIZE)
  return (
    <>
      {groups.map((group, groupIndex) => (
        <div key={groupIndex} className={groupIndex > 0 ? 'print-page-break' : undefined}>
          <table className="w-full border-collapse text-left text-[11px]">
            <thead>
              <tr>
                <th className={PRINT_HEADER_CLASSES}>{t('gradebook.studentColumn')}</th>
                {group.map((assignment) => {
                  const skillKey = resolveSkillKey(assignment.skill)
                  return (
                    <th key={assignment.id} className={PRINT_HEADER_CLASSES}>
                      <span className="text-ga-ink">{assignment.topic}</span>
                      {skillKey && (
                        <TkBadge
                          tone="neutral"
                          variant="soft"
                          className="ml-1 px-1 py-0 text-[9px]"
                        >
                          {skillLabel(skillKey)}
                        </TkBadge>
                      )}
                    </th>
                  )
                })}
                <th className={`${PRINT_HEADER_CLASSES} text-center`}>
                  {t('gradebook.avgScoreColumn')}
                </th>
              </tr>
            </thead>
            <tbody>
              {gradebook.students.map((student) => (
                <tr key={student.studentId}>
                  <th scope="row" className={`${PRINT_CELL_CLASSES} text-left font-normal`}>
                    <span className="font-semibold text-ga-ink">{student.name}</span>
                  </th>
                  {group.map((assignment) => (
                    <td key={assignment.id} className={PRINT_CELL_CLASSES}>
                      <GradebookCellBadge cell={student.cells[String(assignment.id)]} t={t} />
                    </td>
                  ))}
                  <td className={`${PRINT_CELL_CLASSES} text-center`}>
                    <ScoreBadge score={student.avgScore} scale={100} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </>
  )
}
