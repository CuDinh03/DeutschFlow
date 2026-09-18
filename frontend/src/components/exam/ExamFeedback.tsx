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
  /** Thang thô của phiếu; co lại khi AI bỏ sót tiêu chí (lượt cũ không có ⇒ 15). */
  max?: number
  percentage?: number
  feedback_vi?: string
  feedback_de?: string
  strengths?: string[]
  improvements?: string[]
  email_content?: string
  /** Trình độ bài viết được chấm theo (backend gửi từ 07/09/2026; lượt cũ không có). */
  level?: string
  /** Tiêu chí AI không chấm — không vẽ thanh 0 điểm cho chúng. */
  missing_criteria?: string[]
  /**
   * Bản tự mô tả của bảng tiêu chí (backend gửi từ 15/09/2026): khoá + điểm + thang của đúng
   * những tiêu chí đã chấm. Cần vì mỗi định dạng đề có một bảng khác nhau — Goethe 4 tiêu chí
   * tổng 15, telc 3 Kriterien × 15 — mà danh sách đóng cứng bên dưới chỉ biết bảng Goethe.
   */
  criteria?: { key: string; score: number; max: number; band?: string }[]
  /**
   * Phiếu telc (17/09/2026): mỗi Kriterium là một BẬC A/B/C/D (điểm 15/9/3/0 do máy quy đổi), kèm
   * hai cờ toàn cục, các Leitpunkte thiếu (số thứ tự trong đề) và lý do Kriterium II mất A —
   * để nói được „ý nào thiếu, vì sao mất A" chứ không chỉ một con số.
   */
  bands?: Record<string, string>
  thema_verfehlt?: boolean
  situierung_verfehlt?: boolean
  leitpunkte_fehlt?: number[]
  kein_a_weil?: string[]
}

/** Bốn lý do Bewertungsbogen telc không cho A ở Kriterium II — chỉ những mã này có nhãn. */
const NO_A_REASON_KEYS: Record<string, string> = {
  TEXTSORTE: 'noAReason.textsorte',
  REGISTER: 'noAReason.register',
  UNVERBUNDEN: 'noAReason.unverbunden',
  ICH_ANFANG: 'noAReason.ichAnfang',
}

interface ExamFeedbackProps {
  detailedScores: Record<string, unknown>
}

// labelKey tương đối trong namespace `v2.student.examResult.examFeedback`.
// `max` chỉ dùng cho lượt thi CŨ (trước 15/09/2026) chưa có mảng `criteria`; lượt mới lấy thang
// từ chính dữ liệu, nên thêm một bảng tiêu chí mới không phải sửa lại các con số ở đây.
const RUBRIC_LABELS: Record<string, { labelKey: string; max: number }> = {
  aufgabenerfuellung: { labelKey: 'rubric.aufgabenerfuellung', max: 5 },
  kohaerenz: { labelKey: 'rubric.kohaerenz', max: 4 },
  wortschatz: { labelKey: 'rubric.wortschatz', max: 3 },
  strukturen: { labelKey: 'rubric.strukturen', max: 3 },
  // Bảng telc — Schriftlicher Ausdruck, 3 Kriterien × 15.
  leitpunkte: { labelKey: 'rubric.leitpunkte', max: 15 },
  kommunikative_gestaltung: { labelKey: 'rubric.kommunikativeGestaltung', max: 15 },
  formale_richtigkeit: { labelKey: 'rubric.formaleRichtigkeit', max: 15 },
}

function RubricBar({ label, score, max, band }: { label: string; score: number; max: number; band?: string }) {
  const t = useTranslations('v2.student.examResult.examFeedback')
  const pct = max > 0 ? Math.round((score / max) * 100) : 0
  const color = pct >= 60 ? '#10B981' : pct >= 40 ? '#F59E0B' : '#EF4444'
  return (
    <div>
      <div className="flex justify-between gap-2 text-xs mb-1">
        <span className="min-w-0 break-words text-[#64748B]">{label}</span>
        <span className="flex shrink-0 items-center gap-1.5 font-bold text-[#0F172A]">
          {/* Bậc telc in đúng chữ trên Bewertungsbogen — học viên đối chiếu được với phiếu thật. */}
          {band && (
            <span className="rounded-full border border-[#E2E8F0] bg-[#F8FAFC] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-[#475569]">
              {t('band', { band })}
            </span>
          )}
          {score}/{max}
        </span>
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
          {/* Có bậc ⇒ chấm theo Bewertungsbogen telc; nhãn Goethe ở đó là nói sai kỳ thi. */}
          {evalData.bands
            ? evalData.level
              ? t('officialRubricTelcLevel', { level: evalData.level })
              : t('officialRubricTelc')
            : evalData.level
              ? t('officialRubricLevel', { level: evalData.level })
              : t('officialRubric')}
        </span>
      </div>

      {/* Rubric breakdown */}
      <div className="bg-white rounded-2xl border border-[#E2E8F0] p-4 space-y-3">
        <p className="text-xs font-bold text-[#64748B] uppercase tracking-wide mb-3">{t('detailCap')}</p>
        {evalData.criteria && evalData.criteria.length > 0
          ? // Lượt thi mới: vẽ đúng bảng tiêu chí mà backend đã chấm, thang lấy từ dữ liệu.
            // Tiêu chí lạ vẫn được vẽ với nhãn chung — bỏ im lặng thì học viên mất điểm trên
            // màn hình mà không ai biết, còn in khoá máy ra thì lộ tên kỹ thuật.
            evalData.criteria.map((c) => (
              <RubricBar
                key={c.key}
                label={RUBRIC_LABELS[c.key] ? t(RUBRIC_LABELS[c.key].labelKey) : t('rubric.other')}
                score={c.score}
                max={c.max}
                band={c.band}
              />
            ))
          : Object.entries(RUBRIC_LABELS).map(([key, meta]) => {
              const score = evalData[key as keyof AiEmailEvaluation]
              // Tiêu chí AI không chấm thì KHÔNG vẽ: thanh 0/3 đọc thành "bị điểm liệt" trong khi
              // thực ra chưa ai chấm nó (ca strukturen 0/3 quan sát trên prod 07/09/2026).
              if (typeof score !== 'number') return null
              return <RubricBar key={key} label={t(meta.labelKey)} score={score} max={meta.max} />
            })}
        <div className="pt-2 border-t border-[#F1F5F9] flex justify-between items-center gap-2">
          <span className="min-w-0 text-sm font-bold text-[#0F172A]">{t('emailTotal')}</span>
          <span className="shrink-0 text-lg font-black text-[#6366F1]">
            {evalData.total ?? 0}<span className="text-sm font-semibold text-[#94A3B8]">/{evalData.max ?? 15}</span>
          </span>
        </div>
      </div>

      {evalData.missing_criteria && evalData.missing_criteria.length > 0 && (
        <p className="text-xs text-[#94A3B8]">{t('missingCriteria', { count: evalData.missing_criteria.length })}</p>
      )}

      {/* Kết luận telc: lạc đề / sai người nhận, ý nào thiếu, vì sao Kriterium II mất A. */}
      {(evalData.thema_verfehlt || evalData.situierung_verfehlt) && (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-3 text-xs text-red-700">
          {evalData.thema_verfehlt ? t('themaVerfehlt') : t('situierungVerfehlt')}
        </div>
      )}
      {evalData.leitpunkte_fehlt && evalData.leitpunkte_fehlt.length > 0 && (
        <p className="text-xs text-[#334155]">
          {t('missingPoints', { list: evalData.leitpunkte_fehlt.join(', ') })}
        </p>
      )}
      {evalData.kein_a_weil && evalData.kein_a_weil.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-bold text-[#64748B]">{t('noATitle')}</p>
          <ul className="list-disc space-y-0.5 pl-5 text-xs text-[#334155]">
            {evalData.kein_a_weil.map((reason) => (
              <li key={reason}>{NO_A_REASON_KEYS[reason] ? t(NO_A_REASON_KEYS[reason]) : t('noAReason.other')}</li>
            ))}
          </ul>
        </div>
      )}

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
