/**
 * LT1 — khối "Ngân sách điểm" trên màn kết quả đề telc. Dữ liệu giống ca backend
 * ExamBudgetServiceTest: mất 48,5/300, Nói và Viết mỗi phần mất 15, Hören Teil 1 mất 10.
 */
import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ExamBudgetPanel } from '@/components/exam/telc/ExamBudgetPanel'
import { ExamGatePanel } from '@/components/exam/telc/ExamGatePanel'
import { defaultTarget, type ExamBudget } from '@/components/exam/telc/examBudget'

vi.mock('next-intl', async () => {
  const { catalogT } = await import('@/test/intlCatalog')
  return { useTranslations: (ns?: string) => catalogT(ns, 'vi'), useLocale: () => 'vi' }
})
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}))

const share = (gut: boolean) => [
  { section: 'LESEN', max: 75, maxLoss: gut ? 15 : 7.5 },
  { section: 'SPRACHBAUSTEINE', max: 30, maxLoss: gut ? 6 : 3 },
  { section: 'HOEREN', max: 75, maxLoss: gut ? 15 : 7.5 },
  { section: 'SCHREIBEN', max: 45, maxLoss: gut ? 9 : 4.5 },
  { section: 'SPRECHEN', max: 75, maxLoss: gut ? 15 : 7.5 },
]

const BUDGET: ExamBudget = {
  totalMax: 300,
  earned: 251.5,
  lost: 48.5,
  pending: false,
  losses: [
    { section: 'SPRECHEN', max: 75, earned: 60, lost: 15, pending: false },
    { section: 'SCHREIBEN', max: 45, earned: 30, lost: 15, pending: false },
    { section: 'HOEREN', teil: 1, max: 25, earned: 15, lost: 10, pointPerItem: 5, items: 5, correct: 3, pending: false },
    { section: 'SPRACHBAUSTEINE', teil: 1, max: 15, earned: 9, lost: 6, pointPerItem: 1.5, items: 10, correct: 6, pending: false },
    { section: 'LESEN', teil: 1, max: 25, earned: 25, lost: 0, pointPerItem: 5, items: 5, correct: 5, pending: false },
  ],
  targets: [
    { grade: 'SEHR_GUT', minPoints: 270, maxLoss: 30, remaining: -18.5, example: share(false) },
    { grade: 'GUT', minPoints: 240, maxLoss: 60, remaining: 11.5, example: share(true) },
    { grade: 'BEFRIEDIGEND', minPoints: 210, maxLoss: 90, remaining: 41.5, example: [] },
    { grade: 'AUSREICHEND', minPoints: 180, maxLoss: 120, remaining: 71.5, example: [] },
  ],
}

describe('ngân sách điểm (LT1)', () => {
  it('xếp Teil theo điểm mất, ghi trọng số câu; chọn sẵn mức cao nhất còn trong ngân sách', () => {
    render(<ExamBudgetPanel budget={BUDGET} />)

    expect(screen.getByText('Đã mất 48,5/300 điểm')).toBeInTheDocument()
    const labels = screen.getAllByText(/Nói|Viết|Nghe hiểu · Teil 1|Ngữ pháp – từ vựng · Teil 1|Đọc hiểu · Teil 1/)
      .map((n) => n.textContent)
    expect(labels.slice(0, 5)).toEqual(['Nói', 'Viết', 'Nghe hiểu · Teil 1', 'Ngữ pháp – từ vựng · Teil 1', 'Đọc hiểu · Teil 1'])
    expect(screen.getByText('3/5 câu đúng · 5 điểm/câu')).toBeInTheDocument()
    expect(screen.getByText('6/10 câu đúng · 1,5 điểm/câu')).toBeInTheDocument()
    expect(screen.getByText('−10')).toBeInTheDocument()
    expect(screen.getByText('Không mất điểm')).toBeInTheDocument()

    // Mặc định: gut (sehr gut đã vượt ngân sách).
    expect(screen.getByRole('radio', { name: 'gut (giỏi)' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByText('Để đạt gut (giỏi) (từ 240/300 điểm), bạn được mất tối đa 60 điểm.')).toBeInTheDocument()
    expect(screen.getByText('Bài này đã mất 48,5 điểm, còn dư 11,5 điểm.')).toBeInTheDocument()
    expect(screen.getByText('Viết: mất tối đa 9')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('radio', { name: 'sehr gut (rất giỏi)' }))
    expect(screen.getByText('Bài này đã mất 48,5 điểm, vượt ngân sách 18,5 điểm.')).toBeInTheDocument()
    expect(screen.getByText('Viết: mất tối đa 4,5')).toBeInTheDocument()
  })

  it('phần chưa chấm: ghi rõ lý do, không có số điểm mất', () => {
    render(<ExamBudgetPanel budget={{
      ...BUDGET,
      pending: true,
      lost: 5,
      losses: [
        { section: 'LESEN', teil: 1, max: 25, earned: 20, lost: 5, pointPerItem: 5, items: 5, correct: 4, pending: false },
        { section: 'SCHREIBEN', max: 45, pending: true },
        { section: 'SPRECHEN', max: 75, pending: true },
      ],
      targets: [],
    }} />)

    expect(screen.getByText('Bài viết đang chờ chấm')).toBeInTheDocument()
    expect(screen.getByText('Chưa thi Nói')).toBeInTheDocument()
    expect(screen.getByText(/chưa gồm phần chưa chấm/)).toBeInTheDocument()
    expect(screen.queryByText('Mục tiêu xếp loại')).not.toBeInTheDocument()
  })

  it('mặc định: vượt mọi mức thì chọn mức thấp nhất; không có mức nào thì null', () => {
    expect(defaultTarget(BUDGET.targets.map((x) => ({ ...x, remaining: -1 })))).toBe('AUSREICHEND')
    expect(defaultTarget([])).toBeNull()
  })

  it('bảng cổng: ghi khoảng cách tới ngưỡng', () => {
    render(<ExamGatePanel gates={[
      { id: 'written', raw: 180, max: 225, min: 135, status: 'PASSED' },
      { id: 'oral', raw: 40, max: 75, min: 45, status: 'FAILED' },
    ]} />)
    expect(screen.getByText('Cao hơn ngưỡng 45 điểm')).toBeInTheDocument()
    expect(screen.getByText('Còn thiếu 5 điểm để qua ngưỡng')).toBeInTheDocument()
  })
})
