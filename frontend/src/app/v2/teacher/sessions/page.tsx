'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Clock, Check, X, Star } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import api, { apiMessage } from '@/lib/api'
import { GaPageHdr, GaBtn, GaCap, TkSeg, TkStatStrip, type TkSegOption } from '@/components/ui-v2'
import { AvailabilityPanel } from './availabilityPanel'

// ─────────────────────────────────────────────────────────────────────────────
// Buổi học 1:1 (GaSessions) — violet. Week-calendar + list. Plumbing reused 1:1
// (zero backend): profileId resolved via GET /auth/me + /v2/teachers/public, then
//   GET /teacher-sessions/teacher?profileId  → Page<TeacherSessionDto>
//   GET /teacher-sessions/earnings?profileId  → { totalEarningsVnd, platformFeeVnd, netEarningsVnd }
//   PATCH /teacher-sessions/{id}/status { status }  (CONFIRMED | COMPLETED | CANCELLED)
// Option-1: the proto's "Nhận đặt lịch" toggle has no backend field → DROPPED.
// Week grid is built from the REAL scheduledAt + durationMinutes (current week only;
// list view shows every session).
// ─────────────────────────────────────────────────────────────────────────────

const VIOLET = '#7C56C8'

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
interface Earnings { totalEarningsVnd: number; platformFeeVnd: number; netEarningsVnd: number }

type View = 'week' | 'list' | 'availability'
const VIEWS: TkSegOption<View>[] = [
  { value: 'week', label: 'Lịch tuần' },
  { value: 'list', label: 'Danh sách' },
  { value: 'availability', label: 'Khung giờ rảnh' },
]

const STATUS: Record<string, { label: string; fg: string; bg: string }> = {
  PENDING: { label: 'Chờ xác nhận', fg: 'var(--ga-orange)', bg: 'var(--ga-orange-soft)' },
  CONFIRMED: { label: 'Đã xác nhận', fg: 'var(--ga-violet)', bg: 'var(--ga-violet-soft)' },
  COMPLETED: { label: 'Hoàn thành', fg: 'var(--ga-green)', bg: 'var(--ga-green-soft)' },
  CANCELLED: { label: 'Đã huỷ', fg: 'var(--ga-red)', bg: 'var(--ga-red-soft)' },
}
const statusOf = (s: string) => STATUS[s] ?? { label: s, fg: 'var(--ga-muted)', bg: 'var(--ga-side-active)' }

const DAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']
const START_HOUR = 7
const END_HOUR = 22
const GRID_H = 560
const initial = (n: string) => (n.trim()[0] ?? '?').toUpperCase()
const compactVnd = (v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k₫` : `${v}₫`)
const fullVnd = (v: number) => `${v.toLocaleString('vi-VN')} ₫`

// Monday 00:00 of the current week (local time).
function weekStart(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  const dow = (d.getDay() + 6) % 7 // Mon=0 … Sun=6
  d.setDate(d.getDate() - dow)
  return d
}

export default function V2TeacherSessionsPage() {
  const [profileId, setProfileId] = useState<number | null>(null)
  const [noProfile, setNoProfile] = useState(false)
  const [isOrgTeacher, setIsOrgTeacher] = useState(false)
  const [sessions, setSessions] = useState<Session[]>([])
  const [earnings, setEarnings] = useState<Earnings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [view, setView] = useState<View>('week')
  const [busy, setBusy] = useState<number | null>(null)

  // Resolve the teacher's public-profile id (sessions are keyed by profileId).
  const resolveProfile = useCallback(async () => {
    try {
      const me = await api.get('/auth/me')
      setIsOrgTeacher(me.data?.orgId != null)
      const uid = Number(me.data?.userId ?? me.data?.id)
      const pub = await api.get('/v2/teachers/public?size=100')
      const list = (pub.data?.content ?? []) as { id: number; userId: number }[]
      const mine = list.find((p) => Number(p.userId) === uid)
      if (mine) setProfileId(mine.id)
      else { setNoProfile(true); setLoading(false) }
    } catch (e: unknown) {
      setError(apiMessage(e)); setLoading(false)
    }
  }, [])

  const load = useCallback(async (pid: number) => {
    setLoading(true)
    try {
      const [sess, earn] = await Promise.all([
        api.get(`/teacher-sessions/teacher?profileId=${pid}`),
        api.get(`/teacher-sessions/earnings?profileId=${pid}`).catch(() => ({ data: null })),
      ])
      setSessions((sess.data?.content ?? []) as Session[])
      setEarnings((earn.data as Earnings | null) ?? null)
      setError('')
    } catch (e: unknown) {
      setError(apiMessage(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void resolveProfile() }, [resolveProfile])
  useEffect(() => { if (profileId) void load(profileId) }, [profileId, load])

  const updateStatus = async (id: number, status: string) => {
    setBusy(id)
    try {
      await api.patch(`/teacher-sessions/${id}/status`, { status })
      toast.success(status === 'CONFIRMED' ? 'Đã xác nhận buổi học' : status === 'CANCELLED' ? 'Đã từ chối' : 'Đã đánh dấu hoàn thành')
      if (profileId) await load(profileId)
    } catch (e: unknown) {
      toast.error(apiMessage(e))
    } finally {
      setBusy(null)
    }
  }

  const pending = useMemo(() => sessions.filter((s) => s.status === 'PENDING'), [sessions])
  const completed = useMemo(() => sessions.filter((s) => s.status === 'COMPLETED'), [sessions])
  const rated = useMemo(() => sessions.filter((s) => s.teacherRating != null), [sessions])
  const avgRating = rated.length ? rated.reduce((a, s) => a + (s.teacherRating ?? 0), 0) / rated.length : 0
  const completedHours = completed.reduce((a, s) => a + s.durationMinutes, 0) / 60

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <GaPageHdr
        accent
        title="Buổi học 1:1"
        subtitle="Lịch dạy kèm do học viên đặt · xác nhận và vào lớp"
        right={<TkSeg options={VIEWS} value={view} onValueChange={setView} aria-label="Chế độ xem" />}
      />

      <div className="flex-1 overflow-auto px-4 py-5 sm:px-6 lg:px-10 lg:py-6">
        {error ? (
          <div className="border border-ga-line bg-ga-card px-4 py-10 text-center sm:px-6 lg:px-10 lg:py-[52px]">
            <h2 className="font-ga-display text-[24px] font-medium text-ga-red">Không tải được lịch dạy</h2>
            <p className="ga-ui mx-auto mb-5 mt-3 max-w-sm text-[14px] text-ga-muted">
              {error} <code className="font-mono text-[12px] text-ga-accent">{`GET /api/teacher-sessions/teacher`}</code>
            </p>
            <GaBtn variant="primary" onClick={() => (profileId ? load(profileId) : resolveProfile())}>Thử lại</GaBtn>
          </div>
        ) : noProfile ? (
          isOrgTeacher ? (
            <div className="border border-dashed border-ga-line bg-ga-card px-4 py-10 text-center sm:px-6 lg:px-10 lg:py-[52px]">
              <h2 className="font-ga-display text-[20px] font-medium text-ga-ink lg:text-[22px]">Lớp của bạn ở mục “Lịch dạy”</h2>
              <p className="ga-ui mx-auto mt-2 max-w-md text-[14px] text-ga-muted">
                Bạn là giáo viên thuộc trung tâm — buổi 1:1 chỉ dành cho giáo viên tự do trên marketplace. Lịch buổi lớp
                của bạn nằm ở mục{' '}
                <Link href="/v2/teacher/schedule" className="font-semibold text-ga-accent hover:underline">
                  Lịch dạy
                </Link>
                .
              </p>
            </div>
          ) : (
            <div className="border border-dashed border-ga-line bg-ga-card px-4 py-10 text-center sm:px-6 lg:px-10 lg:py-[52px]">
              <h2 className="font-ga-display text-[20px] font-medium text-ga-ink lg:text-[22px]">Chưa có hồ sơ giáo viên công khai</h2>
              <p className="ga-ui mx-auto mt-2 max-w-md text-[14px] text-ga-muted">
                Buổi học 1:1 cần một hồ sơ công khai để học viên đặt lịch. Tạo hồ sơ trong mục Hồ sơ giáo viên trước.
              </p>
            </div>
          )
        ) : view === 'availability' ? (
          <AvailabilityPanel />
        ) : (
          <>
            <TkStatStrip
              items={[
                { label: 'Chờ xác nhận', value: pending.length, sub: 'cần phản hồi', color: '#E07B39', alert: pending.length > 0 },
                { label: 'Đã hoàn thành', value: completed.length, sub: `${completedHours.toFixed(1)} giờ dạy`, color: '#2F6FC9' },
                { label: 'Đánh giá TB', value: avgRating ? `${avgRating.toFixed(1)}★` : '—', sub: `${rated.length} lượt`, color: '#1E9E61' },
                { label: 'Thu nhập ròng', value: earnings ? compactVnd(earnings.netEarningsVnd) : '—', sub: 'sau phí nền tảng', color: VIOLET },
              ]}
            />

            <div className="mt-[26px]">
              {loading ? (
                <div className="ga-shimmer h-[420px] border border-ga-line" aria-hidden />
              ) : view === 'week' ? (
                <WeekGrid sessions={sessions} />
              ) : (
                <SessionList sessions={sessions} busy={busy} onUpdate={updateStatus} />
              )}
            </div>

            {pending.length > 0 && !loading && (
              <div className="mt-6 flex flex-wrap items-center gap-3 border px-4 py-4 lg:flex-nowrap lg:gap-3.5 lg:px-[22px]" style={{ borderColor: 'color-mix(in srgb, var(--ga-orange) 35%, transparent)', background: 'var(--ga-orange-soft)' }}>
                <span className="h-2 w-2 shrink-0" style={{ background: 'var(--ga-orange)' }} />
                <span className="min-w-0 flex-1 basis-[180px] text-[14px] text-ga-ink lg:basis-0">
                  <strong>{pending.length} buổi</strong> đang chờ bạn xác nhận — phản hồi sớm để giữ slot cho học viên.
                </span>
                <GaBtn variant="ghost" size="sm" onClick={() => pending.forEach((s) => updateStatus(s.id, 'CONFIRMED'))}>
                  Xác nhận tất cả
                </GaBtn>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ── Week calendar (real scheduledAt + duration; current week only) ───────────
function WeekGrid({ sessions }: { sessions: Session[] }) {
  const monday = weekStart()
  const end = new Date(monday); end.setDate(end.getDate() + 7)
  const hours = Array.from({ length: (END_HOUR - START_HOUR) / 2 + 1 }, (_, i) => START_HOUR + i * 2)

  const thisWeek = sessions
    .map((s) => ({ s, d: new Date(s.scheduledAt) }))
    .filter(({ s, d }) => d >= monday && d < end && s.status !== 'CANCELLED')

  return (
    <div className="overflow-x-auto border border-ga-line bg-ga-card lg:overflow-hidden">
      <div className="grid min-w-[620px] lg:min-w-0" style={{ gridTemplateColumns: '56px repeat(7,1fr)' }}>
        <div className="border-b border-r border-ga-line" />
        {DAYS.map((d, i) => {
          const date = new Date(monday); date.setDate(date.getDate() + i)
          const weekend = i >= 5
          return (
            <div key={d} className={`border-b border-ga-line py-3 text-center ${i < 6 ? 'border-r' : ''}`}>
              <div className="ga-ui text-[12px] font-bold tracking-[0.08em]" style={{ color: weekend ? 'var(--ga-muted)' : 'var(--ga-ink)' }}>{d}</div>
              <div className="ga-ui mt-1 text-[11px] text-ga-subtle">{String(date.getDate()).padStart(2, '0')}/{String(date.getMonth() + 1).padStart(2, '0')}</div>
            </div>
          )
        })}
      </div>
      <div className="relative grid min-w-[620px] lg:min-w-0" style={{ gridTemplateColumns: '56px repeat(7,1fr)', height: GRID_H }}>
        <div className="border-r border-ga-line">
          {hours.map((h) => (
            <div key={h} className="ga-ui px-2 py-1 text-right text-[11px] text-ga-muted" style={{ height: GRID_H / hours.length }}>{h}:00</div>
          ))}
        </div>
        {DAYS.map((d, di) => (
          <div key={d} className={`relative ${di < 6 ? 'border-r border-ga-line' : ''}`} style={{ background: di >= 5 ? 'var(--ga-bg)' : undefined }}>
            {Array.from({ length: hours.length - 1 }).map((_, r) => (
              <div key={r} className="absolute inset-x-0 border-t border-ga-line opacity-50" style={{ top: (GRID_H / hours.length) * (r + 1) }} />
            ))}
            {thisWeek.filter(({ d: dt }) => (dt.getDay() + 6) % 7 === di).map(({ s, d: dt }) => {
              const hour = dt.getHours() + dt.getMinutes() / 60
              const top = ((hour - START_HOUR) / (END_HOUR - START_HOUR)) * GRID_H
              const h = Math.max(((s.durationMinutes / 60) / (END_HOUR - START_HOUR)) * GRID_H, 38)
              const c = statusOf(s.status)
              return (
                <div
                  key={s.id}
                  title={`${s.studentName} · ${s.title} · ${dt.getHours()}:${String(dt.getMinutes()).padStart(2, '0')}`}
                  className="absolute overflow-hidden px-1.5 py-1"
                  style={{ top, left: 4, right: 4, height: h, background: c.bg, borderLeft: `3px solid ${c.fg}`, border: `1px solid color-mix(in srgb, ${c.fg} 35%, transparent)`, borderLeftWidth: 3 }}
                >
                  <div className="truncate text-[11px] font-bold leading-tight text-ga-ink">{s.studentName}</div>
                  <div className="truncate text-[10px] text-ga-muted">{s.title}</div>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── List view ────────────────────────────────────────────────────────────────
function SessionList({ sessions, busy, onUpdate }: { sessions: Session[]; busy: number | null; onUpdate: (id: number, status: string) => void }) {
  const ordered = [...sessions].sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
  if (ordered.length === 0) {
    return <div className="border border-dashed border-ga-line px-4 py-10 text-center text-[14px] text-ga-muted sm:px-6 lg:px-10 lg:py-[52px]">Chưa có buổi học nào được đặt.</div>
  }
  return (
    <div className="flex flex-col gap-3">
      {ordered.map((s) => {
        const c = statusOf(s.status)
        const d = new Date(s.scheduledAt)
        return (
          <div key={s.id} className="flex flex-wrap items-center gap-3 border border-ga-line bg-ga-card px-4 py-4 lg:flex-nowrap lg:gap-4 lg:px-[22px]">
            <span className="grid h-11 w-11 shrink-0 place-items-center font-ga-display text-[18px] font-medium" style={{ color: VIOLET, background: 'var(--ga-violet-soft)' }}>{initial(s.studentName)}</span>
            <div className="min-w-0 flex-1 basis-[160px] lg:basis-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[15px] font-bold text-ga-ink">{s.studentName}</span>
                <span className="px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.05em]" style={{ color: c.fg, background: c.bg }}>{c.label}</span>
                {s.payoutStatus === 'PROCESSED' && (
                  <span className="px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.05em]" style={{ color: 'var(--ga-green)', background: 'var(--ga-green-soft)' }}>Đã thanh toán</span>
                )}
              </div>
              <div className="mt-1 truncate text-[13px] text-ga-muted">{s.title}</div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-ga-subtle">
                <span className="flex items-center gap-1"><Clock size={11} /> {d.toLocaleDateString('vi-VN')} · {d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
                <span>{s.durationMinutes} phút</span>
                <span className="font-semibold text-ga-ink">{fullVnd(s.priceVnd)}</span>
                {s.teacherRating != null && (
                  <span className="flex items-center gap-0.5" style={{ color: '#E0A23A' }}><Star size={11} fill="currentColor" /> {s.teacherRating}/5</span>
                )}
              </div>
            </div>
            <div className="shrink-0">
              {s.status === 'PENDING' ? (
                <div className="flex flex-wrap gap-2">
                  <GaBtn variant="yellow" size="sm" loading={busy === s.id} onClick={() => onUpdate(s.id, 'CONFIRMED')}><Check size={14} /> Xác nhận</GaBtn>
                  <button
                    type="button"
                    disabled={busy === s.id}
                    onClick={() => onUpdate(s.id, 'CANCELLED')}
                    className="ga-ui inline-flex min-h-[40px] items-center gap-1 border px-3 py-2 text-[12px] font-semibold disabled:opacity-50 lg:min-h-0"
                    style={{ color: 'var(--ga-red)', borderColor: 'color-mix(in srgb, var(--ga-red) 35%, transparent)' }}
                  >
                    <X size={13} /> Từ chối
                  </button>
                </div>
              ) : s.status === 'CONFIRMED' ? (
                <GaBtn variant="ghost" size="sm" loading={busy === s.id} onClick={() => onUpdate(s.id, 'COMPLETED')}>Hoàn thành</GaBtn>
              ) : null}
            </div>
          </div>
        )
      })}
    </div>
  )
}
