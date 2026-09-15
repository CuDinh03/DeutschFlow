import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * V-12b — lỗi tải lời mời không được thành "không có lời mời nào".
 *
 * `listInvitations().catch(() => [])` biến MỌI lỗi thành mảng rỗng; biểu ngữ cam "N lời mời đang
 * chờ" biến mất im lặng và trung tâm đọc màn này như thể đã mời hết rồi.
 */

const listMembers = vi.fn()
const listInvitations = vi.fn()
const revokeInvitation = vi.fn()
const getOrgTeacherClasses = vi.fn()

vi.mock('@/lib/orgApi', () => ({
  listMembers: (...a: unknown[]) => listMembers(...a),
  listInvitations: () => listInvitations(),
  revokeInvitation: (...a: unknown[]) => revokeInvitation(...a),
  getOrgTeacherClasses: (...a: unknown[]) => getOrgTeacherClasses(...a),
}))
vi.mock('@/lib/api', () => ({ apiMessage: (e: unknown) => (e instanceof Error ? e.message : 'Lỗi') }))
vi.mock('sonner', () => ({ toast: Object.assign(() => undefined, { success: () => undefined, error: () => undefined }) }))
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}))
vi.mock('./CreateTeacherModal', () => ({ CreateTeacherModal: () => null }))
vi.mock('./AssignClassModal', () => ({ AssignClassModal: () => null }))
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

import V2OrgTeachersPage from '@/app/v2/org/teachers/page'

const teacher = { userId: 1, email: 'gv@ct.vn', displayName: 'Chị Lan', role: 'TEACHER', status: 'ACTIVE', joinedAt: '2026-09-01T00:00:00' }
const invite = { id: 9, email: 'moi@ct.vn', role: 'TEACHER', status: 'PENDING', expiresAt: '2026-09-20T00:00:00', createdAt: '2026-09-01T00:00:00' }

beforeEach(() => {
  for (const m of [listMembers, listInvitations, revokeInvitation, getOrgTeacherClasses]) m.mockReset()
  listMembers.mockResolvedValue([teacher])
  listInvitations.mockResolvedValue([invite])
})

describe('V2OrgTeachersPage — lời mời lỗi ≠ 0 lời mời (V-12b)', () => {
  it('lời mời chết ⇒ nói rõ + có nút Thử lại, KHÔNG im lặng bỏ biểu ngữ', async () => {
    listInvitations.mockRejectedValue(new Error('502 Bad Gateway'))

    render(<V2OrgTeachersPage />)

    await waitFor(() => expect(screen.getByText(/v2\.org\.teachers\.invitesError/)).toBeTruthy())
    expect(screen.getAllByRole('button', { name: 'v2.common.retry' }).length).toBeGreaterThan(0)
    // Danh sách giáo viên vẫn dùng bình thường: một nguồn hỏng không kéo cả trang xuống.
    expect(screen.getByText('Chị Lan')).toBeTruthy()
    expect(screen.queryByText('v2.org.teachers.loadError')).toBeNull()
  })

  it('lời mời tải được ⇒ hiện biểu ngữ, không hiện lỗi', async () => {
    render(<V2OrgTeachersPage />)

    await waitFor(() => expect(screen.getByText('v2.org.teachers.pendingBanner:{"count":1}')).toBeTruthy())
    expect(screen.queryByText(/v2\.org\.teachers\.invitesError/)).toBeNull()
  })

  it('danh sách giáo viên chết ⇒ vẫn là lỗi CẢ TRANG (nguồn chính)', async () => {
    listMembers.mockRejectedValue(new Error('502'))

    render(<V2OrgTeachersPage />)

    await waitFor(() => expect(screen.getByText('v2.org.teachers.loadError')).toBeTruthy())
  })
})
