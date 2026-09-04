'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { format } from 'date-fns'
import { CalendarX2, CheckCircle2, Eye, Loader2, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { apiMessage } from '@/lib/api'
import {
  approveChangeRequest,
  getChangeRequestPreview,
  listPendingChangeRequests,
  rejectChangeRequest,
  type ScheduleChangeRequest,
  type ScheduleForecast,
  type SchedulePreview,
} from '@/lib/scheduleChangeRequestApi'
import { GaBtn, GaCap, TkBadge, TkModal } from '@/components/ui-v2'
import { useIsOrgOwner } from '../OwnerOnly'

/**
 * Hàng chờ duyệt thay đổi lịch (PR-6, spec §4/D13). Danh sách đã được BE lọc theo quyền người
 * xem (OWNER tất; giáo viên trưởng scope CLASS lớp mình; MANAGER không mặc định → rỗng).
 * Đề xuất chạm T7/CN: nút DUYỆT chỉ hiện với OWNER (backend vẫn là thẩm quyền — AC19/AC20/AC23).
 * Xem trước 2 cột: dự báo lịch hiệu lực vs nếu-áp (AC09) — mô phỏng phía BE, không ghi DB.
 */
export function ApprovalQueue() {
  const t = useTranslations('v2.org.schedule.requests')
  const isOwner = useIsOrgOwner()
  const [items, setItems] = useState<ScheduleChangeRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actingId, setActingId] = useState<number | null>(null)
  const [rejecting, setRejecting] = useState<ScheduleChangeRequest | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [preview, setPreview] = useState<SchedulePreview | null>(null)
  const [previewLoadingId, setPreviewLoadingId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setItems(await listPendingChangeRequests())
      setError('')
    } catch (e: unknown) {
      setError(apiMessage(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const approve = async (r: ScheduleChangeRequest) => {
    setActingId(r.id)
    try {
      await approveChangeRequest(r.id)
      toast.success(t('approveSuccess'))
      await load()
    } catch (e: unknown) {
      // 409 = đề xuất đã xử lý / nền lỗi thời — reload để hàng chờ nói sự thật.
      toast.error(apiMessage(e))
      await load()
    } finally {
      setActingId(null)
    }
  }

  const confirmReject = async () => {
    if (!rejecting) return
    if (!rejectReason.trim()) {
      toast.error(t('reasonRequired'))
      return
    }
    setActingId(rejecting.id)
    try {
      await rejectChangeRequest(rejecting.id, rejectReason.trim())
      toast.success(t('rejectSuccess'))
      // Chỉ đóng modal khi thành công — thất bại giữ nguyên lý do để thử lại.
      setRejecting(null)
      setRejectReason('')
      await load()
    } catch (e: unknown) {
      toast.error(apiMessage(e))
    } finally {
      setActingId(null)
    }
  }

  const openPreview = async (r: ScheduleChangeRequest) => {
    setPreviewLoadingId(r.id)
    try {
      setPreview(await getChangeRequestPreview(r.id))
    } catch (e: unknown) {
      toast.error(apiMessage(e))
    } finally {
      setPreviewLoadingId(null)
    }
  }

  // Không có gì chờ (hoặc người xem không có quyền duyệt lớp nào) → không chiếm chỗ trên trang lịch.
  if (!loading && !error && items.length === 0) return null

  return (
    <section aria-label={t('heading')} className="mb-6">
      <div className="mb-2.5 flex items-center gap-2">
        <GaCap>{t('heading')}</GaCap>
        {!loading && <TkBadge tone="yellow">{items.length}</TkBadge>}
      </div>

      {loading ? (
        <div className="ga-shimmer h-[76px] border border-ga-line" aria-hidden />
      ) : error ? (
        <p className="m-0 border border-ga-line bg-ga-card px-4 py-3 text-[13px] text-ga-red">{error}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {items.map((r) => {
            const weekendBlocked = r.hasWeekend && isOwner !== true
            const impact = r.impactSnapshot
            return (
              <li key={r.id} className="border border-ga-line bg-ga-card px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13.5px] font-semibold text-ga-ink">{r.className}</span>
                  <TkBadge tone="navy">{t(`type.${r.requestType}`)}</TkBadge>
                  {r.hasWeekend && (
                    <TkBadge tone="red">
                      <span className="inline-flex items-center gap-1"><CalendarX2 size={11} /> {t('weekendBadge')}</span>
                    </TkBadge>
                  )}
                  <span className="ga-ui text-[12px] text-ga-subtle">
                    {t('requestedBy', { name: r.requestedByName, date: format(new Date(r.requestedAt), 'dd/MM HH:mm') })}
                  </span>
                </div>

                {(impact?.affectedSessionIds?.length || impact?.plannedContentCount || 0) > 0 && (
                  <p className="ga-ui m-0 mt-1 text-[12.5px] text-ga-muted">
                    {t('impactLine', {
                      sessions: impact?.affectedSessionIds?.length ?? 0,
                      contents: impact?.plannedContentCount ?? 0,
                    })}
                  </p>
                )}
                {(impact?.warnings ?? []).map((w, i) => (
                  <p key={i} className="m-0 mt-1 flex items-start gap-1.5 text-[12.5px] font-semibold" style={{ color: 'var(--ga-red)' }}>
                    <TriangleAlert size={13} className="mt-0.5 shrink-0" /> <span className="min-w-0">{w}</span>
                  </p>
                ))}

                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <GaBtn variant="ghost" size="sm" disabled={previewLoadingId === r.id} onClick={() => openPreview(r)}>
                    {previewLoadingId === r.id ? <Loader2 size={13} className="animate-spin" /> : <Eye size={13} />}{' '}
                    {t('preview')}
                  </GaBtn>
                  {weekendBlocked ? (
                    <span className="ga-ui text-[12px] font-semibold text-ga-muted">{t('weekendOwnerOnly')}</span>
                  ) : (
                    <GaBtn variant="primary" size="sm" disabled={actingId === r.id} onClick={() => approve(r)}>
                      {actingId === r.id ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}{' '}
                      {t('approve')}
                    </GaBtn>
                  )}
                  <GaBtn
                    variant="ghost"
                    size="sm"
                    disabled={actingId === r.id}
                    className="text-ga-red"
                    onClick={() => { setRejecting(r); setRejectReason('') }}
                  >
                    {t('reject')}
                  </GaBtn>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {/* Từ chối — lý do bắt buộc (AC22), khuôn org/timesheets */}
      <TkModal
        open={rejecting !== null}
        onOpenChange={(o) => { if (!o) setRejecting(null) }}
        title={t('rejectTitle')}
        description={rejecting ? `${rejecting.className} · ${t(`type.${rejecting.requestType}`)}` : undefined}
        size="sm"
        footer={
          <>
            <GaBtn variant="ghost" onClick={() => setRejecting(null)} disabled={actingId !== null}>
              {t('cancel')}
            </GaBtn>
            <GaBtn variant="primary" onClick={confirmReject} disabled={actingId !== null || !rejectReason.trim()}>
              {t('rejectConfirm')}
            </GaBtn>
          </>
        }
      >
        <label className="ga-ui mb-1.5 block text-[12px] font-bold uppercase tracking-[0.05em] text-ga-muted">
          {t('reasonLabel')}
        </label>
        <textarea
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          rows={3}
          placeholder={t('reasonPlaceholder')}
          className="w-full rounded-ga border border-ga-line bg-ga-bg px-3 py-2 text-[13.5px] text-ga-ink outline-none focus:border-ga-accent"
        />
      </TkModal>

      {/* Xem trước 2 cột (AC09) */}
      <TkModal
        open={preview !== null}
        onOpenChange={(o) => { if (!o) setPreview(null) }}
        title={t('previewTitle')}
        description={preview ? `${preview.request.className} · ${t(`type.${preview.request.requestType}`)}` : undefined}
        size="md"
      >
        {preview && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ForecastCard label={t('currentCol')} forecast={preview.current} />
            {preview.projected ? (
              <ForecastCard label={t('projectedCol')} forecast={preview.projected} accent />
            ) : (
              <div className="border border-dashed border-ga-line px-3 py-4 text-[12.5px] text-ga-muted">
                {t('noProjection')}
              </div>
            )}
          </div>
        )}
      </TkModal>
    </section>
  )
}

/** Một cột dự báo: khung giờ, ngày xong dự kiến / phần thiếu (AC17), mốc rủi ro. */
function ForecastCard({ label, forecast, accent }: { label: string; forecast: ScheduleForecast; accent?: boolean }) {
  const t = useTranslations('v2.org.schedule.requests')
  return (
    <div className="border px-3 py-3" style={{ borderColor: accent ? 'var(--ga-accent)' : 'var(--ga-line)', background: 'var(--ga-bg)' }}>
      <div className="ga-ui mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-ga-muted">{label}</div>
      <dl className="m-0 flex flex-col gap-1 text-[12.5px] text-ga-ink">
        <div className="flex justify-between gap-2">
          <dt className="text-ga-muted">{t('remaining')}</dt>
          <dd className="m-0 font-semibold">{forecast.remainingMinutes}′</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-ga-muted">{t('available')}</dt>
          <dd className="m-0 font-semibold">{forecast.availableMinutes}′ · {t('sessions', { count: forecast.futureSessionCount })}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-ga-muted">{t('projectedEnd')}</dt>
          <dd className="m-0 font-semibold">
            {forecast.projectedEndDate
              ? format(new Date(forecast.projectedEndDate), 'dd/MM/yyyy')
              : <span style={{ color: 'var(--ga-red)' }}>{t('shortfall', { minutes: forecast.shortfallMinutes, sessions: forecast.suggestedExtraSessions })}</span>}
          </dd>
        </div>
      </dl>
      {forecast.milestones.length > 0 && (
        <ul className="m-0 mt-2 flex list-none flex-col gap-1 border-t border-ga-line pt-2 p-0">
          {forecast.milestones.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-2 text-[12px]">
              <span className="min-w-0 truncate text-ga-ink">{m.title}</span>
              <span className="shrink-0 font-semibold" style={{ color: m.atRisk ? 'var(--ga-red)' : 'var(--ga-muted)' }}>
                {format(new Date(m.plannedDate), 'dd/MM')}{m.atRisk ? ` · ${t('atRisk')}` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
