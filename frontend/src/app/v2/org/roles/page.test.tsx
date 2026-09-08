import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
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
const getOrgRole = vi.fn()

vi.mock('@/lib/orgApi', () => ({
  listMembers: () => listMembers(),
  removeMember: (...a: unknown[]) => removeMember(...a),
  changeMemberRole: (...a: unknown[]) => changeMemberRole(...a),
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
  for (const m of [listMembers, removeMember, changeMemberRole, getOrgRole]) m.mockReset()
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
