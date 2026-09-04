'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { format } from 'date-fns'
import { Flag, Loader2, Plus, Trash2, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { apiMessage } from '@/lib/api'
import { getClassForecast, type ScheduleForecast } from '@/lib/scheduleChangeRequestApi'
import {
  createMilestone,
  deleteMilestone,
  listMilestones,
  updateMilestone,
  type ClassMilestone,
} from '@/lib/classMilestoneApi'
import type { TeacherClassLite } from '@/lib/classScheduleApi'
import { ConfirmDialog, GaBtn, TkModal } from '@/components/ui-v2'

const inputCls =
  'rounded-ga border border-ga-line bg-ga-bg px-2.5 py-1.5 text-[13px] text-ga-ink outline-none focus:border-ga-accent'

/**
 * Mốc & dự báo của lớp (PR-6, AC09/AC17): mốc thi chính thức + ngày kết thúc; dự báo học-xong
 * theo phân bổ — thiếu khung thì BÁO thiếu + nhu cầu bổ sung. Lớp giáo trình: DỜI ngày mốc thành
 * đề xuất chờ duyệt (P05); xoá mốc qua ConfirmDialog (§2.11).
 */
export function MilestonesModal({
  open,
  classes,
  onClose,
}: {
  open: boolean
  classes: TeacherClassLite[]
  onClose: () => void
}) {
  const t = useTranslations('v2.teacher.schedule.milestones')
  const [classId, setClassId] = useState<number | null>(null)
  const [milestones, setMilestones] = useState<ClassMilestone[]>([])
  const [forecast, setForecast] = useState<ScheduleForecast | null>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [deleting, setDeleting] = useState<ClassMilestone | null>(null)
  // Form thêm mốc
  const [newKind, setNewKind] = useState<'EXAM' | 'COURSE_END'>('EXAM')
  const [newTitle, setNewTitle] = useState('')
  const [newDate, setNewDate] = useState('')
  // Ngày nháp theo mốc (đổi rồi bấm lưu — lớp giáo trình sẽ thành đề xuất)
  const [dateDraft, setDateDraft] = useState<Record<number, string>>({})

  useEffect(() => {
    if (open) setClassId((prev) => prev ?? classes[0]?.id ?? null)
  }, [open, classes])

  const load = useCallback(async (cid: number) => {
    setLoading(true)
    try {
      const [ms, fc] = await Promise.all([
        listMilestones(cid),
        getClassForecast(cid).catch(() => null),
      ])
      setMilestones(ms)
      setForecast(fc)
      setDateDraft({})
    } catch (e: unknown) {
      toast.error(apiMessage(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { if (open && classId != null) void load(classId) }, [open, classId, load])

  const add = async () => {
    if (classId == null || !newTitle.trim() || !newDate) return
    setBusy(true)
    try {
      await createMilestone(classId, { kind: newKind, title: newTitle.trim(), plannedDate: newDate })
      setNewTitle('')
      setNewDate('')
      toast.success(t('addSuccess'))
      await load(classId)
    } catch (e: unknown) {
      toast.error(apiMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const saveDate = async (m: ClassMilestone) => {
    const next = dateDraft[m.id]
    if (classId == null || !next || next === m.plannedDate) return
    setBusy(true)
    try {
      const out = await updateMilestone(classId, m.id, { plannedDate: next })
      if (out.pendingRequestId != null) {
        // P05: lớp giáo trình — ngày CHƯA đổi, đề xuất chờ duyệt.
        toast.success(t('movePending'))
      } else {
        toast.success(t('moveSuccess'))
      }
      await load(classId)
    } catch (e: unknown) {
      toast.error(apiMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!deleting || classId == null) return
    setBusy(true)
    try {
      await deleteMilestone(classId, deleting.id)
      toast.success(t('deleteSuccess'))
      setDeleting(null)
      await load(classId)
    } catch (e: unknown) {
      toast.error(apiMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <TkModal
      open={open}
      onOpenChange={(o) => { if (!o && !busy) onClose() }}
      title={t('title')}
      description={t('subtitle')}
      size="md"
      footer={<GaBtn variant="ghost" onClick={onClose} disabled={busy}>{t('close')}</GaBtn>}
    >
      <div className="flex flex-col gap-4">
        <select
          aria-label={t('classLabel')}
          value={classId ?? ''}
          onChange={(e) => setClassId(Number(e.target.value))}
          className={`${inputCls} self-start`}
        >
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        {loading ? (
          <div className="ga-shimmer h-[120px] border border-ga-line" aria-hidden />
        ) : (
          <>
            {/* Dự báo (AC09/AC17) */}
            {forecast && (
              <div className="border border-ga-line bg-ga-bg px-3 py-2.5 text-[12.5px] text-ga-ink">
                <span className="ga-ui mr-2 text-[11px] font-bold uppercase tracking-[0.06em] text-ga-muted">{t('forecastCap')}</span>
                {forecast.projectedEndDate ? (
                  t('forecastOk', {
                    date: format(new Date(forecast.projectedEndDate), 'dd/MM/yyyy'),
                    remaining: forecast.remainingMinutes,
                    sessions: forecast.futureSessionCount,
                  })
                ) : (
                  <span className="inline-flex items-start gap-1.5 font-semibold" style={{ color: 'var(--ga-red)' }}>
                    <TriangleAlert size={13} className="mt-0.5 shrink-0" />
                    {t('forecastShortfall', {
                      minutes: forecast.shortfallMinutes,
                      sessions: forecast.suggestedExtraSessions,
                    })}
                  </span>
                )}
              </div>
            )}

            {/* Danh sách mốc */}
            {milestones.length === 0 ? (
              <p className="m-0 border border-dashed border-ga-line px-3 py-4 text-center text-[13px] text-ga-muted">
                {t('empty')}
              </p>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                {milestones.map((m) => {
                  const risk = forecast?.milestones.find((x) => x.id === m.id)?.atRisk ?? false
                  return (
                    <li key={m.id} className="flex flex-wrap items-center gap-2 border border-ga-line bg-ga-card px-3 py-2">
                      <Flag size={13} className="shrink-0" style={{ color: risk ? 'var(--ga-red)' : 'var(--ga-muted)' }} />
                      <span className="min-w-0 flex-1 text-[13px] font-semibold text-ga-ink">
                        {m.title}
                        <span className="ml-1.5 font-normal text-ga-subtle">· {t(`kind.${m.kind}`)}</span>
                        {risk && <span className="ml-1.5 text-[11px] font-bold" style={{ color: 'var(--ga-red)' }}>{t('atRisk')}</span>}
                      </span>
                      <input
                        type="date"
                        aria-label={t('dateLabel')}
                        value={dateDraft[m.id] ?? m.plannedDate}
                        onChange={(e) => setDateDraft((prev) => ({ ...prev, [m.id]: e.target.value }))}
                        className={inputCls}
                      />
                      {dateDraft[m.id] != null && dateDraft[m.id] !== m.plannedDate && (
                        <GaBtn variant="primary" size="sm" disabled={busy} onClick={() => saveDate(m)}>
                          {busy ? <Loader2 size={13} className="animate-spin" /> : t('saveDate')}
                        </GaBtn>
                      )}
                      <button
                        type="button"
                        aria-label={t('delete')}
                        onClick={() => setDeleting(m)}
                        disabled={busy}
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-ga text-ga-subtle transition-colors hover:bg-ga-red-soft hover:text-ga-red lg:h-7 lg:w-7"
                      >
                        <Trash2 size={14} />
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}

            {/* Thêm mốc */}
            <div className="flex flex-wrap items-center gap-2 border-t border-ga-line pt-3">
              <select aria-label={t('kindLabel')} value={newKind} onChange={(e) => setNewKind(e.target.value as 'EXAM' | 'COURSE_END')} className={inputCls}>
                <option value="EXAM">{t('kind.EXAM')}</option>
                <option value="COURSE_END">{t('kind.COURSE_END')}</option>
              </select>
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder={t('titlePlaceholder')}
                className={`${inputCls} min-w-0 flex-1`}
              />
              <input type="date" aria-label={t('dateLabel')} value={newDate} onChange={(e) => setNewDate(e.target.value)} className={inputCls} />
              <GaBtn variant="primary" size="sm" disabled={busy || !newTitle.trim() || !newDate} onClick={add}>
                <Plus size={13} /> {t('add')}
              </GaBtn>
            </div>
          </>
        )}
      </div>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => { if (!o) setDeleting(null) }}
        title={t('deleteTitle')}
        description={deleting?.title}
        details={[t('deleteDetail')]}
        confirmLabel={t('deleteConfirm')}
        cancelLabel={t('cancel')}
        loading={busy}
        onConfirm={() => void remove()}
      />
    </TkModal>
  )
}
