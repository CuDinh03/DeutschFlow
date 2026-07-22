'use client'

import { useCallback, useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { apiMessage } from '@/lib/api'
import { GaBtn, TkModal } from '@/components/ui-v2'
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
export const MODE_LABEL: Record<ClassMode, string> = { ONLINE: 'Online', OFFLINE: 'Tại lớp' }

export const CLASS_STATUS: Record<ClassSessionStatus, { label: string; fg: string; bg: string }> = {
  SCHEDULED: { label: 'Đã lên lịch', fg: 'var(--ga-teal)', bg: 'var(--ga-teal-soft)' },
  CANCELLED: { label: 'Đã huỷ', fg: 'var(--ga-red)', bg: 'var(--ga-red-soft)' },
  MOVED: { label: 'Đã dời', fg: 'var(--ga-orange)', bg: 'var(--ga-orange-soft)' },
}

export const DOW_LABEL = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật']

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
      toast.error('Chọn thời gian bắt đầu')
      return
    }
    if (duration <= 0) {
      toast.error('Thời lượng phải lớn hơn 0')
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
      title="Sửa buổi học"
      description={session ? `${session.className} · ${session.studentCount} học viên` : undefined}
      footer={
        <>
          <GaBtn variant="ghost" onClick={onClose} disabled={saving}>
            Huỷ
          </GaBtn>
          <GaBtn variant="primary" onClick={save} disabled={saving}>
            {saving ? 'Đang lưu…' : 'Lưu buổi'}
          </GaBtn>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Bắt đầu">
          <input type="datetime-local" className={inputCls} value={startAt} onChange={(e) => setStartAt(e.target.value)} />
        </Field>
        <Field label="Thời lượng (phút)">
          <input
            type="number"
            min={1}
            className={inputCls}
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
          />
        </Field>
        <Field label="Hình thức">
          <select className={inputCls} value={mode} onChange={(e) => setMode(e.target.value as ClassMode)}>
            {MODE_OPTS.map((m) => (
              <option key={m} value={m}>
                {MODE_LABEL[m]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Phòng">
          <input
            className={inputCls}
            value={mode === 'ONLINE' ? '' : room}
            disabled={mode === 'ONLINE'}
            placeholder={mode === 'ONLINE' ? 'Không cần (online)' : 'VD: P.302'}
            onChange={(e) => setRoom(e.target.value)}
          />
        </Field>
        <Field label="Trạng thái">
          <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value as ClassSessionStatus)}>
            {STATUS_OPTS.map((s) => (
              <option key={s} value={s}>
                {CLASS_STATUS[s].label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <p className="ga-ui mt-4 text-[12px] text-ga-subtle">
        Sửa buổi sẽ đánh dấu buổi này là “đã chỉnh tay” — đổi lịch cố định của lớp sau đó sẽ không ghi đè buổi này.
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
      toast.error('Chọn lớp')
      return
    }
    if (!startAt) {
      toast.error('Chọn thời gian bắt đầu')
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
      title="Thêm buổi lớp"
      description="Buổi lẻ — không theo lịch cố định."
      footer={
        <>
          <GaBtn variant="ghost" onClick={onClose} disabled={saving}>
            Huỷ
          </GaBtn>
          <GaBtn variant="primary" onClick={save} disabled={saving || classes.length === 0}>
            {saving ? 'Đang lưu…' : 'Thêm buổi'}
          </GaBtn>
        </>
      }
    >
      {classes.length === 0 ? (
        <p className="ga-ui text-[13.5px] text-ga-muted">Bạn chưa có lớp nào để thêm buổi.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="col-span-1 sm:col-span-2">
            <Field label="Lớp">
              <select
                className={inputCls}
                value={classId ?? ''}
                onChange={(e) => setClassId(Number(e.target.value))}
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {c.studentCount} HV
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Bắt đầu">
            <input type="datetime-local" className={inputCls} value={startAt} onChange={(e) => setStartAt(e.target.value)} />
          </Field>
          <Field label="Thời lượng (phút)">
            <input
              type="number"
              min={1}
              className={inputCls}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
            />
          </Field>
          <Field label="Hình thức">
            <select className={inputCls} value={mode} onChange={(e) => setMode(e.target.value as ClassMode)}>
              {MODE_OPTS.map((m) => (
                <option key={m} value={m}>
                  {MODE_LABEL[m]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Phòng">
            <input
              className={inputCls}
              value={mode === 'ONLINE' ? '' : room}
              disabled={mode === 'ONLINE'}
              placeholder={mode === 'ONLINE' ? 'Không cần (online)' : 'VD: P.302'}
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
      toast.error('Chọn lớp')
      return
    }
    const selected = Array.from(days).sort((a, b) => a - b)
    if (selected.length === 0) {
      toast.error('Chọn ít nhất một thứ')
      return
    }
    if (!startTime || !effectiveFrom) {
      toast.error('Nhập giờ bắt đầu và ngày áp dụng')
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
        const label = savedDays.map((d) => DOW_LABEL[d - 1]).join(', ')
        toast.success(
          `Đã lưu lịch ${label} · sinh ${generated} buổi` +
            (kept > 0 ? ` · giữ ${kept} buổi đã chỉnh tay` : '') +
            (skipped > 0 ? ` · bỏ qua ${skipped} buổi trùng lịch` : ''),
        )
      }
      if (failed.length > 0) {
        const label = failed.map((f) => DOW_LABEL[f.dow - 1]).join(', ')
        // Only attach a specific reason when every failed day failed for the SAME reason;
        // otherwise a generic message avoids misattributing day A's cause to day B.
        const reasons = Array.from(new Set(failed.map((f) => f.msg)))
        const detail = reasons.length === 1 ? reasons[0] : 'trùng lịch hoặc thông tin không hợp lệ'
        toast.error(`Không lưu được ${label}: ${detail}`)
      }
      if (lastResult) onSaved(lastResult)
      await loadPatterns(classId)
    } catch (e: unknown) {
      toast.error(apiMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const remove = async (patternId: number) => {
    if (deletingId !== null) return // chặn double-click: một lần xoá đang chạy
    setDeletingId(patternId)
    try {
      await deleteClassPattern(patternId)
      toast.success('Đã xoá lịch cố định')
      if (classId) await loadPatterns(classId)
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
      title="Lịch cố định của lớp"
      description="Đặt lịch định kỳ theo các thứ trong tuần — buổi tương lai sẽ tự sinh; buổi đã chỉnh tay được giữ nguyên."
      size="lg"
      footer={
        <>
          <GaBtn variant="ghost" onClick={onClose} disabled={saving}>
            Đóng
          </GaBtn>
          <GaBtn variant="primary" onClick={save} disabled={saving || classes.length === 0}>
            {saving ? 'Đang lưu…' : 'Lưu lịch cố định'}
          </GaBtn>
        </>
      }
    >
      {classes.length === 0 ? (
        <p className="ga-ui text-[13.5px] text-ga-muted">Bạn chưa có lớp nào.</p>
      ) : (
        <div className="grid gap-5">
          <Field label="Lớp">
            <select className={inputCls} value={classId ?? ''} onChange={(e) => onClassChange(Number(e.target.value))}>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {c.studentCount} HV
                </option>
              ))}
            </select>
          </Field>

          <FieldGroup label="Các thứ trong tuần">
            <div role="group" aria-label="Chọn các thứ trong tuần" className="flex flex-wrap gap-2">
              {DOW_LABEL.map((d, i) => {
                const dow = i + 1
                const on = days.has(dow)
                return (
                  <button
                    key={d}
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
            <Field label="Giờ bắt đầu">
              <input type="time" className={inputCls} value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </Field>
            <Field label="Thời lượng (phút)">
              <input
                type="number"
                min={1}
                className={inputCls}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
              />
            </Field>
            <Field label="Hình thức">
              <select className={inputCls} value={mode} onChange={(e) => setMode(e.target.value as ClassMode)}>
                {MODE_OPTS.map((m) => (
                  <option key={m} value={m}>
                    {MODE_LABEL[m]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Phòng">
              <input
                className={inputCls}
                value={mode === 'ONLINE' ? '' : room}
                disabled={mode === 'ONLINE'}
                placeholder={mode === 'ONLINE' ? 'Không cần (online)' : 'VD: P.302'}
                onChange={(e) => setRoom(e.target.value)}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Áp dụng từ">
              <input type="date" className={inputCls} value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
            </Field>
            <Field label="Đến (để trống = vô thời hạn)">
              <input type="date" className={inputCls} value={effectiveTo} onChange={(e) => setEffectiveTo(e.target.value)} />
            </Field>
          </div>

          <div>
            <div className="ga-ui mb-2 text-[12px] font-bold uppercase tracking-[0.05em] text-ga-muted">
              Lịch cố định hiện có
            </div>
            {loadingP ? (
              <div className="ga-shimmer h-[60px] border border-ga-line" aria-hidden />
            ) : patterns.length === 0 ? (
              <p className="ga-ui text-[13px] text-ga-subtle">Chưa có lịch cố định cho lớp này.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {patterns.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-2 border border-ga-line bg-ga-bg px-3.5 py-2.5 text-[13px] text-ga-ink"
                  >
                    <span className="min-w-0 break-words">
                      <b>{DOW_LABEL[p.dayOfWeek - 1]}</b> · {p.startTime.slice(0, 5)} · {p.durationMinutes}′ ·{' '}
                      {MODE_LABEL[p.defaultMode]}
                      {p.defaultRoom ? ` · ${p.defaultRoom}` : ''}
                    </span>
                    <button
                      type="button"
                      aria-label="Xoá lịch cố định"
                      onClick={() => remove(p.id)}
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
    </TkModal>
  )
}
