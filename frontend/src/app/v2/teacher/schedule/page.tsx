'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { CalendarClock, ChevronLeft, ChevronRight, Clock, Plus, Users } from 'lucide-react'
import { toast } from 'sonner'
import { apiMessage } from '@/lib/api'
import {
  fmtLocalIso,
  getClassWeek,
  getMyClasses,
  type ClassSession,
  type SessionSaveResult,
  type TeacherClassLite,
} from '@/lib/classScheduleApi'
import { assignLanes } from '@/lib/scheduleLayout'
import { GaPageHdr, GaBtn, GaCap } from '@/components/ui-v2'
import { CLASS_STATUS, CreateSessionModal, EditSessionModal, MODE_LABEL, PatternModal } from './scheduleClassParts'

// ─────────────────────────────────────────────────────────────────────────────
// Lịch dạy (v2) — CHỈ buổi lớp tại trung tâm. Buổi 1:1 (marketplace B2C) nằm ở
// mục riêng "Buổi học 1:1" (/v2/teacher/sessions), không trộn vào đây nữa.
//   Lưới tuần buổi lớp thật (GET /v2/teacher/class-schedule/week) + thêm buổi lẻ
//   và đặt lịch cố định (pattern, override sticky, V236).
// Không cần hồ sơ marketplace công khai → giáo viên thuộc trung tâm (org) dùng bình thường.
// ─────────────────────────────────────────────────────────────────────────────

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
  const t = useTranslations('v2.teacher.schedule')
  const tc = useTranslations('v2.common')
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

  const loadClassWeek = useCallback(async (mon: Date) => {
    setLoading(true)
    try {
      const end = new Date(mon)
      end.setDate(end.getDate() + 7)
      setClassSessions(await getClassWeek(fmtLocalIso(mon), fmtLocalIso(end)))
      setError('')
    } catch (e: unknown) {
      setError(apiMessage(e))
    } finally {
      setLoading(false)
    }
  }, [])

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
    return classSessions
      .filter((s) => s.status !== 'CANCELLED' && new Date(s.startAt).getTime() >= now)
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
      .slice(0, 5)
  }, [classSessions])

  const handleSaved = useCallback(
    (r: SessionSaveResult) => {
      r.roomWarnings.forEach((w) => toast.warning(w))
      void loadClassWeek(monday)
    },
    [loadClassWeek, monday],
  )

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <GaPageHdr accent title={t('title')} subtitle={t('subtitle')} />
      <div className="flex-1 overflow-auto px-10 py-7">
        {error ? (
          <div className="border border-ga-line bg-ga-card px-10 py-[52px] text-center">
            <h2 className="font-ga-display text-[24px] font-medium text-ga-red">{t('loadError')}</h2>
            <p className="ga-ui mx-auto mb-5 mt-3 max-w-sm text-[14px] text-ga-muted">
              {error}{' '}
              <code className="font-mono text-[12px] text-ga-accent">GET /api/v2/teacher/class-schedule/week</code>
            </p>
            <GaBtn variant="primary" onClick={() => void loadClassWeek(monday)}>
              {tc('retry')}
            </GaBtn>
          </div>
        ) : (
          <div className="grid gap-6" style={{ gridTemplateColumns: 'minmax(0, 1fr) 300px' }}>
            <div className="min-w-0">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-ga-display text-[20px] font-medium text-ga-ink">
                  {t('week', { range: `${fmtDate(monday)}–${fmtDate(weekEnd)}/${weekEnd.getFullYear()}` })}
                </h2>
                <div className="flex flex-wrap items-center gap-2">
                  <GaBtn variant="ghost" size="sm" onClick={() => setShowCreate(true)}>
                    <Plus size={14} /> {t('addSession')}
                  </GaBtn>
                  <GaBtn variant="ghost" size="sm" onClick={() => setShowPattern(true)}>
                    <CalendarClock size={14} /> {t('fixedSchedule')}
                  </GaBtn>
                  <span className="mx-1 h-5 w-px bg-ga-line" aria-hidden />
                  <GaBtn variant="ghost" size="sm" aria-label={t('prevWeek')} onClick={() => setWeekOffset((w) => w - 1)}>
                    <ChevronLeft size={15} />
                  </GaBtn>
                  <GaBtn variant="ghost" size="sm" disabled={weekOffset === 0} onClick={() => setWeekOffset(0)}>
                    {t('thisWeek')}
                  </GaBtn>
                  <GaBtn variant="ghost" size="sm" aria-label={t('nextWeek')} onClick={() => setWeekOffset((w) => w + 1)}>
                    <ChevronRight size={15} />
                  </GaBtn>
                </div>
              </div>

              {loading ? (
                <div className="ga-shimmer h-[560px] border border-ga-line" aria-hidden />
              ) : (
                <WeekGrid classSessions={classSessions} monday={monday} onSessionClick={setEditTarget} />
              )}
            </div>

            <aside className="min-w-0">
              <GaCap>{t('upcomingCap')}</GaCap>
              <div className="mt-3 flex flex-col gap-2.5">
                {loading ? (
                  <div className="ga-shimmer h-[120px] border border-ga-line" aria-hidden />
                ) : upcoming.length === 0 ? (
                  <div className="border border-dashed border-ga-line px-4 py-6 text-center text-[13px] text-ga-muted">
                    {t('noUpcoming')}
                  </div>
                ) : (
                  upcoming.map((s) => {
                    const d = new Date(s.startAt)
                    const c = CLASS_STATUS[s.status]
                    const place = s.mode === 'ONLINE' ? MODE_LABEL.ONLINE : s.room ?? t('atClass')
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setEditTarget(s)}
                        className="border border-ga-line bg-ga-card px-3.5 py-3 text-left transition-shadow hover:shadow-ga-panel"
                        style={{ borderLeft: `3px solid ${c.fg}` }}
                      >
                        <div className="flex items-center gap-1.5 text-[12px] text-ga-muted">
                          <Clock size={11} /> {fmtDate(d)} · {fmtTime(d)}
                        </div>
                        <div className="mt-1 truncate text-[13.5px] font-bold text-ga-ink">{s.className}</div>
                        <div className="mt-0.5 flex items-center gap-1 truncate text-[12px] text-ga-subtle">
                          <Users size={11} /> {s.studentCount} · {place}
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            </aside>
          </div>
        )}
      </div>

      <EditSessionModal session={editTarget} onClose={() => setEditTarget(null)} onSaved={handleSaved} />
      <CreateSessionModal open={showCreate} classes={classes} onClose={() => setShowCreate(false)} onSaved={handleSaved} />
      <PatternModal open={showPattern} classes={classes} onClose={() => setShowPattern(false)} onSaved={() => void loadClassWeek(monday)} />
    </div>
  )
}

// ── Lịch tuần: chỉ buổi lớp (teal, bấm để sửa) ───────────────────────────────
// Cửa sổ 7:00–23:00 phủ cả lớp tối (VD 21:00 + 90′ = 22:30) mà không cắt đáy.
const START_HOUR = 7
const END_HOUR = 23
const GRID_H = 560
const MIN_BLOCK_H = 38

/** Phút trong ngày (0–1439) của một buổi — mốc để chia làn buổi trùng giờ. */
function startMinuteOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes()
}

function blockTop(date: Date): number {
  const hour = date.getHours() + date.getMinutes() / 60
  // Kẹp ≥ 0 để buổi trước 7:00 (hiếm) không tràn lên trên khỏi lưới.
  return Math.max(0, ((hour - START_HOUR) / (END_HOUR - START_HOUR)) * GRID_H)
}
function blockHeight(durationMinutes: number): number {
  return Math.max(((durationMinutes / 60) / (END_HOUR - START_HOUR)) * GRID_H, MIN_BLOCK_H)
}

function WeekGrid({
  classSessions,
  monday,
  onSessionClick,
}: {
  classSessions: ClassSession[]
  monday: Date
  onSessionClick: (s: ClassSession) => void
}) {
  const t = useTranslations('v2.teacher.schedule')
  const end = useMemo(() => {
    const d = new Date(monday)
    d.setDate(d.getDate() + 7)
    return d
  }, [monday])
  const hours = Array.from({ length: (END_HOUR - START_HOUR) / 2 + 1 }, (_, i) => START_HOUR + i * 2)

  const weekClass = classSessions
    .map((s) => ({ s, d: new Date(s.startAt) }))
    .filter(({ d }) => d >= monday && d < end)

  if (weekClass.length === 0) {
    return (
      <div className="border border-dashed border-ga-line bg-ga-card px-10 py-[52px] text-center text-[14px] text-ga-muted">
        {t('emptyWeekPrefix')} <b>{t('addSession')}</b> {t('emptyWeekMid')} <b>{t('fixedSchedule')}</b> {t('emptyWeekSuffix')}
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
        {DAYS.map((d, di) => {
          // Buổi trùng giờ trong cùng ngày phải nằm cạnh nhau (mỗi buổi 1 làn),
          // không đè lên nhau. assignLanes trả về { lane, lanes } để chia bề rộng cột.
          const dayItems = weekClass.filter(({ d: dt }) => (dt.getDay() + 6) % 7 === di)
          const laid = assignLanes(
            dayItems,
            ({ d: dt }) => startMinuteOfDay(dt),
            ({ d: dt, s }) => startMinuteOfDay(dt) + s.durationMinutes,
          )
          return (
            <div key={d} className={`relative ${di < 6 ? 'border-r border-ga-line' : ''}`} style={{ background: di >= 5 ? 'var(--ga-bg)' : undefined }}>
              {Array.from({ length: hours.length - 1 }).map((_, r) => (
                <div key={r} className="absolute inset-x-0 border-t border-ga-line opacity-50" style={{ top: (GRID_H / hours.length) * (r + 1) }} />
              ))}

              {laid.map(({ item: { s, d: dt }, lane, lanes }) => {
                const c = CLASS_STATUS[s.status]
                const place = s.mode === 'ONLINE' ? MODE_LABEL.ONLINE : s.room ?? t('atClass')
                const laneW = 100 / lanes
                return (
                  <button
                    key={`c${s.id}`}
                    type="button"
                    onClick={() => onSessionClick(s)}
                    title={t('sessionTitle', { className: s.className, place, time: fmtTime(dt), count: s.studentCount })}
                    className="absolute overflow-hidden px-1.5 py-1 text-left transition-shadow hover:z-10 hover:shadow-ga-panel"
                    style={{
                      top: blockTop(dt),
                      left: `calc(${lane * laneW}% + 4px)`,
                      width: `calc(${laneW}% - 8px)`,
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
          )
        })}
      </div>
    </div>
  )
}
