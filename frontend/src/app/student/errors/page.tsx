'use client'
import { logout } from '@/lib/authSession'
import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, Shield, Zap, RotateCcw, BookOpen, CheckCircle2,
  AlertTriangle, Loader2, RefreshCw, Calendar, Clock, Brain, X,
} from 'lucide-react'
import { StudentShell } from '@/components/layouts/StudentShell'
import { useStudentPracticeSession } from '@/hooks/useStudentPracticeSession'
import { reviewApi, type ErrorReviewTaskDto } from '@/lib/reviewApi'
import api from '@/lib/api'
import ErrorRepairDrill from '@/components/errors/ErrorRepairDrill'
import { localAiApi } from '@/lib/localAiApi'

// ─── Types ─────────────────────────────────────────────────────────────────

interface ErrorSkillDto {
  errorCode: string
  count: number
  lastSeenAt: string
  priorityScore: number
  sampleWrong?: string
  sampleCorrected?: string
  ruleViShort?: string
}

// ─── Color helpers ──────────────────────────────────────────────────────────

const CAT_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  ARTIKEL:   { bg: '#EBF5FB', text: '#2D9CDB', label: 'Artikel'   },
  KASUS:     { bg: '#FDEAEA', text: '#EB5757', label: 'Kasus'     },
  VERB:      { bg: '#F4EDFF', text: '#9B51E0', label: 'Verb'      },
  PRAEP:     { bg: '#FFF3E0', text: '#F57C00', label: 'Präp.'     },
  ADJEKTIV:  { bg: '#E8F5E9', text: '#388E3C', label: 'Adjektiv'  },
}

function catStyle(code: string) {
  // Try prefix match (e.g. "CASE.PREP_DAT" → "KASUS")
  const upper = code.toUpperCase()
  if (upper.startsWith('CASE'))  return CAT_COLORS.KASUS
  if (upper.startsWith('VERB'))  return CAT_COLORS.VERB
  if (upper.startsWith('ART'))   return CAT_COLORS.ARTIKEL
  if (upper.startsWith('PRAEP') || upper.startsWith('PREP')) return CAT_COLORS.PRAEP
  if (upper.startsWith('ADJ'))   return CAT_COLORS.ADJEKTIV
  return { bg: '#F1F5F9', text: '#475569', label: 'Khác' }
}

// ─── Main component ─────────────────────────────────────────────────────────

export default function ErrorLibraryPage() {
  const { me, loading: sessionLoading, targetLevel, streakDays, initials } = useStudentPracticeSession()

  const [errors, setErrors] = useState<ErrorSkillDto[]>([])
  const [tasks, setTasks] = useState<ErrorReviewTaskDto[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [repairedCodes, setRepairedCodes] = useState<Set<string>>(new Set())
  const [completingTask, setCompletingTask] = useState<number | null>(null)
  const [completedTasks, setCompletedTasks] = useState<Set<number>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [activeDrillError, setActiveDrillError] = useState<ErrorSkillDto | null>(null)
  // AI Error Practice panel
  const [aiPracticeError, setAiPracticeError] = useState<ErrorSkillDto | null>(null)
  const [aiPracticeLoading, setAiPracticeLoading] = useState(false)
  const [aiPracticeResult, setAiPracticeResult] = useState<string | null>(null)

  // ── Fetch data ──────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [skillsRes, tasksRes] = await Promise.allSettled([
        api.get<ErrorSkillDto[]>('/error-skills/me', { params: { days: 30 } }),
        reviewApi.getTodayTasks(),
      ])
      if (skillsRes.status === 'fulfilled') setErrors(skillsRes.value.data)
      if (tasksRes.status === 'fulfilled') setTasks(tasksRes.value)
    } catch {
      setError('Không thể tải dữ liệu. Vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Repair attempt ──────────────────────────────────────────────────────
  const handleRepair = (err: ErrorSkillDto) => {
    setActiveDrillError(err)
  }

  const handleAiPractice = async (err: ErrorSkillDto) => {
    setAiPracticeError(err)
    setAiPracticeResult(null)
    setAiPracticeLoading(true)
    try {
      const res = await localAiApi.errorPractice(err.errorCode, 3)
      setAiPracticeResult(res.data.exercises ?? null)
    } catch {
      setAiPracticeResult('Không thể tạo bài luyện. Thử lại sau.')
    } finally {
      setAiPracticeLoading(false)
    }
  }

  const handleDrillClose = (passed: boolean) => {
    if (activeDrillError && passed) {
      // The ErrorRepairDrill handles the actual API call to mark it resolved internally on pass.
      // So when the modal closes and tells us it passed, we mark it as repaired in the UI.
      setRepairedCodes(prev => new Set(Array.from(prev).concat(activeDrillError.errorCode)))
    }
    setActiveDrillError(null)
  }

  // ── Complete review task ────────────────────────────────────────────────
  const handleCompleteTask = async (taskId: number, passed: boolean) => {
    setCompletingTask(taskId)
    try {
      await reviewApi.completeTask(taskId, passed)
      setCompletedTasks(prev => new Set(Array.from(prev).concat(taskId)))
    } catch {
      // silent
    } finally {
      setCompletingTask(null)
    }
  }

  // ── Filter ──────────────────────────────────────────────────────────────
  const filtered = errors.filter(e =>
    !search || e.errorCode.toLowerCase().includes(search.toLowerCase())
  )

  const pendingTasks = tasks.filter(t => !completedTasks.has(t.id))

  if (sessionLoading || !me) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F1F4F9]">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-8 h-8 border-4 border-[#00305E] border-t-transparent rounded-full"
        />
      </div>
    )
  }

  return (
    <StudentShell
      activeSection="errors"
      user={me}
      targetLevel={targetLevel}
      streakDays={streakDays}
      initials={initials}
      onLogout={() => { logout() }}
      headerTitle="Thư viện lỗi"
      headerSubtitle="Vết sẹo ngữ pháp — Càng nhớ lâu, càng giỏi nhanh"
    >
      <div className="max-w-2xl mx-auto space-y-6">

        {/* ── Today's review tasks ───────────────────────────────────────── */}
        {pendingTasks.length > 0 && (
          <div className="bg-gradient-to-br from-[#FFF8E1] to-[#FFFDE7] rounded-3xl p-5 border border-[#FDE68A] shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Calendar size={18} className="text-[#F59E0B]" />
              <h2 className="font-bold text-[#92400E]">Ôn tập hôm nay ({pendingTasks.length})</h2>
            </div>
            <div className="space-y-3">
              {pendingTasks.map(task => (
                <div key={task.id} className="bg-white rounded-2xl p-4 border border-[#FDE68A] flex items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-sm text-[#0F172A]">{task.errorCode}</p>
                    <p className="text-xs text-[#64748B] flex items-center gap-1 mt-0.5">
                      <Clock size={11} /> Interval: {task.intervalDays} ngày
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleCompleteTask(task.id, false)}
                      disabled={completingTask === task.id}
                      className="px-3 py-1.5 rounded-xl bg-red-50 text-red-600 font-bold text-xs border border-red-200 hover:bg-red-100 transition-all"
                    >
                      ✗ Chưa nhớ
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCompleteTask(task.id, true)}
                      disabled={completingTask === task.id}
                      className="px-3 py-1.5 rounded-xl bg-green-50 text-green-600 font-bold text-xs border border-green-200 hover:bg-green-100 transition-all"
                    >
                      {completingTask === task.id
                        ? <Loader2 size={12} className="animate-spin" />
                        : '✓ Đã nhớ'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Search + reload ────────────────────────────────────────────── */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#94A3B8]" size={18} />
            <input
              type="text"
              placeholder="Tìm kiếm mã lỗi..."
              className="w-full bg-white border border-[#E2E8F0] rounded-2xl py-3 pl-12 pr-4 text-[#0F172A] placeholder:text-[#94A3B8] outline-none focus:border-[#00305E] transition-all shadow-sm"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button
            type="button"
            onClick={fetchData}
            className="w-12 h-12 rounded-2xl bg-white border border-[#E2E8F0] text-[#64748B] hover:text-[#00305E] hover:border-[#00305E] flex items-center justify-center shadow-sm transition-all"
          >
            <RefreshCw size={16} />
          </button>
        </div>

        {/* ── Loading / error states ─────────────────────────────────────── */}
        {loading && (
          <div className="flex items-center justify-center py-16 gap-3 text-[#64748B]">
            <Loader2 size={22} className="animate-spin text-[#00305E]" />
            <span className="text-sm">Đang tải dữ liệu lỗi...</span>
          </div>
        )}

        {!loading && error && (
          <div className="text-center py-10">
            <AlertTriangle size={36} className="text-amber-400 mx-auto mb-3" />
            <p className="text-sm text-[#64748B] mb-4">{error}</p>
            <button type="button" onClick={fetchData} className="px-4 py-2 rounded-xl bg-[#00305E] text-white font-bold text-sm">
              Thử lại
            </button>
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="text-center py-14">
            <CheckCircle2 size={48} className="text-green-400 mx-auto mb-4" />
            <p className="font-bold text-[#0F172A] mb-1">Tuyệt vời! Chưa ghi nhận lỗi nào.</p>
            <p className="text-sm text-[#64748B]">Hãy luyện nói để AI ghi lại các lỗi ngữ pháp của bạn.</p>
          </div>
        )}

        {/* ── Error cards ────────────────────────────────────────────────── */}
        <AnimatePresence>
          <div className="space-y-4">
            {!loading && filtered.map((err, idx) => {
              const style = catStyle(err.errorCode)
              const repaired = repairedCodes.has(err.errorCode)

              return (
                <motion.div
                  key={err.errorCode}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ delay: idx * 0.06 }}
                  className={`bg-white rounded-3xl p-5 shadow-md border relative overflow-hidden transition-all ${repaired ? 'border-green-200 bg-green-50/30' : 'border-slate-200'}`}
                >
                  {/* left accent bar */}
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-3xl" style={{ background: style.text }} />

                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold px-2 py-1 rounded-full uppercase" style={{ background: style.bg, color: style.text }}>
                        {style.label}
                      </span>
                      {repaired && (
                        <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-green-100 text-green-600">
                          ✓ Đã sửa
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-1 rounded-full">
                      Gặp {err.count} lần
                    </span>
                  </div>

                  {/* Error code */}
                  <div className="mb-3">
                    <p className="font-mono font-bold text-[#0F172A] text-sm">{err.errorCode}</p>
                    {err.lastSeenAt && (
                      <p className="text-xs text-[#94A3B8] mt-0.5 flex items-center gap-1">
                        <Clock size={11} /> Gặp lần cuối: {new Date(err.lastSeenAt).toLocaleDateString('vi-VN')}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    <div className="flex items-center gap-1.5 flex-1 text-[#64748B]">
                      <Shield size={13} className="text-[#00305E]" />
                      <span className="text-xs font-semibold">Lỗi ngữ pháp đã ghi nhận</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleAiPractice(err)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition-all bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 active:scale-95"
                    >
                      <Brain size={12} /> Luyện AI
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRepair(err)}
                      disabled={repaired}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition-all ${
                        repaired
                          ? 'bg-green-100 text-green-600 cursor-default'
                          : 'bg-[#00305E] text-white hover:bg-[#004b90] active:scale-95'
                      }`}
                    >
                      {repaired
                          ? <><CheckCircle2 size={12} /> Đã sửa</>
                          : <><RotateCcw size={12} /> Luyện sửa lỗi</>}
                    </button>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </AnimatePresence>

        {/* Empty tasks notice */}
        {!loading && pendingTasks.length === 0 && tasks.length > 0 && (
          <div className="text-center py-4 text-sm text-green-600 font-semibold bg-green-50 rounded-2xl border border-green-100">
            🎉 Bạn đã hoàn thành tất cả bài ôn tập hôm nay!
          </div>
        )}
      </div>

      <ErrorRepairDrill
        open={!!activeDrillError}
        onClose={handleDrillClose}
        errorCode={activeDrillError?.errorCode || ''}
        exampleCorrectDe={activeDrillError?.sampleCorrected}
        ruleViShort={activeDrillError?.ruleViShort}
      />

      {/* AI Practice slide panel */}
      <AnimatePresence>
        {aiPracticeError && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4"
            onClick={() => { setAiPracticeError(null); setAiPracticeResult(null); }}
          >
            <motion.div
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              className="bg-white rounded-3xl p-5 w-full max-w-lg max-h-[80vh] overflow-y-auto shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="font-bold text-[#0F172A]">Luyện sửa lỗi AI 🤖</p>
                  <p className="text-xs text-[#94A3B8] font-mono">{aiPracticeError.errorCode}</p>
                </div>
                <button type="button" onClick={() => { setAiPracticeError(null); setAiPracticeResult(null); }}
                  className="p-1.5 rounded-lg hover:bg-[#F1F5F9]">
                  <X size={16} className="text-[#94A3B8]" />
                </button>
              </div>

              {aiPracticeLoading ? (
                <div className="flex items-center justify-center py-10 gap-3">
                  <Loader2 size={22} className="animate-spin text-purple-500" />
                  <span className="text-sm text-[#64748B]">AI đang tạo bài luyện...</span>
                </div>
              ) : aiPracticeResult ? (
                <div className="space-y-3">
                  {aiPracticeResult.split(/\n(?=\d+\.)/).filter(Boolean).map((block, i) => (
                    <div key={i} className="bg-[#F8FAFC] rounded-2xl p-4 border border-[#E2E8F0]">
                      <pre className="text-sm text-[#0F172A] whitespace-pre-wrap font-sans leading-relaxed">{block.trim()}</pre>
                    </div>
                  ))}
                </div>
              ) : null}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </StudentShell>
  )
}
