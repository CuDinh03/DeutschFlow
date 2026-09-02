/**
 * GaNotificationToast — thẻ thông báo realtime thay toast sonner mặc định:
 *   • Portal scope contract (W0-C4): thẻ tự mang `.ga-scope` + data-role (sonner portal ngoài subtree).
 *   • Nội dung: kicker + "vừa xong", title, body; body rỗng thì không render node thừa.
 *   • CTA "Xem chi tiết" chỉ hiện khi có deep-link; nút đóng có aria-label + touch target 44px (F-06).
 *   • showGaNotificationToast: bắn qua toast.custom, CTA/đóng dismiss đúng id toast của mình.
 *
 * jsdom không tính px từ Tailwind class nên target-size khẳng định qua className —
 * cùng quy ước với GaWave0Primitives.test.tsx.
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  GaNotificationToast,
  showGaNotificationToast,
  type GaNotificationToastLabels,
} from '@/components/ui-v2/GaNotificationToast'
import { toast } from 'sonner'

vi.mock('sonner', () => ({
  toast: { custom: vi.fn(), dismiss: vi.fn() },
}))

const labels: GaNotificationToastLabels = {
  kicker: 'Thông báo',
  justNow: 'vừa xong',
  view: 'Xem chi tiết',
  close: 'Đóng thông báo',
}

const baseProps = {
  type: 'ADMIN_LEARNER_PLAN_CHANGED',
  title: 'Thay đổi gói học viên',
  body: 'Admin gán gói DEFAULT cho cunguyen@gmail.com (bởi admin@deutschflow.com).',
  role: 'admin' as const,
  labels,
}

describe('GaNotificationToast — thẻ trình bày', () => {
  it('mang .ga-scope + data-role để token resolve ngoài portal (W0-C4)', () => {
    const { container } = render(<GaNotificationToast {...baseProps} onClose={() => {}} />)
    const card = container.querySelector('.ga-scope')
    expect(card).not.toBeNull()
    expect(card!.getAttribute('data-role')).toBe('admin')
  })

  it('hiện kicker + thời điểm, tiêu đề và nội dung', () => {
    render(<GaNotificationToast {...baseProps} onClose={() => {}} />)
    expect(screen.getByText('Thông báo')).toBeInTheDocument()
    expect(screen.getByText('vừa xong')).toBeInTheDocument()
    expect(screen.getByText('Thay đổi gói học viên')).toBeInTheDocument()
    expect(screen.getByText(/Admin gán gói DEFAULT cho cunguyen@gmail.com/)).toBeInTheDocument()
  })

  it('không có deep-link → không render CTA; body rỗng → không render đoạn body', () => {
    render(<GaNotificationToast {...baseProps} body={null} onClose={() => {}} />)
    expect(screen.queryByRole('button', { name: 'Xem chi tiết' })).toBeNull()
    expect(screen.queryByText(/Admin gán gói/)).toBeNull()
  })

  it('CTA gọi onView; nút đóng gọi onClose và đạt touch target 44px + focus ring', async () => {
    const onView = vi.fn()
    const onClose = vi.fn()
    render(<GaNotificationToast {...baseProps} onView={onView} onClose={onClose} />)

    await userEvent.click(screen.getByRole('button', { name: 'Xem chi tiết' }))
    expect(onView).toHaveBeenCalledTimes(1)

    const close = screen.getByRole('button', { name: 'Đóng thông báo' })
    expect(close.className).toContain('h-11')
    expect(close.className).toContain('w-11')
    expect(close.className).toContain('focus-visible:ring-2')
    await userEvent.click(close)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('showGaNotificationToast — dây nối sonner', () => {
  beforeEach(() => {
    vi.mocked(toast.custom).mockClear()
    vi.mocked(toast.dismiss).mockClear()
  })

  it('bắn toast.custom với duration 8s; đóng/CTA dismiss đúng id của mình', async () => {
    const onView = vi.fn()
    showGaNotificationToast({ ...baseProps, onView })

    expect(toast.custom).toHaveBeenCalledTimes(1)
    const [renderFn, opts] = vi.mocked(toast.custom).mock.calls[0]
    expect(opts).toEqual({ duration: 8000, position: 'bottom-right' })

    render(<>{renderFn('toast-42')}</>)
    await userEvent.click(screen.getByRole('button', { name: 'Đóng thông báo' }))
    expect(toast.dismiss).toHaveBeenCalledWith('toast-42')

    await userEvent.click(screen.getByRole('button', { name: 'Xem chi tiết' }))
    expect(toast.dismiss).toHaveBeenCalledWith('toast-42')
    expect(onView).toHaveBeenCalledTimes(1)
  })
})
