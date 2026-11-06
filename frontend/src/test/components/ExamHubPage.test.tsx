/**
 * Trang Luyện thi `/v2/student/exam` (06/11/2026, owner chốt "bỏ toàn bộ phần luyện thi cũ").
 *
 * Một lối vào duy nhất: chỉ đề telc (Goethe ẩn trên web), mỗi đề có "Luyện từng Teil" và "Thi thử
 * trọn đề"; đề nháp "Sắp có" không có đường vào; lượt thi dở thì nút đổi thành "Làm tiếp"; lịch sử
 * thi thử mở màn kết quả mới.
 */
import React from 'react'
import { render, screen, within } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

const h = vi.hoisted(() => ({
  getMockPacks: vi.fn(),
  getMockPack: vi.fn(),
  getPracticeAccess: vi.fn(),
  getPracticeOverview: vi.fn(),
  listMyAttempts: vi.fn(),
}))

vi.mock('next-intl', async () => (await import('@/test/intlCatalog')).nextIntlCatalogMock('vi'))
vi.mock('@/lib/mockPackApi', () => ({ getMockPacks: h.getMockPacks, getMockPack: h.getMockPack }))
vi.mock('@/lib/telcPracticeApi', () => ({
  getPracticeAccess: h.getPracticeAccess,
  getPracticeOverview: h.getPracticeOverview,
}))
vi.mock('@/lib/exam/mockAttemptApi', () => ({ listMyAttempts: h.listMyAttempts }))

import V2StudentExamHubPage from '@/app/v2/student/exam/page'

function setup() {
  h.getPracticeAccess.mockResolvedValue(true)
  h.getMockPacks.mockResolvedValue([
    { id: 6, title: 'Luyện thi telc B1', descriptionVi: null, cefrLevel: 'B1', examFormat: 'TELC', examCount: 2, requiresPaid: false, locked: false },
    { id: 1, title: 'Goethe A1', descriptionVi: null, cefrLevel: 'A1', examFormat: 'GOETHE', examCount: 5, requiresPaid: false, locked: false },
  ])
  h.getMockPack.mockImplementation(async (id: number) =>
    id === 6
      ? {
          id: 6, title: 'Luyện thi telc B1', descriptionVi: null, cefrLevel: 'B1', examFormat: 'TELC',
          exams: [
            { id: 101, title: 'telc Deutsch B1 — Đề số 1', totalPoints: 300, passPoints: 180, timeLimitMinutes: 150, comingSoon: false },
            { id: 102, title: 'telc Deutsch B1 — Đề số 2', totalPoints: 300, passPoints: 180, timeLimitMinutes: 150, comingSoon: true },
          ],
        }
      : { id: 1, title: 'Goethe A1', descriptionVi: null, cefrLevel: 'A1', examFormat: 'GOETHE', exams: [{ id: 1, title: 'Goethe A1 — Set 1', totalPoints: 100, passPoints: 60, timeLimitMinutes: 80 }] },
  )
  h.getPracticeOverview.mockResolvedValue({ examId: 101, title: 'Đề 1', level: 'B1', format: 'TELC', sectionsJson: '{}', teile: [] })
  h.listMyAttempts.mockResolvedValue([
    { id: 900, exam_id: 101, exam_title: 'telc Deutsch B1 — Đề số 1', started_at: '2026-11-05T08:00:00Z', finished_at: '2026-11-05T10:30:00Z', total_score: 201, status: 'COMPLETED' },
    { id: 901, exam_id: 101, exam_title: 'telc Deutsch B1 — Đề số 1', started_at: '2026-11-06T08:00:00Z', status: 'IN_PROGRESS' },
    { id: 902, exam_id: 1, exam_title: 'Goethe A1 — Set 1', started_at: '2026-10-01T08:00:00Z', finished_at: '2026-10-01T09:00:00Z', total_score: 70, status: 'COMPLETED' },
  ])
}

describe('Trang Luyện thi — một luồng', () => {
  it('chỉ đề telc; mỗi đề hai lối vào, lượt dở thì "Làm tiếp"; Goethe không hiện', async () => {
    setup()
    render(<V2StudentExamHubPage />)

    const card = (await screen.findByRole('heading', { name: 'telc Deutsch B1 — Đề số 1' })).closest('article') as HTMLElement
    expect(within(card).getByRole('link', { name: /Luyện từng Teil/ })).toHaveAttribute('href', '/v2/student/mock-exam/practice?examId=101')
    expect(within(card).getByRole('link', { name: /Làm tiếp bài thi thử/ })).toHaveAttribute('href', '/v2/student/mock-exam/full?examId=101')
    expect(screen.queryByText('Goethe A1 — Set 1')).toBeNull()
    expect(h.getMockPack).not.toHaveBeenCalledWith(1)
  })

  it('đề nháp "Sắp có" không có đường vào; lịch sử chỉ lượt telc đã nộp, mở màn kết quả mới', async () => {
    setup()
    render(<V2StudentExamHubPage />)

    const draft = (await screen.findByRole('heading', { name: 'telc Deutsch B1 — Đề số 2' })).closest('article') as HTMLElement
    expect(within(draft).getByText('Sắp có')).toBeInTheDocument()
    expect(within(draft).queryByRole('link')).toBeNull()

    const history = screen.getByText('Lịch sử thi thử').parentElement as HTMLElement
    const links = within(history).getAllByRole('link')
    expect(links).toHaveLength(1)
    expect(links[0]).toHaveAttribute('href', '/v2/student/mock-exam/full?attemptId=900')
  })

  it('cờ luyện thi tắt ⇒ báo chưa mở, không có nút', async () => {
    setup()
    h.getPracticeAccess.mockResolvedValue(false)
    render(<V2StudentExamHubPage />)

    expect(await screen.findByText(/chưa mở cho tài khoản này/)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Luyện từng Teil/ })).toBeNull()
  })
})
