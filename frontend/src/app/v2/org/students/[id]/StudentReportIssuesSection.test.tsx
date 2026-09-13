/**
 * Tab "Đánh giá" của màn học viên (khu trung tâm) — PR-R3.
 *
 * Canh giữ đúng chỗ dễ trượt: THU HỒI là hành động không hoàn tác lên giấy tờ đã trao tay, nên nó phải
 * đi qua `ConfirmDialog` có nêu hệ quả và đòi lý do — không `window.confirm`, không thu hồi một-cú-bấm.
 * Test đọc catalog THẬT (không mock key-as-string) để chuỗi hệ quả thực sự tồn tại trong `org.vi.json`
 * chứ không chỉ là một khoá i18n nào đó render ra đường dẫn khoá.
 */
import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next-intl', async () => (await import('@/test/intlCatalog')).nextIntlCatalogMock())

const listOrgReportIssues = vi.fn()
const revokeOrgReportIssue = vi.fn()
vi.mock('@/lib/reportIssueApi', async () => {
  const actual = await vi.importActual<typeof import('@/lib/reportIssueApi')>('@/lib/reportIssueApi')
  return {
    ...actual,
    listOrgReportIssues: (...args: unknown[]) => listOrgReportIssues(...args),
    revokeOrgReportIssue: (...args: unknown[]) => revokeOrgReportIssue(...args),
  }
})

import { StudentReportIssuesSection } from './StudentReportIssuesSection'
import type { ReportIssueSummary } from '@/lib/reportIssueApi'

const row = (over: Partial<ReportIssueSummary> = {}): ReportIssueSummary => ({
  id: 11,
  classId: 5,
  className: 'B1-01',
  studentId: 42,
  studentName: 'Nguyễn Đức',
  period: 'FINAL',
  lang: 'vi',
  status: 'ACTIVE',
  issuedAt: '2026-09-11T02:00:00Z',
  issuedByName: 'Cô Lan',
  tokenExpiresAt: '2026-10-11T02:00:00Z',
  revokedAt: null,
  revokeReason: null,
  viewCount: 3,
  lastViewedAt: null,
  token: 'a'.repeat(40),
  publicPath: `/phieu/${'a'.repeat(40)}?lang=vi`,
  verificationCode: 'AAAAAAAA',
  ...over,
})

describe('StudentReportIssuesSection — sổ phiếu + thu hồi', () => {
  beforeEach(() => {
    listOrgReportIssues.mockReset()
    revokeOrgReportIssue.mockReset()
  })

  it('liệt kê phiếu đã phát hành kèm trạng thái và số lượt mở', async () => {
    listOrgReportIssues.mockResolvedValue({ items: [row()], total: 1, page: 0, size: 20 })
    render(<StudentReportIssuesSection studentId={42} />)

    expect(await screen.findByText('Cuối khoá')).toBeInTheDocument()
    expect(screen.getByText('Còn hiệu lực')).toBeInTheDocument()
    expect(screen.getByText(/3 lượt mở/)).toBeInTheDocument()
  })

  it('chưa có phiếu nào ⇒ nói rõ thay vì bảng trống', async () => {
    listOrgReportIssues.mockResolvedValue({ items: [], total: 0, page: 0, size: 20 })
    render(<StudentReportIssuesSection studentId={42} />)

    expect(await screen.findByText('Chưa có phiếu nào được phát hành cho học viên này.')).toBeInTheDocument()
  })

  it('bấm Thu hồi mở ConfirmDialog nêu hệ quả — KHÔNG thu hồi ngay', async () => {
    listOrgReportIssues.mockResolvedValue({ items: [row()], total: 1, page: 0, size: 20 })
    render(<StudentReportIssuesSection studentId={42} />)

    fireEvent.click(await screen.findByRole('button', { name: /Thu hồi/ }))

    expect(await screen.findByText('Thu hồi phiếu đánh giá?')).toBeInTheDocument()
    expect(
      screen.getByText('Link công khai ngừng hoạt động ngay; người mở sẽ thấy trang không tồn tại.'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Bản PDF trung tâm đã gửi cho gia đình thì KHÔNG thu lại được.'),
    ).toBeInTheDocument()
    expect(revokeOrgReportIssue).not.toHaveBeenCalled()
  })

  it('nút xác nhận bị khoá đến khi lý do đủ dài; xác nhận thì gửi đúng lý do', async () => {
    listOrgReportIssues.mockResolvedValue({ items: [row()], total: 1, page: 0, size: 20 })
    revokeOrgReportIssue.mockResolvedValue(row({ status: 'REVOKED', revokedAt: '2026-09-12T01:00:00Z', publicPath: null, token: null }))
    render(<StudentReportIssuesSection studentId={42} />)

    fireEvent.click(await screen.findByRole('button', { name: /Thu hồi/ }))
    const confirm = await screen.findByRole('button', { name: 'Thu hồi phiếu' })
    expect(confirm).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Lý do thu hồi'), { target: { value: 'abc' } })
    expect(confirm).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Lý do thu hồi'), { target: { value: 'Nhập nhầm điểm chuyên cần' } })
    expect(confirm).not.toBeDisabled()

    fireEvent.click(confirm)
    await waitFor(() => expect(revokeOrgReportIssue).toHaveBeenCalledWith(11, 'Nhập nhầm điểm chuyên cần'))
    expect(await screen.findByText('Đã thu hồi')).toBeInTheDocument()
  })

  it('phiếu đã thu hồi không còn nút thu hồi và không còn link để sao chép', async () => {
    listOrgReportIssues.mockResolvedValue({
      items: [row({ status: 'REVOKED', revokedAt: '2026-09-12T01:00:00Z', publicPath: null, token: null })],
      total: 1, page: 0, size: 20,
    })
    render(<StudentReportIssuesSection studentId={42} />)

    expect(await screen.findByText('Đã thu hồi')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Thu hồi/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Sao chép link/ })).not.toBeInTheDocument()
  })
})
