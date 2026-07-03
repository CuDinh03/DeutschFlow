'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { notFound } from 'next/navigation'
import { BadgeCheck, Clock, CalendarClock } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import api, { apiMessage } from '@/lib/api'
import { GaPageHdr, GaBtn, GaCap } from '@/components/ui-v2'
import { MARKETPLACE_ENABLED } from '@/lib/features'

// ─────────────────────────────────────────────────────────────────────────────
// Gia sư 1:1 — đặt lịch (GaBookSession, proto-learn.jsx) — student↔teacher, yellow.
// Plumbing reused 1:1 (zero backend): GET /v2/teachers/public (tutor list) +
// POST /api/teacher-sessions (book) + GET /api/teacher-sessions/my (my bookings).
// Option-1: TeacherProfileDto exposes no rating/price → those proto fields dropped;
// there is NO availability endpoint (the deferred teacher-schedule backlog) → the
// proto's fixed slot grid is replaced with a datetime + duration picker (backend
// accepts any scheduledAt + 30–120 min). "Chờ gia sư xác nhận" is the real flow.
// ─────────────────────────────────────────────────────────────────────────────

interface TeacherProfile { id: number; userId: number; name: string; headline: string | null; bio: string | null; featured: boolean }
interface MySession { id: number; title: string; scheduledAt: string; durationMinutes: number; status: string }

const DURATIONS = [30, 45, 60, 90, 120]
const initial = (n: string) => ((n ?? '?').trim()[0] ?? '?').toUpperCase()
const fmtWhen = (d: string) => format(new Date(d), 'HH:mm · dd/MM/yyyy')
const SESSION_STATUS: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Chờ xác nhận', color: 'var(--ga-orange)' },
  CONFIRMED: { label: 'Đã xác nhận', color: '#2F6FC9' },
  COMPLETED: { label: 'Hoàn thành', color: 'var(--ga-green)' },
  CANCELLED: { label: 'Đã huỷ', color: 'var(--ga-muted)' },
}

export default function V2BookSessionPage() {
  const [tutors, setTutors] = useState<TeacherProfile[]>([])
  const [mySessions, setMySessions] = useState<MySession[]>([])
  const [selId, setSelId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [duration, setDuration] = useState(60)
  const [notes, setNotes] = useState('')
  const [booking, setBooking] = useState(false)

  const loadMine = useCallback(async () => {
    try {
      const res = await api.get('/teacher-sessions/my?page=0')
      setMySessions((res.data?.content ?? []) as MySession[])
    } catch { /* my-sessions is best-effort */ }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/v2/teachers/public?size=100')
      const list = (res.data?.content ?? []) as TeacherProfile[]
      setTutors(list)
      setSelId((prev) => prev ?? list[0]?.id ?? null)
      setError('')
      await loadMine()
    } catch (e: unknown) {
      setError(apiMessage(e))
    } finally {
      setLoading(false)
    }
  }, [loadMine])

  useEffect(() => { void load() }, [load])

  const sel = useMemo(() => tutors.find((t) => t.id === selId) ?? null, [tutors, selId])

  const book = async () => {
    if (!sel) { toast('Chọn một gia sư'); return }
    if (!date || !time) { toast('Chọn ngày và giờ học'); return }
    setBooking(true)
    try {
      await api.post('/teacher-sessions', {
        teacherProfileId: sel.id,
        title: `Buổi học 1:1 với ${sel.name}`,
        notes: notes.trim() || null,
        scheduledAt: `${date}T${time}`,
        durationMinutes: duration,
      })
      toast.success(`Đã gửi yêu cầu đặt lịch với ${sel.name} — chờ gia sư xác nhận`)
      setNotes('')
      await loadMine()
    } catch (e: unknown) {
      toast.error(apiMessage(e))
    } finally {
      setBooking(false)
    }
  }

  // C2C marketplace hidden for v1.0 — block direct-URL access (nav entry is also gated).
  if (!MARKETPLACE_ENABLED) notFound()

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr accent title="Gia sư 1:1" subtitle="Đặt lịch học trực tiếp với giáo viên" />

      <div className="flex-1 overflow-auto px-10 py-7">
        {loading ? (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]"><div className="ga-shimmer h-[300px] border border-ga-line" aria-hidden /><div className="ga-shimmer h-[300px] border border-ga-line" aria-hidden /></div>
        ) : error ? (
          <div className="border border-ga-line bg-ga-card px-10 py-[52px] text-center">
            <h2 className="font-ga-display text-[24px] font-medium text-ga-red">Không tải được danh sách gia sư</h2>
            <p className="ga-ui mx-auto mb-5 mt-3 max-w-sm text-[14px] text-ga-muted">{error}</p>
            <GaBtn variant="primary" onClick={load}>Thử lại</GaBtn>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[1fr_360px]">
              {/* Tutor list */}
              <div>
                <GaCap className="mb-4 block">Chọn gia sư ({tutors.length})</GaCap>
                {tutors.length === 0 ? (
                  <div className="border border-dashed border-ga-line px-10 py-[40px] text-center text-[14px] text-ga-muted">Hiện chưa có gia sư nào trên hệ thống.</div>
                ) : (
                  <div className="flex flex-col gap-3.5">
                    {tutors.map((tu) => {
                      const on = selId === tu.id
                      return (
                        <button
                          key={tu.id}
                          type="button"
                          onClick={() => setSelId(tu.id)}
                          className="flex items-center gap-4 p-4 text-left transition-colors"
                          style={{ background: on ? 'var(--ga-side-active)' : 'var(--ga-card)', border: `1px solid ${on ? 'var(--ga-yellow)' : 'var(--ga-line)'}` }}
                        >
                          <span className="grid h-[54px] w-[54px] shrink-0 place-items-center rounded-full font-ga-display text-[22px] font-semibold" style={{ color: 'var(--ga-ink)', background: 'var(--ga-yellow-soft)' }}>{initial(tu.name)}</span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 text-[15.5px] font-bold text-ga-ink">
                              {tu.name}
                              {tu.featured && <BadgeCheck size={15} style={{ color: 'var(--ga-green)' }} aria-label="Đã xác thực" />}
                            </div>
                            <div className="mt-1 truncate text-[13px] text-ga-muted">{tu.headline || 'Giáo viên tiếng Đức'}</div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Booking panel */}
              <div className="border border-ga-line bg-ga-card p-[26px]">
                <GaCap className="mb-3.5 block">Đặt lịch {sel ? `· ${sel.name}` : ''}</GaCap>
                <label className="ga-ui mb-1.5 block text-[12.5px] font-semibold text-ga-muted">Ngày học</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="ga-ui mb-3.5 w-full border border-ga-line bg-ga-bg px-3.5 py-2.5 text-[14px] text-ga-ink outline-none focus:border-ga-ink" />
                <label className="ga-ui mb-1.5 block text-[12.5px] font-semibold text-ga-muted">Giờ học</label>
                <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="ga-ui mb-3.5 w-full border border-ga-line bg-ga-bg px-3.5 py-2.5 text-[14px] text-ga-ink outline-none focus:border-ga-ink" />
                <label className="ga-ui mb-1.5 block text-[12.5px] font-semibold text-ga-muted">Thời lượng</label>
                <div className="mb-3.5 flex flex-wrap gap-2">
                  {DURATIONS.map((d) => (
                    <button key={d} type="button" onClick={() => setDuration(d)} className="ga-ui px-3 py-1.5 text-[13px] font-semibold" style={{ background: duration === d ? 'var(--ga-ink)' : 'transparent', color: duration === d ? 'var(--ga-bg)' : 'var(--ga-ink)', border: `1px solid ${duration === d ? 'var(--ga-ink)' : 'var(--ga-line)'}` }}>{d}&apos;</button>
                  ))}
                </div>
                <label className="ga-ui mb-1.5 block text-[12.5px] font-semibold text-ga-muted">Ghi chú cho gia sư (tuỳ chọn)</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="VD: muốn luyện phỏng vấn ngành điều dưỡng…" className="ga-ui mb-4 w-full resize-y border border-ga-line bg-ga-bg px-3.5 py-2.5 text-[14px] text-ga-ink outline-none focus:border-ga-ink" />
                <div className="mb-4 flex items-center justify-between border border-ga-line bg-ga-bg px-4 py-3 text-[14px]">
                  <span className="flex items-center gap-1.5 text-ga-muted"><Clock size={14} /> Thời gian</span>
                  <span className="font-semibold text-ga-ink">{date && time ? `${time} · ${format(new Date(`${date}T${time}`), 'dd/MM')} · ${duration}'` : '—'}</span>
                </div>
                <GaBtn variant="yellow" className="w-full" loading={booking} disabled={booking || !sel || !date || !time} onClick={book}>Xác nhận đặt lịch</GaBtn>
              </div>
            </div>

            {/* My booked sessions */}
            <GaCap className="mb-3.5 mt-9 block">Buổi đã đặt ({mySessions.length})</GaCap>
            {mySessions.length === 0 ? (
              <div className="border border-dashed border-ga-line px-10 py-[36px] text-center text-[14px] text-ga-muted">Bạn chưa đặt buổi học 1:1 nào.</div>
            ) : (
              <div className="border border-ga-line bg-ga-card">
                {mySessions.map((s, i) => {
                  const sm = SESSION_STATUS[(s.status ?? '').toUpperCase()] ?? { label: s.status, color: 'var(--ga-muted)' }
                  return (
                    <div key={s.id} className="flex items-center gap-3.5 px-5 py-3.5" style={{ borderTop: i ? '1px solid var(--ga-line)' : 'none' }}>
                      <span className="grid h-9 w-9 shrink-0 place-items-center" style={{ background: 'var(--ga-side-active)' }}><CalendarClock size={16} className="text-ga-muted" /></span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[14px] font-semibold text-ga-ink">{s.title}</div>
                        <div className="text-[12.5px] text-ga-muted">{fmtWhen(s.scheduledAt)} · {s.durationMinutes}&apos;</div>
                      </div>
                      <span className="shrink-0 px-2.5 py-1 text-[11.5px] font-bold" style={{ color: sm.color, background: 'var(--ga-side-active)' }}>{sm.label}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
