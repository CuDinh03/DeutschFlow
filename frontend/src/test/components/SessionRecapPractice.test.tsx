/**
 * L3c — màn tổng kết bài mời luyện đúng kỹ năng còn yếu của node vừa học.
 *
 * Trước đó người học xong bài chỉ có hai lối: sang bài kế hoặc về lộ trình. Nếu một kỹ năng của
 * node chưa đạt ngưỡng thì không có gì dẫn họ quay lại đúng kỹ năng đó. Hàng nút mới chỉ hiện khi
 * caller thật sự biết kỹ năng nào yếu — không có thì màn tổng kết giữ nguyên như cũ.
 *
 * next-intl mock đọc catalog THẬT để khẳng định theo đúng chữ người dùng nhìn thấy.
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import SessionRecap from '@/components/learn/SessionRecap'

vi.mock('next-intl', async () => (await import('@/test/intlCatalog')).nextIntlCatalogMock())

// SessionRecap tự điều hướng khi caller không truyền onBack/onNext — stub router cho jsdom.
const routerMock = { push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }
vi.mock('next/navigation', () => ({ useRouter: () => routerMock }))

const baseProps = {
  open: true,
  lessonTitle: 'Bảng chữ cái',
  xpEarned: 100,
  vocabCount: 8,
  streakDays: 2,
}

describe('SessionRecap — lời mời luyện kỹ năng còn yếu', () => {
  it('hiện nút luyện đúng kỹ năng được truyền vào', () => {
    render(<SessionRecap {...baseProps} practiceSkillLabel="Nói" onPractice={() => {}} />)

    expect(screen.getByRole('button', { name: /Luyện Nói ngay/i })).toBeInTheDocument()
  })

  it('bấm nút gọi đúng callback của caller', async () => {
    const onPractice = vi.fn()
    render(<SessionRecap {...baseProps} practiceSkillLabel="Đọc" onPractice={onPractice} />)

    await userEvent.click(screen.getByRole('button', { name: /Luyện Đọc ngay/i }))

    expect(onPractice).toHaveBeenCalledTimes(1)
  })

  it('không có kỹ năng yếu thì không thêm nút nào — màn tổng kết giữ nguyên', () => {
    render(<SessionRecap {...baseProps} />)

    expect(screen.queryByRole('button', { name: /Luyện/i })).not.toBeInTheDocument()
  })

  it('có nhãn kỹ năng nhưng thiếu callback thì cũng không hiện nút chết', () => {
    render(<SessionRecap {...baseProps} practiceSkillLabel="Viết" />)

    expect(screen.queryByRole('button', { name: /Luyện Viết ngay/i })).not.toBeInTheDocument()
  })
})
