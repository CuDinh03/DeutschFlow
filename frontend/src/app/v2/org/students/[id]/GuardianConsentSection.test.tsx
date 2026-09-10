import React from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Mục "Người giám hộ & đồng ý" (D1/R11, 10/09/2026) — ba điều khoá lại:
 *   1. Trạng thái tuổi + đồng ý hiện bằng NHÃN, không có ngày sinh thô ở bất kỳ đâu trong DOM.
 *   2. Ghi phiếu đồng ý / thu hồi đi qua ConfirmDialog nêu hệ quả, KHÔNG gọi API trước khi xác nhận;
 *      payload đúng: scope AUDIO_RECORDING, PAPER khi cấp, REVOKED khi thu hồi, gắn người giám hộ chính.
 *   3. Học viên đã rời trung tâm ⇒ không tải hồ sơ (máy chủ 404), chỉ hiện tóm tắt + câu giải thích.
 */

const listStudentGuardians = vi.fn()
const listStudentConsents = vi.fn()
const recordStudentConsent = vi.fn()
const addStudentGuardian = vi.fn()
const updateStudentGuardian = vi.fn()

vi.mock('@/lib/orgApi', () => ({
  listStudentGuardians: (...a: unknown[]) => listStudentGuardians(...a),
  listStudentConsents: (...a: unknown[]) => listStudentConsents(...a),
  recordStudentConsent: (...a: unknown[]) => recordStudentConsent(...a),
  addStudentGuardian: (...a: unknown[]) => addStudentGuardian(...a),
  updateStudentGuardian: (...a: unknown[]) => updateStudentGuardian(...a),
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

import { GuardianConsentSection } from '@/app/v2/org/students/[id]/GuardianConsentSection'
import type { OrgStudentDetail } from '@/lib/orgApi'

const NS = 'v2.org.studentDetail.minor'
const BIRTH_DATE = '2009-05-17'

const detail = (over: Partial<OrgStudentDetail> = {}): OrgStudentDetail => ({
  userId: 7,
  email: 'em@tt.vn',
  displayName: 'Em Bảy',
  role: 'STUDENT',
  status: 'ACTIVE',
  joinedAt: '2026-09-01T00:00:00Z',
  classes: [],
  minorStatus: 'MINOR_CENTER_POLICY',
  birthDateRecorded: true,
  audioConsentState: 'NEVER_RECORDED',
  guardianCount: 1,
  ...over,
})

const guardian = (id: number, primary: boolean) => ({
  id, fullName: `Giám hộ ${id}`, relationship: 'MOTHER' as const, phone: '0900', email: null, primary,
  createdAt: '2026-09-01T00:00:00Z', updatedAt: '2026-09-01T00:00:00Z',
})

beforeEach(() => {
  for (const m of [listStudentGuardians, listStudentConsents, recordStudentConsent, addStudentGuardian, updateStudentGuardian]) m.mockReset()
  listStudentGuardians.mockResolvedValue([guardian(11, false), guardian(12, true)])
  listStudentConsents.mockResolvedValue([])
})

describe('GuardianConsentSection', () => {
  it('hiện nhãn nhóm tuổi + trạng thái đồng ý + câu "phần nói đang khoá"; KHÔNG có ngày sinh thô trong DOM', async () => {
    const { container } = render(<GuardianConsentSection detail={detail()} onChanged={() => undefined} />)

    expect(screen.getByTestId('minor-status').textContent).toBe(`${NS}.status.MINOR_CENTER_POLICY`)
    expect(screen.getByTestId('audio-consent-state').textContent).toBe(`${NS}.audioConsent.NEVER_RECORDED`)
    expect(screen.getByTestId('audio-note').textContent).toContain(`${NS}.audioLocked`)
    await screen.findByText('Giám hộ 12')
    expect(container.innerHTML).not.toContain(BIRTH_DATE)
    expect(listStudentGuardians).toHaveBeenCalledWith(7)
    expect(listStudentConsents).toHaveBeenCalledWith(7)
  })

  it('cấp: mở form → bấm ghi → ConfirmDialog nêu hệ quả (chưa gọi API) → xác nhận → POST GRANTED/PAPER gắn giám hộ chính, rồi tải lại', async () => {
    recordStudentConsent.mockResolvedValue({ id: 1 })
    const onChanged = vi.fn()
    render(<GuardianConsentSection detail={detail()} onChanged={onChanged} />)
    await screen.findByText('Giám hộ 12')

    await userEvent.click(screen.getByTestId('consent-grant'))
    await userEvent.click(await screen.findByTestId('consent-submit'))

    // Hộp xác nhận: có mặt, nêu "sổ chỉ ghi thêm" + "mở lại phần nói"; API CHƯA được gọi.
    const dialog = await screen.findByText(`${NS}.consentModal.confirmGrantTitle`)
    expect(dialog).toBeTruthy()
    expect(screen.getByText(`${NS}.consentModal.confirmDetailAppendOnly`)).toBeTruthy()
    expect(screen.getByText(`${NS}.consentModal.confirmGrantDetailOpen`)).toBeTruthy()
    expect(recordStudentConsent).not.toHaveBeenCalled()

    const confirmButtons = screen.getAllByRole('button', { name: `${NS}.consentModal.submitGrant` })
    await userEvent.click(confirmButtons[confirmButtons.length - 1])

    await waitFor(() => expect(recordStudentConsent).toHaveBeenCalledTimes(1))
    expect(recordStudentConsent).toHaveBeenCalledWith(7, expect.objectContaining({
      scope: 'AUDIO_RECORDING', action: 'GRANTED', method: 'PAPER', guardianId: 12,
    }))
    // Ngày = hôm nay ⇒ KHÔNG gửi effectiveAt (máy chủ lấy "bây giờ", tránh "đồng ý ở tương lai").
    expect(recordStudentConsent.mock.calls[0][1].effectiveAt).toBeUndefined()
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
    expect(listStudentConsents).toHaveBeenCalledTimes(2)
  })

  it('thu hồi: ConfirmDialog nêu "khoá lại phần nói ngay" → POST REVOKED', async () => {
    recordStudentConsent.mockResolvedValue({ id: 2 })
    render(<GuardianConsentSection detail={detail({ audioConsentState: 'GRANTED' })} onChanged={() => undefined} />)
    await screen.findByText('Giám hộ 12')

    await userEvent.click(screen.getByTestId('consent-revoke'))
    await userEvent.click(await screen.findByTestId('consent-submit'))
    expect(await screen.findByText(`${NS}.consentModal.confirmRevokeDetailLock`)).toBeTruthy()
    expect(recordStudentConsent).not.toHaveBeenCalled()

    const buttons = screen.getAllByRole('button', { name: `${NS}.consentModal.submitRevoke` })
    await userEvent.click(buttons[buttons.length - 1])

    await waitFor(() => expect(recordStudentConsent).toHaveBeenCalledWith(7, expect.objectContaining({
      scope: 'AUDIO_RECORDING', action: 'REVOKED',
    })))
  })

  it('sổ đồng ý liệt kê dòng mới nhất trước với nhãn scope/action/method, người ghi và ghi chú', async () => {
    listStudentConsents.mockResolvedValue([
      { id: 5, scope: 'AUDIO_RECORDING', action: 'REVOKED', method: 'PHONE', guardianId: 12, guardianName: 'Giám hộ 12', termsVersion: '2026-09', effectiveAt: '2026-09-10T03:00:00Z', recordedByUserId: 2, recordedByName: 'Quản lý', note: 'mẹ gọi rút', createdAt: '2026-09-10T03:00:00Z' },
      { id: 4, scope: 'AUDIO_RECORDING', action: 'GRANTED', method: 'PAPER', guardianId: 12, guardianName: 'Giám hộ 12', termsVersion: '2026-09', effectiveAt: '2026-09-01T03:00:00Z', recordedByUserId: 2, recordedByName: 'Quản lý', note: 'roster-import', createdAt: '2026-09-01T03:00:00Z' },
    ])
    render(<GuardianConsentSection detail={detail({ audioConsentState: 'REVOKED' })} onChanged={() => undefined} />)

    const table = await screen.findByTestId('consent-ledger')
    const rows = within(table).getAllByRole('row').slice(1)
    expect(rows).toHaveLength(2)
    expect(rows[0].textContent).toContain(`${NS}.action.REVOKED`)
    expect(rows[0].textContent).toContain(`${NS}.method.PHONE`)
    expect(rows[0].textContent).toContain('mẹ gọi rút')
    expect(rows[1].textContent).toContain(`${NS}.action.GRANTED`)
    expect(rows[1].textContent).toContain('2026-09')
  })

  it('thêm người giám hộ: form → lưu → POST với liên lạc, người đầu tiên không tự thành chính khi đã có người', async () => {
    addStudentGuardian.mockResolvedValue(guardian(13, false))
    render(<GuardianConsentSection detail={detail()} onChanged={() => undefined} />)
    await screen.findByText('Giám hộ 12')

    await userEvent.click(screen.getByTestId('guardian-add'))
    await userEvent.type(screen.getByLabelText(`${NS}.guardianModal.nameLabel`), 'Nguyễn Văn Cha')
    await userEvent.selectOptions(screen.getByLabelText(`${NS}.guardianModal.relationshipLabel`), 'FATHER')
    await userEvent.type(screen.getByLabelText(`${NS}.guardianModal.emailLabel`), 'Cha@Example.com')
    await userEvent.click(screen.getByTestId('guardian-submit'))

    await waitFor(() => expect(addStudentGuardian).toHaveBeenCalledWith(7, {
      fullName: 'Nguyễn Văn Cha', relationship: 'FATHER', phone: undefined, email: 'cha@example.com', primary: false,
    }))
  })

  it('thêm người giám hộ thiếu mọi cách liên lạc → báo lỗi tại chỗ, không gọi API', async () => {
    render(<GuardianConsentSection detail={detail()} onChanged={() => undefined} />)
    await screen.findByText('Giám hộ 12')

    await userEvent.click(screen.getByTestId('guardian-add'))
    await userEvent.type(screen.getByLabelText(`${NS}.guardianModal.nameLabel`), 'Không liên lạc')
    await userEvent.click(screen.getByTestId('guardian-submit'))

    expect(await screen.findByText(`${NS}.guardianModal.invalid`)).toBeTruthy()
    expect(addStudentGuardian).not.toHaveBeenCalled()
  })

  it('R6/R11: email giám hộ trùng email học viên (khác hoa thường) → báo lỗi tại chỗ, không gọi API', async () => {
    render(<GuardianConsentSection detail={detail({ email: 'Em@TT.vn' })} onChanged={() => undefined} />)
    await screen.findByText('Giám hộ 12')

    await userEvent.click(screen.getByTestId('guardian-add'))
    await userEvent.type(screen.getByLabelText(`${NS}.guardianModal.nameLabel`), 'Mẹ')
    await userEvent.type(screen.getByLabelText(`${NS}.guardianModal.emailLabel`), 'em@tt.vn')
    await userEvent.click(screen.getByTestId('guardian-submit'))

    expect(await screen.findByText(`${NS}.guardianModal.emailIsStudent`)).toBeTruthy()
    expect(addStudentGuardian).not.toHaveBeenCalled()
  })

  it('sổ đồng ý hiện dòng scope GUARDIAN_REPORT_SHARING bằng nhãn scope tương ứng', async () => {
    listStudentConsents.mockResolvedValue([
      { id: 6, scope: 'GUARDIAN_REPORT_SHARING', action: 'GRANTED', method: 'PAPER', guardianId: 12, guardianName: 'Giám hộ 12', termsVersion: '2026-09', effectiveAt: '2026-09-10T03:00:00Z', recordedByUserId: 2, recordedByName: 'Quản lý', note: 'roster-import', createdAt: '2026-09-10T03:00:00Z' },
    ])
    render(<GuardianConsentSection detail={detail()} onChanged={() => undefined} />)

    expect(await screen.findByText(`${NS}.scope.GUARDIAN_REPORT_SHARING`)).toBeTruthy()
  })

  it('học viên đã rời trung tâm: hiện tóm tắt + câu giải thích, KHÔNG tải hồ sơ, không có nút ghi', () => {
    render(<GuardianConsentSection detail={detail({ status: 'REVOKED' })} onChanged={() => undefined} />)

    expect(screen.getByTestId('minor-inactive-note')).toBeTruthy()
    expect(screen.getByTestId('minor-status')).toBeTruthy()
    expect(screen.queryByTestId('consent-grant')).toBeNull()
    expect(screen.queryByTestId('guardian-add')).toBeNull()
    expect(listStudentGuardians).not.toHaveBeenCalled()
    expect(listStudentConsents).not.toHaveBeenCalled()
  })

  it('đủ tuổi: câu "không cần đồng ý" — nhóm tuổi vẫn chỉ là nhãn', () => {
    render(<GuardianConsentSection detail={detail({ minorStatus: 'ADULT', audioConsentState: 'NEVER_RECORDED' })} onChanged={() => undefined} />)
    expect(screen.getByTestId('audio-note').textContent).toContain(`${NS}.audioAdult`)
  })
})
