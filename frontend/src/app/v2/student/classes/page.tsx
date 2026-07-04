'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Plus, MessageSquare } from 'lucide-react'
import { toast } from 'sonner'
import { apiMessage } from '@/lib/api'
import { fetchMyClasses, joinClassByInviteCode, type MyClassroom } from '@/lib/studentClassesApi'
import { GaPageHdr, GaBtn, GaCap } from '@/components/ui-v2'

// ─────────────────────────────────────────────────────────────────────────────
// Lớp học của tôi (GaMyClasses, proto-classroom.jsx) — student↔teacher surface,
// yellow. Plumbing reused 1:1 (zero backend): studentClassesApi.fetchMyClasses
// (MyClassroom[]) + joinClassByInviteCode (POST /classes/join).
// Option-1: MyClassroom carries no student/member count → proto "N thành viên"
// replaced with backed "N bài học · N bài tập"; progress = lessonCompleted/total
// (same basis as tc-progress). "Nhắn giáo viên" has no messaging backend → toast.
// ─────────────────────────────────────────────────────────────────────────────

const initial = (n: string) => ((n ?? '?').trim()[0] ?? '?').toUpperCase()
const progressPct = (c: MyClassroom) => (c.lessonTotal > 0 ? Math.round((c.lessonCompleted / c.lessonTotal) * 100) : 0)
const teacherNames = (c: MyClassroom) =>
  c.teachers.length === 0 ? '—' : c.teachers[0].displayName + (c.teachers.length > 1 ? ` +${c.teachers.length - 1}` : '')

export default function V2MyClassesPage() {
  const router = useRouter()
  const t = useTranslations('v2.student.classes')
  const tc = useTranslations('v2.common')
  const [classes, setClasses] = useState<MyClassroom[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [code, setCode] = useState('')
  const [joining, setJoining] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setClasses(await fetchMyClasses())
      setError('')
    } catch (e: unknown) {
      setError(apiMessage(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const join = async () => {
    const c = code.trim()
    if (!c) { toast(t('enterCodePrompt')); return }
    setJoining(true)
    try {
      await joinClassByInviteCode(c)
      toast.success(t('joinRequestSent', { code: c }))
      setCode('')
      await load()
    } catch (e: unknown) {
      toast.error(apiMessage(e))
    } finally {
      setJoining(false)
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr accent title={t('title')} subtitle={t('subtitle')} />

      <div className="flex-1 overflow-auto px-10 py-7">
        {/* Join by invite code */}
        <div className="mb-8 flex max-w-[560px] border border-ga-line bg-ga-card">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && join()}
            placeholder={t('codePlaceholder')}
            className="ga-ui flex-1 bg-transparent px-[18px] py-[15px] text-[15px] tracking-[0.04em] text-ga-ink outline-none"
          />
          <button
            type="button"
            onClick={join}
            disabled={joining}
            className="ga-ui flex shrink-0 items-center gap-2 bg-ga-ink px-6 py-[15px] text-[14px] font-semibold text-ga-bg transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            <Plus size={16} /> {t('joinBtn')}
          </button>
        </div>

        <GaCap className="mb-4 block">{t('enrolledCap', { count: classes.length })}</GaCap>

        {loading ? (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => <div key={i} className="ga-shimmer h-[196px] border border-ga-line" aria-hidden />)}
          </div>
        ) : error ? (
          <div className="border border-ga-line bg-ga-card px-10 py-[52px] text-center">
            <h2 className="font-ga-display text-[24px] font-medium text-ga-red">{t('loadErrorTitle')}</h2>
            <p className="ga-ui mx-auto mb-5 mt-3 max-w-sm text-[14px] text-ga-muted">{error}</p>
            <GaBtn variant="primary" onClick={load}>{tc('retry')}</GaBtn>
          </div>
        ) : classes.length === 0 ? (
          <div className="border border-dashed border-ga-line px-10 py-[44px] text-center">
            <p className="ga-ui text-[14.5px] text-ga-muted">{t('emptyState')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {classes.map((c) => {
              const pct = progressPct(c)
              return (
                <div key={c.id} className="ga-card-hover border border-ga-line bg-ga-card transition-shadow">
                  <div className="border-b border-ga-line px-6 py-[22px]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 gap-3.5">
                        <span className="grid h-11 w-11 shrink-0 place-items-center font-ga-display text-[20px] font-semibold text-ga-ink" style={{ background: 'var(--ga-yellow-soft)' }}>
                          {initial(c.name)}
                        </span>
                        <div className="min-w-0">
                          <div className="truncate text-[16px] font-bold leading-tight text-ga-ink">{c.name}</div>
                          <div className="mt-1 truncate text-[13px] text-ga-muted">
                            {t('teacherMeta', { teacher: teacherNames(c), lessons: c.lessonTotal, assignments: c.assignmentCount })}
                          </div>
                        </div>
                      </div>
                      {c.pendingCount > 0 && (
                        <span className="shrink-0 px-2.5 py-[5px] text-[11px] font-bold" style={{ background: 'var(--ga-yellow-soft)', border: '1px solid var(--ga-yellow)' }}>
                          {t('pendingBadge', { count: c.pendingCount })}
                        </span>
                      )}
                    </div>
                    <div className="mt-4">
                      <div className="mb-1.5 flex justify-between text-[12.5px] text-ga-muted">
                        <span>{t('yourProgress')}</span>
                        <span className="font-ga-display font-medium text-ga-ink">{pct}%</span>
                      </div>
                      <div className="h-[5px] bg-ga-line"><div className="h-full" style={{ width: `${pct}%`, background: 'var(--ga-yellow)' }} /></div>
                    </div>
                  </div>
                  <div className="flex gap-2.5 px-6 py-3.5">
                    <GaBtn variant="yellow" size="sm" onClick={() => router.push(`/v2/student/classes/${c.id}`)}>{t('enterClass')}</GaBtn>
                    <GaBtn variant="ghost" size="sm" onClick={() => toast(t('messageTeacherSoon'))}><MessageSquare size={14} /> {t('messageTeacher')}</GaBtn>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
