'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import api, { httpStatus } from '@/lib/api'
import { logout } from '@/lib/authSession'
import { TeacherShell } from '@/components/layouts/TeacherShell'
import { usePendingGradingCount } from '@/hooks/usePendingGradingCount'
import {
  BarChart2, Users, FileText, GraduationCap, TrendingUp, Award, Loader2,
  Printer, BookOpenCheck, ClipboardList, UserCheck, Star, ChevronDown, ChevronUp,
  Plus, Save, Trash2, CalendarDays, Edit2, X, CheckCircle2
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

// ── Types ─────────────────────────────────────────────────────────────────────

interface GradebookCell { status: string; score: number | null; submittedAt: string | null }
interface GradebookAssignment { id: number; topic: string; assignmentType: string; skill: string | null; dueDate: string | null }
interface GradebookStudent { studentId: number; name: string; email: string; avgScore: number | null; cells: Record<string, GradebookCell> }
interface Gradebook { classId: number; className: string; assignments: GradebookAssignment[]; students: GradebookStudent[] }

interface SkillRow { studentId: number; name: string; email: string; horen: number | null; lesen: number | null; schreiben: number | null; sprechen: number | null; total: number | null; grade: string }
interface SkillReport { classId: number; className: string; students: SkillRow[] }

interface AttendanceEntry { studentId: number; name: string; email: string; status: string; note: string | null }
interface LessonLog { id: number; classId: number; sessionDate: string; sessionNumber: number | null; topic: string | null; homework: string | null; note: string | null; createdAt: string; attendance: AttendanceEntry[] }

interface StudentEval {
  studentId: number; name: string; email: string; classId: number; className: string
  teacherComment: string | null
  skillHoren: number | null; skillLesen: number | null; skillSchreiben: number | null; skillSprechen: number | null
  avgScore: number; totalSessions: number; presentCount: number; absentCount: number; lateCount: number
  certificateEligible: boolean; evaluatedAt: string | null
}

type PrintScope = 'overview' | 'gradebook' | 'skill-report' | 'lesson-log' | 'attendance' | 'evaluation' | null

// ── Helpers ───────────────────────────────────────────────────────────────────

const SKILL_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  HOREN:      { label: 'Nghe (Hören)',      color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200' },
  LESEN:      { label: 'Đọc (Lesen)',       color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  SCHREIBEN:  { label: 'Viết (Schreiben)',  color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
  SPRECHEN:   { label: 'Nói (Sprechen)',    color: 'text-amber-700',  bg: 'bg-amber-50 border-amber-200' },
  GENERAL:    { label: 'Chung',             color: 'text-slate-500',  bg: 'bg-slate-50 border-slate-200' },
}

function scoreBadge(score: number | null, size = 'sm') {
  if (score == null) return <span className="text-slate-300 text-xs">—</span>
  const tone = score >= 8 ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : score >= 5 ? 'bg-amber-50 text-amber-700 border-amber-200'
    : 'bg-rose-50 text-rose-700 border-rose-200'
  return (
    <span className={`inline-flex min-w-[2rem] justify-center px-1.5 py-0.5 rounded-lg border font-bold ${size === 'lg' ? 'text-sm' : 'text-xs'} ${tone}`}>
      {typeof score === 'number' ? score.toFixed(1) : score}
    </span>
  )
}

function gradeBadge(grade: string) {
  const map: Record<string, string> = {
    'Xuất sắc': 'bg-emerald-100 text-emerald-800 border-emerald-300',
    'Giỏi': 'bg-blue-100 text-blue-800 border-blue-300',
    'Khá': 'bg-indigo-100 text-indigo-800 border-indigo-300',
    'Trung bình': 'bg-amber-100 text-amber-800 border-amber-300',
    'Yếu': 'bg-rose-100 text-rose-800 border-rose-300',
  }
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-lg border text-xs font-bold ${map[grade] ?? 'bg-slate-50 text-slate-500 border-slate-200'}`}>
      {grade}
    </span>
  )
}

function cellBadge(cell: GradebookCell | undefined) {
  if (!cell) return <span className="text-slate-300 text-xs">·</span>
  if (cell.score != null) return scoreBadge(cell.score)
  if (cell.status === 'SUBMITTED') return <span className="inline-flex px-2 py-0.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-600 text-[11px] font-semibold">Chờ chấm</span>
  return <span className="text-slate-400 text-xs font-medium">Chưa nộp</span>
}


function SkillBar({ value, color }: { value: number | null; color: string }) {
  if (value == null) return <span className="text-slate-300 text-xs">—</span>
  const pct = Math.min((value / 10) * 100, 100)
  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden print-bar-fill">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-bold text-slate-700 w-8 text-right">{value.toFixed(1)}</span>
    </div>
  )
}

// ── Print header (shared by all scopes) ───────────────────────────────────────

function PrintHeader({ title, subtitle, userName, className }: { title: string; subtitle?: string; userName: string; className?: string }) {
  const now = new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
  return (
    <div className="flex items-start justify-between pb-3 mb-4 border-b-2 border-slate-800">
      <div>
        <p className="text-[10px] font-bold tracking-widest text-slate-500 uppercase">DeutschFlow</p>
        <h1 className="text-lg font-black text-slate-900 mt-0.5">{title}</h1>
        {subtitle && <p className="text-xs text-slate-600 mt-0.5">{subtitle}</p>}
        {className && <p className="text-xs font-semibold text-slate-700 mt-0.5">Lớp: {className}</p>}
      </div>
      <div className="text-right text-[10px] text-slate-500 mt-1">
        <p>Giáo viên: <strong>{userName}</strong></p>
        <p>Ngày xuất: {now}</p>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function TeacherReportsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [overview, setOverview] = useState<any>(null)
  const [classes, setClasses] = useState<any[]>([])
  const [userName, setUserName] = useState('Giáo viên')
  const { count: pendingGradingCount } = usePendingGradingCount()

  // Class selection
  const [selectedClassId, setSelectedClassId] = useState('')
  const [classReport, setClassReport] = useState<any>(null)
  const [classReportLoading, setClassReportLoading] = useState(false)

  // Gradebook (Pha 0)
  const [gradebook, setGradebook] = useState<Gradebook | null>(null)

  // Skill report (Pha 1)
  const [skillReport, setSkillReport] = useState<SkillReport | null>(null)

  // Lesson logs + attendance (Pha 2)
  const [lessonLogs, setLessonLogs] = useState<LessonLog[]>([])
  const [showLogForm, setShowLogForm] = useState(false)
  const [editingLog, setEditingLog] = useState<LessonLog | null>(null)
  const [logFormLoading, setLogFormLoading] = useState(false)

  // Student evaluations (Pha 3)
  const [evaluations, setEvaluations] = useState<StudentEval[]>([])
  const [editingEval, setEditingEval] = useState<StudentEval | null>(null)
  const [evalFormLoading, setEvalFormLoading] = useState(false)

  // Expanded lesson log rows
  const [expandedLogs, setExpandedLogs] = useState<Set<number>>(new Set())

  // Active tab
  const [activeTab, setActiveTab] = useState<'gradebook' | 'skills' | 'attendance' | 'evaluation'>('gradebook')

  // Print scope
  const [printScope, setPrintScope] = useState<PrintScope>(null)

  // CRUD error feedback
  const [crudError, setCrudError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const me = await api.get('/auth/me')
      if (me.data.role !== 'TEACHER') { router.push(`/${String(me.data.role).toLowerCase()}`); return }
      setUserName(me.data.name ?? me.data.email?.split('@')[0] ?? 'Giáo viên')
      const [overviewRes, classesRes] = await Promise.all([
        api.get('/v2/teacher/reports/overview'),
        api.get('/v2/teacher/classes').catch(() => ({ data: [] })),
      ])
      setOverview(overviewRes.data)
      setClasses(classesRes.data)
    } catch (e: unknown) {
      if (httpStatus(e) === 401) { router.push('/login'); return }
      setError('Không thể tải báo cáo. Vui lòng thử lại sau.')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { load() }, [load])

  // Print trigger
  useEffect(() => {
    if (!printScope) return
    const timer = setTimeout(() => {
      window.print()
      const afterPrint = () => { setPrintScope(null); window.removeEventListener('afterprint', afterPrint) }
      window.addEventListener('afterprint', afterPrint)
      // fallback reset
      setTimeout(() => setPrintScope(null), 4000)
    }, 80)
    return () => clearTimeout(timer)
  }, [printScope])

  const fetchClassData = async (classId: string) => {
    if (!classId) { setClassReport(null); setGradebook(null); setSkillReport(null); setLessonLogs([]); setEvaluations([]); return }
    setClassReportLoading(true)
    try {
      const [reportRes, gradebookRes, skillRes, logsRes, evalRes] = await Promise.all([
        api.get(`/v2/teacher/reports/classes/${classId}`),
        api.get(`/v2/teacher/reports/classes/${classId}/gradebook`).catch(() => null),
        api.get(`/v2/teacher/reports/classes/${classId}/skill-report`).catch(() => null),
        api.get(`/v2/teacher/classes/${classId}/lesson-logs`).catch(() => ({ data: [] })),
        api.get(`/v2/teacher/classes/${classId}/evaluations`).catch(() => ({ data: [] })),
      ])
      setClassReport(reportRes.data)
      setGradebook(gradebookRes?.data ?? null)
      setSkillReport(skillRes?.data ?? null)
      setLessonLogs(logsRes.data ?? [])
      setEvaluations(evalRes.data ?? [])
    } catch { setClassReport(null) }
    finally { setClassReportLoading(false) }
  }

  const handleClassChange = (id: string) => { setSelectedClassId(id); fetchClassData(id) }

  // ── Lesson log CRUD ───────────────────────────────────────────────────────

  const handleSaveLog = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!selectedClassId) return
    const fd = new FormData(e.currentTarget)
    const classStudents = gradebook?.students ?? []
    const attendance = classStudents.map(s => ({
      studentId: s.studentId,
      status: (fd.get(`att_${s.studentId}`) as string) ?? 'PRESENT',
      note: null,
    }))
    const payload = {
      sessionDate: fd.get('sessionDate'),
      sessionNumber: fd.get('sessionNumber') ? Number(fd.get('sessionNumber')) : null,
      topic: fd.get('topic') || null,
      homework: fd.get('homework') || null,
      note: fd.get('note') || null,
      attendance,
    }
    setLogFormLoading(true)
    setCrudError('')
    try {
      if (editingLog) {
        const res = await api.put(`/v2/teacher/classes/${selectedClassId}/lesson-logs/${editingLog.id}`, payload)
        setLessonLogs(prev => prev.map(l => l.id === editingLog.id ? res.data : l))
      } else {
        const res = await api.post(`/v2/teacher/classes/${selectedClassId}/lesson-logs`, payload)
        setLessonLogs(prev => [...prev, res.data])
      }
      setShowLogForm(false)
      setEditingLog(null)
    } catch {
      setCrudError('Lưu buổi học thất bại. Vui lòng thử lại.')
    } finally { setLogFormLoading(false) }
  }

  const handleDeleteLog = async (logId: number) => {
    if (!confirm('Xoá buổi học này?')) return
    setCrudError('')
    try {
      await api.delete(`/v2/teacher/classes/${selectedClassId}/lesson-logs/${logId}`)
      setLessonLogs(prev => prev.filter(l => l.id !== logId))
    } catch {
      setCrudError('Xoá buổi học thất bại. Vui lòng thử lại.')
    }
  }

  // ── Student evaluation CRUD ───────────────────────────────────────────────

  const handleSaveEval = async (e: React.FormEvent<HTMLFormElement>) => {
    if (!editingEval) return
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const parseScore = (key: string) => { const v = fd.get(key); return v ? parseFloat(v as string) : null }
    const payload = {
      teacherComment: fd.get('teacherComment') || null,
      skillHoren: parseScore('skillHoren'),
      skillLesen: parseScore('skillLesen'),
      skillSchreiben: parseScore('skillSchreiben'),
      skillSprechen: parseScore('skillSprechen'),
    }
    setEvalFormLoading(true)
    setCrudError('')
    try {
      const res = await api.put(`/v2/teacher/classes/${selectedClassId}/evaluations/${editingEval.studentId}`, payload)
      setEvaluations(prev => prev.map(ev => ev.studentId === editingEval.studentId ? res.data : ev))
      setEditingEval(null)
    } catch {
      setCrudError('Lưu đánh giá thất bại. Vui lòng thử lại.')
    } finally { setEvalFormLoading(false) }
  }

  // ── Loading / error states ────────────────────────────────────────────────

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-4">
        <Loader2 size={32} className="animate-spin text-indigo-600" />
        <p className="font-medium text-slate-500">Đang tổng hợp báo cáo...</p>
      </div>
    </div>
  )

  const selectedClass = classes.find((c: any) => String(c.id) === selectedClassId)

  return (
    <TeacherShell
      activeMenu="reports"
      userName={userName}
      pendingGradingCount={pendingGradingCount}
      onLogout={() => void logout()}
      headerTitle="Báo cáo & Thống kê"
      headerSubtitle="Theo dõi hiệu suất và tiến độ của học viên"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8 no-print">

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-600 px-4 py-3 rounded-xl text-sm font-medium">
            {error}
          </div>
        )}

        {!overview ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 flex flex-col items-center text-center">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
              <BarChart2 size={32} className="text-slate-400" />
            </div>
            <h3 className="text-lg font-bold text-slate-700">Chưa có dữ liệu báo cáo</h3>
            <p className="text-slate-500 mt-2 max-w-sm">Dữ liệu sẽ xuất hiện khi có học viên tham gia và hoàn thành các bài tập.</p>
          </div>
        ) : (
          <>
            {/* Toolbar */}
            <div className="flex items-center justify-between bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-3.5">
              <div className="flex items-center gap-2 text-slate-600">
                <BarChart2 size={18} className="text-indigo-600" />
                <span className="font-semibold text-sm">Báo cáo tổng hợp</span>
                <span className="text-slate-400 text-xs">· Cập nhật theo thời gian thực</span>
              </div>
              <button
                onClick={() => setPrintScope('overview')}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 transition-colors text-sm font-bold shadow-sm"
              >
                <Printer size={15} /> Xuất PDF tổng quan
              </button>
            </div>

            {/* KPI cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { label: 'Tổng Lớp Học',  value: overview.classCount,      icon: Users,         circleBg: 'bg-blue-50',   iconBg: 'bg-blue-100',   iconText: 'text-blue-600' },
                { label: 'Tổng Bài Tập',  value: overview.assignmentCount, icon: FileText,       circleBg: 'bg-purple-50', iconBg: 'bg-purple-100', iconText: 'text-purple-600' },
                { label: 'Tổng Học Viên', value: overview.studentCount,    icon: GraduationCap,  circleBg: 'bg-amber-50',  iconBg: 'bg-amber-100',  iconText: 'text-amber-600' },
              ].map(({ label, value, icon: Icon, circleBg, iconBg, iconText }) => (
                <div key={label} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                  <div className={`absolute right-0 top-0 -mt-4 -mr-4 w-24 h-24 ${circleBg} rounded-full opacity-50 group-hover:scale-110 transition-transform`} />
                  <div className="relative z-10 flex items-start justify-between">
                    <div>
                      <p className="text-slate-500 text-sm font-bold uppercase tracking-wider mb-1">{label}</p>
                      <p className="text-4xl font-black text-slate-800">{value}</p>
                    </div>
                    <div className={`w-12 h-12 ${iconBg} ${iconText} rounded-xl flex items-center justify-center shadow-inner`}>
                      <Icon size={24} />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Avg score card */}
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl p-8 shadow-xl text-white relative overflow-hidden">
              <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-1/4 translate-y-1/4">
                <TrendingUp size={300} />
              </div>
              <div className="relative z-10 grid md:grid-cols-2 gap-8 items-center">
                <div>
                  <div className="flex items-center gap-2 text-indigo-300 font-bold tracking-wider text-sm uppercase mb-2">
                    <Award size={18} /> Hiệu suất tổng thể
                  </div>
                  <h2 className="text-3xl font-black mb-4">Điểm trung bình toàn hệ thống</h2>
                  <p className="text-slate-400 max-w-md leading-relaxed text-sm">
                    Trung bình tất cả bài tập đã chấm (Trắc nghiệm, Ghép câu, Luyện nói AI). Thang điểm 10.
                  </p>
                </div>
                <div className="flex justify-center md:justify-end">
                  <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-3xl p-8 text-center min-w-[200px]">
                    <p className="text-6xl font-black bg-gradient-to-tr from-emerald-400 to-teal-300 text-transparent bg-clip-text drop-shadow-sm mb-2">
                      {Number(overview.avgScore ?? 0).toFixed(1)}
                    </p>
                    <p className="text-indigo-200 font-bold uppercase tracking-widest text-sm">Trên 10 Điểm</p>
                    <div className="mt-4 h-2 w-full bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-emerald-400 to-teal-400 rounded-full" style={{ width: `${(Number(overview.avgScore ?? 0) / 10) * 100}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Charts */}
            {classes.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {[
                  { title: 'Phân bố học viên theo lớp', key: 'studentCount', name: 'Số học viên', fill: '#6366F1', icon: Users },
                  { title: 'Số lượng bài tập theo lớp', key: 'quizCount', name: 'Số bài tập', fill: '#A855F7', icon: FileText },
                ].map(({ title, key, name, fill, icon: Icon }) => (
                  <div key={key} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                    <h3 className="text-base font-bold text-slate-800 mb-5 flex items-center gap-2">
                      <Icon size={18} className="text-indigo-600" /> {title}
                    </h3>
                    <div className="h-72 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={classes} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 11 }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 11 }} />
                          <Tooltip cursor={{ fill: '#F1F5F9' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                          <Legend wrapperStyle={{ paddingTop: '16px', fontSize: 12 }} />
                          <Bar dataKey={key} name={name} fill={fill} radius={[6, 6, 0, 0]} maxBarSize={48} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Class drill-down ─────────────────────────────────────────────── */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-center gap-3 mb-4">
                <Users size={18} className="text-indigo-600" />
                <span className="font-bold text-slate-800">Báo cáo chi tiết theo lớp</span>
              </div>
              <select
                value={selectedClassId}
                onChange={e => handleClassChange(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-sm bg-white text-slate-700 font-medium"
              >
                <option value="">-- Chọn một lớp học --</option>
                {classes.map((cls: any) => <option key={cls.id} value={cls.id}>{cls.name}</option>)}
              </select>

              {classReportLoading && (
                <div className="mt-4 flex items-center gap-2 text-slate-500 text-sm">
                  <Loader2 size={16} className="animate-spin" /> Đang tải...
                </div>
              )}

              {classReport && !classReportLoading && (
                <>
                  {/* KPI row */}
                  <div className="mt-4 grid grid-cols-3 gap-4 animate-in fade-in duration-300">
                    {[
                      { label: 'Học viên',        value: classReport.studentCount ?? 0,                     cardCls: 'bg-indigo-50 border-indigo-100', textCls: 'text-indigo-600' },
                      { label: 'Bài tập đã giao', value: classReport.assignmentCount ?? 0,                  cardCls: 'bg-purple-50 border-purple-100', textCls: 'text-purple-600' },
                      { label: 'Điểm TB',         value: Number(classReport.avgScore ?? 0).toFixed(1),      cardCls: 'bg-amber-50 border-amber-100',   textCls: 'text-amber-600' },
                    ].map(({ label, value, cardCls, textCls }) => (
                      <div key={label} className={`${cardCls} rounded-2xl p-4 text-center border`}>
                        <p className={`text-3xl font-black ${textCls}`}>{value}</p>
                        <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mt-1">{label}</p>
                      </div>
                    ))}
                  </div>

                  {crudError && (
                    <div className="mt-4 px-4 py-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-sm font-medium flex items-center justify-between">
                      {crudError}
                      <button onClick={() => setCrudError('')} className="ml-3 text-rose-400 hover:text-rose-600">×</button>
                    </div>
                  )}

                  {/* Tab nav */}
                  <div className="mt-6 flex gap-1 border-b border-slate-200 overflow-x-auto">
                    {([
                      { id: 'gradebook', label: 'Sổ điểm', icon: BookOpenCheck },
                      { id: 'skills',   label: 'Điểm 4 kỹ năng', icon: Star },
                      { id: 'attendance', label: 'Nhật ký & Điểm danh', icon: CalendarDays },
                      { id: 'evaluation', label: 'Phiếu đánh giá', icon: UserCheck },
                    ] as const).map(({ id, label, icon: Icon }) => (
                      <button
                        key={id}
                        onClick={() => setActiveTab(id)}
                        className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${activeTab === id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                      >
                        <Icon size={15} /> {label}
                      </button>
                    ))}
                  </div>

                  {/* ─── Tab: Sổ điểm ─────────────────────────────────────── */}
                  {activeTab === 'gradebook' && gradebook && (
                    <div className="mt-5 animate-in fade-in duration-300">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-bold text-slate-700">
                          {gradebook.students.length} học viên · {gradebook.assignments.length} bài tập
                        </span>
                        {gradebook.students.length > 0 && gradebook.assignments.length > 0 && (
                          <button onClick={() => setPrintScope('gradebook')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 text-xs font-bold">
                            <Printer size={13} /> Xuất PDF sổ điểm
                          </button>
                        )}
                      </div>
                      {gradebook.students.length === 0 || gradebook.assignments.length === 0 ? (
                        <p className="text-slate-500 text-sm text-center py-6 border border-dashed border-slate-200 rounded-xl">
                          {gradebook.students.length === 0 ? 'Lớp chưa có học viên.' : 'Lớp chưa được giao bài tập nào.'}
                        </p>
                      ) : (
                        <div className="overflow-x-auto rounded-xl border border-slate-200">
                          <table className="w-full text-sm border-collapse">
                            <thead>
                              <tr className="bg-slate-50 text-left">
                                <th className="sticky left-0 bg-slate-50 px-4 py-3 font-bold text-slate-600 text-xs uppercase tracking-wider whitespace-nowrap border-b border-slate-200 z-10">Học viên</th>
                                {gradebook.assignments.map(a => {
                                  const sk = SKILL_LABELS[a.skill?.toUpperCase() ?? 'GENERAL']
                                  return (
                                    <th key={a.id} className="px-3 py-3 font-semibold text-slate-500 text-xs whitespace-nowrap border-b border-slate-200 text-center" title={a.topic}>
                                      <div>{a.topic.length > 18 ? a.topic.slice(0, 16) + '…' : a.topic}</div>
                                      {a.skill && a.skill !== 'GENERAL' && (
                                        <span className={`inline-block mt-0.5 px-1.5 py-px rounded text-[9px] font-bold border ${sk.bg} ${sk.color}`}>{sk.label.split(' ')[0]}</span>
                                      )}
                                    </th>
                                  )
                                })}
                                <th className="px-4 py-3 font-bold text-slate-600 text-xs uppercase tracking-wider whitespace-nowrap border-b border-slate-200 text-center">Điểm TB</th>
                              </tr>
                            </thead>
                            <tbody>
                              {gradebook.students.map((s, idx) => (
                                <tr key={s.studentId} className={idx % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'}>
                                  <td className="sticky left-0 px-4 py-2.5 whitespace-nowrap border-b border-slate-100 z-10 bg-inherit">
                                    <p className="font-semibold text-slate-700">{s.name}</p>
                                    <p className="text-slate-400 text-xs">{s.email}</p>
                                  </td>
                                  {gradebook.assignments.map(a => (
                                    <td key={a.id} className="px-3 py-2.5 text-center border-b border-slate-100">
                                      {cellBadge(s.cells[String(a.id)])}
                                    </td>
                                  ))}
                                  <td className="px-4 py-2.5 text-center border-b border-slate-100">
                                    {scoreBadge(s.avgScore, 'lg')}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ─── Tab: Điểm 4 kỹ năng ──────────────────────────────── */}
                  {activeTab === 'skills' && (
                    <div className="mt-5 animate-in fade-in duration-300">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm text-slate-500">
                          Điểm được lấy từ phiếu đánh giá giáo viên. Nếu chưa có, tính trung bình từ bài tập có gắn kỹ năng.
                        </span>
                        {skillReport && skillReport.students.length > 0 && (
                          <button onClick={() => setPrintScope('skill-report')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 text-xs font-bold">
                            <Printer size={13} /> Xuất PDF bảng điểm
                          </button>
                        )}
                      </div>
                      {!skillReport || skillReport.students.length === 0 ? (
                        <p className="text-slate-500 text-sm text-center py-6 border border-dashed border-slate-200 rounded-xl">
                          Chưa có điểm 4 kỹ năng. Nhập phiếu đánh giá hoặc giao bài có gắn kỹ năng.
                        </p>
                      ) : (
                        <div className="overflow-x-auto rounded-xl border border-slate-200">
                          <table className="w-full text-sm border-collapse">
                            <thead>
                              <tr className="bg-slate-50 text-left">
                                <th className="sticky left-0 bg-slate-50 px-4 py-3 font-bold text-slate-600 text-xs uppercase border-b border-slate-200 z-10 whitespace-nowrap">Học viên</th>
                                {(['horen','lesen','schreiben','sprechen'] as const).map(k => (
                                  <th key={k} className="px-4 py-3 font-semibold text-slate-500 text-xs border-b border-slate-200 text-center whitespace-nowrap">
                                    {k === 'horen' ? 'Nghe (Hören)' : k === 'lesen' ? 'Đọc (Lesen)' : k === 'schreiben' ? 'Viết (Schreiben)' : 'Nói (Sprechen)'}
                                  </th>
                                ))}
                                <th className="px-4 py-3 font-bold text-slate-600 text-xs uppercase border-b border-slate-200 text-center whitespace-nowrap">Tổng</th>
                                <th className="px-4 py-3 font-bold text-slate-600 text-xs uppercase border-b border-slate-200 text-center whitespace-nowrap">Xếp loại</th>
                              </tr>
                            </thead>
                            <tbody>
                              {skillReport.students.map((s, idx) => (
                                <tr key={s.studentId} className={idx % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'}>
                                  <td className="sticky left-0 px-4 py-2.5 whitespace-nowrap border-b border-slate-100 z-10 bg-inherit">
                                    <p className="font-semibold text-slate-700">{s.name}</p>
                                    <p className="text-slate-400 text-xs">{s.email}</p>
                                  </td>
                                  <td className="px-4 py-2.5 border-b border-slate-100"><SkillBar value={s.horen} color="bg-blue-400" /></td>
                                  <td className="px-4 py-2.5 border-b border-slate-100"><SkillBar value={s.lesen} color="bg-emerald-400" /></td>
                                  <td className="px-4 py-2.5 border-b border-slate-100"><SkillBar value={s.schreiben} color="bg-purple-400" /></td>
                                  <td className="px-4 py-2.5 border-b border-slate-100"><SkillBar value={s.sprechen} color="bg-amber-400" /></td>
                                  <td className="px-4 py-2.5 text-center border-b border-slate-100">{scoreBadge(s.total, 'lg')}</td>
                                  <td className="px-4 py-2.5 text-center border-b border-slate-100">{gradeBadge(s.grade)}</td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr className="bg-slate-50 font-bold">
                                <td className="sticky left-0 bg-slate-50 px-4 py-2.5 text-slate-600 text-xs border-t border-slate-200 z-10">TB lớp</td>
                                {(['horen','lesen','schreiben','sprechen'] as const).map(k => {
                                  const vals = skillReport.students.map(s => s[k]).filter((v): v is number => v != null)
                                  const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
                                  return <td key={k} className="px-4 py-2.5 text-center border-t border-slate-200">{scoreBadge(avg)}</td>
                                })}
                                <td className="px-4 py-2.5 text-center border-t border-slate-200">
                                  {(() => {
                                    const vals = skillReport.students.map(s => s.total).filter((v): v is number => v != null)
                                    const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
                                    return scoreBadge(avg)
                                  })()}
                                </td>
                                <td className="border-t border-slate-200" />
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ─── Tab: Nhật ký & Điểm danh ─────────────────────────── */}
                  {activeTab === 'attendance' && (
                    <div className="mt-5 animate-in fade-in duration-300 space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-500">{lessonLogs.length} buổi học đã ghi</span>
                        <div className="flex gap-2">
                          {lessonLogs.length > 0 && (
                            <button onClick={() => setPrintScope('attendance')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 text-xs font-bold">
                              <Printer size={13} /> Xuất PDF
                            </button>
                          )}
                          <button onClick={() => { setEditingLog(null); setShowLogForm(true) }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 text-xs font-bold">
                            <Plus size={13} /> Thêm buổi học
                          </button>
                        </div>
                      </div>

                      {/* Log form */}
                      {(showLogForm || editingLog) && (
                        <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-bold text-slate-700 text-sm">{editingLog ? 'Sửa buổi học' : 'Thêm buổi học mới'}</h4>
                            <button onClick={() => { setShowLogForm(false); setEditingLog(null) }} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
                          </div>
                          <form onSubmit={handleSaveLog} className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="text-xs font-semibold text-slate-600 mb-1 block">Ngày học *</label>
                                <input type="date" name="sessionDate" required defaultValue={editingLog?.sessionDate?.slice(0,10) ?? ''} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                              </div>
                              <div>
                                <label className="text-xs font-semibold text-slate-600 mb-1 block">Buổi số</label>
                                <input type="number" name="sessionNumber" min={1} defaultValue={editingLog?.sessionNumber ?? ''} placeholder="VD: 5" className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                              </div>
                            </div>
                            <div>
                              <label className="text-xs font-semibold text-slate-600 mb-1 block">Nội dung bài học (Themen)</label>
                              <input type="text" name="topic" defaultValue={editingLog?.topic ?? ''} placeholder="VD: Studio d A2 – Lektion 3: Einkaufen" className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                            </div>
                            <div>
                              <label className="text-xs font-semibold text-slate-600 mb-1 block">Bài tập về nhà (Hausaufgaben)</label>
                              <input type="text" name="homework" defaultValue={editingLog?.homework ?? ''} placeholder="VD: Viết 5 câu dùng Dativ" className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                            </div>
                            <div>
                              <label className="text-xs font-semibold text-slate-600 mb-1 block">Ghi chú thêm</label>
                              <input type="text" name="note" defaultValue={editingLog?.note ?? ''} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                            </div>

                            {/* Attendance grid */}
                            {gradebook && gradebook.students.length > 0 && (
                              <div>
                                <label className="text-xs font-semibold text-slate-600 mb-2 block">Điểm danh</label>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                  {gradebook.students.map(s => {
                                    const existing = editingLog?.attendance.find(a => a.studentId === s.studentId)
                                    return (
                                      <div key={s.studentId} className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200">
                                        <span className="text-xs font-medium text-slate-700 flex-1 truncate">{s.name}</span>
                                        <select name={`att_${s.studentId}`} defaultValue={existing?.status ?? 'PRESENT'} className="text-xs border border-slate-200 rounded px-1 py-0.5 focus:ring-1 focus:ring-indigo-500 outline-none">
                                          <option value="PRESENT">✓ Có mặt</option>
                                          <option value="LATE">M Muộn</option>
                                          <option value="ABSENT">V Vắng</option>
                                        </select>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            )}

                            <div className="flex justify-end gap-2 pt-1">
                              <button type="button" onClick={() => { setShowLogForm(false); setEditingLog(null) }} className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-100">Hủy</button>
                              <button type="submit" disabled={logFormLoading} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-50">
                                {logFormLoading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                Lưu
                              </button>
                            </div>
                          </form>
                        </div>
                      )}

                      {lessonLogs.length === 0 && !showLogForm ? (
                        <p className="text-slate-500 text-sm text-center py-6 border border-dashed border-slate-200 rounded-xl">
                          Chưa có buổi học nào. Nhấn &ldquo;Thêm buổi học&rdquo; để bắt đầu ghi nhật ký.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {lessonLogs.map(log => {
                            const presentCount = log.attendance.filter(a => a.status === 'PRESENT').length
                            const absentCount  = log.attendance.filter(a => a.status === 'ABSENT').length
                            const lateCount    = log.attendance.filter(a => a.status === 'LATE').length
                            const expanded = expandedLogs.has(log.id)
                            const toggleExpanded = () => setExpandedLogs(prev => {
                              const next = new Set(prev)
                              next.has(log.id) ? next.delete(log.id) : next.add(log.id)
                              return next
                            })
                            return (
                              <div key={log.id} className="border border-slate-200 rounded-xl overflow-hidden">
                                <div className="flex items-center gap-3 px-4 py-3 bg-white">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-slate-700 text-sm">
                                        {log.sessionNumber != null ? `Buổi ${log.sessionNumber}` : ''}
                                        {log.sessionNumber != null && ' · '}
                                        {new Date(log.sessionDate).toLocaleDateString('vi-VN')}
                                      </span>
                                      <span className="text-xs text-emerald-600 font-semibold">{presentCount} có mặt</span>
                                      {absentCount > 0 && <span className="text-xs text-rose-600 font-semibold">{absentCount} vắng</span>}
                                      {lateCount > 0 && <span className="text-xs text-amber-600 font-semibold">{lateCount} muộn</span>}
                                    </div>
                                    {log.topic && <p className="text-xs text-slate-500 truncate mt-0.5">{log.topic}</p>}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <button onClick={() => { setEditingLog(log); setShowLogForm(false) }} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"><Edit2 size={14} /></button>
                                    <button onClick={() => handleDeleteLog(log.id)} className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600"><Trash2 size={14} /></button>
                                    <button onClick={toggleExpanded} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
                                      {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                    </button>
                                  </div>
                                </div>
                                {expanded && (
                                  <div className="px-4 pb-3 bg-slate-50 border-t border-slate-100">
                                    {log.homework && <p className="text-xs text-slate-600 mt-2"><span className="font-semibold">BTVN: </span>{log.homework}</p>}
                                    {log.note && <p className="text-xs text-slate-600 mt-1"><span className="font-semibold">Ghi chú: </span>{log.note}</p>}
                                    {log.attendance.length > 0 && (
                                      <div className="mt-2 flex flex-wrap gap-2">
                                        {log.attendance.map(a => (
                                          <span key={a.studentId} className={`text-xs px-2 py-0.5 rounded-lg border font-medium ${a.status === 'PRESENT' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : a.status === 'LATE' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                                            {a.name} {a.status === 'PRESENT' ? '✓' : a.status === 'LATE' ? 'M' : 'V'}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ─── Tab: Phiếu đánh giá ───────────────────────────────── */}
                  {activeTab === 'evaluation' && (
                    <div className="mt-5 animate-in fade-in duration-300 space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-500">Phiếu đánh giá cuối khóa cho từng học viên</span>
                        {evaluations.length > 0 && (
                          <button onClick={() => setPrintScope('evaluation')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 text-xs font-bold">
                            <Printer size={13} /> Xuất PDF tất cả phiếu
                          </button>
                        )}
                      </div>

                      {/* Evaluation form */}
                      {editingEval && (
                        <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-bold text-slate-700 text-sm">Đánh giá: {editingEval.name}</h4>
                            <button onClick={() => setEditingEval(null)} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
                          </div>
                          <form onSubmit={handleSaveEval} className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                              {([
                                { name: 'skillHoren', label: 'Nghe (Hören)', val: editingEval.skillHoren },
                                { name: 'skillLesen', label: 'Đọc (Lesen)', val: editingEval.skillLesen },
                                { name: 'skillSchreiben', label: 'Viết (Schreiben)', val: editingEval.skillSchreiben },
                                { name: 'skillSprechen', label: 'Nói (Sprechen)', val: editingEval.skillSprechen },
                              ]).map(({ name, label, val }) => (
                                <div key={name}>
                                  <label className="text-xs font-semibold text-slate-600 mb-1 block">{label} (0–10)</label>
                                  <input type="number" name={name} min={0} max={10} step={0.1} defaultValue={val ?? ''} placeholder="—" className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                                </div>
                              ))}
                            </div>
                            <div>
                              <label className="text-xs font-semibold text-slate-600 mb-1 block">Nhận xét của giáo viên</label>
                              <textarea name="teacherComment" rows={3} defaultValue={editingEval.teacherComment ?? ''} placeholder="Điểm mạnh, điểm yếu, khuyến nghị..." className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none" />
                            </div>
                            <div className="flex justify-end gap-2 pt-1">
                              <button type="button" onClick={() => setEditingEval(null)} className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-100">Hủy</button>
                              <button type="submit" disabled={evalFormLoading} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-50">
                                {evalFormLoading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                Lưu đánh giá
                              </button>
                            </div>
                          </form>
                        </div>
                      )}

                      {evaluations.length === 0 ? (
                        <p className="text-slate-500 text-sm text-center py-6 border border-dashed border-slate-200 rounded-xl">
                          Lớp chưa có học viên hoặc chưa được đánh giá.
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {evaluations.map(ev => (
                            <div key={ev.studentId} className="border border-slate-200 rounded-xl p-4 bg-white">
                              <div className="flex items-start gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-bold text-slate-700">{ev.name}</span>
                                    <span className="text-xs text-slate-400">{ev.email}</span>
                                    {ev.certificateEligible && (
                                      <span className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg">
                                        <CheckCircle2 size={11} /> Đủ điều kiện cấp chứng nhận
                                      </span>
                                    )}
                                  </div>
                                  <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    {[
                                      { label: 'Nghe', val: ev.skillHoren, color: 'bg-blue-400' },
                                      { label: 'Đọc', val: ev.skillLesen, color: 'bg-emerald-400' },
                                      { label: 'Viết', val: ev.skillSchreiben, color: 'bg-purple-400' },
                                      { label: 'Nói', val: ev.skillSprechen, color: 'bg-amber-400' },
                                    ].map(({ label, val, color }) => (
                                      <div key={label} className="flex items-center gap-1.5">
                                        <span className="text-xs text-slate-500 w-10">{label}</span>
                                        <SkillBar value={val} color={color} />
                                      </div>
                                    ))}
                                  </div>
                                  {ev.totalSessions > 0 && (
                                    <p className="text-xs text-slate-500 mt-1.5">
                                      Chuyên cần: {ev.presentCount + ev.lateCount}/{ev.totalSessions} buổi
                                      {ev.absentCount > 0 && ` · Vắng ${ev.absentCount}`}
                                    </p>
                                  )}
                                  {ev.teacherComment && <p className="text-xs text-slate-600 mt-1.5 italic">&ldquo;{ev.teacherComment}&rdquo;</p>}
                                </div>
                                <button onClick={() => setEditingEval(ev)} className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-bold">
                                  <Edit2 size={12} /> Sửa
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Print areas (hidden on screen, visible when printing) ─────────── */}

      {/* Overview PDF */}
      {printScope === 'overview' && overview && (
        <div className="print-area print-color-exact">
          <PrintHeader title="Báo cáo tổng hợp" userName={userName} />
          <div className="print-section grid grid-cols-3 gap-4 mb-5">
            {[
              { label: 'Tổng lớp học', value: overview.classCount },
              { label: 'Tổng bài tập', value: overview.assignmentCount },
              { label: 'Tổng học viên', value: overview.studentCount },
            ].map(({ label, value }) => (
              <div key={label} className="border border-slate-300 rounded-xl p-4 text-center">
                <p className="text-2xl font-black text-slate-800">{value}</p>
                <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mt-1">{label}</p>
              </div>
            ))}
          </div>
          <div className="print-section border border-slate-300 rounded-xl p-4 mb-5 text-center">
            <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Điểm trung bình toàn hệ thống</p>
            <p className="text-4xl font-black text-slate-800">{Number(overview.avgScore ?? 0).toFixed(1)}</p>
            <p className="text-xs text-slate-400 mt-0.5">/ 10 điểm</p>
          </div>
          {classes.length > 0 && (
            <div className="print-section">
              <h2 className="font-bold text-slate-700 mb-2 text-sm">Danh sách lớp học</h2>
              <table className="w-full border-collapse text-xs">
                <thead><tr className="bg-slate-100">
                  <th className="border border-slate-300 px-3 py-2 text-left font-bold">Tên lớp</th>
                  <th className="border border-slate-300 px-3 py-2 text-center font-bold">Học viên</th>
                  <th className="border border-slate-300 px-3 py-2 text-center font-bold">Bài tập</th>
                  <th className="border border-slate-300 px-3 py-2 text-center font-bold">Mã lớp</th>
                </tr></thead>
                <tbody>
                  {classes.map((cls: any) => (
                    <tr key={cls.id}>
                      <td className="border border-slate-200 px-3 py-2 font-medium">{cls.name}</td>
                      <td className="border border-slate-200 px-3 py-2 text-center">{cls.studentCount ?? 0}</td>
                      <td className="border border-slate-200 px-3 py-2 text-center">{cls.quizCount ?? 0}</td>
                      <td className="border border-slate-200 px-3 py-2 text-center font-mono">{cls.inviteCode ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Gradebook PDF */}
      {printScope === 'gradebook' && gradebook && (
        <div className="print-area print-color-exact">
          <PrintHeader title="Sổ điểm" subtitle={`${gradebook.students.length} học viên · ${gradebook.assignments.length} bài tập`} userName={userName} className={gradebook.className} />
          <table className="w-full border-collapse text-[10px]">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-slate-300 px-2 py-1.5 text-left font-bold whitespace-nowrap">Học viên</th>
                {gradebook.assignments.map(a => (
                  <th key={a.id} className="border border-slate-300 px-1.5 py-1.5 font-semibold text-center max-w-[80px]">
                    <div className="truncate">{a.topic}</div>
                    {a.skill && a.skill !== 'GENERAL' && (
                      <div className="font-normal text-[8px] text-slate-500">{SKILL_LABELS[a.skill.toUpperCase()]?.label?.split(' ')[0]}</div>
                    )}
                  </th>
                ))}
                <th className="border border-slate-300 px-2 py-1.5 text-center font-bold whitespace-nowrap">Điểm TB</th>
              </tr>
            </thead>
            <tbody>
              {gradebook.students.map((s, idx) => (
                <tr key={s.studentId} className={idx % 2 === 1 ? 'bg-slate-50' : ''}>
                  <td className="border border-slate-200 px-2 py-1.5 whitespace-nowrap">
                    <div className="font-semibold">{s.name}</div>
                    <div className="text-[9px] text-slate-400">{s.email}</div>
                  </td>
                  {gradebook.assignments.map(a => {
                    const cell = s.cells[String(a.id)]
                    return (
                      <td key={a.id} className="border border-slate-200 px-1.5 py-1.5 text-center">
                        {!cell ? <span className="text-slate-300">·</span>
                          : cell.score != null ? (
                            <span className={`inline-block px-1.5 py-px rounded font-bold ${cell.score >= 8 ? 'bg-emerald-100 text-emerald-800' : cell.score >= 5 ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'}`}>{cell.score}</span>
                          ) : cell.status === 'SUBMITTED' ? <span className="text-blue-600 text-[9px]">Chờ chấm</span>
                            : <span className="text-slate-400 text-[9px]">Chưa nộp</span>}
                      </td>
                    )
                  })}
                  <td className="border border-slate-200 px-2 py-1.5 text-center font-black">
                    {s.avgScore != null ? s.avgScore.toFixed(1) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Skill report PDF */}
      {printScope === 'skill-report' && skillReport && (
        <div className="print-area print-color-exact">
          <PrintHeader title="Bảng điểm tổng hợp 4 kỹ năng" userName={userName} className={skillReport.className} />
          <table className="w-full border-collapse text-[10px]">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-slate-300 px-3 py-2 text-left font-bold">Học viên</th>
                <th className="border border-slate-300 px-3 py-2 text-center font-bold">Nghe (Hören)</th>
                <th className="border border-slate-300 px-3 py-2 text-center font-bold">Đọc (Lesen)</th>
                <th className="border border-slate-300 px-3 py-2 text-center font-bold">Viết (Schreiben)</th>
                <th className="border border-slate-300 px-3 py-2 text-center font-bold">Nói (Sprechen)</th>
                <th className="border border-slate-300 px-3 py-2 text-center font-bold">Tổng</th>
                <th className="border border-slate-300 px-3 py-2 text-center font-bold">Xếp loại</th>
              </tr>
            </thead>
            <tbody>
              {skillReport.students.map((s, idx) => (
                <tr key={s.studentId} className={idx % 2 === 1 ? 'bg-slate-50' : ''}>
                  <td className="border border-slate-200 px-3 py-1.5">
                    <div className="font-semibold">{s.name}</div>
                    <div className="text-[9px] text-slate-400">{s.email}</div>
                  </td>
                  {[s.horen, s.lesen, s.schreiben, s.sprechen].map((v, i) => (
                    <td key={i} className="border border-slate-200 px-3 py-1.5 text-center font-bold">
                      {v != null ? (
                        <span className={`inline-block px-1.5 py-px rounded ${v >= 8 ? 'bg-emerald-100 text-emerald-800' : v >= 5 ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'}`}>{v.toFixed(1)}</span>
                      ) : '—'}
                    </td>
                  ))}
                  <td className="border border-slate-200 px-3 py-1.5 text-center font-black">
                    {s.total != null ? s.total.toFixed(1) : '—'}
                  </td>
                  <td className="border border-slate-200 px-3 py-1.5 text-center">
                    <span className={`inline-block px-1.5 py-px rounded text-[9px] font-bold border ${
                      s.grade === 'Xuất sắc' ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : s.grade === 'Giỏi' ? 'bg-blue-100 text-blue-800 border-blue-300'
                      : s.grade === 'Khá' ? 'bg-indigo-100 text-indigo-800 border-indigo-300'
                      : s.grade === 'Trung bình' ? 'bg-amber-100 text-amber-800 border-amber-300'
                      : 'bg-rose-100 text-rose-800 border-rose-300'
                    }`}>{s.grade}</span>
                  </td>
                </tr>
              ))}
              <tr className="bg-slate-100 font-bold">
                <td className="border border-slate-300 px-3 py-1.5">TB lớp</td>
                {(['horen','lesen','schreiben','sprechen'] as const).map(k => {
                  const vals = skillReport.students.map(s => s[k]).filter((v): v is number => v != null)
                  const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
                  return <td key={k} className="border border-slate-200 px-3 py-1.5 text-center">{avg != null ? avg.toFixed(1) : '—'}</td>
                })}
                <td className="border border-slate-200 px-3 py-1.5 text-center">
                  {(() => {
                    const vals = skillReport.students.map(s => s.total).filter((v): v is number => v != null)
                    return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : '—'
                  })()}
                </td>
                <td className="border border-slate-200" />
              </tr>
            </tbody>
          </table>
          <div className="mt-8 pt-4 border-t border-slate-300 flex justify-between text-[10px] text-slate-500">
            <span>Ký tên giáo viên: ___________________________</span>
            <span>Xác nhận phòng đào tạo: ___________________________</span>
          </div>
        </div>
      )}

      {/* Attendance / Lesson log PDF */}
      {printScope === 'attendance' && lessonLogs.length > 0 && gradebook && (
        <div className="print-area print-color-exact">
          <PrintHeader title="Sổ điểm danh & Nhật ký giảng dạy" userName={userName} className={selectedClass?.name} />

          {/* Attendance grid */}
          <div className="print-section mb-5">
            <h2 className="font-bold text-slate-700 mb-2 text-xs uppercase tracking-wider">Bảng điểm danh</h2>
            <div className="overflow-x-auto">
              <table className="border-collapse text-[10px]">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="border border-slate-300 px-2 py-1.5 text-left font-bold min-w-[120px]">Học viên</th>
                    {lessonLogs.map(log => (
                      <th key={log.id} className="border border-slate-300 px-1.5 py-1.5 text-center font-semibold min-w-[40px]">
                        <div>{log.sessionNumber != null ? `B${log.sessionNumber}` : ''}</div>
                        <div className="font-normal text-[8px]">{new Date(log.sessionDate).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}</div>
                      </th>
                    ))}
                    <th className="border border-slate-300 px-2 py-1.5 text-center font-bold whitespace-nowrap">Vắng</th>
                  </tr>
                </thead>
                <tbody>
                  {gradebook.students.map((s, idx) => {
                    const absentCount = lessonLogs.reduce((acc, log) => {
                      const att = log.attendance.find(a => a.studentId === s.studentId)
                      return acc + (att?.status === 'ABSENT' ? 1 : 0)
                    }, 0)
                    return (
                      <tr key={s.studentId} className={idx % 2 === 1 ? 'bg-slate-50' : ''}>
                        <td className="border border-slate-200 px-2 py-1.5 font-medium">{s.name}</td>
                        {lessonLogs.map(log => {
                          const att = log.attendance.find(a => a.studentId === s.studentId)
                          return (
                            <td key={log.id} className="border border-slate-200 px-1.5 py-1.5 text-center">
                              {!att ? '' : att.status === 'PRESENT' ? <span className="text-emerald-600 font-bold">✓</span>
                                : att.status === 'LATE' ? <span className="text-amber-600 font-bold">M</span>
                                : <span className="text-rose-600 font-bold">V</span>}
                            </td>
                          )
                        })}
                        <td className="border border-slate-200 px-2 py-1.5 text-center font-bold text-rose-600">
                          {absentCount > 0 ? absentCount : ''}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Lesson log */}
          <div className="print-section print-page-break">
            <h2 className="font-bold text-slate-700 mb-2 text-xs uppercase tracking-wider">Nhật ký giảng dạy</h2>
            <table className="w-full border-collapse text-[10px]">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-slate-300 px-2 py-1.5 text-center font-bold w-8">Buổi</th>
                  <th className="border border-slate-300 px-2 py-1.5 text-center font-bold w-20">Ngày</th>
                  <th className="border border-slate-300 px-3 py-1.5 text-left font-bold">Nội dung bài học (Themen)</th>
                  <th className="border border-slate-300 px-3 py-1.5 text-left font-bold">Bài tập về nhà (Hausaufgaben)</th>
                </tr>
              </thead>
              <tbody>
                {lessonLogs.map((log, idx) => (
                  <tr key={log.id} className={idx % 2 === 1 ? 'bg-slate-50' : ''}>
                    <td className="border border-slate-200 px-2 py-2 text-center">{log.sessionNumber ?? ''}</td>
                    <td className="border border-slate-200 px-2 py-2 text-center whitespace-nowrap">{new Date(log.sessionDate).toLocaleDateString('vi-VN')}</td>
                    <td className="border border-slate-200 px-3 py-2">{log.topic ?? ''}</td>
                    <td className="border border-slate-200 px-3 py-2">{log.homework ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-6 flex justify-between text-[10px] text-slate-500">
              <span>Ký tên giáo viên: ___________________________</span>
              <span>Tổ trưởng xác nhận: ___________________________</span>
            </div>
          </div>
        </div>
      )}

      {/* Student evaluation / Certificate PDF */}
      {printScope === 'evaluation' && evaluations.length > 0 && (
        <div className="print-area print-color-exact">
          {evaluations.map((ev, i) => (
            <div key={ev.studentId} className={i > 0 ? 'print-page-break' : ''}>
              {/* Header per student */}
              <div className="flex items-start justify-between pb-3 mb-4 border-b-2 border-slate-800">
                <div>
                  <p className="text-[10px] font-bold tracking-widest text-slate-500 uppercase">DeutschFlow</p>
                  <h1 className="text-base font-black text-slate-900 mt-0.5">Phiếu đánh giá kết quả học tập</h1>
                  <p className="text-xs text-slate-600 mt-0.5">Lớp: {ev.className}</p>
                </div>
                <div className="text-right text-[10px] text-slate-500">
                  <p>Giáo viên: <strong>{userName}</strong></p>
                  <p>Ngày: {new Date().toLocaleDateString('vi-VN')}</p>
                </div>
              </div>

              <div className="print-section grid grid-cols-2 gap-4 mb-4">
                <div className="border border-slate-300 rounded-xl p-3">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Thông tin học viên</p>
                  <p className="font-black text-slate-800 text-sm">{ev.name}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{ev.email}</p>
                  {ev.avgScore > 0 && <p className="text-[10px] text-slate-600 mt-1">Điểm bài tập TB: <strong>{ev.avgScore.toFixed(1)}</strong></p>}
                  {ev.totalSessions > 0 && (
                    <p className="text-[10px] text-slate-600">
                      Chuyên cần: <strong>{ev.presentCount + ev.lateCount}/{ev.totalSessions}</strong> buổi
                      {ev.absentCount > 0 && ` (vắng ${ev.absentCount})`}
                    </p>
                  )}
                </div>
                <div className="border border-slate-300 rounded-xl p-3">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2">Điểm 4 kỹ năng</p>
                  {[
                    { label: 'Nghe (Hören)', val: ev.skillHoren, color: 'bg-blue-500' },
                    { label: 'Đọc (Lesen)', val: ev.skillLesen, color: 'bg-emerald-500' },
                    { label: 'Viết (Schreiben)', val: ev.skillSchreiben, color: 'bg-purple-500' },
                    { label: 'Nói (Sprechen)', val: ev.skillSprechen, color: 'bg-amber-500' },
                  ].map(({ label, val, color }) => (
                    <div key={label} className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] text-slate-600 w-28">{label}</span>
                      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden print-bar-fill">
                        <div className={`h-full rounded-full ${color}`} style={{ width: `${val != null ? (val / 10) * 100 : 0}%` }} />
                      </div>
                      <span className="text-[10px] font-bold text-slate-700 w-6 text-right">{val != null ? val.toFixed(1) : '—'}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="print-section border border-slate-300 rounded-xl p-3 mb-4 min-h-[60px]">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Nhận xét của giáo viên</p>
                <p className="text-[11px] text-slate-700 leading-relaxed">{ev.teacherComment ?? '(Chưa có nhận xét)'}</p>
              </div>

              {ev.certificateEligible && (
                <div className="print-section border-2 border-emerald-400 rounded-xl p-3 bg-emerald-50 flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />
                  <p className="text-[11px] font-bold text-emerald-800">
                    Học viên đủ điều kiện hoàn thành khóa học và được cấp Chứng nhận hoàn thành.
                  </p>
                </div>
              )}

              <div className="mt-6 grid grid-cols-2 gap-6 text-[10px] text-slate-500">
                <div className="text-center">
                  <div className="border-b border-slate-400 pb-1 mb-1 mt-8">___________________________</div>
                  <p>Giáo viên ký tên</p>
                </div>
                <div className="text-center">
                  <div className="border-b border-slate-400 pb-1 mb-1 mt-8">___________________________</div>
                  <p>Phòng đào tạo xác nhận</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </TeacherShell>
  )
}
