'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { apiMessage } from '@/lib/api'
import {
  getMyTimesheet,
  recordTeaching,
  deleteRecord,
  openPeriod,
  submitPeriod,
  formatMinutes,
  type TimesheetSummary,
  type TimesheetPeriod,
  type TimesheetSuggestion,
} from '@/lib/timesheetApi'
import { GaPageHdr, GaBtn, GaCap, TkBadge, LoadingState, ErrorBanner } from '@/components/ui-v2'

/**
 * Bảng công của chính giáo viên: xác nhận buổi đã dạy, xem tổng công, nộp kỳ cho quản lý duyệt.
 *
 * Buổi dạy KHÔNG tự động thành công. Lịch chỉ nói "lớp có buổi lúc đó", không nói ai đứng lớp — một
 * lớp có thể có trợ giảng hoặc người dạy thay. Vì vậy màn hình này liệt kê buổi đã qua chưa ghi công
 * để giáo viên xác nhận một chạm.
 */

/** Kỳ mặc định: tháng hiện tại (ranh giới theo lịch địa phương của người dùng). */
function currentMonth(): { fromDate: string; toDate: string } {
  const now = new Date()
  const iso = (d: Date): string =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return {
    fromDate: iso(new Date(now.getFullYear(), now.getMonth(), 1)),
    toDate: iso(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  }
}

function fmtWhen(iso: string): string {
  const d = new Date(iso)
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`
}

export default function TeacherTimesheetPage() {
  const t = useTranslations('v2.teacher.timesheet')
  const range = useMemo(currentMonth, [])

  const [sheet, setSheet] = useState<TimesheetSummary | null>(null)
  const [period, setPeriod] = useState<TimesheetPeriod | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const loadSeq = useRef(0)

  const load = useCallback(async () => {
    const seq = ++loadSeq.current
    setLoading(true)
    setError('')
    try {
      // Kỳ được mở (hoặc lấy lại) trước, vì trạng thái của nó quyết định có cho sửa hay không.
      const [p, s] = await Promise.all([
        openPeriod(range.fromDate, range.toDate),
        getMyTimesheet(`${range.fromDate}T00:00:00`, `${range.toDate}T23:59:59`),
      ])
      if (seq !== loadSeq.current) return
      setPeriod(p)
      setSheet(s)
    } catch (e) {
      if (seq !== loadSeq.current) return
      setError(apiMessage(e))
    } finally {
      if (seq === loadSeq.current) setLoading(false)
    }
  }, [range])

  useEffect(() => { void load() }, [load])

  const editable = period?.editable ?? true

  const confirmSuggestion = async (s: TimesheetSuggestion): Promise<void> => {
    setBusyId(s.sessionId)
    try {
      await recordTeaching({ sessionId: s.sessionId })
      toast.success(t('recordSuccess'))
      await load()
    } catch (e) {
      toast.error(apiMessage(e))
    } finally {
      setBusyId(null)
    }
  }

  const removeRecord = async (id: number): Promise<void> => {
    if (typeof window !== 'undefined' && !window.confirm(t('deleteConfirm'))) return
    setBusyId(id)
    try {
      await deleteRecord(id)
      toast.success(t('deleteSuccess'))
      await load()
    } catch (e) {
      toast.error(apiMessage(e))
    } finally {
      setBusyId(null)
    }
  }

  const submit = async (): Promise<void> => {
    if (!period) return
    if (typeof window !== 'undefined' && !window.confirm(t('submitConfirm'))) return
    setSubmitting(true)
    try {
      setPeriod(await submitPeriod(period.id))
      toast.success(t('submitSuccess'))
    } catch (e) {
      toast.error(apiMessage(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr accent title={t('title')} subtitle={t('subtitle')} />

      <div className="flex-1 overflow-auto px-10 py-6">
        {loading && <LoadingState variant="skeleton" rows={4} />}
        {!loading && error && <ErrorBanner message={error} onRetry={() => void load()} />}

        {!loading && !error && sheet && (
          <>
            <div className="mb-5 grid grid-cols-3 gap-3">
              <Stat label={t('statSessions')} value={String(sheet.totalSessions)} />
              <Stat label={t('statMinutes')} value={formatMinutes(sheet.totalMinutes)} />
              <div className="border border-ga-line bg-ga-card px-4 py-3">
                <GaCap>{t('statStatus')}</GaCap>
                <div className="mt-2">
                  {period && <TkBadge tone={period.editable ? 'neutral' : 'green'}>{t(`status${period.status}`)}</TkBadge>}
                </div>
              </div>
            </div>

            {period?.status === 'REJECTED' && period.rejectReason && (
              <div className="mb-4 border border-ga-red/40 bg-ga-red-soft px-3 py-2.5">
                <p className="text-[12.5px] text-ga-ink">
                  {t('rejectedNotice', { reason: period.rejectReason })}
                </p>
              </div>
            )}

            {!editable && period && (
              <div className="mb-4 border border-ga-line bg-ga-side-active px-3 py-2.5">
                <p className="text-[12.5px] text-ga-muted">
                  {t('lockedNotice', { status: t(`status${period.status}`) })}
                </p>
              </div>
            )}

            {editable && (
              <section className="mb-6">
                <GaCap className="mb-2">{t('suggestionsHeading')}</GaCap>
                {sheet.suggestions.length === 0 ? (
                  <p className="border border-dashed border-ga-line px-6 py-6 text-center text-[13px] text-ga-muted">
                    {t('suggestionsEmpty')}
                  </p>
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {sheet.suggestions.map((s) => (
                      <li
                        key={s.sessionId}
                        className="flex items-center gap-3 border border-ga-line bg-ga-card px-3 py-2"
                      >
                        <span className="min-w-0 flex-1 truncate text-[13px] text-ga-ink">
                          <strong>{fmtWhen(s.startedAt)}</strong> · {s.className ?? `#${s.classId}`} ·{' '}
                          {formatMinutes(s.plannedDurationMinutes)}
                        </span>
                        <GaBtn
                          size="sm"
                          loading={busyId === s.sessionId}
                          disabled={busyId !== null}
                          onClick={() => void confirmSuggestion(s)}
                        >
                          {t('confirmSession')}
                        </GaBtn>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            <section>
              <GaCap className="mb-2">{t('recordsHeading')}</GaCap>
              {sheet.records.length === 0 ? (
                <p className="border border-dashed border-ga-line px-6 py-6 text-center text-[13px] text-ga-muted">
                  {t('recordsEmpty')}
                </p>
              ) : (
                <div className="overflow-x-auto border border-ga-line">
                  <table className="w-full border-collapse text-[13px]">
                    <thead>
                      <tr className="bg-ga-side-active">
                        <th scope="col" className="border border-ga-line px-3 py-2 text-left font-bold text-ga-ink">{t('colWhen')}</th>
                        <th scope="col" className="border border-ga-line px-3 py-2 text-left font-bold text-ga-ink">{t('colClass')}</th>
                        <th scope="col" className="border border-ga-line px-3 py-2 text-right font-bold text-ga-ink">{t('colDuration')}</th>
                        <th scope="col" className="border border-ga-line px-3 py-2 text-left font-bold text-ga-ink">{t('colRole')}</th>
                        <th scope="col" className="border border-ga-line px-3 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {sheet.records.map((r) => (
                        <tr key={r.id} className="bg-ga-card">
                          <td className="border border-ga-line px-3 py-2 text-ga-ink">{fmtWhen(r.startedAt)}</td>
                          <td className="border border-ga-line px-3 py-2 text-ga-ink">
                            {r.className ?? (r.classId ? `#${r.classId}` : '—')}
                          </td>
                          <td className="border border-ga-line px-3 py-2 text-right text-ga-ink">
                            {formatMinutes(r.durationMinutes)}
                          </td>
                          <td className="border border-ga-line px-3 py-2 text-ga-ink">
                            {t(`role${r.teacherRole}` as 'rolePRIMARY')}
                          </td>
                          <td className="border border-ga-line px-3 py-2 text-right">
                            {editable && (
                              <GaBtn
                                size="sm"
                                variant="ghost"
                                loading={busyId === r.id}
                                disabled={busyId !== null}
                                onClick={() => void removeRecord(r.id)}
                              >
                                {t('delete')}
                              </GaBtn>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {editable && period && sheet.records.length > 0 && (
              <div className="mt-5 flex justify-end">
                <GaBtn loading={submitting} onClick={() => void submit()}>{t('submit')}</GaBtn>
              </div>
            )}

            <p className="mt-4 text-[12px] leading-relaxed text-ga-muted">{t('noMoneyNote')}</p>
          </>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-ga-line bg-ga-card px-4 py-3">
      <GaCap>{label}</GaCap>
      <div className="mt-1 text-[22px] font-bold text-ga-ink">{value}</div>
    </div>
  )
}
