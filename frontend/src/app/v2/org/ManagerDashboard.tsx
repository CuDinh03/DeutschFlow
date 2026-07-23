'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { CalendarDays, ChevronRight, UserPlus } from 'lucide-react'
import api, { apiMessage } from '@/lib/api'
import { fmtLocalIso, type ClassSession } from '@/lib/classScheduleApi'
import {
  getOrgSummary, getAnalytics, listClasses, listInvitations, listStudents,
  type OrgSummary, type OrgAnalytics, type OrgClass, type OrgInvitation, type OrgMember,
} from '@/lib/orgApi'
import { GaPageHdr, GaBtn, GaCap, TkStatStrip } from '@/components/ui-v2'

// ─────────────────────────────────────────────────────────────────────────────
// Org dashboard MANAGER ("nhân sự") — teal (role=org), song song với OwnerDashboard.
//
// Vì sao tách khỏi bảng OWNER: giám đốc nhìn SỨC KHOẺ trung tâm (ghế đã bán, token pool, phân bố
// CEFR); quản lý nhìn VIỆC HÔM NAY — buổi học đang chạy, lớp thiếu giáo viên, lời mời sắp hết hạn,
// học viên mới nhập. Bảng này KHÔNG hiển thị tài chính/token pool: đó là đặc quyền OWNER
// (OrgGuard.assertOrgFinance) và cũng không phải việc của quản lý.
//
// Zero backend — mọi số đều từ endpoint MANAGER đã được phép (OrgGuard.assertOrgAdmin):
//   /org · /org/analytics · /org/classes · /org/invitations · /org/students · /org/schedule/week
// Ghi chú: KHÔNG có API điểm danh org-scoped, nên "vận hành hôm nay" đo bằng buổi học trong lịch
// (SCHEDULED/CANCELLED/MOVED) — dữ liệu thật, không bịa tỉ lệ chuyên cần.
// ─────────────────────────────────────────────────────────────────────────────

const TEAL = '#11888A'
/** Lời mời còn ≤ ngưỡng này là "sắp hết hạn" → quản lý cần nhắc lại người được mời. */
const INVITE_EXPIRING_DAYS = 3
/** Còn ≤ ngưỡng % ghế trống thì cảnh báo sắp hết chỗ (chưa hết hẳn). */
const SEAT_LOW_PCT = 10

const STATUS_COLOR: Record<ClassSession['status'], { fg: string; bg: string }> = {
  SCHEDULED: { fg: 'var(--ga-teal)', bg: 'var(--ga-teal-soft)' },
  CANCELLED: { fg: 'var(--ga-red)', bg: 'var(--ga-red-soft)' },
  MOVED: { fg: 'var(--ga-orange)', bg: 'var(--ga-orange-soft)' },
}

const pad2 = (n: number) => String(n).padStart(2, '0')
const fmtTime = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
const fmtDay = (d: Date) => `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`

/** Buổi học trong NGÀY hôm nay (00:00 → 23:59:59 giờ máy), qua endpoint tuần của org. */
async function getTodaySessions(): Promise<ClassSession[]> {
  const from = new Date()
  from.setHours(0, 0, 0, 0)
  const to = new Date(from)
  to.setHours(23, 59, 59, 0)
  const res = await api.get<ClassSession[]>('/org/schedule/week', {
    params: { from: fmtLocalIso(from), to: fmtLocalIso(to) },
  })
  return res.data ?? []
}

/** Số ngày còn lại tới `iso` (làm tròn lên); âm = đã quá hạn. */
function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000)
}

/** Một việc cần xử lý: nhãn đã dịch + tông cảnh báo + trang để xử lý nó. */
interface TodoItem {
  key: string
  label: string
  tone: string
  href: string
}

export function OrgManagerDashboard() {
  const t = useTranslations('v2.org.manager')
  const tc = useTranslations('v2.common')
  const [summary, setSummary] = useState<OrgSummary | null>(null)
  const [analytics, setAnalytics] = useState<OrgAnalytics | null>(null)
  const [classes, setClasses] = useState<OrgClass[]>([])
  const [invites, setInvites] = useState<OrgInvitation[]>([])
  const [students, setStudents] = useState<OrgMember[]>([])
  const [sessions, setSessions] = useState<ClassSession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      // /org là nguồn duy nhất bắt buộc — nó hỏng nghĩa là mất org context, phải báo lỗi. Các
      // nguồn phụ hỏng lẻ (analytics/lịch/…) chỉ làm rỗng đúng thẻ của nó, không sập cả bảng.
      const [s, a, c, inv, st, ses] = await Promise.all([
        getOrgSummary(),
        getAnalytics().catch(() => null),
        listClasses(0, 50).then((p) => p.content).catch(() => [] as OrgClass[]),
        listInvitations().catch(() => [] as OrgInvitation[]),
        listStudents().catch(() => [] as OrgMember[]),
        getTodaySessions().catch(() => [] as ClassSession[]),
      ])
      setSummary(s)
      setAnalytics(a)
      setClasses(c)
      setInvites(inv)
      setStudents(st)
      setSessions(ses)
      setError('')
    } catch (e: unknown) {
      setError(apiMessage(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const todaySessions = [...sessions].sort((a, b) => a.startAt.localeCompare(b.startAt))
  const disrupted = todaySessions.filter((s) => s.status !== 'SCHEDULED').length

  const teacherless = classes.filter((c) => c.teacherId == null)
  const pending = invites.filter((i) => i.status === 'PENDING')
  const expiringSoon = pending.filter((i) => daysUntil(i.expiresAt) <= INVITE_EXPIRING_DAYS)

  const seatLimit = summary?.seatLimit ?? 0
  const freeSeats = summary ? Math.max(0, seatLimit - summary.seatUsed) : 0
  const seatsLow = seatLimit > 0 && freeSeats > 0 && (freeSeats / seatLimit) * 100 <= SEAT_LOW_PCT

  // Học viên mới trong 7 ngày — listStudents trả joinedAt; sắp xếp mới nhất trước.
  const weekAgo = Date.now() - 7 * 86_400_000
  const newStudents = students
    .filter((s) => s.joinedAt && new Date(s.joinedAt).getTime() >= weekAgo)
    .sort((a, b) => (b.joinedAt ?? '').localeCompare(a.joinedAt ?? ''))

  // "Cần xử lý": chỉ những việc CÓ THẬT, mỗi việc dẫn thẳng tới trang xử lý được nó.
  const todos: TodoItem[] = []
  if (teacherless.length > 0) {
    todos.push({ key: 'teacherless', label: t('todo.teacherless', { count: teacherless.length }), tone: 'var(--ga-red)', href: '/v2/org/classes' })
  }
  if (disrupted > 0) {
    todos.push({ key: 'disrupted', label: t('todo.disrupted', { count: disrupted }), tone: 'var(--ga-orange)', href: '/v2/org/schedule' })
  }
  if (expiringSoon.length > 0) {
    todos.push({ key: 'expiring', label: t('todo.expiringInvites', { count: expiringSoon.length, days: INVITE_EXPIRING_DAYS }), tone: 'var(--ga-orange)', href: '/v2/org/invitations' })
  } else if (pending.length > 0) {
    todos.push({ key: 'pending', label: t('todo.pendingInvites', { count: pending.length }), tone: 'var(--ga-yellow)', href: '/v2/org/invitations' })
  }
  // Ghế là ràng buộc VẬN HÀNH của quản lý (hết ghế = không nhập được học viên), nhưng mua thêm ghế
  // là việc của giám đốc → chỉ cảnh báo, không có CTA thanh toán.
  if (seatLimit > 0 && freeSeats === 0) {
    todos.push({ key: 'seats-full', label: t('todo.seatsFull'), tone: 'var(--ga-red)', href: '/v2/org/students' })
  } else if (seatsLow) {
    todos.push({ key: 'seats-low', label: t('todo.seatsLow', { count: freeSeats }), tone: 'var(--ga-yellow)', href: '/v2/org/students' })
  }

  if (error) {
    return (
      <div className="flex min-h-full flex-col">
        <GaPageHdr accent title={t('title')} subtitle={t('subtitle')} />
        <div className="flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
          <div className="border border-ga-line bg-ga-card px-4 py-8 sm:px-8 lg:px-10 lg:py-[52px] text-center">
            <h2 className="font-ga-display text-[20px] font-medium text-ga-red lg:text-[24px]">{t('loadError')}</h2>
            <p className="ga-ui mx-auto mb-5 mt-3 max-w-md text-[14px] text-ga-muted">{error || t('loadErrorDesc')}</p>
            <GaBtn variant="primary" onClick={load}>{tc('retry')}</GaBtn>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr
        accent
        title={summary?.name ?? t('title')}
        subtitle={t('subtitle')}
        right={
          <div className="flex flex-wrap items-center gap-2.5">
            <GaBtn asChild variant="ghost" size="sm">
              <Link href="/v2/org/schedule"><CalendarDays size={15} /> {t('scheduleBtn')}</Link>
            </GaBtn>
            <GaBtn asChild variant="yellow" size="sm">
              <Link href="/v2/org/teachers"><UserPlus size={15} /> {t('addTeacherBtn')}</Link>
            </GaBtn>
          </div>
        }
      />

      <div className="flex-1 overflow-auto px-4 py-6 sm:px-6 lg:px-10">
        <TkStatStrip
          items={[
            {
              label: t('stats.sessionsToday'),
              value: loading ? '—' : todaySessions.length,
              sub: disrupted > 0 ? t('stats.sessionsDisrupted', { count: disrupted }) : t('stats.sessionsOnTrack'),
              color: TEAL,
              alert: disrupted > 0,
            },
            {
              label: t('stats.openClasses'),
              value: loading ? '—' : (analytics?.classCount ?? classes.length),
              sub: teacherless.length > 0 ? t('stats.teacherless', { count: teacherless.length }) : t('stats.allStaffed'),
              color: '#7C56C8',
              alert: teacherless.length > 0,
            },
            {
              label: t('stats.students'),
              value: loading ? '—' : (analytics?.studentCount ?? summary?.studentCount ?? 0),
              sub: t('stats.active7d', { count: analytics?.activeStudents7d ?? 0 }),
              color: '#2F6FC9',
            },
            {
              label: t('stats.pendingInvites'),
              value: loading ? '—' : pending.length,
              sub: t('stats.expiringSoon', { count: expiringSoon.length }),
              color: '#1E9E61',
              alert: expiringSoon.length > 0,
            },
          ]}
        />

        <div className="mt-6 grid grid-cols-1 gap-[22px] lg:grid-cols-[2fr_1fr]">
          {/* Lịch hôm nay — trục thời gian, cột giờ bên trái, thanh trạng thái theo màu */}
          <div className="border border-ga-line bg-ga-card p-4 lg:p-[22px]">
            <div className="mb-4 flex items-center justify-between">
              <GaCap>{t('todayCap', { date: fmtDay(new Date()) })}</GaCap>
              <Link href="/v2/org/schedule" className="text-[12.5px] font-semibold underline" style={{ color: TEAL }}>
                {t('viewAll')}
              </Link>
            </div>
            {loading ? (
              <div className="ga-shimmer h-[200px]" aria-hidden />
            ) : todaySessions.length === 0 ? (
              <p className="py-10 text-center text-[13.5px] text-ga-muted">{t('todayEmpty')}</p>
            ) : (
              <ul className="flex flex-col">
                {todaySessions.map((s, i) => {
                  const start = new Date(s.startAt)
                  const end = new Date(start.getTime() + s.durationMinutes * 60_000)
                  const tone = STATUS_COLOR[s.status]
                  return (
                    <li
                      key={s.id}
                      className="flex items-center gap-2.5 py-3 lg:gap-4"
                      style={{ borderTop: i ? '1px solid var(--ga-line)' : 'none' }}
                    >
                      <span className="w-[92px] shrink-0 font-ga-display text-[14px] font-medium text-ga-ink">
                        {fmtTime(start)}–{fmtTime(end)}
                      </span>
                      <span className="h-9 w-[3px] shrink-0" style={{ background: tone.fg }} aria-hidden />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13.5px] font-semibold text-ga-ink">{s.className}</div>
                        <div className="truncate text-[11.5px] text-ga-muted">
                          {t('sessionMeta', { count: s.studentCount })}
                          {s.room ? ` · ${t('room', { room: s.room })}` : ''}
                        </div>
                      </div>
                      <span
                        className="shrink-0 px-2 py-1 text-[11px] font-semibold"
                        style={{ color: tone.fg, background: tone.bg }}
                      >
                        {t(`status.${s.status}`)}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {/* Cần xử lý — mỗi dòng dẫn thẳng tới trang xử lý được việc đó */}
          <div className="border border-ga-line bg-ga-card p-4 lg:p-[22px]">
            <GaCap className="mb-3.5 block">{t('todoCap')}</GaCap>
            {loading ? (
              <div className="ga-shimmer h-[120px]" aria-hidden />
            ) : todos.length === 0 ? (
              <p className="py-4 text-[13.5px] text-ga-muted">{t('todoEmpty')}</p>
            ) : (
              todos.map((td, i) => (
                <Link
                  key={td.key}
                  href={td.href}
                  className="group flex w-full items-center gap-3 py-3 text-left"
                  style={{ borderTop: i ? '1px solid var(--ga-line)' : 'none' }}
                >
                  <span className="h-[7px] w-[7px] shrink-0" style={{ background: td.tone }} aria-hidden />
                  <span className="flex-1 text-[13.5px] text-ga-ink">{td.label}</span>
                  <ChevronRight size={15} className="text-ga-subtle opacity-0 transition-opacity group-hover:opacity-100" />
                </Link>
              ))
            )}
          </div>
        </div>

        <div className="mt-[22px] grid grid-cols-1 gap-[22px] lg:grid-cols-2">
          {/* Lớp học — lớp thiếu giáo viên nổi lên đầu, đó là việc quản lý phải xử lý trước */}
          <div className="border border-ga-line bg-ga-card p-4 lg:p-[22px]">
            <div className="mb-3.5 flex items-center justify-between">
              <GaCap>{t('classesCap')}</GaCap>
              <Link href="/v2/org/classes" className="text-[12.5px] font-semibold underline" style={{ color: TEAL }}>
                {t('viewAll')}
              </Link>
            </div>
            {loading ? (
              <div className="ga-shimmer h-[120px]" aria-hidden />
            ) : classes.length === 0 ? (
              <p className="py-4 text-[13.5px] text-ga-muted">{t('classesEmpty')}</p>
            ) : (
              [...classes]
                .sort((a, b) => Number(a.teacherId != null) - Number(b.teacherId != null))
                .slice(0, 5)
                .map((c, i) => (
                  <div key={c.id} className="flex items-center gap-3 py-2.5" style={{ borderTop: i ? '1px solid var(--ga-line)' : 'none' }}>
                    <span className="grid h-8 w-8 shrink-0 place-items-center font-ga-display text-[14px] font-medium" style={{ color: TEAL, background: 'var(--ga-teal-soft)' }}>
                      {(c.name[0] ?? 'L').toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13.5px] font-semibold text-ga-ink">{c.name}</div>
                      <div className="text-[11.5px]" style={{ color: c.teacherId == null ? 'var(--ga-red)' : 'var(--ga-muted)' }}>
                        {c.teacherId == null ? t('classNoTeacher') : t('classHasTeacher')}
                      </div>
                    </div>
                    {c.inviteCode && (
                      <code className="shrink-0 bg-ga-ink px-2 py-1 text-[11px] font-semibold tracking-[0.06em] text-ga-yellow">{c.inviteCode}</code>
                    )}
                  </div>
                ))
            )}
          </div>

          {/* Học viên mới nhập (7 ngày) */}
          <div className="border border-ga-line bg-ga-card p-4 lg:p-[22px]">
            <div className="mb-3.5 flex items-center justify-between">
              <GaCap>{t('newStudentsCap')}</GaCap>
              <Link href="/v2/org/students" className="text-[12.5px] font-semibold underline" style={{ color: TEAL }}>
                {t('viewAll')}
              </Link>
            </div>
            {loading ? (
              <div className="ga-shimmer h-[120px]" aria-hidden />
            ) : newStudents.length === 0 ? (
              <p className="py-4 text-[13.5px] text-ga-muted">{t('newStudentsEmpty')}</p>
            ) : (
              newStudents.slice(0, 5).map((s, i) => (
                <div key={s.userId} className="flex items-center gap-3 py-2.5" style={{ borderTop: i ? '1px solid var(--ga-line)' : 'none' }}>
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-ga-pill text-[12px] font-semibold" style={{ color: TEAL, background: 'var(--ga-teal-soft)' }}>
                    {(s.displayName?.[0] ?? s.email[0] ?? '?').toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] font-semibold text-ga-ink">{s.displayName || s.email}</div>
                    <div className="truncate text-[11.5px] text-ga-muted">{s.email}</div>
                  </div>
                  {s.joinedAt && (
                    <span className="shrink-0 text-[11.5px] text-ga-muted">{fmtDay(new Date(s.joinedAt))}</span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
