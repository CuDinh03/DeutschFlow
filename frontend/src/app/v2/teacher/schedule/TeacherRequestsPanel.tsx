'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { apiMessage } from '@/lib/api'
import {
  cancelChangeRequest,
  listClassChangeRequests,
  type ScheduleChangeRequest,
} from '@/lib/scheduleChangeRequestApi'
import type { TeacherClassLite } from '@/lib/classScheduleApi'
import { ConfirmDialog, GaBtn, GaCap, TkBadge } from '@/components/ui-v2'

const STATUS_TONE: Record<ScheduleChangeRequest['status'], 'yellow' | 'green' | 'red' | 'neutral'> = {
  PENDING: 'yellow',
  APPROVED: 'green',
  REJECTED: 'red',
  CANCELLED: 'neutral',
}

const inputCls =
  'rounded-ga border border-ga-line bg-ga-bg px-2.5 py-1.5 text-[13px] text-ga-ink outline-none focus:border-ga-accent'

/**
 * Đề xuất thay đổi lịch của giáo viên (PR-6): theo dõi trạng thái duyệt theo lớp và RÚT đề xuất
 * PENDING của chính mình (qua ConfirmDialog — §2.11). Lịch chính thức chỉ đổi khi APPROVED (AC18).
 */
export function TeacherRequestsPanel({ classes }: { classes: TeacherClassLite[] }) {
  const t = useTranslations('v2.teacher.schedule.requests')
  const [classId, setClassId] = useState<number | null>(null)
  const [items, setItems] = useState<ScheduleChangeRequest[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [withdrawing, setWithdrawing] = useState<ScheduleChangeRequest | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (classId == null && classes.length > 0) setClassId(classes[0].id)
  }, [classes, classId])

  const load = useCallback(async (cid: number) => {
    setLoading(true)
    try {
      setItems(await listClassChangeRequests(cid))
      setError('')
    } catch (e: unknown) {
      setError(apiMessage(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { if (classId != null) void load(classId) }, [classId, load])

  const withdraw = async () => {
    if (!withdrawing) return
    setBusy(true)
    try {
      await cancelChangeRequest(withdrawing.id)
      toast.success(t('withdrawSuccess'))
      setWithdrawing(null)
      if (classId != null) await load(classId)
    } catch (e: unknown) {
      toast.error(apiMessage(e))
    } finally {
      setBusy(false)
    }
  }

  if (classes.length === 0) return null

  return (
    <section aria-label={t('heading')} className="mt-7">
      <div className="mb-2.5 flex flex-wrap items-center gap-3">
        <GaCap>{t('heading')}</GaCap>
        <select
          aria-label={t('classLabel')}
          value={classId ?? ''}
          onChange={(e) => setClassId(Number(e.target.value))}
          className={inputCls}
        >
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="ga-shimmer h-[56px] border border-ga-line" aria-hidden />
      ) : error ? (
        <p className="m-0 border border-ga-line bg-ga-card px-4 py-3 text-[13px] text-ga-red">{error}</p>
      ) : items.length === 0 ? (
        <p className="m-0 border border-dashed border-ga-line px-4 py-4 text-center text-[13px] text-ga-muted">
          {t('empty')}
        </p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {items.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-2 border border-ga-line bg-ga-card px-4 py-2.5">
              <TkBadge tone={STATUS_TONE[r.status]}>{t(`status.${r.status}`)}</TkBadge>
              <span className="text-[13px] font-semibold text-ga-ink">{t(`type.${r.requestType}`)}</span>
              <span className="ga-ui min-w-0 flex-1 text-[12px] text-ga-subtle">
                {format(new Date(r.requestedAt), 'dd/MM HH:mm')}
                {r.status === 'REJECTED' && r.rejectReason ? ` · ${t('rejectedReason', { reason: r.rejectReason })}` : ''}
                {r.status === 'APPROVED' && r.appliedAt ? ` · ${t('appliedAt', { date: format(new Date(r.appliedAt), 'dd/MM HH:mm') })}` : ''}
              </span>
              {r.status === 'PENDING' && (
                <GaBtn variant="ghost" size="sm" onClick={() => setWithdrawing(r)}>{t('withdraw')}</GaBtn>
              )}
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={withdrawing !== null}
        onOpenChange={(o) => { if (!o) setWithdrawing(null) }}
        title={t('withdrawTitle')}
        description={withdrawing ? t(`type.${withdrawing.requestType}`) : undefined}
        details={[t('withdrawDetail')]}
        confirmLabel={t('withdrawConfirm')}
        cancelLabel={t('cancel')}
        loading={busy}
        onConfirm={() => void withdraw()}
      />
    </section>
  )
}
