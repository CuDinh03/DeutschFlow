import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * V-01 (soát lại) — modal phân công lớp không được biến LỖI thành lời khẳng định.
 *
 * Đợt V-01 đổi nhãn "lớp chưa ai dạy" của bốn màn kia sang tập id thật và cho hiện '—' khi nguồn
 * chưa về. Riêng modal này rơi về `new Set()` khi `getTeacherlessClassIds()` hỏng, mà tập rỗng đọc
 * ra ĐÚNG BẰNG lời khẳng định cũ "lớp nào cũng đã có người khác dạy" — tức chính lỗi mà đợt này đi
 * sửa, còn nguyên trên màn mà org-admin dùng để đi tìm lớp cần người dạy.
 */

const listClasses = vi.fn()
const getOrgTeacherClasses = vi.fn()
const getTeacherlessClassIds = vi.fn()

vi.mock('@/lib/orgApi', () => ({
  listClasses: (...a: unknown[]) => listClasses(...a),
  getOrgTeacherClasses: (...a: unknown[]) => getOrgTeacherClasses(...a),
  getTeacherlessClassIds: () => getTeacherlessClassIds(),
  assignClassTeacher: vi.fn(),
  addOrgClassAssistant: vi.fn(),
}))
vi.mock('@/lib/api', () => ({ apiMessage: (e: unknown) => (e instanceof Error ? e.message : 'Lỗi') }))
vi.mock('sonner', () => ({ toast: Object.assign(() => undefined, { success: () => undefined, error: () => undefined }) }))
vi.mock('next-intl', () => {
  const cache = new Map<string, unknown>()
  return {
    useLocale: () => 'vi',
    // Cache theo namespace: `t` mới mỗi render sẽ làm effect phụ thuộc `t` chạy vô hạn và test TREO
    // thay vì đỏ (bẫy đã ghi lại ở màn Heute).
    useTranslations: (ns: string) => {
      if (!cache.has(ns)) {
        cache.set(ns, (key: string, values?: Record<string, unknown>) =>
          values ? `${ns}.${key}:${JSON.stringify(values)}` : `${ns}.${key}`)
      }
      return cache.get(ns) as ReturnType<typeof import('next-intl').useTranslations>
    },
  }
})

import { AssignClassModal } from '@/app/v2/org/teachers/AssignClassModal'

const NS = 'v2.org.teachers.assignModal'
const teacher = { userId: 9, email: 'gv@ct.vn', displayName: 'Cô Lan', role: 'TEACHER' as const, status: 'ACTIVE' as const, joinedAt: '2026-09-01T00:00:00' }
const klass = (id: number) => ({ id, name: `Lớp ${id}`, inviteCode: null, teacherId: 7, createdAt: '2026-09-01T00:00:00' })

beforeEach(() => {
  for (const m of [listClasses, getOrgTeacherClasses, getTeacherlessClassIds]) m.mockReset()
  listClasses.mockResolvedValue({ content: [klass(1), klass(2)], number: 0, size: 100, totalElements: 2, totalPages: 1, first: true, last: true })
  getOrgTeacherClasses.mockResolvedValue([])
  getTeacherlessClassIds.mockResolvedValue(new Set<number>())
})

describe('AssignClassModal — nhãn "chưa ai dạy" (V-01)', () => {
  it('tập id về được ⇒ nói đúng lớp nào chưa ai dạy, lớp nào đã có người', async () => {
    getTeacherlessClassIds.mockResolvedValue(new Set([2]))

    render(<AssignClassModal teacher={teacher} onClose={() => {}} onAssigned={() => {}} />)

    await waitFor(() => expect(screen.getByText(`${NS}.statusUnassigned`)).toBeTruthy())
    expect(screen.getAllByText(`${NS}.statusTaken`)).toHaveLength(1)
  })

  it('tập id chết ⇒ "—", KHÔNG khẳng định mọi lớp đã có người khác dạy', async () => {
    getTeacherlessClassIds.mockRejectedValue(new Error('502'))

    render(<AssignClassModal teacher={teacher} onClose={() => {}} onAssigned={() => {}} />)

    await waitFor(() => expect(screen.getByText('Lớp 1')).toBeTruthy())
    expect(screen.queryByText(`${NS}.statusTaken`)).toBeNull()
    expect(screen.queryByText(`${NS}.statusUnassigned`)).toBeNull()
    // Danh sách vẫn dùng được: hỏng nhãn không được kéo theo cả modal.
    expect(screen.getAllByRole('button', { name: `${NS}.assignBtn` })).toHaveLength(2)
  })
})
