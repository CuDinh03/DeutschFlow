import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const getOrgTimesheet = vi.hoisted(() => vi.fn())
const lockPeriod = vi.hoisted(() => vi.fn())
const getOrgRole = vi.hoisted(() => vi.fn<() => string>())

vi.mock('@/lib/timesheetApi', () => ({
  getOrgTimesheet: (...a: unknown[]) => getOrgTimesheet(...a),
  lockPeriod: (...a: unknown[]) => lockPeriod(...a),
  approvePeriod: vi.fn(),
  rejectPeriod: vi.fn(),
  downloadOrgTimesheetCsv: vi.fn(),
  formatMinutes: (m: number) => `${m}p`,
}))
vi.mock('@/lib/authSession', () => ({ getOrgRole }))
vi.mock('@/lib/api', () => ({ apiMessage: (e: unknown) => (e instanceof Error ? e.message : '') }))
vi.mock('sonner', () => ({ toast: Object.assign(() => undefined, { success: vi.fn(), error: vi.fn() }) }))
vi.mock('next-intl', () => ({
  useLocale: () => 'vi',
  useTranslations: (ns: string) => {
    const t = (key: string, values?: Record<string, unknown>) =>
      values ? `${ns}.${key}:${JSON.stringify(values)}` : `${ns}.${key}`
    return t as unknown as ReturnType<typeof import('next-intl').useTranslations>
  },
}))

import OrgTimesheetsPage from '@/app/v2/org/timesheets/page'

const approvedPeriod = {
  id: 5,
  teacherId: 42,
  teacherName: 'Cô Lan',
  periodStart: '2026-09-01',
  periodEnd: '2026-09-30',
  payUnit: 'SESSION' as const,
  status: 'APPROVED' as const,
  editable: false,
  totalSessions: 12,
  totalMinutes: 2340,
  submittedAt: '2026-09-30T10:00:00Z',
}

beforeEach(() => {
  getOrgTimesheet.mockReset()
  lockPeriod.mockReset()
  getOrgRole.mockReset()
  getOrgRole.mockReturnValue('OWNER')
  getOrgTimesheet.mockResolvedValue({
    from: '2026-09-01', to: '2026-09-30', teacherCount: 1,
    totalSessions: 12, totalMinutes: 2340, periods: [approvedPeriod],
  })
})

/**
 * V-10 — khoá kỳ công là trạng thái CUỐI (TimesheetPeriodService.lock không có đường quay lại),
 * nhưng nút trước đây bấm là chạy thẳng. Ca dưới đây khoá lại quy ước ConfirmDialog của dự án.
 */
describe('OrgTimesheetsPage — xác nhận trước khi khoá kỳ công', () => {
  it('bấm "Khoá kỳ" mở hộp thoại nêu hệ quả, CHƯA gọi máy chủ', async () => {
    render(<OrgTimesheetsPage />)
    await waitFor(() => expect(screen.getByText('Cô Lan')).toBeTruthy())

    await userEvent.click(screen.getByRole('button', { name: 'v2.org.timesheets.lock' }))

    // Hệ quả THẬT, không phải "Bạn có chắc không?".
    expect(screen.getByText('v2.org.timesheets.lockConfirmFinal')).toBeTruthy()
    expect(screen.getByText('v2.org.timesheets.lockConfirmRecords')).toBeTruthy()
    expect(
      screen.getByText('v2.org.timesheets.lockConfirmSessions:{"sessions":12,"hours":"2340p"}'),
    ).toBeTruthy()
    expect(lockPeriod).not.toHaveBeenCalled()
  })

  it('Huỷ trong hộp thoại KHÔNG khoá kỳ', async () => {
    render(<OrgTimesheetsPage />)
    await waitFor(() => expect(screen.getByText('Cô Lan')).toBeTruthy())

    await userEvent.click(screen.getByRole('button', { name: 'v2.org.timesheets.lock' }))
    await userEvent.click(screen.getByRole('button', { name: 'v2.org.timesheets.cancel' }))

    await waitFor(() => expect(screen.queryByText('v2.org.timesheets.lockConfirmFinal')).toBeNull())
    expect(lockPeriod).not.toHaveBeenCalled()
  })

  it('xác nhận mới gọi lockPeriod đúng kỳ', async () => {
    lockPeriod.mockResolvedValue({ ...approvedPeriod, status: 'LOCKED' })
    render(<OrgTimesheetsPage />)
    await waitFor(() => expect(screen.getByText('Cô Lan')).toBeTruthy())

    await userEvent.click(screen.getByRole('button', { name: 'v2.org.timesheets.lock' }))
    // Nút xác nhận trong hộp thoại mang cùng nhãn "Khoá kỳ" — lấy nút CUỐI (trong dialog).
    const confirmBtns = screen.getAllByRole('button', { name: 'v2.org.timesheets.lock' })
    await userEvent.click(confirmBtns[confirmBtns.length - 1])

    await waitFor(() => expect(lockPeriod).toHaveBeenCalledWith(5))
  })

  it('MANAGER không thấy nút khoá nên không có gì để xác nhận', async () => {
    getOrgRole.mockReturnValue('MANAGER')
    render(<OrgTimesheetsPage />)
    await waitFor(() => expect(screen.getByText('Cô Lan')).toBeTruthy())

    expect(screen.queryByRole('button', { name: 'v2.org.timesheets.lock' })).toBeNull()
    expect(screen.getByText('v2.org.timesheets.lockOwnerOnly')).toBeTruthy()
  })
})
