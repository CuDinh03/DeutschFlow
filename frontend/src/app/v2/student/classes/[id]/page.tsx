'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, MessageSquare, Check } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { apiMessage } from '@/lib/api'
import {
  fetchClassDetail, fetchClassAssignments, fetchClassLessons,
  type ClassroomDetail, type StudentAssignment, type ClassLesson,
} from '@/lib/studentClassesApi'
import { GaPageHdr, GaBtn, GaCap, TkStatStrip } from '@/components/ui-v2'

// ─────────────────────────────────────────────────────────────────────────────
// Chi tiết lớp — học viên (GaClassStudent, proto-classroom.jsx) — DETAIL, yellow.
// Plumbing reused 1:1 (zero backend): fetchClassDetail + fetchClassAssignments +
// fetchClassLessons. Option-1: proto's feed (no announcements EP) / materials
// (no student-facing materials list) / members roster (only studentCount exposed)
// / rank (no leaderboard EP) are DROPPED → backed tabs: Tổng quan · Bài tập · Lộ trình.
// "Nhắn giáo viên" has no messaging backend → toast.
// ─────────────────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'tasks' | 'lessons'
const TABS: [Tab, string][] = [['overview', 'Tổng quan'], ['tasks', 'Bài tập'], ['lessons', 'Lộ trình']]
const fmtDate = (d: string | null | undefined) => (d ? format(new Date(d), 'dd/MM/yyyy') : '—')

// StudentAssignment.status → label + tone (real values: PENDING/SUBMITTED/GRADED/GRADING_FAILED).
function statusMeta(a: StudentAssignment): { label: string; color: string } {
  const s = (a.status ?? '').toUpperCase()
  if (s === 'GRADED') return { label: a.teacherScore != null ? `Đã chấm · ${a.teacherScore}/100` : 'Đã chấm', color: 'var(--ga-green)' }
  if (s === 'GRADING_FAILED') return { label: 'Chấm lỗi · chờ chấm lại', color: 'var(--ga-red)' }
  if (s === 'SUBMITTED' || s === 'GRADING') return { label: 'Đã nộp · chờ chấm', color: '#2F6FC9' }
  return { label: 'Chưa nộp', color: 'var(--ga-orange)' }
}

export default function V2ClassStudentPage() {
  const params = useParams()
  const router = useRouter()
  const classId = Number(params.id)
  const [tab, setTab] = useState<Tab>('overview')
  const [cls, setCls] = useState<ClassroomDetail | null>(null)
  const [tasks, setTasks] = useState<StudentAssignment[]>([])
  const [lessons, setLessons] = useState<ClassLesson[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [d, a, l] = await Promise.all([
        fetchClassDetail(classId),
        fetchClassAssignments(classId).catch(() => [] as StudentAssignment[]),
        fetchClassLessons(classId).catch(() => [] as ClassLesson[]),
      ])
      setCls(d); setTasks(a); setLessons(l); setError('')
    } catch (e: unknown) {
      setError(apiMessage(e))
    } finally {
      setLoading(false)
    }
  }, [classId])

  useEffect(() => { void load() }, [load])

  const lessonPct = cls && cls.lessonTotal > 0 ? Math.round((cls.lessonCompleted / cls.lessonTotal) * 100) : 0
  const doneLessons = useMemo(() => lessons.filter((l) => l.completed).length, [lessons])
  const teacherLine = cls
    ? `Giáo viên: ${cls.teachers[0]?.displayName ?? '—'} · Mã lớp: ${cls.inviteCode} · ${cls.studentCount} thành viên`
    : ''

  if (error) {
    return (
      <div className="flex min-h-full flex-col">
        <GaPageHdr accent title="Chi tiết lớp" right={<GaBtn variant="ghost" size="sm" onClick={() => router.push('/v2/student/classes')}><ArrowLeft size={14} /> Lớp của tôi</GaBtn>} />
        <div className="flex-1 px-10 py-10">
          <div className="border border-ga-line bg-ga-card px-10 py-[52px] text-center">
            <h2 className="font-ga-display text-[24px] font-medium text-ga-red">Không tải được lớp học</h2>
            <p className="ga-ui mx-auto mb-5 mt-3 max-w-sm text-[14px] text-ga-muted">{error}</p>
            <GaBtn variant="primary" onClick={load}>Thử lại</GaBtn>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr
        accent
        title={cls?.name ?? (loading ? 'Đang tải…' : 'Lớp học')}
        subtitle={teacherLine}
        right={
          <div className="flex gap-2.5">
            <GaBtn variant="ghost" size="sm" onClick={() => router.push('/v2/student/classes')}><ArrowLeft size={14} /> Lớp của tôi</GaBtn>
            <GaBtn variant="yellow" size="sm" onClick={() => toast('Nhắn tin với giáo viên (sắp ra mắt)')}><MessageSquare size={14} /> Nhắn giáo viên</GaBtn>
          </div>
        }
      />

      {/* Tab bar */}
      <div className="flex shrink-0 border-b border-ga-line bg-ga-card px-10">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className="ga-ui px-[18px] py-3.5 text-[14px] font-semibold transition-colors"
            style={{ color: tab === id ? 'var(--ga-ink)' : 'var(--ga-muted)', borderBottom: `2px solid ${tab === id ? 'var(--ga-yellow)' : 'transparent'}` }}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto px-10 py-7">
        {loading ? (
          <div className="flex flex-col gap-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="ga-shimmer h-[64px] border border-ga-line" aria-hidden />)}</div>
        ) : tab === 'overview' ? (
          <>
            <TkStatStrip
              items={[
                { label: 'Tiến độ bài học', value: `${lessonPct}%`, sub: `${cls?.lessonCompleted ?? 0}/${cls?.lessonTotal ?? 0} bài`, color: '#1E9E61' },
                { label: 'Bài tập', value: cls?.assignmentCount ?? 0, sub: `${cls?.pendingCount ?? 0} chờ nộp`, color: '#E07B39', alert: (cls?.pendingCount ?? 0) > 0 },
                { label: 'Đã chấm', value: cls?.gradedCount ?? 0, sub: 'bài đã có điểm', color: '#2F6FC9' },
                { label: 'Điểm TB', value: cls?.avgScore != null ? `${Math.round(cls.avgScore)}/100` : '—', sub: 'của bạn trong lớp' },
              ]}
            />
            <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
              <div className="border border-ga-line bg-ga-card p-6">
                <GaCap className="mb-2 block">Bài học hiện tại</GaCap>
                <div className="font-ga-display text-[20px] font-medium text-ga-ink">{cls?.currentLessonTitle || 'Chưa bắt đầu'}</div>
                <div className="mt-3 h-[6px] bg-ga-line"><div className="h-full" style={{ width: `${lessonPct}%`, background: 'var(--ga-yellow)' }} /></div>
                <div className="mt-2 text-[13px] text-ga-muted">{cls?.lessonCompleted ?? 0}/{cls?.lessonTotal ?? 0} bài học đã hoàn thành</div>
              </div>
              <div className="border border-ga-line bg-ga-card p-6">
                <GaCap className="mb-2 block">Giáo viên phụ trách</GaCap>
                {(cls?.teachers ?? []).length === 0 ? (
                  <p className="text-[14px] text-ga-muted">Chưa có giáo viên.</p>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {cls?.teachers.map((t) => (
                      <div key={t.id} className="flex items-center gap-3">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full font-ga-display text-[14px] font-semibold" style={{ color: '#7C56C8', background: 'rgba(124,86,200,0.16)' }}>{(t.displayName?.[0] ?? '?').toUpperCase()}</span>
                        <div className="min-w-0">
                          <div className="truncate text-[14px] font-semibold text-ga-ink">{t.displayName}</div>
                          <div className="truncate text-[12px] text-ga-muted">{t.email}</div>
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
            <div className="border border-dashed border-ga-line px-10 py-[40px] text-center text-[14px] text-ga-muted">Lớp chưa có bài tập nào.</div>
          ) : (
            <div className="flex flex-col gap-3.5">
              {tasks.map((tk) => {
                const sm = statusMeta(tk)
                const submitted = ['SUBMITTED', 'GRADING', 'GRADED'].includes((tk.status ?? '').toUpperCase())
                const graded = (tk.status ?? '').toUpperCase() === 'GRADED'
                return (
                  <div key={tk.id} className="grid grid-cols-[1fr_auto] items-center gap-4 border border-ga-line bg-ga-card px-[22px] py-5">
                    <div className="min-w-0">
                      <div className="mb-1.5 flex items-center gap-2.5">
                        <span className="truncate text-[16px] font-bold text-ga-ink">{tk.topic}</span>
                        {tk.assignmentType && <span className="ga-ui shrink-0 border border-ga-line px-2 py-[3px] text-[10px] font-semibold uppercase tracking-[0.06em] text-ga-muted">{tk.assignmentType}</span>}
                      </div>
                      <div className="flex flex-wrap gap-4 text-[13px] text-ga-muted">
                        <span>Hạn nộp: <strong className="text-ga-ink">{fmtDate(tk.dueDate)}</strong></span>
                        <span className="inline-flex items-center gap-1.5" style={{ color: sm.color }}><span className="h-1.5 w-1.5 rounded-full" style={{ background: sm.color }} /> {sm.label}</span>
                      </div>
                    </div>
                    <GaBtn
                      variant={graded || submitted ? 'ghost' : 'yellow'}
                      size="sm"
                      onClick={() => router.push(`/v2/student/classes/${classId}/assignments/${tk.assignmentId}`)}
                    >
                      {graded ? 'Xem phản hồi' : submitted ? 'Xem bài nộp' : 'Làm bài & nộp →'}
                    </GaBtn>
                  </div>
                )
              })}
            </div>
          )
        ) : (
          // lessons / lộ trình
          lessons.length === 0 ? (
            <div className="border border-dashed border-ga-line px-10 py-[40px] text-center text-[14px] text-ga-muted">Giáo viên chưa thêm bài học nào.</div>
          ) : (
            <>
              <GaCap className="mb-4 block">Lộ trình lớp ({doneLessons}/{lessons.length} đã dạy)</GaCap>
              <div className="border border-ga-line bg-ga-card">
                {lessons.map((l, i) => (
                  <div key={l.id} className="flex items-center gap-3.5 px-5 py-3.5" style={{ borderTop: i ? '1px solid var(--ga-line)' : 'none' }}>
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[12px] font-bold" style={l.completed ? { background: 'var(--ga-green-soft)', color: 'var(--ga-green)' } : { background: 'var(--ga-side-active)', color: 'var(--ga-muted)' }}>
                      {l.completed ? <Check size={14} /> : i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[14.5px] font-semibold text-ga-ink">{l.title}</div>
                      {l.description && <div className="truncate text-[12.5px] text-ga-muted">{l.description}</div>}
                    </div>
                    <span className="shrink-0 text-[12.5px]" style={{ color: l.completed ? 'var(--ga-green)' : 'var(--ga-muted)' }}>
                      {l.completed ? `Đã dạy · ${fmtDate(l.completedAt)}` : 'Chưa dạy'}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )
        )}
      </div>
    </div>
  )
}
