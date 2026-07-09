'use client'

import { format } from 'date-fns'
import { FileDown } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { GaBtn } from '@/components/ui-v2'
import type { SkillReport, SkillReportRow } from '@/lib/teacherGradebookApi'
import { GradeBadge, ReportPrintHeader, ScoreBadge, SkillBar, SKILL_COLORS } from './reportShared'

export interface SkillReportTabProps {
  skillReport: SkillReport | null
  classDisplayName: string
}

const SKILL_KEYS = ['horen', 'lesen', 'schreiben', 'sprechen'] as const
type SkillKey = (typeof SKILL_KEYS)[number]

function averageOf(students: SkillReportRow[], key: SkillKey | 'total'): number | null {
  const values = students.map((s) => s[key]).filter((v): v is number => v != null)
  return values.length === 0 ? null : values.reduce((sum, v) => sum + v, 0) / values.length
}

export function SkillReportTab(props: SkillReportTabProps) {
  const { skillReport, classDisplayName } = props
  const t = useTranslations('v2.teacher.tcReports')
  const students = skillReport?.students ?? []

  if (students.length === 0) {
    return (
      <div className="border border-dashed border-ga-line px-10 py-[40px] text-center text-[14px] text-ga-muted">
        {t('skills.empty')}
      </div>
    )
  }

  const skillLabels: Record<SkillKey, string> = {
    horen: t('skillLabels.horen'),
    lesen: t('skillLabels.lesen'),
    schreiben: t('skillLabels.schreiben'),
    sprechen: t('skillLabels.sprechen'),
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-4">
        <p className="text-[13px] text-ga-muted">{t('skills.helperText')}</p>
        <GaBtn variant="ghost" size="sm" onClick={() => window.print()}>
          <FileDown size={14} aria-hidden /> {t('skills.exportPdf')}
        </GaBtn>
      </div>

      <div className="print-area">
        <ReportPrintHeader
          title={t('skills.printTitle')}
          metaLine={classDisplayName ? t('classLabel', { name: classDisplayName }) : undefined}
          exportedAtLabel={t('exportedAt', { date: format(new Date(), 'dd/MM/yyyy') })}
        />

        <div className="overflow-x-auto border border-ga-line">
          <table className="w-full border-collapse text-left text-[13px]">
            <thead>
              <tr className="bg-ga-side-active">
                <th className="sticky left-0 z-10 whitespace-nowrap border-b border-ga-line bg-ga-side-active px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-ga-muted">
                  {t('skills.studentColumn')}
                </th>
                {SKILL_KEYS.map((key) => (
                  <th
                    key={key}
                    className="whitespace-nowrap border-b border-ga-line px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-ga-muted"
                  >
                    {skillLabels[key]}
                  </th>
                ))}
                <th className="whitespace-nowrap border-b border-ga-line px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-ga-muted">
                  {t('skills.totalColumn')}
                </th>
                <th className="whitespace-nowrap border-b border-ga-line px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-ga-muted">
                  {t('skills.gradeColumn')}
                </th>
              </tr>
            </thead>
            <tbody>
              {students.map((row) => (
                <tr key={row.studentId} className="bg-ga-card">
                  <td className="sticky left-0 z-10 whitespace-nowrap border-b border-ga-line bg-ga-card px-4 py-2.5">
                    <p className="font-semibold text-ga-ink">{row.name}</p>
                    <p className="text-[12px] text-ga-subtle">{row.email}</p>
                  </td>
                  {SKILL_KEYS.map((key) => (
                    <td key={key} className="border-b border-ga-line px-4 py-2.5">
                      <SkillBar value={row[key]} color={SKILL_COLORS[key]} />
                    </td>
                  ))}
                  <td className="border-b border-ga-line px-4 py-2.5 text-center">
                    <ScoreBadge score={row.total} scale={10} />
                  </td>
                  <td className="border-b border-ga-line px-4 py-2.5 text-center">
                    <GradeBadge grade={row.grade} />
                  </td>
                </tr>
              ))}
            </tbody>
            {students.length > 1 && (
              <tfoot>
                <tr className="bg-ga-bg font-semibold">
                  <td className="sticky left-0 z-10 whitespace-nowrap bg-ga-bg px-4 py-2.5 text-[12px] uppercase tracking-[0.04em] text-ga-ink">
                    {t('skills.classAvgRow')}
                  </td>
                  {SKILL_KEYS.map((key) => (
                    <td key={key} className="px-4 py-2.5 text-center">
                      <ScoreBadge score={averageOf(students, key)} scale={10} />
                    </td>
                  ))}
                  <td className="px-4 py-2.5 text-center">
                    <ScoreBadge score={averageOf(students, 'total')} scale={10} />
                  </td>
                  <td className="px-4 py-2.5" />
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        <div className="hidden print:flex justify-between">
          <p className="mt-8 text-[12px] text-ga-ink">{t('skills.printTeacherSign')}</p>
          <p className="mt-8 text-[12px] text-ga-ink">{t('skills.printHeadSign')}</p>
        </div>
      </div>
    </div>
  )
}
