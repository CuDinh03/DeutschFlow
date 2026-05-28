'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import api, { httpStatus } from '@/lib/api'
import { logout } from '@/lib/authSession'
import { TeacherShell } from '@/components/layouts/TeacherShell'
import { usePendingGradingCount } from '@/hooks/usePendingGradingCount'
import { GradingQueueCard, type GradingQueueItem } from '@/components/teacher/GradingQueueCard'
import { GradingPanel } from '@/components/teacher/GradingPanel'
import {
  ClipboardCheck, Loader2, Filter, RefreshCw,
  CheckCircle2, Clock, BarChart2, ChevronDown
} from 'lucide-react'

interface GradingStats {
  totalPending: number
  totalGraded: number
  byClass: { classId: number; className: string; pending: number; graded: number }[]
}

interface TeacherClass {
  id: number
  name: string
}

const ASSIGNMENT_TYPES = [
  { value: '', label: 'Tất cả loại' },
  { value: 'GENERAL', label: 'Bài tập chung' },
  { value: 'ESSAY', label: 'Viết luận' },
  { value: 'SPEAKING_SCENARIO', label: 'Luyện Nói AI' },
  { value: 'VOCABULARY', label: 'Từ vựng' },
  { value: 'GRAMMAR', label: 'Ngữ pháp' },
  { value: 'MOCK_TEST', label: 'Thi thử' },
]

export default function TeacherGradingPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [userName, setUserName] = useState('Giáo viên')
  const { count: pendingGradingCount, refresh: refreshGradingCount } = usePendingGradingCount()
  const [loading, setLoading] = useState(true)
  const [queue, setQueue] = useState<GradingQueueItem[]>([])
  const [stats, setStats] = useState<GradingStats | null>(null)
  const [classes, setClasses] = useState<TeacherClass[]>([])

  // Filters — khởi tạo từ URL query param nếu có
  const [classFilter, setClassFilter] = useState<string>(() => searchParams.get('classId') ?? '')
  const [typeFilter, setTypeFilter] = useState<string>('')

  // Grading panel
  const [gradingItem, setGradingItem] = useState<GradingQueueItem | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const me = await api.get('/auth/me')
      if (me.data.role !== 'TEACHER') {
        router.push(`/${String(me.data.role).toLowerCase()}`)
        return
      }
      if (me.data.name) setUserName(me.data.name)
      else if (me.data.email) setUserName(me.data.email.split('@')[0])

      const params = new URLSearchParams()
      if (classFilter) params.set('classId', classFilter)
      if (typeFilter) params.set('type', typeFilter)

      const [queueRes, statsRes, classesRes] = await Promise.all([
        api.get<GradingQueueItem[]>(`/v2/teacher/grading/queue?${params.toString()}`),
        api.get<GradingStats>('/v2/teacher/grading/stats'),
        api.get<TeacherClass[]>('/v2/teacher/classes').catch(() => ({ data: [] })),
      ])

      setQueue(queueRes.data ?? [])
      setStats(statsRes.data ?? null)
      setClasses(classesRes.data ?? [])
    } catch (e) {
      if (httpStatus(e) === 401) router.push('/login')
    } finally {
      setLoading(false)
    }
  }, [router, classFilter, typeFilter])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleSaved = (updatedItem: GradingQueueItem) => {
    setQueue(prev => prev.filter(q => q.id !== updatedItem.id))
    if (stats) {
      setStats(prev => prev ? { ...prev, totalPending: Math.max(0, prev.totalPending - 1), totalGraded: prev.totalGraded + 1 } : prev)
    }
    // Invalidate cache → badge sidebar cập nhật ngay trên tất cả trang
    refreshGradingCount()
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 size={32} className="animate-spin text-indigo-600" />
          <p className="font-medium text-slate-500">Đang tải danh sách chấm bài...</p>
        </div>
      </div>
    )
  }

  return (
    <TeacherShell
      activeMenu="grading"
      userName={userName}
      pendingGradingCount={pendingGradingCount}
      onLogout={() => void logout()}
      headerTitle="Trung tâm Chấm bài"
      headerSubtitle="Chấm điểm tất cả bài nộp từ các lớp học của bạn"
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* Stats row */}
        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-rose-500 to-rose-600 rounded-2xl p-5 text-white shadow-lg shadow-rose-200">
              <div className="flex items-center justify-between mb-3">
                <p className="text-rose-100 font-medium text-sm">Chờ chấm</p>
                <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
                  <Clock size={18} className="text-white" />
                </div>
              </div>
              <p className="text-4xl font-black">{stats.totalPending}</p>
              <p className="text-rose-100 text-xs mt-1">bài nộp chưa được chấm</p>
            </div>

            <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-5 text-white shadow-lg shadow-emerald-200">
              <div className="flex items-center justify-between mb-3">
                <p className="text-emerald-100 font-medium text-sm">Đã chấm</p>
                <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
                  <CheckCircle2 size={18} className="text-white" />
                </div>
              </div>
              <p className="text-4xl font-black">{stats.totalGraded}</p>
              <p className="text-emerald-100 text-xs mt-1">bài đã có điểm</p>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="text-slate-500 font-medium text-sm">Theo lớp</p>
                <div className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center">
                  <BarChart2 size={18} className="text-slate-500" />
                </div>
              </div>
              <div className="space-y-1.5 max-h-20 overflow-y-auto">
                {stats.byClass.filter(c => c.pending > 0).map(c => (
                  <div key={c.classId} className="flex items-center justify-between text-xs">
                    <span className="text-slate-600 font-medium truncate max-w-[120px]">{c.className}</span>
                    <span className="text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded-full">{c.pending} chờ</span>
                  </div>
                ))}
                {stats.byClass.filter(c => c.pending > 0).length === 0 && (
                  <p className="text-slate-400 text-xs">Không có bài chờ chấm</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Filter bar */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-slate-600">
            <Filter size={16} className="text-indigo-500" />
            <span className="font-semibold text-sm">Lọc:</span>
          </div>

          {/* Class filter */}
          <div className="relative">
            <select
              value={classFilter}
              onChange={e => setClassFilter(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 bg-white focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
            >
              <option value="">Tất cả lớp</option>
              {classes.map(c => (
                <option key={c.id} value={String(c.id)}>{c.name}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          {/* Type filter */}
          <div className="relative">
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 bg-white focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
            >
              {ASSIGNMENT_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          <button
            onClick={loadData}
            className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors"
          >
            <RefreshCw size={14} />
            Làm mới
          </button>
        </div>

        {/* Queue list */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-slate-800 flex items-center gap-2">
              <ClipboardCheck size={20} className="text-indigo-600" />
              Bài nộp chờ chấm
              <span className="bg-rose-100 text-rose-700 text-sm font-bold px-2.5 py-0.5 rounded-full">
                {queue.length}
              </span>
            </h2>
          </div>

          {queue.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200 border-dashed p-16 flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 size={36} className="text-emerald-400" />
              </div>
              <h3 className="text-lg font-bold text-slate-700 mb-2">Không có bài nào chờ chấm</h3>
              <p className="text-slate-500 max-w-sm text-sm">
                {classFilter || typeFilter
                  ? 'Không có bài nộp nào khớp với bộ lọc hiện tại.'
                  : 'Tất cả bài nộp đã được chấm điểm. Hãy kiểm tra lại sau khi học viên nộp thêm bài.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {queue.map(item => (
                <GradingQueueCard
                  key={item.id}
                  item={item}
                  onGrade={setGradingItem}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Grading Panel */}
      <GradingPanel
        item={gradingItem}
        onClose={() => setGradingItem(null)}
        onSaved={handleSaved}
      />
    </TeacherShell>
  )
}
