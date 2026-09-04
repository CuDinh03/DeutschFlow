import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ConfirmDialog } from './ConfirmDialog'

// TkModal (Wave 0) gọi useTranslations('v2.ui') cho aria-label — test này chỉ khẳng định
// nội dung từ props nên mock key-as-string là đủ, khỏi dựng provider.
vi.mock('next-intl', () => ({ useTranslations: () => (k: string) => k }))

/** §2.11: mọi thao tác xóa phải qua dialog xác nhận — chọn rồi mới thực thi. */
describe('ConfirmDialog — chuẩn xác nhận trước khi xóa', () => {
  const baseProps = {
    open: true,
    title: 'Xoá Lektion?',
    description: 'Sắp xoá Lektion "L1".',
    details: ['Sẽ xoá 4 mục nội dung.', 'Sẽ xoá 3 mục tiêu.'],
    confirmLabel: 'Xoá',
    cancelLabel: 'Hủy',
  }

  it('hiển thị đối tượng + hệ quả; bấm nút xác nhận mới gọi onConfirm', () => {
    const onConfirm = vi.fn()
    const onOpenChange = vi.fn()
    render(<ConfirmDialog {...baseProps} onOpenChange={onOpenChange} onConfirm={onConfirm} />)

    expect(screen.getByText('Sắp xoá Lektion "L1".')).toBeTruthy()
    expect(screen.getByText('Sẽ xoá 4 mục nội dung.')).toBeTruthy()
    expect(onConfirm).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Xoá' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('bấm Hủy chỉ đóng dialog, KHÔNG gọi onConfirm', () => {
    const onConfirm = vi.fn()
    const onOpenChange = vi.fn()
    render(<ConfirmDialog {...baseProps} onOpenChange={onOpenChange} onConfirm={onConfirm} />)

    fireEvent.click(screen.getByRole('button', { name: 'Hủy' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('focus mặc định nằm ở nút Hủy — Enter theo phản xạ không xóa nhầm', () => {
    render(<ConfirmDialog {...baseProps} onOpenChange={() => {}} onConfirm={() => {}} />)
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Hủy' }))
  })

  it('confirmDisabled chặn nút xác nhận (backend báo không thể áp dụng)', () => {
    const onConfirm = vi.fn()
    render(
      <ConfirmDialog {...baseProps} confirmDisabled onOpenChange={() => {}} onConfirm={onConfirm} />,
    )
    const confirmBtn = screen.getByRole('button', { name: 'Xoá' }) as HTMLButtonElement
    expect(confirmBtn.disabled).toBe(true)
    fireEvent.click(confirmBtn)
    expect(onConfirm).not.toHaveBeenCalled()
  })
})
