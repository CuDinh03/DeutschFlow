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
      <div className="grid grid-cols-2 gap-4">
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
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
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
  const [dayOfWeek, setDayOfWeek] = useState(1)
  const [startTime, setStartTime] = useState('18:00')
  const [duration, setDuration] = useState(90)
  const [mode, setMode] = useState<ClassMode>('OFFLINE')
  const [room, setRoom] = useState('')
  const [effectiveFrom, setEffectiveFrom] = useState('')
  const [effectiveTo, setEffectiveTo] = useState('')
  const [saving, setSaving] = useState(false)

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

  const save = async () => {
    if (!classId) {
      toast.error('Chọn lớp')
      return
    }
    if (!startTime || !effectiveFrom) {
      toast.error('Nhập giờ bắt đầu và ngày áp dụng')
      return
    }
    setSaving(true)
    try {
      const result = await upsertClassPattern(classId, {
        dayOfWeek,
        startTime,
        durationMinutes: duration,
        defaultMode: mode,
        defaultRoom: mode === 'ONLINE' ? null : room.trim() || null,
        effectiveFrom,
        effectiveTo: effectiveTo || null,
      })
      toast.success(
        `Đã lưu lịch ${DOW_LABEL[dayOfWeek - 1]} · sinh ${result.generated} buổi` +
          (result.keptOverridden > 0 ? ` · giữ ${result.keptOverridden} buổi đã chỉnh tay` : ''),
      )
      onSaved(result)
      await loadPatterns(classId)
    } catch (e: unknown) {
      toast.error(apiMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const remove = async (patternId: number) => {
    try {
      await deleteClassPattern(patternId)
      toast.success('Đã xoá lịch cố định')
      if (classId) await loadPatterns(classId)
    } catch (e: unknown) {
      toast.error(apiMessage(e))
    }
  }

  return (
    <TkModal
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Lịch cố định của lớp"
      description="Đặt lịch định kỳ theo thứ — buổi tương lai sẽ tự sinh; buổi đã chỉnh tay được giữ nguyên."
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

          <div className="grid grid-cols-3 gap-4">
            <Field label="Thứ">
              <select className={inputCls} value={dayOfWeek} onChange={(e) => setDayOfWeek(Number(e.target.value))}>
                {DOW_LABEL.map((d, i) => (
                  <option key={d} value={i + 1}>
                    {d}
                  </option>
                ))}
              </select>
            </Field>
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

          <div className="grid grid-cols-2 gap-4">
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
                    className="flex items-center justify-between border border-ga-line bg-ga-bg px-3.5 py-2.5 text-[13px] text-ga-ink"
                  >
                    <span>
                      <b>{DOW_LABEL[p.dayOfWeek - 1]}</b> · {p.startTime.slice(0, 5)} · {p.durationMinutes}′ ·{' '}
                      {MODE_LABEL[p.defaultMode]}
                      {p.defaultRoom ? ` · ${p.defaultRoom}` : ''}
                    </span>
                    <button
                      type="button"
                      aria-label="Xoá lịch cố định"
                      onClick={() => remove(p.id)}
                      className="grid h-7 w-7 place-items-center rounded-ga text-ga-subtle transition-colors hover:bg-ga-red-soft hover:text-ga-red"
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
