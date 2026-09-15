import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AdminOrgDetail, OrgInvoice } from '@/lib/adminOrgApi'

/**
 * T-01 — sổ hoá đơn: nút chuyển trạng thái đúng theo máy trạng thái một chiều (M-15), mỗi nút qua
 * ConfirmDialog nêu hệ quả thật (PAID = mở khoá + gia hạn tới cuối kỳ + cấp lại quyền lợi), xác
 * nhận mới gọi PATCH .../invoices/{id}/status, huỷ thì không.
 */
const updateInvoiceStatus = vi.fn()
const createInvoice = vi.fn()
const toastSuccess = vi.fn()

vi.mock('@/lib/adminOrgApi', () => ({
  updateInvoiceStatus: (...a: unknown[]) => updateInvoiceStatus(...a),
  createInvoice: (...a: unknown[]) => createInvoice(...a),
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

import { InvoicePanel } from './InvoicePanel'

const NS = 'v2.adminOps.organizations.invoices'
const org: AdminOrgDetail = {
  id: 9,
  name: 'TT Alpha',
  slug: 'alpha',
  planCode: 'PRO',
  seatLimit: 50,
  status: 'ACTIVE',
  monthlyTokenPool: 0,
  poolUnlimited: true,
  validUntil: null,
  suspendedAt: null,
  teacherCount: 3,
  studentCount: 25,
  pendingInvites: 0,
}
const inv = (id: number, status: string, over: Partial<OrgInvoice> = {}): OrgInvoice => ({
  id,
  orgId: 9,
  periodStart: '2026-10-01',
  periodEnd: '2026-12-31',
  seats: 25,
  amountVnd: 12_500_000,
  status,
  paymentCode: `DFINV00000000${id}`,
  note: null,
  createdAt: '2026-09-10T08:00:00Z',
  dueDate: null,
  ...over,
})

const btn = (id: number, to: string) => screen.queryByTestId(`invoice-${id}-${to}`) as HTMLButtonElement | null

beforeEach(() => {
  for (const m of [updateInvoiceStatus, createInvoice, toastSuccess]) m.mockReset()
  updateInvoiceStatus.mockResolvedValue({})
})

describe('InvoicePanel — nút theo máy trạng thái một chiều', () => {
  it('DRAFT: gửi/đã thu/huỷ · SENT: đã thu/huỷ · PAID, VOID: không nút', () => {
    render(
      <InvoicePanel org={org} invoices={[inv(1, 'DRAFT'), inv(2, 'SENT'), inv(3, 'PAID'), inv(4, 'VOID')]} onChanged={() => undefined} />,
    )
    expect(btn(1, 'sent')).toBeTruthy()
    expect(btn(1, 'paid')).toBeTruthy()
    expect(btn(1, 'void')).toBeTruthy()
    expect(btn(2, 'sent')).toBeNull()
    expect(btn(2, 'paid')).toBeTruthy()
    expect(btn(2, 'void')).toBeTruthy()
    for (const id of [3, 4]) for (const to of ['sent', 'paid', 'void']) expect(btn(id, to)).toBeNull()
    expect(screen.getByText(`${NS}.status.PAID`)).toBeTruthy()
    expect(screen.getByText(`${NS}.status.VOID`)).toBeTruthy()
  })

  it('SENT quá hạn hiện nhãn quá hạn; SENT còn hạn thì không', () => {
    render(
      <InvoicePanel
        org={org}
        invoices={[inv(2, 'SENT', { dueDate: '2020-01-01T00:00:00Z' }), inv(5, 'SENT', { dueDate: '2999-01-01T00:00:00Z' })]}
        onChanged={() => undefined}
      />,
    )
    expect(screen.getAllByText(`${NS}.overdue`)).toHaveLength(1)
  })

  it('không có hoá đơn → trạng thái rỗng, vẫn có nút tạo', () => {
    render(<InvoicePanel org={org} invoices={[]} onChanged={() => undefined} />)
    expect(screen.getByText(`${NS}.empty`)).toBeTruthy()
    expect(screen.getByTestId('invoice-create')).toBeTruthy()
  })
})

describe('InvoicePanel — hộp thoại hệ quả rồi mới PATCH', () => {
  it('DRAFT → SENT: hộp thoại nêu hạn +7 ngày, xác nhận gọi PATCH SENT, báo rồi tải lại', async () => {
    const onChanged = vi.fn()
    render(<InvoicePanel org={org} invoices={[inv(1, 'DRAFT')]} onChanged={onChanged} />)

    fireEvent.click(btn(1, 'sent') as HTMLButtonElement)
    expect(updateInvoiceStatus).not.toHaveBeenCalled()
    expect(screen.getByText(`${NS}.dialog.send.title:{"id":"1"}`)).toBeTruthy()
    expect(screen.getByText(/dialog\.send\.detailDue/)).toBeTruthy()
    expect(screen.getByText(`${NS}.dialog.send.detailNoRevert`)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: `${NS}.dialog.send.confirm` }))
    await waitFor(() => expect(updateInvoiceStatus).toHaveBeenCalledWith(9, 1, 'SENT'))
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1))
    expect(toastSuccess).toHaveBeenCalledWith(`${NS}.changed:{"id":"1","status":"${NS}.status.SENT"}`)
  })

  it('SENT → PAID: hộp thoại nêu mở khoá + gia hạn tới cuối kỳ + cấp lại quyền lợi cho 25 HV; xác nhận gọi PATCH PAID', async () => {
    render(<InvoicePanel org={org} invoices={[inv(2, 'SENT')]} onChanged={() => undefined} />)

    fireEvent.click(btn(2, 'paid') as HTMLButtonElement)
    expect(screen.getByText(`${NS}.dialog.paid.title:{"id":"2"}`)).toBeTruthy()
    expect(screen.getByText(`${NS}.dialog.paid.detailActivate:{"org":"TT Alpha"}`)).toBeTruthy()
    // Gia hạn tới cuối kỳ = periodEnd + 1 ngày (khớp AdminOrgService.activateForPaidInvoice).
    expect(screen.getByText(/dialog\.paid\.detailExtend:\{"date":"01\/01\/2027"\}/)).toBeTruthy()
    expect(screen.getByText(`${NS}.dialog.paid.detailRegrant:{"count":"25"}`)).toBeTruthy()
    expect(screen.getByText(`${NS}.dialog.paid.detailNoRevert`)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: `${NS}.dialog.paid.confirm` }))
    await waitFor(() => expect(updateInvoiceStatus).toHaveBeenCalledWith(9, 2, 'PAID'))
  })

  it('hoá đơn không có kỳ → hộp thoại PAID nói hạn giữ nguyên', () => {
    render(<InvoicePanel org={org} invoices={[inv(2, 'SENT', { periodEnd: null })]} onChanged={() => undefined} />)
    fireEvent.click(btn(2, 'paid') as HTMLButtonElement)
    expect(screen.getByText(`${NS}.dialog.paid.detailNoPeriod`)).toBeTruthy()
    expect(screen.queryByText(/detailExtend/)).toBeNull()
  })

  it('SENT → VOID: hộp thoại nêu huỷ vĩnh viễn; huỷ hộp thoại thì KHÔNG PATCH; xác nhận thì PATCH VOID', async () => {
    render(<InvoicePanel org={org} invoices={[inv(2, 'SENT')]} onChanged={() => undefined} />)

    fireEvent.click(btn(2, 'void') as HTMLButtonElement)
    expect(screen.getByText(`${NS}.dialog.void.detailFinal`)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: `${NS}.dialog.cancel` }))
    expect(updateInvoiceStatus).not.toHaveBeenCalled()
    expect(screen.queryByText(`${NS}.dialog.void.detailFinal`)).toBeNull()

    fireEvent.click(btn(2, 'void') as HTMLButtonElement)
    fireEvent.click(screen.getByRole('button', { name: `${NS}.dialog.void.confirm` }))
    await waitFor(() => expect(updateInvoiceStatus).toHaveBeenCalledWith(9, 2, 'VOID'))
  })

  it('backend từ chối chuyển trạng thái → lỗi hiện trong bảng, không tải lại', async () => {
    updateInvoiceStatus.mockRejectedValue(new Error('Không thể chuyển trạng thái hoá đơn từ PAID sang VOID'))
    const onChanged = vi.fn()
    render(<InvoicePanel org={org} invoices={[inv(1, 'DRAFT')]} onChanged={onChanged} />)
    fireEvent.click(btn(1, 'void') as HTMLButtonElement)
    fireEvent.click(screen.getByRole('button', { name: `${NS}.dialog.void.confirm` }))
    await waitFor(() =>
      expect(screen.getByText('Không thể chuyển trạng thái hoá đơn từ PAID sang VOID')).toBeTruthy(),
    )
    expect(onChanged).not.toHaveBeenCalled()
  })
})

describe('InvoicePanel — tạo hoá đơn', () => {
  it('mở modal: ghế mặc định = sĩ số HV; số tiền 0 bị chặn tại chỗ; hợp lệ thì POST đúng body', async () => {
    createInvoice.mockResolvedValue({ id: 7, amountVnd: 12_500_000 })
    const onChanged = vi.fn()
    render(<InvoicePanel org={org} invoices={[]} onChanged={onChanged} />)

    fireEvent.click(screen.getByTestId('invoice-create'))
    expect((screen.getByTestId('invoice-seats') as HTMLInputElement).value).toBe('25')

    fireEvent.click(screen.getByTestId('invoice-submit'))
    expect(createInvoice).not.toHaveBeenCalled()
    expect(screen.getByText(`${NS}.createModal.errAmount`)).toBeTruthy()

    fireEvent.change(screen.getByTestId('invoice-period-start'), { target: { value: '2026-10-01' } })
    fireEvent.change(screen.getByTestId('invoice-period-end'), { target: { value: '2026-09-01' } })
    fireEvent.change(screen.getByTestId('invoice-amount'), { target: { value: '12500000' } })
    fireEvent.click(screen.getByTestId('invoice-submit'))
    expect(createInvoice).not.toHaveBeenCalled()
    expect(screen.getByText(`${NS}.createModal.errPeriod`)).toBeTruthy()

    fireEvent.change(screen.getByTestId('invoice-period-end'), { target: { value: '2026-12-31' } })
    fireEvent.click(screen.getByTestId('invoice-submit'))
    await waitFor(() =>
      expect(createInvoice).toHaveBeenCalledWith(9, {
        periodStart: '2026-10-01',
        periodEnd: '2026-12-31',
        seats: 25,
        amountVnd: 12_500_000,
        note: undefined,
      }),
    )
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1))
  })
})
