'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  CheckCircle2, XCircle, RefreshCw, Trophy, BookOpen,
  Mic, PenTool, Brain, ClipboardCheck
} from 'lucide-react'
import api from '@/lib/api'
import { clearTokens, getAccessToken } from '@/lib/authSession'
import { StudentShell } from '@/components/layouts/StudentShell'
import { assessmentApi, type B1ReadinessResponse } from '@/lib/assessmentApi'

type Me = { displayName: string; role: string }

const CRITERIA = [
  {
    key: 'vocabularyCheckPassed' as const,
    label: 'Từ vựng',
    desc: '700+ từ đã thuộc',
    icon: BookOpen,
    color: '#FFCD00',
  },
  {
    key: 'speakingCheckPassed' as const,
    label: 'Nói',
    desc: '1500+ phút luyện nói',
    icon: Mic,
    color: '#60a5fa',
  },
  {
    key: 'grammarCheckPassed' as const,
    label: 'Ngữ pháp',
    desc: '85%+ độ chính xác',
    icon: PenTool,
    color: '#34d399',
  },
  {
    key: 'confidenceCheckPassed' as const,
    label: 'Tự tin',
    desc: 'Đạt giai đoạn Fluency',
    icon: Brain,
    color: '#f472b6',
  },
  {
    key: 'mockExamPassed' as const,
    label: 'Thi thử',
    desc: 'Vượt qua bài thi thử B1',
    icon: ClipboardCheck,
    color: '#a78bfa',
  },
]

export default function AssessmentPage() {
  const router = useRouter()
  const [me, setMe] = useState<Me | null>(null)
  const [readiness, setReadiness] = useState<B1ReadinessResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [evaluating, setEvaluating] = useState(false)
  const [mockLoading, setMockLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!getAccessToken()) { router.push('/login'); return }
    ;(async () => {
      try {
        const [meRes, readinessRes] = await Promise.allSettled([
          api.get<Me>('/auth/me'),
          assessmentApi.getReadiness(),
        ])
        if (meRes.status === 'fulfilled') setMe(meRes.value.data)
        if (readinessRes.status === 'fulfilled') setReadiness(readinessRes.value.data)
      } catch {
        setError('Không thể tải dữ liệu đánh giá.')
      } finally {
        setLoading(false)
      }
    })()
  }, [router])

  const handleLogout = useCallback(() => { clearTokens(); router.push('/') }, [router])

  async function handleEvaluate() {
    setEvaluating(true)
    setError(null)
    try {
      const res = await assessmentApi.evaluate()
      setReadiness(res.data)
    } catch {
      setError('Không thể chạy đánh giá. Thử lại sau.')
    } finally {
      setEvaluating(false)
    }
  }

  async function handleMockExam(passed: boolean) {
    setMockLoading(true)
    setError(null)
    try {
      const res = await assessmentApi.recordMockExam(passed)
      setReadiness(res.data)
    } catch {
      setError('Không thể lưu kết quả thi thử.')
    } finally {
      setMockLoading(false)
    }
  }

  if (!me) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-[#121212] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const initials = me.displayName.split(' ').map((p) => p.charAt(0)).join('').slice(0, 2).toUpperCase()
  const score = readiness?.readinessScore ?? 0
  const isGraduated: boolean = !!(readiness?.fullyReady && readiness.graduationConfirmedAt)

  const shellProps = {
    activeSection: 'dashboard' as const,
    user: { displayName: me.displayName, role: me.role },
    targetLevel: 'B1',
    streakDays: 0,
    initials,
    onLogout: handleLogout,
    headerTitle: 'Đánh giá B1',
  }

  if (loading) {
    return (
      <StudentShell {...shellProps}>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="w-8 h-8 border-3 border-[#121212] border-t-transparent rounded-full animate-spin" />
        </div>
      </StudentShell>
    )
  }

  return (
    <StudentShell {...shellProps}>
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-[24px] px-6 py-7 ${isGraduated ? 'bg-emerald-600' : 'bg-[#121212]'} text-white`}
        >
          <div className="flex items-center gap-2 mb-3">
            <Trophy size={16} className={isGraduated ? 'text-yellow-300' : 'text-[#FFCD00]'} />
            <span className="text-xs font-bold uppercase tracking-widest text-white/50">
              Đánh giá B1
            </span>
          </div>
          <h1 className="text-2xl font-extrabold mb-1">
            {isGraduated ? '🎓 Bạn đã đạt B1!' : 'Sẵn sàng cho B1?'}
          </h1>
          <p className="text-sm text-white/70">
            {isGraduated
              ? 'Chúc mừng! Bạn đã hoàn thành hành trình 12 tuần.'
              : 'Kiểm tra xem bạn đã đáp ứng đủ 5 tiêu chí để đạt chuẩn B1 chưa.'}
          </p>

          {/* Score ring */}
          <div className="mt-5 flex items-center gap-4">
            <ScoreRing score={score} graduated={isGraduated} />
            <div>
              <p className="text-3xl font-black">{score}<span className="text-lg font-bold text-white/50">/100</span></p>
              <p className="text-xs text-white/60">
                {score >= 80 ? 'Gần đạt chuẩn!' : score >= 40 ? 'Đang tiến bộ tốt' : 'Hãy tiếp tục luyện tập'}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Criteria checklist */}
        <section>
          <h2 className="text-sm font-bold uppercase tracking-widest text-[#94A3B8] mb-3 px-1">
            5 tiêu chí đánh giá
          </h2>
          <div className="space-y-2">
            {CRITERIA.map((c, i) => {
              const passed = readiness ? readiness[c.key] : false
              const Icon = c.icon
              return (
                <motion.div
                  key={c.key}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.07 }}
                  className={`flex items-center gap-4 rounded-[16px] p-4 border transition-all ${
                    passed
                      ? 'bg-emerald-50 border-emerald-200'
                      : 'bg-white border-[#E2E8F0]'
                  }`}
                >
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: passed ? '#d1fae5' : '#F1F4F9' }}
                  >
                    <Icon size={18} style={{ color: passed ? '#059669' : c.color }} />
                  </div>
                  <div className="flex-1">
                    <p className={`font-bold text-sm ${passed ? 'text-emerald-800' : 'text-[#0F172A]'}`}>
                      {c.label}
                    </p>
                    <p className={`text-xs ${passed ? 'text-emerald-600' : 'text-[#94A3B8]'}`}>{c.desc}</p>
                  </div>
                  {passed
                    ? <CheckCircle2 size={20} className="text-emerald-500 flex-shrink-0" />
                    : <XCircle size={20} className="text-[#CBD5E1] flex-shrink-0" />}
                </motion.div>
              )
            })}
          </div>
        </section>

        {/* Mock exam recorder */}
        {!readiness?.mockExamPassed && (
          <div className="bg-white border border-[#E2E8F0] rounded-[20px] p-5">
            <h3 className="font-bold text-[#0F172A] text-sm mb-1">Ghi nhận kết quả thi thử</h3>
            <p className="text-xs text-[#64748B] mb-4">
              Sau khi làm bài thi thử tại <strong>/student/mock-exam</strong>, ghi nhận kết quả tại đây.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => handleMockExam(true)}
                disabled={mockLoading}
                className="flex-1 py-2.5 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-60"
              >
                Đã đậu
              </button>
              <button
                onClick={() => handleMockExam(false)}
                disabled={mockLoading}
                className="flex-1 py-2.5 bg-[#F1F4F9] text-[#64748B] text-xs font-bold rounded-xl hover:bg-[#E2E8F0] transition-colors disabled:opacity-60"
              >
                Chưa đậu
              </button>
            </div>
          </div>
        )}

        {error && (
          <p className="text-sm text-red-600 text-center">{error}</p>
        )}

        {/* Evaluate button */}
        <button
          onClick={handleEvaluate}
          disabled={evaluating}
          className="w-full py-4 bg-[#121212] text-white font-extrabold rounded-[16px] flex items-center justify-center gap-2 hover:bg-[#1e1e1e] transition-colors disabled:opacity-60"
        >
          {evaluating
            ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            : <><RefreshCw size={16} /> Chạy đánh giá lại</>
          }
        </button>

        {readiness?.lastAssessmentAt && (
          <p className="text-center text-xs text-[#94A3B8]">
            Đánh giá lần cuối: {new Date(readiness.lastAssessmentAt).toLocaleString('vi-VN')}
          </p>
        )}

      </div>
    </StudentShell>
  )
}

function ScoreRing({ score, graduated }: { score: number; graduated: boolean }) {
  const r = 28
  const circ = 2 * Math.PI * r
  const dash = (score / 100) * circ

  return (
    <svg width={72} height={72} viewBox="0 0 72 72">
      <circle cx={36} cy={36} r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={6} />
      <motion.circle
        cx={36} cy={36} r={r}
        fill="none"
        stroke={graduated ? '#fde047' : '#FFCD00'}
        strokeWidth={6}
        strokeLinecap="round"
        strokeDasharray={circ}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: circ - dash }}
        transition={{ duration: 1, ease: 'easeOut' }}
        transform="rotate(-90 36 36)"
      />
    </svg>
  )
}
