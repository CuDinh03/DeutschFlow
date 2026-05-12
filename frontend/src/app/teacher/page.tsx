'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import api, { httpStatus, apiMessage } from '@/lib/api'
import { clearTokens, logout } from '@/lib/authSession'
import { TeacherShell } from '@/components/layouts/TeacherShell'
import { Users, FileText, CheckCircle, GraduationCap, Plus, ChevronRight, BookOpen, Clock, Loader2 } from 'lucide-react'

export default function TeacherPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [overview, setOverview] = useState<any>(null)
  const [classes, setClasses] = useState<any[]>([])
  const [quizzes, setQuizzes] = useState<any[]>([])
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [userName, setUserName] = useState('Giáo viên')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const me = await api.get('/auth/me')
      if (me.data.role !== 'TEACHER') {
        router.push(`/${String(me.data.role).toLowerCase()}`)
        return
      }
      if (me.data.name) setUserName(me.data.name)
      else if (me.data.email) setUserName(me.data.email.split('@')[0])

      const [ov, cls, qz] = await Promise.all([
        api.get('/teacher/reports/overview'),
        api.get('/teacher/classes'),
        api.get('/teacher/quizzes'),
      ])
      setOverview(ov.data)
      setClasses(cls.data ?? [])
      setQuizzes(qz.data ?? [])
    } catch (e: unknown) {
      if (httpStatus(e) === 401) {
        logout()
        return
      }
      setError('Không thể tải dữ liệu giáo viên.')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    load()
  }, [load])

  const handleLogout = () => {
    clearTokens()
    router.push('/')
  }

  const quickCreateClass = async () => {
    if (!name.trim()) return
    setError('')
    setCreating(true)
    try {
      await api.post('/teacher/classes', { name: name.trim() })
      setName('')
      await load()
    } catch (e: unknown) {
      setError(apiMessage(e))
    } finally {
      setCreating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 size={32} className="animate-spin text-indigo-600" />
          <p className="font-medium text-slate-500">Đang tải bảng điều khiển...</p>
        </div>
      </div>
    )
  }

  return (
    <TeacherShell
      activeMenu="dashboard"
      userName={userName}
      onLogout={handleLogout}
      headerTitle="Tổng quan Giáo viên"
      headerSubtitle="Dữ liệu thời gian thực từ các lớp học và bài tập"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-600 px-4 py-3 rounded-xl text-sm font-medium">
            {error}
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
              <Users size={20} />
            </div>
            <p className="text-slate-500 text-sm font-medium">Số lớp học</p>
            <p className="text-3xl font-black text-slate-800 mt-1">{overview?.classCount ?? 0}</p>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4">
              <FileText size={20} />
            </div>
            <p className="text-slate-500 text-sm font-medium">Tổng số Quiz</p>
            <p className="text-3xl font-black text-slate-800 mt-1">{overview?.quizCount ?? 0}</p>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
              <CheckCircle size={20} />
            </div>
            <p className="text-slate-500 text-sm font-medium">Quiz đang mở</p>
            <p className="text-3xl font-black text-slate-800 mt-1">{overview?.activeQuizCount ?? 0}</p>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4">
              <GraduationCap size={20} />
            </div>
            <p className="text-slate-500 text-sm font-medium">Tổng học viên</p>
            <p className="text-3xl font-black text-slate-800 mt-1">{overview?.studentCount ?? 0}</p>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-shadow col-span-2 lg:col-span-1">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-4">
              <BookOpen size={20} />
            </div>
            <p className="text-slate-500 text-sm font-medium">Điểm TB học viên</p>
            <p className="text-3xl font-black text-slate-800 mt-1">{Number(overview?.avgScore ?? 0).toFixed(1)} <span className="text-base text-slate-400 font-bold">/10</span></p>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-3 gap-8">
          
          <div className="lg:col-span-2 space-y-8">
            {/* Quick Create */}
            <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                <Users size={120} />
              </div>
              <div className="relative z-10">
                <h2 className="text-xl font-bold mb-2">Tạo nhanh lớp học mới</h2>
                <p className="text-indigo-100 text-sm mb-6 max-w-md">Tạo lớp học để bắt đầu thêm học viên và giao bài tập. Bạn có thể thêm học viên sau thông qua email.</p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input 
                    className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder:text-indigo-200 focus:outline-none focus:ring-2 focus:ring-white/50" 
                    placeholder="Nhập tên lớp học (VD: A1.1 Tối 2-4-6)" 
                    value={name} 
                    onChange={(e) => setName(e.target.value)} 
                    onKeyDown={(e) => e.key === 'Enter' && quickCreateClass()}
                  />
                  <button 
                    className="bg-white text-indigo-700 hover:bg-indigo-50 font-bold py-3 px-6 rounded-xl transition-colors flex items-center justify-center gap-2" 
                    onClick={quickCreateClass}
                    disabled={creating || !name.trim()}
                  >
                    {creating ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                    Tạo lớp ngay
                  </button>
                </div>
              </div>
            </div>

            {/* Quizzes List */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                <h2 className="font-bold text-slate-800 text-lg">Bài tập / Quiz gần đây</h2>
                <button className="text-indigo-600 font-semibold text-sm hover:text-indigo-800 transition-colors flex items-center" onClick={() => router.push('/teacher/quizzes')}>
                  Xem tất cả <ChevronRight size={16} />
                </button>
              </div>
              <div className="p-2">
                {quizzes.length === 0 ? (
                  <div className="py-12 flex flex-col items-center text-center">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-3">
                      <FileText size={24} className="text-slate-400" />
                    </div>
                    <p className="font-medium text-slate-600">Chưa có bài tập nào</p>
                    <p className="text-sm text-slate-400 mt-1">Hãy tạo bài tập đầu tiên cho học viên</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {quizzes.slice(0, 5).map((q) => (
                      <div key={q.id} className="p-4 hover:bg-slate-50 transition-colors rounded-xl flex items-center justify-between group cursor-pointer" onClick={() => router.push('/teacher/quizzes')}>
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs shrink-0
                            ${q.quizType === 'AI_INTERVIEW' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}
                          `}>
                            {q.quizType === 'AI_INTERVIEW' ? 'AI' : 'QZ'}
                          </div>
                          <div>
                            <p className="font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">{q.title}</p>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">{q.quizType}</span>
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-md
                                ${q.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 
                                  q.status === 'FINISHED' ? 'bg-slate-100 text-slate-600' : 'bg-amber-100 text-amber-700'}
                              `}>
                                {q.status}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-bold text-slate-400 uppercase">Mã PIN</p>
                          <p className="font-mono font-bold text-slate-700">{q.pinCode || '---'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-8">
            {/* Classes List */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                <h2 className="font-bold text-slate-800 text-lg">Lớp học của bạn</h2>
                <button className="text-indigo-600 font-semibold text-sm hover:text-indigo-800 transition-colors flex items-center" onClick={() => router.push('/teacher/classes')}>
                  Xem tất cả <ChevronRight size={16} />
                </button>
              </div>
              <div className="p-4">
                {classes.length === 0 ? (
                  <div className="py-8 flex flex-col items-center text-center">
                    <p className="font-medium text-slate-600">Chưa có lớp học</p>
                    <p className="text-sm text-slate-400 mt-1">Tạo lớp học để thêm học viên</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {classes.slice(0, 5).map((c) => (
                      <div key={c.id} className="p-4 border border-slate-100 rounded-xl hover:border-indigo-100 hover:shadow-sm transition-all cursor-pointer" onClick={() => router.push('/teacher/classes')}>
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-100 to-purple-100 text-indigo-600 flex items-center justify-center font-bold text-xs shrink-0">
                            {c.name.charAt(0).toUpperCase()}
                          </div>
                          <p className="font-bold text-slate-800 truncate">{c.name}</p>
                        </div>
                        <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                          <div className="flex items-center gap-1.5"><Users size={14} className="text-slate-400"/> {c.studentCount} học viên</div>
                          <div className="flex items-center gap-1.5"><FileText size={14} className="text-slate-400"/> {c.quizCount} bài tập</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </TeacherShell>
  )
}
