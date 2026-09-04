/**
 * S-04 / B-17 — hợp đồng của vỏ bài học.
 *
 * Hai điều bộ test này giữ:
 *  · **Không ô nào được vẽ khi không có dữ liệu.** `estimatedMinutes` là cột NULLABLE và
 *    `content.overview.vi` có thể vắng — in "~0 phút" hay một ô mục tiêu rỗng là bịa, cùng loại với
 *    "Câu 3/8" đã bị loại ở S-06.
 *  · **Thứ tự heading và đường bàn phím ổn định** ở mọi skill view (plan §Accessibility): shell
 *    luôn là nơi phát <h1>, và nút thoát luôn tồn tại.
 *
 * next-intl mock trả thẳng key (parity các test component hiện có).
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { LessonShell } from '@/components/learn/LessonShell'

vi.mock('next-intl', () => ({ useTranslations: () => (k: string) => k }))

const base = {
  mode: 'learn' as const,
  title: 'Giới thiệu bản thân',
  onExit: () => {},
  children: <p>nội dung bài</p>,
}

describe('LessonShell — chỉ vẽ ô có dữ liệu', () => {
  it('thiếu thời lượng thì KHÔNG có ô thời lượng', () => {
    render(<LessonShell {...base} estimatedMinutes={null} />)
    expect(screen.queryByText('minutes')).not.toBeInTheDocument()
  })

  it('thời lượng 0 cũng coi như không có — không in "~0 phút"', () => {
    render(<LessonShell {...base} estimatedMinutes={0} />)
    expect(screen.queryByText('minutes')).not.toBeInTheDocument()
  })

  it('có thời lượng dương thì mới hiện', () => {
    render(<LessonShell {...base} estimatedMinutes={12} />)
    expect(screen.getByText('minutes')).toBeInTheDocument()
  })

  it('thiếu mục tiêu thì không dựng dòng mục tiêu rỗng', () => {
    render(<LessonShell {...base} objective={null} />)
    expect(screen.queryByText(/objective/)).not.toBeInTheDocument()
  })

  it('thiếu tiến độ thì không có thanh tiến độ', () => {
    render(<LessonShell {...base} progress={null} />)
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })

  it('tổng bước bằng 0 cũng không dựng thanh — chia cho 0 là một thanh vô nghĩa', () => {
    render(<LessonShell {...base} progress={{ current: 0, total: 0 }} />)
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })
})

describe('LessonShell — tiến độ đọc được, không chỉ nhìn được', () => {
  it('thanh tiến độ mang giá trị máy đọc được', () => {
    render(<LessonShell {...base} progress={{ current: 3, total: 7 }} />)
    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuenow', '3')
    expect(bar).toHaveAttribute('aria-valuemax', '7')
  })

  it('nhãn bước nằm trong vùng aria-live để đổi bước là nghe được', () => {
    render(<LessonShell {...base} progress={{ current: 3, total: 7 }} />)
    expect(screen.getByText('step').closest('[aria-live]')).not.toBeNull()
  })
})

describe('LessonShell — thoát và chuyển chế độ', () => {
  it('luôn có nút thoát và bấm được', async () => {
    const onExit = vi.fn()
    const user = userEvent.setup()
    render(<LessonShell {...base} onExit={onExit} />)
    await user.click(screen.getByRole('button', { name: 'exit' }))
    expect(onExit).toHaveBeenCalledOnce()
  })

  it('không truyền onModeChange thì KHÔNG dựng segmented (chưa có đường sang chế độ kia)', () => {
    render(<LessonShell {...base} />)
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
  })

  it('có onModeChange thì segmented gọi đúng chế độ được chọn', async () => {
    const onModeChange = vi.fn()
    const user = userEvent.setup()
    render(<LessonShell {...base} onModeChange={onModeChange} />)
    await user.click(screen.getByRole('tab', { name: 'modePractice' }))
    expect(onModeChange).toHaveBeenCalledWith('practice')
  })

  it('chế độ đang mở được khai bằng aria-selected, không chỉ bằng màu', () => {
    render(<LessonShell {...base} mode="practice" onModeChange={() => {}} />)
    expect(screen.getByRole('tab', { name: 'modePractice' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'modeLearn' })).toHaveAttribute('aria-selected', 'false')
  })
})

describe('LessonShell — khung trang', () => {
  it('tiêu đề bài là h1 duy nhất, để thứ tự heading ổn định giữa các skill view', () => {
    render(<LessonShell {...base} />)
    const h1s = screen.getAllByRole('heading', { level: 1 })
    expect(h1s).toHaveLength(1)
    expect(h1s[0]).toHaveTextContent('Giới thiệu bản thân')
  })

  it('nội dung bài luôn được render', () => {
    render(<LessonShell {...base} />)
    expect(screen.getByText('nội dung bài')).toBeInTheDocument()
  })

  it('không có aside thì không dựng cột phản hồi rỗng', () => {
    const { container } = render(<LessonShell {...base} />)
    expect(container.querySelector('aside')).toBeNull()
  })

  it('có aside thì render trong một <aside> riêng', () => {
    render(<LessonShell {...base} aside={<p>phản hồi</p>} />)
    expect(screen.getByText('phản hồi').closest('aside')).not.toBeNull()
  })
})
