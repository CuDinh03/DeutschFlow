'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { format } from 'date-fns'
import {
  AlertCircle, ArrowLeft, BookOpen, CheckCircle2, Circle, Clock, Copy,
  GraduationCap, Loader2, Sparkles, Upload, Users,
} from 'lucide-react'
import { StudentShell } from '@/components/layouts/StudentShell'
import { useStudentPracticeSession } from '@/hooks/useStudentPracticeSession'
import { usePageTimeTracker } from '@/hooks/usePageTimeTracker'
import { logout } from '@/lib/authSession'
import { apiMessage } from '@/lib/api'
import {
  fetchClassDetail, fetchClassAssignments, fetchClassLessons,
  type ClassroomDetail, type StudentAssignment, type ClassLesson, type TeacherSummary,
} from '@/lib/studentClassesApi'

type Tab = 'assignments' | 'grades' | 'teachers' | 'progress'

export default function ClassDetailClientPage() {
  usePageTimeTracker('class-detail')
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const classId = Number(params?.id)

  const { me: user, loading: userLoading, streakDays, initials, targetLevel } =
    useStudentPracticeSession({ requireStudent: true })

  const [detail, setDetail] = useState<ClassroomDetail | null>(null)
  const [assignments, setAssignments] = useState<StudentAssignment[]>([])
  const [lessons, setLessons] = useState<ClassLesson[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('assignments')

  const load = useCallback(async () => {
    if (!classId || Number.isNaN(classId)) return
    setError(null)
    try {
      const [d, a, l] = await Promise.all([
        fetchClassDetail(classId),
        fetchClassAssignments(classId),
        fetchClassLessons(classId),
      ])
      setDetail(d)
      setAssignments(a)
      setLessons(l)
    } catch (e) {
      setError(apiMessage(e))
    } finally {
      setLoading(false)
    }
  }, [classId])

  useEffect(() => {
    if (!user) return
    void load()
  }, [user, load])

  if (!user || userLoading || (!detail && loading && !error)) {
    return (
      <StudentShell
        activeSection="classes"
        user={user ? { displayName: user.displayName, role: user.role } : { displayName: '', role: '' }}
        targetLevel={targetLevel}
        streakDays={streakDays}
        initials={initials}
        onLogout={() => { void logout() }}
        headerTitle="Đang tải lớp…"
      >
        <div className="flex items-center justify-center py-20 text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </StudentShell>
    )
  }

  if (error || !detail) {
    return (
      <StudentShell
        activeSection="classes"
        user={{ displayName: user.displayName, role: user.role }}
        targetLevel={targetLevel}
        streakDays={streakDays}
        initials={initials}
        onLogout={() => { void logout() }}
        headerTitle="Không mở được lớp"
      >
        <div className="mx-auto max-w-2xl rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
          <div className="font-semibold mb-1">Không tải được thông tin lớp</div>
          <p className="text-sm">{error ?? 'Không tìm thấy lớp.'}</p>
          <button
            onClick={() => router.push('/student/classes')}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
          >
            <ArrowLeft size={14} /> Quay lại
          </button>
        </div>
      </StudentShell>
    )
  }

  return (
    <StudentShell
      activeSection="classes"
      user={{ displayName: user.displayName, role: user.role }}
      targetLevel={targetLevel}
      streakDays={streakDays}
      initials={initials}
      onLogout={() => { void logout() }}
      headerTitle={detail.name}
      headerSubtitle={`${detail.studentCount} học viên · ${detail.assignmentCount} bài tập`}
    >
      <div className="mx-auto max-w-5xl space-y-5">
        <button
          onClick={() => router.push('/student/classes')}
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft size={14} /> Tất cả lớp
        </button>

        <ClassHeaderCard detail={detail} />
        <ProgressStrip detail={detail} />

        <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
          <div className="flex border-b border-slate-200 overflow-x-auto">
            <TabBtn label="Bài tập" active={tab === 'assignments'} onClick={() => setTab('assignments')} />
            <TabBtn label="Điểm" active={tab === 'grades'} onClick={() => setTab('grades')} />
            <TabBtn label="Giáo viên" active={tab === 'teachers'} onClick={() => setTab('teachers')} />
            <TabBtn label="Tiến độ" active={tab === 'progress'} onClick={() => setTab('progress')} />
          </div>

          <div className="p-5">
            {tab === 'assignments' && <AssignmentsTab assignments={assignments} />}
            {tab === 'grades' && <GradesTab assignments={assignments} />}
            {tab === 'teachers' && <TeachersTab teachers={detail.teachers} />}
            {tab === 'progress' && <ProgressTab detail={detail} lessons={lessons} />}
          </div>
        </div>
      </div>
    </StudentShell>
  )
}

function TabBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-5 py-3 text-sm font-semibold whitespace-nowrap border-b-2 transition ${
        active
          ? 'border-indigo-600 text-indigo-700'
          : 'border-transparent text-slate-500 hover:text-slate-700'
      }`}
    >
      {label}
    </button>
  )
}

function ClassHeaderCard({ detail }: { detail: ClassroomDetail }) {
  const [copied, setCopied] = useState(false)
  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(detail.inviteCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard may be unavailable; silently no-op */
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-slate-800">{detail.name}</h2>
          <p className="mt-1 text-sm text-slate-500">
            Dạy bởi: {detail.teachers.length === 0
              ? 'Chưa có giáo viên'
              : detail.teachers.map((t) => t.displayName).join(', ')}
          </p>
        </div>
        <button
          type="button"
          onClick={copyInvite}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-mono font-semibold text-slate-700 hover:bg-slate-100"
          title="Copy mã mời"
        >
          <Copy size={12} />
          {detail.inviteCode}
          {copied && <span className="ml-1 text-emerald-600">✓</span>}
        </button>
      </div>
    </div>
  )
}

function ProgressStrip({ detail }: { detail: ClassroomDetail }) {
  const lessonPercent = detail.lessonTotal > 0
    ? Math.round((detail.lessonCompleted / detail.lessonTotal) * 100)
    : 0
  const assignPercent = detail.assignmentCount > 0
    ? Math.round((detail.gradedCount / detail.assignmentCount) * 100)
    : 0

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <StatCard
        label="Tiến độ lớp"
        value={detail.lessonTotal > 0 ? `${detail.lessonCompleted}/${detail.lessonTotal}` : '–'}
        sub={detail.currentLessonTitle ?? 'Chưa có buổi học nào'}
        percent={lessonPercent}
        tone="indigo"
      />
      <StatCard
        label="Bài tập của bạn"
        value={detail.assignmentCount > 0 ? `${detail.gradedCount}/${detail.assignmentCount}` : '–'}
        sub={`Đã chấm · ${detail.pendingCount} chưa nộp`}
        percent={assignPercent}
        tone="emerald"
      />
      <StatCard
        label="Điểm trung bình"
        value={detail.avgScore != null ? detail.avgScore.toFixed(1) : '–'}
        sub={detail.avgScore != null ? 'Trên các bài đã chấm' : 'Chưa có điểm'}
        tone="amber"
      />
    </div>
  )
}

function StatCard({
  label, value, sub, percent, tone,
}: {
  label: string; value: string; sub: string; percent?: number;
  tone: 'indigo' | 'emerald' | 'amber'
}) {
  const tones: Record<string, string> = {
    indigo: 'from-indigo-400 to-indigo-600',
    emerald: 'from-emerald-400 to-emerald-600',
    amber: 'from-amber-400 to-amber-600',
  }
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums text-slate-800">{value}</div>
      <div className="text-xs text-slate-500 mt-0.5 line-clamp-1">{sub}</div>
      {typeof percent === 'number' && (
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div className={`h-full rounded-full bg-gradient-to-r ${tones[tone]}`} style={{ width: `${percent}%` }} />
        </div>
      )}
    </div>
  )
}

function AssignmentsTab({ assignments }: { assignments: StudentAssignment[] }) {
  const router = useRouter()
  if (assignments.length === 0) {
    return <EmptyHint icon={BookOpen} text="Chưa có bài tập nào trong lớp này." />
  }
  return (
    <div className="space-y-3">
      {assignments.map((a) => (
        <button
          key={a.id}
          onClick={() => router.push(`/student/assignments/${a.assignmentId}`)}
          className="w-full text-left rounded-xl border border-slate-200 bg-white px-4 py-3 transition hover:border-indigo-300 hover:bg-indigo-50/40"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="font-semibold text-slate-800">{a.topic || 'Bài tập'}</h4>
                <TypeBadge type={a.assignmentType} />
              </div>
              {a.dueDate && (
                <div className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                  <Clock size={11} />
                  Hạn: {format(new Date(a.dueDate), 'dd/MM/yyyy HH:mm')}
                </div>
              )}
            </div>
            <StatusBadge status={a.status} score={a.teacherScore} />
          </div>
        </button>
      ))}
    </div>
  )
}

function GradesTab({ assignments }: { assignments: StudentAssignment[] }) {
  const graded = useMemo(
    () => assignments.filter((a) => a.status === 'GRADED' || a.status === 'EVALUATED'),
    [assignments],
  )
  if (graded.length === 0) {
    return <EmptyHint icon={Sparkles} text="Chưa có bài nào được chấm." />
  }
  const avg = graded
    .filter((g) => g.teacherScore != null)
    .reduce((acc, g, _i, arr) => acc + (g.teacherScore ?? 0) / arr.length, 0)
  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700">
        Điểm trung bình {avg.toFixed(1)}/100 trên {graded.length} bài đã chấm.
      </div>
      {graded.map((a) => (
        <div key={a.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h4 className="font-semibold text-slate-800">{a.topic || 'Bài tập'}</h4>
              {a.submittedAt && (
                <div className="text-xs text-slate-500 mt-0.5">
                  Nộp: {format(new Date(a.submittedAt), 'dd/MM HH:mm')}
                </div>
              )}
            </div>
            <ScoreChip score={a.teacherScore} />
          </div>
          {a.teacherFeedback && (
            <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-400 block mb-1">
                Nhận xét của giáo viên
              </span>
              {a.teacherFeedback}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function TeachersTab({ teachers }: { teachers: TeacherSummary[] }) {
  if (teachers.length === 0) {
    return <EmptyHint icon={Users} text="Lớp này chưa có giáo viên." />
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {teachers.map((t) => (
        <div key={t.id} className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-indigo-100 to-rose-100 text-base font-bold text-indigo-700">
              {t.displayName
                .split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || '?'}
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-slate-800 truncate">{t.displayName}</div>
              <div className="text-xs text-slate-500 truncate">{t.email}</div>
              <div className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">
                <GraduationCap size={10} /> {t.role}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function ProgressTab({ detail, lessons }: { detail: ClassroomDetail; lessons: ClassLesson[] }) {
  if (lessons.length === 0) {
    return (
      <EmptyHint
        icon={BookOpen}
        text="Giáo viên chưa tạo checklist buổi học. Tiến độ lớp sẽ hiển thị tại đây khi có."
      />
    )
  }
  return (
    <div className="space-y-3">
      {detail.currentLessonTitle && (
        <div className="rounded-xl bg-indigo-50 border border-indigo-200 px-4 py-3">
          <div className="text-xs font-bold uppercase tracking-wide text-indigo-700">
            Buổi hiện tại của lớp
          </div>
          <div className="mt-0.5 font-semibold text-slate-800">{detail.currentLessonTitle}</div>
        </div>
      )}
      <ol className="space-y-2">
        {lessons.map((l, idx) => (
          <li
            key={l.id}
            className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${
              l.completed
                ? 'border-emerald-200 bg-emerald-50/50'
                : 'border-slate-200 bg-white'
            }`}
          >
            <div className="mt-0.5">
              {l.completed
                ? <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                : <Circle className="h-5 w-5 text-slate-300" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 tabular-nums">
                  Buổi {idx + 1}
                </span>
                <h4 className={`font-semibold ${l.completed ? 'text-slate-700' : 'text-slate-800'}`}>
                  {l.title}
                </h4>
              </div>
              {l.description && (
                <p className="mt-1 text-sm text-slate-500">{l.description}</p>
              )}
              {l.completed && l.completedAt && (
                <p className="mt-1 text-xs text-emerald-700">
                  Đã hoàn thành {format(new Date(l.completedAt), 'dd/MM HH:mm')}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

function StatusBadge({ status, score }: { status: string; score: number | null }) {
  if (status === 'GRADED' || status === 'EVALUATED') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
        <CheckCircle2 size={12} /> Đã chấm {score != null ? `· ${score}` : ''}
      </span>
    )
  }
  if (status === 'SUBMITTED') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
        <Upload size={12} /> Đã nộp
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
      <AlertCircle size={12} /> Chưa nộp
    </span>
  )
}

function TypeBadge({ type }: { type: string }) {
  const label = type === 'SPEAKING_SCENARIO' ? 'Nói'
    : type === 'VOCABULARY' ? 'Từ vựng'
    : type === 'ESSAY' ? 'Viết'
    : type === 'MOCK_TEST' ? 'Thi thử'
    : 'Bài tập'
  return (
    <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
      {label}
    </span>
  )
}

function ScoreChip({ score }: { score: number | null }) {
  if (score == null) return null
  // Scores are on a 0–100 scale (same as the teacher grading panel), not 0–10.
  const tone = score >= 80 ? 'bg-emerald-100 text-emerald-700'
    : score >= 50 ? 'bg-amber-100 text-amber-700'
    : 'bg-red-100 text-red-700'
  return (
    <span className={`inline-flex items-center rounded-full ${tone} px-3 py-1 text-sm font-bold tabular-nums`}>
      {score}/100
    </span>
  )
}

function EmptyHint({ icon: Icon, text }: { icon: typeof BookOpen; text: string }) {
  return (
    <div className="py-10 text-center text-slate-500">
      <Icon className="mx-auto mb-2 h-8 w-8 text-slate-300" />
      <p className="text-sm">{text}</p>
    </div>
  )
}
