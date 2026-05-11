'use client'
import { logout } from '@/lib/authSession'
import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, Shield, Zap, RotateCcw, BookOpen, CheckCircle2,
  AlertTriangle, Loader2, RefreshCw, Calendar, Clock,
  ChevronDown, ChevronUp,
} from 'lucide-react'
import { StudentShell } from '@/components/layouts/StudentShell'
import { useStudentPracticeSession } from '@/hooks/useStudentPracticeSession'
import { reviewApi, type ErrorReviewTaskDto } from '@/lib/reviewApi'
import api from '@/lib/api'
import ErrorRepairDrill from '@/components/errors/ErrorRepairDrill'
import { useTranslations } from 'next-intl'

// ─── Types ─────────────────────────────────────────────────────────────────

interface ErrorSkillDto {
  errorCode: string
  count: number
  lastSeenAt: string
  priorityScore: number
  sampleWrong?: string
  sampleCorrected?: string
  ruleViShort?: string
  resolved?: boolean
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
  const upper = code.toUpperCase()
  if (upper.startsWith('CASE'))  return CAT_COLORS.KASUS
  if (upper.startsWith('VERB'))  return CAT_COLORS.VERB
  if (upper.startsWith('ART'))   return CAT_COLORS.ARTIKEL
  if (upper.startsWith('PRAEP') || upper.startsWith('PREP')) return CAT_COLORS.PRAEP
  if (upper.startsWith('ADJ'))   return CAT_COLORS.ADJEKTIV
  return { bg: '#F1F5F9', text: '#475569', label: 'other' } // label will be translated later
}

// ─── Main component ─────────────────────────────────────────────────────────

export default function ErrorLibraryPage() {
  const { me, loading: sessionLoading, targetLevel, streakDays, initials } = useStudentPracticeSession()
  const tErrors = useTranslations('errors')

  const [errors, setErrors] = useState<ErrorSkillDto[]>([])
  const [resolvedErrors, setResolvedErrors] = useState<ErrorSkillDto[]>([])
  const [tasks, setTasks] = useState<ErrorReviewTaskDto[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [repairedCodes, setRepairedCodes] = useState<Set<string>>(new Set())
  const [completedTasks, setCompletedTasks] = useState<Set<number>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [activeDrillError, setActiveDrillError] = useState<ErrorSkillDto | null>(null)
  const [activeDrillTaskId, setActiveDrillTaskId] = useState<number | null>(null)
  const [showResolved, setShowResolved] = useState(false)

  // ── Fetch data ──────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [skillsRes, resolvedRes, tasksRes] = await Promise.allSettled([
        api.get<ErrorSkillDto[]>('/error-skills/me', { params: { days: 30 } }),
        api.get<ErrorSkillDto[]>('/error-skills/me/resolved'),
        reviewApi.getTodayTasks(),
      ])
      if (skillsRes.status === 'fulfilled') setErrors(skillsRes.value.data)
      if (resolvedRes.status === 'fulfilled') setResolvedErrors(resolvedRes.value.data)
      if (tasksRes.status === 'fulfilled') setTasks(tasksRes.value)
    } catch {
      setError(tErrors('loadError'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Open drill for a review task (replaces "Đã nhớ" button) ────────────
  const handleTaskDrill = (task: ErrorReviewTaskDto) => {
    // Find matching error skill for this task
    const matchingError = errors.find(e => e.errorCode === task.errorCode)
    setActiveDrillError(matchingError || {
      errorCode: task.errorCode,
      count: 0,
      lastSeenAt: '',
      priorityScore: 0,
    })
    setActiveDrillTaskId(task.id)
  }

  // ── Open drill for an error card ───────────────────────────────────────
  const handleRepair = (err: ErrorSkillDto) => {
    setActiveDrillError(err)
    setActiveDrillTaskId(null)
  }

  // ── Drill completed callback ───────────────────────────────────────────
  const handleDrillClose = async (passed: boolean) => {
    if (activeDrillError && passed) {
      // Mark as repaired in UI
      setRepairedCodes(prev => new Set(Array.from(prev).concat(activeDrillError.errorCode)))

      // If this was triggered from a review task, auto-complete it
      if (activeDrillTaskId) {
        try {
          await reviewApi.completeTask(activeDrillTaskId, true)
          setCompletedTasks(prev => new Set(Array.from(prev).concat(activeDrillTaskId!)))
        } catch {
          // non-fatal
        }
      }
    }
    setActiveDrillError(null)
    setActiveDrillTaskId(null)
  }

  // ── Filter ──────────────────────────────────────────────────────────────
  const filtered = errors.filter(e =>
    !search || e.errorCode.toLowerCase().includes(search.toLowerCase())
  )

  const filteredResolved = resolvedErrors.filter(e =>
    !search || e.errorCode.toLowerCase().includes(search.toLowerCase())
  )

  const pendingTasks = tasks.filter(t => !completedTasks.has(t.id))

  if (sessionLoading || !me) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F1F4F9]">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-8 h-8 border-4 border-[#121212] border-t-transparent rounded-full"
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
      headerTitle={tErrors('libraryTitle')}
      headerSubtitle={tErrors('librarySubtitle')}
    >
      <div className="max-w-2xl mx-auto space-y-6">

        {/* ── Today's review tasks ───────────────────────────────────────── */}
        {pendingTasks.length > 0 && (
          <div className="bg-gradient-to-br from-[#FFF8E1] to-[#FFFDE7] rounded-3xl p-5 border border-[#FDE68A] shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Calendar size={18} className="text-[#F59E0B]" />
              <h2 className="font-bold text-[#92400E]">{tErrors('reviewToday')} ({pendingTasks.length})</h2>
            </div>
            <div className="space-y-3">
              {pendingTasks.map(task => (
                <div key={task.id} className="bg-white rounded-2xl p-4 border border-[#FDE68A] flex items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-sm text-[#0F172A]">{task.errorCode}</p>
                    <p className="text-xs text-[#64748B] flex items-center gap-1 mt-0.5">
                      <Clock size={11} /> Interval: {task.intervalDays} {tErrors('days')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleTaskDrill(task)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#121212] text-white font-bold text-xs hover:bg-[#004b90] active:scale-95 transition-all"
                  >
                    <RotateCcw size={12} /> {tErrors('practiceFix')}
                  </button>
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
              placeholder={tErrors('searchPlaceholder')}
              className="w-full bg-white border border-[#E2E8F0] rounded-2xl py-3 pl-12 pr-4 text-[#0F172A] placeholder:text-[#94A3B8] outline-none focus:border-[#121212] transition-all shadow-sm"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button
            type="button"
            onClick={fetchData}
            className="w-12 h-12 rounded-2xl bg-white border border-[#E2E8F0] text-[#64748B] hover:text-[#121212] hover:border-[#121212] flex items-center justify-center shadow-sm transition-all"
          >
            <RefreshCw size={16} />
          </button>
        </div>

        {/* ── Loading / error states ─────────────────────────────────────── */}
        {loading && (
          <div className="flex items-center justify-center py-16 gap-3 text-[#64748B]">
            <Loader2 size={22} className="animate-spin text-[#121212]" />
            <span className="text-sm">{tErrors('loadingErrors')}</span>
          </div>
        )}

        {!loading && error && (
          <div className="text-center py-10">
            <AlertTriangle size={36} className="text-amber-400 mx-auto mb-3" />
            <p className="text-sm text-[#64748B] mb-4">{error}</p>
            <button type="button" onClick={fetchData} className="px-4 py-2 rounded-xl bg-[#121212] text-white font-bold text-sm">
              {tErrors('retry')}
            </button>
          </div>
        )}

        {!loading && !error && filtered.length === 0 && resolvedErrors.length === 0 && (
          <div className="text-center py-14">
            <CheckCircle2 size={48} className="text-green-400 mx-auto mb-4" />
            <p className="font-bold text-[#0F172A] mb-1">{tErrors('noErrorsTitle')}</p>
            <p className="text-sm text-[#64748B]">{tErrors('noErrorsDesc')}</p>
          </div>
        )}

        {/* ── Open Error cards (Chưa sửa) ─────────────────────────────────── */}
        {!loading && filtered.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={14} className="text-amber-500" />
              <h3 className="text-xs font-bold text-[#64748B] uppercase tracking-wide">
                {tErrors('unfixedErrors')} ({filtered.length})
              </h3>
            </div>
            <AnimatePresence>
              <div className="space-y-4">
                {filtered.map((err, idx) => {
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
                            {style.label === 'other' ? tErrors('other') : style.label}
                          </span>
                          {repaired && (
                            <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-green-100 text-green-600">
                              ✓ {tErrors('fixed')}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-1 rounded-full">
                          {tErrors('seenCount', { count: err.count })}
                        </span>
                      </div>

                      {/* Error code */}
                      <div className="mb-3">
                        <p className="font-mono font-bold text-[#0F172A] text-sm">{err.errorCode}</p>
                        {err.lastSeenAt && (
                          <p className="text-xs text-[#94A3B8] mt-0.5 flex items-center gap-1">
                            <Clock size={11} /> {tErrors('lastSeen')} {new Date(err.lastSeenAt).toLocaleDateString('vi-VN')}
                          </p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 mt-3">
                        <div className="flex items-center gap-1.5 flex-1 text-[#64748B]">
                          <Shield size={13} className="text-[#121212]" />
                          <span className="text-xs font-semibold">{tErrors('recordedGrammarError')}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRepair(err)}
                          disabled={repaired}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition-all ${
                            repaired
                              ? 'bg-green-100 text-green-600 cursor-default'
                              : 'bg-[#121212] text-white hover:bg-[#004b90] active:scale-95'
                          }`}
                        >
                          {repaired
                              ? <><CheckCircle2 size={12} /> {tErrors('fixed')}</>
                              : <><RotateCcw size={12} /> {tErrors('practiceFix')}</>}
                        </button>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </AnimatePresence>
          </div>
        )}

        {/* ── Completed tasks notice ──────────────────────────────────────── */}
        {!loading && pendingTasks.length === 0 && tasks.length > 0 && (
          <div className="text-center py-4 text-sm text-green-600 font-semibold bg-green-50 rounded-2xl border border-green-100">
            🎉 {tErrors('allDone')}
          </div>
        )}

        {/* ── Resolved errors section (Đã hoàn thành) ─────────────────────── */}
        {!loading && resolvedErrors.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setShowResolved(!showResolved)}
              className="w-full flex items-center justify-between py-3 px-4 rounded-2xl bg-green-50 border border-green-100 hover:bg-green-100 transition-all"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-green-500" />
                <h3 className="text-xs font-bold text-green-700 uppercase tracking-wide">
                  {tErrors('completed')} ({filteredResolved.length})
                </h3>
              </div>
              {showResolved ? <ChevronUp size={14} className="text-green-500" /> : <ChevronDown size={14} className="text-green-500" />}
            </button>

            <AnimatePresence>
              {showResolved && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-3 mt-3 overflow-hidden"
                >
                  {filteredResolved.map((err, idx) => {
                    const style = catStyle(err.errorCode)
                    return (
                      <motion.div
                        key={err.errorCode}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.04 }}
                        className="bg-white/80 rounded-2xl p-4 border border-green-100 relative overflow-hidden"
                      >
                        <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl bg-green-400" />
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase" style={{ background: style.bg, color: style.text }}>
                              {style.label === 'other' ? tErrors('other') : style.label}
                            </span>
                            <span className="font-mono font-bold text-[#0F172A] text-xs">{err.errorCode}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-bold bg-slate-100 text-slate-400 px-2 py-0.5 rounded-full">
                              {err.count} {tErrors('times')}
                            </span>
                            <span className="text-[9px] font-bold bg-green-100 text-green-600 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                              <CheckCircle2 size={9} /> {tErrors('fixed')}
                            </span>
                          </div>
                        </div>
                        {err.lastSeenAt && (
                          <p className="text-[10px] text-[#94A3B8] mt-1.5 flex items-center gap-1 ml-1">
                            <Clock size={9} /> {tErrors('lastTime')} {new Date(err.lastSeenAt).toLocaleDateString('vi-VN')}
                          </p>
                        )}
                      </motion.div>
                    )
                  })}
                </motion.div>
              )}
            </AnimatePresence>
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
    </StudentShell>
  )
}
