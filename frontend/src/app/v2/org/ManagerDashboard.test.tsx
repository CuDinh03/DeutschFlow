import React from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * V-02 — bảng MANAGER không được nuốt lỗi.
 *
 * Trước đợt này: `getAnalytics().catch(() => null)` + `?? 0`, và `.catch(() => [])` cho lớp / lời
 * mời / học viên / lịch. API chết thì màn hình khẳng định "0 học viên", "0 lời mời đang chờ",
 * "không có việc cần xử lý" — kết luận về dữ liệu dựng từ chỗ KHÔNG có dữ liệu.
 *
 * V-01 — "lớp thiếu giáo viên" lấy từ `summary.classesWithoutTeacher`, không từ `teacherId == null`
 * (cột `teacher_id` NOT NULL nên điều kiện đó không bao giờ đúng).
 */

const getOrgSummary = vi.fn()
const getAnalytics = vi.fn()
const listClasses = vi.fn()
const getTeacherlessClassIds = vi.fn()
const listInvitations = vi.fn()
const listStudents = vi.fn()
const apiGet = vi.fn()

vi.mock('@/lib/orgApi', () => ({
  getOrgSummary: () => getOrgSummary(),
  getAnalytics: () => getAnalytics(),
  listClasses: (...a: unknown[]) => listClasses(...a),
  getTeacherlessClassIds: () => getTeacherlessClassIds(),
  listInvitations: () => listInvitations(),
  listStudents: () => listStudents(),
}))
vi.mock('@/lib/api', () => ({
  default: { get: (...a: unknown[]) => apiGet(...a) },
  apiMessage: (e: unknown) => (e instanceof Error ? e.message : 'Lỗi không xác định'),
}))
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

import { OrgManagerDashboard } from '@/app/v2/org/ManagerDashboard'

const summary = (classesWithoutTeacher: number) => ({
  name: 'Trung tâm A', planCode: 'PRO', seatUsed: 5, seatLimit: 10,
  teacherCount: 2, studentCount: 5, classCount: 4, classesWithoutTeacher,
})
const klass = (id: number) => ({ id, name: `Lớp ${id}`, inviteCode: null, teacherId: 7, createdAt: '2026-09-01T00:00:00' })

beforeEach(() => {
  for (const m of [getOrgSummary, getAnalytics, listClasses, getTeacherlessClassIds, listInvitations, listStudents, apiGet]) m.mockReset()
  getOrgSummary.mockResolvedValue(summary(0))
  getAnalytics.mockResolvedValue({ studentCount: 5, teacherCount: 2, classCount: 4, tokensThisMonth: 0, monthlyTokenPool: 0, poolUsagePercent: 0, activeStudents7d: 3, cefrDistribution: [] })
  listClasses.mockResolvedValue({ content: [klass(1), klass(2)], number: 0, size: 50, totalElements: 2, totalPages: 1, first: true, last: true })
  getTeacherlessClassIds.mockResolvedValue(new Set<number>())
  listInvitations.mockResolvedValue([])
  listStudents.mockResolvedValue([])
  apiGet.mockResolvedValue({ data: [] })
})

/** Ô KPI thứ `i` (0-based) trong dải thống kê đầu trang. */
async function statTile(i: number): Promise<HTMLElement> {
  const label = await screen.findByText(`v2.org.manager.stats.${['sessionsToday', 'openClasses', 'students', 'pendingInvites'][i]}`)
  return label.parentElement as HTMLElement
}

describe('OrgManagerDashboard — lỗi không được thành số 0 (V-02)', () => {
  it('analytics chết ⇒ ô Học viên hiện "—" + "chưa tải được", KHÔNG hiện 0', async () => {
    getAnalytics.mockRejectedValue(new Error('502'))
    getOrgSummary.mockResolvedValue({ ...summary(0), studentCount: 0 })

    render(<OrgManagerDashboard />)

    const tile = await statTile(2)
    await waitFor(() => expect(within(tile).getByText('v2.org.manager.statUnavailable')).toBeTruthy())
    expect(within(tile).queryByText('v2.org.manager.stats.active7d:{"count":0}')).toBeNull()
  })

  it('lời mời chết ⇒ ô Lời mời hiện "—", không phải 0', async () => {
    listInvitations.mockRejectedValue(new Error('502'))

    render(<OrgManagerDashboard />)

    const tile = await statTile(3)
    await waitFor(() => expect(within(tile).getByText('—')).toBeTruthy())
    expect(within(tile).getByText('v2.org.manager.statUnavailable')).toBeTruthy()
  })

  it('lịch chết ⇒ ô Buổi học hôm nay hiện "—" và thẻ lịch có nhánh lỗi + Thử lại', async () => {
    apiGet.mockRejectedValue(new Error('502'))

    render(<OrgManagerDashboard />)

    const tile = await statTile(0)
    await waitFor(() => expect(within(tile).getByText('—')).toBeTruthy())
    expect(screen.getAllByText('v2.org.manager.sectionError').length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: 'v2.common.retry' }).length).toBeGreaterThan(0)
  })

  it('nguồn của "Cần xử lý" chết ⇒ nói rõ, KHÔNG kết luận "không có việc cần xử lý"', async () => {
    listInvitations.mockRejectedValue(new Error('502'))

    render(<OrgManagerDashboard />)

    await waitFor(() => expect(screen.getByText('v2.org.manager.todoSourceError')).toBeTruthy())
    expect(screen.queryByText('v2.org.manager.todoEmpty')).toBeNull()
  })

  it('mọi nguồn phụ chết vẫn KHÔNG sập cả bảng (summary còn sống)', async () => {
    getAnalytics.mockRejectedValue(new Error('x'))
    listClasses.mockRejectedValue(new Error('x'))
    getTeacherlessClassIds.mockRejectedValue(new Error('x'))
    listInvitations.mockRejectedValue(new Error('x'))
    listStudents.mockRejectedValue(new Error('x'))
    apiGet.mockRejectedValue(new Error('x'))

    render(<OrgManagerDashboard />)

    await waitFor(() => expect(screen.getByText('Trung tâm A')).toBeTruthy())
    expect(screen.queryByText('v2.org.manager.loadError')).toBeNull()
    // Ô Lớp đang mở vẫn nói được vì `summary` là nguồn bắt buộc và nó còn sống.
    const tile = await statTile(1)
    expect(within(tile).getByText('4')).toBeTruthy()
  })

  it('/org chết ⇒ báo lỗi cả trang', async () => {
    getOrgSummary.mockRejectedValue(new Error('mất org context'))

    render(<OrgManagerDashboard />)

    await waitFor(() => expect(screen.getByText('v2.org.manager.loadError')).toBeTruthy())
  })
})

describe('OrgManagerDashboard — lớp thiếu giáo viên (V-01)', () => {
  it('đếm theo summary toàn trung tâm, không theo trang đầu 50 lớp', async () => {
    // Trang đầu chỉ có 2 lớp và cả hai đều có teacherId; cả trung tâm có 3 lớp không còn ai dạy.
    getOrgSummary.mockResolvedValue(summary(3))

    render(<OrgManagerDashboard />)

    const tile = await statTile(1)
    await waitFor(() => expect(within(tile).getByText('v2.org.manager.stats.teacherless:{"count":3}')).toBeTruthy())
    const todo = await screen.findByText('v2.org.manager.todo.teacherless:{"count":3}')
    expect(todo.closest('a')?.getAttribute('href')).toBe('/v2/org/classes?withoutTeacher=1')
  })

  it('nhãn từng dòng theo tập id thật; tập id chết ⇒ "—", không nói "đã có giáo viên"', async () => {
    getTeacherlessClassIds.mockResolvedValue(new Set([2]))

    const { unmount } = render(<OrgManagerDashboard />)
    await waitFor(() => expect(screen.getByText('v2.org.manager.classNoTeacher')).toBeTruthy())
    expect(screen.getAllByText('v2.org.manager.classHasTeacher')).toHaveLength(1)
    unmount()

    getTeacherlessClassIds.mockRejectedValue(new Error('502'))
    render(<OrgManagerDashboard />)
    await waitFor(() => expect(screen.getByText('Lớp 1')).toBeTruthy())
    expect(screen.queryByText('v2.org.manager.classHasTeacher')).toBeNull()
    expect(screen.queryByText('v2.org.manager.classNoTeacher')).toBeNull()
  })
})
