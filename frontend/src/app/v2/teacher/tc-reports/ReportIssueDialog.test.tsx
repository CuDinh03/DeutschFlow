/**
 * Hộp thoại phát hành phiếu gửi gia đình (PR-R3).
 *
 * Canh ba việc: (1) kỳ và ngôn ngữ người dùng chọn phải đi ĐÚNG như thế vào lời gọi phát hành — chọn
 * sai kỳ là đóng băng vĩnh viễn một tờ phiếu sai; (2) xem trước phải render đúng thứ tiếng vừa chọn,
 * vì đó là toàn bộ lý do ô xem trước tồn tại; (3) phát hành LẠI cùng kỳ phải cảnh báo trước, bởi
 * backend sẽ giết link cũ ngay lập tức và không ai lấy lại được.
 */
import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next-intl', async () => (await import('@/test/intlCatalog')).nextIntlCatalogMock())
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const issueReport = vi.fn()
const listReportIssues = vi.fn()
vi.mock('@/lib/reportIssueApi', async () => {
  const actual = await vi.importActual<typeof import('@/lib/reportIssueApi')>('@/lib/reportIssueApi')
  return {
    ...actual,
    issueReport: (...a: unknown[]) => issueReport(...a),
    listReportIssues: (...a: unknown[]) => listReportIssues(...a),
    downloadReportPdf: vi.fn(),
  }
})

import { ReportIssueDialog } from './ReportIssueDialog'
import { buildPreviewPayload } from './reportPreview'
import type { ReportIssueSummary } from '@/lib/reportIssueApi'
import type { StudentEvaluation } from '@/lib/teacherEvaluationApi'

const evaluation: StudentEvaluation = {
  studentId: 42,
  name: 'Nguyễn Đức',
  email: 'duc@example.com',
  classId: 5,
  className: 'B1-01',
  teacherComment: 'Phát âm tiến bộ rõ.',
  skillHoren: 8.5,
  skillLesen: 7,
  skillSchreiben: 6,
  skillSprechen: 9.2,
  avgScore: 81,
  recordedSessions: 21,
  presentCount: 18,
  absentCount: 1,
  lateCount: 2,
  certificateEligible: true,
  evaluatedAt: '2026-09-10T10:00:00Z',
}

const summary = (over: Partial<ReportIssueSummary> = {}): ReportIssueSummary => ({
  id: 11, classId: 5, className: 'B1-01', studentId: 42, studentName: 'Nguyễn Đức',
  period: 'MIDTERM', lang: 'vi', status: 'ACTIVE', issuedAt: '2026-09-01T02:00:00Z',
  issuedByName: 'Cô Lan', tokenExpiresAt: '2026-10-01T02:00:00Z', revokedAt: null,
  revokeReason: null, viewCount: 0, lastViewedAt: null, token: 'a'.repeat(40),
  publicPath: `/phieu/${'a'.repeat(40)}?lang=vi`, verificationCode: 'AAAAAAAA', ...over,
})

describe('ReportIssueDialog — phát hành phiếu', () => {
  beforeEach(() => {
    issueReport.mockReset()
    listReportIssues.mockReset()
    listReportIssues.mockResolvedValue([])
  })

  it('phát hành với đúng kỳ và ngôn ngữ người dùng chọn', async () => {
    issueReport.mockResolvedValue({ issue: summary({ period: 'FINAL', lang: 'de' }), payload: buildPreviewPayload(evaluation, 'FINAL', 'de', '2026-09-11T02:00:00Z') })
    render(<ReportIssueDialog open onOpenChange={() => {}} classId={5} evaluation={evaluation} />)

    fireEvent.click(await screen.findByRole('tab', { name: 'Cuối khoá' }))
    fireEvent.click(screen.getByRole('tab', { name: 'Deutsch' }))
    fireEvent.click(screen.getByRole('button', { name: 'Phát hành' }))

    await waitFor(() => expect(issueReport).toHaveBeenCalledWith(5, 42, 'FINAL', 'de'))
  })

  it('xem trước render tờ phiếu bằng đúng thứ tiếng đang chọn', async () => {
    render(<ReportIssueDialog open onOpenChange={() => {}} classId={5} evaluation={evaluation} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Xem trước phiếu' }))
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Phiếu đánh giá kết quả học tập')

    fireEvent.click(screen.getByRole('tab', { name: 'Deutsch' }))
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Lernstandsbericht')
  })

  it('bản xem trước nói rõ nó là bản dựng tại chỗ, không phải nội dung sẽ đóng băng', async () => {
    render(<ReportIssueDialog open onOpenChange={() => {}} classId={5} evaluation={evaluation} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Xem trước phiếu' }))
    expect(screen.getByText(/Bản xem trước dựng từ số liệu đang hiển thị/)).toBeInTheDocument()
  })

  it('kỳ đã có phiếu còn hiệu lực ⇒ cảnh báo link cũ sẽ chết và nút đổi thành "Phát hành lại"', async () => {
    listReportIssues.mockResolvedValue([summary({ period: 'MIDTERM', status: 'ACTIVE' })])
    render(<ReportIssueDialog open onOpenChange={() => {}} classId={5} evaluation={evaluation} />)

    expect(await screen.findByRole('button', { name: 'Phát hành lại' })).toBeInTheDocument()
    expect(screen.getByText(/link cũ ngừng hoạt động ngay/)).toBeInTheDocument()

    // Đổi sang kỳ chưa có phiếu thì cảnh báo biến mất.
    fireEvent.click(screen.getByRole('tab', { name: 'Cuối khoá' }))
    expect(screen.getByRole('button', { name: 'Phát hành' })).toBeInTheDocument()
  })

  it('sau khi phát hành: hiện link công khai và nói rõ DeutschFlow không gửi gì cho phụ huynh', async () => {
    issueReport.mockResolvedValue({ issue: summary(), payload: buildPreviewPayload(evaluation, 'MIDTERM', 'vi', '2026-09-11T02:00:00Z') })
    render(<ReportIssueDialog open onOpenChange={() => {}} classId={5} evaluation={evaluation} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Phát hành' }))

    expect(await screen.findByText(/DeutschFlow không gửi gì cho phụ huynh/)).toBeInTheDocument()
    expect(screen.getByText(new RegExp(`/phieu/${'a'.repeat(40)}`))).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Tải PDF/ })).toBeInTheDocument()
  })
})

describe('buildPreviewPayload — số liệu của bản xem trước', () => {
  it('xếp loại theo đúng ngưỡng của backend và điểm tổng là trung bình kỹ năng ĐÃ có điểm', () => {
    const p = buildPreviewPayload(evaluation, 'FINAL', 'vi', '2026-09-11T02:00:00Z')
    expect(p.skills.map((s) => s.grade)).toEqual(['GOOD', 'FAIR', 'AVERAGE', 'EXCELLENT'])
    expect(p.overall.score).toBe(7.7)
    expect(p.attendance.ratePct).toBe(95)
  })

  it('chưa chấm kỹ năng nào ⇒ điểm tổng TRỐNG, không phải 0', () => {
    const p = buildPreviewPayload(
      { ...evaluation, skillHoren: null, skillLesen: null, skillSchreiben: null, skillSprechen: null },
      'MIDTERM', 'vi', '2026-09-11T02:00:00Z',
    )
    expect(p.overall.score).toBeNull()
    expect(p.overall.grade).toBeNull()
  })

  it('kỳ GIỮA khoá không mang khối chứng nhận (R10: chỉ in ở phiếu cuối khoá)', () => {
    expect(buildPreviewPayload(evaluation, 'MIDTERM', 'vi', '2026-09-11T02:00:00Z').certificate).toBeNull()
    expect(buildPreviewPayload(evaluation, 'FINAL', 'vi', '2026-09-11T02:00:00Z').certificate).not.toBeNull()
  })

  it('không mang email học viên vào payload dù dòng đánh giá có (R4)', () => {
    const p = buildPreviewPayload(evaluation, 'FINAL', 'vi', '2026-09-11T02:00:00Z')
    expect(JSON.stringify(p)).not.toContain('duc@example.com')
  })
})
