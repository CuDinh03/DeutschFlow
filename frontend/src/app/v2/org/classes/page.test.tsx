import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const listClasses = vi.fn()
vi.mock('@/lib/orgApi', () => ({ listClasses: (...a: unknown[]) => listClasses(...a) }))
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

beforeEach(() => listClasses.mockReset())

/** BF-03 / AC-ORG-UI-02: hết trần cứng 100 lớp — phân trang thật, đếm và huy hiệu nói rõ phần đã tải. */
describe('V2OrgClassesPage — phân trang', () => {
  it('trang đầu chưa hết → "đã tải N/M", huy hiệu thiếu GV theo phần đã tải, Tải thêm nối trang kế rồi đếm đủ', async () => {
    listClasses
      .mockResolvedValueOnce(page([klass(1, null), klass(2, 7)], 0, 3, false))
      .mockResolvedValueOnce(page([klass(3, null)], 1, 3, true))

    render(<V2OrgClassesPage />)

    await waitFor(() => expect(screen.getByText('Lớp 1')).toBeTruthy())
    expect(listClasses).toHaveBeenCalledWith(0, CLASSES_PAGE_SIZE)
    expect(screen.getByText('v2.org.classes.loadedOf:{"loaded":2,"total":3}')).toBeTruthy()
    expect(screen.getByText('v2.org.classes.unassignedBadgePartial:{"count":1,"loaded":2}')).toBeTruthy()

    await userEvent.click(screen.getByRole('button', { name: 'v2.org.classes.loadMore:{"remaining":1}' }))

    await waitFor(() => expect(screen.getByText('Lớp 3')).toBeTruthy())
    expect(listClasses).toHaveBeenLastCalledWith(1, CLASSES_PAGE_SIZE)
    expect(screen.getByText('v2.org.classes.count:{"count":3}')).toBeTruthy()
    expect(screen.getByText('v2.org.classes.unassignedBadge:{"count":2}')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /loadMore/ })).toBeNull()
  })

  it('tìm kiếm khi chưa tải hết → nhắc chỉ tìm trong phần đã tải; lọc client trên phần đã tải', async () => {
    listClasses.mockResolvedValueOnce(page([klass(1, 7), klass(2, 7)], 0, 5, false))

    render(<V2OrgClassesPage />)
    await waitFor(() => expect(screen.getByText('Lớp 2')).toBeTruthy())
    expect(screen.queryByText('v2.org.classes.searchHint')).toBeNull()

    await userEvent.type(screen.getByPlaceholderText('v2.org.classes.searchPlaceholder'), 'Lớp 2')

    expect(screen.getByText('v2.org.classes.searchHint')).toBeTruthy()
    expect(screen.queryByText('Lớp 1')).toBeNull()
    expect(screen.getByText('Lớp 2')).toBeTruthy()
  })

  it('một trang duy nhất → không có nút Tải thêm, đếm và huy hiệu như thường', async () => {
    listClasses.mockResolvedValueOnce(page([klass(1, null)], 0, 1, true))

    render(<V2OrgClassesPage />)
    await waitFor(() => expect(screen.getByText('Lớp 1')).toBeTruthy())
    expect(screen.getByText('v2.org.classes.count:{"count":1}')).toBeTruthy()
    expect(screen.getByText('v2.org.classes.unassignedBadge:{"count":1}')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /loadMore/ })).toBeNull()
    expect(listClasses).toHaveBeenCalledTimes(1)
  })
})
