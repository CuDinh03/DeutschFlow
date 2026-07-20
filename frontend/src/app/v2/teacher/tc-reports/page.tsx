'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { AlertTriangle } from 'lucide-react'
import { apiMessage } from '@/lib/api'
import { getGradebook, getSkillReport, type Gradebook, type SkillReport } from '@/lib/teacherGradebookApi'
import { listLessonLogs, type ClassLessonLog } from '@/lib/teacherLessonLogApi'
import { listLessons, type ClassLesson } from '@/lib/teacherLessonsApi'
import { listEvaluations, type StudentEvaluation } from '@/lib/teacherEvaluationApi'
import { getClassCompetency, type ClassCompetency } from '@/lib/teacherCompetencyApi'
import { GaPageHdr, GaBtn, TkTabs, TkTabsList, TkTabsTrigger, TkTabsContent } from '@/components/ui-v2'
import { ClassPicker, useTeacherClasses } from '../tcShared'
import { GradebookTab } from './GradebookTab'
import { SkillReportTab } from './SkillReportTab'
import { AttendanceTab } from './AttendanceTab'
import { EvaluationTab } from './EvaluationTab'
import { CompetencyTab } from './CompetencyTab'

// Per-class report suite (Phase 0.3/0.4): ports the four v1 `/teacher/reports` tabs
// (gradebook, skill report, attendance/lesson-log, evaluation) onto the Galerie v2
// design system. The four datasets are fetched together per class-select. Each fetch
// degrades independently: a single-endpoint failure surfaces a non-blocking warning
// and still renders the tabs that loaded; a total failure shows the retry banner. A
// generation guard drops out-of-order responses when the teacher switches class mid-fetch.

const SECTION_TAB_KEY: Record<string, string> = {
  gradebook: 'tabs.gradebook',
  skills: 'tabs.skills',
  attendance: 'tabs.attendance',
  evaluation: 'tabs.evaluation',
  competency: 'tabs.competency',
}

export default function V2TcReportsPage() {
  const t = useTranslations('v2.teacher.tcReports')
  const tc = useTranslations('v2.common')
  const { classes, classId, setClassId, loadingClasses } = useTeacherClasses()

  const [gradebook, setGradebook] = useState<Gradebook | null>(null)
  const [skillReport, setSkillReport] = useState<SkillReport | null>(null)
  const [lessonLogs, setLessonLogs] = useState<ClassLessonLog[]>([])
  const [lessons, setLessons] = useState<ClassLesson[]>([])
  const [evaluations, setEvaluations] = useState<StudentEvaluation[]>([])
  const [competency, setCompetency] = useState<ClassCompetency | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [failedSections, setFailedSections] = useState<string[]>([])
  // Monotonic token: only the newest load() may commit state, so a slow response for a
  // previously-selected class can't overwrite the class the teacher has since switched to.
  const loadSeq = useRef(0)

  const load = useCallback(async (cid: number) => {
    const seq = ++loadSeq.current
    setLoading(true)
    setError('')
    setFailedSections([])
    // The first five feed the five tabs and drive the degradation banner; listLessons is
    // supplemental (it only populates the attendance lesson-picker), so it is fetched
    // alongside but excluded from the section-failure accounting below.
    const results = await Promise.allSettled([
      getGradebook(cid),
      getSkillReport(cid),
      listLessonLogs(cid),
      listEvaluations(cid),
      getClassCompetency(cid),
      listLessons(cid),
    ])
    if (seq !== loadSeq.current) return // a newer class-switch superseded this load

    const [gbR, srR, logsR, evalsR, compR, lessonsR] = results
    const sectionResults = [gbR, srR, logsR, evalsR, compR]
    const failed: string[] = []
    if (gbR.status === 'rejected') failed.push('gradebook')
    if (srR.status === 'rejected') failed.push('skills')
    if (logsR.status === 'rejected') failed.push('attendance')
    if (evalsR.status === 'rejected') failed.push('evaluation')
    if (compR.status === 'rejected') failed.push('competency')

    if (failed.length === sectionResults.length) {
      const firstRejected = sectionResults.find((r) => r.status === 'rejected') as PromiseRejectedResult | undefined
      setError(apiMessage(firstRejected?.reason))
      setLoading(false)
      return
    }

    setGradebook(gbR.status === 'fulfilled' ? gbR.value : null)
    setSkillReport(srR.status === 'fulfilled' ? srR.value : null)
    setLessonLogs(logsR.status === 'fulfilled' ? logsR.value : [])
    setEvaluations(evalsR.status === 'fulfilled' ? evalsR.value : [])
    setCompetency(compR.status === 'fulfilled' ? compR.value : null)
    setLessons(lessonsR.status === 'fulfilled' ? lessonsR.value : [])
    setFailedSections(failed)
    setLoading(false)
  }, [])

  useEffect(() => { if (classId) void load(classId) }, [classId, load])

  const classDisplayName = classes.find((c) => c.id === classId)?.name ?? ''

  // Roster used to MARK attendance. Must be authoritative current membership: the gradebook,
  // falling back to the evaluations list (also one row per enrolled student).
  //
  // Deliberately has NO lesson-log fallback. Students recorded on older logs may since have left
  // the class, and the backend rejects attendance rows for non-members — feeding those ids into
  // the form would make every save fail with a generic error and leave the teacher unable to
  // record anything at all.
  const roster = useMemo(() => {
    if (gradebook?.students.length) {
      return gradebook.students.map((s) => ({ studentId: s.studentId, name: s.name }))
    }
    return evaluations.map((e) => ({ studentId: e.studentId, name: e.name }))
  }, [gradebook, evaluations])

  // Roster used to DISPLAY history (the printed attendance matrix). When both enrolment endpoints
  // are down, fall back to whoever appears across the existing logs so the printed sheet is not
  // blank. Read-only by design — this list must never drive the entry form.
  const printRoster = useMemo(() => {
    if (roster.length) return roster
    const seen = new Map<number, string>()
    for (const log of lessonLogs) {
      for (const a of log.attendance) {
        if (!seen.has(a.studentId)) seen.set(a.studentId, a.name)
      }
    }
    return Array.from(seen, ([studentId, name]) => ({ studentId, name }))
  }, [roster, lessonLogs])

  const failedSectionLabel = failedSections.map((s) => t(SECTION_TAB_KEY[s])).join(', ')

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr
        accent
        title={t('title')}
        subtitle={t('subtitle')}
        right={<ClassPicker classes={classes} classId={classId} onChange={setClassId} disabled={loadingClasses} />}
      />

      <div className="flex-1 overflow-auto px-10 py-6">
        {!classId ? (
          <div className="border border-dashed border-ga-line px-10 py-[40px] text-center text-[14px] text-ga-muted">
            {t('selectClassPrompt')}
          </div>
        ) : loading ? (
          <div className="ga-shimmer h-[320px] border border-ga-line" aria-hidden />
        ) : error ? (
          <div className="border border-ga-line bg-ga-card px-10 py-[52px] text-center">
            <h2 className="font-ga-display text-[24px] font-medium text-ga-red">{t('loadError')}</h2>
            <p className="ga-ui mx-auto mb-5 mt-3 max-w-sm text-[14px] text-ga-muted">{error}</p>
            <GaBtn variant="primary" onClick={() => classId && load(classId)}>{tc('retry')}</GaBtn>
          </div>
        ) : (
          <>
            {failedSections.length > 0 && (
              <div
                role="alert"
                className="mb-4 flex items-start gap-2.5 border px-4 py-3 text-[13px] text-ga-ink"
                style={{ background: 'var(--ga-yellow-soft)', borderColor: 'color-mix(in srgb, var(--ga-gold) 30%, transparent)' }}
              >
                <AlertTriangle size={17} style={{ color: 'var(--ga-gold)' }} className="mt-px shrink-0" />
                <p className="m-0">{t('partialLoadWarning', { sections: failedSectionLabel })}</p>
              </div>
            )}

            <TkTabs defaultValue="gradebook">
              <TkTabsList>
                <TkTabsTrigger value="gradebook">{t('tabs.gradebook')}</TkTabsTrigger>
                <TkTabsTrigger value="skills">{t('tabs.skills')}</TkTabsTrigger>
                <TkTabsTrigger value="attendance">{t('tabs.attendance')}</TkTabsTrigger>
                <TkTabsTrigger value="competency">{t('tabs.competency')}</TkTabsTrigger>
                <TkTabsTrigger value="evaluation">{t('tabs.evaluation')}</TkTabsTrigger>
              </TkTabsList>

              <TkTabsContent value="gradebook">
                <GradebookTab gradebook={gradebook} classDisplayName={classDisplayName} />
              </TkTabsContent>
              <TkTabsContent value="skills">
                <SkillReportTab skillReport={skillReport} classDisplayName={classDisplayName} />
              </TkTabsContent>
              <TkTabsContent value="attendance">
                <AttendanceTab
                  classId={classId}
                  lessonLogs={lessonLogs}
                  onLessonLogsChange={setLessonLogs}
                  roster={roster}
                  printRoster={printRoster}
                  lessons={lessons}
                  classDisplayName={classDisplayName}
                />
              </TkTabsContent>
              <TkTabsContent value="competency">
                <CompetencyTab competency={competency} />
              </TkTabsContent>
              <TkTabsContent value="evaluation">
                <EvaluationTab
                  classId={classId}
                  evaluations={evaluations}
                  onEvaluationsChange={setEvaluations}
                />
              </TkTabsContent>
            </TkTabs>
          </>
        )}
      </div>
    </div>
  )
}
