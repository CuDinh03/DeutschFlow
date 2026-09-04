'use client'

// Đánh giá của giáo viên về học viên — phía HỌC VIÊN (chỉ đọc, chỉ dữ liệu của chính mình).
//
// Ba thứ giáo viên ghi ở /v2/teacher/tc-reports mà web học viên trước đây không có đường nào xem:
//   • điểm 4 kỹ năng (thang 0–10)  • nhận xét bằng lời  • lịch sử điểm danh
// Backend đã có sẵn `my-skill-report` + `my-attendance` (mobile dùng từ P4), web thì chưa từng gọi.
// Nhận xét bằng lời mới được backend trả về (trước đó chỉ tồn tại ở DTO phía giáo viên).

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { format } from 'date-fns'
import { Loader2, MessageSquareQuote } from 'lucide-react'
import { apiMessage } from '@/lib/api'
import {
  fetchMySkillReport, fetchMyAttendance,
  type MySkillReport, type StudentAttendance,
} from '@/lib/studentClassesApi'
import { GaCap, EmptyState, ErrorBanner } from '@/components/ui-v2'

const SKILLS = ['horen', 'lesen', 'schreiben', 'sprechen'] as const
type SkillKey = (typeof SKILLS)[number]

const ATT_TONE: Record<string, string> = {
  PRESENT: 'var(--ga-green)',
  LATE: 'var(--ga-orange)',
  ABSENT: 'var(--ga-red)',
}

const fmtDate = (d: string | null | undefined) => (d ? format(new Date(d), 'dd/MM/yyyy') : '—')

/** Thang 0–10 → màu, cùng ngưỡng với bản mobile (≥8 tốt, ≥5 đạt, dưới nữa là yếu). */
function scoreColor(v: number | null): string {
  if (v == null) return 'var(--ga-subtle)'
  if (v >= 8) return 'var(--ga-green)'
  if (v >= 5) return 'var(--ga-accent)'
  return 'var(--ga-red)'
}

function hasAnySkill(r: MySkillReport | null): boolean {
  return !!r && SKILLS.some((k) => r[k] != null)
}

export function EvaluationTab({ classId }: { classId: number }) {
  const t = useTranslations('v2.student.classDetail.evaluation')
  const [report, setReport] = useState<MySkillReport | null>(null)
  const [attendance, setAttendance] = useState<StudentAttendance[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      // Hai lời gọi độc lập: một cái hỏng không được che mất cái kia (lớp có điểm danh
      // nhưng chưa chấm kỹ năng, hoặc ngược lại, là chuyện bình thường).
      const [r, a] = await Promise.allSettled([fetchMySkillReport(classId), fetchMyAttendance(classId)])
      setReport(r.status === 'fulfilled' ? r.value : null)
      setAttendance(a.status === 'fulfilled' ? a.value : [])
      setError(r.status === 'rejected' && a.status === 'rejected' ? apiMessage(r.reason) : '')
    } finally {
      setLoading(false)
    }
  }, [classId])

  useEffect(() => { void load() }, [load])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-[14px] text-ga-muted">
        <Loader2 size={15} className="animate-spin" /> {t('loading')}
      </div>
    )
  }
  if (error) return <ErrorBanner message={error} onRetry={load} />

  const marked = attendance.filter((a) => a.status != null)
  const present = marked.filter((a) => a.status === 'PRESENT').length
  const late = marked.filter((a) => a.status === 'LATE').length
  const absent = marked.filter((a) => a.status === 'ABSENT').length
  // Mẫu số là số buổi CÓ ghi nhận cho chính học viên này — giống hệt cách backend tính điều kiện
  // cấp chứng chỉ. Buổi diễn ra trước khi vào lớp, và buổi chỉ ghi chủ đề, không thuộc về họ.
  const rate = marked.length > 0 ? Math.round(((present + late) / marked.length) * 100) : null

  return (
    <div className="flex flex-col gap-7">
      {/* ── Bảng điểm 4 kỹ năng ─────────────────────────────────────────── */}
      <section>
        <GaCap className="mb-3 block">{t('skillsCap')}</GaCap>
        {!hasAnySkill(report) ? (
          <EmptyState icon="assessment" title={t('noSkillsTitle')} description={t('noSkillsBody')} />
        ) : (
          <div className="border border-ga-line bg-ga-card p-4 lg:p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <GaCap className="block">{t('totalCap')}</GaCap>
                <div className="font-ga-display text-[34px] font-medium leading-tight" style={{ color: scoreColor(report?.total ?? null) }}>
                  {report?.total != null ? report.total.toFixed(1) : '—'}
                  <span className="ga-ui ml-1 text-[15px] text-ga-muted">/10</span>
                </div>
              </div>
              <span
                className="ga-ui border px-2.5 py-1 text-[12px] font-semibold uppercase tracking-[0.06em]"
                style={{ color: scoreColor(report?.total ?? null), borderColor: scoreColor(report?.total ?? null) }}
              >
                {report?.grade ?? '—'}
              </span>
            </div>

            <div className="mt-5 flex flex-col gap-3">
              {SKILLS.map((k: SkillKey) => {
                const v = report?.[k] ?? null
                return (
                  <div key={k} className="flex flex-col gap-1.5">
                    <div className="flex items-baseline justify-between text-[13px]">
                      <span className="text-ga-muted">{t(`skill.${k}`)}</span>
                      <span className="font-semibold" style={{ color: scoreColor(v) }}>
                        {v != null ? v.toFixed(1) : t('noScore')}
                      </span>
                    </div>
                    <div className="h-[6px] bg-ga-line">
                      <div className="h-full transition-[width]" style={{ width: `${((v ?? 0) / 10) * 100}%`, background: scoreColor(v) }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </section>

      {/* ── Nhận xét của giáo viên ──────────────────────────────────────── */}
      <section>
        <GaCap className="mb-3 block">{t('commentCap')}</GaCap>
        {report?.teacherComment ? (
          <blockquote className="border border-ga-line bg-ga-card p-4 lg:p-6" style={{ borderLeft: '3px solid var(--ga-violet)' }}>
            <MessageSquareQuote size={16} className="mb-2" style={{ color: 'var(--ga-violet)' }} />
            <p className="whitespace-pre-wrap text-[14.5px] leading-[1.65] text-ga-ink">{report.teacherComment}</p>
            {report.evaluatedAt && (
              <footer className="ga-ui mt-3 text-[12px] text-ga-subtle">{t('evaluatedAt', { date: fmtDate(report.evaluatedAt) })}</footer>
            )}
          </blockquote>
        ) : (
          <EmptyState icon="forum" title={t('noCommentTitle')} description={t('noCommentBody')} />
        )}
      </section>

      {/* ── Điểm danh ───────────────────────────────────────────────────── */}
      <section>
        <GaCap className="mb-3 block">{t('attendanceCap')}</GaCap>
        {attendance.length === 0 ? (
          <EmptyState icon="schedule" title={t('noAttendanceTitle')} description={t('noAttendanceBody')} />
        ) : (
          <>
            {rate != null && (
              <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[13px]">
                <span className="font-ga-display text-[20px] font-medium text-ga-ink">{t('rate', { pct: rate })}</span>
                <span style={{ color: ATT_TONE.PRESENT }}>{t('presentCount', { count: present })}</span>
                <span style={{ color: ATT_TONE.LATE }}>{t('lateCount', { count: late })}</span>
                <span style={{ color: ATT_TONE.ABSENT }}>{t('absentCount', { count: absent })}</span>
              </div>
            )}
            <div className="border border-ga-line bg-ga-card">
              {attendance.map((a, i) => (
                <div
                  key={a.lessonLogId}
                  className="flex flex-wrap items-start gap-x-4 gap-y-1.5 px-4 py-3 lg:flex-nowrap lg:px-5"
                  style={{ borderTop: i ? '1px solid var(--ga-line)' : 'none' }}
                >
                  <span className="ga-ui w-[86px] shrink-0 text-[12.5px] text-ga-muted">{fmtDate(a.sessionDate)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] text-ga-ink">
                      {a.sessionNumber != null && <span className="text-ga-muted">{t('sessionNo', { no: a.sessionNumber })} · </span>}
                      {a.topic || t('noTopic')}
                    </div>
                    {a.note && <div className="mt-0.5 text-[12.5px] text-ga-muted">{a.note}</div>}
                  </div>
                  <span
                    className="ga-ui shrink-0 text-[12.5px] font-semibold"
                    style={{ color: a.status ? ATT_TONE[a.status] : 'var(--ga-subtle)' }}
                  >
                    {a.status ? t(`status.${a.status}`) : t('status.UNMARKED')}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  )
}
