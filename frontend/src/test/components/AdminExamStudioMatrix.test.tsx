/**
 * Xưởng đề — ô ma trận độ khó render với catalog vi THẬT: tổng trực tiếp, lỗi tổng ≠ số câu (Đề thi thử),
 * cảnh báo Siêu khó > 1, mẫu nhanh đổi ma trận.
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { NextIntlClientProvider } from 'next-intl'
import adminContentVi from '../../../messages/v2/adminContent.vi.json'
import { DifficultyMatrix } from '@/components/admin/exam-studio/DifficultyMatrix'
import type { DifficultyPlan } from '@/lib/adminExamStudioApi'

function renderMatrix(plan: DifficultyPlan, mode: 'EXAM' | 'PRACTICE', onChange = vi.fn()) {
  render(
    <NextIntlClientProvider locale="vi" messages={{ v2: adminContentVi }}>
      <DifficultyMatrix plan={plan} onChange={onChange} mode={mode} itemCount={5} />
    </NextIntlClientProvider>,
  )
  return onChange
}

describe('DifficultyMatrix', () => {
  it('Đề thi thử tổng ≠ 5 → báo lỗi', () => {
    renderMatrix({ EASY: 3, MEDIUM: 2, HARD: 1, EXPERT: 0 }, 'EXAM')
    expect(screen.getByText('Tổng = 6 / 5')).toBeInTheDocument()
    expect(screen.getByText('Đề thi thử phải có đúng 5 câu.')).toBeInTheDocument()
  })

  it('Đề thi thử > 1 câu Siêu khó → cảnh báo vàng; bài luyện thì không', () => {
    renderMatrix({ EASY: 0, MEDIUM: 1, HARD: 2, EXPERT: 2 }, 'EXAM')
    expect(screen.getByText(/khó hơn đề thật/)).toBeInTheDocument()
  })

  it('bài luyện không cảnh báo Siêu khó', () => {
    renderMatrix({ EASY: 0, MEDIUM: 1, HARD: 2, EXPERT: 2 }, 'PRACTICE')
    expect(screen.queryByText(/khó hơn đề thật/)).not.toBeInTheDocument()
  })

  it('bấm mẫu nhanh và nút tăng gọi onChange với ma trận mới', async () => {
    const onChange = renderMatrix({ EASY: 2, MEDIUM: 2, HARD: 1, EXPERT: 0 }, 'EXAM')
    await userEvent.click(screen.getByRole('button', { name: /Nước rút/ }))
    expect(onChange).toHaveBeenLastCalledWith({ EASY: 1, MEDIUM: 1, HARD: 2, EXPERT: 1 })
    await userEvent.click(screen.getByRole('button', { name: 'Thêm một câu Siêu khó' }))
    expect(onChange).toHaveBeenLastCalledWith({ EASY: 2, MEDIUM: 2, HARD: 1, EXPERT: 1 })
  })
})
