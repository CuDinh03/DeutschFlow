'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { apiMessage } from '@/lib/api'
import {
  getOrgTimesheet,
  approvePeriod,
  rejectPeriod,
  lockPeriod,
  downloadOrgTimesheetCsv,
  formatMinutes,
  type OrgTimesheet,
  type TimesheetPeriod,
  type PeriodStatus,
} from '@/lib/timesheetApi'
import { GaPageHdr, GaBtn, GaCap, TkBadge, TkModal, LoadingState, ErrorBanner } from '@/components/ui-v2'

/**
 * Tổng hợp chấm công toàn trung tâm — OWNER và MANAGER.
 *
 * Chỉ hiển thị SỐ CÔNG (số buổi, số giờ). Đơn giá và thành tiền cố ý không có trong hệ thống, nên
 * màn hình này không cần quyền tài chính (`assertOrgFinance`, OWNER-only) — backend gác bằng
 * `assertOrgAdmin` (OWNER|MANAGER).
 */

const STATUS_TONE: Record<PeriodStatus, 'neutral' | 'yellow' | 'green' | 'red' | 'navy'> = {
  OPEN: 'neutral',
  SUBMITTED: 'yellow',
  APPROVED: 'green',
  REJECTED: 'red',
  LOCKED: 'navy',
}

/** Mặc định: tháng hiện tại. */
function defaultRange(): { from: string; to: string } {
  const now = new Date()
  const first = new Date(now.getFullYear(), now.getMonth(), 1)
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const iso = (d: Date): string =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return { from: iso(first), to: iso(last) }
}

export default function OrgTimesheetsPage() {
  const t = useTranslations('v2.org.timesheets')
  const initial = useMemo(defaultRange, [])

  const [from, setFrom] = useState(initial.from)
  const [to, setTo] = useState(initial.to)
  const [data, setData] = useState<OrgTimesheet | null>(null)
  // Khoảng ngày mà `data` đang thể hiện. Export phải bám theo cái này, không theo ô nhập hiện tại —
  // nếu không, đổi from/to mà chưa Tải lại sẽ xuất CSV khác với bảng đang hiển thị.
  const [loadedRange, setLoadedRange] = useState<{ from: string; to: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actingId, setActingId] = useState<number | null>(null)
  const [rejecting, setRejecting] = useState<TimesheetPeriod | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [exporting, setExporting] = useState(false)

  // Chốt chống response cũ: đổi khoảng ngày nhanh không được để bản tải trước ghi đè bản mới.
  const loadSeq = useRef(0)

  const load = useCallback(async (f: string, tt: string) => {
    const seq = ++loadSeq.current
    setLoading(true)
    setError('')
    try {
      const res = await getOrgTimesheet(f, tt)
      if (seq !== loadSeq.current) return
      setData(res)
      setLoadedRange({ from: f, to: tt })
    } catch (e) {
      if (seq !== loadSeq.current) return
      setError(apiMessage(e))
    } finally {
      if (seq === loadSeq.current) setLoading(false)
    }
  }, [])

  useEffect(() => { void load(initial.from, initial.to) }, [load, initial])

  const runAction = async (
    period: TimesheetPeriod,
    action: () => Promise<TimesheetPeriod>,
    successKey: 'approveSuccess' | 'rejectSuccess' | 'lockSuccess',
  ): Promise<boolean> => {
    setActingId(period.id)
    try {
      const updated = await action()
      setData((prev) => prev && {
        ...prev,
        periods: prev.periods.map((p) => (p.id === updated.id ? { ...updated, teacherName: p.teacherName } : p)),
      })
      toast.success(t(successKey))
      return true
    } catch (e) {
      toast.error(apiMessage(e) || t('reasonRequired'))
      return false
    } finally {
      setActingId(null)
    }
  }

  const exportCsv = async (): Promise<void> => {
    if (!loadedRange) return
    setExporting(true)
    try {
      // Xuất đúng khoảng của bảng đang hiển thị, không phải ô nhập (có thể đã đổi mà chưa Tải lại).
      await downloadOrgTimesheetCsv(loadedRange.from, loadedRange.to)
    } catch (e) {
      toast.error(apiMessage(e))
    } finally {
      setExporting(false)
    }
  }

  // Ô nhập đã đổi so với dữ liệu đang hiển thị → phải Tải lại trước khi xuất.
  const rangeStale = !loadedRange || from !== loadedRange.from || to !== loadedRange.to

  const confirmReject = async (): Promise<void> => {
    if (!rejecting) return
    if (!rejectReason.trim()) {
      toast.error(t('reasonRequired'))
      return
    }
    const target = rejecting
    const reason = rejectReason.trim()
    // Chỉ đóng modal + xoá lý do KHI trả kỳ thành công. Nếu thất bại (mạng timeout, hoặc 409 do
    // manager khác vừa đổi trạng thái kỳ), giữ nguyên modal + nội dung để manager thử lại, không bắt gõ lại.
    const ok = await runAction(target, () => rejectPeriod(target.id, reason), 'rejectSuccess')
    if (ok) {
      setRejecting(null)
      setRejectReason('')
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr accent title={t('title')} subtitle={t('subtitle')} />

      <div className="flex-1 overflow-auto px-10 py-6">
        <div className="mb-5 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="ga-ui text-[11.5px] font-semibold uppercase tracking-wide text-ga-muted">{t('from')}</span>
            <input
              type="date" value={from} onChange={(e) => setFrom(e.target.value)}
              className="border border-ga-line bg-ga-card px-2.5 py-1.5 text-[13px] text-ga-ink"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="ga-ui text-[11.5px] font-semibold uppercase tracking-wide text-ga-muted">{t('to')}</span>
            <input
              type="date" value={to} onChange={(e) => setTo(e.target.value)}
              className="border border-ga-line bg-ga-card px-2.5 py-1.5 text-[13px] text-ga-ink"
            />
          </label>
          <GaBtn onClick={() => void load(from, to)} disabled={loading}>{t('reload')}</GaBtn>
          <GaBtn
            variant="ghost"
            loading={exporting}
            disabled={loading || !data || data.periods.length === 0 || rangeStale}
            onClick={() => void exportCsv()}
          >
            {t('export')}
          </GaBtn>
        </div>

        {loading && <LoadingState variant="skeleton" rows={4} />}
        {!loading && error && <ErrorBanner message={error} onRetry={() => void load(from, to)} />}

        {!loading && !error && data && (
          <>
            <div className="mb-5 grid grid-cols-3 gap-3">
              <Stat label={t('statTeachers')} value={String(data.teacherCount)} />
              <Stat label={t('statSessions')} value={String(data.totalSessions)} />
              <Stat label={t('statMinutes')} value={formatMinutes(data.totalMinutes)} />
            </div>

            {data.periods.length === 0 ? (
              <p className="border border-dashed border-ga-line px-8 py-10 text-center text-[14px] text-ga-muted">
                {t('empty')}
              </p>
            ) : (
              <div className="overflow-x-auto border border-ga-line">
                <table className="w-full border-collapse text-[13px]">
                  <thead>
                    <tr className="bg-ga-side-active">
                      <Th>{t('colTeacher')}</Th>
                      <Th>{t('colPeriod')}</Th>
                      <Th>{t('colStatus')}</Th>
                      <Th align="right">{t('colSessions')}</Th>
                      <Th align="right">{t('colMinutes')}</Th>
                      <Th align="right">{t('colActions')}</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.periods.map((p) => (
                      <tr key={p.id} className="bg-ga-card">
                        <Td>{p.teacherName ?? `#${p.teacherId}`}</Td>
                        <Td>{p.periodStart} → {p.periodEnd}</Td>
                        <Td>
                          <TkBadge tone={STATUS_TONE[p.status]}>{t(`status${p.status}`)}</TkBadge>
                          {p.status === 'REJECTED' && p.rejectReason && (
                            <div className="mt-1 text-[11.5px] text-ga-muted">{p.rejectReason}</div>
                          )}
                        </Td>
                        <Td align="right">{p.totalSessions}</Td>
                        <Td align="right">{formatMinutes(p.totalMinutes)}</Td>
                        <Td align="right">
                          <div className="flex justify-end gap-1.5">
                            {p.status === 'SUBMITTED' && (
                              <>
                                <GaBtn
                                  size="sm"
                                  disabled={actingId === p.id}
                                  onClick={() => void runAction(p, () => approvePeriod(p.id), 'approveSuccess')}
                                >
                                  {t('approve')}
                                </GaBtn>
                                <GaBtn size="sm" variant="ghost" disabled={actingId === p.id}
                                  onClick={() => { setRejecting(p); setRejectReason('') }}>
                                  {t('reject')}
                                </GaBtn>
                              </>
                            )}
                            {p.status === 'APPROVED' && (
                              <GaBtn size="sm" disabled={actingId === p.id} title={t('lockHint')}
                                onClick={() => void runAction(p, () => lockPeriod(p.id), 'lockSuccess')}>
                                {t('lock')}
                              </GaBtn>
                            )}
                          </div>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <p className="mt-4 text-[12px] leading-relaxed text-ga-muted">{t('noMoneyNote')}</p>
          </>
        )}
      </div>

      {rejecting && (
        <TkModal open onOpenChange={(o) => { if (!o) setRejecting(null) }} title={t('rejectTitle')}>
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1">
              <span className="ga-ui text-[11.5px] font-semibold uppercase tracking-wide text-ga-muted">
                {t('rejectReasonLabel')}
              </span>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder={t('rejectReasonPlaceholder')}
                rows={3}
                className="border border-ga-line bg-ga-bg px-2.5 py-2 text-[13px] text-ga-ink"
              />
            </label>
            <div className="flex justify-end gap-2">
              <GaBtn variant="ghost" onClick={() => setRejecting(null)}>{t('cancel')}</GaBtn>
              <GaBtn onClick={() => void confirmReject()}>{t('rejectConfirm')}</GaBtn>
            </div>
          </div>
        </TkModal>
      )}
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

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th
      scope="col"
      className={`border border-ga-line px-3 py-2 font-bold text-ga-ink ${align === 'right' ? 'text-right' : 'text-left'}`}
    >
      {children}
    </th>
  )
}

function Td({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <td className={`border border-ga-line px-3 py-2 text-ga-ink ${align === 'right' ? 'text-right' : 'text-left'}`}>
      {children}
    </td>
  )
}
