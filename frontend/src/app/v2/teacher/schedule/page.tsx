'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarClock, ChevronLeft, ChevronRight, Clock, Plus, Users } from 'lucide-react'
import { toast } from 'sonner'
import api, { apiMessage } from '@/lib/api'
import { getAvailability, putAvailability, type AvailabilitySlot } from '@/lib/teacherAvailabilityApi'
import {
  fmtLocalIso,
  getClassWeek,
  getMyClasses,
  type ClassSession,
  type SessionSaveResult,
  type TeacherClassLite,
} from '@/lib/classScheduleApi'
import { GaPageHdr, GaBtn, GaCap, TkSeg, type TkSegOption } from '@/components/ui-v2'
import { CLASS_STATUS, CreateSessionModal, EditSessionModal, MODE_LABEL, PatternModal } from './scheduleClassParts'

// ─────────────────────────────────────────────────────────────────────────────
// Lịch dạy (v2).
// Tab "Lịch tuần": buổi 1:1 thật (GET /teacher-sessions/teacher) + buổi LỚP thật
//   (GET /v2/teacher/class-schedule/week — Pha 2) trên cùng lưới tuần; thêm/sửa
//   buổi lớp + đặt lịch cố định (pattern, override sticky).
// Tab "Khung giờ rảnh": lưới khung giờ rảnh (GET/PUT /v2/teacher/availability).
// ─────────────────────────────────────────────────────────────────────────────

const VIOLET = '#7C56C8'

type Tab = 'week' | 'availability'
const TABS: TkSegOption<Tab>[] = [
  { value: 'week', label: 'Lịch tuần' },
  { value: 'availability', label: 'Khung giờ rảnh' },
]

interface Session {
  id: number
  studentId: number
  studentName: string
  title: string
  notes: string | null
  scheduledAt: string
  durationMinutes: number
  priceVnd: number
  status: string
  paymentStatus: string | null
  teacherRating: number | null
  payoutStatus: string | null
}

const STATUS: Record<string, { label: string; fg: string; bg: string }> = {
  PENDING: { label: 'Chờ xác nhận', fg: 'var(--ga-orange)', bg: 'var(--ga-orange-soft)' },
  CONFIRMED: { label: 'Đã xác nhận', fg: 'var(--ga-violet)', bg: 'var(--ga-violet-soft)' },
  COMPLETED: { label: 'Hoàn thành', fg: 'var(--ga-green)', bg: 'var(--ga-green-soft)' },
  CANCELLED: { label: 'Đã huỷ', fg: 'var(--ga-red)', bg: 'var(--ga-red-soft)' },
}
const statusOf = (s: string) => STATUS[s] ?? { label: s, fg: 'var(--ga-muted)', bg: 'var(--ga-side-active)' }

const DAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']
const pad2 = (n: number) => String(n).padStart(2, '0')
const fmtDate = (d: Date) => `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`
const fmtTime = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`

/** Monday 00:00 of the week `offset` weeks from the current week (offset 0 = this week). */
function mondayOf(offset: number): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  const dow = (d.getDay() + 6) % 7 // Mon=0 … Sun=6
  d.setDate(d.getDate() - dow + offset * 7)
  return d
}

export default function V2TeacherSchedulePage() {
  const [tab, setTab] = useState<Tab>('week')

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <GaPageHdr
        accent
        title="Lịch dạy"
        subtitle="Lịch tuần buổi 1:1 và buổi lớp · khung giờ rảnh để học viên đặt buổi 1:1"
        right={<TkSeg options={TABS} value={tab} onValueChange={setTab} aria-label="Chế độ xem" />}
      />
      <div className="flex-1 overflow-auto px-10 py-7">
        {tab === 'week' ? <WeekView /> : <AvailabilityView />}
      </div>
    </div>
  )
}

// ── Tab "Lịch tuần": buổi 1:1 + buổi lớp theo tuần + Sắp tới ──────────────────
function WeekView() {
  const [profileId, setProfileId] = useState<number | null>(null)
  const [noProfile, setNoProfile] = useState(false)
  const [sessions, setSessions] = useState<Session[]>([])
  const [classSessions, setClassSessions] = useState<ClassSession[]>([])
  const [classes, setClasses] = useState<TeacherClassLite[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [weekOffset, setWeekOffset] = useState(0)

  const [editTarget, setEditTarget] = useState<ClassSession | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [showPattern, setShowPattern] = useState(false)

  const monday = useMemo(() => mondayOf(weekOffset), [weekOffset])
  const weekEnd = useMemo(() => {
    const d = new Date(monday)
    d.setDate(d.getDate() + 6)
    return d
  }, [monday])

  const resolveProfile = useCallback(async () => {
    try {
      const me = await api.get('/auth/me')
      const uid = Number(me.data?.userId ?? me.data?.id)
      const pub = await api.get('/v2/teachers/public?size=100')
      const list = (pub.data?.content ?? []) as { id: number; userId: number }[]
      const mine = list.find((p) => Number(p.userId) === uid)
      if (mine) setProfileId(mine.id)
      else {
        setNoProfile(true)
        setLoading(false)
      }
    } catch (e: unknown) {
      setError(apiMessage(e))
      setLoading(false)
    }
  }, [])

  const load = useCallback(async (pid: number) => {
    setLoading(true)
    try {
      const res = await api.get(`/teacher-sessions/teacher?profileId=${pid}`)
      setSessions((res.data?.content ?? []) as Session[])
      setError('')
    } catch (e: unknown) {
      setError(apiMessage(e))
    } finally {
      setLoading(false)
    }
  }, [])

  const loadClassWeek = useCallback(async (mon: Date) => {
    try {
      const end = new Date(mon)
      end.setDate(end.getDate() + 7)
      setClassSessions(await getClassWeek(fmtLocalIso(mon), fmtLocalIso(end)))
    } catch (e: unknown) {
      // Buổi lớp là phần bổ sung — báo lỗi nhưng không chặn lịch 1:1.
      toast.error(apiMessage(e))
    }
  }, [])

  useEffect(() => {
    void resolveProfile()
  }, [resolveProfile])
  useEffect(() => {
    if (profileId) void load(profileId)
  }, [profileId, load])
  useEffect(() => {
    void loadClassWeek(monday)
  }, [monday, loadClassWeek])
  useEffect(() => {
    getMyClasses()
      .then(setClasses)
      .catch(() => setClasses([]))
  }, [])

  const upcoming = useMemo(() => {
    const now = Date.now()
    return sessions
      .filter((s) => s.status !== 'CANCELLED' && new Date(s.scheduledAt).getTime() >= now)
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
      .slice(0, 5)
  }, [sessions])

  const handleSaved = useCallback(
    (r: SessionSaveResult) => {
      r.roomWarnings.forEach((w) => toast.warning(w))
      void loadClassWeek(monday)
    },
    [loadClassWeek, monday],
  )

  if (error) {
    return (
      <div className="border border-ga-line bg-ga-card px-10 py-[52px] text-center">
        <h2 className="font-ga-display text-[24px] font-medium text-ga-red">Không tải được lịch dạy</h2>
        <p className="ga-ui mx-auto mb-5 mt-3 max-w-sm text-[14px] text-ga-muted">
          {error} <code className="font-mono text-[12px] text-ga-accent">GET /api/teacher-sessions/teacher</code>
        </p>
        <GaBtn variant="primary" onClick={() => (profileId ? load(profileId) : resolveProfile())}>
          Thử lại
        </GaBtn>
      </div>
    )
  }

  if (noProfile) {
    return (
      <div className="border border-dashed border-ga-line bg-ga-card px-10 py-[52px] text-center">
        <h2 className="font-ga-display text-[22px] font-medium text-ga-ink">Chưa có hồ sơ giáo viên công khai</h2>
        <p className="ga-ui mx-auto mt-2 max-w-md text-[14px] text-ga-muted">
          Lịch buổi 1:1 cần một hồ sơ công khai để học viên đặt lịch. Tạo hồ sơ trong mục Hồ sơ giáo viên trước.
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="grid gap-6" style={{ gridTemplateColumns: 'minmax(0, 1fr) 300px' }}>
        <div className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-ga-display text-[20px] font-medium text-ga-ink">
              Tuần {fmtDate(monday)}–{fmtDate(weekEnd)}/{weekEnd.getFullYear()}
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <GaBtn variant="ghost" size="sm" onClick={() => setShowCreate(true)}>
                <Plus size={14} /> Thêm buổi
              </GaBtn>
              <GaBtn variant="ghost" size="sm" onClick={() => setShowPattern(true)}>
                <CalendarClock size={14} /> Lịch cố định
              </GaBtn>
              <span className="mx-1 h-5 w-px bg-ga-line" aria-hidden />
              <GaBtn variant="ghost" size="sm" aria-label="Tuần trước" onClick={() => setWeekOffset((w) => w - 1)}>
                <ChevronLeft size={15} />
              </GaBtn>
              <GaBtn variant="ghost" size="sm" disabled={weekOffset === 0} onClick={() => setWeekOffset(0)}>
                Tuần này
              </GaBtn>
              <GaBtn variant="ghost" size="sm" aria-label="Tuần sau" onClick={() => setWeekOffset((w) => w + 1)}>
                <ChevronRight size={15} />
              </GaBtn>
            </div>
          </div>

          {loading ? (
            <div className="ga-shimmer h-[560px] border border-ga-line" aria-hidden />
          ) : (
            <WeekGrid sessions={sessions} classSessions={classSessions} monday={monday} onSessionClick={setEditTarget} />
          )}
        </div>

        <aside className="min-w-0">
          <GaCap>Buổi 1:1 sắp tới</GaCap>
          <div className="mt-3 flex flex-col gap-2.5">
            {loading ? (
              <div className="ga-shimmer h-[120px] border border-ga-line" aria-hidden />
            ) : upcoming.length === 0 ? (
              <div className="border border-dashed border-ga-line px-4 py-6 text-center text-[13px] text-ga-muted">
                Chưa có buổi 1:1 sắp tới.
              </div>
            ) : (
              upcoming.map((s) => {
                const d = new Date(s.scheduledAt)
                const c = statusOf(s.status)
                return (
                  <div key={s.id} className="border border-ga-line bg-ga-card px-3.5 py-3" style={{ borderLeft: `3px solid ${c.fg}` }}>
                    <div className="flex items-center gap-1.5 text-[12px] text-ga-muted">
                      <Clock size={11} /> {fmtDate(d)} · {fmtTime(d)}
                    </div>
                    <div className="mt-1 truncate text-[13.5px] font-bold text-ga-ink">{s.studentName}</div>
                    <div className="mt-0.5 truncate text-[12px] text-ga-subtle">{s.title}</div>
                    <span
                      className="mt-1.5 inline-block px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.05em]"
                      style={{ color: c.fg, background: c.bg }}
                    >
                      {c.label}
                    </span>
                  </div>
                )
              })
            )}
          </div>
        </aside>
      </div>

      <EditSessionModal session={editTarget} onClose={() => setEditTarget(null)} onSaved={handleSaved} />
      <CreateSessionModal open={showCreate} classes={classes} onClose={() => setShowCreate(false)} onSaved={handleSaved} />
      <PatternModal open={showPattern} classes={classes} onClose={() => setShowPattern(false)} onSaved={() => void loadClassWeek(monday)} />
    </>
  )
}

// ── Lịch tuần: buổi 1:1 (theo status) + buổi lớp (teal, bấm để sửa) ───────────
const START_HOUR = 7
const END_HOUR = 22
const GRID_H = 560

function blockTop(date: Date): number {
  const hour = date.getHours() + date.getMinutes() / 60
  return ((hour - START_HOUR) / (END_HOUR - START_HOUR)) * GRID_H
}
function blockHeight(durationMinutes: number): number {
  return Math.max(((durationMinutes / 60) / (END_HOUR - START_HOUR)) * GRID_H, 38)
}

function WeekGrid({
  sessions,
  classSessions,
  monday,
  onSessionClick,
}: {
  sessions: Session[]
  classSessions: ClassSession[]
  monday: Date
  onSessionClick: (s: ClassSession) => void
}) {
  const end = useMemo(() => {
    const d = new Date(monday)
    d.setDate(d.getDate() + 7)
    return d
  }, [monday])
  const hours = Array.from({ length: (END_HOUR - START_HOUR) / 2 + 1 }, (_, i) => START_HOUR + i * 2)

  const week1on1 = sessions
    .map((s) => ({ s, d: new Date(s.scheduledAt) }))
    .filter(({ s, d }) => d >= monday && d < end && s.status !== 'CANCELLED')
  const weekClass = classSessions
    .map((s) => ({ s, d: new Date(s.startAt) }))
    .filter(({ d }) => d >= monday && d < end)

  if (week1on1.length === 0 && weekClass.length === 0) {
    return (
      <div className="border border-dashed border-ga-line bg-ga-card px-10 py-[52px] text-center text-[14px] text-ga-muted">
        Tuần này chưa có buổi học nào. Bấm <b>Thêm buổi</b> hoặc <b>Lịch cố định</b> để thêm buổi lớp.
      </div>
    )
  }

  return (
    <div className="overflow-hidden border border-ga-line bg-ga-card">
      <div className="grid" style={{ gridTemplateColumns: '56px repeat(7,1fr)' }}>
        <div className="border-b border-r border-ga-line" />
        {DAYS.map((d, i) => {
          const date = new Date(monday)
          date.setDate(date.getDate() + i)
          const weekend = i >= 5
          return (
            <div key={d} className={`border-b border-ga-line py-3 text-center ${i < 6 ? 'border-r' : ''}`}>
              <div className="ga-ui text-[12px] font-bold tracking-[0.08em]" style={{ color: weekend ? 'var(--ga-muted)' : 'var(--ga-ink)' }}>
                {d}
              </div>
              <div className="ga-ui mt-1 text-[11px] text-ga-subtle">{fmtDate(date)}</div>
            </div>
          )
        })}
      </div>
      <div className="relative grid" style={{ gridTemplateColumns: '56px repeat(7,1fr)', height: GRID_H }}>
        <div className="border-r border-ga-line">
          {hours.map((h) => (
            <div key={h} className="ga-ui px-2 py-1 text-right text-[11px] text-ga-muted" style={{ height: GRID_H / hours.length }}>
              {h}:00
            </div>
          ))}
        </div>
        {DAYS.map((d, di) => (
          <div key={d} className={`relative ${di < 6 ? 'border-r border-ga-line' : ''}`} style={{ background: di >= 5 ? 'var(--ga-bg)' : undefined }}>
            {Array.from({ length: hours.length - 1 }).map((_, r) => (
              <div key={r} className="absolute inset-x-0 border-t border-ga-line opacity-50" style={{ top: (GRID_H / hours.length) * (r + 1) }} />
            ))}

            {week1on1
              .filter(({ d: dt }) => (dt.getDay() + 6) % 7 === di)
              .map(({ s, d: dt }) => {
                const c = statusOf(s.status)
                return (
                  <div
                    key={`s${s.id}`}
                    title={`${s.studentName} · ${s.title} · ${fmtTime(dt)}`}
                    className="absolute overflow-hidden px-1.5 py-1"
                    style={{
                      top: blockTop(dt),
                      left: 4,
                      right: 4,
                      height: blockHeight(s.durationMinutes),
                      background: c.bg,
                      border: `1px solid color-mix(in srgb, ${c.fg} 35%, transparent)`,
                      borderLeft: `3px solid ${c.fg}`,
                    }}
                  >
                    <div className="truncate text-[11px] font-bold leading-tight text-ga-ink">{s.studentName}</div>
                    <div className="truncate text-[10px] text-ga-muted">{s.title}</div>
                  </div>
                )
              })}

            {weekClass
              .filter(({ d: dt }) => (dt.getDay() + 6) % 7 === di)
              .map(({ s, d: dt }) => {
                const c = CLASS_STATUS[s.status]
                const place = s.mode === 'ONLINE' ? MODE_LABEL.ONLINE : s.room ?? 'Tại lớp'
                return (
                  <button
                    key={`c${s.id}`}
                    type="button"
                    onClick={() => onSessionClick(s)}
                    title={`${s.className} · ${place} · ${fmtTime(dt)} · ${s.studentCount} HV`}
                    className="absolute overflow-hidden px-1.5 py-1 text-left transition-shadow hover:shadow-ga-panel"
                    style={{
                      top: blockTop(dt),
                      left: 4,
                      right: 4,
                      height: blockHeight(s.durationMinutes),
                      background: c.bg,
                      border: `1px solid color-mix(in srgb, ${c.fg} 35%, transparent)`,
                      borderLeft: `3px solid ${c.fg}`,
                    }}
                  >
                    <div
                      className="truncate text-[11px] font-bold leading-tight text-ga-ink"
                      style={{ textDecoration: s.status === 'CANCELLED' ? 'line-through' : undefined }}
                    >
                      {s.className}
                    </div>
                    <div className="flex items-center gap-1 truncate text-[10px]" style={{ color: c.fg }}>
                      <Users size={9} /> {s.studentCount} · {place}
                    </div>
                  </button>
                )
              })}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Tab "Khung giờ rảnh": lưới recurring availability ────────────────────────
// 0 = Monday … 6 = Sunday (matches the backend `day` field).
const AV_HOURS = Array.from({ length: 16 }, (_, i) => i + 6) // 06:00 … 21:00
const avKey = (day: number, hour: number) => `${day}:${hour}`

function expand(slots: AvailabilitySlot[]): Set<string> {
  const cells = new Set<string>()
  for (const slot of slots) {
    const startHour = parseInt(slot.start.slice(0, 2), 10)
    const endMinute = parseInt(slot.end.slice(3, 5), 10)
    const endHour = parseInt(slot.end.slice(0, 2), 10) + (endMinute > 0 ? 1 : 0)
    for (let h = startHour; h < endHour; h++) {
      if (h >= AV_HOURS[0] && h <= AV_HOURS[AV_HOURS.length - 1]) cells.add(avKey(slot.day, h))
    }
  }
  return cells
}

function coalesce(cells: Set<string>): AvailabilitySlot[] {
  const slots: AvailabilitySlot[] = []
  for (let day = 0; day < 7; day++) {
    const hours = AV_HOURS.filter((h) => cells.has(avKey(day, h))).sort((a, b) => a - b)
    let i = 0
    while (i < hours.length) {
      const start = hours[i]
      let end = start
      while (i + 1 < hours.length && hours[i + 1] === end + 1) end = hours[++i]
      slots.push({ day, start: `${pad2(start)}:00`, end: `${pad2(end + 1)}:00` })
      i++
    }
  }
  return slots
}

const sameSet = (a: Set<string>, b: Set<string>) => a.size === b.size && Array.from(a).every((k) => b.has(k))

function AvailabilityView() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [baseline, setBaseline] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const cells = expand(await getAvailability())
      setSelected(cells)
      setBaseline(cells)
    } catch (e: unknown) {
      setError(true)
      toast.error(apiMessage(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const dirty = useMemo(() => !sameSet(selected, baseline), [selected, baseline])
  const blockCount = selected.size

  const toggle = (day: number, hour: number) =>
    setSelected((prev) => {
      const next = new Set(prev)
      const k = avKey(day, hour)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })

  const save = async () => {
    setSaving(true)
    try {
      const stored = await putAvailability(coalesce(selected))
      const cells = expand(stored)
      setSelected(cells)
      setBaseline(cells)
      toast.success('Đã lưu khung giờ rảnh')
    } catch (e: unknown) {
      toast.error(apiMessage(e))
    } finally {
      setSaving(false)
    }
  }

  if (error) {
    return (
      <div className="border border-dashed border-ga-line px-10 py-[52px] text-center">
        <div className="font-ga-display text-[20px] italic text-ga-muted">Không tải được khung giờ rảnh</div>
        <p className="ga-ui mx-auto mb-4 mt-2 max-w-sm text-[13.5px] text-ga-subtle">Có lỗi khi tải khung giờ. Thử lại nhé.</p>
        <GaBtn variant="ghost" onClick={() => void load()}>
          Thử lại
        </GaBtn>
      </div>
    )
  }

  return (
    <div className="border border-ga-line bg-ga-card px-8 py-7">
      <div className="mb-[18px] flex items-center justify-between gap-4">
        <div>
          <GaCap>Chọn khung giờ rảnh trong tuần</GaCap>
          <p className="mt-1 text-[12.5px] text-ga-subtle">Học viên đặt buổi 1:1 trong các khung này. Lịch lặp lại mỗi tuần.</p>
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          <span className="text-[13px] text-ga-muted">{loading ? 'Đang tải…' : `${blockCount} khung giờ`}</span>
          <GaBtn variant="ghost" disabled={loading || saving || blockCount === 0} onClick={() => setSelected(new Set())}>
            Xoá hết
          </GaBtn>
          <GaBtn variant="yellow" disabled={loading || saving || !dirty} onClick={save}>
            {saving ? 'Đang lưu…' : 'Lưu lịch'}
          </GaBtn>
        </div>
      </div>

      <div
        aria-hidden={loading}
        className={loading ? 'pointer-events-none opacity-40' : ''}
        style={{ display: 'grid', gridTemplateColumns: '64px repeat(7, minmax(0, 1fr))', gap: '4px' }}
      >
        <div />
        {DAYS.map((d) => (
          <div key={d} className="pb-1 text-center text-[11.5px] font-bold text-ga-ink">
            {d}
          </div>
        ))}

        {AV_HOURS.map((h) => (
          <div key={h} className="contents">
            <div className="flex items-center justify-end pr-2 text-[11px] font-semibold text-ga-muted">{pad2(h)}:00</div>
            {DAYS.map((_, day) => {
              const on = selected.has(avKey(day, h))
              return (
                <button
                  key={avKey(day, h)}
                  type="button"
                  aria-pressed={on}
                  aria-label={`${DAYS[day]} ${pad2(h)}:00`}
                  onClick={() => toggle(day, h)}
                  className="h-[34px] rounded-ga border text-[12px] font-bold transition-colors"
                  style={{
                    borderColor: on ? VIOLET : 'var(--ga-line)',
                    background: on ? 'var(--ga-violet-soft)' : 'transparent',
                    color: on ? VIOLET : 'var(--ga-faint)',
                  }}
                >
                  {on ? '✓' : ''}
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
