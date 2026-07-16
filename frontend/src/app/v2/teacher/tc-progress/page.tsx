'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Check, Clock, TrendingUp, TrendingDown, CircleCheck } from 'lucide-react'
import { format } from 'date-fns'
import { apiMessage } from '@/lib/api'
import { listLessons, type ClassLesson } from '@/lib/teacherLessonsApi'
import { listLessonLogs } from '@/lib/teacherLessonLogApi'
import { listModules, type CurriculumModule } from '@/lib/teacherModulesApi'
import { groupLessonsByModule } from '@/lib/moduleGrouping'
import { resolvePointTexts } from '@/lib/knowledgePoints'
import { computePacing, isLessonOverdue, todayIsoLocal, parseIsoDateLocal, type PacingStatus } from '../lessonPacing'
import { GaPageHdr, GaBtn, GaCap } from '@/components/ui-v2'
import { ClassPicker, useTeacherClasses, pct, classHref } from '../tcShared'

const VIOLET = '#7C56C8'

// ─────────────────────────────────────────────────────────────────────────────
// Tiến độ khóa học (GaTcProgress) — violet, read-only per-class progress overview.
// Plumbing reused 1:1 (zero backend): listLessons (`/v2/teacher/classes/{id}/lessons`).
// The flat lesson list drives progress % + completion timeline; Phase 1a adds CEFR level
// + planned_date so this view also shows pacing (đúng / chậm / vượt tiến độ) vs plan and
// per-lesson overdue markers. Editable ticking + authoring lives on tc-checklist.
// ─────────────────────────────────────────────────────────────────────────────

const PACING_STYLE: Record<Exclude<PacingStatus, 'none'>, { color: string; bg: string; Icon: typeof TrendingUp }> = {
  behind: { color: 'var(--ga-red)', bg: 'var(--ga-red-soft)', Icon: TrendingDown },
  onTrack: { color: 'var(--ga-green)', bg: 'var(--ga-green-soft)', Icon: CircleCheck },
  ahead: { color: 'var(--ga-gold)', bg: 'var(--ga-yellow-soft)', Icon: TrendingUp },
}

export default function V2TcProgressPage() {
  const t = useTranslations('v2.teacher.tcProgress')
  const tc = useTranslations('v2.common')
  const router = useRouter()
  const { classes, classId, setClassId, loadingClasses } = useTeacherClasses()
  const [lessons, setLessons] = useState<ClassLesson[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  // Supplementary teaser stat — fetched best-effort alongside lessons; a failure here
  // just omits the row rather than blocking the whole progress view (loadError above
  // is reserved for the primary `lessons` fetch).
  const [lessonLogCount, setLessonLogCount] = useState<number | null>(null)
  const [modules, setModules] = useState<CurriculumModule[]>([])

  const load = useCallback(async (cid: number) => {
    setLoading(true)
    try {
      const [ls, ms] = await Promise.all([listLessons(cid), listModules(cid).catch(() => [])])
      setLessons(ls)
      setModules(ms)
      setError('')
    } catch (e: unknown) {
      setError(apiMessage(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { if (classId) void load(classId) }, [classId, load])

  useEffect(() => {
    if (!classId) return
    let active = true
    setLessonLogCount(null) // hide any prior class's count while the new fetch is in flight
    listLessonLogs(classId)
      .then((logs) => { if (active) setLessonLogCount(logs.length) })
      .catch(() => { if (active) setLessonLogCount(null) })
    return () => { active = false }
  }, [classId])

  const ordered = useMemo(() => [...lessons].sort((a, b) => a.orderIndex - b.orderIndex), [lessons])
  const done = lessons.filter((l) => l.completed)
  const progress = pct(lessons)
  const lastDone = [...done].sort((a, b) => new Date(b.completedAt ?? 0).getTime() - new Date(a.completedAt ?? 0).getTime())[0]
  const next = ordered.find((l) => !l.completed)
  const today = useMemo(() => todayIsoLocal(), [])
  const pacing = useMemo(() => computePacing(lessons, today), [lessons, today])
  const lessonGroups = useMemo(
    () => groupLessonsByModule(ordered, modules).filter((g) => g.lessons.length > 0),
    [ordered, modules],
  )
  // Sequence number = position in the grouped reading order, so the timeline badges read 1..n
  // top-to-bottom even when a module's lessons are non-contiguous in flat orderIndex.
  const seqById = useMemo(() => {
    const m = new Map<number, number>()
    let n = 0
    for (const g of lessonGroups) for (const l of g.lessons) m.set(l.id, ++n)
    return m
  }, [lessonGroups])
  const pacingLabel: Record<Exclude<PacingStatus, 'none'>, string> = {
    behind: t('pacingBehind'),
    onTrack: t('pacingOnTrack'),
    ahead: t('pacingAhead'),
  }

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr
        accent
        title={t('title')}
        subtitle={t('subtitle')}
        right={
          <div className="flex items-center gap-3">
            <ClassPicker classes={classes} classId={classId} onChange={setClassId} disabled={loadingClasses} />
            <GaBtn variant="ghost" size="sm" onClick={() => router.push(classHref('/v2/teacher/tc-reports', classId))}>{t('viewFullReport')}</GaBtn>
            <GaBtn variant="yellow" size="sm" onClick={() => router.push(classHref('/v2/teacher/tc-checklist', classId))}>{t('openChecklist')}</GaBtn>
          </div>
        }
      />

      <div className="flex-1 overflow-auto px-10 py-6">
        {loading ? (
          <div className="ga-shimmer h-[180px] border border-ga-line" aria-hidden />
        ) : error ? (
          <div className="border border-ga-line bg-ga-card px-10 py-[52px] text-center">
            <h2 className="font-ga-display text-[24px] font-medium text-ga-red">{t('loadError')}</h2>
            <p className="ga-ui mx-auto mb-5 mt-3 max-w-sm text-[14px] text-ga-muted">{error}</p>
            <GaBtn variant="primary" onClick={() => classId && load(classId)}>{tc('retry')}</GaBtn>
          </div>
        ) : lessons.length === 0 ? (
          <div className="border border-dashed border-ga-line px-10 py-[40px] text-center text-[14px] text-ga-muted">
            {t('emptyPrefix')} <button type="button" onClick={() => router.push(classHref('/v2/teacher/tc-checklist', classId))} className="font-semibold underline" style={{ color: VIOLET }}>{t('addInChecklist')}</button>
          </div>
        ) : (
          <>
            {/* Hero */}
            <div className="grid items-center gap-9 bg-ga-ink px-[30px] py-7 text-ga-bg lg:grid-cols-[1.5fr_1fr]">
              <div>
                {next ? (
                  <div className="mb-3.5 flex items-center gap-2.5">
                    <span className="ga-ui text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: '#A39E94' }}>{t('nextLesson')}</span>
                    <span className="font-ga-display text-[17px] font-medium text-ga-bg">{next.title}</span>
                  </div>
                ) : (
                  <div className="mb-3.5 font-ga-display text-[17px] font-medium text-ga-bg">{t('allDone')}</div>
                )}
                <div className="mb-3.5 flex items-baseline gap-2.5">
                  <span className="font-ga-display text-[54px] font-medium leading-none">{progress}%</span>
                  <span className="text-[15px]" style={{ color: '#A39E94' }}>{t('completedSummary', { done: done.length, total: lessons.length })}</span>
                </div>
                <div className="h-3 bg-white/15">
                  <div className="h-full transition-[width] duration-500" style={{ width: `${progress}%`, background: 'var(--ga-yellow)' }} />
                </div>
                {pacing.status !== 'none' && (() => {
                  const s = PACING_STYLE[pacing.status]
                  const Icon = s.Icon
                  return (
                    <div className="mt-3.5 inline-flex items-center gap-1.5 rounded-ga px-2.5 py-1 text-[12px] font-semibold" style={{ background: 'rgba(255,255,255,0.1)', color: s.color }}>
                      <Icon size={14} aria-hidden />
                      {pacingLabel[pacing.status]}
                      {pacing.overdueCount > 0 && (
                        <span style={{ color: '#A39E94' }}>· {t('pacingOverdue', { count: pacing.overdueCount })}</span>
                      )}
                    </div>
                  )
                })()}
              </div>
              <div className="border-l border-white/15 pl-[30px]">
                {[
                  [t('taughtSessions'), `${done.length}/${lessons.length}`],
                  [t('lastCompletedLesson'), lastDone ? lastDone.title : '—'],
                  [t('completedAt'), lastDone?.completedAt ? format(new Date(lastDone.completedAt), 'dd/MM/yyyy') : '—'],
                  ...(lessonLogCount !== null ? [[t('lessonLogsCount'), String(lessonLogCount)]] : []),
                ].map(([k, v], i) => (
                  <div key={k} className="py-[11px]" style={{ borderTop: i ? '1px solid rgba(255,255,255,0.12)' : 'none' }}>
                    <div className="ga-ui text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: '#A39E94' }}>{k}</div>
                    <div className="mt-1 truncate text-[14.5px] font-semibold text-ga-bg">{v}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Lesson timeline (read-only) */}
            <GaCap className="mb-3.5 mt-7 block">{t('lessonSequence')}</GaCap>
            <div className="flex flex-col gap-3.5">
              {lessonGroups.map((group) => (
                <div key={group.module?.id ?? 'ungrouped'} className="border border-ga-line bg-ga-card">
                  <div className="flex items-center justify-between border-b border-ga-line px-5 py-2" style={{ background: 'var(--ga-violet-soft)' }}>
                    <span className="text-[12px] font-bold uppercase tracking-[0.06em]" style={{ color: VIOLET }}>{group.module ? group.module.title : t('ungrouped')}</span>
                    <span className="text-[12px] font-semibold text-ga-muted">{pct(group.lessons)}%</span>
                  </div>
                  {group.lessons.map((l, gi) => {
                    const gnum = seqById.get(l.id) ?? 0
                    const points = resolvePointTexts(l.knowledgePoints, l.description)
                    return (
                      <div key={l.id} className="flex items-start gap-3.5 px-5 py-3.5" style={{ borderTop: gi ? '1px solid var(--ga-line)' : 'none' }}>
                    <span
                      className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border text-[11px] font-bold"
                      style={{
                        background: l.completed ? 'var(--ga-green)' : 'transparent',
                        color: l.completed ? '#fff' : 'var(--ga-muted)',
                        borderColor: l.completed ? 'var(--ga-green)' : 'var(--ga-line)',
                      }}
                    >
                      {l.completed ? <Check size={14} /> : gnum}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-[14px] font-semibold text-ga-ink">{l.title}</span>
                        {l.cefrLevel && (
                          <span className="ga-ui shrink-0 rounded-ga px-1.5 text-[10px] font-bold" style={{ background: 'var(--ga-violet-soft)', color: VIOLET }}>{l.cefrLevel}</span>
                        )}
                      </div>
                      {points.length > 0 && (
                        <ul className="mt-1 flex flex-col gap-0.5">
                          {points.map((p, idx) => (
                            <li key={idx} className="flex gap-1.5 text-[12px] leading-[1.4] text-ga-muted">
                              <span className="mt-[1px] shrink-0" style={{ color: VIOLET }}>•</span>
                              <span className="min-w-0 break-words">{p}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      {l.canDoStatements && l.canDoStatements.length > 0 && (
                        <ul className="mt-1 flex flex-col gap-0.5">
                          {l.canDoStatements.map((c) => (
                            <li key={c.id ?? c.orderIndex} className="flex gap-1.5 text-[12px] leading-[1.4]" style={{ color: VIOLET }}>
                              <span className="mt-[1px] shrink-0">✓</span>
                              <span className="min-w-0 break-words">{c.text}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    {l.completed ? (
                      l.completedAt && <span className="mt-0.5 shrink-0 text-[12px] font-medium" style={{ color: 'var(--ga-green)' }}>{format(new Date(l.completedAt), 'dd/MM')}</span>
                    ) : isLessonOverdue(l, today) ? (
                      <span className="mt-0.5 flex shrink-0 items-center gap-1 text-[12px] font-semibold" style={{ color: 'var(--ga-red)' }}>
                        {t('overdueTag')} · {format(parseIsoDateLocal(l.plannedDate as string), 'dd/MM')}
                      </span>
                    ) : l.plannedDate ? (
                      <span className="mt-0.5 shrink-0 text-[12px] text-ga-subtle">{t('plannedShort', { date: format(parseIsoDateLocal(l.plannedDate), 'dd/MM') })}</span>
                    ) : (
                      <span className="mt-0.5 flex shrink-0 items-center gap-1 text-[12px] text-ga-subtle"><Clock size={12} /> {t('notTaught')}</span>
                    )}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
