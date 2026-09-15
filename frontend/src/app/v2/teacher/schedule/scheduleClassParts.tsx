'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { apiMessage } from '@/lib/api'
import { GaBtn, TkModal, ConfirmDialog } from '@/components/ui-v2'
import {
  type ClassMode,
  type ClassSession,
  type ClassSessionStatus,
  type ClassSchedulePattern,
  type SessionSaveResult,
  type TeacherClassLite,
  type UpsertPatternResult,
  createClassSession,
  updateClassSession,
  upsertClassPattern,
  deleteClassPattern,
  getClassPatterns,
} from '@/lib/classScheduleApi'

// ── Nhãn + màu dùng chung (page render thẻ buổi lớp) ─────────────────────────
// Buổi lớp dùng tông teal (theo token --ga-teal) để phân biệt với buổi 1:1.
// Nhãn là KHOÁ tương đối của namespace `v2.teacher.schedule` (i18n đợt 3) — nơi render gọi t(labelKey).
export const MODE_LABEL_KEY: Record<ClassMode, string> = { ONLINE: 'mode.ONLINE', OFFLINE: 'mode.OFFLINE' }

export const CLASS_STATUS: Record<ClassSessionStatus, { labelKey: string; fg: string; bg: string }> = {
  SCHEDULED: { labelKey: 'status.SCHEDULED', fg: 'var(--ga-teal)', bg: 'var(--ga-teal-soft)' },
  CANCELLED: { labelKey: 'status.CANCELLED', fg: 'var(--ga-red)', bg: 'var(--ga-red-soft)' },
  MOVED: { labelKey: 'status.MOVED', fg: 'var(--ga-orange)', bg: 'var(--ga-orange-soft)' },
}

/** Khoá nhãn thứ trong tuần theo ISO dayOfWeek 1–7 (index = dayOfWeek − 1). */
export const DOW_LABEL_KEY = ['dow.mon', 'dow.tue', 'dow.wed', 'dow.thu', 'dow.fri', 'dow.sat', 'dow.sun']

const inputCls =
  'h-[38px] w-full rounded-ga border border-ga-line bg-ga-bg px-3 text-[13.5px] text-ga-ink outline-none focus:border-ga-accent'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="ga-ui text-[12px] font-bold uppercase tracking-[0.05em] text-ga-muted">{label}</span>
      {children}
    </label>
  )
}

/** Như {@link Field} nhưng bọc bằng `<div>` (không phải `<label>`) — dùng cho nhóm nút/điều
 *  khiển tuỳ biến (vd. các chip chọn thứ) để tránh label trỏ mơ hồ vào nhiều nút con. */
function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="ga-ui text-[12px] font-bold uppercase tracking-[0.05em] text-ga-muted">{label}</span>
      {children}
    </div>
  )
}

const MODE_OPTS: ClassMode[] = ['OFFLINE', 'ONLINE']
const STATUS_OPTS: ClassSessionStatus[] = ['SCHEDULED', 'MOVED', 'CANCELLED']

/** `2026-06-23T18:00:00` → `2026-06-23T18:00` cho input datetime-local. */
const toInputDateTime = (iso: string) => iso.slice(0, 16)

// ── Modal: sửa một buổi ───────────────────────────────────────────────────────
export function EditSessionModal({
  session,
  onClose,
  onSaved,
}: {
  session: ClassSession | null
  onClose: () => void
  onSaved: (r: SessionSaveResult) => void
}) {
  const t = useTranslations('v2.teacher.schedule')
  const tc = useTranslations('v2.common')
  const [startAt, setStartAt] = useState('')
  const [duration, setDuration] = useState(90)
  const [mode, setMode] = useState<ClassMode>('OFFLINE')
  const [room, setRoom] = useState('')
  const [status, setStatus] = useState<ClassSessionStatus>('SCHEDULED')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!session) return
    setStartAt(toInputDateTime(session.startAt))
    setDuration(session.durationMinutes)
    setMode(session.mode)
    setRoom(session.room ?? '')
    setStatus(session.status)
  }, [session])

  const save = async () => {
    if (!session) return
    if (!startAt) {
      toast.error(t('startRequired'))
      return
    }
    if (duration <= 0) {
      toast.error(t('editSession.durationPositive'))
      return
    }
    setSaving(true)
    try {
      const result = await updateClassSession(session.id, {
        startAt,
        durationMinutes: duration,
        mode,
        room: mode === 'ONLINE' ? null : room.trim() || null,
        status,
      })
      // PR-5 (AC18): lớp trung tâm có giáo trình — thay đổi thành ĐỀ XUẤT, lịch chưa đổi.
      if (result.pendingRequestId != null) {
        toast.success(t('editSession.pending'))
        onClose()
        return
      }
      onSaved(result)
      onClose()
    } catch (e: unknown) {
      toast.error(apiMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <TkModal
      open={session !== null}
      onOpenChange={(o) => !o && onClose()}
      title={t('editSession.title')}
      description={session ? t('editSession.description', { className: session.className, count: session.studentCount }) : undefined}
      footer={
        <>
          {/* PR-7: lối vào màn làm việc theo buổi (điểm danh, xác nhận nội dung, chốt buổi). */}
          {session && (
            <a
              href={`/v2/teacher/session/${session.id}`}
              className="ga-ui mr-auto inline-flex min-h-[40px] items-center gap-1.5 text-[13px] font-semibold text-ga-accent hover:underline lg:min-h-0"
            >
              {t('editSession.enter')}
            </a>
          )}
          <GaBtn variant="ghost" onClick={onClose} disabled={saving}>
            {tc('cancel')}
          </GaBtn>
          <GaBtn variant="primary" onClick={save} disabled={saving}>
            {saving ? t('saving') : t('editSession.save')}
          </GaBtn>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={t('field.start')}>
          <input type="datetime-local" className={inputCls} value={startAt} onChange={(e) => setStartAt(e.target.value)} />
        </Field>
        <Field label={t('field.duration')}>
          <input
            type="number"
            min={1}
            className={inputCls}
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
          />
        </Field>
        <Field label={t('field.mode')}>
          <select className={inputCls} value={mode} onChange={(e) => setMode(e.target.value as ClassMode)}>
            {MODE_OPTS.map((m) => (
              <option key={m} value={m}>
                {t(MODE_LABEL_KEY[m])}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('field.room')}>
          <input
            className={inputCls}
            value={mode === 'ONLINE' ? '' : room}
            disabled={mode === 'ONLINE'}
            placeholder={mode === 'ONLINE' ? t('field.roomOnline') : t('field.roomPlaceholder')}
            onChange={(e) => setRoom(e.target.value)}
          />
        </Field>
        <Field label={t('field.status')}>
          <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value as ClassSessionStatus)}>
            {STATUS_OPTS.map((s) => (
              <option key={s} value={s}>
                {t(CLASS_STATUS[s].labelKey)}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <p className="ga-ui mt-4 text-[12px] text-ga-subtle">
        {t('editSession.overrideNote')}
      </p>
    </TkModal>
  )
}

// ── Modal: thêm một buổi lẻ ─────────────────────────────────────────────────
export function CreateSessionModal({
  open,
  classes,
  defaultClassId,
  onClose,
  onSaved,
}: {
  open: boolean
  classes: TeacherClassLite[]
  defaultClassId?: number
  onClose: () => void
  onSaved: (r: SessionSaveResult) => void
}) {
  const t = useTranslations('v2.teacher.schedule')
  const tc = useTranslations('v2.common')
  const [classId, setClassId] = useState<number | null>(null)
  const [startAt, setStartAt] = useState('')
  const [duration, setDuration] = useState(90)
  const [mode, setMode] = useState<ClassMode>('OFFLINE')
  const [room, setRoom] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) setClassId(defaultClassId ?? classes[0]?.id ?? null)
  }, [open, defaultClassId, classes])

  const save = async () => {
    if (!classId) {
      toast.error(t('classRequired'))
      return
    }
    if (!startAt) {
      toast.error(t('startRequired'))
      return
    }
    setSaving(true)
    try {
      const result = await createClassSession(classId, {
        startAt,
        durationMinutes: duration,
        mode,
        room: mode === 'ONLINE' ? null : room.trim() || null,
      })
      // PR-5 (AC18): buổi bù của lớp trung tâm có giáo trình đi qua duyệt — chưa có buổi nào được tạo.
      if (result.pendingRequestId != null) {
        toast.success(t('createSession.pending'))
        onClose()
        return
      }
      onSaved(result)
      onClose()
    } catch (e: unknown) {
      toast.error(apiMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <TkModal
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={t('createSession.title')}
      description={t('createSession.description')}
      footer={
        <>
          <GaBtn variant="ghost" onClick={onClose} disabled={saving}>
            {tc('cancel')}
          </GaBtn>
          <GaBtn variant="primary" onClick={save} disabled={saving || classes.length === 0}>
            {saving ? t('saving') : t('addSession')}
          </GaBtn>
        </>
      }
    >
      {classes.length === 0 ? (
        <p className="ga-ui text-[13.5px] text-ga-muted">{t('createSession.noClasses')}</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="col-span-1 sm:col-span-2">
            <Field label={t('field.class')}>
              <select
                className={inputCls}
                value={classId ?? ''}
                onChange={(e) => setClassId(Number(e.target.value))}
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {t('field.classOption', { name: c.name, count: c.studentCount })}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label={t('field.start')}>
            <input type="datetime-local" className={inputCls} value={startAt} onChange={(e) => setStartAt(e.target.value)} />
          </Field>
          <Field label={t('field.duration')}>
            <input
              type="number"
              min={1}
              className={inputCls}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
            />
          </Field>
          <Field label={t('field.mode')}>
            <select className={inputCls} value={mode} onChange={(e) => setMode(e.target.value as ClassMode)}>
              {MODE_OPTS.map((m) => (
                <option key={m} value={m}>
                  {t(MODE_LABEL_KEY[m])}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('field.room')}>
            <input
              className={inputCls}
              value={mode === 'ONLINE' ? '' : room}
              disabled={mode === 'ONLINE'}
              placeholder={mode === 'ONLINE' ? t('field.roomOnline') : t('field.roomPlaceholder')}
              onChange={(e) => setRoom(e.target.value)}
            />
          </Field>
        </div>
      )}
    </TkModal>
  )
}

// ── Modal: lịch cố định của lớp (pattern) ────────────────────────────────────
export function PatternModal({
  open,
  classes,
  onClose,
  onSaved,
}: {
  open: boolean
  classes: TeacherClassLite[]
  onClose: () => void
  onSaved: (r: UpsertPatternResult) => void
}) {
  const t = useTranslations('v2.teacher.schedule')
  const tc = useTranslations('v2.common')
  const dowLabel = (dow: number) => t(DOW_LABEL_KEY[dow - 1])
  const [classId, setClassId] = useState<number | null>(null)
  const [patterns, setPatterns] = useState<ClassSchedulePattern[]>([])
  const [loadingP, setLoadingP] = useState(false)
  // Nhiều thứ trong tuần (ISO 1–7: 1=Thứ 2 … 7=Chủ nhật). Mỗi thứ = một pattern độc lập.
  const [days, setDays] = useState<Set<number>>(() => new Set([1]))
  const [startTime, setStartTime] = useState('18:00')
  const [duration, setDuration] = useState(90)
  const [mode, setMode] = useState<ClassMode>('OFFLINE')
  const [room, setRoom] = useState('')
  const [effectiveFrom, setEffectiveFrom] = useState('')
  const [effectiveTo, setEffectiveTo] = useState('')
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  // §2.11: pattern chờ người dùng XÁC NHẬN xoá trong dialog (nêu hệ quả) — null = không mở.
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)

  const loadPatterns = useCallback(async (cid: number) => {
    setLoadingP(true)
    try {
      setPatterns(await getClassPatterns(cid))
    } catch (e: unknown) {
      toast.error(apiMessage(e))
    } finally {
      setLoadingP(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    const first = classes[0]?.id ?? null
    setClassId(first)
    if (first) void loadPatterns(first)
  }, [open, classes, loadPatterns])

  const onClassChange = (cid: number) => {
    setClassId(cid)
    void loadPatterns(cid)
  }

  const toggleDay = (dow: number) =>
    setDays((prev) => {
      const next = new Set(prev)
      if (next.has(dow)) next.delete(dow)
      else next.add(dow)
      return next
    })

  const save = async () => {
    if (!classId) {
      toast.error(t('classRequired'))
      return
    }
    const selected = Array.from(days).sort((a, b) => a - b)
    if (selected.length === 0) {
      toast.error(t('pattern.weekdayRequired'))
      return
    }
    if (!startTime || !effectiveFrom) {
      toast.error(t('pattern.startAndFromRequired'))
      return
    }
    setSaving(true)
    try {
      const body = {
        startTime,
        durationMinutes: duration,
        defaultMode: mode,
        defaultRoom: mode === 'ONLINE' ? null : room.trim() || null,
        effectiveFrom,
        effectiveTo: effectiveTo || null,
      }
      // Mỗi thứ là một upsert (classId, dayOfWeek) độc lập. Chạy tuần tự để việc chặn
      // trùng lịch giáo viên đọc trạng thái nhất quán và không dồn ghi đồng thời; thu kết
      // quả từng thứ để báo rõ thứ nào lưu được, thứ nào trùng lịch.
      const savedDays: number[] = []
      const failed: { dow: number; msg: string }[] = []
      let generated = 0
      let kept = 0
      let skipped = 0
      let lastResult: UpsertPatternResult | null = null
      for (const dow of selected) {
        try {
          const r = await upsertClassPattern(classId, { dayOfWeek: dow, ...body })
          savedDays.push(dow)
          generated += r.generated
          kept += r.keptOverridden
          skipped += r.skipped ?? 0
          lastResult = r
        } catch (e: unknown) {
          failed.push({ dow, msg: apiMessage(e) })
        }
      }

      if (savedDays.length > 0) {
        const label = savedDays.map(dowLabel).join(', ')
        // PR-5: lớp gated → mọi ngày đều thành đề xuất (cùng một lớp thì cùng một chế độ).
        if (lastResult?.pendingRequestId != null) {
          toast.success(t('pattern.savePending', { days: label }))
        } else {
          toast.success(
            [
              t('pattern.saved', { days: label, n: generated }),
              kept > 0 ? t('pattern.savedKept', { n: kept }) : null,
              skipped > 0 ? t('pattern.savedSkipped', { n: skipped }) : null,
            ]
              .filter(Boolean)
              .join(' · '),
          )
        }
      }
      if (failed.length > 0) {
        const label = failed.map((f) => dowLabel(f.dow)).join(', ')
        // Only attach a specific reason when every failed day failed for the SAME reason;
        // otherwise a generic message avoids misattributing day A's cause to day B.
        const reasons = Array.from(new Set(failed.map((f) => f.msg)))
        const detail = reasons.length === 1 ? reasons[0] : t('pattern.saveFailedGeneric')
        toast.error(t('pattern.saveFailed', { days: label, detail }))
      }
      if (lastResult) onSaved(lastResult)
      await loadPatterns(classId)
    } catch (e: unknown) {
      toast.error(apiMessage(e))
    } finally {
      setSaving(false)
    }
  }

  // §2.11: xoá qua ConfirmDialog nêu hệ quả — chạy SAU khi người dùng xác nhận.
  const remove = async (patternId: number) => {
    if (deletingId !== null) return // chặn double-click: một lần xoá đang chạy
    setDeletingId(patternId)
    try {
      const r = await deleteClassPattern(patternId)
      // PR-5 (AC18): lớp trung tâm có giáo trình — việc xoá vào hàng chờ duyệt, chưa gỡ gì.
      if (r.pendingRequestId != null) {
        toast.success(t('pattern.deletePending'))
      } else {
        toast.success(t('pattern.deleted', { n: r.removedSessions }))
      }
      if (classId) await loadPatterns(classId)
      setConfirmDeleteId(null)
    } catch (e: unknown) {
      toast.error(apiMessage(e))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <TkModal
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={t('pattern.title')}
      description={t('pattern.description')}
      size="lg"
      footer={
        <>
          <GaBtn variant="ghost" onClick={onClose} disabled={saving}>
            {tc('close')}
          </GaBtn>
          <GaBtn variant="primary" onClick={save} disabled={saving || classes.length === 0}>
            {saving ? t('saving') : t('pattern.save')}
          </GaBtn>
        </>
      }
    >
      {classes.length === 0 ? (
        <p className="ga-ui text-[13.5px] text-ga-muted">{t('pattern.noClasses')}</p>
      ) : (
        <div className="grid gap-5">
          <Field label={t('field.class')}>
            <select className={inputCls} value={classId ?? ''} onChange={(e) => onClassChange(Number(e.target.value))}>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {t('field.classOption', { name: c.name, count: c.studentCount })}
                </option>
              ))}
            </select>
          </Field>

          <FieldGroup label={t('field.weekdays')}>
            <div role="group" aria-label={t('field.weekdaysAria')} className="flex flex-wrap gap-2">
              {DOW_LABEL_KEY.map((key, i) => {
                const dow = i + 1
                const on = days.has(dow)
                const d = t(key)
                return (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleDay(dow)}
                    className={`h-10 rounded-ga border px-3.5 text-[13px] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ga-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ga-bg lg:h-[38px] ${
                      on
                        ? 'border-ga-teal bg-ga-teal-soft text-ga-teal'
                        : 'border-ga-line bg-ga-bg text-ga-muted hover:border-ga-teal hover:text-ga-ink'
                    }`}
                  >
                    {d}
                  </button>
                )
              })}
            </div>
          </FieldGroup>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t('field.startTime')}>
              <input type="time" className={inputCls} value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </Field>
            <Field label={t('field.duration')}>
              <input
                type="number"
                min={1}
                className={inputCls}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
              />
            </Field>
            <Field label={t('field.mode')}>
              <select className={inputCls} value={mode} onChange={(e) => setMode(e.target.value as ClassMode)}>
                {MODE_OPTS.map((m) => (
                  <option key={m} value={m}>
                    {t(MODE_LABEL_KEY[m])}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('field.room')}>
              <input
                className={inputCls}
                value={mode === 'ONLINE' ? '' : room}
                disabled={mode === 'ONLINE'}
                placeholder={mode === 'ONLINE' ? t('field.roomOnline') : t('field.roomPlaceholder')}
                onChange={(e) => setRoom(e.target.value)}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t('field.effectiveFrom')}>
              <input type="date" className={inputCls} value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
            </Field>
            <Field label={t('field.effectiveTo')}>
              <input type="date" className={inputCls} value={effectiveTo} onChange={(e) => setEffectiveTo(e.target.value)} />
            </Field>
          </div>

          <div>
            <div className="ga-ui mb-2 text-[12px] font-bold uppercase tracking-[0.05em] text-ga-muted">
              {t('pattern.existingCap')}
            </div>
            {loadingP ? (
              <div className="ga-shimmer h-[60px] border border-ga-line" aria-hidden />
            ) : patterns.length === 0 ? (
              <p className="ga-ui text-[13px] text-ga-subtle">{t('pattern.empty')}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {patterns.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-2 border border-ga-line bg-ga-bg px-3.5 py-2.5 text-[13px] text-ga-ink"
                  >
                    <span className="min-w-0 break-words">
                      <b>{dowLabel(p.dayOfWeek)}</b> · {p.startTime.slice(0, 5)} · {p.durationMinutes}′ ·{' '}
                      {t(MODE_LABEL_KEY[p.defaultMode])}
                      {p.defaultRoom ? ` · ${p.defaultRoom}` : ''}
                    </span>
                    <button
                      type="button"
                      aria-label={t('pattern.delete')}
                      onClick={() => setConfirmDeleteId(p.id)}
                      disabled={deletingId !== null}
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-ga text-ga-subtle transition-colors hover:bg-ga-red-soft hover:text-ga-red disabled:pointer-events-none disabled:opacity-50 lg:h-7 lg:w-7"
                    >
                      <Trash2 size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
      <ConfirmDialog
        open={confirmDeleteId != null}
        onOpenChange={(o) => { if (!o) setConfirmDeleteId(null) }}
        title={t('pattern.deleteTitle')}
        description={(() => {
          const p = patterns.find((x) => x.id === confirmDeleteId)
          return p ? `${dowLabel(p.dayOfWeek)} · ${p.startTime.slice(0, 5)} · ${p.durationMinutes}′` : undefined
        })()}
        details={[t('pattern.deleteDetailSessions'), t('pattern.deleteDetailGated')]}
        confirmLabel={t('pattern.deleteConfirm')}
        cancelLabel={tc('cancel')}
        loading={deletingId != null}
        onConfirm={() => { if (confirmDeleteId != null) void remove(confirmDeleteId) }}
      />
    </TkModal>
  )
}
