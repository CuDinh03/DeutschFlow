'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import api, { apiMessage } from '@/lib/api'
import { GaPageHdr, GaBtn, GaCap, TkStatStrip, TkSearch } from '@/components/ui-v2'

const VIOLET = '#7C56C8'

// GET /v2/teacher/classes → TeacherClassDto (camelCase). Normalize tolerantly.
interface TClass {
  id: number
  name: string
  code: string
  students: number
  tasks: number
  pending: number
}
interface Summary {
  pendingReviewCount: number
  pendingJoinRequests: number
}
interface QueueItem {
  id: number
  studentName: string
  topic: string
  assignmentType: string
  submittedAt: string | null
}
const TYPE_LABEL: Record<string, string> = {
  SPEAKING_SCENARIO: 'Speaking', ESSAY: 'Viết luận', WRITING: 'Viết', MOCK_TEST: 'Thi thử',
  VOCABULARY: 'Từ vựng', GRAMMAR: 'Ngữ pháp', GENERAL: 'Bài tập',
}
const relTime = (iso: string | null): string => {
  if (!iso) return ''
  const diff = (Date.now() - new Date(iso).getTime()) / 36e5 // hours
  if (diff < 1) return 'vừa nộp'
  if (diff < 24) return `${Math.floor(diff)} giờ trước`
  return `${Math.floor(diff / 24)} ngày trước`
}

function normalizeClass(r: Record<string, unknown>): TClass {
  const num = (...keys: string[]) => {
    for (const k of keys) {
      const n = Number(r[k])
      if (Number.isFinite(n) && r[k] != null) return n
    }
    return 0
  }
  return {
    id: Number(r.id),
    name: String(r.name ?? ''),
    code: String(r.inviteCode ?? r.code ?? ''),
    students: num('studentCount', 'students'),
    tasks: num('quizCount', 'taskCount', 'tasks'),
    pending: num('pendingReviewCount', 'pendingCount', 'pending'),
  }
}

export default function V2TeacherDashboardPage() {
  const router = useRouter()
  const [classes, setClasses] = useState<TClass[]>([])
  const [summary, setSummary] = useState<Summary>({ pendingReviewCount: 0, pendingJoinRequests: 0 })
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [newClass, setNewClass] = useState('')
  const [creating, setCreating] = useState(false)
  const [query, setQuery] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [cls, sum, q] = await Promise.all([
        api.get('/v2/teacher/classes'),
        api.get('/v2/teacher/dashboard/summary').catch(() => ({ data: {} })),
        api.get('/v2/teacher/grading/queue').catch(() => ({ data: [] })),
      ])
      setClasses(((cls.data ?? []) as Record<string, unknown>[]).map(normalizeClass))
      const s = (sum.data ?? {}) as Record<string, unknown>
      setSummary({
        pendingReviewCount: Number(s.pendingReviewCount) || 0,
        pendingJoinRequests: Number(s.pendingJoinRequests) || 0,
      })
      setQueue(((q.data ?? []) as Record<string, unknown>[]).slice(0, 5).map((r) => ({
        id: Number(r.id),
        studentName: String(r.studentName ?? '—'),
        topic: String(r.topic ?? ''),
        assignmentType: String(r.assignmentType ?? 'GENERAL'),
        submittedAt: (r.submittedAt as string) ?? null,
      })))
      setError('')
    } catch (e: unknown) {
      setError(apiMessage(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const totals = useMemo(
    () => ({
      students: classes.reduce((a, c) => a + c.students, 0),
      tasks: classes.reduce((a, c) => a + c.tasks, 0),
    }),
    [classes],
  )

  const list = classes.filter((c) => c.name.toLowerCase().includes(query.trim().toLowerCase()))

  const createClass = async () => {
    const name = newClass.trim()
    if (!name) return
    setCreating(true)
    try {
      await api.post('/v2/teacher/classes', { name })
      setNewClass('')
      toast.success(`Đã tạo lớp "${name}"`)
      await load()
    } catch (e: unknown) {
      toast.error(apiMessage(e))
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr
        accent
        title="Dashboard & Lớp học"
        subtitle="Quản lý tổng quan tiến độ học tập và các lớp học của bạn"
        right={
          <GaBtn variant="ghost" onClick={() => toast('Báo cáo phân tích (sắp ra mắt)')}>
            Xem báo cáo →
          </GaBtn>
        }
      />

      <div className="flex-1 overflow-auto px-[52px] py-[30px]">
        <TkStatStrip
          items={[
            { label: 'Tổng học viên', value: totals.students, sub: `Hoạt động trong ${classes.length} lớp` },
            {
              label: 'Cần chấm điểm',
              value: summary.pendingReviewCount,
              sub: 'Bài tập & Speaking',
              color: '#E07B39',
              alert: summary.pendingReviewCount > 0,
            },
            { label: 'Bài tập đang giao', value: totals.tasks, sub: 'trên các lớp', color: '#2F6FC9' },
            {
              label: 'Yêu cầu vào lớp',
              value: summary.pendingJoinRequests,
              sub: 'chờ duyệt',
              color: '#1E9E61',
              alert: summary.pendingJoinRequests > 0,
            },
          ]}
        />

        <div className="mt-[30px] grid grid-cols-1 gap-6 xl:grid-cols-[1fr_360px] xl:items-start">
          {/* Classes */}
          <div>
            <div className="mb-[22px] flex border border-ga-line bg-ga-card">
              <input
                value={newClass}
                onChange={(e) => setNewClass(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && createClass()}
                placeholder="Nhập tên lớp học (VD: A1.1 Lớp tối 2-4-6)"
                className="flex-1 bg-transparent px-5 py-[15px] text-[15px] text-ga-ink outline-none"
              />
              <button
                type="button"
                onClick={createClass}
                disabled={creating}
                className="flex shrink-0 items-center gap-2 bg-ga-ink px-[26px] py-[15px] text-[14px] font-semibold text-ga-bg disabled:opacity-60"
              >
                <Plus size={18} /> Tạo lớp
              </button>
            </div>

            <div className="mb-[18px] flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <GaCap>Các lớp đang giảng dạy</GaCap>
                <span className="bg-ga-ink px-2.5 py-[3px] text-[11px] font-bold text-ga-bg">{classes.length}</span>
              </div>
              <TkSearch
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tìm lớp…"
                containerClassName="w-[200px]"
              />
            </div>

            {loading ? (
              <div className="grid grid-cols-2 gap-[18px]">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="ga-shimmer h-[120px] border border-ga-line" aria-hidden />
                ))}
              </div>
            ) : error ? (
              <div className="border border-ga-line bg-ga-card px-10 py-[52px] text-center">
                <h2 className="font-ga-display text-[26px] font-medium leading-[1.2] text-ga-red">
                  Không tải được lớp học
                </h2>
                <p className="ga-ui mx-auto mb-5 mt-3 max-w-sm text-[14.5px] text-ga-muted">
                  {error} <code className="font-mono text-[12px] text-ga-accent">GET /api/v2/teacher/classes</code>
                </p>
                <GaBtn variant="primary" onClick={load}>
                  Thử lại
                </GaBtn>
              </div>
            ) : list.length === 0 ? (
              <div className="border border-dashed border-ga-line px-10 py-[30px] text-center text-[14px] text-ga-muted">
                {classes.length === 0 ? 'Chưa có lớp nào — tạo lớp đầu tiên ở trên.' : 'Không tìm thấy lớp nào.'}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-[18px]">
                {list.map((c) => (
                  <div key={c.id} className="border border-ga-line bg-ga-card">
                    <button
                      type="button"
                      onClick={() => router.push(`/v2/teacher/classes/${c.id}`)}
                      className="flex w-full items-start justify-between gap-3 border-b border-ga-line px-[22px] py-5 text-left transition-colors hover:bg-ga-surface"
                    >
                      <div className="flex items-center gap-3.5">
                        <span className="grid h-[42px] w-[42px] shrink-0 place-items-center bg-ga-side-active font-ga-display text-[20px] font-medium text-ga-ink">
                          {(c.name[0] ?? 'L').toUpperCase()}
                        </span>
                        <div>
                          <div className="text-[15.5px] font-bold leading-[1.3] text-ga-ink">{c.name}</div>
                          <div className="mt-[7px] flex gap-3.5 text-[13px] text-ga-muted">
                            <span>
                              <strong className="text-ga-ink">{c.students}</strong> HV
                            </span>
                            <span>
                              <strong className="text-ga-ink">{c.tasks}</strong> bài
                            </span>
                          </div>
                        </div>
                      </div>
                      {c.pending > 0 && (
                        <span
                          className="shrink-0 px-2.5 py-[5px] text-[11.5px] font-bold"
                          style={{ color: VIOLET, background: 'var(--ga-violet-soft)', border: `1px solid ${VIOLET}55` }}
                        >
                          {c.pending} chờ chấm
                        </span>
                      )}
                    </button>
                    <div className="flex items-center justify-between gap-2.5 px-[22px] py-3">
                      <div className="flex gap-2">
                        {['Vào lớp', 'Tài liệu AI'].map((a) => (
                          <button
                            key={a}
                            type="button"
                            onClick={() => toast(`${a} (sắp ra mắt)`)}
                            className="rounded-ga border border-ga-line px-3 py-[7px] text-[11.5px] font-semibold text-ga-muted transition-colors hover:border-ga-accent hover:text-ga-accent"
                          >
                            {a}
                          </button>
                        ))}
                      </div>
                      {c.code && (
                        <code className="bg-ga-ink px-2.5 py-1.5 text-[12px] font-semibold tracking-[0.08em] text-ga-yellow">
                          {c.code}
                        </code>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right: grading + join summary (count-only — no list endpoint) */}
          <div className="flex flex-col gap-5">
            <div className="border border-ga-line bg-ga-card p-[22px]">
              <div className="mb-3.5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <GaCap>Cần chấm điểm</GaCap>
                  {summary.pendingReviewCount > 0 && (
                    <span className="px-2 py-0.5 text-[11px] font-bold" style={{ color: VIOLET, background: 'var(--ga-violet-soft)' }}>
                      {summary.pendingReviewCount}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => router.push('/v2/teacher/grading')}
                  className="text-[12px] font-semibold underline"
                  style={{ color: VIOLET }}
                >
                  Vào chấm →
                </button>
              </div>
              {queue.length === 0 ? (
                <p className="py-3 text-[13px] text-ga-muted">Không có bài chờ chấm 🎉</p>
              ) : (
                <div className="flex flex-col">
                  {queue.map((q, i) => (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => router.push('/v2/teacher/grading')}
                      className="flex items-center gap-2.5 py-2.5 text-left transition-colors hover:opacity-80"
                      style={{ borderTop: i ? '1px solid var(--ga-line)' : 'none' }}
                    >
                      <span className="grid h-8 w-8 shrink-0 place-items-center font-ga-display text-[13px] font-medium text-ga-bg" style={{ background: 'var(--ga-ink)' }}>
                        {(q.studentName[0] ?? '?').toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold text-ga-ink">{q.studentName}</span>
                        <span className="block truncate text-[11.5px] text-ga-muted">{q.topic}</span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block px-1.5 py-0.5 text-[10px] font-bold" style={{ color: VIOLET, background: 'var(--ga-violet-soft)' }}>
                          {TYPE_LABEL[q.assignmentType] ?? 'Bài tập'}
                        </span>
                        <span className="mt-0.5 block text-[10px] text-ga-subtle">{relTime(q.submittedAt)}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="border border-ga-line bg-ga-card p-[22px]">
              <GaCap className="mb-3.5 block">Yêu cầu vào lớp</GaCap>
              <div className="font-ga-display text-[32px] font-medium leading-none text-ga-ink">
                {summary.pendingJoinRequests}
              </div>
              <p className="mt-2 text-[12.5px] text-ga-muted">học viên chờ duyệt vào lớp</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
