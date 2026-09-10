import React from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { OrgCertificateRow } from '@/lib/certificateApi'

const listOrgCertificates = vi.hoisted(() => vi.fn())
const revokeOrgCertificate = vi.hoisted(() => vi.fn())
const listClasses = vi.hoisted(() => vi.fn())
const getOrgRole = vi.hoisted(() => vi.fn<() => string>())
const toastSuccess = vi.hoisted(() => vi.fn())
const toastError = vi.hoisted(() => vi.fn())

vi.mock('@/lib/certificateApi', () => ({
  listOrgCertificates: (...a: unknown[]) => listOrgCertificates(...a),
  revokeOrgCertificate: (...a: unknown[]) => revokeOrgCertificate(...a),
  certificateVerifyUrl: (token: string) => `https://mydeutschflow.com/certificate/${token}/`,
}))
vi.mock('@/lib/orgApi', () => ({ listClasses: (...a: unknown[]) => listClasses(...a) }))
vi.mock('@/lib/authSession', () => ({ getOrgRole }))
vi.mock('@/lib/api', () => ({ apiMessage: (e: unknown) => (e instanceof Error ? e.message : 'Lỗi không xác định') }))
vi.mock('sonner', () => ({ toast: Object.assign(() => undefined, { success: toastSuccess, error: toastError }) }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }) }))
vi.mock('next-intl', () => ({
  useLocale: () => 'vi',
  useTranslations: (ns: string) => {
    const t = (key: string, values?: Record<string, unknown>) =>
      values ? `${ns}.${key}:${JSON.stringify(values)}` : `${ns}.${key}`
    return t as unknown as ReturnType<typeof import('next-intl').useTranslations>
  },
}))

import V2OrgCertificatesPage from '@/app/v2/org/certificates/page'
import { CLASS_FILTER_PROBE_SIZE, ORG_CERTIFICATES_PAGE_SIZE } from '@/app/v2/org/certificates/constants'

const NS = 'v2.org.certificates'
const k = (key: string, values?: Record<string, unknown>) =>
  values ? `${NS}.${key}:${JSON.stringify(values)}` : `${NS}.${key}`

const row = (id: number, over: Partial<OrgCertificateRow> = {}): OrgCertificateRow => ({
  id,
  certificateCode: `DF-B1-2026-C${id}`,
  verifyToken: `tok${id}`,
  classId: 10,
  className: 'B1 tối thứ Ba',
  studentUserId: 100 + id,
  studentName: `Học viên ${id}`,
  cefrLevel: 'B1',
  score: 88,
  issuedByUserId: 7,
  issuedByName: 'Cô Lan',
  issuedAt: '2026-09-01T10:00:00Z',
  active: true,
  ...over,
})

const envelope = (items: OrgCertificateRow[], total: number, page = 0) => ({
  items, total, page, size: ORG_CERTIFICATES_PAGE_SIZE,
})

/** Đối số mặc định mà trang gửi lên khi chưa động vào bộ lọc nào. */
const NO_FILTER = { q: '', classId: undefined, active: undefined }

const revokeButton = (student: string) => screen.getByRole('button', { name: k('revokeAria', { student }) })

beforeEach(() => {
  listOrgCertificates.mockReset()
  revokeOrgCertificate.mockReset()
  listClasses.mockReset()
  getOrgRole.mockReset()
  toastSuccess.mockReset()
  toastError.mockReset()
  getOrgRole.mockReturnValue('OWNER')
  listClasses.mockResolvedValue({
    content: [
      { id: 10, name: 'B1 tối thứ Ba', inviteCode: null, teacherId: 7, createdAt: '2026-08-01T00:00:00Z' },
      { id: 11, name: 'A2 sáng', inviteCode: null, teacherId: 7, createdAt: '2026-08-01T00:00:00Z' },
    ],
    totalElements: 2, totalPages: 1, number: 0, size: CLASS_FILTER_PROBE_SIZE, first: true, last: true,
  })
})

/**
 * DEC-20 (chốt 09/09/2026): "giáo viên vẫn cấp, KHÔNG thêm bước duyệt; giám đốc xem được danh sách
 * toàn trung tâm và THU HỒI được". Các ca dưới đây khoá hợp đồng của bề mặt web đó: OWNER/MANAGER
 * cùng đọc, chỉ OWNER thấy nút thu hồi, thu hồi phải qua hộp xác nhận có LÝ DO và nêu hệ quả.
 */
describe('V2OrgCertificatesPage — sổ chứng nhận toàn trung tâm (DEC-20)', () => {
  it('OWNER: tải trang đầu, đủ cột, trạng thái từng dòng, nút Thu hồi CHỈ ở dòng còn hiệu lực', async () => {
    listOrgCertificates.mockResolvedValueOnce(envelope([row(1), row(2, { active: false, className: null })], 2))

    render(<V2OrgCertificatesPage />)

    await waitFor(() => expect(screen.getByText('Học viên 1')).toBeTruthy())
    expect(listOrgCertificates).toHaveBeenCalledWith(0, ORG_CERTIFICATES_PAGE_SIZE, NO_FILTER)
    expect(listClasses).toHaveBeenCalledWith(0, CLASS_FILTER_PROBE_SIZE)

    for (const col of ['colStudent', 'colClass', 'colLevel', 'colScore', 'colIssuedBy', 'colIssuedAt', 'colStatus', 'colVerify', 'colActions']) {
      expect(screen.getByText(k(col))).toBeTruthy()
    }
    expect(screen.getByText('DF-B1-2026-C1')).toBeTruthy()
    expect(screen.getByText(k('statusActive'))).toBeTruthy()
    expect(screen.getByText(k('statusRevoked'))).toBeTruthy()
    // Lớp đã xoá ⇒ nhãn, không phải ô trống.
    expect(screen.getByText(k('classDeleted'))).toBeTruthy()
    expect(screen.getAllByText('Cô Lan').length).toBe(2)

    // Thu hồi chỉ có ở dòng còn hiệu lực; dòng đã thu hồi không có nút để bấm lần hai.
    expect(revokeButton('Học viên 1')).toBeTruthy()
    expect(screen.queryByRole('button', { name: k('revokeAria', { student: 'Học viên 2' }) })).toBeNull()

    // Link xác thực công khai mở đúng token, ở tab mới.
    const open = screen.getByRole('link', { name: k('openVerifyAria', { student: 'Học viên 1' }) })
    expect(open.getAttribute('href')).toBe('https://mydeutschflow.com/certificate/tok1/')
    expect(open.getAttribute('target')).toBe('_blank')
  })

  it('MANAGER: vẫn đọc được sổ nhưng KHÔNG có cột/nút Thu hồi, có ghi chú chỉ giám đốc thu hồi được', async () => {
    getOrgRole.mockReturnValue('MANAGER')
    listOrgCertificates.mockResolvedValueOnce(envelope([row(1)], 1))

    render(<V2OrgCertificatesPage />)

    await waitFor(() => expect(screen.getByText('Học viên 1')).toBeTruthy())
    expect(listOrgCertificates).toHaveBeenCalledWith(0, ORG_CERTIFICATES_PAGE_SIZE, NO_FILTER)
    expect(screen.queryByRole('button', { name: k('revokeAria', { student: 'Học viên 1' }) })).toBeNull()
    expect(screen.queryByText(k('colActions'))).toBeNull()
    expect(screen.getByText(k('ownerOnlyHint'))).toBeTruthy()
  })

  it('bộ lọc trạng thái / lớp / tìm kiếm gửi lên máy chủ và luôn quay về trang đầu', async () => {
    listOrgCertificates.mockResolvedValue(envelope([row(1)], 1))

    render(<V2OrgCertificatesPage />)
    await waitFor(() => expect(screen.getByText('Học viên 1')).toBeTruthy())

    await userEvent.click(screen.getByRole('button', { name: k('filterRevoked') }))
    await waitFor(() =>
      expect(listOrgCertificates).toHaveBeenLastCalledWith(0, ORG_CERTIFICATES_PAGE_SIZE, {
        q: '', classId: undefined, active: false,
      }),
    )

    await waitFor(() => expect(screen.getByRole('option', { name: 'A2 sáng' })).toBeTruthy())
    await userEvent.selectOptions(screen.getByLabelText(k('classFilterLabel')), '11')
    await waitFor(() =>
      expect(listOrgCertificates).toHaveBeenLastCalledWith(0, ORG_CERTIFICATES_PAGE_SIZE, {
        q: '', classId: 11, active: false,
      }),
    )

    await userEvent.type(screen.getByLabelText(k('searchPlaceholder')), 'Lan')
    await waitFor(() =>
      expect(listOrgCertificates).toHaveBeenLastCalledWith(0, ORG_CERTIFICATES_PAGE_SIZE, {
        q: 'Lan', classId: 11, active: false,
      }),
    )

    await userEvent.click(screen.getByRole('button', { name: k('filterAll') }))
    await waitFor(() =>
      expect(listOrgCertificates).toHaveBeenLastCalledWith(0, ORG_CERTIFICATES_PAGE_SIZE, {
        q: 'Lan', classId: 11, active: undefined,
      }),
    )
  })

  it('thu hồi: hộp xác nhận nêu đối tượng + 4 hệ quả, nút xác nhận KHOÁ tới khi lý do đủ 5 ký tự, gọi API kèm lý do, đổi dòng tại chỗ', async () => {
    listOrgCertificates.mockResolvedValueOnce(envelope([row(1)], 1))
    revokeOrgCertificate.mockResolvedValueOnce(row(1, { active: false }))

    render(<V2OrgCertificatesPage />)
    await waitFor(() => expect(screen.getByText('Học viên 1')).toBeTruthy())

    await userEvent.click(revokeButton('Học viên 1'))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(k('revokeTitle'))).toBeTruthy()
    expect(within(dialog).getByText(k('revokeDescription', {
      code: 'DF-B1-2026-C1', level: 'B1', student: 'Học viên 1', issuer: 'Cô Lan',
    }))).toBeTruthy()
    for (const c of ['revokeConsequenceLink', 'revokeConsequenceNoUndo', 'revokeConsequenceNoNotify', 'revokeConsequenceAudit']) {
      expect(within(dialog).getByText(k(c))).toBeTruthy()
    }

    const confirm = within(dialog).getByRole('button', { name: k('confirmRevoke') })
    expect(confirm).toHaveProperty('disabled', true)

    const reasonInput = within(dialog).getByLabelText(k('reasonLabel'))
    await userEvent.type(reasonInput, 'abc')
    expect(confirm).toHaveProperty('disabled', true) // 3 ký tự — chưa đủ
    await userEvent.type(reasonInput, ' nhầm trình độ')
    expect(confirm).toHaveProperty('disabled', false)
    expect(within(dialog).getByText(k('reasonHint', { count: 17, max: 300, min: 5 }))).toBeTruthy()

    await userEvent.click(confirm)

    await waitFor(() => expect(revokeOrgCertificate).toHaveBeenCalledWith(1, 'abc nhầm trình độ'))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(screen.getByText(k('statusRevoked'))).toBeTruthy()
    expect(screen.queryByText(k('statusActive'))).toBeNull()
    expect(screen.queryByRole('button', { name: k('revokeAria', { student: 'Học viên 1' }) })).toBeNull()
    expect(toastSuccess).toHaveBeenCalledWith(k('revokeSuccess', { code: 'DF-B1-2026-C1' }))
    // Không tải lại cả bảng — dòng được thay tại chỗ.
    expect(listOrgCertificates).toHaveBeenCalledTimes(1)
  })

  it('huỷ hộp xác nhận: đóng, KHÔNG gọi API, dòng còn nguyên', async () => {
    listOrgCertificates.mockResolvedValueOnce(envelope([row(1)], 1))

    render(<V2OrgCertificatesPage />)
    await waitFor(() => expect(screen.getByText('Học viên 1')).toBeTruthy())

    await userEvent.click(revokeButton('Học viên 1'))
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: k('cancel') }))

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(revokeOrgCertificate).not.toHaveBeenCalled()
    expect(screen.getByText(k('statusActive'))).toBeTruthy()
  })

  it('máy chủ từ chối thu hồi (404 khác trung tâm / 403 / chỉ-đọc) → toast lỗi, hộp thoại còn mở, dòng còn nguyên', async () => {
    listOrgCertificates.mockResolvedValueOnce(envelope([row(1)], 1))
    revokeOrgCertificate.mockRejectedValueOnce(new Error('Không tìm thấy chứng nhận'))

    render(<V2OrgCertificatesPage />)
    await waitFor(() => expect(screen.getByText('Học viên 1')).toBeTruthy())

    await userEvent.click(revokeButton('Học viên 1'))
    const dialog = await screen.findByRole('dialog')
    await userEvent.type(within(dialog).getByLabelText(k('reasonLabel')), 'Cấp nhầm trình độ')
    await userEvent.click(within(dialog).getByRole('button', { name: k('confirmRevoke') }))

    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Không tìm thấy chứng nhận'))
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByText(k('statusActive'))).toBeTruthy()
    expect(toastSuccess).not.toHaveBeenCalled()
  })

  it('sao chép link xác thực: ghi URL công khai vào clipboard và báo "Đã sao chép"', async () => {
    // `userEvent.setup()` gắn stub Clipboard vào window — API gọi trực tiếp không có stub này.
    const user = userEvent.setup()
    listOrgCertificates.mockResolvedValueOnce(envelope([row(1)], 1))

    render(<V2OrgCertificatesPage />)
    await waitFor(() => expect(screen.getByText('Học viên 1')).toBeTruthy())

    await user.click(screen.getByRole('button', { name: k('copyLinkAria', { student: 'Học viên 1' }) }))

    await waitFor(() => expect(screen.getByText(k('copied'))).toBeTruthy())
    expect(await navigator.clipboard.readText()).toBe('https://mydeutschflow.com/certificate/tok1/')
    expect(toastError).not.toHaveBeenCalled()
  })

  it('phân trang: "Trang sau" gọi trang kế với cùng bộ lọc; trang đầu thì "Trang trước" bị khoá', async () => {
    // 2 trang: total 45 với cỡ trang 30.
    listOrgCertificates.mockResolvedValueOnce(envelope([row(1)], 45, 0))

    render(<V2OrgCertificatesPage />)
    await waitFor(() => expect(screen.getByText('Học viên 1')).toBeTruthy())
    expect(screen.getByText(k('pageOf', { page: 1, pages: 2, total: '45' }))).toBeTruthy()
    expect(screen.getByRole('button', { name: k('prevPage') })).toHaveProperty('disabled', true)

    listOrgCertificates.mockResolvedValueOnce(envelope([row(9)], 45, 1))
    await userEvent.click(screen.getByRole('button', { name: k('nextPage') }))

    await waitFor(() => expect(listOrgCertificates).toHaveBeenLastCalledWith(1, ORG_CERTIFICATES_PAGE_SIZE, NO_FILTER))
    await waitFor(() => expect(screen.getByText('Học viên 9')).toBeTruthy())
  })

  it('bảng rỗng: chưa lọc thì "chưa có chứng nhận", đang lọc thì "không khớp bộ lọc"', async () => {
    listOrgCertificates.mockResolvedValue(envelope([], 0))

    render(<V2OrgCertificatesPage />)
    await waitFor(() => expect(screen.getByText(k('empty'))).toBeTruthy())

    await userEvent.click(screen.getByRole('button', { name: k('filterActive') }))
    await waitFor(() => expect(screen.getByText(k('emptyFiltered'))).toBeTruthy())
  })

  it('lỗi máy chủ (403 khi TEACHER lách URL) hiện thông báo có nút thử lại, không hiện bảng rỗng im lặng', async () => {
    listOrgCertificates.mockRejectedValueOnce(new Error('Chỉ quản trị viên tổ chức mới được thao tác này'))

    render(<V2OrgCertificatesPage />)

    await waitFor(() => expect(screen.getByText('Chỉ quản trị viên tổ chức mới được thao tác này')).toBeTruthy())
    expect(screen.queryByText(k('colStudent'))).toBeNull()
  })
})
