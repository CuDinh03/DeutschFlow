/**
 * Tests cho khối Ảnh đại diện của trang /v2/profile.
 *
 * Từ đợt 14/09/2026 chọn ảnh KHÔNG upload ngay nữa: mở hộp thoại cho người dùng tự chọn khung cắt,
 * upload chỉ chạy khi bấm "Cắt & tải lên". jsdom không có URL.createObjectURL nên hộp thoại rơi về
 * nhánh "gửi tệp gốc" — đúng thiết kế fallback, và nhờ đó test đi hết luồng mà không cần canvas thật.
 * next-intl / sonner / profileApi được mock.
 */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AvatarSection, validateAvatarFile } from '@/app/v2/profile/AvatarSection'
import { uploadAvatar, removeAvatar } from '@/lib/profileApi'
import { toast } from 'sonner'

vi.mock('next-intl', () => ({ useLocale: () => 'vi',
  useTranslations: () => {
    const f = (k: string) => k
    ;(f as unknown as { has: (k: string) => boolean }).has = () => false
    return f
  },
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/lib/profileApi', () => ({
  uploadAvatar: vi.fn(),
  removeAvatar: vi.fn(),
}))

const mockUpload = vi.mocked(uploadAvatar)
const mockRemove = vi.mocked(removeAvatar)

function pngFile(name = 'me.png', bytes = 3): File {
  return new File([new Uint8Array(bytes)], name, { type: 'image/png' })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('validateAvatarFile', () => {
  it('chặn định dạng ngoài allowlist (vd SVG)', () => {
    const svg = new File(['<svg/>'], 'x.svg', { type: 'image/svg+xml' })
    expect(validateAvatarFile(svg)).toBe('invalidType')
  })

  it('chặn ảnh nguồn quá lớn (>15MB)', () => {
    const big = new File([new ArrayBuffer(15 * 1024 * 1024 + 1)], 'big.png', { type: 'image/png' })
    expect(validateAvatarFile(big)).toBe('tooLarge')
  })

  it('nhận ảnh chuẩn', () => {
    expect(validateAvatarFile(pngFile())).toBeNull()
  })
})

describe('AvatarSection', () => {
  it('không có ảnh → hiện chữ cái tắt, không có nút Gỡ ảnh', () => {
    render(<AvatarSection displayName="Đinh Huy Cự" avatarUrl={null} onChange={vi.fn()} />)
    expect(screen.getByText('ĐC')).toBeTruthy()
    expect(screen.queryByText('removeAvatar')).toBeNull()
  })

  it('có ảnh → render <img> và nút Gỡ ảnh', () => {
    render(
      <AvatarSection displayName="Đinh Huy Cự" avatarUrl="https://cdn.x/avatar/a.webp" onChange={vi.fn()} />
    )
    const img = screen.getByAltText('fieldAvatar') as HTMLImageElement
    expect(img.src).toBe('https://cdn.x/avatar/a.webp')
    expect(screen.getByText('removeAvatar')).toBeTruthy()
  })

  it('chọn file sai định dạng → báo lỗi, KHÔNG gọi upload', async () => {
    render(<AvatarSection displayName="A" avatarUrl={null} onChange={vi.fn()} />)
    const input = screen.getByLabelText('uploadAvatar') as HTMLInputElement
    const pdf = new File(['%PDF'], 'cv.pdf', { type: 'application/pdf' })
    fireEvent.change(input, { target: { files: [pdf] } })
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('avatarInvalidType'))
    expect(mockUpload).not.toHaveBeenCalled()
  })

  it('chọn ảnh hợp lệ → MỞ hộp thoại cắt, CHƯA upload gì cả', async () => {
    render(<AvatarSection displayName="A" avatarUrl={null} onChange={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('uploadAvatar'), { target: { files: [pngFile()] } })
    await waitFor(() => expect(screen.getByText('cropTitle')).toBeTruthy())
    // Điểm mấu chốt của đợt này: không còn upload lén ngay lúc chọn ảnh.
    expect(mockUpload).not.toHaveBeenCalled()
  })

  it('xác nhận khung cắt → upload rồi báo onChange(url mới)', async () => {
    mockUpload.mockResolvedValue({ avatarUrl: 'https://cdn.x/avatar/new.webp' })
    const onChange = vi.fn()
    render(<AvatarSection displayName="A" avatarUrl={null} onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('uploadAvatar'), { target: { files: [pngFile()] } })
    fireEvent.click(await screen.findByText('cropConfirm'))
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('https://cdn.x/avatar/new.webp'))
    expect(mockUpload).toHaveBeenCalledTimes(1)
    expect(toast.success).toHaveBeenCalledWith('avatarSaved')
  })

  it('huỷ hộp thoại → không upload, không đổi ảnh', async () => {
    const onChange = vi.fn()
    render(<AvatarSection displayName="A" avatarUrl={null} onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('uploadAvatar'), { target: { files: [pngFile()] } })
    fireEvent.click(await screen.findByText('cropCancel'))
    await waitFor(() => expect(screen.queryByText('cropTitle')).toBeNull())
    expect(mockUpload).not.toHaveBeenCalled()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('upload lỗi → toast lỗi, GIỮ hộp thoại để thử lại mà không phải chọn ảnh lại', async () => {
    mockUpload.mockRejectedValue(new Error('mạng rớt'))
    const onChange = vi.fn()
    render(<AvatarSection displayName="A" avatarUrl={null} onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('uploadAvatar'), { target: { files: [pngFile()] } })
    fireEvent.click(await screen.findByText('cropConfirm'))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('mạng rớt'))
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByText('cropTitle')).toBeTruthy()
  })

  it('Gỡ ảnh → gọi API xoá và onChange(null)', async () => {
    mockRemove.mockResolvedValue()
    const onChange = vi.fn()
    render(
      <AvatarSection displayName="A" avatarUrl="https://cdn.x/avatar/a.webp" onChange={onChange} />
    )
    fireEvent.click(screen.getByText('removeAvatar'))
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(null))
    expect(mockRemove).toHaveBeenCalledTimes(1)
    expect(toast.success).toHaveBeenCalledWith('avatarRemoved')
  })
})
