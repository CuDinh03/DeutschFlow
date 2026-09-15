import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AdminOrgDetail } from '@/lib/adminOrgApi'

/**
 * T-03 — form "Sửa gói & giấy phép": nút Lưu khoá khi chưa đổi gì, chỉ gửi trường đổi, ghế âm hiện
 * thành 0 (không giới hạn), hạ ghế dưới sĩ số phải qua ConfirmDialog DEC-16 rồi mới PATCH, bật
 * không-giới-hạn AI chỉ gửi poolUnlimited.
 */
const updateOrganization = vi.fn()
const toastSuccess = vi.fn()

vi.mock('@/lib/adminOrgApi', () => ({
  updateOrganization: (...a: unknown[]) => updateOrganization(...a),
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

import { LicenceForm } from './LicenceForm'

const NS = 'v2.adminOps.organizations.licence'
const org = (over: Partial<AdminOrgDetail> = {}): AdminOrgDetail => ({
  id: 9,
  name: 'TT Alpha',
  slug: 'alpha',
  planCode: 'PRO',
  seatLimit: 50,
  status: 'ACTIVE',
  monthlyTokenPool: 200000,
  poolUnlimited: false,
  validUntil: null,
  suspendedAt: null,
  teacherCount: 3,
  studentCount: 40,
  pendingInvites: 0,
  ...over,
})
const plans = [
  { code: 'PRO', name: 'Pro', isActive: true },
  { code: 'ULTRA', name: 'Ultra', isActive: true },
  { code: 'OLD', name: 'Old', isActive: false },
]

const saveBtn = () => screen.getByTestId('licence-save') as HTMLButtonElement
const seats = () => screen.getByTestId('licence-seats') as HTMLInputElement
const plan = () => screen.getByTestId('licence-plan') as HTMLSelectElement

beforeEach(() => {
  updateOrganization.mockReset()
  toastSuccess.mockReset()
  updateOrganization.mockResolvedValue({})
})

describe('LicenceForm — cổng lưu', () => {
  it('mở với giá trị hiện tại, nút Lưu khoá tới khi có thay đổi; gói ngừng bán không bày', () => {
    render(<LicenceForm org={org()} plans={plans} onSaved={() => undefined} />)

    expect(saveBtn().disabled).toBe(true)
    expect(screen.getByText(`${NS}.noChanges`)).toBeTruthy()
    expect(seats().value).toBe('50')
    expect(plan().value).toBe('PRO')
    expect(screen.queryByText('OLD')).toBeNull()

    fireEvent.change(seats(), { target: { value: '80' } })
    expect(saveBtn().disabled).toBe(false)
  })

  it('ghế âm → blur hiện 0 kèm nhãn "không giới hạn"; lưu gửi seatLimit: 0', async () => {
    const onSaved = vi.fn()
    render(<LicenceForm org={org()} plans={plans} onSaved={onSaved} />)

    fireEvent.change(seats(), { target: { value: '-5' } })
    fireEvent.blur(seats())
    expect(seats().value).toBe('0')
    expect(screen.getByText(`${NS}.seatUnlimited:{"used":"40"}`)).toBeTruthy()

    fireEvent.click(saveBtn())
    await waitFor(() => expect(updateOrganization).toHaveBeenCalledWith(9, { seatLimit: 0 }))
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
    expect(toastSuccess).toHaveBeenCalledWith(`${NS}.saved:{"org":"TT Alpha"}`)
  })

  it('hạ ghế dưới sĩ số: cảnh báo tại chỗ + ConfirmDialog DEC-16, chưa PATCH; xác nhận mới PATCH', async () => {
    render(<LicenceForm org={org()} plans={plans} onSaved={() => undefined} />)

    fireEvent.change(seats(), { target: { value: '30' } })
    expect(screen.getByText(`${NS}.seatBelowUsed:{"used":"40"}`)).toBeTruthy()

    fireEvent.click(saveBtn())
    expect(updateOrganization).not.toHaveBeenCalled()
    expect(screen.getByText(`${NS}.seatDrop.title`)).toBeTruthy()
    expect(screen.getByText(`${NS}.seatDrop.description:{"from":"50","to":"30","used":"40"}`)).toBeTruthy()
    expect(screen.getByText(`${NS}.seatDrop.detailKeep`)).toBeTruthy()
    expect(screen.getByText(`${NS}.seatDrop.detailBlock`)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: `${NS}.seatDrop.confirm` }))
    await waitFor(() => expect(updateOrganization).toHaveBeenCalledWith(9, { seatLimit: 30 }))
  })

  it('huỷ hộp thoại hạ ghế → không PATCH', () => {
    render(<LicenceForm org={org()} plans={plans} onSaved={() => undefined} />)
    fireEvent.change(seats(), { target: { value: '10' } })
    fireEvent.click(saveBtn())
    fireEvent.click(screen.getByRole('button', { name: `${NS}.seatDrop.cancel` }))
    expect(updateOrganization).not.toHaveBeenCalled()
    expect(screen.queryByText(`${NS}.seatDrop.title`)).toBeNull()
  })

  it('hạ ghế nhưng vẫn ≥ sĩ số → không hỏi, PATCH thẳng', async () => {
    render(<LicenceForm org={org()} plans={plans} onSaved={() => undefined} />)
    fireEvent.change(seats(), { target: { value: '45' } })
    fireEvent.click(saveBtn())
    await waitFor(() => expect(updateOrganization).toHaveBeenCalledWith(9, { seatLimit: 45 }))
    expect(screen.queryByText(`${NS}.seatDrop.title`)).toBeNull()
  })
})

describe('LicenceForm — hạn mức AI và hạn giấy phép', () => {
  it('bật không-giới-hạn → chỉ gửi poolUnlimited: true, ô số bị khoá', async () => {
    render(<LicenceForm org={org()} plans={plans} onSaved={() => undefined} />)
    const pool = screen.getByTestId('licence-pool') as HTMLInputElement
    expect(pool.disabled).toBe(false)

    fireEvent.click(screen.getByRole('radio', { name: `${NS}.aiUnlimited` }))
    expect(pool.disabled).toBe(true)
    fireEvent.click(saveBtn())
    await waitFor(() => expect(updateOrganization).toHaveBeenCalledWith(9, { poolUnlimited: true }))
  })

  it('hạn mức 0 hiện cảnh báo 429; từ không-giới-hạn về hạn mức gửi poolUnlimited:false + pool', async () => {
    render(<LicenceForm org={org({ poolUnlimited: true, monthlyTokenPool: 0 })} plans={plans} onSaved={() => undefined} />)
    expect(screen.queryByText(`${NS}.aiUnsetWarning`)).toBeNull()

    fireEvent.click(screen.getByRole('radio', { name: `${NS}.aiMetered` }))
    expect(screen.getByText(`${NS}.aiUnsetWarning`)).toBeTruthy()

    fireEvent.change(screen.getByTestId('licence-pool'), { target: { value: '300000' } })
    expect(screen.queryByText(`${NS}.aiUnsetWarning`)).toBeNull()
    fireEvent.click(saveBtn())
    await waitFor(() =>
      expect(updateOrganization).toHaveBeenCalledWith(9, { poolUnlimited: false, monthlyTokenPool: 300000 }),
    )
  })

  it('xoá hạn → gửi clearValidUntil: true; đặt ngày → gửi validUntil, không kèm clearValidUntil', async () => {
    const until = new Date(2026, 9, 31, 23, 59, 59, 999).toISOString()
    const { unmount } = render(<LicenceForm org={org({ validUntil: until })} plans={plans} onSaved={() => undefined} />)
    expect((screen.getByTestId('licence-valid-until') as HTMLInputElement).value).toBe('2026-10-31')

    fireEvent.click(screen.getByRole('button', { name: `${NS}.clearValidUntil` }))
    expect(screen.getByText(`${NS}.perpetualHint`)).toBeTruthy()
    fireEvent.click(saveBtn())
    await waitFor(() => expect(updateOrganization).toHaveBeenCalledWith(9, { clearValidUntil: true }))
    unmount()

    updateOrganization.mockClear()
    render(<LicenceForm org={org()} plans={plans} onSaved={() => undefined} />)
    fireEvent.change(screen.getByTestId('licence-valid-until'), { target: { value: '2026-12-31' } })
    fireEvent.click(saveBtn())
    await waitFor(() => expect(updateOrganization).toHaveBeenCalledTimes(1))
    const body = updateOrganization.mock.calls[0][1] as { validUntil?: string; clearValidUntil?: boolean }
    expect(body.clearValidUntil).toBeUndefined()
    const d = new Date(body.validUntil as string)
    expect([d.getFullYear(), d.getMonth() + 1, d.getDate()]).toEqual([2026, 12, 31])
  })

  it('backend từ chối → lỗi hiện trong form, không gọi onSaved', async () => {
    updateOrganization.mockRejectedValue(new Error('Trạng thái tổ chức không hợp lệ'))
    const onSaved = vi.fn()
    render(<LicenceForm org={org()} plans={plans} onSaved={onSaved} />)
    fireEvent.change(plan(), { target: { value: 'ULTRA' } })
    fireEvent.click(saveBtn())
    await waitFor(() => expect(screen.getByText('Trạng thái tổ chức không hợp lệ')).toBeTruthy())
    expect(onSaved).not.toHaveBeenCalled()
  })
})
