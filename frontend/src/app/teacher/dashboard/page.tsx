'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import api, { httpStatus, apiMessage } from '@/lib/api'
import { TeacherShell } from '@/components/layouts/TeacherShell'
import { Users, Trash2, UserPlus, FileText, Loader2, Plus, Mail, CheckCircle, BellRing, Trophy, TrendingUp, Presentation, AlertCircle } from 'lucide-react'

type Classroom = {
  id: number
  name: string
  inviteCode: string
  studentCount: number
  quizCount: number
  pendingReviewCount?: number // New field to be provided by API later
}

export default function TeacherDashboardPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [items, setItems] = useState<Classroom[]>([])
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [userName, setUserName] = useState('Giáo viên')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const me = await api.get('/auth/me')
      if (me.data.role !== 'TEACHER' && me.data.role !== 'ADMIN') {
        router.push(`/${String(me.data.role).toLowerCase()}`)
        return
      }
      if (me.data.name) setUserName(me.data.name)
      else if (me.data.email) setUserName(me.data.email.split('@')[0])

      const res = await api.get('/v2/teacher/classes')
      setItems(res.data ?? [])
    } catch (e: unknown) {
      if (httpStatus(e) === 401) {
        router.push('/login')
        return
      }
      setError('Không thể tải danh sách lớp học.')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    load()
  }, [load])

  const createClass = async () => {
    if (!newName.trim()) return
    setError('')
    setCreating(true)
    try {
      setCreating(true)
      await api.post('/v2/teacher/classes', { name: newName.trim() })
      setNewName('')
      await load()
    } catch (e: unknown) {
      if (httpStatus(e) === 403) {
        setError('Tài khoản của bạn không có quyền tạo lớp học. Vui lòng liên hệ Admin.')
      } else {
        setError('Không thể tạo lớp học.')
      }
    } finally {
      setCreating(false)
    }
  }

  const deleteClass = async (id: number) => {
    if (!confirm('Bạn có chắc chắn muốn xóa lớp học này? Mọi dữ liệu liên quan sẽ bị xóa.')) return
    setError('')
    try {
      await api.delete(`/v2/teacher/classes/${id}`)
      await load()
    } catch {
      setError('Không thể xóa lớp học.')
    }
  }

  const totalStudents = items.reduce((acc, c) => acc + c.studentCount, 0)
  const totalPending = items.reduce((acc, c) => acc + (c.pendingReviewCount || 0), 0)
  const bestClass = items.length > 0 ? items.reduce((prev, current) => (prev.quizCount > current.quizCount) ? prev : current) : null

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 size={32} className="animate-spin text-indigo-600" />
          <p className="font-medium text-slate-500">Đang tải dữ liệu...</p>
        </div>
      </div>
    )
  }

  return (
    <TeacherShell
      activeMenu="dashboard"
      userName={userName}
      onLogout={() => {
        localStorage.removeItem('auth_token')
        router.push('/')
      }}
      headerTitle="Dashboard & Lớp học"
      headerSubtitle="Quản lý tổng quan tiến độ học tập và các lớp học của bạn"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-10">
        
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-600 px-4 py-3 rounded-xl text-sm font-medium flex items-start gap-3">
            <AlertCircle size={20} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Top Section: Overview Widgets */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-3xl p-6 shadow-lg shadow-indigo-200 text-white relative overflow-hidden group">
            <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-all duration-500"></div>
            <div className="relative z-10 flex flex-col h-full justify-between">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <p className="text-indigo-100 font-medium mb-1">Tổng học viên</p>
                  <h3 className="text-4xl font-black">{totalStudents}</h3>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center">
                  <Users size={24} className="text-white" />
                </div>
              </div>
              <p className="text-indigo-100 text-sm flex items-center gap-1.5">
                <TrendingUp size={16} /> Hoạt động trong {items.length} lớp học
              </p>
            </div>
          </div>

          <div className="bg-gradient-to-br from-rose-500 to-rose-600 rounded-3xl p-6 shadow-lg shadow-rose-200 text-white relative overflow-hidden group">
            <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-all duration-500"></div>
            <div className="relative z-10 flex flex-col h-full justify-between">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <p className="text-rose-100 font-medium mb-1">Cần chấm điểm</p>
                  <h3 className="text-4xl font-black">{totalPending}</h3>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center relative">
                  <BellRing size={24} className="text-white" />
                  {totalPending > 0 && (
                    <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-yellow-400 rounded-full animate-ping"></span>
                  )}
                </div>
              </div>
              <p className="text-rose-100 text-sm flex items-center gap-1.5">
                <CheckCircle size={16} /> Bài tập và Speaking Review
              </p>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 flex flex-col justify-between">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-slate-500 font-medium mb-1">Lớp tích cực nhất</p>
                <h3 className="text-xl font-bold text-slate-800 line-clamp-1">{bestClass ? bestClass.name : 'Chưa có dữ liệu'}</h3>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center">
                <Trophy size={24} className="text-amber-500" />
              </div>
            </div>
            {bestClass && (
              <div className="flex items-center gap-4 text-sm font-medium">
                <span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-lg">{bestClass.studentCount} học viên</span>
                <span className="bg-purple-50 text-purple-700 px-3 py-1 rounded-lg">{bestClass.quizCount} bài tập</span>
              </div>
            )}
          </div>
        </div>

        {/* Create Class Section */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-2 flex flex-col sm:flex-row gap-2">
          <div className="flex-1 relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Presentation size={20} className="text-slate-400" />
            </div>
            <input
              className="w-full bg-transparent rounded-xl pl-12 pr-4 py-4 text-slate-800 font-medium placeholder-slate-400 focus:outline-none focus:ring-0"
              placeholder="Nhập tên lớp học (VD: A1.1 Lớp tối 2-4-6)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && createClass()}
            />
          </div>
          <button
            className="bg-slate-900 hover:bg-indigo-600 text-white font-bold py-4 px-8 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2 whitespace-nowrap"
            onClick={createClass}
            disabled={creating || !newName.trim()}
          >
            {creating ? <Loader2 size={20} className="animate-spin" /> : <Plus size={20} />}
            Tạo lớp học
          </button>
        </div>

        {/* Classes List */}
        <div>
          <h2 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-3">
            Các lớp học đang giảng dạy
            <span className="bg-indigo-100 text-indigo-700 text-sm font-bold px-3 py-1 rounded-full">{items.length}</span>
          </h2>

          {items.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200 border-dashed p-16 flex flex-col items-center text-center">
              <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                <Presentation size={40} className="text-slate-300" />
              </div>
              <h3 className="text-xl font-bold text-slate-700 mb-2">Chưa có lớp học nào</h3>
              <p className="text-slate-500 max-w-md">Hãy tạo lớp học đầu tiên phía trên để bắt đầu thêm học viên và quản lý tiến độ học tập.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {items.map((c) => (
                <div key={c.id} className="group relative bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl hover:shadow-indigo-100/50 hover:border-indigo-200 transition-all duration-300 overflow-hidden flex flex-col">
                  
                  {/* Decorative Gradient Line */}
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-purple-500 transform origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-500"></div>

                  <div className="p-6 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between mb-4">
                        <div 
                          className="cursor-pointer"
                          onClick={() => router.push(`/teacher/dashboard/${c.id}`)}
                        >
                          <h2 className="text-xl font-bold text-slate-800 group-hover:text-indigo-600 transition-colors flex items-center gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-slate-50 group-hover:bg-indigo-50 text-slate-600 group-hover:text-indigo-600 flex items-center justify-center text-xl shrink-0 transition-colors">
                              {c.name.charAt(0).toUpperCase()}
                            </div>
                            <span className="line-clamp-2">{c.name}</span>
                          </h2>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {(c.pendingReviewCount || 0) > 0 && (
                            <div className="bg-rose-50 text-rose-600 border border-rose-100 px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-sm">
                              <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                              </span>
                              {c.pendingReviewCount} bài chờ chấm
                            </div>
                          )}
                          <button 
                            onClick={() => deleteClass(c.id)}
                            className="text-slate-400 hover:text-rose-500 hover:bg-rose-50 p-2.5 rounded-xl transition-colors"
                            title="Xóa lớp học"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                      
                      <div 
                        className="flex flex-wrap items-center gap-3 mt-6 cursor-pointer"
                        onClick={() => router.push(`/teacher/dashboard/${c.id}`)}
                      >
                        <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-xl text-sm text-slate-600 font-medium">
                          <Users size={18} className="text-indigo-500" />
                          <span className="font-bold text-slate-800">{c.studentCount}</span> học viên
                        </div>
                        <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-xl text-sm text-slate-600 font-medium">
                          <FileText size={18} className="text-purple-500" />
                          <span className="font-bold text-slate-800">{c.quizCount}</span> bài tập đã giao
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Invite Code Display */}
                  <div className="bg-slate-50/80 px-6 py-4 border-t border-slate-100 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
                      Mã lớp:
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-sm font-bold text-indigo-600 tracking-wider">
                        {c.inviteCode}
                      </code>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(c.inviteCode);
                          alert('Đã copy mã lớp học!');
                        }}
                        className="text-slate-400 hover:text-indigo-600 p-1.5 rounded-lg transition-colors"
                        title="Copy mã lớp"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </TeacherShell>
  )
}
