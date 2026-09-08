import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Modal phân công lớp — hai đợt cùng chạm màn này, ca của cả hai giữ nguyên ở đây.
 *
 * V-01: nhãn "lớp chưa ai dạy" từng suy từ `teacherId == null`, mà cột đó NOT NULL nên KHÔNG BAO
 * GIỜ đúng. Nay suy từ tập id thật; nguồn hỏng thì hiện '—' chứ không rơi về `new Set()`, vì tập
 * rỗng đọc ra ĐÚNG BẰNG lời khẳng định cũ "lớp nào cũng đã có người khác dạy".
 *
 * V-10: nút "Phân công" HẠ giáo viên đang phụ trách xuống trợ giảng
 * (`OrgService.assignClassTeacher`), trước đây chỉ một cú bấm và nhãn nút không hé lộ điều đó.
 *
 * 🪤 Sau khi hai đợt gộp, nhãn nút và câu trong hộp thoại đều bám vào `stateOf(c)` — tức bám vào
 * TẬP ID chứ không còn bám `teacherId`. Ca nào muốn "lớp đang có người dạy" thì phải để lớp đó
 * NGOÀI tập teacherless, không phải chỉ đặt `teacherId`.
 */

const listClasses = vi.hoisted(() => vi.fn())
const getOrgTeacherClasses = vi.hoisted(() => vi.fn())
const getTeacherlessClassIds = vi.hoisted(() => vi.fn())
const assignClassTeacher = vi.hoisted(() => vi.fn())

vi.mock('@/lib/orgApi', () => ({
  listClasses: (...a: unknown[]) => listClasses(...a),
  getOrgTeacherClasses: (...a: unknown[]) => getOrgTeacherClasses(...a),
  getTeacherlessClassIds: () => getTeacherlessClassIds(),
  assignClassTeacher: (...a: unknown[]) => assignClassTeacher(...a),
  addOrgClassAssistant: vi.fn(),
}))
vi.mock('@/lib/api', () => ({ apiMessage: (e: unknown) => (e instanceof Error ? e.message : 'Lỗi') }))
vi.mock('sonner', () => ({ toast: Object.assign(() => undefined, { success: vi.fn(), error: vi.fn() }) }))
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
const teacher = {
  userId: 9, email: 'gv@ct.vn', displayName: 'Cô Lan',
  role: 'TEACHER' as const, status: 'ACTIVE' as const, joinedAt: '2026-09-01T00:00:00',
}
// teacherId khác userId của `teacher` để không rơi vào nhánh 'primary'.
const cls = (id: number, teacherId = 7) => ({
  id, name: `Lớp ${id}`, inviteCode: null, teacherId, createdAt: '2026-09-01T00:00:00',
})
const pageOf = (content: ReturnType<typeof cls>[]) => ({
  content, number: 0, size: 100, totalElements: content.length, totalPages: 1, first: true, last: true,
})
const renderModal = () =>
  render(<AssignClassModal teacher={teacher} onClose={vi.fn()} onAssigned={vi.fn()} />)

beforeEach(() => {
  for (const m of [listClasses, getOrgTeacherClasses, getTeacherlessClassIds, assignClassTeacher]) m.mockReset()
  listClasses.mockResolvedValue(pageOf([cls(1), cls(2)]))
  getOrgTeacherClasses.mockResolvedValue([])
  getTeacherlessClassIds.mockResolvedValue(new Set<number>())
})

describe('AssignClassModal — nhãn "chưa ai dạy" (V-01)', () => {
  it('tập id về được ⇒ nói đúng lớp nào chưa ai dạy, lớp nào đã có người', async () => {
    getTeacherlessClassIds.mockResolvedValue(new Set([2]))

    renderModal()

    await waitFor(() => expect(screen.getByText(`${NS}.statusUnassigned`)).toBeTruthy())
    expect(screen.getAllByText(`${NS}.statusTaken`)).toHaveLength(1)
  })

  it('tập id chết ⇒ "—", KHÔNG khẳng định mọi lớp đã có người khác dạy', async () => {
    getTeacherlessClassIds.mockRejectedValue(new Error('502'))

    renderModal()

    await waitFor(() => expect(screen.getByText('Lớp 1')).toBeTruthy())
    expect(screen.queryByText(`${NS}.statusTaken`)).toBeNull()
    expect(screen.queryByText(`${NS}.statusUnassigned`)).toBeNull()
    // Danh sách vẫn dùng được: hỏng nhãn không được kéo theo cả modal.
    expect(screen.getAllByRole('button', { name: `${NS}.assignBtn` })).toHaveLength(2)
  })
})

describe('AssignClassModal — xác nhận trước khi hạ giáo viên cũ xuống trợ giảng (V-10)', () => {
  it('lớp ĐANG có giáo viên: nhãn nói rõ là thay người, hộp thoại nêu việc hạ vai', async () => {
    listClasses.mockResolvedValue(pageOf([cls(1)]))
    getTeacherlessClassIds.mockResolvedValue(new Set<number>()) // lớp 1 KHÔNG rỗng giáo viên
    renderModal()

    // Nhãn nút: "Thay giáo viên phụ trách", không phải "Giao phụ trách" chung chung.
    const btn = await screen.findByRole('button', { name: `${NS}.assignBtnReplace` })
    await userEvent.click(btn)

    expect(screen.getByText(`${NS}.assignConfirmDemote`)).toBeTruthy()
    expect(screen.getByText(`${NS}.assignConfirmStays`)).toBeTruthy()
    expect(assignClassTeacher).not.toHaveBeenCalled()

    assignClassTeacher.mockResolvedValue(cls(1, teacher.userId))
    const confirms = screen.getAllByRole('button', { name: `${NS}.assignBtnReplace` })
    await userEvent.click(confirms[confirms.length - 1])

    await waitFor(() => expect(assignClassTeacher).toHaveBeenCalledWith(1, 9))
  })

  it('lớp CHƯA có giáo viên: hộp thoại nói không ai bị hạ vai, nhãn giữ "Giao phụ trách"', async () => {
    listClasses.mockResolvedValue(pageOf([cls(2)]))
    getTeacherlessClassIds.mockResolvedValue(new Set([2])) // lớp 2 thật sự chưa ai dạy
    renderModal()

    const btn = await screen.findByRole('button', { name: `${NS}.assignBtn` })
    await userEvent.click(btn)

    expect(screen.getByText(`${NS}.assignConfirmNoCurrent`)).toBeTruthy()
    expect(screen.queryByText(`${NS}.assignConfirmDemote`)).toBeNull()
    expect(assignClassTeacher).not.toHaveBeenCalled()
  })

  /**
   * Trợ giảng của một lớp ĐANG có giáo viên phụ trách — trường hợp phổ biến nhất của trợ giảng.
   * `stateOf` trả 'assistant' trước khi kịp xét teacherId, nên nếu hộp thoại hỏi bằng `stateOf`
   * thì nó nói "không ai bị hạ vai" đúng lúc có người sắp bị hạ vai.
   */
  it('trợ giảng của lớp ĐANG có người phụ trách: vẫn phải nêu việc hạ vai, không nói "không ai bị hạ"', async () => {
    listClasses.mockResolvedValue(pageOf([cls(3, 77)]))
    getOrgTeacherClasses.mockResolvedValue([{ id: 3, name: 'Lớp 3', role: 'ASSISTANT' }])
    renderModal()

    const btn = await screen.findByRole('button', { name: 'v2.org.teachers.assignModal.assignBtnReplace' })
    await userEvent.click(btn)

    expect(screen.getByText('v2.org.teachers.assignModal.assignConfirmDemote')).toBeTruthy()
    expect(screen.queryByText('v2.org.teachers.assignModal.assignConfirmNoCurrent')).toBeNull()
    expect(assignClassTeacher).not.toHaveBeenCalled()
  })

  it('Huỷ trong hộp thoại KHÔNG phân công', async () => {
    listClasses.mockResolvedValue(pageOf([cls(1)]))
    getTeacherlessClassIds.mockResolvedValue(new Set<number>())
    renderModal()

    await userEvent.click(await screen.findByRole('button', { name: `${NS}.assignBtnReplace` }))
    await userEvent.click(screen.getByRole('button', { name: `${NS}.cancelBtn` }))

    await waitFor(() => expect(screen.queryByText(`${NS}.assignConfirmDemote`)).toBeNull())
    expect(assignClassTeacher).not.toHaveBeenCalled()
  })
})
