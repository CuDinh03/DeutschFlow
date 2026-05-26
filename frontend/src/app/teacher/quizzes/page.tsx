'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import api, { httpStatus, apiMessage } from '@/lib/api'
import { logout } from '@/lib/authSession'
import { TeacherShell } from '@/components/layouts/TeacherShell'
import { usePendingGradingCount } from '@/hooks/usePendingGradingCount'
import { FileText, Plus, Loader2, Play, CheckCircle, Save, Settings, Copy, Check, Trash2, Edit, BarChart2, X, Trophy } from 'lucide-react'

type Quiz = {
  id: number
  title: string
  quizType: 'COLOR_RACE' | 'SENTENCE_BATTLE' | 'AI_INTERVIEW'
  status: 'DRAFT' | 'WAITING' | 'ACTIVE' | 'FINISHED'
  pinCode: string
  questionCount: number
  classroomName?: string | null
}

export default function TeacherQuizzesPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [items, setItems] = useState<Quiz[]>([])
  const [title, setTitle] = useState('')
  const [quizType, setQuizType] = useState<'COLOR_RACE' | 'SENTENCE_BATTLE' | 'AI_INTERVIEW'>('COLOR_RACE')
  const [creating, setCreating] = useState(false)
  const [userName, setUserName] = useState('Giáo viên')
  const { count: pendingGradingCount } = usePendingGradingCount()
  
  // Question states per quiz
  const [questionText, setQuestionText] = useState<Record<number, string>>({})
  const [choiceA, setChoiceA] = useState<Record<number, string>>({})
  const [choiceB, setChoiceB] = useState<Record<number, string>>({})
  const [addingQId, setAddingQId] = useState<number | null>(null)
  
  // Edit & Results state
  const [editingQuiz, setEditingQuiz] = useState<Quiz | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editType, setEditType] = useState<'COLOR_RACE' | 'SENTENCE_BATTLE' | 'AI_INTERVIEW'>('COLOR_RACE')
  
  const [viewingResults, setViewingResults] = useState<{quizId: number, results: any[]} | null>(null)
  const [loadingResults, setLoadingResults] = useState(false)
  
  // Copy state
  const [copiedPin, setCopiedPin] = useState<string | null>(null)

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

      const res = await api.get('/teacher/quizzes')
      setItems(res.data ?? [])
    } catch (e: unknown) {
      if (httpStatus(e) === 401) {
        router.push('/login')
        return
      }
      setError('Không thể tải danh sách bài tập.')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    load()
  }, [load])

  const createQuiz = async () => {
    if (!title.trim()) return
    setError('')
    setCreating(true)
    try {
      await api.post('/teacher/quizzes', { title: title.trim(), quizType })
      setTitle('')
      await load()
    } catch (e: unknown) {
      setError(apiMessage(e))
    } finally {
      setCreating(false)
    }
  }

  const updateStatus = async (id: number, action: 'publish' | 'start' | 'finish') => {
    setError('')
    try {
      await api.post(`/teacher/quizzes/${id}/${action}`)
      await load()
    } catch (e: unknown) {
      setError(apiMessage(e))
    }
  }

  const deleteQuiz = async (id: number) => {
    if (!confirm('Bạn có chắc chắn muốn xóa bài tập này? Mọi dữ liệu kết quả sẽ bị xóa vĩnh viễn.')) return
    setError('')
    try {
      await api.delete(`/teacher/quizzes/${id}`)
      await load()
    } catch (e: unknown) {
      setError(apiMessage(e))
    }
  }

  const openEdit = (q: Quiz) => {
    setEditingQuiz(q)
    setEditTitle(q.title)
    setEditType(q.quizType)
  }

  const saveEdit = async () => {
    if (!editingQuiz || !editTitle.trim()) return
    setError('')
    try {
      await api.put(`/teacher/quizzes/${editingQuiz.id}`, { 
        title: editTitle.trim(), 
        quizType: editType 
      })
      setEditingQuiz(null)
      await load()
    } catch (e: unknown) {
      setError(apiMessage(e))
    }
  }

  const openResults = async (id: number) => {
    setLoadingResults(true)
    setViewingResults({ quizId: id, results: [] })
    try {
      const res = await api.get(`/teacher/quizzes/${id}/results`)
      setViewingResults({ quizId: id, results: res.data ?? [] })
    } catch (e: unknown) {
      setError(apiMessage(e))
      setViewingResults(null)
    } finally {
      setLoadingResults(false)
    }
  }

  const addQuestion = async (id: number) => {
    const question = (questionText[id] ?? '').trim()
    const a = (choiceA[id] ?? '').trim()
    const b = (choiceB[id] ?? '').trim()
    if (!question || !a || !b) return
    setError('')
    setAddingQId(id)
    try {
      await api.post(`/teacher/quizzes/${id}/questions`, {
        question,
        choices: [
          { content: a, isCorrect: true },
          { content: b, isCorrect: false },
        ],
      })
      setQuestionText((prev) => ({ ...prev, [id]: '' }))
      setChoiceA((prev) => ({ ...prev, [id]: '' }))
      setChoiceB((prev) => ({ ...prev, [id]: '' }))
      await load()
    } catch (e: unknown) {
      setError(apiMessage(e))
    } finally {
      setAddingQId(null)
    }
  }

  const handleCopyPin = (pin: string) => {
    if (!pin) return
    navigator.clipboard.writeText(pin)
    setCopiedPin(pin)
    setTimeout(() => setCopiedPin(null), 2000)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DRAFT': return <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-bold border border-slate-200">Bản nháp</span>
      case 'WAITING': return <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-bold border border-amber-200">Đang chờ</span>
      case 'ACTIVE': return <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold border border-emerald-200 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Đang diễn ra</span>
      case 'FINISHED': return <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold border border-indigo-200">Đã kết thúc</span>
      default: return <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-bold">{status}</span>
    }
  }

  const getTypeInfo = (type: string) => {
    switch(type) {
      case 'AI_INTERVIEW': return { label: 'Bài tập Nói AI', color: 'bg-purple-100 text-purple-700 border-purple-200' }
      case 'COLOR_RACE': return { label: 'Đua màu sắc', color: 'bg-blue-100 text-blue-700 border-blue-200' }
      case 'SENTENCE_BATTLE': return { label: 'Ghép câu', color: 'bg-teal-100 text-teal-700 border-teal-200' }
      default: return { label: type, color: 'bg-slate-100 text-slate-700 border-slate-200' }
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 size={32} className="animate-spin text-indigo-600" />
          <p className="font-medium text-slate-500">Đang tải dữ liệu bài tập...</p>
        </div>
      </div>
    )
  }

  return (
    <TeacherShell
      activeMenu="quizzes"
      userName={userName}
      pendingGradingCount={pendingGradingCount}
      onLogout={() => void logout()}
      headerTitle="Quản lý Bài tập & Quiz"
      headerSubtitle="Tạo và quản lý các bài tập tương tác cho học viên"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-600 px-4 py-3 rounded-xl text-sm font-medium flex items-start gap-3">
            <span>{error}</span>
          </div>
        )}

        {/* Create Quiz Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
            <FileText size={120} />
          </div>
          <h2 className="font-bold text-slate-800 mb-6 flex items-center gap-2 relative z-10">
            <Plus size={20} className="text-indigo-600" />
            Tạo bài tập mới
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 relative z-10">
            <div className="md:col-span-6">
              <label className="block text-xs font-bold text-slate-500 mb-1">Tiêu đề bài tập</label>
              <input
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow"
                placeholder="VD: Kiểm tra từ vựng Lektion 1"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="md:col-span-4">
              <label className="block text-xs font-bold text-slate-500 mb-1">Loại bài tập</label>
              <select 
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow appearance-none"
                value={quizType} 
                onChange={(e) => setQuizType(e.target.value as any)}
              >
                <option value="COLOR_RACE">Trắc nghiệm nhanh (Color Race)</option>
                <option value="SENTENCE_BATTLE">Sắp xếp câu (Sentence Battle)</option>
                <option value="AI_INTERVIEW">Luyện nói AI (AI Interview)</option>
              </select>
            </div>
            <div className="md:col-span-2 flex items-end">
              <button
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-md hover:shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
                onClick={createQuiz}
                disabled={creating || !title.trim()}
              >
                {creating ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                Tạo mới
              </button>
            </div>
          </div>
        </div>

        {/* Quizzes List */}
        {items.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 flex flex-col items-center text-center">
             <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                <FileText size={32} className="text-slate-400" />
             </div>
             <h3 className="text-lg font-bold text-slate-700">Chưa có bài tập nào</h3>
             <p className="text-slate-500 mt-2 max-w-sm">Bắt đầu tạo bài tập đầu tiên phía trên. Bạn có thể chọn trắc nghiệm, sắp xếp câu hoặc luyện nói AI.</p>
          </div>
        ) : (
          <div className="grid gap-6">
            {items.map((q) => {
              const typeInfo = getTypeInfo(q.quizType)
              return (
              <div key={q.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                
                {/* Header */}
                <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-3 mb-2">
                      <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        {q.title}
                        {q.status === 'DRAFT' && (
                          <>
                            <button onClick={() => openEdit(q)} className="text-slate-400 hover:text-indigo-600 transition-colors p-1" title="Sửa tiêu đề">
                              <Edit size={16} />
                            </button>
                            <button onClick={() => deleteQuiz(q.id)} className="text-slate-400 hover:text-rose-600 transition-colors p-1" title="Xóa bài tập">
                              <Trash2 size={16} />
                            </button>
                          </>
                        )}
                        {(q.status === 'WAITING' || q.status === 'FINISHED') && (
                           <button onClick={() => deleteQuiz(q.id)} className="text-slate-400 hover:text-rose-600 transition-colors p-1" title="Xóa bài tập">
                              <Trash2 size={16} />
                           </button>
                        )}
                      </h2>
                      {getStatusBadge(q.status)}
                      <span className={`px-3 py-1 rounded-full text-xs font-bold border ${typeInfo.color}`}>
                        {typeInfo.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-slate-500 font-medium mt-3">
                       <span className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                          <span className="text-xs uppercase tracking-wider text-slate-400 font-bold">Mã PIN:</span>
                          <span className="font-mono font-bold text-slate-800 text-base tracking-widest">{q.pinCode || '---'}</span>
                          {q.pinCode && (
                            <button onClick={() => handleCopyPin(q.pinCode)} className="ml-1 text-indigo-500 hover:text-indigo-700 transition-colors" title="Copy PIN">
                              {copiedPin === q.pinCode ? <Check size={16} /> : <Copy size={16} />}
                            </button>
                          )}
                       </span>
                       <span>• {q.questionCount} câu hỏi</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-100">
                    <button 
                      className="bg-white border border-slate-200 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 text-slate-600 font-bold py-2 px-4 rounded-lg text-sm transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                      onClick={() => updateStatus(q.id, 'publish')}
                      disabled={q.status !== 'DRAFT'}
                      title="Mở đăng ký cho học viên"
                    >
                      <Settings size={16} /> Publish
                    </button>
                    <button 
                      className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2 px-4 rounded-lg text-sm transition-all shadow-md hover:shadow-lg flex items-center gap-1.5 disabled:opacity-50"
                      onClick={() => updateStatus(q.id, 'start')}
                      disabled={q.status === 'ACTIVE' || q.status === 'FINISHED' || q.status === 'DRAFT'}
                      title="Bắt đầu bài làm"
                    >
                      <Play size={16} className="fill-white" /> Start
                    </button>
                    <button 
                      className="bg-slate-800 hover:bg-slate-900 text-white font-bold py-2 px-4 rounded-lg text-sm transition-all shadow-md flex items-center gap-1.5 disabled:opacity-50"
                      onClick={() => updateStatus(q.id, 'finish')}
                      disabled={q.status === 'FINISHED' || q.status === 'DRAFT'}
                      title="Kết thúc bài tập"
                    >
                      <CheckCircle size={16} /> Finish
                    </button>
                    {q.status === 'FINISHED' && (
                      <button 
                        className="bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 font-bold py-2 px-4 rounded-lg text-sm transition-all shadow-sm flex items-center gap-1.5 ml-2"
                        onClick={() => openResults(q.id)}
                        title="Xem bảng điểm"
                      >
                        <BarChart2 size={16} /> Kết quả
                      </button>
                    )}
                  </div>
                </div>

                {/* Body - Questions Manager */}
                <div className="p-6 bg-slate-50">
                  {q.quizType !== 'AI_INTERVIEW' ? (
                    <div className="space-y-4 max-w-4xl">
                      <h3 className="font-bold text-slate-700 text-sm flex items-center gap-2 mb-3">
                        <Plus size={16} className="text-indigo-500" /> Thêm câu hỏi mới
                      </h3>
                      
                      <div className="grid md:grid-cols-12 gap-3">
                        <div className="md:col-span-12">
                           <input
                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="Nội dung câu hỏi..."
                            value={questionText[q.id] ?? ''}
                            onChange={(e) => setQuestionText((prev) => ({ ...prev, [q.id]: e.target.value }))}
                          />
                        </div>
                        <div className="md:col-span-5 relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <CheckCircle size={16} className="text-emerald-500" />
                          </div>
                          <input
                            className="w-full bg-emerald-50/50 border border-emerald-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-emerald-800 placeholder:text-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            placeholder="Đáp án đúng"
                            value={choiceA[q.id] ?? ''}
                            onChange={(e) => setChoiceA((prev) => ({ ...prev, [q.id]: e.target.value }))}
                          />
                        </div>
                        <div className="md:col-span-5 relative">
                           <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <span className="w-4 h-4 rounded-full border-2 border-rose-400 flex items-center justify-center text-[10px] font-bold text-rose-500">X</span>
                          </div>
                          <input
                            className="w-full bg-rose-50/50 border border-rose-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-rose-800 placeholder:text-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-500"
                            placeholder="Đáp án sai"
                            value={choiceB[q.id] ?? ''}
                            onChange={(e) => setChoiceB((prev) => ({ ...prev, [q.id]: e.target.value }))}
                          />
                        </div>
                        <div className="md:col-span-2">
                           <button 
                            className="w-full h-full bg-white border border-indigo-200 text-indigo-600 hover:bg-indigo-50 font-bold py-2.5 px-3 rounded-xl transition-colors text-sm shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
                            onClick={() => addQuestion(q.id)}
                            disabled={addingQId === q.id || !(questionText[q.id] ?? '').trim()}
                          >
                            {addingQId === q.id ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                            Lưu
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-purple-50 border border-purple-100 rounded-xl p-5 flex items-start gap-4">
                      <div className="w-10 h-10 rounded-full bg-purple-200 text-purple-700 flex items-center justify-center shrink-0">
                        <span className="font-bold">AI</span>
                      </div>
                      <div>
                        <p className="font-bold text-purple-900 mb-1">Chế độ chấm điểm tự động</p>
                        <p className="text-sm text-purple-700 leading-relaxed">
                          Bài tập Nói AI không cần bạn phải thêm câu hỏi thủ công. Trí tuệ nhân tạo sẽ đóng vai người phỏng vấn, tự động điều phối cuộc trò chuyện với học viên dựa trên chủ đề <strong>{'"'}{q.title}{'"'}</strong> và chấm điểm phát âm, ngữ pháp theo thời gian thực.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

              </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Edit Quiz Modal */}
      {editingQuiz && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl relative animate-in fade-in zoom-in duration-200">
            <button onClick={() => setEditingQuiz(null)} className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 p-2 rounded-full transition-colors">
              <X size={20} />
            </button>
            <h2 className="text-2xl font-black text-slate-800 mb-6 flex items-center gap-2">
              <Edit className="text-indigo-600" /> Sửa thông tin
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Tiêu đề bài tập</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Loại bài tập</label>
                <select
                  value={editType}
                  onChange={(e) => setEditType(e.target.value as any)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                >
                  <option value="COLOR_RACE">Trắc nghiệm nhanh (Color Race)</option>
                  <option value="SENTENCE_BATTLE">Sắp xếp câu (Sentence Battle)</option>
                  <option value="AI_INTERVIEW">Luyện nói AI (AI Interview)</option>
                </select>
              </div>
              <div className="flex gap-3 justify-end pt-4">
                <button
                  onClick={() => setEditingQuiz(null)}
                  className="px-6 py-3 font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Hủy
                </button>
                <button
                  onClick={saveEdit}
                  disabled={!editTitle.trim()}
                  className="px-6 py-3 font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors disabled:opacity-50 shadow-md"
                >
                  Lưu thay đổi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Results Modal */}
      {viewingResults && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-8 max-w-2xl w-full shadow-2xl relative animate-in fade-in zoom-in duration-200 max-h-[90vh] flex flex-col">
            <button onClick={() => setViewingResults(null)} className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 p-2 rounded-full transition-colors z-10">
              <X size={20} />
            </button>
            <h2 className="text-2xl font-black text-slate-800 mb-2 flex items-center gap-2 shrink-0">
              <Trophy className="text-amber-500" /> Kết quả bài tập
            </h2>
            <p className="text-slate-500 mb-6 shrink-0">Danh sách xếp hạng học viên tham gia quiz</p>
            
            <div className="overflow-y-auto pr-2 custom-scrollbar flex-1">
              {loadingResults ? (
                <div className="py-12 flex justify-center"><Loader2 size={32} className="animate-spin text-indigo-600" /></div>
              ) : viewingResults.results.length === 0 ? (
                <div className="py-12 text-center text-slate-500 border border-dashed rounded-2xl bg-slate-50">
                  Chưa có học viên nào tham gia bài tập này.
                </div>
              ) : (
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-sm sticky top-0 z-10">
                    <tr>
                      <th className="px-6 py-4 font-semibold text-center w-16">Hạng</th>
                      <th className="px-6 py-4 font-semibold">Học viên</th>
                      <th className="px-6 py-4 font-semibold text-right">Điểm số</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {viewingResults.results.map((r, i) => (
                      <tr key={i} className="hover:bg-slate-50 transition-colors">
                         <td className="px-6 py-4 text-center font-bold text-xl text-slate-400">
                          {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-800">{r.user?.displayName || r.userId || 'Học viên ẩn danh'}</div>
                        </td>
                        <td className="px-6 py-4 text-right font-mono font-bold text-indigo-600">
                          {r.score} điểm
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </TeacherShell>
  )
}
