'use client'
import { logout } from '@/lib/authSession'
import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Brain, Loader2, CheckCircle2, RotateCcw, Zap, Trophy, ArrowLeft,
  AlertTriangle, ArrowRight,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { StudentShell } from '@/components/layouts/StudentShell'
import { useStudentPracticeSession } from '@/hooks/useStudentPracticeSession'
import { reviewApi, type VocabReviewCard, type ErrorReviewTaskDto } from '@/lib/reviewApi'
import { usePageTimeTracker } from '@/hooks/usePageTimeTracker'
import { useTracking } from '@/hooks/useTracking'
import { QUALITY_LEVELS, isPassingQuality } from '@/lib/srsGrading'

// ─── Unified queue item ────────────────────────────────────────────────────

type HubItem =
  | { kind: 'vocab'; card: VocabReviewCard }
  | { kind: 'grammar'; task: ErrorReviewTaskDto }

function itemKey(item: HubItem): string {
  return item.kind === 'vocab' ? `v-${item.card.id}` : `g-${item.task.id}`
}

// ─── Summary screen ──────────────────────────────────────────────────────────

function SummaryScreen({
  total, passed, onRestart,
}: {
  total: number; passed: number; onRestart: () => void
}) {
  const router = useRouter()
  const failedCount = total - passed
  const pct = total > 0 ? Math.round((passed / total) * 100) : 0

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center text-center gap-6 py-12"
    >
      <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#6366F1] to-[#8B5CF6] flex items-center justify-center shadow-xl">
        <Trophy size={40} className="text-white" />
      </div>
      <div>
        <h2 className="text-2xl font-extrabold text-[#0F172A] mb-2">Phiên ôn tập hoàn thành!</h2>
        <p className="text-[#64748B]">Bạn đã ôn {total} mục hôm nay</p>
      </div>

      <div className="grid grid-cols-3 gap-4 w-full max-w-xs">
        <div className="bg-green-50 rounded-2xl p-3 border border-green-100">
          <p className="text-2xl font-extrabold text-green-600">{passed}</p>
          <p className="text-xs text-green-500 font-semibold">Tốt</p>
        </div>
        <div className="bg-red-50 rounded-2xl p-3 border border-red-100">
          <p className="text-2xl font-extrabold text-red-500">{failedCount}</p>
          <p className="text-xs text-red-400 font-semibold">Cần ôn lại</p>
        </div>
        <div className="bg-[#EEF2FF] rounded-2xl p-3 border border-[#C7D2FE]">
          <p className="text-2xl font-extrabold text-[#6366F1]">{pct}%</p>
          <p className="text-xs text-[#6366F1] font-semibold">Đúng</p>
        </div>
      </div>

      <div className="flex gap-3 w-full max-w-xs">
        <button
          type="button"
          onClick={onRestart}
          className="flex-1 py-3 rounded-2xl border border-[#E2E8F0] text-[#64748B] font-bold flex items-center justify-center gap-2"
        >
          <RotateCcw size={16} /> Ôn thêm
        </button>
        <button
          type="button"
          onClick={() => router.push('/student')}
          className="flex-1 py-3 rounded-2xl bg-[#121212] text-white font-bold"
        >
          Về trang chủ
        </button>
      </div>
    </motion.div>
  )
}

// ─── Vocab flip-card ───────────────────────────────────────────────────────

function VocabCard({ card, onGrade }: { card: VocabReviewCard; onGrade: (quality: number) => void }) {
  const [revealed, setRevealed] = useState(false)

  return (
    <div className="bg-white rounded-3xl shadow-xl border border-[#E2E8F0] overflow-hidden">
      <div className="bg-gradient-to-br from-[#121212] to-[#1E4D8C] px-6 py-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] text-white/50 uppercase tracking-widest font-bold">Từ vựng</span>
          <span className="text-[10px] text-white/50">Lần ôn thứ {card.repetitions + 1}</span>
        </div>
        <p className="text-2xl font-extrabold text-white leading-snug">{card.german}</p>
      </div>

      <div className="px-6 py-5 min-h-[120px] flex items-center justify-center">
        {!revealed ? (
          <button
            type="button"
            onClick={() => setRevealed(true)}
            className="px-6 py-3 bg-[#F8FAFF] rounded-2xl border-2 border-dashed border-[#CBD5E1] text-[#64748B] font-semibold text-sm hover:border-[#121212] hover:text-[#121212] transition-all flex items-center gap-2"
          >
            <Brain size={18} /> Hiện nghĩa
          </button>
        ) : (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-center">
            <p className="text-lg font-bold text-[#0F172A]">{card.meaning}</p>
            {card.exampleDe && <p className="text-sm text-[#64748B] mt-2 italic">{card.exampleDe}</p>}
          </motion.div>
        )}
      </div>

      {revealed && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="px-4 pb-5">
          <p className="text-center text-xs font-bold text-[#64748B] uppercase tracking-widest mb-3">
            Bạn nhớ tốt đến đâu?
          </p>
          <div className="grid grid-cols-5 gap-2">
            {QUALITY_LEVELS.map(({ q, emoji, label, color, bg }) => (
              <button
                key={q}
                type="button"
                onClick={() => onGrade(q)}
                className="flex flex-col items-center gap-1.5 py-3 rounded-2xl font-bold text-xs transition-all hover:scale-105 active:scale-95 border-2"
                style={{ background: bg, borderColor: color, color }}
              >
                <span className="text-lg">{emoji}</span>
                <span className="text-[9px] font-bold leading-tight text-center">{label}</span>
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  )
}

// ─── Grammar task card ─────────────────────────────────────────────────────

function GrammarCard({
  task, onComplete,
}: {
  task: ErrorReviewTaskDto
  onComplete: (passed: boolean) => void
}) {
  const router = useRouter()
  return (
    <div className="bg-white rounded-3xl shadow-xl border border-[#E2E8F0] overflow-hidden">
      <div className="bg-gradient-to-br from-[#92400E] to-[#B45309] px-6 py-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] text-white/60 uppercase tracking-widest font-bold flex items-center gap-1">
            <AlertTriangle size={12} /> Lỗi ngữ pháp
          </span>
          <span className="text-[10px] text-white/60">Ôn mỗi {task.intervalDays} ngày</span>
        </div>
        <p className="text-lg font-extrabold text-white leading-snug">{task.errorCode}</p>
      </div>

      <div className="px-6 py-5 space-y-4">
        <p className="text-sm text-[#64748B]">
          Luyện sửa lỗi này bằng bài tập viết lại câu để củng cố.
        </p>
        <button
          type="button"
          onClick={() => router.push('/student/errors')}
          className="w-full py-3 rounded-2xl bg-[#FEF3C7] border-2 border-[#FDE68A] text-[#92400E] font-bold text-sm flex items-center justify-center gap-2 hover:bg-[#FDE68A] transition-colors"
        >
          Mở bài sửa lỗi <ArrowRight size={16} />
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onComplete(false)}
            className="py-3 rounded-2xl border-2 border-[#E2E8F0] text-[#64748B] font-bold text-xs"
          >
            Cần luyện thêm
          </button>
          <button
            type="button"
            onClick={() => onComplete(true)}
            className="py-3 rounded-2xl border-2 border-green-200 bg-green-50 text-green-700 font-bold text-xs"
          >
            Đã nắm vững
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ReviewQueuePage() {
  usePageTimeTracker('review_queue')
  const { me, loading: sessionLoading, targetLevel, streakDays, initials } = useStudentPracticeSession()
  const router = useRouter()
  const { trackFeatureAction } = useTracking()

  const [items, setItems] = useState<HubItem[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [passed, setPassed] = useState(0)
  const [done, setDone] = useState(false)
  const [empty, setEmpty] = useState(false)

  const loadQueue = useCallback(async () => {
    setLoading(true)
    setDone(false)
    setCurrentIndex(0)
    setPassed(0)
    try {
      const [vocab, tasksRes] = await Promise.all([
        reviewApi.getDueVocab().catch(() => [] as VocabReviewCard[]),
        reviewApi.getTodayTasks().catch(() => ({ tasks: [], lockedCount: 0 })),
      ])
      const queue: HubItem[] = [
        ...vocab.map((card): HubItem => ({ kind: 'vocab', card })),
        ...tasksRes.tasks.map((task): HubItem => ({ kind: 'grammar', task })),
      ]
      if (queue.length === 0) {
        setEmpty(true)
      } else {
        setItems(queue)
        setEmpty(false)
        trackFeatureAction('srs_review', 'started', {
          card_count: queue.length,
          vocab_count: vocab.length,
          grammar_count: tasksRes.tasks.length,
          cefr: targetLevel,
        })
      }
    } catch {
      setEmpty(true)
    } finally {
      setLoading(false)
    }
  }, [trackFeatureAction, targetLevel])

  useEffect(() => { loadQueue() }, [loadQueue])

  const advance = useCallback((wasPassed: boolean) => {
    setPassed(p => p + (wasPassed ? 1 : 0))
    const next = currentIndex + 1
    if (next >= items.length) {
      setDone(true)
      trackFeatureAction('srs_review', 'completed', {
        total: items.length,
        passed: passed + (wasPassed ? 1 : 0),
        cefr: targetLevel,
      })
    } else {
      setCurrentIndex(next)
    }
  }, [currentIndex, items.length, passed, targetLevel, trackFeatureAction])

  const handleVocabGrade = useCallback(async (vocabId: string, quality: number) => {
    if (busy) return
    setBusy(true)
    try { await reviewApi.gradeVocab(vocabId, quality) } catch { /* best-effort */ }
    advance(isPassingQuality(quality))
    setBusy(false)
  }, [busy, advance])

  const handleGrammarComplete = useCallback(async (taskId: number, wasPassed: boolean) => {
    if (busy) return
    setBusy(true)
    try { await reviewApi.completeTask(taskId, wasPassed) } catch { /* best-effort */ }
    advance(wasPassed)
    setBusy(false)
  }, [busy, advance])

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

  const current = items[currentIndex]

  return (
    <StudentShell
      activeSection="review-queue"
      user={me}
      targetLevel={targetLevel}
      streakDays={streakDays}
      initials={initials}
      onLogout={() => { logout() }}
      headerTitle="Ôn tập hôm nay"
      headerSubtitle="Từ vựng + lỗi ngữ pháp đến hạn — ôn đúng lúc, nhớ mãi mãi"
    >
      <div className="max-w-lg mx-auto px-4 pb-8">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm text-[#64748B] mb-6 hover:text-[#121212] transition-colors"
        >
          <ArrowLeft size={16} /> Quay lại
        </button>

        {loading && (
          <div className="flex items-center justify-center py-24 gap-3 text-[#64748B]">
            <Loader2 size={24} className="animate-spin text-[#121212]" />
            <span>Đang tải hàng đợi ôn tập...</span>
          </div>
        )}

        {!loading && empty && (
          <div className="text-center py-16">
            <CheckCircle2 size={56} className="text-green-400 mx-auto mb-4" />
            <h2 className="text-xl font-extrabold text-[#0F172A] mb-2">Tất cả đã ôn hôm nay! 🎉</h2>
            <p className="text-[#64748B] mb-6">Không có mục nào cần ôn lúc này. Quay lại ngày mai!</p>
            <button
              type="button"
              onClick={() => router.push('/student')}
              className="px-6 py-3 bg-[#121212] text-white rounded-2xl font-bold"
            >
              Về trang chủ
            </button>
          </div>
        )}

        {!loading && !empty && !done && current && (
          <>
            {/* Progress */}
            <div className="mb-6">
              <div className="flex justify-between text-xs text-[#94A3B8] mb-2">
                <span>Mục {currentIndex + 1} / {items.length}</span>
                <span>{Math.round((currentIndex / items.length) * 100)}% hoàn thành</span>
              </div>
              <div className="h-2 bg-[#F1F5F9] rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${(currentIndex / items.length) * 100}%` }}
                  transition={{ duration: 0.4 }}
                />
              </div>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={itemKey(current)}
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                transition={{ duration: 0.25 }}
              >
                {current.kind === 'vocab' ? (
                  <VocabCard card={current.card} onGrade={q => handleVocabGrade(current.card.vocabId, q)} />
                ) : (
                  <GrammarCard task={current.task} onComplete={p => handleGrammarComplete(current.task.id, p)} />
                )}
              </motion.div>
            </AnimatePresence>
          </>
        )}

        {!loading && done && (
          <SummaryScreen total={items.length} passed={passed} onRestart={loadQueue} />
        )}
      </div>
    </StudentShell>
  )
}
