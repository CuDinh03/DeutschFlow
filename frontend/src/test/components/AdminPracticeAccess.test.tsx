/**
 * Trang admin "Quyền luyện đề" (04/11/2026): đổi chế độ, tìm học viên rồi thêm, gỡ khỏi danh sách.
 */
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({
  get: vi.fn(),
  setMode: vi.fn(),
  add: vi.fn(),
  remove: vi.fn(),
  removeToken: vi.fn(),
  search: vi.fn(),
}))

vi.mock('next-intl', async () => (await import('@/test/intlCatalog')).nextIntlCatalogMock('vi'))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/lib/adminPracticeAccessApi', () => ({
  getPracticeAccessState: h.get,
  setPracticeAccessMode: h.setMode,
  addPracticeAccessUser: h.add,
  removePracticeAccessUser: h.remove,
  removePracticeAccessToken: h.removeToken,
  searchPracticeAccessUsers: h.search,
}))

import V2AdminPracticeAccessPage from '@/app/v2/admin/practice-access/page'

const lan = { id: 7, email: 'lan@test.local', displayName: 'Lan', role: 'STUDENT' }

describe('Admin — quyền luyện đề', () => {
  beforeEach(() => vi.clearAllMocks())

  it('tìm theo email rồi thêm; học viên vào danh sách và gỡ được', async () => {
    const user = userEvent.setup()
    h.get.mockResolvedValue({ mode: 'ALLOWLIST', members: [], unknown: [] })
    h.search.mockResolvedValue([lan])
    h.add.mockResolvedValue({ mode: 'ALLOWLIST', members: [lan], unknown: [] })
    h.remove.mockResolvedValue({ mode: 'ALLOWLIST', members: [], unknown: [] })

    render(<V2AdminPracticeAccessPage />)
    expect(await screen.findByText('Chưa có học viên nào trong danh sách.')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Tìm theo email hoặc tên'), 'lan@')
    await user.click(await screen.findByRole('button', { name: /Thêm$/ }))
    expect(h.add).toHaveBeenCalledWith('7')
    expect(await screen.findByText('Đang được dùng (1)')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Gỡ Lan' }))
    expect(h.remove).toHaveBeenCalledWith(7)
    await waitFor(() => expect(screen.getByText('Đang được dùng (0)')).toBeInTheDocument())
  })

  it('đổi chế độ sang Tất cả học viên', async () => {
    const user = userEvent.setup()
    h.get.mockResolvedValue({ mode: 'ALLOWLIST', members: [], unknown: ['cu@test.local'] })
    h.setMode.mockResolvedValue({ mode: 'ALL', members: [], unknown: ['cu@test.local'] })

    render(<V2AdminPracticeAccessPage />)
    expect(await screen.findByText('cu@test.local')).toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: /Tất cả học viên/ }))
    expect(h.setMode).toHaveBeenCalledWith('ALL')
    expect(await screen.findByText(/Đang mở cho tất cả/)).toBeInTheDocument()
  })
})
