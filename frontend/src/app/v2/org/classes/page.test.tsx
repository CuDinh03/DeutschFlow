import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const listClasses = vi.fn()
const getOrgSummary = vi.fn()
vi.mock('@/lib/orgApi', () => ({
  listClasses: (...a: unknown[]) => listClasses(...a),
  getOrgSummary: () => getOrgSummary(),
}))
vi.mock('@/lib/api', () => ({ apiMessage: (e: unknown) => (e instanceof Error ? e.message : 'Lỗi không xác định') }))
vi.mock('sonner', () => ({ toast: Object.assign(() => undefined, { success: () => undefined, error: () => undefined }) }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/app/v2/org/classes/CreateClassModal', () => ({ CreateClassModal: () => null }))
vi.mock('next-intl', () => ({
  useLocale: () => 'vi',
  useTranslations: (ns: string) => {
    const t = (key: string, values?: Record<string, unknown>) =>
      values ? `${ns}.${key}:${JSON.stringify(values)}` : `${ns}.${key}`
    return t as unknown as ReturnType<typeof import('next-intl').useTranslations>
  },
}))

import V2OrgClassesPage from '@/app/v2/org/classes/page'
import { CLASSES_PAGE_SIZE } from '@/app/v2/org/classes/pagination'

const klass = (id: number, teacherId: number | null) => ({
  id, name: `Lớp ${id}`, inviteCode: null, teacherId, createdAt: '2026-09-01T00:00:00',
})
const page = (content: ReturnType<typeof klass>[], number: number, totalElements: number, last: boolean) => ({
  content, number, size: CLASSES_PAGE_SIZE, totalElements,
  totalPages: Math.max(1, Math.ceil(totalElements / CLASSES_PAGE_SIZE)), first: number === 0, last,
})

beforeEach(() => {
  listClasses.mockReset()
  getOrgSummary.mockReset()
  // Số "thiếu GV" nay đến từ máy chủ, đếm trên TOÀN trung tâm — mặc định 0 cho ca không quan tâm.
  getOrgSummary.mockResolvedValue({ classesWithoutTeacher: 0 })
})

/**
 * BF-03 / AC-ORG-UI-02: hết trần cứng 100 lớp — phân trang thật.
 *
 * PR-A3 (07/09/2026) đổi hai điều mà ca cũ từng khoá lại theo hành vi cũ:
 *   · tìm kiếm chạy PHÍA MÁY CHỦ (`q`), không lọc lại ở trình duyệt và không còn lời nhắc
 *     "chỉ tìm trong phần đã tải" — câu đó nay sai;
 *   · huy hiệu "thiếu GV" lấy số THẬT từ `getOrgSummary()`, đếm trên toàn trung tâm. Số cũ tính từ
 *     `teacherId == null` mà cột đó NOT NULL trong CSDL, nên huy hiệu im lặng hiện 0 từ đầu.
 */
describe('V2OrgClassesPage — phân trang', () => {
  it('trang đầu chưa hết → "đã tải N/M", Tải thêm nối trang kế rồi đếm đủ', async () => {
    listClasses
      .mockResolvedValueOnce(page([klass(1, 7), klass(2, 7)], 0, 3, false))
      .mockResolvedValueOnce(page([klass(3, 7)], 1, 3, true))

    render(<V2OrgClassesPage />)

    await waitFor(() => expect(screen.getByText('Lớp 1')).toBeTruthy())
    expect(listClasses).toHaveBeenCalledWith(0, CLASSES_PAGE_SIZE, { q: '' })
    expect(screen.getByText('v2.org.classes.loadedOf:{"loaded":2,"total":3}')).toBeTruthy()

    await userEvent.click(screen.getByRole('button', { name: 'v2.org.classes.loadMore:{"remaining":1}' }))

    await waitFor(() => expect(screen.getByText('Lớp 3')).toBeTruthy())
    expect(listClasses).toHaveBeenLastCalledWith(1, CLASSES_PAGE_SIZE, { q: '' })
    expect(screen.getByText('v2.org.classes.count:{"count":3}')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /loadMore/ })).toBeNull()
  })

  it('tìm kiếm gửi `q` lên máy chủ và KHÔNG lọc lại ở trình duyệt', async () => {
    listClasses.mockResolvedValueOnce(page([klass(1, 7), klass(2, 7)], 0, 5, false))

    render(<V2OrgClassesPage />)
    await waitFor(() => expect(screen.getByText('Lớp 2')).toBeTruthy())

    // Máy chủ trả về đúng một lớp cho từ khoá — kể cả lớp nằm ngoài phần đã tải.
    listClasses.mockResolvedValueOnce(page([klass(9, 7)], 0, 1, true))
    await userEvent.type(screen.getByPlaceholderText('v2.org.classes.searchPlaceholder'), 'Lớp 9')

    await waitFor(() => expect(listClasses).toHaveBeenLastCalledWith(0, CLASSES_PAGE_SIZE, { q: 'Lớp 9' }))
    await waitFor(() => expect(screen.getByText('Lớp 9')).toBeTruthy())
    // Không lọc lại ở trình duyệt: "Lớp 9" không chứa chuỗi nào khớp danh sách cũ mà vẫn phải hiện.
    expect(screen.queryByText('Lớp 1')).toBeNull()
    // Lời nhắc "chỉ tìm trong phần đã tải" đã gỡ — giữ lại là nói sai.
    expect(screen.queryByText('v2.org.classes.searchHint')).toBeNull()
  })

  it('huy hiệu thiếu GV lấy số toàn trung tâm từ máy chủ, không đếm phần đã tải', async () => {
    listClasses.mockResolvedValueOnce(page([klass(1, 7)], 0, 1, true))
    // Trang chỉ tải 1 lớp, nhưng cả trung tâm có 4 lớp không còn ai dạy.
    getOrgSummary.mockResolvedValue({ classesWithoutTeacher: 4 })

    render(<V2OrgClassesPage />)
    await waitFor(() => expect(screen.getByText('Lớp 1')).toBeTruthy())

    await waitFor(() => expect(screen.getByText('v2.org.classes.unassignedBadge:{"count":4}')).toBeTruthy())
    expect(screen.getByText('v2.org.classes.count:{"count":1}')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /loadMore/ })).toBeNull()
  })

  it('trung tâm không thiếu GV thì KHÔNG hiện huy hiệu', async () => {
    listClasses.mockResolvedValueOnce(page([klass(1, 7)], 0, 1, true))
    getOrgSummary.mockResolvedValue({ classesWithoutTeacher: 0 })

    render(<V2OrgClassesPage />)
    await waitFor(() => expect(screen.getByText('Lớp 1')).toBeTruthy())

    expect(screen.queryByText(/unassignedBadge/)).toBeNull()
  })
})
