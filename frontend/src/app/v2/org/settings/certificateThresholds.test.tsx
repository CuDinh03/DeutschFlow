/**
 * Hai ngưỡng xét chứng nhận ở `/v2/org/settings` (R10, V323) — PR-R3.
 *
 * Vì sao đáng một test riêng: hai ô này là thứ DUY NHẤT quyết định dòng "đủ điều kiện cấp chứng nhận"
 * in trên phiếu cuối khoá gửi gia đình. Trước PR này chúng chỉ tồn tại trong `org_settings` và không
 * có màn nào sửa được, nên trung tâm phải sống với mặc định 50/80. Hai chỗ dễ trượt được canh:
 *  - `min` phải là 0 (0 = trung tâm bỏ điều kiện đó); dùng lại `min={1}` của hai ngưỡng hỗ trợ ngay
 *    bên trên là chặn mất một giá trị hợp lệ mà máy chủ vẫn chấp nhận;
 *  - khi lưu, PUT phải mang cả hai khoá — gửi thiếu là im lặng bỏ qua thay đổi của người dùng.
 */
import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next-intl', async () => (await import('@/test/intlCatalog')).nextIntlCatalogMock())
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }) }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
// OWNER-only: backend gác `assertOrgOwner`, `OrgOwnerOnly` chỉ là lớp UX — test mở cửa lớp UX đó.
vi.mock('@/lib/authSession', () => ({ getOrgRole: () => 'OWNER' }))

const get = vi.fn()
const put = vi.fn()
vi.mock('@/lib/api', () => ({
  default: { get: (...a: unknown[]) => get(...a), put: (...a: unknown[]) => put(...a) },
  apiMessage: (e: unknown) => String(e),
}))

import V2OrgSettingsPage from './page'

const SETTINGS = {
  timesheet_break_included: 'true',
  support_individual_max: '3',
  review_group_min: '5',
  certificate_min_avg: '50',
  certificate_min_attendance_pct: '80',
}

describe('Cấu hình trung tâm — ngưỡng xét chứng nhận', () => {
  beforeEach(() => {
    get.mockReset()
    put.mockReset()
    get.mockResolvedValue({ data: { ...SETTINGS } })
  })

  it('hiện hai ô ngưỡng với giá trị đang lưu và cho nhập từ 0', async () => {
    render(<V2OrgSettingsPage />)

    const avg = (await screen.findByLabelText('Điểm trung bình tối thiểu (thang 100)')) as HTMLInputElement
    const att = screen.getByLabelText('Tỉ lệ chuyên cần tối thiểu (%)') as HTMLInputElement

    expect(avg.value).toBe('50')
    expect(att.value).toBe('80')
    // 0 hợp lệ ⇒ ô không được chặn ở 1 như hai ngưỡng gợi ý hỗ trợ bên trên.
    expect(avg.min).toBe('0')
    expect(att.min).toBe('0')
    expect(avg.max).toBe('100')
    expect(att.max).toBe('100')
  })

  it('sửa rồi lưu thì PUT mang đúng hai khoá org_settings', async () => {
    put.mockResolvedValue({ data: { ...SETTINGS, certificate_min_avg: '65', certificate_min_attendance_pct: '0' } })
    render(<V2OrgSettingsPage />)

    fireEvent.change(await screen.findByLabelText('Điểm trung bình tối thiểu (thang 100)'), { target: { value: '65' } })
    fireEvent.change(screen.getByLabelText('Tỉ lệ chuyên cần tối thiểu (%)'), { target: { value: '0' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu cấu hình' }))

    await waitFor(() => expect(put).toHaveBeenCalledTimes(1))
    const [path, body] = put.mock.calls[0] as [string, { settings: Record<string, string> }]
    expect(path).toBe('/org/settings')
    expect(body.settings.certificate_min_avg).toBe('65')
    expect(body.settings.certificate_min_attendance_pct).toBe('0')
  })

  it('nói rõ hai ngưỡng này in lên phiếu cuối khoá, không phải một con số vô danh', async () => {
    render(<V2OrgSettingsPage />)
    expect(
      await screen.findByText(/phiếu đánh giá cuối khoá/i),
    ).toBeInTheDocument()
  })
})
