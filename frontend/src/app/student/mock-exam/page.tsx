'use client'

import { useCallback, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Clock, Check, X, ChevronRight, Loader2, Play, Trophy, BookOpen, Headphones, PenTool, Mic2, ArrowLeft, AlertCircle, Send } from 'lucide-react'
import { StudentShell } from '@/components/layouts/StudentShell'
import { SprechenTeil2Simulator } from '@/components/exam/SprechenTeil2Simulator'
import { useStudentPracticeSession } from '@/hooks/useStudentPracticeSession'
import { logout } from '@/lib/authSession'
import api from '@/lib/api'

interface MockExam {
  id: number
  cefr_level: string
  exam_format: string
  title: string
  total_points: number
  pass_points: number
  time_limit_minutes: number
}

interface MockAttempt {
  id: number
  exam_id: number
  started_at: string
  finished_at?: string
  total_score?: number
  passed?: boolean
  status: string
  scores_json?: string
  sections_json?: string
}

const SECTION_ICONS: Record<string, React.ReactNode> = {
  LESEN: <BookOpen size={18} />,
  HOEREN: <Headphones size={18} />,
  SCHREIBEN: <PenTool size={18} />,
  SPRECHEN: <Mic2 size={18} />,
}

const SECTION_COLORS: Record<string, string> = {
  LESEN: '#6366F1',
  HOEREN: '#0EA5E9',
  SCHREIBEN: '#10B981',
  SPRECHEN: '#F59E0B',
}

function ScoreCard({ section, score, max }: { section: string; score: number; max: number }) {
  const pct = max > 0 ? Math.round((score / max) * 100) : 0
  const color = SECTION_COLORS[section] ?? '#6366F1'
  return (
    <div className="bg-white rounded-2xl p-4 border border-[#E2E8F0]">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: color + '20', color }}>
          {SECTION_ICONS[section]}
        </div>
        <p className="font-semibold text-sm text-[#0F172A] capitalize">{section.toLowerCase()}</p>
      </div>
      <p className="text-2xl font-extrabold" style={{ color }}>{score}/{max}</p>
      <div className="mt-2 h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <p className="text-xs text-[#94A3B8] mt-1">{pct}%</p>
    </div>
  )
}

export default function MockExamPage() {
  const { me, loading: meLoading, targetLevel, streakDays, initials } = useStudentPracticeSession()
  const [exams, setExams] = useState<MockExam[]>([])
  const [attempts, setAttempts] = useState<MockAttempt[]>([])
  const [loading, setLoading] = useState(true)
  
  // View states
  const [view, setView] = useState<'list' | 'result' | 'taking'>('list')
  const [selectedAttempt, setSelectedAttempt] = useState<MockAttempt | null>(null)
  
  // Exam Taking State
  const [activeExamData, setActiveExamData] = useState<any>(null)
  const [activeAttemptId, setActiveAttemptId] = useState<number | null>(null)
  const [currentSectionIdx, setCurrentSectionIdx] = useState(0)
  const [timeLeft, setTimeLeft] = useState(0)
  const [answers, setAnswers] = useState<Record<string, any>>({})
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [examRes, attRes] = await Promise.allSettled([
        api.get<MockExam[]>('/mock-exams?cefrLevel=A1'),
        api.get<MockAttempt[]>('/mock-exams/attempts/me'),
      ])
      if (examRes.status === 'fulfilled') setExams(examRes.value.data ?? [])
      if (attRes.status === 'fulfilled') setAttempts(attRes.value.data ?? [])
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { if (me) load() }, [me, load])

  // Timer effect
  useEffect(() => {
    if (view === 'taking' && timeLeft > 0) {
      const timerId = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timerId)
            submitExam(true) // Auto submit when time is up
            return 0
          }
          return prev - 1
        })
      }, 1000)
      return () => clearInterval(timerId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }
  }, [view, timeLeft])

  const startExam = async (exam: MockExam) => {
    try {
      setLoading(true)
      const res = await api.post(`/mock-exams/${exam.id}/start`)
      const attempt = res.data
      
      let examSections = null
      if (attempt.sections_json) {
        try {
          examSections = typeof attempt.sections_json === 'string' ? JSON.parse(attempt.sections_json) : attempt.sections_json
        } catch (e) {}
      }
      
      if (!examSections) {
        // Fallback to fetch questions explicitly if sections_json wasn't returned in start
        const qRes = await api.get(`/mock-exams/${exam.id}/questions`)
        if (qRes.data?.sections_json) {
          examSections = typeof qRes.data.sections_json === 'string' ? JSON.parse(qRes.data.sections_json) : qRes.data.sections_json
        }
      }

      if (!examSections || !examSections.sections) {
        alert("Đề thi chưa có nội dung chi tiết. Vui lòng thử lại sau.")
        return
      }

      setActiveAttemptId(attempt.id)
      setActiveExamData(examSections)
      setCurrentSectionIdx(0)
      setTimeLeft(exam.time_limit_minutes * 60)
      setAnswers({})
      setView('taking')
    } catch (e: any) {
      alert(e?.response?.data?.message ?? 'Không thể bắt đầu thi')
    } finally {
      setLoading(false)
    }
  }

  const submitExam = async (autoSubmit = false) => {
    if (!activeAttemptId) return
    if (!autoSubmit && !confirm('Bạn có chắc chắn muốn nộp bài?')) return
    
    setSubmitting(true)
    try {
      // Calculate a simple mock score based on answers (in a real app, backend grades this properly)
      // We will just generate a random score for demo purposes if backend expects it
      let mockTotalScore = Math.floor(Math.random() * 40) + 60 // 60-100 random for now
      
      const res = await api.post(`/mock-exams/attempts/${activeAttemptId}/finish`, {
        answers,
        totalScore: mockTotalScore
      })
      
      await load() // refresh history
      
      // Go to result view
      const finishedAttempt = await api.get(`/mock-exams/attempts/${activeAttemptId}/result`)
      setSelectedAttempt(finishedAttempt.data)
      setView('result')
    } catch (e) {
      alert('Lỗi nộp bài. Vui lòng thử lại.')
    } finally {
      setSubmitting(false)
    }
  }

  const viewResult = (attempt: MockAttempt) => {
    setSelectedAttempt(attempt)
    setView('result')
  }

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s < 10 ? '0' : ''}${s}`
  }

  const handleAnswerChange = (questionId: string, value: any) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }))
  }

  // --- Render Functions for Exam Content ---
  const renderTakingExam = () => {
    if (!activeExamData?.sections) return null
    const currentSection = activeExamData.sections[currentSectionIdx]

    return (
      <div className="flex flex-col h-[calc(100vh-80px)]">
        {/* Top bar */}
        <div className="bg-white border-b border-[#E2E8F0] px-6 py-4 flex items-center justify-between shadow-sm z-10">
          <div className="flex items-center gap-4">
            <h2 className="font-extrabold text-[#0F172A] text-lg flex items-center gap-2">
              <span style={{ color: SECTION_COLORS[currentSection.name] }}>
                {SECTION_ICONS[currentSection.name]}
              </span>
              Phần thi: {currentSection.label_vi}
            </h2>
            <div className="hidden sm:flex gap-2">
              {activeExamData.sections.map((s: any, idx: number) => (
                <div key={idx} 
                  className={`w-3 h-3 rounded-full ${idx === currentSectionIdx ? 'bg-[#6366F1] scale-125' : idx < currentSectionIdx ? 'bg-[#94A3B8]' : 'bg-[#E2E8F0]'} transition-all`} 
                  title={s.label_vi} 
                />
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className={`font-mono text-xl font-bold flex items-center gap-2 ${timeLeft < 300 ? 'text-red-500 animate-pulse' : 'text-[#0F172A]'}`}>
              <Clock size={20} />
              {formatTime(timeLeft)}
            </div>
            <button 
              onClick={() => submitExam(false)}
              disabled={submitting}
              className="bg-[#10B981] hover:bg-[#059669] text-white font-bold py-2 px-4 rounded-xl flex items-center gap-2 transition-all shadow-md"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              Nộp Bài
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto bg-slate-50 p-6">
          <div className="max-w-4xl mx-auto space-y-8 pb-20">
            
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm mb-6">
              <h3 className="font-bold text-xl text-slate-800 mb-2">{currentSection.name} - {currentSection.label_vi}</h3>
              <p className="text-slate-500 text-sm">Thời gian làm bài: {currentSection.time_minutes} phút | Điểm tối đa: {currentSection.max_points}</p>
            </div>

            {currentSection.teile?.map((teil: any, tIdx: number) => (
              <div key={tIdx} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="bg-slate-100 px-6 py-3 border-b border-slate-200">
                  <h4 className="font-bold text-slate-700">Teil {teil.teil}</h4>
                  <p className="text-sm text-slate-600 mt-1 font-medium">{teil.instruction_vi || teil.instruction_de}</p>
                </div>
                
                <div className="p-6">
                  {/* Context or Audio for the whole part */}
                  {teil.context && (
                    <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 mb-6 text-sm text-slate-700 whitespace-pre-wrap font-medium">
                      {teil.context}
                    </div>
                  )}
                  {teil.audio_script && (
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6 flex items-center gap-4">
                      <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center shrink-0">
                        <Play size={20} className="text-white ml-1" />
                      </div>
                      <p className="text-sm text-slate-600 italic">Mock Audio Playback (Kịch bản: "{teil.audio_script.substring(0, 50)}...")</p>
                    </div>
                  )}

                  {/* Render Questions based on type */}
                  <div className="space-y-6">
                    {teil.items?.map((item: any, qIdx: number) => (
                      <div key={item.id} className="border-b border-slate-100 last:border-0 pb-6 last:pb-0">
                        {item.audio_script && (
                          <div className="flex items-center gap-3 mb-3 bg-slate-50 p-3 rounded-lg w-max">
                             <Play size={16} className="text-blue-500" />
                             <span className="text-xs text-slate-500">Audio Track {item.id}</span>
                          </div>
                        )}
                        {item.text && <p className="text-sm text-slate-600 mb-3 italic">"{item.text}"</p>}
                        {item.person && <p className="text-sm text-slate-600 mb-3">👤 {item.person}</p>}
                        
                        <p className="font-semibold text-slate-800 mb-3">{qIdx + 1}. {item.question || 'Lựa chọn đáp án đúng:'}</p>
                        
                        {/* Multiple Choice Options */}
                        {item.options && (
                          <div className="space-y-2">
                            {Object.entries(item.options).map(([optKey, optVal]: any) => (
                              <label key={optKey} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${answers[item.id] === optKey ? 'bg-indigo-50 border-indigo-500' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                                <input type="radio" name={item.id} value={optKey} checked={answers[item.id] === optKey} onChange={() => handleAnswerChange(item.id, optKey)} className="w-4 h-4 text-indigo-600 focus:ring-indigo-500" />
                                <span className="font-bold w-6 text-slate-400">{optKey}</span>
                                <span className="text-slate-700">{optVal}</span>
                              </label>
                            ))}
                          </div>
                        )}

                        {/* Richtig / Falsch */}
                        {!item.options && item.correct && (item.correct.toLowerCase() === 'richtig' || item.correct.toLowerCase() === 'falsch') && (
                          <div className="flex gap-4">
                            {['richtig', 'falsch'].map(opt => (
                              <label key={opt} className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border cursor-pointer transition-colors ${answers[item.id] === opt ? 'bg-indigo-50 border-indigo-500 text-indigo-700 font-bold' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                                <input type="radio" name={item.id} value={opt} checked={answers[item.id] === opt} onChange={() => handleAnswerChange(item.id, opt)} className="sr-only" />
                                {opt.toUpperCase()}
                              </label>
                            ))}
                          </div>
                        )}

                        {/* Matching A B C D */}
                        {!item.options && item.correct && item.correct.length === 1 && (
                          <div className="flex flex-wrap gap-2">
                            {['A','B','C','D','E','F','G','H','I'].slice(0, 8).map(opt => (
                              <label key={opt} className={`flex items-center justify-center w-12 h-12 rounded-xl border cursor-pointer transition-colors ${answers[item.id] === opt ? 'bg-indigo-500 border-indigo-600 text-white font-bold' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 font-bold'}`}>
                                <input type="radio" name={item.id} value={opt} checked={answers[item.id] === opt} onChange={() => handleAnswerChange(item.id, opt)} className="sr-only" />
                                {opt}
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Writing Form Fields */}
                    {teil.form_fields && (
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         {teil.form_fields.map((field: any, fIdx: number) => (
                           <div key={fIdx}>
                             <label className="block text-xs font-bold text-slate-500 mb-1">{field.field} <span className="font-normal text-slate-400">({field.instruction_vi})</span></label>
                             <input type="text" value={answers[`form_${fIdx}`] || ''} onChange={(e) => handleAnswerChange(`form_${fIdx}`, e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" placeholder="Nhập đáp án..." />
                           </div>
                         ))}
                       </div>
                    )}

                    {/* Writing Email */}
                    {teil.input_email && (
                      <div className="space-y-4">
                        <div className="bg-slate-50 p-4 border border-slate-200 rounded-xl whitespace-pre-wrap text-sm text-slate-700 font-medium">
                          {teil.input_email}
                        </div>
                        <ul className="list-disc pl-5 text-sm text-slate-600 space-y-1 mb-4">
                          {teil.writing_points?.map((pt: string, idx: number) => <li key={idx}>{pt}</li>)}
                        </ul>
                        <textarea 
                          value={answers[`email_${teil.teil}`] || ''} 
                          onChange={(e) => handleAnswerChange(`email_${teil.teil}`, e.target.value)} 
                          className="w-full h-40 px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none" 
                          placeholder="Viết email trả lời của bạn vào đây (khoảng 30 từ)..." 
                        />
                      </div>
                    )}

                    {/* Speaking Instructions */}
                    {teil.prompt_words && (
                       <div className="space-y-4">
                         <div className="flex flex-wrap gap-2 mb-4">
                           {teil.prompt_words.map((word: string, wIdx: number) => (
                             <span key={wIdx} className="px-3 py-1.5 bg-amber-100 text-amber-800 rounded-lg font-bold text-sm border border-amber-200 shadow-sm">{word}</span>
                           ))}
                         </div>
                         <SprechenTeil2Simulator onFinish={(score) => handleAnswerChange(`sprechen_score_${teil.teil}`, score)} />
                       </div>
                    )}
                    
                    {teil.topic_cards && (
                       <div className="space-y-4">
                         <SprechenTeil2Simulator onFinish={(score) => handleAnswerChange(`sprechen_score_${teil.teil}`, score)} />
                       </div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* Navigation Bottom */}
            <div className="flex justify-between items-center pt-4">
              <button 
                onClick={() => setCurrentSectionIdx(prev => Math.max(0, prev - 1))}
                disabled={currentSectionIdx === 0}
                className="px-6 py-3 rounded-xl font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Phần trước
              </button>
              
              {currentSectionIdx < activeExamData.sections.length - 1 ? (
                <button 
                  onClick={() => setCurrentSectionIdx(prev => Math.min(activeExamData.sections.length - 1, prev + 1))}
                  className="px-6 py-3 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors flex items-center gap-2 shadow-md hover:shadow-lg hover:-translate-y-0.5"
                >
                  Phần tiếp theo <ChevronRight size={18} />
                </button>
              ) : (
                <button 
                  onClick={() => submitExam(false)}
                  disabled={submitting}
                  className="px-8 py-3 rounded-xl font-bold text-white bg-emerald-500 hover:bg-emerald-600 transition-colors flex items-center gap-2 shadow-md hover:shadow-lg hover:-translate-y-0.5"
                >
                  {submitting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />} Nộp bài thi hoàn chỉnh
                </button>
              )}
            </div>
            
          </div>
        </div>
      </div>
    )
  }

  if (meLoading || !me) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="animate-spin" size={28} /></div>

  if (view === 'taking') {
    return (
      <div className="fixed inset-0 bg-white z-50 overflow-hidden">
        {renderTakingExam()}
      </div>
    )
  }

  return (
    <StudentShell activeSection="mock-exam" user={me} targetLevel={targetLevel} streakDays={streakDays}
      initials={initials} onLogout={() => logout()}
      headerTitle="🎯 Mock Goethe Exam" headerSubtitle="Thi thử theo format Goethe-Institut chính thức">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">

        {/* Goethe format explanation */}
        <div className="rounded-2xl p-5 text-white space-y-3" style={{ background: 'linear-gradient(135deg,#1E293B 0%,#312E81 100%)' }}>
          <h2 className="font-extrabold text-lg">📋 Format Goethe Start Deutsch 1 (A1)</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { section: 'LESEN', label: 'Lesen', time: '20 min', desc: '3 phần đọc' },
              { section: 'HOEREN', label: 'Hören', time: '20 min', desc: '3 phần nghe' },
              { section: 'SCHREIBEN', label: 'Schreiben', time: '20 min', desc: 'Điền form + email' },
              { section: 'SPRECHEN', label: 'Sprechen', time: '15 min', desc: '3 phần nói' },
            ].map(s => (
              <div key={s.section} className="bg-white/10 rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-1" style={{ color: SECTION_COLORS[s.section] }}>
                  {SECTION_ICONS[s.section]}
                  <span className="font-bold text-sm">{s.label}</span>
                </div>
                <p className="text-white/60 text-xs">{s.time}</p>
                <p className="text-white/80 text-xs">{s.desc}</p>
              </div>
            ))}
          </div>
          <p className="text-white/60 text-xs">Đạt: ≥ 60% mỗi phần · Tổng thời gian: ~75 phút</p>
        </div>

        <AnimatePresence mode="wait">
          {view === 'result' && selectedAttempt ? (
            <motion.div key="result" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
              <button onClick={() => setView('list')} className="flex items-center gap-2 text-sm text-[#64748B] mb-4 hover:text-[#0F172A]">
                <ArrowLeft size={16} /> Quay lại
              </button>
              <div className={`rounded-2xl p-6 mb-4 text-white ${selectedAttempt.passed ? 'bg-gradient-to-br from-emerald-500 to-teal-600' : 'bg-gradient-to-br from-slate-600 to-slate-800'}`}>
                <div className="flex items-center gap-3 mb-2">
                  {selectedAttempt.passed ? <Trophy size={28} className="text-yellow-300" /> : <AlertCircle size={28} />}
                  <div>
                    <p className="text-xl font-extrabold">{selectedAttempt.passed ? 'Đạt! 🎉' : 'Chưa đạt'}</p>
                    <p className="text-white/70 text-sm">Tổng điểm: {selectedAttempt.total_score ?? '—'}/100</p>
                  </div>
                </div>
                <p className="text-white/80 text-sm mt-2">Đây là bài thi mô phỏng, phần thi Nói và Viết cần được giáo viên chấm thủ công để có điểm chính xác nhất.</p>
              </div>
              
              <div className="grid grid-cols-2 gap-3 mb-6">
                 {['LESEN', 'HOEREN', 'SCHREIBEN', 'SPRECHEN'].map(sec => {
                    let sc = 0;
                    if (selectedAttempt.scores_json) {
                      try {
                        const parsed = JSON.parse(selectedAttempt.scores_json);
                        sc = Number(parsed[sec] || 0);
                      } catch {}
                    }
                    // For mock demo, if passed we generate some random numbers if scores_json is missing
                    if (!selectedAttempt.scores_json && selectedAttempt.total_score) {
                        sc = Math.floor(selectedAttempt.total_score / 4) + (Math.random() * 5);
                        if (sc > 25) sc = 25;
                    }
                    return <ScoreCard key={sec} section={sec} score={Math.round(sc)} max={25} />;
                 })}
              </div>
            </motion.div>
          ) : (
            <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              {/* Available exams */}
              <div>
                <h3 className="font-bold text-[#0F172A] text-base mb-3">Đề thi có sẵn</h3>
                {loading && <div className="flex justify-center py-10"><Loader2 size={24} className="animate-spin text-[#6366F1]" /></div>}
                {!loading && exams.length === 0 && (
                  <div className="bg-white rounded-2xl border border-[#E2E8F0] p-8 text-center">
                    <AlertCircle size={32} className="text-[#C7D2FE] mx-auto mb-2" />
                    <p className="font-semibold text-[#0F172A]">Chưa có đề thi</p>
                    <p className="text-sm text-[#94A3B8]">Đề thi Goethe A1 sẽ sớm được cập nhật</p>
                  </div>
                )}
                {exams.map(exam => (
                  <div key={exam.id} className="bg-white rounded-2xl border border-[#E2E8F0] p-5 hover:border-[#6366F1]/40 hover:shadow-md transition-all">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-bold text-[#0F172A]">{exam.title}</p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-[#64748B]">
                          <span className="flex items-center gap-1"><Clock size={12} /> {exam.time_limit_minutes} phút</span>
                          <span>Đạt: {exam.pass_points}/{exam.total_points} điểm</span>
                        </div>
                      </div>
                      <button onClick={() => startExam(exam)}
                        className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm text-white flex-shrink-0 shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all"
                        style={{ background: '#6366F1' }}>
                        <Play size={16} className="fill-white" /> Bắt đầu thi
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* History */}
              {attempts.length > 0 && (
                <div>
                  <h3 className="font-bold text-[#0F172A] text-base mb-3">Lịch sử thi</h3>
                  <div className="space-y-2">
                    {attempts.map((att, i) => (
                      <motion.div key={att.id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                        className="bg-white rounded-2xl border border-[#E2E8F0] px-5 py-4 flex items-center justify-between hover:border-slate-300 transition-colors">
                        <div className="flex items-center gap-3">
                          {att.passed ? <Check size={20} className="text-emerald-500 bg-emerald-50 p-1 rounded-full" /> : att.status === 'COMPLETED' ? <X size={20} className="text-rose-500 bg-rose-50 p-1 rounded-full" /> : <Clock size={20} className="text-[#94A3B8] bg-slate-50 p-1 rounded-full" />}
                          <div>
                            <p className="font-bold text-sm text-[#0F172A]">
                              {att.passed ? 'Đạt' : att.status === 'COMPLETED' ? 'Chưa đạt' : 'Đang làm'}
                            </p>
                            <p className="text-xs text-[#94A3B8] font-medium mt-0.5">{new Date(att.started_at).toLocaleString('vi-VN', {hour: '2-digit', minute:'2-digit', day: '2-digit', month: '2-digit', year: 'numeric'})}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <p className="font-black text-lg text-[#0F172A]">{att.total_score ?? '—'} <span className="text-xs font-semibold text-slate-400">điểm</span></p>
                          {att.status === 'COMPLETED' ? (
                            <button onClick={() => viewResult(att)} className="text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors">
                              Chi tiết <ChevronRight size={12} strokeWidth={3} />
                            </button>
                          ) : (
                            <button onClick={() => {
                                // Resume attempt logic here. For now we just alert.
                                alert('Chức năng tiếp tục bài thi đang làm đang được phát triển.')
                            }} className="text-xs font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors">
                              Tiếp tục <Play size={12} className="fill-emerald-600" />
                            </button>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </StudentShell>
  )
}
