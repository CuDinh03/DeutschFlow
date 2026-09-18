import React from 'react'
import { act, render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * D5 / E1 — chế độ chỉ-đọc của trung tâm phải NHÌN THẤY ĐƯỢC.
 *
 * Những thứ ca kiểm này chốt:
 *  1. Băng cảnh báo nói đúng NGUYÊN NHÂN (hết hạn ≠ đình chỉ) và đúng CÁCH MỞ LẠI.
 *  2. Băng nói luôn CÁI GÌ VẪN LÀM ĐƯỢC (danh mục ngoại lệ E1) — thiếu dòng này thì người dùng
 *     tưởng mọi thứ đã chết và bỏ dở đúng việc hệ thống cố ý giữ mở.
 *  3. Đường ĐỌC không bị chặn: `children` vẫn render nguyên vẹn khi trung tâm bị khoá ghi.
 *  4. Nút ghi bị VÔ HIỆU HOÁ kèm lý do đọc được (tooltip + dòng sr-only), KHÔNG bị giấu.
 *  5. `when={false}` không khoá — lớp B2C của một giáo viên thuộc trung tâm không bị khoá lây.
 *  6. Người không thuộc trung tâm nào thì KHÔNG gọi API.
 *  7. API hỏng KHÔNG được hiện thành "trung tâm bị khoá" — fail-open ở giao diện, cổng thật ở BE.
 */

const getOrgSummary = vi.fn()
const getOrgRole = vi.fn()

vi.mock('@/lib/orgApi', () => ({ getOrgSummary: () => getOrgSummary() }))
vi.mock('@/lib/authSession', () => ({ getOrgRole: () => getOrgRole() }))
vi.mock('next-intl', () => ({
  useTranslations: (ns: string) => (key: string, values?: Record<string, unknown>) =>
    values ? `${ns}.${key}:${JSON.stringify(values)}` : `${ns}.${key}`,
}))

import { OrgLicenseProvider, OrgWriteGate, daysUntil } from '@/app/v2/OrgLicenseGate'

const BASE = {
  name: 'Trung tâm ABC', planCode: 'PRO', seatUsed: 3, seatLimit: 10,
  teacherCount: 2, studentCount: 3, classCount: 1, classesWithoutTeacher: 0,
  readOnly: false, readOnlyReason: null, validUntil: null, graceEndsAt: null,
}

/** Nút TẠO MỚI giả — đúng cách các trang thật bọc nút. */
function CreateButtonProbe({ when }: { when?: boolean }) {
  return (
    <OrgWriteGate when={when}>
      <button type="button" data-testid="create">Tạo lớp</button>
    </OrgWriteGate>
  )
}

beforeEach(() => {
  getOrgSummary.mockReset()
  getOrgRole.mockReset()
  getOrgRole.mockReturnValue('OWNER')
})

describe('OrgLicenseProvider — băng chỉ-đọc (D5)', () => {
  it('HẾT HẠN: băng nói đúng lý do, đếm ngược tới mốc cắt, và chỉ đường thanh toán', async () => {
    const graceEndsAt = new Date(Date.now() + 3 * 86_400_000).toISOString()
    getOrgSummary.mockResolvedValue({ ...BASE, readOnly: true, readOnlyReason: 'EXPIRED', graceEndsAt })

    render(<OrgLicenseProvider><p>nội dung lớp</p></OrgLicenseProvider>)

    const banner = await screen.findByTestId('org-read-only-banner')
    expect(banner).toHaveTextContent('v2.orgReadOnly.titleExpired')
    expect(banner).toHaveTextContent('v2.orgReadOnly.fixExpired')
    // Còn bao lâu: 3 ngày, dựng từ graceEndsAt của máy chủ (không tự cộng 7 ngày ở client).
    expect(banner).toHaveTextContent(/graceLeft.*"days":3/)
    expect(banner).not.toHaveTextContent('titleSuspended')
  })

  it('ĐÌNH CHỈ: đổi cả tiêu đề lẫn cách mở lại — không dùng chung câu "thanh toán hoá đơn"', async () => {
    getOrgSummary.mockResolvedValue({
      ...BASE, readOnly: true, readOnlyReason: 'SUSPENDED',
      graceEndsAt: new Date(Date.now() + 86_400_000).toISOString(),
    })

    render(<OrgLicenseProvider><p>nội dung lớp</p></OrgLicenseProvider>)

    const banner = await screen.findByTestId('org-read-only-banner')
    expect(banner).toHaveTextContent('v2.orgReadOnly.titleSuspended')
    expect(banner).toHaveTextContent('v2.orgReadOnly.fixSuspended')
    expect(banner).not.toHaveTextContent('fixExpired')
  })

  it('E1: băng nói luôn cái gì VẪN làm được, và dính lại ở mép trên khi cuộn', async () => {
    getOrgSummary.mockResolvedValue({ ...BASE, readOnly: true, readOnlyReason: 'EXPIRED', graceEndsAt: null })

    render(<OrgLicenseProvider><p>nội dung</p></OrgLicenseProvider>)

    const banner = await screen.findByTestId('org-read-only-banner')
    expect(banner).toHaveTextContent('v2.orgReadOnly.stillAllowed')
    expect(banner.className).toContain('sticky')
  })

  it('ĐƯỜNG ĐỌC vẫn sống: trung tâm khoá ghi vẫn render đủ nội dung bên trong', async () => {
    getOrgSummary.mockResolvedValue({ ...BASE, readOnly: true, readOnlyReason: 'SUSPENDED', graceEndsAt: null })

    render(<OrgLicenseProvider><p>danh sách lớp của tôi</p></OrgLicenseProvider>)

    await screen.findByTestId('org-read-only-banner')
    expect(screen.getByText('danh sách lớp của tôi')).toBeInTheDocument()
  })

  it('trung tâm KHOẺ: không băng, nút tạo mới bấm được như thường', async () => {
    getOrgSummary.mockResolvedValue(BASE)

    render(<OrgLicenseProvider><CreateButtonProbe /></OrgLicenseProvider>)

    await waitFor(() => expect(getOrgSummary).toHaveBeenCalled())
    expect(screen.queryByTestId('org-read-only-banner')).toBeNull()
    expect(screen.getByTestId('create')).toBeEnabled()
  })

  it('API hỏng KHÔNG được biến thành "trung tâm bị khoá" — fail-open ở giao diện', async () => {
    getOrgSummary.mockRejectedValue(new Error('502 Bad Gateway'))

    render(<OrgLicenseProvider><CreateButtonProbe /></OrgLicenseProvider>)

    await waitFor(() => expect(getOrgSummary).toHaveBeenCalled())
    expect(screen.queryByTestId('org-read-only-banner')).toBeNull()
    expect(screen.getByTestId('create')).toBeEnabled()
  })

  it('không thuộc trung tâm nào (giáo viên B2C): KHÔNG gọi /api/org, không băng', async () => {
    getOrgRole.mockReturnValue('')

    render(<OrgLicenseProvider><CreateButtonProbe /></OrgLicenseProvider>)

    await waitFor(() => expect(screen.getByTestId('create')).toBeEnabled())
    expect(getOrgSummary).not.toHaveBeenCalled()
    expect(screen.queryByTestId('org-read-only-banner')).toBeNull()
  })

  it('vai trò CHƯA BIẾT lúc mount (chờ 401-refresh): poll lại rồi mới gọi, không bỏ sót băng', async () => {
    vi.useFakeTimers()
    try {
      // Hai nhịp đầu chưa có auth_org_role — đúng cảnh người dùng quay lại khi access token hết hạn.
      getOrgRole.mockReturnValueOnce('').mockReturnValueOnce('').mockReturnValue('MANAGER')
      getOrgSummary.mockResolvedValue({ ...BASE, readOnly: true, readOnlyReason: 'EXPIRED', graceEndsAt: null })

      render(<OrgLicenseProvider><p>nội dung</p></OrgLicenseProvider>)
      expect(getOrgSummary).not.toHaveBeenCalled()

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000)
      })
      expect(getOrgSummary).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('OrgWriteGate — vô hiệu hoá chứ KHÔNG giấu', () => {
  const readOnly = { ...BASE, readOnly: true, readOnlyReason: 'SUSPENDED', graceEndsAt: null }

  it('khoá nút, giữ nút trên màn hình, và nói được vì sao — tooltip + mô tả cho trình đọc màn hình', async () => {
    getOrgSummary.mockResolvedValue(readOnly)

    render(<OrgLicenseProvider><CreateButtonProbe /></OrgLicenseProvider>)

    // Phải TRA LẠI sau khi trạng thái về: OrgWriteGate dựng lại nút bằng cloneElement dưới một
    // lớp bọc mới, nên tham chiếu lấy trước lúc đó đã rời khỏi cây DOM.
    await waitFor(() => expect(screen.getByTestId('create')).toBeDisabled())
    const btn = screen.getByTestId('create')
    // Nút vẫn còn trên màn hình (không bị giấu)…
    expect(btn).toBeInTheDocument()
    // …tooltip nằm trên phần tử BỌC, vì nút disabled không nhận hover.
    expect(btn.parentElement).toHaveAttribute('title', 'v2.orgReadOnly.tooltipSuspended')
    // …và lý do đến được trình đọc màn hình qua aria-describedby.
    const descId = btn.getAttribute('aria-describedby')
    expect(descId).toBeTruthy()
    expect(document.getElementById(descId as string)).toHaveTextContent('v2.orgReadOnly.tooltipSuspended')
  })

  it('when={false}: KHÔNG khoá — lớp B2C của giáo viên thuộc trung tâm không bị khoá lây', async () => {
    getOrgSummary.mockResolvedValue(readOnly)

    render(<OrgLicenseProvider><CreateButtonProbe when={false} /></OrgLicenseProvider>)

    await screen.findByTestId('org-read-only-banner')
    expect(screen.getByTestId('create')).toBeEnabled()
    expect(screen.getByTestId('create').parentElement).not.toHaveAttribute('title')
  })
})

describe('daysUntil — quãng ân hạn còn lại', () => {
  const now = Date.parse('2026-09-09T00:00:00Z')

  it('làm tròn LÊN: còn 2 ngày rưỡi vẫn là "3 ngày", không phải 2', () => {
    expect(daysUntil('2026-09-11T12:00:00Z', now)).toBe(3)
  })

  it('quá hạn → 0 (không bao giờ âm); không có mốc / mốc rác → null', () => {
    expect(daysUntil('2026-09-01T00:00:00Z', now)).toBe(0)
    expect(daysUntil(null, now)).toBeNull()
    expect(daysUntil('không-phải-ngày', now)).toBeNull()
  })
})
