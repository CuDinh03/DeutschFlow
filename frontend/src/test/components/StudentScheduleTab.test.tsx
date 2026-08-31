/**
 * Tests cho tab "Lịch học" phía học viên (web).
 *
 * Điểm canh giữ: buổi sắp tới và buổi đã qua phải tách đúng (học viên mở tab này để tìm buổi tới),
 * và buổi ĐÃ HUỶ vẫn phải hiện — nếu lọc mất thì học viên nhận thông báo "buổi X đã huỷ" rồi mở lịch
 * ra không thấy gì, tưởng thông báo sai.
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ScheduleTab } from '@/app/v2/student/classes/[id]/ScheduleTab'
import type { ClassSession } from '@/lib/studentClassesApi'

vi.mock('next-intl', () => ({
  useTranslations: () => (k: string, v?: Record<string, unknown>) =>
    v ? `${k}:${Object.values(v).join(',')}` : k,
}))

const fetchClassSessions = vi.fn()
vi.mock('@/lib/studentClassesApi', () => ({
  fetchClassSessions: (id: number) => fetchClassSessions(id),
}))

/**
 * Mốc thời gian tính TƯƠNG ĐỐI so với hiện tại thật, cố ý không dùng `vi.useFakeTimers()`:
 * fake timers làm `findBy*` của testing-library treo cho tới khi hết timeout.
 */
const at = (daysFromNow: number, hhmm = '18:00'): string => {
  const d = new Date()
  d.setDate(d.getDate() + daysFromNow)
  const [h, m] = hhmm.split(':')
  d.setHours(Number(h), Number(m), 0, 0)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`
}

const session = (over: Partial<ClassSession> = {}): ClassSession => ({
  id: 1, startAt: at(3), durationMinutes: 90,
  mode: 'OFFLINE', room: 'A203', status: 'SCHEDULED', ...over,
})

describe('ScheduleTab (học viên)', () => {
  beforeEach(() => fetchClassSessions.mockReset())

  it('tách buổi sắp tới và buổi đã qua theo mốc hôm nay', async () => {
    fetchClassSessions.mockResolvedValue([
      session({ id: 1, startAt: at(-4) }),   // đã qua
      session({ id: 2, startAt: at(3) }),    // sắp tới
      session({ id: 3, startAt: at(5) }),    // sắp tới
    ])

    render(<ScheduleTab classId={7} />)

    expect(await screen.findByText('upcomingCap:2')).toBeInTheDocument()
    expect(screen.getByText('pastCap:1')).toBeInTheDocument()
  })

  it('vẫn hiện buổi đã huỷ (thông báo huỷ phải có chỗ đối chiếu)', async () => {
    fetchClassSessions.mockResolvedValue([session({ id: 9, status: 'CANCELLED' })])

    render(<ScheduleTab classId={7} />)

    expect(await screen.findByText('status.CANCELLED')).toBeInTheDocument()
  })

  it('tính giờ kết thúc từ thời lượng (backend không trả endAt)', async () => {
    fetchClassSessions.mockResolvedValue([
      session({ startAt: at(3, '18:00'), durationMinutes: 90 }),
    ])

    render(<ScheduleTab classId={7} />)

    expect(await screen.findByText('18:00 – 19:30')).toBeInTheDocument()
  })

  it('lớp chưa xếp buổi nào → trạng thái rỗng, không phải lỗi', async () => {
    fetchClassSessions.mockResolvedValue([])

    render(<ScheduleTab classId={7} />)

    expect(await screen.findByText('emptyTitle')).toBeInTheDocument()
  })
})
