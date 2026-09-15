import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * V-12b — trang Phân quyền không còn nhánh "Đã gỡ" chết.
 *
 * `GET /org/members` chỉ trả thành viên ACTIVE (OrgService#listMembers gọi
 * `findByIdOrgIdAndStatus(orgId, 'ACTIVE')`), nên `m.status !== 'ACTIVE'` KHÔNG BAO GIỜ đúng: cả
 * dòng mờ, cột "Trạng thái" hai giá trị, việc ẩn nút gỡ và ẩn ô đổi vai đều là mã chết.
 */

const listMembers = vi.fn()
const removeMember = vi.fn()
const changeMemberRole = vi.fn()
const transferOwnership = vi.fn()
const getOrgRole = vi.fn()

vi.mock('@/lib/orgApi', () => ({
  listMembers: () => listMembers(),
  removeMember: (...a: unknown[]) => removeMember(...a),
  changeMemberRole: (...a: unknown[]) => changeMemberRole(...a),
  transferOwnership: (...a: unknown[]) => transferOwnership(...a),
}))
vi.mock('@/lib/authSession', () => ({ getOrgRole: () => getOrgRole() }))
vi.mock('@/lib/api', () => ({ apiMessage: (e: unknown) => (e instanceof Error ? e.message : 'Lỗi') }))
vi.mock('sonner', () => ({ toast: Object.assign(() => undefined, { success: () => undefined, error: () => undefined }) }))
vi.mock('./ApproverSection', () => ({ ApproverSection: () => null }))
vi.mock('@/lib/i18n/useFmt', () => ({ useFmt: () => ({ num: (n: number) => String(n) }) }))
vi.mock('next-intl', () => {
  const cache = new Map<string, unknown>()
  return {
    useLocale: () => 'vi',
    useTranslations: (ns: string) => {
      if (!cache.has(ns)) {
        cache.set(ns, (key: string, values?: Record<string, unknown>) =>
          values ? `${ns}.${key}:${JSON.stringify(values)}` : `${ns}.${key}`)
      }
      return cache.get(ns) as ReturnType<typeof import('next-intl').useTranslations>
    },
  }
})

import V2OrgRolesPage from '@/app/v2/org/roles/page'

const member = (userId: number, role: string) => ({
  userId, email: `u${userId}@ct.vn`, displayName: `Người ${userId}`,
  role, status: 'ACTIVE', joinedAt: '2026-09-01T00:00:00',
})

beforeEach(() => {
  for (const m of [listMembers, removeMember, changeMemberRole, transferOwnership, getOrgRole]) m.mockReset()
  getOrgRole.mockReturnValue('OWNER')
  listMembers.mockResolvedValue([member(1, 'OWNER'), member(2, 'TEACHER')])
})

describe('V2OrgRolesPage — nhánh "Đã gỡ" là mã chết (V-12b)', () => {
  it('không còn cột Trạng thái với hai giá trị bịa ra', async () => {
    render(<V2OrgRolesPage />)

    await waitFor(() => expect(screen.getByText('Người 2')).toBeTruthy())
    expect(screen.queryByText('v2.org.roles.colStatus')).toBeNull()
    expect(screen.queryByText('v2.org.roles.statusActive')).toBeNull()
    expect(screen.queryByText('v2.org.roles.statusRemoved')).toBeNull()
  })

  it('khoá catalog của nhánh chết đã gỡ khỏi cả ba ngôn ngữ', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    for (const loc of ['vi', 'en', 'de']) {
      const p = resolve(__dirname, '../../../../..', 'messages/v2', `org.${loc}.json`)
      const roles = (JSON.parse(readFileSync(p, 'utf8')) as { org: { roles: Record<string, unknown> } }).org.roles
      for (const k of ['colStatus', 'statusActive', 'statusRemoved']) {
        expect(roles, `${k} còn sót ở ${loc}`).not.toHaveProperty(k)
      }
    }
  })

  it('OWNER vẫn đổi vai và gỡ được mọi thành viên không phải OWNER', async () => {
    render(<V2OrgRolesPage />)

    await waitFor(() => expect(screen.getByText('Người 2')).toBeTruthy())
    // Ô đổi vai của giáo viên và nút gỡ phải hiện — trước đây cả hai bị `!removed` gác.
    expect(screen.getByLabelText('v2.org.roles.changeRoleAria:{"name":"Người 2"}')).toBeTruthy()
    expect(screen.getAllByRole('button', { name: 'v2.org.roles.remove' })).toHaveLength(1)
  })
})

describe('V2OrgRolesPage — chỉ OWNER mới gỡ được MANAGER (V-14)', () => {
  it('MANAGER không thấy nút gỡ trên hàng MANAGER khác, nhưng vẫn gỡ được TEACHER', async () => {
    getOrgRole.mockReturnValue('MANAGER')
    listMembers.mockResolvedValue([member(1, 'OWNER'), member(2, 'MANAGER'), member(3, 'TEACHER')])

    render(<V2OrgRolesPage />)

    await waitFor(() => expect(screen.getByText('Người 3')).toBeTruthy())
    // Backend trả 403 khi MANAGER gỡ MANAGER, nên nút phải vắng mặt chứ không phải
    // mở ConfirmDialog rồi mới báo lỗi. Chỉ còn đúng một nút gỡ: hàng TEACHER.
    expect(screen.getAllByRole('button', { name: 'v2.org.roles.remove' })).toHaveLength(1)
  })

  it('OWNER vẫn gỡ được cả MANAGER lẫn TEACHER', async () => {
    getOrgRole.mockReturnValue('OWNER')
    listMembers.mockResolvedValue([member(1, 'OWNER'), member(2, 'MANAGER'), member(3, 'TEACHER')])

    render(<V2OrgRolesPage />)

    await waitFor(() => expect(screen.getByText('Người 3')).toBeTruthy())
    expect(screen.getAllByRole('button', { name: 'v2.org.roles.remove' })).toHaveLength(2)
  })
})

/**
 * G-08 — chuyển quyền giám đốc trên web.
 *
 * `POST /org/members/{id}/transfer-ownership` (OrgController#transferOwnership → OrgMembershipService,
 * promote+demote trong một transaction) đã có từ lâu nhưng KHÔNG màn web nào gọi tới: OWNER không tự
 * rời được và không bị gỡ được, nên giám đốc nghỉ việc là trung tâm khoá cứng.
 */
describe('V2OrgRolesPage — chuyển quyền giám đốc (G-08)', () => {
  const T = 'v2.org.roles.transfer'
  const OK = 'v2.org.roles.transferDialogOk'

  it('nút chỉ hiện với OWNER, và chỉ trên hàng MANAGER/TEACHER', async () => {
    listMembers.mockResolvedValue([member(1, 'OWNER'), member(2, 'MANAGER'), member(3, 'TEACHER'), member(4, 'STUDENT')])

    render(<V2OrgRolesPage />)

    await waitFor(() => expect(screen.getByText('Người 4')).toBeTruthy())
    // Đúng hai nút: hàng MANAGER và hàng TEACHER. Không có trên hàng OWNER (backend chặn tự chuyển
    // cho chính mình) và không có trên hàng học viên (chỉ nhân sự nhận được quyền).
    expect(screen.getAllByRole('button', { name: T })).toHaveLength(2)
  })

  it('MANAGER không thấy nút nào — backend trả 403 cho người không phải OWNER', async () => {
    getOrgRole.mockReturnValue('MANAGER')
    listMembers.mockResolvedValue([member(1, 'OWNER'), member(2, 'MANAGER'), member(3, 'TEACHER')])

    render(<V2OrgRolesPage />)

    await waitFor(() => expect(screen.getByText('Người 3')).toBeTruthy())
    expect(screen.queryAllByRole('button', { name: T })).toHaveLength(0)
  })

  it('hộp thoại nêu đủ ba hệ quả: ai lên giám đốc, chính mình bị hạ, không lấy lại được', async () => {
    listMembers.mockResolvedValue([member(1, 'OWNER'), member(2, 'TEACHER')])

    render(<V2OrgRolesPage />)
    await waitFor(() => expect(screen.getByText('Người 2')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: T }))

    expect(screen.getByText('v2.org.roles.transferDialogDetailNewOwner:{"name":"Người 2"}')).toBeTruthy()
    expect(screen.getByText('v2.org.roles.transferDialogDetailSelfDemoted')).toBeTruthy()
    expect(screen.getByText('v2.org.roles.transferDialogDetailIrreversible')).toBeTruthy()
    // Chưa bấm xác nhận thì chưa gọi API — mở hộp thoại không phải là đồng ý.
    expect(transferOwnership).not.toHaveBeenCalled()
  })

  it('bấm Hủy thì KHÔNG gọi API', async () => {
    listMembers.mockResolvedValue([member(1, 'OWNER'), member(2, 'TEACHER')])

    render(<V2OrgRolesPage />)
    await waitFor(() => expect(screen.getByText('Người 2')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: T }))
    fireEvent.click(screen.getByRole('button', { name: 'v2.org.roles.removeDialogCancel' }))

    await waitFor(() => expect(screen.queryByRole('button', { name: OK })).toBeNull())
    expect(transferOwnership).not.toHaveBeenCalled()
  })

  it('xác nhận: gọi đúng userId, tải lại danh sách và HẠ vai người bấm khỏi OWNER', async () => {
    listMembers.mockResolvedValue([member(1, 'OWNER'), member(2, 'TEACHER')])
    transferOwnership.mockResolvedValue(member(2, 'OWNER'))

    render(<V2OrgRolesPage />)
    await waitFor(() => expect(screen.getByText('Người 2')).toBeTruthy())
    expect(listMembers).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: T }))
    fireEvent.click(screen.getByRole('button', { name: OK }))

    await waitFor(() => expect(transferOwnership).toHaveBeenCalledWith(2))
    // Làm mới danh sách…
    await waitFor(() => expect(listMembers).toHaveBeenCalledTimes(2))
    // …và màn hình không được nói dối: người bấm đã mất quyền OWNER nên mọi nút OWNER-only tắt.
    // (Cookie/JWT cũ vẫn mang orgRole=OWNER tới lần refresh token kế tiếp — không được tin lại nó.)
    await waitFor(() => expect(screen.queryAllByRole('button', { name: T })).toHaveLength(0))
    expect(screen.queryByLabelText('v2.org.roles.changeRoleAria:{"name":"Người 2"}')).toBeNull()
    expect(screen.getByText('v2.org.roles.transferDoneNote:{"name":"Người 2"}')).toBeTruthy()
  })
})
