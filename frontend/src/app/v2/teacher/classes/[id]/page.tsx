'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  Plus, Mail, ClipboardList, ChevronRight, AlertTriangle, Trophy,
  ArrowLeft, Sparkles, Mic, PenLine, FileText, BookOpen, SpellCheck, UserPlus, Trash2,
} from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import api, { apiMessage } from '@/lib/api'
import { listLessons, type ClassLesson } from '@/lib/teacherLessonsApi'
import {
  GaPageHdr, GaBtn, GaCap, TkStatStrip, TkSearch, TkModal,
  TkTabs, TkTabsList, TkTabsTrigger, TkTabsContent,
} from '@/components/ui-v2'
import { getErrorSnippet } from '@/lib/errors/errorTaxonomy'
import { useUserStore } from '@/stores/useUserStore'
import { isPrimaryTeacher, isRemovable, type ClassTeacher } from '@/lib/coTeaching'

// ─────────────────────────────────────────────────────────────────────────────
// Chi tiết lớp (GaClassDetail) — violet. Tabs: Học viên · Bài tập · Thống kê.
// Plumbing reused 1:1 (zero backend): GET /v2/teacher/classes (class info),
//   /classes/{id}/students, /classes/{id}/assignments, /classes/{id}/analytics,
//   /grading/queue?classId={id} (pending-per-assignment), POST /classes/{id}/assignments.
// Option-1 (established pattern): roster carries only studentId/displayName/email/xp/
//   level/cefrLevel + 4 CEFR skill scores (Hören/Lesen/Schreiben/Sprechen, 0–10) → STREAK /
//   LẦN CUỐI columns still DROPPED (no data). Analytics tab from the REAL class /analytics
//   (totalXp, completedAssignments, avgSpeakingScore, reviewCoveragePct, topErrors, actionItems)
//   + XP ranking from the roster. PROMPT 6: skill score-bars (roster) + class skill average
//   (analytics) now wired — skill_* exposed via ClassStudentDto. submission-donut still backlog.
// ─────────────────────────────────────────────────────────────────────────────

const VIOLET = '#7C56C8'

interface ClassInfo { id: number; name: string; code: string; studentCount: number }
interface Student {
  studentId: number; displayName: string; email: string; xp: number; level: number; cefrLevel: string
  skillHoren: number | null; skillLesen: number | null; skillSchreiben: number | null; skillSprechen: number | null
  evaluatedAt: string | null
}
interface Assignment { id: number; topic: string; description: string; assignmentType: string; dueDate: string | null; createdAt: string; lessonId?: number | null }
interface ActionItem { title: string; detail: string; priority: string }
interface Analytics {
  totalStudents: number; totalXp: number; completedAssignments: number
  avgSpeakingScore: number; reviewCoveragePct: number
  topErrors: { errorCode: string; count: number }[]
  actionItems: ActionItem[]
}

type Tab = 'students' | 'tasks' | 'analytics' | 'teachers'
type SortCol = 'name' | 'cefr' | 'level' | 'xp'
type JoinRequest = { id: number; studentId: number; studentName: string; studentEmail: string; status: string; createdAt: string }

// labelKey → v2.teacher.classDetail.types.<key>; tone/Icon are visual (kept).
const TYPE_META: Record<string, { labelKey: string; tone: string; Icon: typeof Mic }> = {
  SPEAKING_SCENARIO: { labelKey: 'SPEAKING_SCENARIO', tone: 'var(--ga-violet)', Icon: Mic },
  ESSAY: { labelKey: 'ESSAY', tone: 'var(--ga-blue)', Icon: PenLine },
  WRITING: { labelKey: 'WRITING', tone: 'var(--ga-blue)', Icon: PenLine },
  MOCK_TEST: { labelKey: 'MOCK_TEST', tone: 'var(--ga-orange)', Icon: FileText },
  VOCABULARY: { labelKey: 'VOCABULARY', tone: 'var(--ga-green)', Icon: BookOpen },
  GRAMMAR: { labelKey: 'GRAMMAR', tone: 'var(--ga-teal)', Icon: SpellCheck },
  GENERAL: { labelKey: 'GENERAL', tone: 'var(--ga-muted)', Icon: FileText },
}
const metaOf = (type: string) => TYPE_META[type] ?? TYPE_META.GENERAL
const initial = (n: string) => (n.trim()[0] ?? '?').toUpperCase()
const fmtDate = (d: string | null) => (d ? format(new Date(d), 'dd/MM/yyyy') : '—')

const ASSIGNMENT_TYPES = ['GENERAL', 'ESSAY', 'WRITING', 'SPEAKING_SCENARIO', 'VOCABULARY', 'GRAMMAR', 'MOCK_TEST']

// CEFR skill scores: 0–10, ≥5 = passing (StudentEvaluationService). Exposed on the roster DTO.
const SKILL_MAX = 10
const SKILLS = [
  { key: 'skillHoren', label: 'H', name: 'Hören' },
  { key: 'skillLesen', label: 'L', name: 'Lesen' },
  { key: 'skillSchreiben', label: 'S', name: 'Schreiben' },
  { key: 'skillSprechen', label: 'Sp', name: 'Sprechen' },
] as const
const skillVals = (s: Student): (number | null)[] => [s.skillHoren, s.skillLesen, s.skillSchreiben, s.skillSprechen]

// Per-student score-bars (Hören/Lesen/Schreiben/Sprechen). Honest: '—' until evaluated; green ≥5.
function SkillBars({ s }: { s: Student }) {
  const t = useTranslations('v2.teacher.classDetail')
  const vals = skillVals(s)
  // Only show official evaluations (evaluatedAt set by StudentEvaluationService, 0–10 scale).
  if (!s.evaluatedAt || vals.every((v) => v == null)) return <span className="text-[11px] text-ga-faint">—</span>
  return (
    <div className="flex items-end gap-[3px]" title={t('skillTitle')}>
      {SKILLS.map((sk, i) => {
        const v = vals[i]
        const pct = v == null ? 0 : Math.max(8, Math.min(100, (v / SKILL_MAX) * 100))
        const pass = v != null && v >= 5
        return (
          <span key={sk.key} className="flex flex-col items-center gap-[2px]" title={t('skillCellTitle', { name: sk.name, value: v == null ? t('skillNotYet') : v.toFixed(1) })}>
            <span className="flex h-6 w-[7px] items-end" style={{ background: 'var(--ga-side-active)' }}>
              <span className="block w-full" style={{ height: `${pct}%`, background: v == null ? 'transparent' : pass ? '#1E9E61' : VIOLET }} />
            </span>
            <span className="text-[8px] font-bold text-ga-faint">{sk.label}</span>
          </span>
        )
      })}
    </div>
  )
}

export default function V2ClassDetailPage() {
  const t = useTranslations('v2.teacher.classDetail')
  const tc = useTranslations('v2.common')
  const params = useParams()
  const router = useRouter()
  const id = Number(params.id)
  const currentUserId = useUserStore((s) => s.user?.id)

  const [info, setInfo] = useState<ClassInfo | null>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [lessons, setLessons] = useState<ClassLesson[]>([])
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [pendingByAssignment, setPendingByAssignment] = useState<Record<number, number>>({})
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([])
  const [actingReq, setActingReq] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [tab, setTab] = useState<Tab>('students')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<{ col: SortCol; dir: 'asc' | 'desc' }>({ col: 'xp', dir: 'desc' })
  const [selected, setSelected] = useState<Record<number, boolean>>({})
  const [modal, setModal] = useState(false)

  // Co-teaching (buried BE→v2). List is supplementary; add/remove gated to the PRIMARY teacher.
  const [teachers, setTeachers] = useState<ClassTeacher[]>([])
  const [coEmail, setCoEmail] = useState('')
  const [addingCo, setAddingCo] = useState(false)
  const [removingCo, setRemovingCo] = useState<number | null>(null)
  // Every class always has ≥1 PRIMARY, so an empty list can only mean the fetch failed → show retry.
  const [teachersError, setTeachersError] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    if (Number.isNaN(id)) {
      setError(t('invalidClassId'))
      setLoading(false)
      return
    }
    try {
      const [clsList, st, asg, an, queue, jr, les, tea] = await Promise.all([
        api.get('/v2/teacher/classes'),
        api.get(`/v2/teacher/classes/${id}/students`),
        api.get(`/v2/teacher/classes/${id}/assignments`),
        api.get(`/v2/teacher/classes/${id}/analytics`).catch(() => ({ data: null })),
        api.get(`/v2/teacher/grading/queue?classId=${id}`).catch(() => ({ data: [] })),
        api.get(`/v2/teacher/classes/${id}/join-requests`).catch(() => ({ data: [] })),
        // Lessons feed the assignment lesson-picker + badge (Phase 1d-D1); non-blocking.
        listLessons(id).then((data) => ({ data })).catch(() => ({ data: [] as ClassLesson[] })),
        // Co-teachers (buried BE→v2); supplementary — must not break the page. null = fetch failed
        // (distinct from a genuinely empty list, which never happens — every class has a PRIMARY).
        api.get(`/v2/teacher/classes/${id}/teachers`).catch(() => ({ data: null })),
      ])
      const cls = ((clsList.data ?? []) as Record<string, unknown>[]).find((c) => Number(c.id) === id)
      setInfo(
        cls
          ? { id, name: String(cls.name ?? `Lớp #${id}`), code: String(cls.inviteCode ?? cls.code ?? ''), studentCount: Number(cls.studentCount) || 0 }
          : { id, name: `Lớp #${id}`, code: '', studentCount: 0 },
      )
      setStudents((st.data ?? []) as Student[])
      setAssignments((asg.data ?? []) as Assignment[])
      setLessons((les.data ?? []) as ClassLesson[])
      setAnalytics((an.data as Analytics | null) ?? null)
      const pend: Record<number, number> = {}
      for (const q of (queue.data ?? []) as { assignmentId: number }[]) pend[q.assignmentId] = (pend[q.assignmentId] ?? 0) + 1
      setPendingByAssignment(pend)
      setJoinRequests((jr.data ?? []) as JoinRequest[])
      setTeachers(Array.isArray(tea.data) ? (tea.data as ClassTeacher[]) : [])
      setTeachersError(tea.data == null)
      setError('')
    } catch (e: unknown) {
      setError(apiMessage(e))
    } finally {
      setLoading(false)
    }
  }, [id, t])

  useEffect(() => {
    void load()
  }, [load])

  const actOnRequest = useCallback(
    async (reqId: number, action: 'approve' | 'reject') => {
      setActingReq(reqId)
      try {
        await api.post(`/v2/teacher/classes/${id}/join-requests/${reqId}/${action}`)
        setJoinRequests((rs) => rs.filter((r) => r.id !== reqId))
        toast.success(action === 'approve' ? t('approveSuccess') : t('rejectSuccess'))
        if (action === 'approve') void load() // refresh roster + sĩ số
      } catch (e: unknown) {
        toast.error(apiMessage(e))
      } finally {
        setActingReq(null)
      }
    },
    [id, load, t],
  )

  const reloadTeachers = useCallback(async () => {
    try {
      const res = await api.get(`/v2/teacher/classes/${id}/teachers`)
      setTeachers((res.data ?? []) as ClassTeacher[])
      setTeachersError(false)
    } catch {
      setTeachersError(true)
    }
  }, [id])

  const addCoTeacher = useCallback(async () => {
    const email = coEmail.trim()
    if (!email) return
    setAddingCo(true)
    try {
      await api.post(`/v2/teacher/classes/${id}/teachers`, { email })
      setCoEmail('')
      toast.success(t('addTeacherSuccess'))
      await reloadTeachers()
    } catch (e: unknown) {
      toast.error(apiMessage(e))
    } finally {
      setAddingCo(false)
    }
  }, [coEmail, id, reloadTeachers, t])

  const removeCoTeacher = useCallback(
    async (teacherId: number) => {
      setRemovingCo(teacherId)
      try {
        await api.delete(`/v2/teacher/classes/${id}/teachers/${teacherId}`)
        toast.success(t('removeTeacherSuccess'))
        await reloadTeachers()
      } catch (e: unknown) {
        toast.error(apiMessage(e))
      } finally {
        setRemovingCo(null)
      }
    },
    [id, reloadTeachers, t],
  )

  const isPrimary = useMemo(() => isPrimaryTeacher(teachers, currentUserId), [teachers, currentUserId])

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = students.filter((s) => s.displayName.toLowerCase().includes(q) || s.email.toLowerCase().includes(q))
    const dir = sort.dir === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {
      switch (sort.col) {
        case 'name': return a.displayName.localeCompare(b.displayName) * dir
        case 'cefr': return a.cefrLevel.localeCompare(b.cefrLevel) * dir
        case 'level': return (a.level - b.level) * dir
        default: return (a.xp - b.xp) * dir
      }
    })
  }, [students, query, sort])

  const selCount = Object.values(selected).filter(Boolean).length
  const toggleSort = (col: SortCol) =>
    setSort((s) => (s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'desc' }))

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr
        accent
        title={info?.name ?? t('titleFallback')}
        subtitle={info ? t('subtitle', { code: info.code || '—', count: info.studentCount }) : t('subtitleLoading')}
        right={
          <div className="flex items-center gap-2.5">
            <GaBtn variant="ghost" size="sm" onClick={() => router.push('/v2/teacher')}>
              <ArrowLeft size={15} /> {t('backToClasses')}
            </GaBtn>
            <GaBtn variant="ghost" size="sm" onClick={() => setModal(true)}>
              <Plus size={15} /> {t('addAssignment')}
            </GaBtn>
            <GaBtn variant="yellow" size="sm" onClick={() => toast(t('createAiMaterialComing'))}>
              <Sparkles size={15} /> {t('createAiMaterial')}
            </GaBtn>
          </div>
        }
      />

      <div className="flex-1 overflow-auto px-10 py-6">
        {error ? (
          <div className="border border-ga-line bg-ga-card px-10 py-[52px] text-center">
            <h2 className="font-ga-display text-[24px] font-medium text-ga-red">{t('loadError')}</h2>
            <p className="ga-ui mx-auto mb-5 mt-3 max-w-sm text-[14px] text-ga-muted">
              {error} <code className="font-mono text-[12px] text-ga-accent">{`GET /api/v2/teacher/classes/${id}/…`}</code>
            </p>
            <GaBtn variant="primary" onClick={load}>{tc('retry')}</GaBtn>
          </div>
        ) : (
          <TkTabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
            <TkTabsList>
              <TkTabsTrigger value="students">{t('tabStudents')} · {students.length}</TkTabsTrigger>
              <TkTabsTrigger value="tasks">{t('tabTasks')} · {assignments.length}</TkTabsTrigger>
              <TkTabsTrigger value="analytics">{t('tabAnalytics')}</TkTabsTrigger>
              <TkTabsTrigger value="teachers">{t('tabTeachers')} · {teachers.length}</TkTabsTrigger>
            </TkTabsList>

            {/* ── Students ── */}
            <TkTabsContent value="students">
              <TkStatStrip
                items={[
                  { label: t('stats.size'), value: students.length, sub: t('stats.sizeSub', { count: info?.studentCount ?? 0 }) },
                  { label: t('stats.totalXp'), value: (analytics?.totalXp ?? 0).toLocaleString(), sub: t('stats.totalXpSub'), color: '#2F6FC9' },
                  { label: t('stats.assignments'), value: assignments.length, sub: t('stats.assignmentsSub'), color: VIOLET },
                  {
                    label: t('stats.avgSpeaking'),
                    value: analytics?.avgSpeakingScore ? analytics.avgSpeakingScore.toFixed(1) : '—',
                    sub: analytics?.avgSpeakingScore ? t('stats.avgSpeakingSub') : t('stats.avgSpeakingSubEmpty'),
                    color: '#1E9E61',
                  },
                ]}
              />

              {joinRequests.length > 0 && (
                <div className="mt-[22px] border border-ga-line bg-ga-card">
                  <div className="border-b border-ga-line px-5 py-3">
                    <GaCap>{t('joinRequestsCap')} · {joinRequests.length}</GaCap>
                  </div>
                  <ul>
                    {joinRequests.map((r) => (
                      <li key={r.id} className="flex items-center gap-3 border-b border-ga-line px-5 py-3 last:border-b-0">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-ga-pill bg-ga-accent text-[13px] font-semibold text-ga-accent-ink">
                          {initial(r.studentName)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[14px] font-semibold text-ga-ink">{r.studentName}</p>
                          <p className="ga-ui truncate text-[12.5px] text-ga-muted">{r.studentEmail} · {fmtDate(r.createdAt)}</p>
                        </div>
                        <div className="flex shrink-0 gap-2">
                          <GaBtn variant="yellow" size="sm" loading={actingReq === r.id} disabled={actingReq !== null} onClick={() => actOnRequest(r.id, 'approve')}>
                            {t('approve')}
                          </GaBtn>
                          <GaBtn variant="ghost" size="sm" disabled={actingReq !== null} onClick={() => actOnRequest(r.id, 'reject')}>
                            {t('reject')}
                          </GaBtn>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mb-3.5 mt-[22px] flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <GaCap>{t('studentListCap')}</GaCap>
                  {selCount > 0 && (
                    <span className="flex items-center gap-2">
                      <span className="px-2 py-0.5 text-[11.5px] font-bold" style={{ color: VIOLET, background: 'var(--ga-violet-soft)' }}>
                        {t('selectedCount', { count: selCount })}
                      </span>
                      {[
                        { key: 'message' as const, label: t('message'), Icon: Mail },
                        { key: 'assign' as const, label: t('assign'), Icon: ClipboardList },
                      ].map(({ key, label, Icon }) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => {
                            if (key === 'message') {
                              const ids = Object.entries(selected).filter(([, v]) => v).map(([k]) => Number(k))
                              if (ids.length !== 1) { toast(t('messagePickOne')); return }
                              const s = students.find((x) => x.studentId === ids[0])
                              if (s) router.push(`/v2/teacher/messages?to=${s.studentId}&name=${encodeURIComponent(s.displayName)}`)
                              setSelected({})
                              return
                            }
                            toast.success(t('bulkActionDone', { action: label, count: selCount }))
                            setSelected({})
                          }}
                          className="ga-ui inline-flex items-center gap-1.5 border border-ga-line px-2.5 py-1.5 text-[11.5px] font-semibold text-ga-ink transition-colors hover:border-ga-accent hover:text-ga-accent"
                        >
                          <Icon size={13} /> {label}
                        </button>
                      ))}
                    </span>
                  )}
                </div>
                <TkSearch value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('searchStudent')} containerClassName="w-[220px]" />
              </div>

              <div className="border border-ga-line bg-ga-card">
                <div className="grid items-center gap-2 border-b border-ga-line bg-ga-bg px-[18px] py-[11px]" style={{ gridTemplateColumns: '34px 1fr 84px 74px 68px 118px 84px' }}>
                  <input
                    type="checkbox"
                    aria-label={t('selectAll')}
                    checked={rows.length > 0 && rows.every((r) => selected[r.studentId])}
                    onChange={(e) => { const v = e.target.checked; const o = { ...selected }; rows.forEach((r) => (o[r.studentId] = v)); setSelected(o) }}
                    style={{ accentColor: VIOLET }}
                  />
                  {([['name', t('colStudent')], ['cefr', t('colCefr')], ['level', t('colLevel')], ['xp', t('colXp')]] as [SortCol, string][]).map(([col, label]) => (
                    <button key={col} type="button" onClick={() => toggleSort(col)} className="flex items-center gap-1 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-ga-muted hover:text-ga-ink">
                      {label}{sort.col === col && <span>{sort.dir === 'asc' ? '↑' : '↓'}</span>}
                    </button>
                  ))}
                  <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-ga-muted">{t('colSkill')}</span>
                  <span />
                </div>

                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => <div key={i} className="ga-shimmer mx-[18px] my-2.5 h-9" aria-hidden />)
                ) : rows.length === 0 ? (
                  <div className="px-6 py-[30px] text-center text-[14px] text-ga-muted">
                    {students.length === 0 ? t('noStudents') : t('noStudentsFound')}
                  </div>
                ) : (
                  rows.map((s, i) => (
                    <div
                      key={s.studentId}
                      className="grid items-center gap-2 px-[18px] py-[13px] transition-colors hover:bg-ga-surface"
                      style={{ gridTemplateColumns: '34px 1fr 84px 74px 68px 118px 84px', borderTop: i ? '1px solid var(--ga-line)' : 'none', background: selected[s.studentId] ? 'var(--ga-violet-soft)' : undefined }}
                    >
                      <input type="checkbox" aria-label={t('selectStudent', { name: s.displayName })} checked={!!selected[s.studentId]} onChange={(e) => setSelected((o) => ({ ...o, [s.studentId]: e.target.checked }))} style={{ accentColor: VIOLET }} />
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span className="grid h-8 w-8 shrink-0 place-items-center font-ga-display text-[13px] font-medium text-ga-bg" style={{ background: 'var(--ga-ink)' }}>{initial(s.displayName)}</span>
                        <span className="min-w-0">
                          <span className="block truncate text-[14px] font-semibold text-ga-ink">{s.displayName}</span>
                          <span className="block truncate text-[11.5px] text-ga-muted">{s.email}</span>
                        </span>
                      </div>
                      <span className="font-ga-display text-[14px] font-medium text-ga-ink">{s.cefrLevel || '—'}</span>
                      <span className="text-[13.5px] text-ga-muted">{t('levelValue', { level: s.level })}</span>
                      <span className="text-[13.5px] font-semibold text-ga-ink">{s.xp.toLocaleString()}</span>
                      <SkillBars s={s} />
                      <button
                        type="button"
                        onClick={() => router.push(`/v2/teacher/classes/${id}/students/${s.studentId}?name=${encodeURIComponent(s.displayName)}`)}
                        className="ga-ui justify-self-end border border-ga-line px-2.5 py-1.5 text-[11px] font-semibold text-ga-muted transition-colors hover:border-ga-accent hover:text-ga-accent"
                      >
                        {t('detail')}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </TkTabsContent>

            {/* ── Tasks ── */}
            <TkTabsContent value="tasks">
              {loading ? (
                <div className="flex flex-col gap-3.5">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="ga-shimmer h-[88px] border border-ga-line" aria-hidden />)}</div>
              ) : (
                <div className="flex flex-col gap-3.5">
                  {assignments.map((task) => {
                    const m = metaOf(task.assignmentType)
                    const pending = pendingByAssignment[task.id] ?? 0
                    return (
                      <div key={task.id} className="grid items-center gap-4 border border-ga-line bg-ga-card px-[22px] py-5" style={{ gridTemplateColumns: '1fr auto' }}>
                        <div className="min-w-0">
                          <div className="mb-2 flex flex-wrap items-center gap-2.5">
                            <span className="truncate text-[16px] font-bold text-ga-ink">{task.topic}</span>
                            <span className="inline-flex items-center gap-1 px-2 py-[3px] text-[10px] font-bold uppercase tracking-[0.06em]" style={{ color: m.tone, background: `color-mix(in srgb, ${m.tone} 12%, transparent)` }}>
                              <m.Icon size={12} /> {t(`types.${m.labelKey}`)}
                            </span>
                            {task.lessonId != null && lessons.find((l) => l.id === task.lessonId) && (
                              <span className="ga-ui inline-flex items-center rounded-ga px-1.5 py-[3px] text-[10px] font-bold" style={{ color: 'var(--ga-violet)', background: 'var(--ga-violet-soft)' }}>
                                {lessons.find((l) => l.id === task.lessonId)!.title}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px] text-ga-muted">
                            <span>{t('due')} <strong className="text-ga-ink">{fmtDate(task.dueDate)}</strong></span>
                            <span>{t('created')} <strong className="text-ga-ink">{fmtDate(task.createdAt)}</strong></span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {pending > 0 && (
                            <span className="inline-flex items-center gap-1 px-3 py-[7px] text-[11.5px] font-bold" style={{ color: 'var(--ga-ink)', background: 'var(--ga-yellow-soft)', border: '1px solid var(--ga-yellow)' }}>
                              <AlertTriangle size={13} /> {t('pendingGrade', { count: pending })}
                            </span>
                          )}
                          <GaBtn variant="ghost" size="sm" onClick={() => router.push('/v2/teacher/grading')}>
                            {t('viewSubmissions')} <ChevronRight size={14} />
                          </GaBtn>
                        </div>
                      </div>
                    )
                  })}
                  <button
                    type="button"
                    onClick={() => setModal(true)}
                    className="ga-ui border-2 border-dashed border-ga-line px-4 py-4 text-[14px] font-semibold text-ga-muted transition-colors hover:border-ga-accent hover:text-ga-accent"
                  >
                    {t('addNewTask')}
                  </button>
                  {assignments.length === 0 && (
                    <p className="text-center text-[13px] text-ga-muted">{t('noTasks')}</p>
                  )}
                </div>
              )}
            </TkTabsContent>

            {/* ── Analytics (Option-1: real class /analytics + roster XP) ── */}
            <TkTabsContent value="analytics">
              <AnalyticsTab analytics={analytics} students={students} loading={loading} />
            </TkTabsContent>

            {/* ── Teachers (co-teaching: PRIMARY + ASSISTANT) ── */}
            <TkTabsContent value="teachers">
              <div className="mb-3.5 mt-[22px]"><GaCap>{t('teachersCap')}</GaCap></div>
              <div className="border border-ga-line bg-ga-card">
                {loading ? (
                  <div className="ga-shimmer h-16" aria-hidden />
                ) : teachersError ? (
                  <div className="px-5 py-6 text-center">
                    <p className="mb-3 text-[13px] text-ga-muted">{t('teachersLoadError')}</p>
                    <GaBtn variant="ghost" size="sm" onClick={reloadTeachers}>{tc('retry')}</GaBtn>
                  </div>
                ) : teachers.length === 0 ? (
                  <p className="px-5 py-6 text-center text-[13px] text-ga-muted">{t('teachersEmpty')}</p>
                ) : (
                  <ul>
                    {teachers.map((tt) => {
                      const primary = tt.role === 'PRIMARY'
                      return (
                        <li key={tt.teacherId} className="flex items-center gap-3 border-b border-ga-line px-5 py-3.5 last:border-b-0">
                          <span
                            className="grid h-9 w-9 shrink-0 place-items-center rounded-ga-pill text-[13px] font-semibold"
                            style={primary ? { background: 'linear-gradient(135deg,#F5B301,#E8830C)', color: '#fff' } : { background: 'var(--ga-violet-soft)', color: 'var(--ga-violet)' }}
                          >
                            {initial(tt.name)}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[14px] font-semibold text-ga-ink">{tt.name}</p>
                            <p className="ga-ui truncate text-[12.5px] text-ga-muted">{tt.email || '—'}</p>
                          </div>
                          <span
                            className="shrink-0 px-2 py-0.5 text-[11px] font-bold"
                            style={primary ? { color: 'var(--ga-ink)', background: 'var(--ga-yellow-soft)', border: '1px solid var(--ga-yellow)' } : { color: 'var(--ga-violet)', background: 'var(--ga-violet-soft)' }}
                          >
                            {primary ? t('rolePrimary') : t('roleAssistant')}
                          </span>
                          {isPrimary && isRemovable(tt) && (
                            <GaBtn variant="ghost" size="sm" loading={removingCo === tt.teacherId} disabled={removingCo !== null} onClick={() => removeCoTeacher(tt.teacherId)}>
                              <Trash2 size={14} /> {t('removeTeacher')}
                            </GaBtn>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>

              {!teachersError && (isPrimary ? (
                <div className="mt-4 flex flex-wrap items-center gap-2.5">
                  <input
                    type="email"
                    value={coEmail}
                    onChange={(e) => setCoEmail(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !addingCo) void addCoTeacher() }}
                    placeholder={t('addTeacherPlaceholder')}
                    aria-label={t('addTeacher')}
                    className="ga-ui min-w-[240px] flex-1 border border-ga-line bg-ga-card px-3.5 py-2.5 text-[14px] text-ga-ink outline-none focus:border-ga-accent"
                  />
                  <GaBtn variant="primary" size="sm" loading={addingCo} disabled={!coEmail.trim()} onClick={() => void addCoTeacher()}>
                    <UserPlus size={15} /> {t('addTeacher')}
                  </GaBtn>
                </div>
              ) : (
                <p className="mt-4 text-[12.5px] text-ga-muted">{t('teachersPrimaryOnly')}</p>
              ))}

              <p className="mt-3 flex items-start gap-1.5 text-[12px] text-ga-faint">
                <AlertTriangle size={13} className="mt-0.5 shrink-0" /> {t('coTeacherAccessNote')}
              </p>
            </TkTabsContent>
          </TkTabs>
        )}
      </div>

      <AddAssignmentModal open={modal} onOpenChange={setModal} classId={id} lessons={lessons} onCreated={load} />
    </div>
  )
}

// ── Analytics tab ─────────────────────────────────────────────────────────
function AnalyticsTab({ analytics, students, loading }: { analytics: Analytics | null; students: Student[]; loading: boolean }) {
  const t = useTranslations('v2.teacher.classDetail')
  if (loading) return <div className="ga-shimmer h-[280px] border border-ga-line" aria-hidden />
  if (!analytics) return <div className="border border-dashed border-ga-line px-6 py-10 text-center text-[14px] text-ga-muted">{t('analyticsEmpty')}</div>

  const maxErr = Math.max(1, ...analytics.topErrors.map((e) => e.count))
  const ranking = [...students].sort((a, b) => b.xp - a.xp).slice(0, 8)
  const PRIORITY: Record<string, { fg: string; bg: string }> = {
    HIGH: { fg: 'var(--ga-red)', bg: 'var(--ga-red-soft)' },
    MEDIUM: { fg: 'var(--ga-orange)', bg: 'var(--ga-orange-soft)' },
    LOW: { fg: 'var(--ga-muted)', bg: 'var(--ga-side-active)' },
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { label: t('analyticsStats.totalXp'), value: analytics.totalXp.toLocaleString(), color: '#2F6FC9' },
          { label: t('analyticsStats.completedAssignments'), value: analytics.completedAssignments, color: VIOLET },
          { label: t('analyticsStats.avgSpeaking'), value: analytics.avgSpeakingScore ? analytics.avgSpeakingScore.toFixed(1) : '—', color: '#1E9E61' },
          { label: t('analyticsStats.reviewCoverage'), value: `${Math.round(analytics.reviewCoveragePct)}%`, color: '#E07B39' },
        ].map((s) => (
          <div key={s.label} className="border border-ga-line bg-ga-card p-[18px]">
            <span className="block h-[3px] w-8" style={{ background: s.color }} />
            <div className="mt-3 font-ga-display text-[28px] font-medium leading-none text-ga-ink">{s.value}</div>
            <GaCap className="mt-2 block">{s.label}</GaCap>
          </div>
        ))}
      </div>

      <div className="mt-[22px] grid grid-cols-1 gap-[22px] lg:grid-cols-[1.3fr_1fr]">
        {/* Top errors */}
        <div className="border border-ga-line bg-ga-card p-[22px]">
          <GaCap className="mb-4 block">{t('topErrorsCap')}</GaCap>
          {analytics.topErrors.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-ga-muted">{t('noErrors')}</p>
          ) : (
            <div className="flex flex-col gap-3">
              {analytics.topErrors.slice(0, 6).map((e) => {
                const label = getErrorSnippet(e.errorCode, 'vi').title
                return (
                  <div key={e.errorCode}>
                    <div className="mb-1 flex items-center justify-between gap-3 text-[13px]">
                      <span className="truncate text-ga-ink" title={e.errorCode}>{label}</span>
                      <span className="shrink-0 font-semibold text-ga-muted">{t('errorCount', { count: e.count })}</span>
                    </div>
                    <span className="block h-1.5 bg-ga-line"><span className="block h-full" style={{ width: `${(e.count / maxErr) * 100}%`, background: VIOLET }} /></span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* XP ranking (derived from roster) */}
        <div className="border border-ga-line bg-ga-card p-[22px]">
          <GaCap className="mb-4 flex items-center gap-1.5"><Trophy size={13} /> {t('xpRankingCap')}</GaCap>
          {ranking.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-ga-muted">{t('noStudentsYet')}</p>
          ) : (
            <div className="flex flex-col">
              {ranking.map((s, i) => (
                <div key={s.studentId} className="flex items-center gap-3 py-2" style={{ borderTop: i ? '1px solid var(--ga-line)' : 'none' }}>
                  <span className="w-5 text-center font-ga-display text-[15px] font-medium" style={{ color: i < 3 ? VIOLET : 'var(--ga-muted)' }}>{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-ga-ink">{s.displayName}</span>
                  <span className="shrink-0 text-[13px] font-semibold text-ga-muted">{s.xp.toLocaleString()} XP</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Class skill average (CEFR skills 0–10) — from evaluated students */}
      {(() => {
        const evaluated = students.filter((s) => s.evaluatedAt != null)
        if (evaluated.length === 0) return null
        const avgs = SKILLS.map((sk, i) => {
          const vs = evaluated.map((s) => skillVals(s)[i]).filter((v): v is number => v != null)
          return { ...sk, avg: vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : null }
        })
        return (
          <div className="mt-[22px] border border-ga-line bg-ga-card p-[22px]">
            <GaCap className="mb-4 block">{t('classSkillAvgCap', { count: evaluated.length })}</GaCap>
            <div className="flex flex-col gap-3">
              {avgs.map((sk) => {
                const pct = sk.avg == null ? 0 : Math.min(100, (sk.avg / SKILL_MAX) * 100)
                const pass = sk.avg != null && sk.avg >= 5
                return (
                  <div key={sk.key}>
                    <div className="mb-1 flex items-center justify-between gap-3 text-[13px]">
                      <span className="text-ga-ink">{sk.name}</span>
                      <span className="shrink-0 font-semibold text-ga-muted">{sk.avg == null ? '—' : t('skillScoreValue', { value: sk.avg.toFixed(1) })}</span>
                    </div>
                    <span className="block h-1.5 bg-ga-line"><span className="block h-full" style={{ width: `${pct}%`, background: pass ? '#1E9E61' : VIOLET }} /></span>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* Action items */}
      {analytics.actionItems.length > 0 && (
        <div className="mt-[22px] border border-ga-line bg-ga-card p-[22px]">
          <GaCap className="mb-4 block">{t('actionItemsCap')}</GaCap>
          <div className="flex flex-col gap-3">
            {analytics.actionItems.map((a, i) => {
              const p = PRIORITY[a.priority] ?? PRIORITY.LOW
              return (
                <div key={i} className="flex items-start gap-3 border border-ga-line bg-ga-bg px-4 py-3">
                  <span className="mt-0.5 shrink-0 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em]" style={{ color: p.fg, background: p.bg }}>{a.priority}</span>
                  <div className="min-w-0">
                    <div className="text-[14px] font-semibold text-ga-ink">{a.title}</div>
                    <p className="ga-ui mt-0.5 text-[13px] text-ga-muted">{a.detail}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </>
  )
}

// ── Add-assignment modal (real POST) ─────────────────────────────────────────
function AddAssignmentModal({ open, onOpenChange, classId, lessons, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; classId: number; lessons: ClassLesson[]; onCreated: () => void }) {
  const t = useTranslations('v2.teacher.classDetail')
  const tc = useTranslations('v2.common')
  const [topic, setTopic] = useState('')
  const [type, setType] = useState('GENERAL')
  const [due, setDue] = useState('')
  const [lessonId, setLessonId] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!topic.trim()) { toast.error(t('modalTopicRequired')); return }
    setSaving(true)
    try {
      await api.post(`/v2/teacher/classes/${classId}/assignments`, {
        topic: topic.trim(),
        description: '',
        assignmentType: type,
        skill: 'GENERAL',
        dueDate: due ? new Date(due).toISOString() : null,
        attachmentUrl: null,
        lessonId: lessonId ? Number(lessonId) : null,
      })
      toast.success(t('modalCreateSuccess'))
      setTopic(''); setType('GENERAL'); setDue(''); setLessonId('')
      onOpenChange(false)
      onCreated()
    } catch (e: unknown) {
      toast.error(apiMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const field = 'ga-ui block w-full border border-ga-line bg-ga-bg px-3.5 py-2.5 text-[14.5px] text-ga-ink outline-none focus:border-ga-accent'

  return (
    <TkModal
      open={open}
      onOpenChange={onOpenChange}
      title={t('modalTitle')}
      size="sm"
      footer={
        <>
          <GaBtn variant="ghost" size="sm" onClick={() => onOpenChange(false)}>{tc('cancel')}</GaBtn>
          <GaBtn variant="yellow" size="sm" loading={saving} onClick={submit}>{t('modalAssign')}</GaBtn>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div>
          <GaCap className="mb-2 block">{t('modalTopicCap')}</GaCap>
          <input className={field} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder={t('modalTopicPlaceholder')} />
        </div>
        <div className="grid grid-cols-2 gap-3.5">
          <div>
            <GaCap className="mb-2 block">{t('modalTypeCap')}</GaCap>
            <select className={field} value={type} onChange={(e) => setType(e.target.value)}>
              {ASSIGNMENT_TYPES.map((at) => <option key={at} value={at}>{t(`types.${metaOf(at).labelKey}`)}</option>)}
            </select>
          </div>
          <div>
            <GaCap className="mb-2 block">{t('modalDueCap')}</GaCap>
            <input type="date" className={field} value={due} onChange={(e) => setDue(e.target.value)} />
          </div>
        </div>
        {lessons.length > 0 && (
          <div>
            <GaCap className="mb-2 block">{t('modalLessonCap')}</GaCap>
            <select className={field} value={lessonId} onChange={(e) => setLessonId(e.target.value)}>
              <option value="">{t('modalLessonNone')}</option>
              {lessons.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
            </select>
          </div>
        )}
      </div>
    </TkModal>
  )
}
