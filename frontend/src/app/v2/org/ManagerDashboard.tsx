'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { CalendarDays, ChevronRight, UserPlus } from 'lucide-react'
import api, { apiMessage } from '@/lib/api'
import { fmtLocalIso, type ClassSession } from '@/lib/classScheduleApi'
import {
  getOrgSummary, getAnalytics, getTeacherlessClassIds, listClasses, listInvitations, listStudents,
  type OrgSummary, type OrgAnalytics, type OrgClass, type OrgInvitation, type OrgMember,
} from '@/lib/orgApi'
import { GaPageHdr, GaBtn, GaCap, GaStatStrip } from '@/components/ui-v2'
import { srcOf, type Src } from './dashboardSrc'

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
//
// V-02 (08/09/2026): bảng này từng nuốt lỗi — `getAnalytics().catch(() => null)` rồi `?? 0`, cùng
// các `.catch(() => [])` cho lớp/lời mời/học viên/lịch. API chết là màn hình khẳng định "0 học
// viên", "0 lời mời", "không có việc cần xử lý" — kết luận về dữ liệu dựng từ chỗ KHÔNG có dữ liệu.
// Nay dùng chung khuôn `Src<T>` + `Promise.allSettled` của bảng OWNER: ô KPI hiện '—', mỗi thẻ có
// nhánh lỗi riêng kèm nút Thử lại.
// V-01 (08/09/2026): "lớp thiếu giáo viên" bỏ `teacherId == null` (cột `teacher_id` NOT NULL nên
// điều kiện đó là mã chết), lấy số từ `summary.classesWithoutTeacher` và nhãn từng dòng từ
// `getTeacherlessClassIds()`.
// ─────────────────────────────────────────────────────────────────────────────

const TEAL = '#11888A'
/** Bấm vào cảnh báo thiếu GV phải ra ĐÚNG danh sách đó, không phải toàn bộ lớp. */
const TEACHERLESS_HREF = '/v2/org/classes?withoutTeacher=1'
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
  const [analytics, setAnalytics] = useState<Src<OrgAnalytics>>({ state: 'loading' })
  const [classes, setClasses] = useState<Src<OrgClass[]>>({ state: 'loading' })
  const [teacherlessIds, setTeacherlessIds] = useState<Src<Set<number>>>({ state: 'loading' })
  const [invites, setInvites] = useState<Src<OrgInvitation[]>>({ state: 'loading' })
  const [students, setStudents] = useState<Src<OrgMember[]>>({ state: 'loading' })
  const [sessions, setSessions] = useState<Src<ClassSession[]>>({ state: 'loading' })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setAnalytics({ state: 'loading' })
    setClasses({ state: 'loading' })
    setTeacherlessIds({ state: 'loading' })
    setInvites({ state: 'loading' })
    setStudents({ state: 'loading' })
    setSessions({ state: 'loading' })
    try {
      // /org là nguồn duy nhất bắt buộc — nó hỏng nghĩa là mất org context, phải báo lỗi cả trang.
      setSummary(await getOrgSummary())
      setError('')
    } catch (e: unknown) {
      setError(apiMessage(e))
      setLoading(false)
      return
    }
    // Nguồn phụ hỏng lẻ chỉ làm LỖI đúng thẻ của nó — không thành mảng rỗng rồi đọc ra như số 0.
    const [a, c, tl, inv, st, ses] = await Promise.allSettled([
      getAnalytics(),
      listClasses(0, 50).then((p) => p.content),
      getTeacherlessClassIds(),
      listInvitations(),
      listStudents(),
      getTodaySessions(),
    ])
    setAnalytics(srcOf(a))
    setClasses(srcOf(c))
    setTeacherlessIds(srcOf(tl))
    setInvites(srcOf(inv))
    setStudents(srcOf(st))
    setSessions(srcOf(ses))
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const an = analytics.state === 'ok' ? analytics.data : null
  const classList = classes.state === 'ok' ? classes.data : []
  const inviteList = invites.state === 'ok' ? invites.data : []
  const studentList = students.state === 'ok' ? students.data : []

  const todaySessions = sessions.state === 'ok' ? [...sessions.data].sort((a, b) => a.startAt.localeCompare(b.startAt)) : []
  const disrupted = todaySessions.filter((s) => s.status !== 'SCHEDULED').length

  // Đếm trên TOÀN trung tâm (`/org`), không phải trên trang đầu 50 lớp.
  const teacherless = summary?.classesWithoutTeacher ?? 0
  /** Nhãn từng dòng theo tập id THẬT; nguồn chưa về ⇒ false (dòng hiện '—', không đoán bừa). */
  const isTeacherless = (id: number) => teacherlessIds.state === 'ok' && teacherlessIds.data.has(id)
  const pending = inviteList.filter((i) => i.status === 'PENDING')
  const expiringSoon = pending.filter((i) => daysUntil(i.expiresAt) <= INVITE_EXPIRING_DAYS)

  const seatLimit = summary?.seatLimit ?? 0
  const freeSeats = summary ? Math.max(0, seatLimit - summary.seatUsed) : 0
  const seatsLow = seatLimit > 0 && freeSeats > 0 && (freeSeats / seatLimit) * 100 <= SEAT_LOW_PCT

  // Học viên mới trong 7 ngày — listStudents trả joinedAt; sắp xếp mới nhất trước.
  const weekAgo = Date.now() - 7 * 86_400_000
  const newStudents = studentList
    .filter((s) => s.joinedAt && new Date(s.joinedAt).getTime() >= weekAgo)
    .sort((a, b) => (b.joinedAt ?? '').localeCompare(a.joinedAt ?? ''))

  // "Cần xử lý": chỉ những việc CÓ THẬT, mỗi việc dẫn thẳng tới trang xử lý được nó.
  // Nguồn nào hỏng thì thẻ nói rõ, KHÔNG im lặng kết luận "không có việc cần xử lý".
  const todoSourceFailed = invites.state === 'error' || sessions.state === 'error'
  const todos: TodoItem[] = []
  if (teacherless > 0) {
    todos.push({ key: 'teacherless', label: t('todo.teacherless', { count: teacherless }), tone: 'var(--ga-red)', href: TEACHERLESS_HREF })
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
        <GaStatStrip
          items={[
            {
              label: t('stats.sessionsToday'),
              // Lịch hỏng ⇒ '—'. "0 buổi hôm nay" là một khẳng định, không được dựng từ lỗi mạng.
              value: loading || sessions.state !== 'ok' ? '—' : todaySessions.length,
              sub: sessions.state === 'error' ? t('statUnavailable') : disrupted > 0 ? t('stats.sessionsDisrupted', { count: disrupted }) : t('stats.sessionsOnTrack'),
              tone: 'teal',
              alert: disrupted > 0 || sessions.state === 'error',
            },
            {
              label: t('stats.openClasses'),
              value: loading ? '—' : (an?.classCount ?? summary?.classCount ?? '—'),
              sub: loading ? '—' : teacherless > 0 ? t('stats.teacherless', { count: teacherless }) : t('stats.allStaffed'),
              tone: 'violet',
              alert: teacherless > 0,
            },
            {
              label: t('stats.students'),
              value: loading ? '—' : (an?.studentCount ?? summary?.studentCount ?? '—'),
              sub: analytics.state === 'error' ? t('statUnavailable') : t('stats.active7d', { count: an?.activeStudents7d ?? 0 }),
              tone: 'blue',
              alert: analytics.state === 'error',
            },
            {
              label: t('stats.pendingInvites'),
              value: loading || invites.state !== 'ok' ? '—' : pending.length,
              sub: invites.state === 'error' ? t('statUnavailable') : t('stats.expiringSoon', { count: expiringSoon.length }),
              tone: 'green',
              alert: expiringSoon.length > 0 || invites.state === 'error',
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
            {loading || sessions.state === 'loading' ? (
              <div className="ga-shimmer h-[200px]" aria-hidden />
            ) : sessions.state === 'error' ? (
              <div className="py-8 text-center">
                <p className="ga-ui mb-3 text-ga-small text-ga-red">{t('sectionError')}</p>
                <GaBtn variant="ghost" size="sm" onClick={load}>{tc('retry')}</GaBtn>
              </div>
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
            {todoSourceFailed && !loading && (
              <div className="mb-2 flex flex-wrap items-center gap-3 border border-dashed px-3 py-2" style={{ borderColor: 'color-mix(in srgb, var(--ga-red) 40%, transparent)' }}>
                <p className="ga-ui min-w-0 flex-1 text-ga-caption text-ga-red">{t('todoSourceError')}</p>
                <GaBtn variant="ghost" size="sm" onClick={load}>{tc('retry')}</GaBtn>
              </div>
            )}
            {loading ? (
              <div className="ga-shimmer h-[120px]" aria-hidden />
            ) : todos.length === 0 && !todoSourceFailed ? (
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
            {loading || classes.state === 'loading' ? (
              <div className="ga-shimmer h-[120px]" aria-hidden />
            ) : classes.state === 'error' ? (
              <div className="py-6 text-center">
                <p className="ga-ui mb-3 text-ga-small text-ga-red">{t('sectionError')}</p>
                <GaBtn variant="ghost" size="sm" onClick={load}>{tc('retry')}</GaBtn>
              </div>
            ) : classList.length === 0 ? (
              <p className="py-4 text-[13.5px] text-ga-muted">{t('classesEmpty')}</p>
            ) : (
              // Lớp chưa ai dạy nổi lên đầu — thứ tự cũ xếp theo `teacherId != null`, một biểu thức
              // hằng đúng, nên thực chất chưa bao giờ sắp xếp gì.
              [...classList]
                .sort((a, b) => Number(isTeacherless(b.id)) - Number(isTeacherless(a.id)))
                .slice(0, 5)
                .map((c, i) => (
                  <div key={c.id} className="flex items-center gap-3 py-2.5" style={{ borderTop: i ? '1px solid var(--ga-line)' : 'none' }}>
                    <span className="grid h-8 w-8 shrink-0 place-items-center font-ga-display text-[14px] font-medium" style={{ color: TEAL, background: 'var(--ga-teal-soft)' }}>
                      {(c.name[0] ?? 'L').toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13.5px] font-semibold text-ga-ink">{c.name}</div>
                      <div className="text-[11.5px]" style={{ color: isTeacherless(c.id) ? 'var(--ga-red)' : 'var(--ga-muted)' }}>
                        {teacherlessIds.state !== 'ok' ? '—' : isTeacherless(c.id) ? t('classNoTeacher') : t('classHasTeacher')}
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
            {loading || students.state === 'loading' ? (
              <div className="ga-shimmer h-[120px]" aria-hidden />
            ) : students.state === 'error' ? (
              <div className="py-6 text-center">
                <p className="ga-ui mb-3 text-ga-small text-ga-red">{t('sectionError')}</p>
                <GaBtn variant="ghost" size="sm" onClick={load}>{tc('retry')}</GaBtn>
              </div>
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
