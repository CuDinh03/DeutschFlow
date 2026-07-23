'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Check, PlayCircle, Lightbulb } from 'lucide-react'
import { format } from 'date-fns'
import { apiMessage } from '@/lib/api'
import { fetchMyClasses, fetchClassLessons, type MyClassroom, type ClassLesson } from '@/lib/studentClassesApi'
import { resolvePointTexts } from '@/lib/knowledgePoints'
import { GaPageHdr, GaBtn, GaCap } from '@/components/ui-v2'

// ─────────────────────────────────────────────────────────────────────────────
// Tiến độ khóa học — học viên (GaStProgress, proto-checklist.jsx) — yellow,
// read-only. Plumbing reused 1:1 (zero backend): fetchMyClasses (class picker) +
// fetchClassLessons (flat ClassLesson[], teacher-updated). Option-1: proto's
// personal self-tick tasks + module/milestone grouping are fictional (lessons are
// FLAT, no personal-task storage) → dropped → class progress hero + lesson timeline,
// mirroring the teacher tc-progress view. Progress is teacher-updated; student views.
// ─────────────────────────────────────────────────────────────────────────────

const fmtDate = (d: string | null | undefined) => (d ? format(new Date(d), 'dd/MM/yyyy') : '—')

export default function V2StProgressPage() {
  const t = useTranslations('v2.student.progress')
  const tc = useTranslations('v2.common')
  const [classes, setClasses] = useState<MyClassroom[]>([])
  const [selId, setSelId] = useState<number | null>(null)
  const [lessons, setLessons] = useState<ClassLesson[]>([])
  const [loading, setLoading] = useState(true)
  const [lessonsLoading, setLessonsLoading] = useState(false)
  const [error, setError] = useState('')

  const loadClasses = useCallback(async () => {
    setLoading(true)
    try {
      const cs = await fetchMyClasses()
      setClasses(cs)
      setSelId((prev) => prev ?? cs[0]?.id ?? null)
      setError('')
    } catch (e: unknown) {
      setError(apiMessage(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadClasses() }, [loadClasses])

  useEffect(() => {
    if (selId == null) return
    setLessonsLoading(true)
    fetchClassLessons(selId)
      .then(setLessons)
      .catch(() => setLessons([]))
      .finally(() => setLessonsLoading(false))
  }, [selId])

  const sel = classes.find((c) => c.id === selId) ?? null
  const total = lessons.length
  const done = useMemo(() => lessons.filter((l) => l.completed).length, [lessons])
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  const currentIdx = lessons.findIndex((l) => !l.completed)
  const current = currentIdx >= 0 ? lessons[currentIdx] : null
  const next = currentIdx >= 0 && currentIdx + 1 < lessons.length ? lessons[currentIdx + 1] : null

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr accent title={t('title')} subtitle={t('subtitle')} />

      <div className="flex-1 overflow-auto px-4 py-5 sm:px-6 lg:px-10 lg:py-7">
        {loading ? (
          <div className="ga-shimmer h-[160px] border border-ga-line" aria-hidden />
        ) : error ? (
          <div className="border border-ga-line bg-ga-card px-4 py-10 text-center sm:px-6 lg:px-10 lg:py-[52px]">
            <h2 className="font-ga-display text-[20px] font-medium text-ga-red lg:text-[24px]">{t('loadErrorTitle')}</h2>
            <p className="ga-ui mx-auto mb-5 mt-3 max-w-sm break-words text-[14px] text-ga-muted">{error}</p>
            <GaBtn variant="primary" onClick={loadClasses}>{tc('retry')}</GaBtn>
          </div>
        ) : classes.length === 0 ? (
          <div className="border border-dashed border-ga-line px-4 py-9 text-center text-[14.5px] text-ga-muted sm:px-6 lg:px-10 lg:py-[44px]">{t('emptyState')}</div>
        ) : (
          <>
            {/* Class picker */}
            <div className="mb-6 flex flex-wrap items-center gap-3">
              <GaCap>{t('classLabel')}</GaCap>
              <select
                value={selId ?? ''}
                onChange={(e) => setSelId(Number(e.target.value))}
                className="ga-ui min-h-10 w-full max-w-full min-w-0 border border-ga-line bg-ga-card px-3.5 py-2 text-[14px] font-semibold text-ga-ink outline-none sm:w-auto lg:min-h-0"
              >
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            {/* Progress hero (dark) */}
            <div className="bg-ga-ink p-5 text-ga-bg lg:p-7">
              <GaCap className="mb-2.5 block break-words" style={{ color: '#A39E94' }}>{t('classProgressCap', { name: sel?.name ?? '' })}</GaCap>
              <div className="flex flex-wrap items-end gap-3">
                <span className="font-ga-display text-[36px] font-medium leading-none sm:text-[44px] lg:text-[52px]">{pct}%</span>
                <span className="mb-1.5 text-[14px]" style={{ color: '#A39E94' }}>{t('lessonsUpdated', { done, total })}</span>
              </div>
              <div className="mt-4 h-2.5 overflow-hidden bg-white/15"><div className="h-full transition-[width] duration-500" style={{ width: `${pct}%`, background: 'var(--ga-yellow)' }} /></div>
            </div>

            {/* Now learning callout */}
            {current && (
              <div className="mt-3.5 flex flex-wrap items-center gap-3.5 border border-l-4 p-[14px_18px] lg:flex-nowrap" style={{ background: 'rgba(47,111,201,0.08)', borderColor: 'rgba(47,111,201,0.27)', borderLeftColor: '#2F6FC9' }}>
                <PlayCircle size={26} className="shrink-0" style={{ color: '#2F6FC9' }} />
                <div className="min-w-0 flex-1">
                  <div className="ga-ui text-[9px] font-bold uppercase tracking-[0.14em]" style={{ color: '#2F6FC9' }}>{t('nowLearning')}</div>
                  <div className="mt-0.5 font-ga-display text-[18px] font-medium text-ga-ink break-words">{current.title}</div>
                </div>
                <span className="w-full break-words text-[12.5px] text-ga-muted lg:w-auto">{t('nextUp', { title: next?.title ?? t('nextFallback') })}</span>
              </div>
            )}

            {/* Lesson timeline */}
            <GaCap className="mb-3 mt-6 block">{t('coursePathCap', { done, total })}</GaCap>
            {lessonsLoading ? (
              <div className="flex flex-col gap-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="ga-shimmer h-[56px] border border-ga-line" aria-hidden />)}</div>
            ) : lessons.length === 0 ? (
              <div className="border border-dashed border-ga-line px-4 py-8 text-center text-[14px] text-ga-muted sm:px-6 lg:px-10 lg:py-[40px]">{t('noLessons')}</div>
            ) : (
              <div className="border border-ga-line bg-ga-card">
                {lessons.map((l, i) => {
                  const isCurrent = i === currentIdx
                  const points = resolvePointTexts(l.knowledgePoints, l.description)
                  return (
                    <div key={l.id} className="flex flex-wrap items-start gap-3.5 px-4 py-3.5 lg:flex-nowrap lg:px-5" style={{ borderTop: i ? '1px solid var(--ga-line)' : 'none', background: isCurrent ? 'rgba(47,111,201,0.06)' : 'transparent', borderLeft: isCurrent ? '3px solid #2F6FC9' : '3px solid transparent' }}>
                      <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full text-[12px] font-bold" style={l.completed ? { background: 'var(--ga-green-soft)', color: 'var(--ga-green)' } : { background: 'var(--ga-side-active)', color: 'var(--ga-muted)' }}>
                        {l.completed ? <Check size={14} /> : i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[14.5px] font-semibold text-ga-ink break-words">{l.title}</div>
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
                      </div>
                      <span className="mt-1 w-full shrink-0 text-[12.5px] lg:mt-0.5 lg:w-auto" style={{ color: l.completed ? 'var(--ga-green)' : isCurrent ? '#2F6FC9' : 'var(--ga-muted)' }}>
                        {l.completed ? t('taughtAt', { date: fmtDate(l.completedAt) }) : isCurrent ? t('learning') : t('notTaught')}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}

            <div className="mt-4 flex items-center gap-3 border p-[14px_18px]" style={{ background: 'var(--ga-yellow-soft)', borderColor: 'color-mix(in srgb, var(--ga-gold) 40%, transparent)' }}>
              <Lightbulb size={20} className="shrink-0" style={{ color: 'var(--ga-gold)' }} />
              <div className="min-w-0 text-[13.5px] leading-relaxed text-ga-ink">{t.rich('teacherNote', { strong: (chunks) => <strong>{chunks}</strong> })}</div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
