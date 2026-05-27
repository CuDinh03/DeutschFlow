'use client'

import { Sparkles, ThumbsUp, TrendingUp, PenTool, Clock } from 'lucide-react'

interface AiEmailEvaluation {
  status: string
  aufgabenerfuellung?: number
  kohaerenz?: number
  wortschatz?: number
  strukturen?: number
  total?: number
  max?: number
  percentage?: number
  feedback_vi?: string
  feedback_de?: string
  strengths?: string[]
  improvements?: string[]
  email_content?: string
}

interface ExamFeedbackProps {
  detailedScores: Record<string, unknown>
}

const RUBRIC_LABELS: Record<string, { labelVi: string; max: number }> = {
  aufgabenerfuellung: { labelVi: 'Hoàn thành nhiệm vụ', max: 5 },
  kohaerenz: { labelVi: 'Mạch lạc & cấu trúc', max: 4 },
  wortschatz: { labelVi: 'Từ vựng', max: 3 },
  strukturen: { labelVi: 'Ngữ pháp & cấu trúc câu', max: 3 },
}

function RubricBar({ label, score, max }: { label: string; score: number; max: number }) {
  const pct = max > 0 ? Math.round((score / max) * 100) : 0
  const color = pct >= 60 ? '#10B981' : pct >= 40 ? '#F59E0B' : '#EF4444'
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-[#64748B]">{label}</span>
        <span className="font-bold text-[#0F172A]">{score}/{max}</span>
      </div>
      <div className="h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  )
}

function SchreibenFeedback({ eval: evalData }: { eval: AiEmailEvaluation }) {
  if (evalData.status === 'PENDING_AI_EVALUATION') {
    return (
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-100 rounded-2xl p-4">
        <Clock size={18} className="text-amber-500 shrink-0 mt-0.5" />
        <div>
          <p className="font-bold text-amber-800 text-sm">Đang chờ AI chấm bài viết</p>
          <p className="text-xs text-amber-600 mt-0.5">{evalData.feedback_vi || 'Phần email chưa được nộp hoặc đang xử lý.'}</p>
        </div>
      </div>
    )
  }

  if (evalData.status !== 'AI_EVALUATED') return null

  return (
    <div className="space-y-4">
      {/* AI badge */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 bg-violet-50 border border-violet-100 rounded-full px-3 py-1">
          <Sparkles size={13} className="text-violet-500" />
          <span className="text-xs font-bold text-violet-700">Được chấm bởi AI</span>
        </div>
        <span className="text-xs text-[#94A3B8]">Rubric Goethe A1 chính thức</span>
      </div>

      {/* Rubric breakdown */}
      <div className="bg-white rounded-2xl border border-[#E2E8F0] p-4 space-y-3">
        <p className="text-xs font-bold text-[#64748B] uppercase tracking-wide mb-3">Điểm chi tiết</p>
        {Object.entries(RUBRIC_LABELS).map(([key, meta]) => {
          const score = evalData[key as keyof AiEmailEvaluation] as number ?? 0
          return (
            <RubricBar
              key={key}
              label={meta.labelVi}
              score={score}
              max={meta.max}
            />
          )
        })}
        <div className="pt-2 border-t border-[#F1F5F9] flex justify-between items-center">
          <span className="text-sm font-bold text-[#0F172A]">Tổng điểm email</span>
          <span className="text-lg font-black text-[#6366F1]">
            {evalData.total ?? 0}<span className="text-sm font-semibold text-[#94A3B8]">/15</span>
          </span>
        </div>
      </div>

      {/* Feedback text */}
      {evalData.feedback_vi && (
        <div className="bg-slate-50 rounded-2xl border border-[#E2E8F0] p-4">
          <p className="text-xs font-bold text-[#64748B] uppercase tracking-wide mb-2">Nhận xét tổng quan</p>
          <p className="text-sm text-[#334155] leading-relaxed">{evalData.feedback_vi}</p>
        </div>
      )}

      {/* Strengths */}
      {evalData.strengths && evalData.strengths.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <ThumbsUp size={14} className="text-emerald-500" />
            <p className="text-xs font-bold text-emerald-700">Điểm mạnh</p>
          </div>
          <ul className="space-y-1">
            {evalData.strengths.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-[#334155]">
                <span className="text-emerald-400 mt-0.5">✓</span>
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Improvements */}
      {evalData.improvements && evalData.improvements.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <TrendingUp size={14} className="text-blue-500" />
            <p className="text-xs font-bold text-blue-700">Cần cải thiện</p>
          </div>
          <ul className="space-y-1">
            {evalData.improvements.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-[#334155]">
                <span className="text-blue-400 mt-0.5">→</span>
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export function ExamFeedback({ detailedScores }: ExamFeedbackProps) {
  const schreiben = detailedScores['SCHREIBEN'] as Record<string, unknown> | undefined
  const teil2Raw = schreiben?.['teil2_email']

  if (!teil2Raw || typeof teil2Raw !== 'object') return null

  const teil2 = teil2Raw as AiEmailEvaluation

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <PenTool size={16} className="text-[#10B981]" />
        <h3 className="font-bold text-[#0F172A] text-sm">Đánh giá bài viết (SCHREIBEN Teil 2)</h3>
      </div>
      <SchreibenFeedback eval={teil2} />
    </div>
  )
}
