'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import api, { httpStatus, apiMessage } from '@/lib/api'
import { TeacherShell } from '@/components/layouts/TeacherShell'
import { Users, Trash2, UserPlus, FileText, Loader2, Plus, Mail } from 'lucide-react'

type Classroom = {
  id: number
  name: string
  studentCount: number
  quizCount: number
}

export default function TeacherClassesPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [items, setItems] = useState<Classroom[]>([])
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [studentEmail, setStudentEmail] = useState<Record<number, string>>({})
  const [addingId, setAddingId] = useState<number | null>(null)
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

      const res = await api.get('/teacher/classes')
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
      await api.post('/teacher/classes', { name: newName.trim() })
      setNewName('')
      await load()
    } catch (e: unknown) {
      setError(apiMessage(e))
    } finally {
      setCreating(false)
    }
  }

  const deleteClass = async (id: number) => {
    if (!confirm('Bạn có chắc chắn muốn xóa lớp học này? Mọi dữ liệu sẽ bị xóa và không thể khôi phục.')) return
    setError('')
    try {
      await api.delete(`/teacher/classes/${id}`)
      await load()
    } catch (e: unknown) {
      setError(apiMessage(e))
    }
  }

  const addStudent = async (id: number) => {
    const email = (studentEmail[id] ?? '').trim()
    if (!email) return
    setError('')
    setAddingId(id)
    try {
      await api.post(`/teacher/classes/${id}/students`, { email })
      setStudentEmail((prev) => ({ ...prev, [id]: '' }))
      await load()
    } catch (e: unknown) {
      setError(apiMessage(e))
    } finally {
      setAddingId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 size={32} className="animate-spin text-indigo-600" />
          <p className="font-medium text-slate-500">Đang tải dữ liệu lớp học...</p>
        </div>
      </div>
    )
  }

  return (
    <TeacherShell
      activeMenu="classes"
      userName={userName}
      onLogout={() => {
        // Simple logout for now, rely on dashboard auth logic
        router.push('/')
      }}
      headerTitle="Quản lý Lớp học"
      headerSubtitle="Tổ chức học viên thành các lớp để giao bài tập"
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-600 px-4 py-3 rounded-xl text-sm font-medium flex items-start gap-3">
            <span>{error}</span>
          </div>
        )}

        {/* Create Class Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-8">
          <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Plus size={20} className="text-indigo-600" />
            Tạo lớp học mới
          </h2>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow"
              placeholder="Nhập tên lớp học (VD: A1.1 Lớp tối 2-4-6)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && createClass()}
            />
            <button
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              onClick={createClass}
              disabled={creating || !newName.trim()}
            >
              {creating ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
              Tạo lớp học
            </button>
          </div>
        </div>

        {/* Classes List */}
        {items.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 flex flex-col items-center text-center">
             <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                <Users size={32} className="text-slate-400" />
             </div>
             <h3 className="text-lg font-bold text-slate-700">Chưa có lớp học nào</h3>
             <p className="text-slate-500 mt-2 max-w-sm">Hãy tạo lớp học đầu tiên phía trên để bắt đầu thêm học viên và quản lý tiến độ học tập.</p>
          </div>
        ) : (
          <div className="grid gap-6">
            {items.map((c) => (
              <div key={c.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col md:flex-row">
                
                {/* Class Info */}
                <div className="p-6 flex-1 border-b md:border-b-0 md:border-r border-slate-100 flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between mb-2">
                      <h2 className="text-xl font-bold text-slate-800 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-100 to-purple-100 text-indigo-700 flex items-center justify-center text-lg shrink-0">
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                        {c.name}
                      </h2>
                      <button 
                        onClick={() => deleteClass(c.id)}
                        className="text-slate-400 hover:text-rose-500 hover:bg-rose-50 p-2 rounded-lg transition-colors"
                        title="Xóa lớp học"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-6 mt-4 pl-14">
                      <div className="flex items-center gap-2 text-sm text-slate-600 font-medium">
                        <Users size={16} className="text-indigo-500" />
                        <span className="font-bold text-slate-800">{c.studentCount}</span> học viên
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-600 font-medium">
                        <FileText size={16} className="text-purple-500" />
                        <span className="font-bold text-slate-800">{c.quizCount}</span> bài tập / quiz
                      </div>
                    </div>
                  </div>
                </div>

                {/* Add Student Action */}
                <div className="p-6 md:w-96 bg-slate-50 flex flex-col justify-center">
                  <p className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                    <UserPlus size={16} className="text-emerald-600" />
                    Thêm học viên vào lớp
                  </p>
                  <div className="flex flex-col gap-2">
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Mail size={16} className="text-slate-400" />
                      </div>
                      <input
                        className="w-full bg-white border border-slate-200 rounded-lg pl-10 pr-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="Email học viên (đã có tài khoản)"
                        value={studentEmail[c.id] ?? ''}
                        onChange={(e) => setStudentEmail((prev) => ({ ...prev, [c.id]: e.target.value }))}
                        onKeyDown={(e) => e.key === 'Enter' && addStudent(c.id)}
                      />
                    </div>
                    <button
                      className="w-full bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-bold py-2.5 px-4 rounded-lg transition-colors text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                      onClick={() => addStudent(c.id)}
                      disabled={addingId === c.id || !(studentEmail[c.id] ?? '').trim()}
                    >
                      {addingId === c.id ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                      Thêm học viên
                    </button>
                  </div>
                </div>

              </div>
            ))}
          </div>
        )}
      </div>
    </TeacherShell>
  )
}
