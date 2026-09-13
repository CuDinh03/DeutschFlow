import React from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const listMembers = vi.fn()
const getAnalytics = vi.fn()
vi.mock('@/lib/orgApi', () => ({
  listMembers: (...a: unknown[]) => listMembers(...a),
  getAnalytics: (...a: unknown[]) => getAnalytics(...a),
}))
vi.mock('@/lib/api', () => ({ apiMessage: (e: unknown) => (e instanceof Error ? e.message : 'Lỗi không xác định') }))
vi.mock('sonner', () => ({ toast: Object.assign(() => undefined, { success: () => undefined, error: () => undefined }) }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('next-intl', () => ({
  useLocale: () => 'vi',
  // t(key) → "ns.key"; t(key, values) → "ns.key:{json}" để assert được cả tham số.
  useTranslations: (ns: string) => {
    const t = (key: string, values?: Record<string, unknown>) =>
      values ? `${ns}.${key}:${JSON.stringify(values)}` : `${ns}.${key}`
    return t as unknown as ReturnType<typeof import('next-intl').useTranslations>
  },
}))

import V2OrgStudentsPage from '@/app/v2/org/students/page'

const member = (id: number, status = 'ACTIVE') => ({
  userId: id, email: `hv${id}@local.test`, displayName: `Học viên ${id}`, status, joinedAt: '2026-09-01T00:00:00',
})
const analyticsOk = {
  studentCount: 1, teacherCount: 0, classCount: 0, tokensThisMonth: 0, monthlyTokenPool: 0,
  poolUsagePercent: 0, poolUnlimited: false, activeStudents7d: 0, activeStudents30d: 0, cefrDistribution: [],
}

beforeEach(() => { listMembers.mockReset(); getAnalytics.mockReset() })

/** BF-03 / AC-ORG-UI-01: API analytics lỗi KHÔNG được hiện như trung tâm "0 lớp / 0 người dùng AI". */
describe('V2OrgStudentsPage — số liệu toàn trung tâm', () => {
  it('analytics lỗi → ô KPI hiện "—" + chú thích đỏ + banner thử lại; danh sách vẫn dùng được; không có số 0 giả', async () => {
    listMembers.mockResolvedValue([member(1), member(2, 'LEFT')])
    getAnalytics.mockRejectedValue(new Error('HTTP 500'))

    render(<V2OrgStudentsPage />)

    await waitFor(() => expect(screen.getByText('Học viên 1')).toBeTruthy())
    const banner = await screen.findByRole('status')
    expect(banner.textContent).toContain('v2.org.students.analyticsError')
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText('v2.org.students.stats.unavailable')).toHaveLength(2)
    expect(screen.queryByText('0')).toBeNull()
    // Tổng học viên rơi về độ dài danh sách THẬT (2), không phải 0.
    expect(screen.getByText('2')).toBeTruthy()
  })

  it('CẢ HAI nguồn cùng lỗi → không ô nào hiện 0 giả (BF-03b)', async () => {
    // Trước bản vá: "Tổng học viên" và "Đang hoạt động" rơi về members.length = 0 vì mảng khởi tạo
    // rỗng, nên dải KPI hiện "0" đứng cạnh "—" của analytics — tự mâu thuẫn ngay trên một hàng.
    listMembers.mockRejectedValue(new Error('HTTP 500'))
    getAnalytics.mockRejectedValue(new Error('HTTP 500'))

    render(<V2OrgStudentsPage />)

    await waitFor(() => expect(screen.getAllByText('—').length).toBe(4))
    expect(screen.queryByText('0')).toBeNull()
    expect(screen.getAllByText('v2.org.students.stats.unavailable')).toHaveLength(4)
  })

  it('chỉ danh sách lỗi, analytics ok → tổng lấy từ analytics, ô từ danh sách hiện "—"', async () => {
    listMembers.mockRejectedValue(new Error('HTTP 500'))
    getAnalytics.mockResolvedValue({ ...analyticsOk, studentCount: 7 })

    render(<V2OrgStudentsPage />)

    await waitFor(() => expect(screen.getByText('7')).toBeTruthy())
    // "Đang hoạt động" đến từ danh sách đang lỗi → phải là "—", không phải 0.
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(1)
  })

  it('dữ liệu thật bằng 0 vẫn hiện 0 và không có banner lỗi', async () => {
    listMembers.mockResolvedValue([member(1)])
    getAnalytics.mockResolvedValue(analyticsOk)

    render(<V2OrgStudentsPage />)

    await waitFor(() => expect(screen.getByText('Học viên 1')).toBeTruthy())
    await waitFor(() => expect(screen.getAllByText('0')).toHaveLength(2))
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.queryByText('v2.org.students.stats.unavailable')).toBeNull()
  })

  it('bấm Thử lại chỉ gọi lại analytics (không tải lại danh sách); thành công thì banner biến mất và số thật hiện ra', async () => {
    listMembers.mockResolvedValue([member(1)])
    getAnalytics
      .mockRejectedValueOnce(new Error('HTTP 503'))
      .mockResolvedValueOnce({ ...analyticsOk, classCount: 4, activeStudents7d: 1 })

    render(<V2OrgStudentsPage />)

    const banner = await screen.findByRole('status')
    await userEvent.click(within(banner).getByRole('button', { name: 'v2.common.retry' }))

    await waitFor(() => expect(screen.queryByRole('status')).toBeNull())
    expect(screen.getByText('4')).toBeTruthy()
    expect(getAnalytics).toHaveBeenCalledTimes(2)
    expect(listMembers).toHaveBeenCalledTimes(1)
  })
})

/**
 * D4 — chỉ báo "N học viên chưa khai ngày sinh".
 *
 * Ca ở đây chốt ranh giới `false` (đang thiếu, phải đi đòi) với `null`/thiếu trường (backend không
 * tính ở đường này). Rút gọn thành `!m.birthDateRecorded` sẽ làm mọi ca "đường sáng" vẫn xanh mà
 * con số hiện ra thì sai — đúng kiểu hỏng im lặng mà chỉ báo này không được phép mắc.
 */
describe('V2OrgStudentsPage — chỉ báo chưa khai ngày sinh (D4)', () => {
  it('đếm ĐÚNG số em thiếu ngày sinh và gắn nhãn lên đúng dòng đó', async () => {
    listMembers.mockResolvedValue([
      { ...member(1), birthDateRecorded: false },
      { ...member(2), birthDateRecorded: true },
      { ...member(3), birthDateRecorded: false },
    ])
    getAnalytics.mockResolvedValue(analyticsOk)

    render(<V2OrgStudentsPage />)

    await waitFor(() => expect(screen.getByText('Học viên 1')).toBeTruthy())
    expect(
      screen.getByText('v2.org.students.missingBirthDateBanner:{"count":2}'),
    ).toBeTruthy()
    expect(screen.getAllByText('v2.org.students.missingBirthDateBadge')).toHaveLength(2)
  })

  it('🔴 KHÔNG đếm trường null/thiếu là "đang thiếu" — banner không hiện', async () => {
    listMembers.mockResolvedValue([
      { ...member(1), birthDateRecorded: null },
      { ...member(2) }, // backend cũ chưa có trường này
      { ...member(3), birthDateRecorded: true },
    ])
    getAnalytics.mockResolvedValue(analyticsOk)

    render(<V2OrgStudentsPage />)

    await waitFor(() => expect(screen.getByText('Học viên 1')).toBeTruthy())
    expect(screen.queryByText(/missingBirthDateBanner/)).toBeNull()
    expect(screen.queryByText('v2.org.students.missingBirthDateBadge')).toBeNull()
  })

  it('nút lọc thu danh sách về đúng những em thiếu ngày sinh, bấm lại thì mở ra', async () => {
    listMembers.mockResolvedValue([
      { ...member(1), birthDateRecorded: false },
      { ...member(2), birthDateRecorded: true },
    ])
    getAnalytics.mockResolvedValue(analyticsOk)

    render(<V2OrgStudentsPage />)
    await waitFor(() => expect(screen.getByText('Học viên 2')).toBeTruthy())

    await userEvent.click(screen.getByText('v2.org.students.filterMissingBirthDate'))
    expect(screen.queryByText('Học viên 2')).toBeNull()
    expect(screen.getByText('Học viên 1')).toBeTruthy()

    await userEvent.click(screen.getByText('v2.org.students.filterAll'))
    await waitFor(() => expect(screen.getByText('Học viên 2')).toBeTruthy())
  })
})
