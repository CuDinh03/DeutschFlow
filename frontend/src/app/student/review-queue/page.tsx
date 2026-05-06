'use client'
import { logout } from '@/lib/authSession'
import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Brain, ChevronRight, Loader2, CheckCircle2, XCircle,
  RotateCcw, Zap, Trophy, ArrowLeft,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { StudentShell } from '@/components/layouts/StudentShell'
import { useStudentPracticeSession } from '@/hooks/useStudentPracticeSession'
import { reviewApi, type ReviewItem } from '@/lib/reviewApi'
import { xpApi } from '@/lib/xpApi'

// ─── Quality buttons ─────────────────────────────────────────────────────────

const QUALITY_LEVELS = [
  { q: 0, label: 'Quên hoàn toàn', color: '#EF4444', bg: '#FEE2E2' },
  { q: 2, label: 'Khó nhớ',        color: '#F97316', bg: '#FED7AA' },
  { q: 3, label: 'Nhớ ra',         color: '#EAB308', bg: '#FEF9C3' },
  { q: 4, label: 'Dễ nhớ',         color: '#22C55E', bg: '#DCFCE7' },
  { q: 5, label: 'Quá dễ!',        color: '#6366F1', bg: '#E0E7FF' },
]

// ─── Summary screen ───────────────────────────────────────────────────────────

function SummaryScreen({
  total, passed, xpEarned, onRestart,
}: {
  total: number; passed: number; xpEarned: number; onRestart: () => void
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
        <p className="text-[#64748B]">Bạn đã ôn {total} thẻ từ hôm nay</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 w-full max-w-xs">
        <div className="bg-green-50 rounded-2xl p-3 border border-green-100">
          <p className="text-2xl font-extrabold text-green-600">{passed}</p>
          <p className="text-xs text-green-500 font-semibold">Đúng</p>
        </div>
        <div className="bg-red-50 rounded-2xl p-3 border border-red-100">
          <p className="text-2xl font-extrabold text-red-500">{failedCount}</p>
          <p className="text-xs text-red-400 font-semibold">Sai</p>
        </div>
        <div className="bg-[#EEF2FF] rounded-2xl p-3 border border-[#C7D2FE]">
          <p className="text-2xl font-extrabold text-[#6366F1]">{pct}%</p>
          <p className="text-xs text-[#6366F1] font-semibold">Đúng</p>
        </div>
      </div>

      {/* XP earned */}
      {xpEarned > 0 && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.4, type: 'spring' }}
          className="flex items-center gap-2 px-5 py-3 bg-[#FFF8E1] rounded-2xl border border-[#FDE68A]"
        >
          <Zap size={18} className="text-[#F59E0B]" />
          <span className="font-bold text-[#92400E]">+{xpEarned} XP kiếm được!</span>
        </motion.div>
      )}

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
          className="flex-1 py-3 rounded-2xl bg-[#00305E] text-white font-bold"
        >
          Về trang chủ
        </button>
      </div>
    </motion.div>
  )
}

// ─── Card flip UI ─────────────────────────────────────────────────────────────

function ReviewCard({
  item,
  onGrade,
  cardIndex,
  total,
}: {
  item: ReviewItem
  onGrade: (quality: number) => void
  cardIndex: number
  total: number
}) {
  const [revealed, setRevealed] = useState(false)
  const progress = (cardIndex / total) * 100

  return (
    <motion.div
      key={item.id}
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
      transition={{ duration: 0.25 }}
      className="w-full max-w-lg mx-auto"
    >
      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex justify-between text-xs text-[#94A3B8] mb-2">
          <span>Thẻ {cardIndex + 1} / {total}</span>
          <span>{Math.round(progress)}% hoàn thành</span>
        </div>
        <div className="h-2 bg-[#F1F5F9] rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>
      </div>

      {/* Card */}
      <div className="bg-white rounded-3xl shadow-xl border border-[#E2E8F0] overflow-hidden mb-6">
        {/* Card header */}
        <div className="bg-gradient-to-br from-[#00305E] to-[#1E4D8C] px-6 py-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-white/50 uppercase tracking-widest font-bold">{item.itemType}</span>
            <span className="text-[10px] text-white/50">Lần ôn thứ {item.repetitions + 1}</span>
          </div>
          <p className="text-xl font-extrabold text-white leading-snug">{item.prompt}</p>
        </div>

        {/* Reveal zone */}
        <div className="px-6 py-5 min-h-[100px] flex items-center justify-center">
          {!revealed ? (
            <button
              type="button"
              onClick={() => setRevealed(true)}
              className="px-6 py-3 bg-[#F8FAFF] rounded-2xl border-2 border-dashed border-[#CBD5E1] text-[#64748B] font-semibold text-sm hover:border-[#00305E] hover:text-[#00305E] transition-all flex items-center gap-2"
            >
              <Brain size={18} /> Hiện đáp án
            </button>
          ) : (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <p className="text-sm text-[#64748B] text-center">
                Mục: <span className="font-bold text-[#0F172A]">{item.itemRef}</span>
              </p>
              <p className="text-xs text-[#94A3B8] text-center mt-1">
                Interval hiện tại: {item.intervalDays} ngày
              </p>
            </motion.div>
          )}
        </div>
      </div>

      {/* Quality grading */}
      {revealed && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <p className="text-center text-xs font-bold text-[#64748B] uppercase tracking-widest mb-3">
            Bạn nhớ tốt đến đâu?
          </p>
          <div className="grid grid-cols-5 gap-2">
            {QUALITY_LEVELS.map(({ q, label, color, bg }) => (
              <button
                key={q}
                type="button"
                onClick={() => onGrade(q)}
                className="flex flex-col items-center gap-1.5 py-3 rounded-2xl font-bold text-xs transition-all hover:scale-105 active:scale-95 border-2"
                style={{ background: bg, borderColor: color, color }}
              >
                <span className="text-lg">{q === 0 ? '😰' : q === 2 ? '😕' : q === 3 ? '🙂' : q === 4 ? '😊' : '🌟'}</span>
                <span className="text-[9px] font-bold leading-tight text-center">{label}</span>
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ReviewQueuePage() {
  const { me, loading: sessionLoading, targetLevel, streakDays, initials } = useStudentPracticeSession()
  const router = useRouter()

  const [items, setItems] = useState<ReviewItem[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [grading, setGrading] = useState(false)
  const [passed, setPassed] = useState(0)
  const [xpEarned, setXpEarned] = useState(0)
  const [done, setDone] = useState(false)
  const [empty, setEmpty] = useState(false)

  const loadCards = useCallback(async () => {
    setLoading(true)
    setDone(false)
    setCurrentIndex(0)
    setPassed(0)
    setXpEarned(0)
    try {
      const data = await reviewApi.getDue(20)
      if (!data.items || data.items.length === 0) {
        setEmpty(true)
      } else {
        setItems(data.items)
        setEmpty(false)
      }
    } catch {
      setEmpty(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadCards() }, [loadCards])

  const handleGrade = async (quality: number) => {
    if (grading) return
    setGrading(true)
    const item = items[currentIndex]
    try {
      await reviewApi.grade(item.id, quality)
      if (quality >= 3) {
        setPassed(p => p + 1)
        // Award XP for vocab review
        try {
          await xpApi.ackBadges() // reuse as ping — actual XP awarded server-side
        } catch { /* silent */ }
        setXpEarned(x => x + 3)
      }
    } catch { /* silent */ }

    const next = currentIndex + 1
    if (next >= items.length) {
      setDone(true)
    } else {
      setCurrentIndex(next)
    }
    setGrading(false)
  }

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
      activeSection="review-queue"
      user={me}
      targetLevel={targetLevel}
      streakDays={streakDays}
      initials={initials}
      onLogout={() => { logout() }}
      headerTitle="Ôn tập hôm nay"
      headerSubtitle="Spaced repetition — ôn đúng lúc, nhớ mãi mãi"
    >
      <div className="max-w-lg mx-auto px-4 pb-8">
        {/* Back button */}
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm text-[#64748B] mb-6 hover:text-[#00305E] transition-colors"
        >
          <ArrowLeft size={16} /> Quay lại
        </button>

        {loading && (
          <div className="flex items-center justify-center py-24 gap-3 text-[#64748B]">
            <Loader2 size={24} className="animate-spin text-[#00305E]" />
            <span>Đang tải thẻ ôn tập...</span>
          </div>
        )}

        {!loading && empty && (
          <div className="text-center py-16">
            <CheckCircle2 size={56} className="text-green-400 mx-auto mb-4" />
            <h2 className="text-xl font-extrabold text-[#0F172A] mb-2">Tất cả đã ôn hôm nay! 🎉</h2>
            <p className="text-[#64748B] mb-6">Không có thẻ nào cần ôn tập lúc này. Quay lại ngày mai!</p>
            <button
              type="button"
              onClick={() => router.push('/student')}
              className="px-6 py-3 bg-[#00305E] text-white rounded-2xl font-bold"
            >
              Về trang chủ
            </button>
          </div>
        )}

        {!loading && !empty && !done && items.length > 0 && (
          <AnimatePresence mode="wait">
            <ReviewCard
              key={currentIndex}
              item={items[currentIndex]}
              onGrade={handleGrade}
              cardIndex={currentIndex}
              total={items.length}
            />
          </AnimatePresence>
        )}

        {!loading && done && (
          <SummaryScreen
            total={items.length}
            passed={passed}
            xpEarned={xpEarned}
            onRestart={loadCards}
          />
        )}
      </div>
    </StudentShell>
  )
}
