'use client'

// Lịch buổi học của lớp — phía HỌC VIÊN (chỉ đọc).
//
// Giáo viên xếp lịch ở /v2/teacher/schedule và mỗi thay đổi bắn thông báo CLASS_SESSION_SCHEDULED /
// _CANCELLED / _RESCHEDULED cho cả lớp. Trên web, học viên nhận được thông báo nhưng KHÔNG có màn nào
// để xem lịch đang ra sao — endpoint `sessions` đã có từ P4 và chỉ bản mobile gọi.
//
// Mở danh sách này cũng chính là tín hiệu "đã xem": backend tự đánh dấu đã đọc ba loại thông báo trên
// theo classId sau khi commit, nên chuông thôi sáng khi học viên thực sự nhìn thấy lịch mới.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { format, isBefore, startOfDay } from 'date-fns'
import { Loader2, MapPin, Monitor } from 'lucide-react'
import { apiMessage } from '@/lib/api'
import { fetchClassSessions, type ClassSession } from '@/lib/studentClassesApi'
import { GaCap, EmptyState, ErrorBanner } from '@/components/ui-v2'

const STATUS_TONE: Record<string, string> = {
  SCHEDULED: 'var(--ga-green)',
  MOVED: 'var(--ga-orange)',
  CANCELLED: 'var(--ga-red)',
}

/** Giờ kết thúc suy ra từ giờ bắt đầu + thời lượng (backend không trả endAt). */
function timeRange(startAt: string, durationMinutes: number): string {
  const start = new Date(startAt)
  const end = new Date(start.getTime() + durationMinutes * 60_000)
  return `${format(start, 'HH:mm')} – ${format(end, 'HH:mm')}`
}

export function ScheduleTab({ classId }: { classId: number }) {
  const t = useTranslations('v2.student.classDetail.schedule')
  const [sessions, setSessions] = useState<ClassSession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setSessions(await fetchClassSessions(classId))
      setError('')
    } catch (e: unknown) {
      setError(apiMessage(e))
    } finally {
      setLoading(false)
    }
  }, [classId])

  useEffect(() => { void load() }, [load])

  // Buổi sắp tới lên trước — đó là thứ học viên mở màn này để tìm. Buổi đã qua vẫn giữ (theo thứ tự
  // thời gian của backend) để đối chiếu với lịch sử điểm danh ở tab Đánh giá.
  const { upcoming, past } = useMemo(() => {
    const today = startOfDay(new Date())
    const up: ClassSession[] = []
    const old: ClassSession[] = []
    for (const s of sessions) {
      if (isBefore(new Date(s.startAt), today)) old.push(s)
      else up.push(s)
    }
    return { upcoming: up, past: old.reverse() }
  }, [sessions])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-[14px] text-ga-muted">
        <Loader2 size={15} className="animate-spin" /> {t('loading')}
      </div>
    )
  }
  if (error) return <ErrorBanner message={error} onRetry={load} />
  if (sessions.length === 0) {
    return <EmptyState icon="schedule" title={t('emptyTitle')} description={t('emptyBody')} />
  }

  const renderList = (items: ClassSession[]) => (
    <div className="border border-ga-line bg-ga-card">
      {items.map((s, i) => {
        const cancelled = s.status === 'CANCELLED'
        return (
          <div
            key={s.id}
            className="flex flex-wrap items-start gap-x-4 gap-y-1.5 px-4 py-3.5 lg:flex-nowrap lg:px-5"
            style={{ borderTop: i ? '1px solid var(--ga-line)' : 'none', opacity: cancelled ? 0.62 : 1 }}
          >
            <div className="w-[96px] shrink-0">
              <div className="font-ga-display text-[15px] font-medium text-ga-ink">{format(new Date(s.startAt), 'dd/MM')}</div>
              {/* Thứ lấy từ i18n, không từ date-fns: format('EEEEEE') luôn ra tiếng Anh vì dự án
                  không nạp locale của date-fns ở bất kỳ đâu trong /v2. */}
              <div className="ga-ui text-[12px] text-ga-muted">{t(`weekday.${new Date(s.startAt).getDay()}`)}</div>
            </div>
            <div className="min-w-0 flex-1">
              <div
                className="text-[14.5px] font-semibold text-ga-ink"
                style={cancelled ? { textDecoration: 'line-through' } : undefined}
              >
                {timeRange(s.startAt, s.durationMinutes)}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-ga-muted">
                {s.mode === 'ONLINE' ? (
                  <span className="inline-flex items-center gap-1"><Monitor size={12} /> {t('modeOnline')}</span>
                ) : s.mode === 'OFFLINE' ? (
                  <span className="inline-flex items-center gap-1"><MapPin size={12} /> {t('modeOffline')}</span>
                ) : null}
                {s.room && <span>{t('room', { room: s.room })}</span>}
                <span>{t('duration', { minutes: s.durationMinutes })}</span>
              </div>
            </div>
            <span
              className="ga-ui shrink-0 text-[12.5px] font-semibold"
              style={{ color: s.status ? STATUS_TONE[s.status] : 'var(--ga-subtle)' }}
            >
              {s.status ? t(`status.${s.status}`) : '—'}
            </span>
          </div>
        )
      })}
    </div>
  )

  return (
    <div className="flex flex-col gap-7">
      <section>
        <GaCap className="mb-3 block">{t('upcomingCap', { count: upcoming.length })}</GaCap>
        {upcoming.length === 0
          ? <p className="border border-dashed border-ga-line px-4 py-6 text-center text-[13.5px] text-ga-muted">{t('noUpcoming')}</p>
          : renderList(upcoming)}
      </section>

      {past.length > 0 && (
        <section>
          <GaCap className="mb-3 block">{t('pastCap', { count: past.length })}</GaCap>
          {renderList(past)}
        </section>
      )}
    </div>
  )
}
