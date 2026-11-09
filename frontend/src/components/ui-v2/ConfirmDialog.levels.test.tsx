import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ConfirmDialog } from './ConfirmDialog'

// TkModal + ô lý do gọi useTranslations('v2.ui'); test chỉ khẳng định hành vi nên mock key-as-string.
vi.mock('next-intl', () => ({ useLocale: () => 'vi', useTranslations: () => (k: string) => k }))

/** Đợt 1 admin (09/11/2026): ba mức xác nhận — thường · bắt buộc lý do · gõ lại cụm từ. */
describe('ConfirmDialog — ba mức xác nhận', () => {
  const base = {
    open: true,
    title: 'Đổi gói?',
    details: ['Ví hiện có 1.200 token sẽ bị đặt lại.'],
    confirmLabel: 'Đổi gói',
    cancelLabel: 'Hủy',
    onOpenChange: () => {},
  }
  const confirmBtn = () => screen.getByRole('button', { name: 'Đổi gói' }) as HTMLButtonElement

  it('không truyền tone: destructive mặc định = danger (nút đỏ); destructive={false} = neutral', () => {
    const { unmount } = render(<ConfirmDialog {...base} onConfirm={() => {}} />)
    expect(confirmBtn().getAttribute('data-tone')).toBe('danger')
    expect(confirmBtn().className).toContain('bg-red-700')
    unmount()
    render(<ConfirmDialog {...base} destructive={false} onConfirm={() => {}} />)
    expect(confirmBtn().getAttribute('data-tone')).toBe('neutral')
    expect(confirmBtn().className).not.toContain('bg-red-700')
  })

  it('tone="caution": hệ quả nằm trong khung cảnh báo, nút không đỏ', () => {
    render(<ConfirmDialog {...base} tone="caution" onConfirm={() => {}} />)
    expect(screen.getByTestId('confirm-caution').textContent).toContain('1.200 token')
    expect(confirmBtn().className).not.toContain('bg-red-700')
  })

  it('requireReason: khoá nút tới khi lý do đủ 10 ký tự; onConfirm nhận lý do đã cắt khoảng trắng', () => {
    const onConfirm = vi.fn()
    render(<ConfirmDialog {...base} tone="caution" requireReason onConfirm={onConfirm} />)
    expect(confirmBtn().disabled).toBe(true)

    fireEvent.change(screen.getByTestId('confirm-reason'), { target: { value: '  ngắn   ' } })
    expect(confirmBtn().disabled).toBe(true)

    fireEvent.change(screen.getByTestId('confirm-reason'), {
      target: { value: '  Học viên chuyển sang gói trung tâm  ' },
    })
    expect(confirmBtn().disabled).toBe(false)
    fireEvent.click(confirmBtn())
    expect(onConfirm).toHaveBeenCalledWith({ reason: 'Học viên chuyển sang gói trung tâm' })
  })

  it('confirmPhrase: chỉ mở khi gõ ĐÚNG cụm từ', () => {
    const onConfirm = vi.fn()
    render(<ConfirmDialog {...base} tone="danger" confirmPhrase="lan@test.vn" onConfirm={onConfirm} />)
    fireEvent.change(screen.getByTestId('confirm-phrase'), { target: { value: 'LAN@test.vn' } })
    expect(confirmBtn().disabled).toBe(true)
    fireEvent.change(screen.getByTestId('confirm-phrase'), { target: { value: 'lan@test.vn' } })
    expect(confirmBtn().disabled).toBe(false)
    fireEvent.click(confirmBtn())
    expect(onConfirm).toHaveBeenCalledWith({})
  })

  it('mở lại hộp thoại thì xoá lý do của lần trước', () => {
    const { rerender } = render(<ConfirmDialog {...base} requireReason onConfirm={() => {}} />)
    fireEvent.change(screen.getByTestId('confirm-reason'), { target: { value: 'Lý do của lần trước đó' } })
    rerender(<ConfirmDialog {...base} open={false} requireReason onConfirm={() => {}} />)
    rerender(<ConfirmDialog {...base} open requireReason onConfirm={() => {}} />)
    expect((screen.getByTestId('confirm-reason') as HTMLTextAreaElement).value).toBe('')
  })
})
