'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Clock, Check, X, ChevronRight, Loader2, Trophy, BookOpen, Headphones, PenTool, Mic2, ArrowLeft, AlertCircle, Send, Play } from 'lucide-react'
import { StudentShell } from '@/components/layouts/StudentShell'
import { SprechenTeil2Simulator } from '@/components/exam/SprechenTeil2Simulator'
import { ExamProgressBar } from '@/components/exam/ExamProgressBar'
import { DetailedScoreBreakdown } from '@/components/exam/DetailedScoreBreakdown'
import { ExamFeedback } from '@/components/exam/ExamFeedback'
import { WeakAreasRecommendation } from '@/components/exam/WeakAreasRecommendation'
import { useStudentPracticeSession } from '@/hooks/useStudentPracticeSession'
import { logout } from '@/lib/authSession'
import api from '@/lib/api'
import { useTracking } from '@/hooks/useTracking'
import { AudioPlayer } from '@/components/exam/AudioPlayer'
import { toast } from 'sonner'
import { PremiumGate } from '@/components/ui/PremiumGate'
import { usePlanHelpers } from '@/contexts/PlanContext'
import { ErrorBoundary } from '@/components/ErrorBoundary'

interface MockExam {
  id: number
  cefr_level: string
  exam_format: string
  title: string
  total_points: number
  pass_points: number
  time_limit_minutes: number
}

interface SectionScore {
  total?: number
  max?: number
  percentage?: number
  status?: string
  total_provisional?: number
  total_max?: number
}

// ─── Review data types ───────────────────────────────────────────────────────

interface ReviewItem {
  id: string
  prompt: string
  userAnswer: string | null
  correctAnswer: string
  isCorrect: boolean
  explanation?: string
}

interface ReviewSection {
  sectionName: string
  items: ReviewItem[]
}

interface ReviewData {
  attemptId: number
  totalScore: number
  sections: ReviewSection[]
}

interface MockAttempt {
  id: number
  exam_id: number
  exam_title?: string
  started_at: string
  finished_at?: string
  total_score?: number
  passed?: boolean
  status: string
  detailed_scores_json?: string
  weak_areas?: string
  sections_json?: string
}

// ─── Exam data types ─────────────────────────────────────────────────────────

interface ExamQuestionItem {
  id: string
  question?: string
  text?: string
  person?: string
  audio_script?: string
  options?: Record<string, string>
  correct?: string
}

interface ExamTeil {
  teil: number
  instruction_vi?: string
  instruction_de?: string
  context?: string
  audio_script?: string
  items?: ExamQuestionItem[]
  form_fields?: Array<{ field: string; instruction_vi: string }>
  input_email?: string
  writing_points?: string[]
  prompt_words?: string[]
  topic_cards?: string[]
}

interface ExamSection {
  name: string
  label_vi: string
  time_minutes: number
  max_points: number
  teile?: ExamTeil[]
}

interface ActiveExamData {
  sections: ExamSection[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

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

// Always-clickable recovery UI shown inside the full-screen exam shell whenever the
// taking view cannot render its content — so the `fixed inset-0` overlay can never
// become a blank, unclickable white screen.
function ExamRecoveryPanel({
  title,
  message,
  onRetry,
  onSubmit,
  onExit,
  submitting,
}: {
  title: string
  message: string
  onRetry?: () => void
  onSubmit?: () => void
  onExit: () => void
  submitting?: boolean
}) {
  return (
    <div className="flex h-full min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl border border-red-200 p-6 text-center space-y-4 shadow-sm">
        <div className="w-12 h-12 mx-auto rounded-full bg-red-50 flex items-center justify-center" aria-hidden>
          <AlertCircle size={24} className="text-red-500" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
        <p className="text-slate-500 text-sm">{message}</p>
        <div className="flex flex-col gap-2 pt-1">
          {onRetry && (
            <button type="button" onClick={onRetry}
              className="w-full py-2.5 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 transition-colors">
              Thử lại
            </button>
          )}
          {onSubmit && (
            <button type="button" onClick={onSubmit} disabled={submitting}
              className="w-full py-2.5 rounded-xl bg-emerald-500 text-white font-semibold text-sm hover:bg-emerald-600 transition-colors disabled:opacity-60">
              {submitting ? 'Đang nộp...' : 'Nộp bài ngay'}
            </button>
          )}
          <button type="button" onClick={onExit}
            className="w-full py-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition-colors">
            Quay lại danh sách đề
          </button>
        </div>
      </div>
    </div>
  )
}

export default function MockExamPage() {
  const { trackFeatureAction, posthog } = useTracking()
  const { isPro } = usePlanHelpers()
  const { me, loading: meLoading, targetLevel, roadmapMeta, streakDays, initials } = useStudentPracticeSession()
  const [exams, setExams] = useState<MockExam[]>([])
  const [attempts, setAttempts] = useState<MockAttempt[]>([])
  const [loading, setLoading] = useState(true)
  const [recommendedExamId, setRecommendedExamId] = useState<number | null>(null)
  const [selectedLevel, setSelectedLevel] = useState<string>('A1')
  
  // View states
  const [view, setView] = useState<'list' | 'result' | 'taking' | 'review'>('list')
  const [selectedAttempt, setSelectedAttempt] = useState<MockAttempt | null>(null)
  const [reviewData, setReviewData] = useState<ReviewData | null>(null)
  const [reviewLoading, setReviewLoading] = useState(false)
  
  // Exam Taking State
  const [activeExamData, setActiveExamData] = useState<ActiveExamData | null>(null)
  const [activeAttemptId, setActiveAttemptId] = useState<number | null>(null)
  const [currentSectionIdx, setCurrentSectionIdx] = useState(0)
  const [timeLeft, setTimeLeft] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const submittedByTimerRef = useRef(false)

  // Sync selectedLevel with user's target level once it loads
  useEffect(() => {
    if (targetLevel && !meLoading) setSelectedLevel(targetLevel)
  }, [targetLevel, meLoading])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [examRes, attRes, recRes] = await Promise.allSettled([
        api.get<MockExam[]>(`/mock-exams?cefrLevel=${selectedLevel}`),
        api.get<MockAttempt[]>('/mock-exams/attempts/me'),
        api.get<{ recommendedExamId: number }>(`/mock-exams/recommend?cefrLevel=${selectedLevel}`),
      ])
      if (examRes.status === 'fulfilled') setExams(examRes.value.data ?? [])
      if (attRes.status === 'fulfilled') setAttempts(attRes.value.data ?? [])
      if (recRes.status === 'fulfilled') {
        const recId = recRes.value.data?.recommendedExamId
        setRecommendedExamId(recId && recId > 0 ? recId : null)
      }
    } finally { setLoading(false) }
  }, [selectedLevel])

  const submitExam = useCallback(async (autoSubmit = false) => {
    if (!activeAttemptId) return
    if (!autoSubmit && !confirm('Bạn có chắc chắn muốn nộp bài?')) return

    setSubmitting(true)
    try {
      await api.post(`/mock-exams/attempts/${activeAttemptId}/finish`, { answers })

      const finishedAttempt = await api.get<MockAttempt>(`/mock-exams/attempts/${activeAttemptId}/result`)
      setSelectedAttempt(finishedAttempt.data)
      setView('result')
      await load()
      trackFeatureAction('mock_exam', 'completed', {
        examId: activeAttemptId,
        totalScore: finishedAttempt.data?.total_score,
      })
    } catch {
      toast.error('Lỗi nộp bài. Vui lòng thử lại.')
    } finally {
      setSubmitting(false)
    }
  }, [activeAttemptId, answers, load, trackFeatureAction])

  useEffect(() => { if (me) load() }, [me, load])

  // Interval: one timer per 'taking' session; never re-registers on every tick
  useEffect(() => {
    if (view !== 'taking') return
    const timerId = setInterval(() => {
      setTimeLeft(prev => Math.max(0, prev - 1))
    }, 1000)
    return () => clearInterval(timerId)
  }, [view])

  // Expiry: submit once when time runs out — side-effects must not live inside state updaters
  useEffect(() => {
    if (view === 'taking' && timeLeft === 0 && !submittedByTimerRef.current) {
      submittedByTimerRef.current = true
      void submitExam(true)
    }
  }, [view, timeLeft, submitExam])

  useEffect(() => {
    return () => {
      if (view === 'taking') {
        trackFeatureAction('mock_exam', 'quit', { examId: activeAttemptId })
      }
    }
  }, [view, activeAttemptId, trackFeatureAction])

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
        toast.error('Đề thi chưa có nội dung chi tiết. Vui lòng thử lại sau.')
        return
      }

      submittedByTimerRef.current = false
      setActiveAttemptId(attempt.id)
      setActiveExamData(examSections)
      setCurrentSectionIdx(0)
      setTimeLeft(exam.time_limit_minutes * 60)
      setAnswers({})
      setView('taking')
      trackFeatureAction('mock_exam', 'started', { examId: exam.id, title: exam.title })
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Không thể bắt đầu thi')
    } finally {
      setLoading(false)
    }
  }

  const resumeExam = async (att: MockAttempt) => {
    const exam = exams.find(e => e.id === att.exam_id)
    if (!exam) {
      // Exam may not be in current level filter — fetch it directly
      try {
        setLoading(true)
        const res = await api.post(`/mock-exams/${att.exam_id}/start`)
        const attempt = res.data
        let examSections = null
        if (attempt.sections_json) {
          try { examSections = typeof attempt.sections_json === 'string' ? JSON.parse(attempt.sections_json) : attempt.sections_json } catch {}
        }
        if (!examSections?.sections) { toast.error('Không thể tiếp tục bài thi. Vui lòng thử lại.'); return }
        submittedByTimerRef.current = false
        setActiveAttemptId(att.id)
        setActiveExamData(examSections)
        setCurrentSectionIdx(0)
        const timeLimitMinutes = typeof attempt.time_limit_minutes === 'number' ? attempt.time_limit_minutes : 60
        setTimeLeft(timeLimitMinutes * 60)
        setAnswers({})
        setView('taking')
      } catch { toast.error('Không thể tiếp tục bài thi. Vui lòng thử lại.') } finally { setLoading(false) }
      return
    }
    await startExam(exam)
  }

  const viewResult = (attempt: MockAttempt) => {
    setSelectedAttempt(attempt)
    setView('result')
  }

  const viewReview = async (attemptId: number) => {
    setReviewLoading(true)
    try {
      const res = await api.get<ReviewData>(`/mock-exams/attempts/${attemptId}/review`)
      setReviewData(res.data)
      setView('review')
    } catch {
      toast.error('Không thể tải đáp án. Vui lòng thử lại.')
    } finally {
      setReviewLoading(false)
    }
  }

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s < 10 ? '0' : ''}${s}`
  }

  const handleAnswerChange = (questionId: string, value: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }))
  }

  // Count answered questions across all sections
  const answeredCount = useMemo(() => Object.keys(answers).length, [answers])
  const totalQuestions = useMemo(() => {
    if (!activeExamData?.sections) return 0
    return activeExamData.sections.reduce((sum: number, s: { teile?: Array<{ items?: unknown[] }> }) => {
      return sum + (s.teile?.reduce((t: number, teil) => t + (teil.items?.length ?? 0), 0) ?? 0)
    }, 0)
  }, [activeExamData])

  // --- Render Functions for Exam Content ---
  const renderTakingExam = () => {
    if (!activeExamData?.sections || activeExamData.sections.length === 0) {
      return (
        <ExamRecoveryPanel
          title="Không tải được nội dung đề thi"
          message="Đề thi chưa sẵn sàng hoặc kết nối bị gián đoạn. Hãy quay lại và bắt đầu lại."
          onExit={() => setView('list')}
        />
      )
    }
    // Guard against an out-of-range section index (e.g. a stale/raced nav state) so we
    // never throw on `currentSection.name` and blank the whole exam.
    const currentSection = activeExamData.sections[currentSectionIdx]
    if (!currentSection) {
      return (
        <ExamRecoveryPanel
          title="Không tìm thấy phần thi"
          message="Đã xảy ra lỗi khi chuyển phần thi. Bạn có thể thử lại, nộp bài, hoặc quay lại."
          onRetry={() => setCurrentSectionIdx(0)}
          onSubmit={() => submitExam(true)}
          onExit={() => setView('list')}
          submitting={submitting}
        />
      )
    }

    return (
      <div className="flex flex-col h-full">
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
              {activeExamData.sections.map((s: ExamSection, idx: number) => (
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

        {/* Progress bar */}
        <ExamProgressBar
          sections={activeExamData.sections.map((s: { name: string; label_vi: string }) => ({
            name: s.name,
            label_vi: s.label_vi,
          }))}
          currentSectionIdx={currentSectionIdx}
          answeredCount={answeredCount}
          totalQuestions={totalQuestions}
        />

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto bg-slate-50 p-6">
          <div className="max-w-4xl mx-auto space-y-8 pb-20">
            
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm mb-6">
              <h3 className="font-bold text-xl text-slate-800 mb-2">{currentSection.name} - {currentSection.label_vi}</h3>
              <p className="text-slate-500 text-sm">Thời gian làm bài: {currentSection.time_minutes} phút | Điểm tối đa: {currentSection.max_points}</p>
            </div>

            {currentSection.teile?.map((teil: ExamTeil, tIdx: number) => (
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
                    <AudioPlayer script={teil.audio_script} label={`Teil ${teil.teil} — Hörtext`} />
                  )}

                  {/* Render Questions based on type */}
                  <div className="space-y-6">
                    {teil.items?.map((item: ExamQuestionItem, qIdx: number) => (
                      <div key={item.id ?? `${tIdx}-${qIdx}`} className="border-b border-slate-100 last:border-0 pb-6 last:pb-0">
                        {item.audio_script && (
                          <AudioPlayer script={item.audio_script} compact label={item.person ? `Nghe ${item.person}` : 'Nghe đoạn hội thoại'} />
                        )}
                        {item.text && <p className="text-sm text-slate-600 mb-3 italic">{'"'}{item.text}{'"'}</p>}
                        {item.person && <p className="text-sm text-slate-600 mb-3">👤 {item.person}</p>}
                        
                        <p className="font-semibold text-slate-800 mb-3">{qIdx + 1}. {item.question || 'Lựa chọn đáp án đúng:'}</p>
                        
                        {/* Multiple Choice Options */}
                        {item.options && (
                          <div className="space-y-2">
                            {Object.entries(item.options).map(([optKey, optVal]) => (
                              <label key={optKey} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${answers[item.id] === optKey ? 'bg-indigo-50 border-indigo-500' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                                <input type="radio" name={item.id} value={optKey} checked={answers[item.id] === optKey} onChange={() => handleAnswerChange(item.id, optKey)} className="w-4 h-4 text-indigo-600 focus:ring-indigo-500" />
                                <span className="font-bold w-6 text-slate-400">{optKey}</span>
                                <span className="text-slate-700">{optVal}</span>
                              </label>
                            ))}
                          </div>
                        )}

                        {/* Richtig / Falsch */}
                        {!item.options && item.correct && (String(item.correct).toLowerCase() === 'richtig' || String(item.correct).toLowerCase() === 'falsch') && (
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
                        {!item.options && item.correct && String(item.correct).length === 1 && (
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
                         {teil.form_fields.map((field: { field: string; instruction_vi: string }, fIdx: number) => (
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
                         <SprechenTeil2Simulator onFinish={(score) => handleAnswerChange(`sprechen_score_${teil.teil}`, String(score))} />
                       </div>
                    )}
                    
                    {teil.topic_cards && (
                       <div className="space-y-4">
                         <SprechenTeil2Simulator onFinish={(score) => handleAnswerChange(`sprechen_score_${teil.teil}`, String(score))} />
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
        <ErrorBoundary
          onError={(error, info) => {
            // Self-diagnosing: surface the real error + exam context to PostHog so a
            // recurrence is actionable (the route-level boundary only exposes a digest).
            posthog?.capture('mock_exam_render_error', {
              feature: 'mock_exam',
              attempt_id: activeAttemptId,
              section_index: currentSectionIdx,
              answered_count: answeredCount,
              message: error.message,
              stack: error.stack,
              component_stack: info.componentStack,
            })
          }}
          fallback={(reset) => (
            <ExamRecoveryPanel
              title="Đã xảy ra lỗi khi hiển thị đề thi"
              message="Bài làm của bạn vẫn được giữ. Hãy thử lại; nếu vẫn lỗi, bạn có thể nộp bài hoặc quay lại."
              onRetry={reset}
              onSubmit={() => submitExam(true)}
              onExit={() => setView('list')}
              submitting={submitting}
            />
          )}
        >
          {renderTakingExam()}
        </ErrorBoundary>
      </div>
    )
  }

  return (
    <StudentShell activeSection="mock-exam" user={me} targetLevel={targetLevel} streakDays={streakDays}
      initials={initials} onLogout={() => logout()}
      headerTitle="🎯 Mock Goethe Exam" headerSubtitle="Thi thử theo format Goethe-Institut chính thức">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {!isPro && (
          <PremiumGate
            requires="PRO"
            variant="banner"
            title="Thi thử là tính năng PRO"
            description="Nâng cấp PRO để thi thử theo format Goethe chính thức, xem điểm chi tiết và phân tích điểm yếu."
          />
        )}

        {/* Goethe format explanation */}
        <div className="rounded-2xl p-5 text-white space-y-3" style={{ background: 'linear-gradient(135deg,#1E293B 0%,#312E81 100%)' }}>
          <h2 className="font-extrabold text-lg">📋 Format Goethe {selectedLevel === 'A1' ? 'Start Deutsch 1' : `Zertifikat ${selectedLevel}`} ({selectedLevel})</h2>
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
          {view === 'review' && reviewData ? (
            <motion.div key="review" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
              {/* Header */}
              <button
                onClick={() => setView('result')}
                className="flex items-center gap-2 text-sm text-[#64748B] hover:text-[#0F172A]"
              >
                <ArrowLeft size={16} /> Quay lại kết quả
              </button>

              <div className="bg-white rounded-2xl border border-[#E2E8F0] px-6 py-5">
                <h2 className="font-extrabold text-[#0F172A] text-xl flex items-center gap-2">
                  <BookOpen size={22} className="text-indigo-500" />
                  Xem lại bài thi
                </h2>
                <p className="text-sm text-[#94A3B8] mt-1">Tổng điểm: {reviewData.totalScore}</p>
              </div>

              {reviewData.sections.map((section, sIdx) => (
                <div key={sIdx} className="space-y-3">
                  {/* Section header */}
                  <div className="flex items-center gap-2">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{
                        background: (SECTION_COLORS[section.sectionName.toUpperCase()] ?? '#6366F1') + '20',
                        color: SECTION_COLORS[section.sectionName.toUpperCase()] ?? '#6366F1',
                      }}
                    >
                      {SECTION_ICONS[section.sectionName.toUpperCase()]}
                    </div>
                    <h3 className="font-bold text-[#0F172A] text-base capitalize">
                      {section.sectionName.toLowerCase()}
                    </h3>
                  </div>

                  {section.items.map((item, qIdx) => (
                    <div
                      key={item.id}
                      className={`bg-white rounded-2xl border p-5 space-y-3 ${item.isCorrect ? 'border-emerald-200' : 'border-rose-200'}`}
                    >
                      {/* Question number + prompt */}
                      <p className="font-semibold text-[#0F172A] text-sm">
                        {qIdx + 1}. {item.prompt}
                      </p>

                      {/* User answer */}
                      <div className="flex items-start gap-2">
                        {item.userAnswer === null ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#94A3B8] bg-slate-100 px-2 py-0.5 rounded-lg">
                            Chưa trả lời
                          </span>
                        ) : item.isCorrect ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg">
                            <Check size={12} strokeWidth={3} />
                            {item.userAnswer}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-lg">
                            <X size={12} strokeWidth={3} />
                            {item.userAnswer}
                          </span>
                        )}
                        <span className="text-xs text-[#94A3B8]">Câu trả lời của bạn</span>
                      </div>

                      {/* Correct answer */}
                      {!item.isCorrect && (
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg">
                            <Check size={12} strokeWidth={3} />
                            {item.correctAnswer}
                          </span>
                          <span className="text-xs text-[#94A3B8]">Đáp án đúng</span>
                        </div>
                      )}

                      {/* Explanation */}
                      {item.explanation && (
                        <p className="text-xs text-[#94A3B8] italic border-t border-slate-100 pt-2">
                          {item.explanation}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </motion.div>
          ) : view === 'result' && selectedAttempt ? (
            <motion.div key="result" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
              <button onClick={() => setView('list')} className="flex items-center gap-2 text-sm text-[#64748B] hover:text-[#0F172A]">
                <ArrowLeft size={16} /> Quay lại
              </button>

              {/* Hero result banner */}
              <div className={`rounded-2xl p-6 text-white ${selectedAttempt.passed ? 'bg-gradient-to-br from-emerald-500 to-teal-600' : 'bg-gradient-to-br from-slate-600 to-slate-800'}`}>
                <div className="flex items-center gap-3 mb-2">
                  {selectedAttempt.passed ? <Trophy size={28} className="text-yellow-300" /> : <AlertCircle size={28} />}
                  <div>
                    <p className="text-xl font-extrabold">{selectedAttempt.passed ? 'Đạt! 🎉' : 'Chưa đạt'}</p>
                    <p className="text-white/70 text-sm">Tổng điểm tạm tính: {selectedAttempt.total_score ?? '—'}/100</p>
                  </div>
                </div>
                <p className="text-white/70 text-xs mt-2">Phần Viết và Nói sẽ được chấm bổ sung — điểm tạm tính chưa bao gồm.</p>
              </div>

              {/* Detailed score breakdown */}
              {(() => {
                let detailedScores: Record<string, SectionScore> = {}
                if (selectedAttempt.detailed_scores_json) {
                  try { detailedScores = JSON.parse(selectedAttempt.detailed_scores_json) } catch {}
                }
                if (Object.keys(detailedScores).length > 0) {
                  return (
                    <DetailedScoreBreakdown
                      detailedScores={detailedScores}
                      totalScore={selectedAttempt.total_score ?? 0}
                      passed={selectedAttempt.passed ?? false}
                    />
                  )
                }
                return null
              })()}

              {/* AI writing feedback */}
              {(() => {
                let detailedScores: Record<string, unknown> = {}
                if (selectedAttempt.detailed_scores_json) {
                  try { detailedScores = JSON.parse(selectedAttempt.detailed_scores_json) } catch {}
                }
                if (Object.keys(detailedScores).length > 0) {
                  return <ExamFeedback detailedScores={detailedScores} />
                }
                return null
              })()}

              {/* Weak areas */}
              {(() => {
                let weakAreas: string[] = []
                if (selectedAttempt.weak_areas) {
                  try { weakAreas = JSON.parse(selectedAttempt.weak_areas) } catch {}
                }
                return <WeakAreasRecommendation weakAreas={weakAreas} />
              })()}

              {/* Answer review CTA */}
              <div className="pt-2">
                <button
                  onClick={() => viewReview(selectedAttempt.id)}
                  disabled={reviewLoading}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-colors"
                >
                  {reviewLoading ? <Loader2 size={16} className="animate-spin" /> : <BookOpen size={16} />}
                  Xem đáp án chi tiết
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              {/* Available exams */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-[#0F172A] text-base">Đề thi có sẵn</h3>
                  <select
                    className="text-sm border border-[#E2E8F0] rounded-xl px-3 py-1.5 font-semibold text-[#334155] bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    value={selectedLevel}
                    onChange={(e) => setSelectedLevel(e.target.value)}
                  >
                    {['A1', 'A2', 'B1', 'B2'].map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                {loading && <div className="flex justify-center py-10"><Loader2 size={24} className="animate-spin text-[#6366F1]" /></div>}
                {!loading && exams.length === 0 && (
                  <div className="bg-white rounded-2xl border border-[#E2E8F0] p-8 text-center">
                    <AlertCircle size={32} className="text-[#C7D2FE] mx-auto mb-2" />
                    <p className="font-semibold text-[#0F172A]">Chưa có đề thi</p>
                    <p className="text-sm text-[#94A3B8]">Đề thi Goethe {selectedLevel} sẽ sớm được cập nhật</p>
                  </div>
                )}
                {exams.map(exam => {
                  const isRecommended = exam.id === recommendedExamId
                  return (
                    <div key={exam.id} className={`bg-white rounded-2xl border p-5 hover:shadow-md transition-all ${isRecommended ? 'border-[#6366F1] ring-1 ring-[#6366F1]/30' : 'border-[#E2E8F0] hover:border-[#6366F1]/40'}`}>
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-bold text-[#0F172A]">{exam.title}</p>
                            {isRecommended && (
                              <span className="text-[10px] font-extrabold uppercase tracking-wide text-white bg-[#6366F1] px-2 py-0.5 rounded-full">
                                Gợi ý
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-[#64748B]">
                            <span className="flex items-center gap-1"><Clock size={12} /> {exam.time_limit_minutes} phút</span>
                            <span>Đạt: {exam.pass_points}/{exam.total_points} điểm</span>
                          </div>
                        </div>
                        <button onClick={() => startExam(exam)}
                          className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm text-white flex-shrink-0 shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all"
                          style={{ background: isRecommended ? '#4F46E5' : '#6366F1' }}>
                          <Play size={16} className="fill-white" /> Bắt đầu thi
                        </button>
                      </div>
                    </div>
                  )
                })}
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
                            <button onClick={() => resumeExam(att)} className="text-xs font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors">
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
