/**
 * Đề thi thử nháp chờ duyệt ở `/v2/student/mock-exam` (26/10/2026, V342).
 *
 * Ba đề telc B1 Set 2–4 do AI soạn nháp nằm trong bộ đề với `comingSoon: true`. Học viên phải thấy
 * chúng gắn nhãn "Sắp có" kèm lời giải thích, và KHÔNG có đường vào phòng thi — đề chưa duyệt mà
 * làm được là hứa điều chưa có (sổ lời hứa). Đề đã duyệt trong cùng bộ vẫn giữ nút "Bắt đầu".
 */
import React from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'

const h = vi.hoisted(() => ({
  getMockPacks: vi.fn(),
  getMockPack: vi.fn(),
}))

vi.mock('next-intl', async () => (await import('@/test/intlCatalog')).nextIntlCatalogMock('vi'))

vi.mock('@/lib/mockPackApi', () => ({
  getMockPacks: h.getMockPacks,
  getMockPack: h.getMockPack,
}))

import V2StudentMockExamPage from '@/app/v2/student/mock-exam/page'

describe('Bộ đề thi thử — đề nháp hiện "Sắp có"', () => {
  it('đề nháp có nhãn và lời giải thích, không có nút Bắt đầu; đề đã duyệt vẫn làm được', async () => {
    h.getMockPacks.mockResolvedValue([
      { id: 6, title: 'Luyện thi telc B1', descriptionVi: null, cefrLevel: 'B1', examFormat: 'TELC', examCount: 1, requiresPaid: true, locked: false },
    ])
    h.getMockPack.mockResolvedValue({
      id: 6, title: 'Luyện thi telc B1', descriptionVi: null, cefrLevel: 'B1', examFormat: 'TELC',
      exams: [
        { id: 101, title: 'telc Deutsch B1 — Đề số 1', totalPoints: 225, passPoints: 135, timeLimitMinutes: 150, comingSoon: false },
        { id: 102, title: 'telc Deutsch B1 — Đề số 2', totalPoints: 225, passPoints: 135, timeLimitMinutes: 150, comingSoon: true },
      ],
    })

    render(<V2StudentMockExamPage />)
    await userEvent.click(await screen.findByText('Luyện thi telc B1'))

    const draftTitle = await screen.findByText('telc Deutsch B1 — Đề số 2')
    const draftRow = draftTitle.closest('div.border') as HTMLElement
    expect(within(draftRow).getByText('Sắp có')).toBeInTheDocument()
    expect(within(draftRow).getByText(/chờ duyệt nội dung/)).toBeInTheDocument()
    expect(within(draftRow).queryByRole('link')).toBeNull()

    const liveRow = screen.getByText('telc Deutsch B1 — Đề số 1').closest('div.border') as HTMLElement
    const start = within(liveRow).getByRole('link', { name: /Bắt đầu/ })
    expect(start).toHaveAttribute('href', '/v2/student/mock-exam/run?examId=101&level=B1')
    expect(within(liveRow).queryByText('Sắp có')).toBeNull()
  })
})
