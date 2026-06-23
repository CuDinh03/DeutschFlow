'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Users } from 'lucide-react'
import api, { apiMessage } from '@/lib/api'
import { fmtLocalIso, type ClassSession } from '@/lib/classScheduleApi'
import { GaPageHdr, GaBtn, GaCap } from '@/components/ui-v2'

// ─────────────────────────────────────────────────────────────────────────────
// Lịch trung tâm (G-3) — OWNER/MANAGER xem lịch buổi lớp TOÀN tổ chức (chỉ-đọc).
// GET /api/org/schedule/week (org-scoped; assertOrgAdmin). Không sửa được ở đây —
// chỉnh buổi/lịch cố định vẫn là đặc quyền giáo viên (mục "Lịch dạy" của GV).
// ─────────────────────────────────────────────────────────────────────────────

const DAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']
const pad2 = (n: number) => String(n).padStart(2, '0')
const fmtDate = (d: Date) => `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`
const fmtTime = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`

const STATUS: Record<ClassSession['status'], { label: string; fg: string; bg: string }> = {
  SCHEDULED: { label: 'Đã lên lịch', fg: 'var(--ga-teal)', bg: 'var(--ga-teal-soft)' },
  CANCELLED: { label: 'Đã huỷ', fg: 'var(--ga-red)', bg: 'var(--ga-red-soft)' },
  MOVED: { label: 'Đã dời', fg: 'var(--ga-orange)', bg: 'var(--ga-orange-soft)' },
}
const MODE_LABEL: Record<ClassSession['mode'], string> = { ONLINE: 'Online', OFFLINE: 'Tại lớp' }

/** Monday 00:00 of the week `offset` weeks from this week (offset 0 = this week). */
function mondayOf(offset: number): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  const dow = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - dow + offset * 7)
  return d
}

async function getOrgScheduleWeek(fromISO: string, toISO: string): Promise<ClassSession[]> {
  const res = await api.get<ClassSession[]>('/org/schedule/week', { params: { from: fromISO, to: toISO } })
  return res.data
}

export default function V2OrgSchedulePage() {
  const [sessions, setSessions] = useState<ClassSession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [weekOffset, setWeekOffset] = useState(0)

  const monday = useMemo(() => mondayOf(weekOffset), [weekOffset])
  const weekEnd = useMemo(() => {
    const d = new Date(monday)
    d.setDate(d.getDate() + 6)
    return d
  }, [monday])

  const load = useCallback(async (mon: Date) => {
    setLoading(true)
    try {
      const end = new Date(mon)
      end.setDate(end.getDate() + 7)
      setSessions(await getOrgScheduleWeek(fmtLocalIso(mon), fmtLocalIso(end)))
      setError('')
    } catch (e: unknown) {
      setError(apiMessage(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load(monday)
  }, [monday, load])

  const total = sessions.length

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr accent title="Lịch trung tâm" subtitle="Lịch tuần buổi lớp toàn trung tâm · chỉ xem (giáo viên tự chỉnh ở mục Lịch dạy)" />

      <div className="flex-1 overflow-auto px-10 py-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="font-ga-display text-[20px] font-medium text-ga-ink">
              Tuần {fmtDate(monday)}–{fmtDate(weekEnd)}/{weekEnd.getFullYear()}
            </h2>
            {!loading && !error && <GaCap>{total} buổi</GaCap>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
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
        ) : error ? (
          <div className="border border-ga-line bg-ga-card px-10 py-[52px] text-center">
            <h2 className="font-ga-display text-[24px] font-medium text-ga-red">Không tải được lịch trung tâm</h2>
            <p className="ga-ui mx-auto mb-5 mt-3 max-w-sm text-[14px] text-ga-muted">
              {error} <code className="font-mono text-[12px] text-ga-accent">GET /api/org/schedule/week</code>
            </p>
            <GaBtn variant="primary" onClick={() => void load(monday)}>
              Thử lại
            </GaBtn>
          </div>
        ) : (
          <WeekGrid sessions={sessions} monday={monday} />
        )}
      </div>
    </div>
  )
}

// ── Read-only week grid (all org class sessions, teal) ───────────────────────
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

function WeekGrid({ sessions, monday }: { sessions: ClassSession[]; monday: Date }) {
  const end = useMemo(() => {
    const d = new Date(monday)
    d.setDate(d.getDate() + 7)
    return d
  }, [monday])
  const hours = Array.from({ length: (END_HOUR - START_HOUR) / 2 + 1 }, (_, i) => START_HOUR + i * 2)

  const week = sessions
    .map((s) => ({ s, d: new Date(s.startAt) }))
    .filter(({ d }) => d >= monday && d < end)

  if (week.length === 0) {
    return (
      <div className="border border-dashed border-ga-line bg-ga-card px-10 py-[52px] text-center text-[14px] text-ga-muted">
        Tuần này chưa có buổi lớp nào trong trung tâm.
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

            {week
              .filter(({ d: dt }) => (dt.getDay() + 6) % 7 === di)
              .map(({ s, d: dt }) => {
                const c = STATUS[s.status]
                const place = s.mode === 'ONLINE' ? MODE_LABEL.ONLINE : s.room ?? 'Tại lớp'
                return (
                  <div
                    key={s.id}
                    title={`${s.className} · ${place} · ${fmtTime(dt)} · ${s.studentCount} HV`}
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
                    <div
                      className="truncate text-[11px] font-bold leading-tight text-ga-ink"
                      style={{ textDecoration: s.status === 'CANCELLED' ? 'line-through' : undefined }}
                    >
                      {s.className}
                    </div>
                    <div className="flex items-center gap-1 truncate text-[10px]" style={{ color: c.fg }}>
                      <Users size={9} /> {s.studentCount} · {place}
                    </div>
                  </div>
                )
              })}
          </div>
        ))}
      </div>
    </div>
  )
}
