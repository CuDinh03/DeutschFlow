import React from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * V-01 — bảng OWNER: "lớp chưa có giáo viên" lấy từ `summary.classesWithoutTeacher` (đếm toàn
 * trung tâm ở máy chủ) và nhãn từng dòng từ `getTeacherlessClassIds()`. Điều kiện cũ
 * `teacherId == null` là mã chết: cột `teacher_id` NOT NULL nên nó không bao giờ đúng, và trần
 * 50 lớp của trang đầu khiến trung tâm 60 lớp không bao giờ thấy cảnh báo cho 10 lớp cuối.
 */

const getOrgSummary = vi.fn()
const getAnalytics = vi.fn()
const listClasses = vi.fn()
const getTeacherlessClassIds = vi.fn()
const listInvitations = vi.fn()

vi.mock('@/lib/orgApi', () => ({
  getOrgSummary: () => getOrgSummary(),
  getAnalytics: () => getAnalytics(),
  listClasses: (...a: unknown[]) => listClasses(...a),
  getTeacherlessClassIds: () => getTeacherlessClassIds(),
  listInvitations: () => listInvitations(),
}))
vi.mock('@/lib/api', () => ({ apiMessage: (e: unknown) => (e instanceof Error ? e.message : 'Lỗi không xác định') }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}))
vi.mock('next-intl', () => ({
  useLocale: () => 'vi',
  useTranslations: (ns: string) => {
    const t = (key: string, values?: Record<string, unknown>) =>
      values ? `${ns}.${key}:${JSON.stringify(values)}` : `${ns}.${key}`
    return t as unknown as ReturnType<typeof import('next-intl').useTranslations>
  },
}))

import { OrgOwnerDashboard } from '@/app/v2/org/OwnerDashboard'

const klass = (id: number) => ({ id, name: `Lớp ${id}`, inviteCode: null, teacherId: 7, createdAt: '2026-09-01T00:00:00' })

beforeEach(() => {
  for (const m of [getOrgSummary, getAnalytics, listClasses, getTeacherlessClassIds, listInvitations]) m.mockReset()
  getOrgSummary.mockResolvedValue({
    name: 'Trung tâm A', planCode: 'PRO', seatUsed: 5, seatLimit: 10,
    teacherCount: 2, studentCount: 5, classCount: 60, classesWithoutTeacher: 0,
  })
  getAnalytics.mockResolvedValue({ studentCount: 5, teacherCount: 2, classCount: 60, tokensThisMonth: 0, monthlyTokenPool: 0, poolUsagePercent: 0, poolUnlimited: false, activeStudents7d: 1, activeStudents30d: 2, cefrDistribution: [] })
  listClasses.mockResolvedValue({ content: [klass(1), klass(2)], number: 0, size: 50, totalElements: 60, totalPages: 2, first: true, last: false })
  getTeacherlessClassIds.mockResolvedValue(new Set<number>())
  listInvitations.mockResolvedValue([])
})

describe('OrgOwnerDashboard — lớp thiếu giáo viên (V-01)', () => {
  it('cảnh báo đếm toàn trung tâm và dẫn thẳng tới danh sách lớp đó', async () => {
    getOrgSummary.mockResolvedValue({
      name: 'Trung tâm A', planCode: 'PRO', seatUsed: 5, seatLimit: 10,
      teacherCount: 2, studentCount: 5, classCount: 60, classesWithoutTeacher: 7,
    })

    render(<OrgOwnerDashboard />)

    const todo = await screen.findByText('v2.org.overview.todo.teacherless:{"count":7}')
    expect(todo.closest('a')?.getAttribute('href')).toBe('/v2/org/classes?withoutTeacher=1')

    const label = await screen.findByText('v2.org.overview.stats.openClasses')
    const tile = label.parentElement as HTMLElement
    expect(within(tile).getByText('v2.org.overview.stats.teacherless:{"count":7}')).toBeTruthy()
  })

  it('KHÔNG cảnh báo khi máy chủ nói 0, dù trang đầu chỉ tải được 2/60 lớp', async () => {
    render(<OrgOwnerDashboard />)

    await waitFor(() => expect(screen.getByText('Lớp 1')).toBeTruthy())
    expect(screen.queryByText(/todo\.teacherless/)).toBeNull()
  })

  it('nhãn từng dòng theo tập id thật; tập id chết ⇒ "—", không nói "đã có giáo viên"', async () => {
    getTeacherlessClassIds.mockResolvedValue(new Set([2]))

    const { unmount } = render(<OrgOwnerDashboard />)
    await waitFor(() => expect(screen.getByText('v2.org.overview.classNoTeacher')).toBeTruthy())
    expect(screen.getAllByText('v2.org.overview.classHasTeacher')).toHaveLength(1)
    unmount()

    getTeacherlessClassIds.mockRejectedValue(new Error('502'))
    render(<OrgOwnerDashboard />)
    await waitFor(() => expect(screen.getByText('Lớp 1')).toBeTruthy())
    expect(screen.queryByText('v2.org.overview.classHasTeacher')).toBeNull()
    expect(screen.queryByText('v2.org.overview.classNoTeacher')).toBeNull()
  })

  it('danh sách lớp chết KHÔNG còn làm "Cần xử lý" báo nguồn hỏng (số thiếu GV nay ở summary)', async () => {
    listClasses.mockRejectedValue(new Error('502'))

    render(<OrgOwnerDashboard />)

    await waitFor(() => expect(screen.getAllByText('v2.org.overview.sectionError').length).toBeGreaterThan(0))
    expect(screen.queryByText('v2.org.overview.todoSourceError')).toBeNull()
  })
})
