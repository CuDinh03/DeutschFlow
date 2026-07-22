'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ArrowLeft, MessageSquare, Check } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { apiMessage } from '@/lib/api'
import {
  fetchClassDetail, fetchClassAssignments, fetchClassLessons,
  fetchClassCompetency, setCompetency,
  type ClassroomDetail, type StudentAssignment, type ClassLesson,
  type StudentCompetency, type CompetencyStatus,
} from '@/lib/studentClassesApi'
import { resolvePointTexts } from '@/lib/knowledgePoints'
import { GaPageHdr, GaBtn, GaCap, TkStatStrip } from '@/components/ui-v2'
import { LessonMaterials } from './LessonMaterials'

// ─────────────────────────────────────────────────────────────────────────────
// Chi tiết lớp — học viên (GaClassStudent, proto-classroom.jsx) — DETAIL, yellow.
// Backed tabs: Tổng quan · Bài tập · Lộ trình. Each lesson in Lộ trình now shows the materials the
// teacher attached to it (LessonMaterials, lazy-loaded) — the student-facing read path added in wave 3.
// Still proto-only (no backend): feed / members roster / rank. "Nhắn giáo viên" → toast.
// ─────────────────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'tasks' | 'lessons'
const TABS: [Tab, 'tabOverview' | 'tabTasks' | 'tabLessons'][] = [
  ['overview', 'tabOverview'], ['tasks', 'tabTasks'], ['lessons', 'tabLessons'],
]
const fmtDate = (d: string | null | undefined) => (d ? format(new Date(d), 'dd/MM/yyyy') : '—')

/**
 * StudentAssignment.status → label + tone.
 * Real values: PENDING / SUBMITTED / AI_GRADED / GRADING_FAILED / GRADED / EVALUATED.
 *
 * EVALUATED (a teacher-confirmed grade) used to be missing here and fell through to "chưa nộp" —
 * a student whose work had been graded by their teacher was told they had not handed it in. It is now
 * the normal end state, so this had to be handled. AI_GRADED deliberately reads as "đã nộp": the AI's
 * proposed score is not the student's grade until a teacher confirms it, and they were never told it.
 */
function statusMeta(a: StudentAssignment, t: (key: string, values?: Record<string, string | number>) => string): { label: string; color: string } {
  const s = (a.status ?? '').toUpperCase()
  if (s === 'EVALUATED' || s === 'GRADED') {
    return {
      label: a.teacherScore != null ? t('status.gradedScore', { score: a.teacherScore }) : t('status.graded'),
      color: 'var(--ga-green)',
    }
  }
  if (s === 'GRADING_FAILED') return { label: t('status.gradingFailed'), color: 'var(--ga-red)' }
  if (s === 'SUBMITTED' || s === 'GRADING' || s === 'AI_GRADED') return { label: t('status.submitted'), color: '#2F6FC9' }
  return { label: t('status.pending'), color: 'var(--ga-orange)' }
}

export default function V2ClassStudentPage() {
  const params = useParams()
  const router = useRouter()
  const t = useTranslations('v2.student.classDetail')
  const tc = useTranslations('v2.common')
  const classId = Number(params.id)
  const [tab, setTab] = useState<Tab>('overview')
  const [cls, setCls] = useState<ClassroomDetail | null>(null)
  const [tasks, setTasks] = useState<StudentAssignment[]>([])
  const [lessons, setLessons] = useState<ClassLesson[]>([])
  const [competencyMap, setCompetencyMap] = useState<Record<number, CompetencyStatus>>({})
  const [competencySourceMap, setCompetencySourceMap] = useState<Record<number, string>>({})
  const [savingCanDo, setSavingCanDo] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    if (Number.isNaN(classId)) {
      setError(t('invalidClassId'))
      setLoading(false)
      return
    }
    try {
      const [d, a, l, comp] = await Promise.all([
        fetchClassDetail(classId),
        fetchClassAssignments(classId).catch(() => [] as StudentAssignment[]),
        fetchClassLessons(classId).catch(() => [] as ClassLesson[]),
        fetchClassCompetency(classId).catch(() => [] as StudentCompetency[]),
      ])
      setCls(d); setTasks(a); setLessons(l)
      const cmap: Record<number, CompetencyStatus> = {}
      const smap: Record<number, string> = {}
      for (const c of comp) {
        cmap[c.canDoStatementId] = c.status
        if (c.source) smap[c.canDoStatementId] = c.source
      }
      setCompetencyMap(cmap)
      setCompetencySourceMap(smap)
      setError('')
    } catch (e: unknown) {
      setError(apiMessage(e))
    } finally {
      setLoading(false)
    }
  }, [classId, t])

  useEffect(() => { void load() }, [load])

  const lessonPct = cls && cls.lessonTotal > 0 ? Math.round((cls.lessonCompleted / cls.lessonTotal) * 100) : 0
  const doneLessons = useMemo(() => lessons.filter((l) => l.completed).length, [lessons])

  // Competency (Selbstevaluation) aggregate across all the class's can-dos.
  const canDoStats = useMemo(() => {
    let total = 0
    let mastered = 0
    for (const l of lessons) {
      for (const c of l.canDoStatements ?? []) {
        total++
        if (c.id != null && competencyMap[c.id] === 'MASTERED') mastered++
      }
    }
    return { total, mastered }
  }, [lessons, competencyMap])

  const onSetCompetency = async (canDoId: number, status: CompetencyStatus): Promise<void> => {
    const prev = competencyMap[canDoId] ?? 'NOT_STARTED'
    const prevSource = competencySourceMap[canDoId]
    setCompetencyMap((m) => ({ ...m, [canDoId]: status })) // optimistic
    setCompetencySourceMap((m) => ({ ...m, [canDoId]: 'SELF' })) // a manual change is now self-reported
    setSavingCanDo(canDoId)
    try {
      await setCompetency(classId, canDoId, status)
    } catch (e: unknown) {
      setCompetencyMap((m) => ({ ...m, [canDoId]: prev })) // rollback
      setCompetencySourceMap((m) => ({ ...m, [canDoId]: prevSource ?? '' }))
      toast.error(apiMessage(e))
    } finally {
      setSavingCanDo(null)
    }
  }
  const teacherLine = cls
    ? t('teacherLine', { teacher: cls.teachers[0]?.displayName ?? '—', code: cls.inviteCode, count: cls.studentCount })
    : ''

  if (error) {
    return (
      <div className="flex min-h-full flex-col">
        <GaPageHdr accent title={t('titleFallback')} right={<GaBtn variant="ghost" size="sm" onClick={() => router.push('/v2/student/classes')}><ArrowLeft size={14} /> {t('backToClasses')}</GaBtn>} />
        <div className="flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
          <div className="border border-ga-line bg-ga-card px-4 py-10 text-center sm:px-6 lg:px-10 lg:py-[52px]">
            <h2 className="font-ga-display text-[24px] font-medium text-ga-red">{t('loadErrorTitle')}</h2>
            <p className="ga-ui mx-auto mb-5 mt-3 max-w-sm text-[14px] text-ga-muted">{error}</p>
            <GaBtn variant="primary" onClick={load}>{tc('retry')}</GaBtn>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr
        accent
        title={cls?.name ?? (loading ? t('titleLoading') : t('titleClass'))}
        subtitle={teacherLine}
        right={
          <div className="flex flex-wrap gap-2.5">
            <GaBtn variant="ghost" size="sm" onClick={() => router.push('/v2/student/classes')}><ArrowLeft size={14} /> {t('backToClasses')}</GaBtn>
            <GaBtn
              variant="yellow"
              size="sm"
              onClick={() => {
                const tch = cls?.teachers[0]
                if (tch) router.push(`/v2/student/messages?to=${tch.id}&name=${encodeURIComponent(tch.displayName)}`)
                else toast(t('noTeacherToMessage'))
              }}
            >
              <MessageSquare size={14} /> {t('messageTeacher')}
            </GaBtn>
          </div>
        }
      />

      {/* Tab bar */}
      <div className="flex shrink-0 overflow-x-auto border-b border-ga-line bg-ga-card px-4 sm:px-6 lg:overflow-x-visible lg:px-10">
        {TABS.map(([id, labelKey]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className="ga-ui shrink-0 whitespace-nowrap px-3 py-3.5 text-[14px] font-semibold transition-colors lg:px-[18px]"
            style={{ color: tab === id ? 'var(--ga-ink)' : 'var(--ga-muted)', borderBottom: `2px solid ${tab === id ? 'var(--ga-yellow)' : 'transparent'}` }}
          >
            {t(labelKey)}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto px-4 py-5 sm:px-6 lg:px-10 lg:py-7">
        {loading ? (
          <div className="flex flex-col gap-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="ga-shimmer h-[64px] border border-ga-line" aria-hidden />)}</div>
        ) : tab === 'overview' ? (
          <>
            <TkStatStrip
              items={[
                { label: t('stats.lessonProgress'), value: `${lessonPct}%`, sub: t('stats.lessonProgressSub', { done: cls?.lessonCompleted ?? 0, total: cls?.lessonTotal ?? 0 }), color: '#1E9E61' },
                { label: t('stats.assignments'), value: cls?.assignmentCount ?? 0, sub: t('stats.assignmentsSub', { count: cls?.pendingCount ?? 0 }), color: '#E07B39', alert: (cls?.pendingCount ?? 0) > 0 },
                { label: t('stats.graded'), value: cls?.gradedCount ?? 0, sub: t('stats.gradedSub'), color: '#2F6FC9' },
                { label: t('stats.avgScore'), value: cls?.avgScore != null ? `${Math.round(cls.avgScore)}/100` : '—', sub: t('stats.avgScoreSub') },
              ]}
            />
            <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
              <div className="border border-ga-line bg-ga-card p-4 lg:p-6">
                <GaCap className="mb-2 block">{t('currentLessonCap')}</GaCap>
                <div className="font-ga-display text-[20px] font-medium text-ga-ink">{cls?.currentLessonTitle || t('notStarted')}</div>
                <div className="mt-3 h-[6px] bg-ga-line"><div className="h-full" style={{ width: `${lessonPct}%`, background: 'var(--ga-yellow)' }} /></div>
                <div className="mt-2 text-[13px] text-ga-muted">{t('lessonsDone', { done: cls?.lessonCompleted ?? 0, total: cls?.lessonTotal ?? 0 })}</div>
              </div>
              <div className="border border-ga-line bg-ga-card p-4 lg:p-6">
                <GaCap className="mb-2 block">{t('teacherCap')}</GaCap>
                {(cls?.teachers ?? []).length === 0 ? (
                  <p className="text-[14px] text-ga-muted">{t('noTeacher')}</p>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {cls?.teachers.map((tch) => (
                      <div key={tch.id} className="flex items-center gap-3">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full font-ga-display text-[14px] font-semibold" style={{ color: '#7C56C8', background: 'rgba(124,86,200,0.16)' }}>{(tch.displayName?.[0] ?? '?').toUpperCase()}</span>
                        <div className="min-w-0">
                          <div className="truncate text-[14px] font-semibold text-ga-ink">{tch.displayName}</div>
                          <div className="truncate text-[12px] text-ga-muted">{tch.email}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        ) : tab === 'tasks' ? (
          tasks.length === 0 ? (
            <div className="border border-dashed border-ga-line px-4 py-8 text-center text-[14px] text-ga-muted sm:px-6 lg:px-10 lg:py-[40px]">{t('noTasks')}</div>
          ) : (
            <div className="flex flex-col gap-3.5">
              {tasks.map((tk) => {
                const sm = statusMeta(tk, t)
                const st = (tk.status ?? '').toUpperCase()
                // Handed in — whatever has happened to it since. AI_GRADED counts: the work IS in.
                const submitted = ['SUBMITTED', 'GRADING', 'AI_GRADED', 'GRADING_FAILED', 'GRADED', 'EVALUATED'].includes(st)
                // A grade the student may actually see: confirmed only. An AI proposal is not a grade.
                const graded = st === 'GRADED' || st === 'EVALUATED'
                return (
                  <div key={tk.id} className="grid grid-cols-1 items-center gap-3 border border-ga-line bg-ga-card px-4 py-4 lg:grid-cols-[1fr_auto] lg:gap-4 lg:px-[22px] lg:py-5">
                    <div className="min-w-0">
                      <div className="mb-1.5 flex items-center gap-2.5">
                        <span className="truncate text-[16px] font-bold text-ga-ink">{tk.topic}</span>
                        {tk.assignmentType && <span className="ga-ui shrink-0 border border-ga-line px-2 py-[3px] text-[10px] font-semibold uppercase tracking-[0.06em] text-ga-muted">{tk.assignmentType}</span>}
                      </div>
                      <div className="flex flex-wrap gap-4 text-[13px] text-ga-muted">
                        <span>{t('dueDate')} <strong className="text-ga-ink">{fmtDate(tk.dueDate)}</strong></span>
                        <span className="inline-flex items-center gap-1.5" style={{ color: sm.color }}><span className="h-1.5 w-1.5 rounded-full" style={{ background: sm.color }} /> {sm.label}</span>
                      </div>
                    </div>
                    <GaBtn
                      variant={graded || submitted ? 'ghost' : 'yellow'}
                      size="sm"
                      onClick={() => router.push(`/v2/student/classes/${classId}/assignments/${tk.assignmentId}`)}
                    >
                      {graded ? t('viewFeedback') : submitted ? t('viewSubmission') : t('doAndSubmit')}
                    </GaBtn>
                  </div>
                )
              })}
            </div>
          )
        ) : (
          // lessons / lộ trình
          lessons.length === 0 ? (
            <div className="border border-dashed border-ga-line px-4 py-8 text-center text-[14px] text-ga-muted sm:px-6 lg:px-10 lg:py-[40px]">{t('noLessons')}</div>
          ) : (
            <>
              <GaCap className="mb-4 block">{t('lessonPathCap', { done: doneLessons, total: lessons.length })}</GaCap>
              {canDoStats.total > 0 && (
                <div className="mb-4 text-[13px] font-medium" style={{ color: 'var(--ga-violet)' }}>
                  {t('competency.summary', { mastered: canDoStats.mastered, total: canDoStats.total })}
                </div>
              )}
              <div className="border border-ga-line bg-ga-card">
                {lessons.map((l, i) => {
                  const points = resolvePointTexts(l.knowledgePoints, l.description)
                  return (
                    <div key={l.id} className="flex flex-wrap items-start gap-3.5 px-4 py-3.5 lg:flex-nowrap lg:px-5" style={{ borderTop: i ? '1px solid var(--ga-line)' : 'none' }}>
                      <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full text-[12px] font-bold" style={l.completed ? { background: 'var(--ga-green-soft)', color: 'var(--ga-green)' } : { background: 'var(--ga-side-active)', color: 'var(--ga-muted)' }}>
                        {l.completed ? <Check size={14} /> : i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[14.5px] font-semibold text-ga-ink">{l.title}</div>
                        {points.length > 0 && (
                          <ul className="mt-1 flex flex-col gap-1">
                            {points.map((p, idx) => (
                              <li key={idx} className="flex gap-2 text-[12.5px] leading-[1.5] text-ga-muted">
                                <span className="mt-[1px] shrink-0 text-ga-subtle">•</span>
                                <span className="min-w-0 break-words">{p}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                        {l.canDoStatements && l.canDoStatements.length > 0 && (
                          <ul className="mt-1 flex flex-col gap-1.5">
                            {l.canDoStatements.map((c) => {
                              const st: CompetencyStatus = c.id != null ? (competencyMap[c.id] ?? 'NOT_STARTED') : 'NOT_STARTED'
                              const mastered = st === 'MASTERED'
                              return (
                                <li key={c.id ?? c.orderIndex} className="flex flex-wrap items-start gap-2 text-[12.5px] leading-[1.5] lg:flex-nowrap">
                                  <span className="mt-[2px] shrink-0" style={{ color: mastered ? 'var(--ga-green)' : 'var(--ga-violet)' }}>✓</span>
                                  <span className="min-w-0 flex-1 break-words" style={{ color: 'var(--ga-violet)' }}>
                                    {c.text}
                                    {c.id != null && competencySourceMap[c.id] === 'GRADING' && (
                                      <span className="ga-ui ml-1.5 rounded-ga px-1 text-[9px] font-bold uppercase text-ga-subtle" style={{ background: 'var(--ga-side-active)' }}>{t('competency.autoHint')}</span>
                                    )}
                                  </span>
                                  {c.id != null && (
                                    <select
                                      aria-label={t('competency.label')}
                                      value={st}
                                      disabled={savingCanDo === c.id}
                                      onChange={(e) => onSetCompetency(c.id as number, e.target.value as CompetencyStatus)}
                                      className="min-h-[40px] w-full shrink-0 rounded-ga border border-ga-line bg-ga-bg px-1.5 py-1.5 text-[11px] text-ga-ink outline-none focus:border-ga-accent disabled:opacity-50 lg:min-h-0 lg:w-auto lg:py-0.5"
                                    >
                                      <option value="NOT_STARTED">{t('competency.notStarted')}</option>
                                      <option value="IN_PROGRESS">{t('competency.inProgress')}</option>
                                      <option value="MASTERED">{t('competency.mastered')}</option>
                                    </select>
                                  )}
                                </li>
                              )
                            })}
                          </ul>
                        )}
                        <LessonMaterials lessonId={l.id} />
                      </div>
                      <span className="mt-0.5 w-full shrink-0 text-[12.5px] lg:w-auto" style={{ color: l.completed ? 'var(--ga-green)' : 'var(--ga-muted)' }}>
                        {l.completed ? t('taughtAt', { date: fmtDate(l.completedAt) }) : t('notTaught')}
                      </span>
                    </div>
                  )
                })}
              </div>
            </>
          )
        )}
      </div>
    </div>
  )
}
