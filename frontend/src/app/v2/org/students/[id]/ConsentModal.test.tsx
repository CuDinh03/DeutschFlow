import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * ConsentModal (D1/R6): phạm vi GUARDIAN_REPORT_SHARING có mặt trong ô chọn với mô tả ngắn; hộp xác nhận
 * nêu hệ quả ĐÚNG scope (chia sẻ phiếu ≠ mở phần nói); payload gửi đúng scope đã chọn.
 */

const recordStudentConsent = vi.fn()
vi.mock('@/lib/orgApi', () => ({
  recordStudentConsent: (...a: unknown[]) => recordStudentConsent(...a),
}))
vi.mock('@/lib/api', () => ({ apiMessage: (e: unknown) => (e instanceof Error ? e.message : 'Lỗi') }))
vi.mock('sonner', () => ({ toast: Object.assign(() => undefined, { success: vi.fn(), error: vi.fn() }) }))
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

import { ConsentModal } from '@/app/v2/org/students/[id]/ConsentModal'

const NS = 'v2.org.studentDetail.minor'
const guardians = [
  { id: 12, fullName: 'Giám hộ 12', relationship: 'MOTHER' as const, phone: '0900', email: 'me@x.vn', primary: true,
    createdAt: '2026-09-01T00:00:00Z', updatedAt: '2026-09-01T00:00:00Z' },
]

beforeEach(() => {
  recordStudentConsent.mockReset()
  recordStudentConsent.mockResolvedValue({ id: 1 })
})

describe('ConsentModal — scope GUARDIAN_REPORT_SHARING (R6)', () => {
  it('ô Phạm vi có đủ năm scope, kể cả chia sẻ phiếu; mô tả ngắn đổi theo scope đang chọn', async () => {
    render(<ConsentModal studentId={7} mode="grant" guardians={guardians} onClose={() => undefined} onSaved={() => undefined} />)

    const select = screen.getByLabelText(`${NS}.consentModal.scopeLabel`) as HTMLSelectElement
    const values = Array.from(select.options).map((o) => o.value)
    expect(values).toEqual(['AUDIO_RECORDING', 'GUARDIAN_REPORT_SHARING', 'AI_PROCESSING', 'DATA_PROCESSING', 'MESSAGING'])
    expect(screen.getByText(`${NS}.scope.GUARDIAN_REPORT_SHARING`)).toBeTruthy()
    expect(screen.getByTestId('consent-scope-hint').textContent).toBe(`${NS}.scopeHint.AUDIO_RECORDING`)

    await userEvent.selectOptions(select, 'GUARDIAN_REPORT_SHARING')
    expect(screen.getByTestId('consent-scope-hint').textContent).toBe(`${NS}.scopeHint.GUARDIAN_REPORT_SHARING`)
  })

  it('cấp cho chia sẻ phiếu: ConfirmDialog nêu hệ quả CHIA SẺ PHIẾU, không nêu "mở phần nói"; xác nhận → POST đúng scope, PAPER, gắn giám hộ chính', async () => {
    render(<ConsentModal studentId={7} mode="grant" guardians={guardians} onClose={() => undefined} onSaved={() => undefined} />)

    await userEvent.selectOptions(screen.getByLabelText(`${NS}.consentModal.scopeLabel`), 'GUARDIAN_REPORT_SHARING')
    await userEvent.click(screen.getByTestId('consent-submit'))

    expect(await screen.findByText(`${NS}.consentModal.confirmGrantTitle`)).toBeTruthy()
    expect(screen.getByText(`${NS}.consentModal.confirmDetailAppendOnly`)).toBeTruthy()
    expect(screen.getByText(`${NS}.consentModal.confirmGrantDetailReportSharing`)).toBeTruthy()
    expect(screen.queryByText(`${NS}.consentModal.confirmGrantDetailOpen`)).toBeNull()
    expect(screen.getByText(`${NS}.consentModal.confirmGrantDesc:{"scope":"${NS}.scope.GUARDIAN_REPORT_SHARING"}`)).toBeTruthy()
    expect(recordStudentConsent).not.toHaveBeenCalled()

    const buttons = screen.getAllByRole('button', { name: `${NS}.consentModal.submitGrant` })
    await userEvent.click(buttons[buttons.length - 1])

    await waitFor(() => expect(recordStudentConsent).toHaveBeenCalledTimes(1))
    expect(recordStudentConsent).toHaveBeenCalledWith(7, expect.objectContaining({
      scope: 'GUARDIAN_REPORT_SHARING', action: 'GRANTED', method: 'PAPER', guardianId: 12,
    }))
  })

  it('thu hồi chia sẻ phiếu: ConfirmDialog nêu "không còn được gửi phiếu", không nêu "khoá phần nói" → POST REVOKED đúng scope', async () => {
    render(<ConsentModal studentId={7} mode="revoke" guardians={guardians} onClose={() => undefined} onSaved={() => undefined} />)

    await userEvent.selectOptions(screen.getByLabelText(`${NS}.consentModal.scopeLabel`), 'GUARDIAN_REPORT_SHARING')
    await userEvent.click(screen.getByTestId('consent-submit'))

    expect(await screen.findByText(`${NS}.consentModal.confirmRevokeDetailReportSharing`)).toBeTruthy()
    expect(screen.queryByText(`${NS}.consentModal.confirmRevokeDetailLock`)).toBeNull()

    const buttons = screen.getAllByRole('button', { name: `${NS}.consentModal.submitRevoke` })
    await userEvent.click(buttons[buttons.length - 1])

    await waitFor(() => expect(recordStudentConsent).toHaveBeenCalledWith(7, expect.objectContaining({
      scope: 'GUARDIAN_REPORT_SHARING', action: 'REVOKED',
    })))
  })

  it('scope ghi âm (mặc định) giữ nguyên hệ quả cũ "mở phần nói" — không đổi hành vi đang có', async () => {
    render(<ConsentModal studentId={7} mode="grant" guardians={guardians} onClose={() => undefined} onSaved={() => undefined} />)

    await userEvent.click(screen.getByTestId('consent-submit'))

    expect(await screen.findByText(`${NS}.consentModal.confirmGrantDetailOpen`)).toBeTruthy()
    expect(screen.queryByText(`${NS}.consentModal.confirmGrantDetailReportSharing`)).toBeNull()
  })

  it('scope không có hệ quả tức thời (AI_PROCESSING): hộp xác nhận chỉ nêu "sổ chỉ ghi thêm"', async () => {
    render(<ConsentModal studentId={7} mode="grant" guardians={guardians} onClose={() => undefined} onSaved={() => undefined} />)

    await userEvent.selectOptions(screen.getByLabelText(`${NS}.consentModal.scopeLabel`), 'AI_PROCESSING')
    await userEvent.click(screen.getByTestId('consent-submit'))

    expect(await screen.findByText(`${NS}.consentModal.confirmDetailAppendOnly`)).toBeTruthy()
    expect(screen.queryByText(`${NS}.consentModal.confirmGrantDetailOpen`)).toBeNull()
    expect(screen.queryByText(`${NS}.consentModal.confirmGrantDetailReportSharing`)).toBeNull()
  })
})
