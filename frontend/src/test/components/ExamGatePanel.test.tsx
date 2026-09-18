/**
 * Bảng hai ngưỡng đỗ trên màn kết quả. Ca quan trọng nhất là ca "mới thi một nửa": phải nói rõ
 * phần viết đã ĐẠT, phần nói CHƯA THI, và chỉ đường đi tiếp — không được để người học đọc ra
 * chữ "Trượt" dưới một bài viết gần như tuyệt đối.
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ExamGatePanel } from '@/components/exam/telc/ExamGatePanel'

vi.mock('next-intl', async () => {
  const { catalogT } = await import('@/test/intlCatalog')
  return { useTranslations: (ns?: string) => catalogT(ns, 'vi'), useLocale: () => 'vi' }
})
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}))

describe('bảng hai ngưỡng đỗ', () => {
  it('mới thi viết: nói rõ phần viết ĐẠT, phần nói CHƯA THI, và chỉ đường đi thi nói', () => {
    render(
      <ExamGatePanel
        gates={[
          { id: 'written', raw: 180, max: 225, min: 135, status: 'PASSED' },
          { id: 'oral', raw: 0, max: 75, min: 45, status: 'PENDING' },
        ]}
      />,
    )

    expect(screen.getByText('Phần viết')).toBeInTheDocument()
    expect(screen.getByText('180/225 điểm · cần 135')).toBeInTheDocument()
    expect(screen.getByText('Đạt')).toBeInTheDocument()

    expect(screen.getByText('Phần nói')).toBeInTheDocument()
    expect(screen.getByText('Chưa thi')).toBeInTheDocument()
    expect(screen.getByText('Cần 45/75 điểm')).toBeInTheDocument()

    const nut = screen.getByRole('link', { name: 'Thi phần nói' })
    expect(nut).toHaveAttribute('href', '/v2/student/exam')
    expect(screen.queryByText('Chưa đạt')).not.toBeInTheDocument()
  })

  it('đã thi nói thì nói rõ điểm đó lấy từ lần thi ngày nào', () => {
    render(
      <ExamGatePanel
        gates={[
          { id: 'written', raw: 180, max: 225, min: 135, status: 'PASSED' },
          { id: 'oral', raw: 60, max: 75, min: 45, status: 'PASSED', sourceId: 42, achievedAt: '2026-09-15T08:30:00Z' },
        ]}
      />,
    )

    expect(screen.getByText(/Lấy từ lần thi nói ngày/)).toBeInTheDocument()
    expect(screen.getByText('60/75 điểm · cần 45')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Thi phần nói' })).not.toBeInTheDocument()
  })

  it('trượt phần nói thì hiện CHƯA ĐẠT, không hiện chưa thi', () => {
    render(
      <ExamGatePanel
        gates={[
          { id: 'written', raw: 180, max: 225, min: 135, status: 'PASSED' },
          { id: 'oral', raw: 40, max: 75, min: 45, status: 'FAILED' },
        ]}
      />,
    )

    expect(screen.getByText('Chưa đạt')).toBeInTheDocument()
    expect(screen.queryByText('Chưa thi')).not.toBeInTheDocument()
  })

  it('cổng lạ dùng nhãn chung, không in khoá máy ra màn hình', () => {
    render(<ExamGatePanel gates={[{ id: 'ein_neues_tor', raw: 5, max: 10, min: 6, status: 'FAILED' }]} />)

    expect(screen.getByText('Phần khác')).toBeInTheDocument()
    expect(screen.queryByText(/ein_neues_tor/)).not.toBeInTheDocument()
  })

  it('không có cổng nào thì không dựng gì — đề Goethe không thấy bảng này', () => {
    const { container } = render(<ExamGatePanel gates={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})
