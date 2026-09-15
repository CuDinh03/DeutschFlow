import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Chỉ định giám đốc (DEC-13 / A6) — hộp thoại phải KHOÁ nút xác nhận tới khi đủ dữ liệu, chỉ bày
 * nhân sự (không bày học viên), và gửi đúng body cho POST /admin/organizations/{id}/force-owner.
 * Backend cũng chặn, nhưng một request chắc chắn 400 không nên rời khỏi trình duyệt.
 */

const listOrgMembers = vi.fn()
const forceOwner = vi.fn()
const toastSuccess = vi.fn()

vi.mock('@/lib/adminOrgApi', () => ({
  listOrgMembers: (...a: unknown[]) => listOrgMembers(...a),
  forceOwner: (...a: unknown[]) => forceOwner(...a),
}))
vi.mock('@/lib/api', () => ({ apiMessage: (e: unknown) => (e instanceof Error ? e.message : 'Lỗi') }))
vi.mock('sonner', () => ({
  toast: Object.assign(() => undefined, { success: (...a: unknown[]) => toastSuccess(...a), error: () => undefined }),
}))
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

import { ForceOwnerDialog, FORCE_OWNER_REASON_MIN } from './ForceOwnerDialog'

const NS = 'v2.adminOps.organizations.forceOwner'
const org = { id: 9, name: 'TT Alpha', slug: 'alpha', planCode: 'PRO', seatLimit: 50, status: 'ACTIVE', monthlyTokenPool: null, validUntil: null }
const member = (userId: number, role: string, status = 'ACTIVE') => ({
  userId, email: `u${userId}@ct.vn`, displayName: `Người ${userId}`, role, status, joinedAt: '2026-09-01T00:00:00',
})
const VALID_REASON = 'Giám đốc cũ nghỉ việc, không bàn giao tài khoản.'

const confirmButton = () => screen.getByRole('button', { name: `${NS}.confirm` }) as HTMLButtonElement
const select = () => screen.getByRole('combobox') as HTMLSelectElement
const reasonBox = () => screen.getByPlaceholderText(`${NS}.reasonPlaceholder`) as HTMLTextAreaElement

beforeEach(() => {
  for (const m of [listOrgMembers, forceOwner, toastSuccess]) m.mockReset()
  listOrgMembers.mockResolvedValue([
    member(1, 'OWNER'),
    member(2, 'MANAGER'),
    member(3, 'TEACHER'),
    member(4, 'STUDENT'),
    member(5, 'TEACHER', 'REVOKED'),
  ])
})

describe('ForceOwnerDialog — ứng viên và hệ quả', () => {
  it('chỉ bày quản lý/giáo viên ĐANG HOẠT ĐỘNG; học viên, người đã gỡ và giám đốc duy nhất không phải ứng viên', async () => {
    render(<ForceOwnerDialog org={org} onClose={() => undefined} onDone={() => undefined} />)

    await waitFor(() => expect(listOrgMembers).toHaveBeenCalledWith(9))
    await waitFor(() => expect(screen.getByText(`Người 2 · ${NS}.role.MANAGER`)).toBeTruthy())
    expect(screen.getByText(`Người 3 · ${NS}.role.TEACHER`)).toBeTruthy()
    expect(screen.queryByText(/Người 1/)).toBeNull()
    expect(screen.queryByText(/Người 4/)).toBeNull()
    expect(screen.queryByText(/Người 5/)).toBeNull()
    // Hệ quả nêu rõ: 1 giám đốc bị hạ, đăng xuất, ghi sổ.
    expect(screen.getByText(`${NS}.detailDemote:{"count":1}`)).toBeTruthy()
    expect(screen.getByText(`${NS}.detailLogout`)).toBeTruthy()
    expect(screen.getByText(`${NS}.detailLedger`)).toBeTruthy()
  })

  it('trung tâm không có giám đốc: nêu đúng ca khôi phục', async () => {
    listOrgMembers.mockResolvedValue([member(3, 'TEACHER')])
    render(<ForceOwnerDialog org={org} onClose={() => undefined} onDone={() => undefined} />)

    await waitFor(() => expect(screen.getByText(`${NS}.detailRecover`)).toBeTruthy())
    expect(screen.queryByText(/detailDemote/)).toBeNull()
  })

  it('không có nhân sự nào: ô chọn bị khoá kèm lời giải thích, nút xác nhận khoá', async () => {
    listOrgMembers.mockResolvedValue([member(1, 'OWNER'), member(4, 'STUDENT')])
    render(<ForceOwnerDialog org={org} onClose={() => undefined} onDone={() => undefined} />)

    await waitFor(() => expect(screen.getByText(`${NS}.noCandidates`)).toBeTruthy())
    expect(select().disabled).toBe(true)
    expect(confirmButton().disabled).toBe(true)
  })
})

describe('ForceOwnerDialog — cổng xác nhận', () => {
  it('khoá nút tới khi CHỌN người VÀ lý do đủ dài; lý do toàn khoảng trắng không tính', async () => {
    render(<ForceOwnerDialog org={org} onClose={() => undefined} onDone={() => undefined} />)
    await waitFor(() => expect(screen.getByText(`Người 2 · ${NS}.role.MANAGER`)).toBeTruthy())

    expect(confirmButton().disabled).toBe(true)

    fireEvent.change(select(), { target: { value: '2' } })
    expect(confirmButton().disabled).toBe(true) // chưa có lý do

    fireEvent.change(reasonBox(), { target: { value: 'x'.repeat(FORCE_OWNER_REASON_MIN - 1) } })
    expect(confirmButton().disabled).toBe(true) // ngắn hơn sàn

    fireEvent.change(reasonBox(), { target: { value: '          ' + 'x'.repeat(3) } })
    expect(confirmButton().disabled).toBe(true) // khoảng trắng không đếm

    fireEvent.change(reasonBox(), { target: { value: VALID_REASON } })
    expect(confirmButton().disabled).toBe(false)
  })

  it('xác nhận: gửi đúng orgId, người được chọn và lý do đã trim; báo thành công rồi đóng + tải lại', async () => {
    forceOwner.mockResolvedValue(member(2, 'OWNER'))
    const onClose = vi.fn()
    const onDone = vi.fn()
    render(<ForceOwnerDialog org={org} onClose={onClose} onDone={onDone} />)
    await waitFor(() => expect(screen.getByText(`Người 2 · ${NS}.role.MANAGER`)).toBeTruthy())

    fireEvent.change(select(), { target: { value: '2' } })
    fireEvent.change(reasonBox(), { target: { value: `  ${VALID_REASON}  ` } })
    fireEvent.click(confirmButton())

    await waitFor(() => expect(forceOwner).toHaveBeenCalledWith(9, { newOwnerUserId: 2, reason: VALID_REASON }))
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(toastSuccess).toHaveBeenCalledWith(`${NS}.done:{"name":"Người 2","org":"TT Alpha"}`)
  })

  it('backend từ chối: hiện thông báo lỗi trong hộp thoại, KHÔNG đóng, không tải lại', async () => {
    forceOwner.mockRejectedValue(new Error('Quản trị viên nền tảng không được là thành viên trung tâm'))
    const onClose = vi.fn()
    const onDone = vi.fn()
    render(<ForceOwnerDialog org={org} onClose={onClose} onDone={onDone} />)
    await waitFor(() => expect(screen.getByText(`Người 3 · ${NS}.role.TEACHER`)).toBeTruthy())

    fireEvent.change(select(), { target: { value: '3' } })
    fireEvent.change(reasonBox(), { target: { value: VALID_REASON } })
    fireEvent.click(confirmButton())

    await waitFor(() =>
      expect(screen.getByText('Quản trị viên nền tảng không được là thành viên trung tâm')).toBeTruthy())
    expect(onClose).not.toHaveBeenCalled()
    expect(onDone).not.toHaveBeenCalled()
  })
})
