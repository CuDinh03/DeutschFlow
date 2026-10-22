/** LT2 — chiến thuật từng Teil: nội dung đã duyệt / nháp cho người duyệt / "Sắp có" cho học viên. */
import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const getMock = vi.fn()
vi.mock('@/lib/api', () => ({ default: { get: (...a: unknown[]) => getMock(...a) } }))
vi.mock('next-intl', async () => {
  const { catalogT } = await import('@/test/intlCatalog')
  return { useTranslations: (ns?: string) => catalogT(ns, 'vi'), useLocale: () => 'vi' }
})

import { TeilStrategy } from '@/components/exam/strategy/TeilStrategy'
import { clearStrategyCache } from '@/components/exam/strategy/examStrategy'
import { ExamBudgetPanel, strategyTeile } from '@/components/exam/telc/ExamBudgetPanel'

const CONTENT = {
  title: 'Nghe hiểu Teil 1 — 5 tin ngắn',
  format: '5 mẩu tin, nghe một lần.',
  steps: ['Đọc trước 5 câu.', 'Nghe ý chính.', 'Quyết định ngay.'],
  traps: ['Bẫy 1', 'Bẫy 2', 'Bẫy 3'],
  fixes: [{ cause: 'Nhầm số', fix: 'Nghe chép chính tả số.' }],
}

function reply(status: string, withContent = true) {
  getMock.mockResolvedValue({
    data: [{ section: 'HOEREN', teil: 1, points: 25, status, ...(withContent ? { content: CONTENT } : {}) }],
  })
}

describe('TeilStrategy (LT2)', () => {
  beforeEach(() => {
    getMock.mockReset()
    clearStrategyCache()
  })

  it('đã duyệt: thu gọn mặc định, mở ra thấy bước làm, bẫy, cách chữa; gọi đúng đề + ngôn ngữ', async () => {
    reply('REVIEWED')
    render(<TeilStrategy provider="TELC" level="B1" section="HOEREN" teil={1} />)

    const summary = await screen.findByText('Chiến thuật cho Teil này')
    expect(getMock).toHaveBeenCalledWith('/exam-strategies', { params: { provider: 'TELC', level: 'B1', lang: 'vi' } })
    expect(screen.queryByText('Nháp — chưa duyệt')).toBeNull()
    fireEvent.click(summary)
    expect(screen.getByText('Đọc trước 5 câu.')).toBeInTheDocument()
    expect(screen.getByText('Bẫy 2')).toBeInTheDocument()
    expect(screen.getByText('Nhầm số')).toBeInTheDocument()
  })

  it('nháp (người duyệt): có nhãn nháp; học viên: chỉ "sắp có", không nội dung', async () => {
    reply('DRAFT')
    const { unmount } = render(<TeilStrategy provider="TELC" level="B1" section="HOEREN" teil={1} />)
    expect(await screen.findByText('Nháp — chưa duyệt')).toBeInTheDocument()
    unmount()

    clearStrategyCache()
    reply('COMING_SOON', false)
    render(<TeilStrategy provider="TELC" level="B1" section="HOEREN" teil={1} />)
    expect(await screen.findByText('Chiến thuật cho Teil này: sắp có.')).toBeInTheDocument()
    expect(screen.queryByText('Đọc trước 5 câu.')).toBeNull()
  })

  it('không biết đề (thiếu bậc) hoặc API lỗi: không hiện gì, không làm hỏng trang', async () => {
    const { container } = render(<TeilStrategy provider="TELC" level={undefined} section="HOEREN" teil={1} />)
    expect(getMock).not.toHaveBeenCalled()
    expect(container.textContent).toBe('')

    getMock.mockRejectedValue(new Error('503'))
    const r2 = render(<TeilStrategy provider="TELC" level="B1" section="HOEREN" teil={2} />)
    await waitFor(() => expect(getMock).toHaveBeenCalled())
    expect(r2.container.textContent).toBe('')
  })

  it('dòng điểm mất của LT1 mở chiến thuật Teil đó; dòng cả phần Nói ứng với ba Teil', async () => {
    expect(strategyTeile({ section: 'HOEREN', teil: 1 })).toEqual([1])
    expect(strategyTeile({ section: 'SCHREIBEN' })).toEqual([1])
    expect(strategyTeile({ section: 'SPRECHEN' })).toEqual([1, 2, 3])

    reply('REVIEWED')
    render(
      <ExamBudgetPanel
        strategyExam={{ provider: 'TELC', level: 'B1' }}
        budget={{
          totalMax: 300, earned: 290, lost: 10, pending: false, targets: [],
          losses: [
            { section: 'HOEREN', teil: 1, max: 25, earned: 15, lost: 10, pointPerItem: 5, items: 5, correct: 3, pending: false },
            { section: 'LESEN', teil: 1, max: 25, earned: 25, lost: 0, pointPerItem: 5, items: 5, correct: 5, pending: false },
          ],
        }}
      />,
    )
    expect(await screen.findByText('Chiến thuật: Nghe hiểu · Teil 1')).toBeInTheDocument()
    // Dòng không mất điểm thì không kèm chiến thuật.
    expect(screen.queryByText('Chiến thuật: Đọc hiểu · Teil 1')).toBeNull()
  })
})
