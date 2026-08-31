'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Pencil } from 'lucide-react'
import { apiMessage } from '@/lib/api'
import {
  getMyTimesheet,
  recordTeaching,
  updateRecord,
  deleteRecord,
  openPeriod,
  myPeriods,
  submitPeriod,
  formatMinutes,
  type SessionRecord,
  type TimesheetSummary,
  type TimesheetPeriod,
  type TimesheetSuggestion,
} from '@/lib/timesheetApi'
import {
  GaPageHdr, GaBtn, GaCap, TkBadge, TkModal, ConfirmDialog, LoadingState, ErrorBanner,
} from '@/components/ui-v2'
import {
  monthRange, periodOptions, rangeKey, hasPreviousMonthPeriod, submitAllowedFrom,
  type PeriodRange,
} from './periods'

/**
 * Bảng công của chính giáo viên: xác nhận buổi đã dạy, xem tổng công, nộp kỳ cho quản lý duyệt.
 *
 * Buổi dạy KHÔNG tự động thành công. Lịch chỉ nói "lớp có buổi lúc đó", không nói ai đứng lớp —
 * lớp có thể có người dạy thay. Màn hình liệt kê buổi đã qua chưa ghi công để giáo viên xác nhận,
 * kèm vai trò + thời lượng THỰC dạy (A4/F03: xác nhận một chạm từng gửi mỗi sessionId).
 *
 * Kỳ công chọn được (A4/F03): mặc định tháng này, nhưng ngày 01/09 vẫn mở/sửa/nộp được kỳ 08 còn
 * OPEN/REJECTED — trước đây UI khóa cứng currentMonth nên đường đó không tồn tại dù backend cho phép.
 */

function fmtWhen(iso: string): string {
  const d = new Date(iso)
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/** Vai trò chọn được khi ghi công. ASSISTANT vắng mặt có chủ đích: trợ giảng không tính công (PR B). */
const RECORDABLE_ROLES = ['PRIMARY', 'SUBSTITUTE'] as const

type RecordDialogState =
  | { mode: 'confirm'; suggestion: TimesheetSuggestion }
  | { mode: 'edit'; record: SessionRecord }
  | null

export default function TeacherTimesheetPage() {
  const t = useTranslations('v2.teacher.timesheet')
  const tc = useTranslations('v2.common')

  const [range, setRange] = useState<PeriodRange>(() => monthRange(0))
  const [periods, setPeriods] = useState<TimesheetPeriod[]>([])
  const [sheet, setSheet] = useState<TimesheetSummary | null>(null)
  const [period, setPeriod] = useState<TimesheetPeriod | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<number | null>(null)

  // Dialog ghi/sửa công — vai trò + thời lượng thực dạy + ghi chú.
  const [recordDialog, setRecordDialog] = useState<RecordDialogState>(null)
  const [formRole, setFormRole] = useState<string>('PRIMARY')
  const [formDuration, setFormDuration] = useState<number | ''>('')
  const [formNote, setFormNote] = useState('')
  const [savingRecord, setSavingRecord] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<SessionRecord | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [submitOpen, setSubmitOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const loadSeq = useRef(0)

  const refreshPeriods = useCallback(async () => {
    try {
      setPeriods(await myPeriods())
    } catch {
      // Danh sách kỳ chỉ phục vụ bộ chọn — lỗi không được chặn bảng công của kỳ đang xem.
    }
  }, [])

  /** Tải kỳ + bảng công cho một range. `existing` = kỳ đã có trong danh sách (không mở kỳ mới). */
  const load = useCallback(async (r: PeriodRange, existing: TimesheetPeriod | null) => {
    const seq = ++loadSeq.current
    setLoading(true)
    setError('')
    try {
      // Kỳ trước (trạng thái quyết định có cho sửa), rồi bảng công theo range của kỳ.
      const p = existing ?? (await openPeriod(r.fromDate, r.toDate))
      const s = await getMyTimesheet(`${r.fromDate}T00:00:00`, `${r.toDate}T23:59:59`)
      if (seq !== loadSeq.current) return
      setPeriod(p)
      setSheet(s)
    } catch (e) {
      if (seq !== loadSeq.current) return
      setError(apiMessage(e))
    } finally {
      if (seq === loadSeq.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshPeriods()
    void load(monthRange(0), null)
  }, [load, refreshPeriods])

  const options = periodOptions(periods)
  const currentKey = rangeKey(range)

  const selectPeriod = (key: string): void => {
    const opt = options.find((o) => o.key === key)
    if (!opt || key === currentKey) return
    setRange(opt.range)
    void load(opt.range, opt.period)
  }

  const openPrevMonth = async (): Promise<void> => {
    const r = monthRange(-1)
    setRange(r)
    await load(r, null) // openPeriod tạo kỳ OPEN nếu chưa có (idempotent phía backend)
    await refreshPeriods()
  }

  const editable = period?.editable ?? true
  const canSubmit = period != null && submitAllowedFrom(period.periodEnd)

  // ── dialog ghi/sửa công ────────────────────────────────────────────────────

  const openConfirmDialog = (s: TimesheetSuggestion): void => {
    setFormRole('PRIMARY')
    setFormDuration(s.plannedDurationMinutes)
    setFormNote('')
    setRecordDialog({ mode: 'confirm', suggestion: s })
  }

  const openEditDialog = (r: SessionRecord): void => {
    setFormRole(RECORDABLE_ROLES.includes(r.teacherRole as (typeof RECORDABLE_ROLES)[number]) ? r.teacherRole : 'PRIMARY')
    setFormDuration(r.durationMinutes)
    setFormNote(r.note ?? '')
    setRecordDialog({ mode: 'edit', record: r })
  }

  const saveRecordDialog = async (): Promise<void> => {
    if (!recordDialog || formDuration === '' || formDuration <= 0) return
    setSavingRecord(true)
    try {
      if (recordDialog.mode === 'confirm') {
        await recordTeaching({
          sessionId: recordDialog.suggestion.sessionId,
          durationMinutes: formDuration,
          teacherRole: formRole,
          note: formNote.trim() === '' ? null : formNote.trim(),
        })
        toast.success(t('recordSuccess'))
      } else {
        await updateRecord(recordDialog.record.id, {
          durationMinutes: formDuration,
          teacherRole: formRole,
          note: formNote.trim() === '' ? null : formNote.trim(),
        })
        toast.success(t('updateSuccess'))
      }
      setRecordDialog(null)
      await load(range, period)
    } catch (e) {
      toast.error(apiMessage(e))
    } finally {
      setSavingRecord(false)
    }
  }

  const confirmDelete = async (): Promise<void> => {
    if (!deleteTarget) return
    setDeleting(true)
    setBusyId(deleteTarget.id)
    try {
      await deleteRecord(deleteTarget.id)
      toast.success(t('deleteSuccess'))
      setDeleteTarget(null)
      await load(range, period)
    } catch (e) {
      toast.error(apiMessage(e))
    } finally {
      setDeleting(false)
      setBusyId(null)
    }
  }

  const confirmSubmit = async (): Promise<void> => {
    if (!period) return
    setSubmitting(true)
    try {
      const updated = await submitPeriod(period.id)
      setPeriod(updated)
      toast.success(t('submitSuccess'))
      setSubmitOpen(false)
      await refreshPeriods()
    } catch (e) {
      toast.error(apiMessage(e))
    } finally {
      setSubmitting(false)
    }
  }

  const inputCls =
    'ga-ui block w-full border border-ga-line bg-ga-bg px-3 py-2 text-[14px] text-ga-ink outline-none focus:border-ga-accent'

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr
        accent
        title={t('title')}
        subtitle={t('subtitle')}
        right={
          <div className="flex flex-wrap items-center gap-2 lg:flex-nowrap">
            <label className="ga-ui text-[12.5px] font-semibold text-ga-muted" htmlFor="tk-period">
              {t('periodLabel')}
            </label>
            <select
              id="tk-period"
              value={currentKey}
              onChange={(e) => selectPeriod(e.target.value)}
              disabled={loading}
              className="ga-ui border border-ga-line bg-ga-card px-2.5 py-2 text-[13px] text-ga-ink outline-none focus:border-ga-accent"
            >
              {options.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.key === rangeKey(monthRange(0))
                    ? t('periodCurrent')
                    : `${o.range.fromDate} – ${o.range.toDate}${o.period ? ` · ${t(`status${o.period.status}`)}` : ''}`}
                </option>
              ))}
            </select>
            {!hasPreviousMonthPeriod(periods) && (
              <GaBtn variant="ghost" size="sm" disabled={loading} onClick={() => void openPrevMonth()}>
                {t('openPrevMonth')}
              </GaBtn>
            )}
          </div>
        }
      />

      <div className="flex-1 overflow-auto px-4 py-6 sm:px-6 lg:px-10">
        {loading && <LoadingState variant="skeleton" rows={4} />}
        {!loading && error && <ErrorBanner message={error} onRetry={() => void load(range, period)} />}

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
                          disabled={busyId !== null || savingRecord}
                          onClick={() => openConfirmDialog(s)}
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
                              <span className="inline-flex gap-1">
                                <GaBtn
                                  size="sm"
                                  variant="ghost"
                                  disabled={busyId !== null || savingRecord}
                                  onClick={() => openEditDialog(r)}
                                >
                                  <Pencil size={13} aria-hidden /> {t('edit')}
                                </GaBtn>
                                <GaBtn
                                  size="sm"
                                  variant="ghost"
                                  loading={busyId === r.id && deleting}
                                  disabled={busyId !== null || savingRecord}
                                  onClick={() => setDeleteTarget(r)}
                                >
                                  {t('delete')}
                                </GaBtn>
                              </span>
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
              <div className="mt-5 flex flex-col items-end gap-1.5">
                <GaBtn disabled={!canSubmit || submitting} onClick={() => setSubmitOpen(true)}>
                  {t('submit')}
                </GaBtn>
                {!canSubmit && (
                  <p className="ga-ui text-[12px] text-ga-muted">
                    {t('submitEarlyHint', { date: period.periodEnd })}
                  </p>
                )}
              </div>
            )}

            <p className="mt-4 text-[12px] leading-relaxed text-ga-muted">{t('noMoneyNote')}</p>
          </>
        )}
      </div>

      {/* Dialog xác nhận buổi / sửa dòng công — vai trò + thời lượng THỰC dạy quyết định số công. */}
      <TkModal
        open={recordDialog != null}
        onOpenChange={(o) => { if (!o && !savingRecord) setRecordDialog(null) }}
        title={recordDialog?.mode === 'edit' ? t('editTitle') : t('confirmTitle')}
        description={
          recordDialog?.mode === 'confirm'
            ? `${fmtWhen(recordDialog.suggestion.startedAt)} · ${recordDialog.suggestion.className ?? `#${recordDialog.suggestion.classId}`}`
            : recordDialog?.mode === 'edit'
              ? `${fmtWhen(recordDialog.record.startedAt)} · ${recordDialog.record.className ?? '—'}`
              : undefined
        }
        size="sm"
        footer={
          <>
            <GaBtn variant="ghost" disabled={savingRecord} onClick={() => setRecordDialog(null)}>
              {tc('cancel')}
            </GaBtn>
            <GaBtn
              loading={savingRecord}
              disabled={formDuration === '' || formDuration <= 0}
              onClick={() => void saveRecordDialog()}
            >
              {tc('save')}
            </GaBtn>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <label className="ga-ui block text-[12.5px] font-semibold text-ga-muted">
            {t('roleLabel')}
            <select
              value={formRole}
              onChange={(e) => setFormRole(e.target.value)}
              className={`mt-1 ${inputCls}`}
            >
              {RECORDABLE_ROLES.map((role) => (
                <option key={role} value={role}>{t(`role${role}`)}</option>
              ))}
            </select>
          </label>
          <label className="ga-ui block text-[12.5px] font-semibold text-ga-muted">
            {t('durationLabel')}
            <input
              type="number"
              min={1}
              value={formDuration}
              onChange={(e) => setFormDuration(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
              className={`mt-1 ${inputCls}`}
            />
          </label>
          <label className="ga-ui block text-[12.5px] font-semibold text-ga-muted">
            {t('noteLabel')}
            <input value={formNote} onChange={(e) => setFormNote(e.target.value)} className={`mt-1 ${inputCls}`} />
          </label>
        </div>
      </TkModal>

      {/* Xóa dòng công — chuẩn §2.11: ConfirmDialog nêu đối tượng + hệ quả, không window.confirm. */}
      <ConfirmDialog
        open={deleteTarget != null}
        onOpenChange={(o) => { if (!o && !deleting) setDeleteTarget(null) }}
        title={t('deleteTitle')}
        description={deleteTarget
          ? `${fmtWhen(deleteTarget.startedAt)} · ${deleteTarget.className ?? '—'} · ${formatMinutes(deleteTarget.durationMinutes)}`
          : undefined}
        details={[t('deleteDetail')]}
        confirmLabel={t('delete')}
        cancelLabel={tc('cancel')}
        loading={deleting}
        onConfirm={() => void confirmDelete()}
      />

      {/* Nộp kỳ — không phá hoại nhưng ĐÓNG BĂNG mọi dòng công trong kỳ nên vẫn phải xác nhận rõ. */}
      <ConfirmDialog
        open={submitOpen}
        onOpenChange={(o) => { if (!o && !submitting) setSubmitOpen(o) }}
        title={t('submitTitle')}
        description={period ? `${period.periodStart} – ${period.periodEnd}` : undefined}
        details={[
          t('submitDetail', {
            sessions: sheet?.totalSessions ?? 0,
            minutes: formatMinutes(sheet?.totalMinutes ?? 0),
          }),
          t('submitFreezeNote'),
        ]}
        confirmLabel={t('submit')}
        cancelLabel={tc('cancel')}
        destructive={false}
        loading={submitting}
        onConfirm={() => void confirmSubmit()}
      />
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
