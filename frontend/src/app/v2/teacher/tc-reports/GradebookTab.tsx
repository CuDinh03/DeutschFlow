'use client'

import { format } from 'date-fns'
import { FileDown } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { GaBtn, TkBadge } from '@/components/ui-v2'
import type { Gradebook } from '@/lib/teacherGradebookApi'
import { ReportPrintHeader, ScoreBadge } from './reportShared'

export interface GradebookTabProps {
  gradebook: Gradebook | null
  classDisplayName: string
}

type SkillLabelKey = 'horen' | 'lesen' | 'schreiben' | 'sprechen'

function resolveSkillLabelKey(skill: string | null): SkillLabelKey | null {
  if (!skill) {
    return null
  }
  switch (skill.trim().toLowerCase()) {
    case 'horen':
      return 'horen'
    case 'lesen':
      return 'lesen'
    case 'schreiben':
      return 'schreiben'
    case 'sprechen':
      return 'sprechen'
    default:
      return null
  }
}

function truncateTopic(topic: string): { label: string; title: string | undefined } {
  if (topic.length > 18) {
    return { label: `${topic.slice(0, 16)}…`, title: topic }
  }
  return { label: topic, title: undefined }
}

const EMPTY_STATE_CLASSES =
  'border border-dashed border-ga-line px-10 py-[40px] text-center text-[14px] text-ga-muted'

const STATIC_HEADER_CLASSES =
  'whitespace-nowrap border-b border-ga-line px-4 py-3 align-bottom text-[11px] font-semibold uppercase tracking-[0.08em] text-ga-muted'

export function GradebookTab(props: GradebookTabProps) {
  const { gradebook, classDisplayName } = props
  const t = useTranslations('v2.teacher.tcReports')

  if (!gradebook || gradebook.students.length === 0) {
    return <div className={EMPTY_STATE_CLASSES}>{t('gradebook.emptyStudents')}</div>
  }

  if (gradebook.assignments.length === 0) {
    return <div className={EMPTY_STATE_CLASSES}>{t('gradebook.emptyAssignments')}</div>
  }

  function skillTagLabel(skillKey: SkillLabelKey): string {
    switch (skillKey) {
      case 'horen':
        return t('skillLabels.horen').split(' ')[0]
      case 'lesen':
        return t('skillLabels.lesen').split(' ')[0]
      case 'schreiben':
        return t('skillLabels.schreiben').split(' ')[0]
      case 'sprechen':
        return t('skillLabels.sprechen').split(' ')[0]
    }
  }

  const summary = t('gradebook.summary', {
    students: gradebook.students.length,
    assignments: gradebook.assignments.length,
  })

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-4">
        <p className="text-[13px] text-ga-muted">{summary}</p>
        <GaBtn variant="ghost" size="sm" onClick={() => window.print()}>
          <FileDown size={14} aria-hidden /> {t('gradebook.exportPdf')}
        </GaBtn>
      </div>

      <div className="print-area">
        <ReportPrintHeader
          title={t('gradebook.printTitle')}
          subtitle={summary}
          metaLine={classDisplayName ? t('classLabel', { name: classDisplayName }) : undefined}
          exportedAtLabel={t('exportedAt', { date: format(new Date(), 'dd/MM/yyyy') })}
        />

        <div className="overflow-x-auto border border-ga-line">
          <table className="w-full border-collapse text-left text-[13px]">
            <thead>
              <tr className="bg-ga-side-active">
                <th className={`sticky left-0 z-10 bg-ga-side-active ${STATIC_HEADER_CLASSES}`}>
                  {t('gradebook.studentColumn')}
                </th>
                {gradebook.assignments.map((assignment) => {
                  const { label, title } = truncateTopic(assignment.topic)
                  const skillKey = resolveSkillLabelKey(assignment.skill)
                  return (
                    <th
                      key={assignment.id}
                      title={title}
                      className="border-b border-ga-line px-4 py-3 align-bottom"
                    >
                      <div className="whitespace-nowrap text-[13px] font-semibold text-ga-ink">
                        {label}
                      </div>
                      {skillKey && (
                        <TkBadge tone="neutral" variant="soft" className="mt-1 px-1.5 py-0 text-[10px]">
                          {skillTagLabel(skillKey)}
                        </TkBadge>
                      )}
                    </th>
                  )
                })}
                <th className={STATIC_HEADER_CLASSES}>{t('gradebook.avgScoreColumn')}</th>
              </tr>
            </thead>
            <tbody>
              {gradebook.students.map((student, rowIndex) => {
                const rowBg = rowIndex % 2 === 1 ? 'bg-ga-side-active' : 'bg-ga-card'
                return (
                  <tr key={student.studentId} className={rowBg}>
                    <th
                      scope="row"
                      className={`sticky left-0 z-10 border-b border-ga-line px-4 py-2.5 text-left align-top font-normal ${rowBg}`}
                    >
                      <p className="font-semibold text-ga-ink">{student.name}</p>
                      <p className="text-[12px] text-ga-subtle">{student.email}</p>
                    </th>
                    {gradebook.assignments.map((assignment) => {
                      const cell = student.cells[String(assignment.id)]
                      return (
                        <td key={assignment.id} className="border-b border-ga-line px-4 py-2.5 align-top">
                          {cell == null ? (
                            <span className="text-ga-subtle">·</span>
                          ) : cell.score != null ? (
                            <ScoreBadge score={cell.score} scale={100} />
                          ) : cell.status === 'SUBMITTED' ? (
                            <TkBadge tone="blue" variant="soft">
                              {t('gradebook.pendingGrade')}
                            </TkBadge>
                          ) : (
                            <span className="text-[12px] text-ga-muted">{t('gradebook.notSubmitted')}</span>
                          )}
                        </td>
                      )
                    })}
                    <td className="border-b border-ga-line px-4 py-2.5 align-top">
                      <ScoreBadge score={student.avgScore} scale={100} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
