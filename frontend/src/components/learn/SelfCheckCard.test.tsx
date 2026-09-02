import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import SelfCheckCard from '@/components/learn/SelfCheckCard'
import type { SelfCheckItem } from '@/lib/nodeExercises'

vi.mock('@/lib/haptics', () => ({ lightImpact: vi.fn() }))

/**
 * Bài học từ QA 2026-09-02: hai loại này TỪNG được render nhưng ra thành dòng TRỐNG (chúng không có
 * trường `question*`), và unit test thuần không bắt được vì lỗi nằm ở khâu hiển thị. Nên thẻ này
 * phải có test dựng thật, khẳng định luôn CÓ nội dung nhìn thấy được.
 */

const DICH: SelfCheckItem = {
  id: 'p31_01',
  kind: 'TRANSLATE',
  prompt: 'Tôi giúp người đàn ông.',
  words: null,
  answer: 'Ich helfe dem Mann.',
}

const SAP_XEP: SelfCheckItem = {
  id: 'p31_02',
  kind: 'REORDER',
  prompt: 'Quyển sách là của tôi.',
  words: ['gehört', 'Das', 'Buch', 'mir'],
  answer: 'Das Buch gehört mir',
}

describe('SelfCheckCard', () => {
  test('hiện đề bài dịch câu — không còn là dòng trống', () => {
    render(<SelfCheckCard item={DICH} index={6} />)
    expect(screen.getByText('Tôi giúp người đàn ông.')).toBeInTheDocument()
    expect(screen.getByText('Dịch câu')).toBeInTheDocument()
  })

  test('đáp án bị ẩn cho tới khi người học tự bấm xem', async () => {
    render(<SelfCheckCard item={DICH} index={6} />)
    expect(screen.queryByText('Ich helfe dem Mann.')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /Xem đáp án/ }))

    expect(screen.getByText('Ich helfe dem Mann.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Xem đáp án/ })).not.toBeInTheDocument()
  })

  test('sắp xếp câu: hiện đủ các từ cần sắp xếp', () => {
    render(<SelfCheckCard item={SAP_XEP} index={7} />)
    expect(screen.getByText('Sắp xếp câu')).toBeInTheDocument()
    for (const w of SAP_XEP.words!) {
      expect(screen.getByText(w)).toBeInTheDocument()
    }
  })

  test('nói rõ là không tính điểm — để người học không tưởng mình đang bị chấm', () => {
    render(<SelfCheckCard item={SAP_XEP} index={7} />)
    expect(screen.getByText(/không tính điểm/)).toBeInTheDocument()
  })

  test('KHÔNG có ô nhập nào — chính ô nhập trống là thứ từng chặn nút nộp bài', () => {
    const { container } = render(<SelfCheckCard item={DICH} index={6} />)
    expect(container.querySelectorAll('input')).toHaveLength(0)
  })

  test('số thứ tự tiếp nối phần bài chấm điểm', () => {
    render(<SelfCheckCard item={DICH} index={6} />)
    expect(screen.getByText('6.')).toBeInTheDocument()
  })
})
