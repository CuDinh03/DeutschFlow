'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Plus, Mail, ClipboardList, ChevronRight, AlertTriangle, Trophy,
  ArrowLeft, Sparkles, Mic, PenLine, FileText, BookOpen, SpellCheck,
} from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import api, { apiMessage } from '@/lib/api'
import {
  GaPageHdr, GaBtn, GaCap, TkStatStrip, TkSearch, TkModal,
  TkTabs, TkTabsList, TkTabsTrigger, TkTabsContent,
} from '@/components/ui-v2'
import { getErrorSnippet } from '@/lib/errors/errorTaxonomy'

// ─────────────────────────────────────────────────────────────────────────────
// Chi tiết lớp (GaClassDetail) — violet. Tabs: Học viên · Bài tập · Thống kê.
// Plumbing reused 1:1 (zero backend): GET /v2/teacher/classes (class info),
//   /classes/{id}/students, /classes/{id}/assignments, /classes/{id}/analytics,
//   /grading/queue?classId={id} (pending-per-assignment), POST /classes/{id}/assignments.
// Option-1 (established pattern): roster carries only studentId/displayName/email/xp/
//   level/cefrLevel → proto's per-student SCORE / STREAK / LẦN CUỐI columns DROPPED.
//   Analytics tab rebuilt from the REAL class /analytics (totalXp, completedAssignments,
//   avgSpeakingScore, reviewCoveragePct, topErrors, actionItems) + XP ranking derived from
//   the roster → proto's score-bars / submission-donut / skill-heatmap DROPPED (no data;
//   skill_* columns exist on class_students but aren't exposed by the API). → backlog.
// ─────────────────────────────────────────────────────────────────────────────

const VIOLET = '#7C56C8'

interface ClassInfo { id: number; name: string; code: string; studentCount: number }
interface Student { studentId: number; displayName: string; email: string; xp: number; level: number; cefrLevel: string }
interface Assignment { id: number; topic: string; description: string; assignmentType: string; dueDate: string | null; createdAt: string }
interface ActionItem { title: string; detail: string; priority: string }
interface Analytics {
  totalStudents: number; totalXp: number; completedAssignments: number
  avgSpeakingScore: number; reviewCoveragePct: number
  topErrors: { errorCode: string; count: number }[]
  actionItems: ActionItem[]
}

type Tab = 'students' | 'tasks' | 'analytics'
type SortCol = 'name' | 'cefr' | 'level' | 'xp'

const TYPE_META: Record<string, { label: string; tone: string; Icon: typeof Mic }> = {
  SPEAKING_SCENARIO: { label: 'Speaking', tone: 'var(--ga-violet)', Icon: Mic },
  ESSAY: { label: 'Viết luận', tone: 'var(--ga-blue)', Icon: PenLine },
  WRITING: { label: 'Viết · Schreiben', tone: 'var(--ga-blue)', Icon: PenLine },
  MOCK_TEST: { label: 'Thi thử', tone: 'var(--ga-orange)', Icon: FileText },
  VOCABULARY: { label: 'Từ vựng', tone: 'var(--ga-green)', Icon: BookOpen },
  GRAMMAR: { label: 'Ngữ pháp', tone: 'var(--ga-teal)', Icon: SpellCheck },
  GENERAL: { label: 'Bài tập', tone: 'var(--ga-muted)', Icon: FileText },
}
const metaOf = (t: string) => TYPE_META[t] ?? TYPE_META.GENERAL
const initial = (n: string) => (n.trim()[0] ?? '?').toUpperCase()
const fmtDate = (d: string | null) => (d ? format(new Date(d), 'dd/MM/yyyy') : '—')

const ASSIGNMENT_TYPES = ['GENERAL', 'ESSAY', 'WRITING', 'SPEAKING_SCENARIO', 'VOCABULARY', 'GRAMMAR', 'MOCK_TEST']

export default function V2ClassDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = Number(params.id)

  const [info, setInfo] = useState<ClassInfo | null>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [pendingByAssignment, setPendingByAssignment] = useState<Record<number, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [tab, setTab] = useState<Tab>('students')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<{ col: SortCol; dir: 'asc' | 'desc' }>({ col: 'xp', dir: 'desc' })
  const [selected, setSelected] = useState<Record<number, boolean>>({})
  const [modal, setModal] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [clsList, st, asg, an, queue] = await Promise.all([
        api.get('/v2/teacher/classes'),
        api.get(`/v2/teacher/classes/${id}/students`),
        api.get(`/v2/teacher/classes/${id}/assignments`),
        api.get(`/v2/teacher/classes/${id}/analytics`).catch(() => ({ data: null })),
        api.get(`/v2/teacher/grading/queue?classId=${id}`).catch(() => ({ data: [] })),
      ])
      const cls = ((clsList.data ?? []) as Record<string, unknown>[]).find((c) => Number(c.id) === id)
      setInfo(
        cls
          ? { id, name: String(cls.name ?? `Lớp #${id}`), code: String(cls.inviteCode ?? cls.code ?? ''), studentCount: Number(cls.studentCount) || 0 }
          : { id, name: `Lớp #${id}`, code: '', studentCount: 0 },
      )
      setStudents((st.data ?? []) as Student[])
      setAssignments((asg.data ?? []) as Assignment[])
      setAnalytics((an.data as Analytics | null) ?? null)
      const pend: Record<number, number> = {}
      for (const q of (queue.data ?? []) as { assignmentId: number }[]) pend[q.assignmentId] = (pend[q.assignmentId] ?? 0) + 1
      setPendingByAssignment(pend)
      setError('')
    } catch (e: unknown) {
      setError(apiMessage(e))
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

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
        title={info?.name ?? 'Chi tiết lớp'}
        subtitle={info ? `Mã lớp: ${info.code || '—'} · ${info.studentCount} học viên đã tham gia` : 'Đang tải…'}
        right={
          <div className="flex items-center gap-2.5">
            <GaBtn variant="ghost" size="sm" onClick={() => router.push('/v2/teacher')}>
              <ArrowLeft size={15} /> Lớp học
            </GaBtn>
            <GaBtn variant="ghost" size="sm" onClick={() => setModal(true)}>
              <Plus size={15} /> Thêm bài tập
            </GaBtn>
            <GaBtn variant="yellow" size="sm" onClick={() => toast('Tạo tài liệu AI (sắp ra mắt)')}>
              <Sparkles size={15} /> Tạo tài liệu AI
            </GaBtn>
          </div>
        }
      />

      <div className="flex-1 overflow-auto px-10 py-6">
        {error ? (
          <div className="border border-ga-line bg-ga-card px-10 py-[52px] text-center">
            <h2 className="font-ga-display text-[24px] font-medium text-ga-red">Không tải được lớp học</h2>
            <p className="ga-ui mx-auto mb-5 mt-3 max-w-sm text-[14px] text-ga-muted">
              {error} <code className="font-mono text-[12px] text-ga-accent">{`GET /api/v2/teacher/classes/${id}/…`}</code>
            </p>
            <GaBtn variant="primary" onClick={load}>Thử lại</GaBtn>
          </div>
        ) : (
          <TkTabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
            <TkTabsList>
              <TkTabsTrigger value="students">Học viên · {students.length}</TkTabsTrigger>
              <TkTabsTrigger value="tasks">Bài tập · {assignments.length}</TkTabsTrigger>
              <TkTabsTrigger value="analytics">Thống kê</TkTabsTrigger>
            </TkTabsList>

            {/* ── Students ── */}
            <TkTabsContent value="students">
              <TkStatStrip
                items={[
                  { label: 'Sĩ số', value: students.length, sub: `/ ${info?.studentCount ?? 0} đã tham gia` },
                  { label: 'Tổng XP lớp', value: (analytics?.totalXp ?? 0).toLocaleString(), sub: 'tích luỹ', color: '#2F6FC9' },
                  { label: 'Bài tập đã giao', value: assignments.length, sub: 'trên lớp này', color: VIOLET },
                  {
                    label: 'Điểm nói TB',
                    value: analytics?.avgSpeakingScore ? analytics.avgSpeakingScore.toFixed(1) : '—',
                    sub: analytics?.avgSpeakingScore ? 'phiên Speaking' : 'chưa có phiên',
                    color: '#1E9E61',
                  },
                ]}
              />

              <div className="mb-3.5 mt-[22px] flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <GaCap>Danh sách học viên</GaCap>
                  {selCount > 0 && (
                    <span className="flex items-center gap-2">
                      <span className="px-2 py-0.5 text-[11.5px] font-bold" style={{ color: VIOLET, background: 'var(--ga-violet-soft)' }}>
                        {selCount} đã chọn
                      </span>
                      {[
                        { label: 'Nhắn tin', Icon: Mail },
                        { label: 'Giao bài', Icon: ClipboardList },
                      ].map(({ label, Icon }) => (
                        <button
                          key={label}
                          type="button"
                          onClick={() => { toast.success(`${label} cho ${selCount} học viên`); setSelected({}) }}
                          className="ga-ui inline-flex items-center gap-1.5 border border-ga-line px-2.5 py-1.5 text-[11.5px] font-semibold text-ga-ink transition-colors hover:border-ga-accent hover:text-ga-accent"
                        >
                          <Icon size={13} /> {label}
                        </button>
                      ))}
                    </span>
                  )}
                </div>
                <TkSearch value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm học viên…" containerClassName="w-[220px]" />
              </div>

              <div className="border border-ga-line bg-ga-card">
                <div className="grid items-center gap-2 border-b border-ga-line bg-ga-bg px-[18px] py-[11px]" style={{ gridTemplateColumns: '34px 1fr 90px 90px 90px 84px' }}>
                  <input
                    type="checkbox"
                    aria-label="Chọn tất cả"
                    checked={rows.length > 0 && rows.every((r) => selected[r.studentId])}
                    onChange={(e) => { const v = e.target.checked; const o = { ...selected }; rows.forEach((r) => (o[r.studentId] = v)); setSelected(o) }}
                    style={{ accentColor: VIOLET }}
                  />
                  {([['name', 'Học viên', 'left'], ['cefr', 'CEFR', 'left'], ['level', 'Cấp độ', 'left'], ['xp', 'XP', 'left']] as [SortCol, string, string][]).map(([col, label]) => (
                    <button key={col} type="button" onClick={() => toggleSort(col)} className="flex items-center gap-1 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-ga-muted hover:text-ga-ink">
                      {label}{sort.col === col && <span>{sort.dir === 'asc' ? '↑' : '↓'}</span>}
                    </button>
                  ))}
                  <span />
                </div>

                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => <div key={i} className="ga-shimmer mx-[18px] my-2.5 h-9" aria-hidden />)
                ) : rows.length === 0 ? (
                  <div className="px-6 py-[30px] text-center text-[14px] text-ga-muted">
                    {students.length === 0 ? 'Lớp chưa có học viên nào tham gia.' : 'Không tìm thấy học viên.'}
                  </div>
                ) : (
                  rows.map((s, i) => (
                    <div
                      key={s.studentId}
                      className="grid items-center gap-2 px-[18px] py-[13px] transition-colors hover:bg-ga-surface"
                      style={{ gridTemplateColumns: '34px 1fr 90px 90px 90px 84px', borderTop: i ? '1px solid var(--ga-line)' : 'none', background: selected[s.studentId] ? 'var(--ga-violet-soft)' : undefined }}
                    >
                      <input type="checkbox" aria-label={`Chọn ${s.displayName}`} checked={!!selected[s.studentId]} onChange={(e) => setSelected((o) => ({ ...o, [s.studentId]: e.target.checked }))} style={{ accentColor: VIOLET }} />
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span className="grid h-8 w-8 shrink-0 place-items-center font-ga-display text-[13px] font-medium text-ga-bg" style={{ background: 'var(--ga-ink)' }}>{initial(s.displayName)}</span>
                        <span className="min-w-0">
                          <span className="block truncate text-[14px] font-semibold text-ga-ink">{s.displayName}</span>
                          <span className="block truncate text-[11.5px] text-ga-muted">{s.email}</span>
                        </span>
                      </div>
                      <span className="font-ga-display text-[14px] font-medium text-ga-ink">{s.cefrLevel || '—'}</span>
                      <span className="text-[13.5px] text-ga-muted">Cấp {s.level}</span>
                      <span className="text-[13.5px] font-semibold text-ga-ink">{s.xp.toLocaleString()}</span>
                      <button
                        type="button"
                        onClick={() => toast('Báo cáo học viên (sắp ra mắt)')}
                        className="ga-ui justify-self-end border border-ga-line px-2.5 py-1.5 text-[11px] font-semibold text-ga-muted transition-colors hover:border-ga-accent hover:text-ga-accent"
                      >
                        Chi tiết
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
                  {assignments.map((t) => {
                    const m = metaOf(t.assignmentType)
                    const pending = pendingByAssignment[t.id] ?? 0
                    return (
                      <div key={t.id} className="grid items-center gap-4 border border-ga-line bg-ga-card px-[22px] py-5" style={{ gridTemplateColumns: '1fr auto' }}>
                        <div className="min-w-0">
                          <div className="mb-2 flex flex-wrap items-center gap-2.5">
                            <span className="truncate text-[16px] font-bold text-ga-ink">{t.topic}</span>
                            <span className="inline-flex items-center gap-1 px-2 py-[3px] text-[10px] font-bold uppercase tracking-[0.06em]" style={{ color: m.tone, background: `color-mix(in srgb, ${m.tone} 12%, transparent)` }}>
                              <m.Icon size={12} /> {m.label}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px] text-ga-muted">
                            <span>Hạn <strong className="text-ga-ink">{fmtDate(t.dueDate)}</strong></span>
                            <span>Tạo <strong className="text-ga-ink">{fmtDate(t.createdAt)}</strong></span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {pending > 0 && (
                            <span className="inline-flex items-center gap-1 px-3 py-[7px] text-[11.5px] font-bold" style={{ color: 'var(--ga-ink)', background: 'var(--ga-yellow-soft)', border: '1px solid var(--ga-yellow)' }}>
                              <AlertTriangle size={13} /> {pending} chờ chấm
                            </span>
                          )}
                          <GaBtn variant="ghost" size="sm" onClick={() => router.push('/v2/teacher/grading')}>
                            Xem bài <ChevronRight size={14} />
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
                    + Thêm bài tập mới
                  </button>
                  {assignments.length === 0 && (
                    <p className="text-center text-[13px] text-ga-muted">Lớp chưa có bài tập nào — thêm bài đầu tiên ở trên.</p>
                  )}
                </div>
              )}
            </TkTabsContent>

            {/* ── Analytics (Option-1: real class /analytics + roster XP) ── */}
            <TkTabsContent value="analytics">
              <AnalyticsTab analytics={analytics} students={students} loading={loading} />
            </TkTabsContent>
          </TkTabs>
        )}
      </div>

      <AddAssignmentModal open={modal} onOpenChange={setModal} classId={id} onCreated={load} />
    </div>
  )
}

// ── Analytics tab ─────────────────────────────────────────────────────────
function AnalyticsTab({ analytics, students, loading }: { analytics: Analytics | null; students: Student[]; loading: boolean }) {
  if (loading) return <div className="ga-shimmer h-[280px] border border-ga-line" aria-hidden />
  if (!analytics) return <div className="border border-dashed border-ga-line px-6 py-10 text-center text-[14px] text-ga-muted">Chưa có dữ liệu thống kê cho lớp này.</div>

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
          { label: 'Tổng XP lớp', value: analytics.totalXp.toLocaleString(), color: '#2F6FC9' },
          { label: 'Bài tập hoàn thành', value: analytics.completedAssignments, color: VIOLET },
          { label: 'Điểm nói TB', value: analytics.avgSpeakingScore ? analytics.avgSpeakingScore.toFixed(1) : '—', color: '#1E9E61' },
          { label: 'Độ phủ ôn tập', value: `${Math.round(analytics.reviewCoveragePct)}%`, color: '#E07B39' },
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
          <GaCap className="mb-4 block">Lỗi thường gặp của lớp</GaCap>
          {analytics.topErrors.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-ga-muted">Chưa ghi nhận lỗi lặp lại nào.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {analytics.topErrors.slice(0, 6).map((e) => {
                const label = getErrorSnippet(e.errorCode, 'vi').title
                return (
                  <div key={e.errorCode}>
                    <div className="mb-1 flex items-center justify-between gap-3 text-[13px]">
                      <span className="truncate text-ga-ink" title={e.errorCode}>{label}</span>
                      <span className="shrink-0 font-semibold text-ga-muted">{e.count} lần</span>
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
          <GaCap className="mb-4 flex items-center gap-1.5"><Trophy size={13} /> Xếp hạng XP</GaCap>
          {ranking.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-ga-muted">Chưa có học viên.</p>
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

      {/* Action items */}
      {analytics.actionItems.length > 0 && (
        <div className="mt-[22px] border border-ga-line bg-ga-card p-[22px]">
          <GaCap className="mb-4 block">Việc cần làm</GaCap>
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
function AddAssignmentModal({ open, onOpenChange, classId, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; classId: number; onCreated: () => void }) {
  const [topic, setTopic] = useState('')
  const [type, setType] = useState('GENERAL')
  const [due, setDue] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!topic.trim()) { toast.error('Nhập tiêu đề bài tập'); return }
    setSaving(true)
    try {
      await api.post(`/v2/teacher/classes/${classId}/assignments`, {
        topic: topic.trim(),
        description: '',
        assignmentType: type,
        skill: 'GENERAL',
        dueDate: due ? new Date(due).toISOString() : null,
        attachmentUrl: null,
      })
      toast.success('Đã thêm bài tập & giao cho lớp')
      setTopic(''); setType('GENERAL'); setDue('')
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
      title="Thêm bài tập"
      size="sm"
      footer={
        <>
          <GaBtn variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Huỷ</GaBtn>
          <GaBtn variant="yellow" size="sm" loading={saving} onClick={submit}>Giao cho lớp</GaBtn>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div>
          <GaCap className="mb-2 block">Tiêu đề bài tập</GaCap>
          <input className={field} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="VD: Ôn từ vựng tuần 5" />
        </div>
        <div className="grid grid-cols-2 gap-3.5">
          <div>
            <GaCap className="mb-2 block">Loại</GaCap>
            <select className={field} value={type} onChange={(e) => setType(e.target.value)}>
              {ASSIGNMENT_TYPES.map((t) => <option key={t} value={t}>{metaOf(t).label}</option>)}
            </select>
          </div>
          <div>
            <GaCap className="mb-2 block">Hạn nộp</GaCap>
            <input type="date" className={field} value={due} onChange={(e) => setDue(e.target.value)} />
          </div>
        </div>
      </div>
    </TkModal>
  )
}
