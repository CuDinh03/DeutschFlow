'use client'

import { useLocale, useTranslations } from 'next-intl'
import { Sparkles, ThumbsUp, TrendingUp, PenTool, Clock, Check } from 'lucide-react'
import { pickExamFeedback } from '@/lib/exam/examFeedbackLocale'

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
  /** Trình độ bài viết được chấm theo (backend gửi từ 07/09/2026; lượt cũ không có). */
  level?: string
}

interface ExamFeedbackProps {
  detailedScores: Record<string, unknown>
}

// labelKey tương đối trong namespace `v2.student.examResult.examFeedback`.
const RUBRIC_LABELS: Record<string, { labelKey: string; max: number }> = {
  aufgabenerfuellung: { labelKey: 'rubric.aufgabenerfuellung', max: 5 },
  kohaerenz: { labelKey: 'rubric.kohaerenz', max: 4 },
  wortschatz: { labelKey: 'rubric.wortschatz', max: 3 },
  strukturen: { labelKey: 'rubric.strukturen', max: 3 },
}

function RubricBar({ label, score, max }: { label: string; score: number; max: number }) {
  const pct = max > 0 ? Math.round((score / max) * 100) : 0
  const color = pct >= 60 ? '#10B981' : pct >= 40 ? '#F59E0B' : '#EF4444'
  return (
    <div>
      <div className="flex justify-between gap-2 text-xs mb-1">
        <span className="min-w-0 break-words text-[#64748B]">{label}</span>
        <span className="shrink-0 font-bold text-[#0F172A]">{score}/{max}</span>
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
  const t = useTranslations('v2.student.examResult.examFeedback')
  const locale = useLocale()
  // Backend sinh song song feedback_vi + feedback_de; chọn theo locale thay vì luôn đọc bản Việt.
  const feedback = pickExamFeedback(evalData, locale)
  if (evalData.status === 'PENDING_AI_EVALUATION') {
    return (
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-100 rounded-2xl p-4">
        <Clock size={18} className="text-amber-500 shrink-0 mt-0.5" />
        <div>
          <p className="font-bold text-amber-800 text-sm">{t('pendingTitle')}</p>
          <p className="text-xs text-amber-600 mt-0.5">{feedback || t('pendingFallback')}</p>
        </div>
      </div>
    )
  }

  if (evalData.status !== 'AI_EVALUATED') return null

  return (
    <div className="space-y-4">
      {/* AI badge */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex shrink-0 items-center gap-1.5 bg-violet-50 border border-violet-100 rounded-full px-3 py-1">
          <Sparkles size={13} className="text-violet-500" />
          <span className="text-xs font-bold text-violet-700">{t('aiGraded')}</span>
        </div>
        <span className="min-w-0 text-xs text-[#94A3B8]">
          {evalData.level ? t('officialRubricLevel', { level: evalData.level }) : t('officialRubric')}
        </span>
      </div>

      {/* Rubric breakdown */}
      <div className="bg-white rounded-2xl border border-[#E2E8F0] p-4 space-y-3">
        <p className="text-xs font-bold text-[#64748B] uppercase tracking-wide mb-3">{t('detailCap')}</p>
        {Object.entries(RUBRIC_LABELS).map(([key, meta]) => {
          const score = evalData[key as keyof AiEmailEvaluation] as number ?? 0
          return (
            <RubricBar
              key={key}
              label={t(meta.labelKey)}
              score={score}
              max={meta.max}
            />
          )
        })}
        <div className="pt-2 border-t border-[#F1F5F9] flex justify-between items-center gap-2">
          <span className="min-w-0 text-sm font-bold text-[#0F172A]">{t('emailTotal')}</span>
          <span className="shrink-0 text-lg font-black text-[#6366F1]">
            {evalData.total ?? 0}<span className="text-sm font-semibold text-[#94A3B8]">/15</span>
          </span>
        </div>
      </div>

      {/* Feedback text */}
      {feedback && (
        <div className="bg-slate-50 rounded-2xl border border-[#E2E8F0] p-4">
          <p className="text-xs font-bold text-[#64748B] uppercase tracking-wide mb-2">{t('overallCap')}</p>
          <p className="text-sm text-[#334155] leading-relaxed">{feedback}</p>
        </div>
      )}

      {/* Strengths */}
      {evalData.strengths && evalData.strengths.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <ThumbsUp size={14} className="text-emerald-500" />
            <p className="text-xs font-bold text-emerald-700">{t('strengths')}</p>
          </div>
          <ul className="space-y-1">
            {evalData.strengths.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-[#334155]">
                <Check size={13} className="text-emerald-400 mt-0.5 shrink-0" aria-hidden />
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
            <p className="text-xs font-bold text-blue-700">{t('improvements')}</p>
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
  const t = useTranslations('v2.student.examResult.examFeedback')
  const schreiben = detailedScores['SCHREIBEN'] as Record<string, unknown> | undefined
  const teil2Raw = schreiben?.['teil2_email']

  if (!teil2Raw || typeof teil2Raw !== 'object') return null

  const teil2 = teil2Raw as AiEmailEvaluation

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <PenTool size={16} className="text-[#10B981]" />
        <h3 className="font-bold text-[#0F172A] text-sm">{t('title')}</h3>
      </div>
      <SchreibenFeedback eval={teil2} />
    </div>
  )
}
