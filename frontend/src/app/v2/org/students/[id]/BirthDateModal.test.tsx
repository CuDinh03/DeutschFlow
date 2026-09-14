import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Ô sửa ngày sinh của trung tâm (Q-02/Q-05/Q-07, owner chốt 14/09/2026) — bốn điều khoá lại:
 *   1. Nút sửa CÓ trên mục giám hộ, và chỉ với học viên còn là thành viên.
 *   2. Giá trị hiện tại tải qua đường RIÊNG (`getStudentBirthDate`), không lấy từ `OrgStudentDetail` —
 *      DTO đó cố ý không mang ngày sinh thô.
 *   3. Hai câu hệ quả (học viên được báo · đổi nhóm tuổi là đổi quyền) hiện ngay trong modal, không
 *      giấu trong tooltip: đó là cái giá của quyền sửa.
 *   4. Ngày tương lai bị chặn TẠI CHỖ, không gọi API.
 */

const getStudentBirthDate = vi.fn()
const setStudentBirthDate = vi.fn()
const listStudentGuardians = vi.fn()
const listStudentConsents = vi.fn()

vi.mock('@/lib/orgApi', () => ({
  getStudentBirthDate: (...a: unknown[]) => getStudentBirthDate(...a),
  setStudentBirthDate: (...a: unknown[]) => setStudentBirthDate(...a),
  listStudentGuardians: (...a: unknown[]) => listStudentGuardians(...a),
  listStudentConsents: (...a: unknown[]) => listStudentConsents(...a),
  recordStudentConsent: vi.fn(),
  addStudentGuardian: vi.fn(),
  updateStudentGuardian: vi.fn(),
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

import { BirthDateModal } from '@/app/v2/org/students/[id]/BirthDateModal'
import { GuardianConsentSection } from '@/app/v2/org/students/[id]/GuardianConsentSection'
import type { OrgStudentBirthDate, OrgStudentDetail } from '@/lib/orgApi'

const NS = 'v2.org.studentDetail.minor'
const CURRENT = '2011-05-17'

const record = (over: Partial<OrgStudentBirthDate> = {}): OrgStudentBirthDate => ({
  birthDate: CURRENT,
  recordedAt: '2026-09-10T03:00:00Z',
  recordedByUserId: 5,
  recordedByName: 'Chị Quản Lý',
  minorStatus: 'MINOR_LEGAL',
  ...over,
})

const detail = (over: Partial<OrgStudentDetail> = {}): OrgStudentDetail => ({
  userId: 7,
  email: 'em@tt.vn',
  displayName: 'Em Bảy',
  role: 'STUDENT',
  status: 'ACTIVE',
  joinedAt: '2026-09-01T00:00:00Z',
  classes: [],
  minorStatus: 'MINOR_LEGAL',
  birthDateRecorded: true,
  audioConsentState: 'NEVER_RECORDED',
  guardianCount: 0,
  ...over,
})

beforeEach(() => {
  for (const m of [getStudentBirthDate, setStudentBirthDate, listStudentGuardians, listStudentConsents]) m.mockReset()
  getStudentBirthDate.mockResolvedValue(record())
  setStudentBirthDate.mockResolvedValue(record({ birthDate: '2007-05-17', minorStatus: 'ADULT' }))
  listStudentGuardians.mockResolvedValue([])
  listStudentConsents.mockResolvedValue([])
})

describe('BirthDateModal — trung tâm sửa ngày sinh', () => {
  it('tải giá trị hiện tại qua đường riêng và hiện ai đã đặt nó', async () => {
    render(<BirthDateModal studentId={7} onClose={() => {}} onSaved={() => {}} />)

    await waitFor(() => expect(getStudentBirthDate).toHaveBeenCalledWith(7))
    const input = await screen.findByTestId('birth-date-input')
    expect(input).toHaveValue(CURRENT)
    expect(screen.getByTestId('birth-date-provenance').textContent).toContain('Chị Quản Lý')
  })

  it('nói thẳng hai hệ quả: học viên được báo, và đổi nhóm tuổi là đổi quyền', async () => {
    render(<BirthDateModal studentId={7} onClose={() => {}} onSaved={() => {}} />)

    expect(await screen.findByTestId('birth-date-notice-hint')).toHaveTextContent(`${NS}.birthDateModal.noticeHint`)
    expect(screen.getByText(`${NS}.birthDateModal.gateHint`)).toBeInTheDocument()
  })

  it('lưu giá trị mới ⇒ gọi API đúng một lần rồi báo cho trang cha', async () => {
    const onSaved = vi.fn()
    const onClose = vi.fn()
    render(<BirthDateModal studentId={7} onClose={onClose} onSaved={onSaved} />)

    const input = await screen.findByTestId('birth-date-input')
    await userEvent.clear(input)
    await userEvent.type(input, '2007-05-17')
    await userEvent.click(screen.getByTestId('birth-date-submit'))

    await waitFor(() => expect(setStudentBirthDate).toHaveBeenCalledWith(7, '2007-05-17'))
    expect(setStudentBirthDate).toHaveBeenCalledTimes(1)
    expect(onSaved).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('🔴 ngày tương lai bị chặn tại chỗ, KHÔNG gọi API', async () => {
    render(<BirthDateModal studentId={7} onClose={() => {}} onSaved={() => {}} />)

    const tomorrow = new Date(Date.now() + 864e5).toISOString().slice(0, 10)
    const input = await screen.findByTestId('birth-date-input')
    await userEvent.clear(input)
    await userEvent.type(input, tomorrow)
    await userEvent.click(screen.getByTestId('birth-date-submit'))

    await waitFor(() => expect(screen.getByText(`${NS}.birthDateModal.future`)).toBeInTheDocument())
    expect(setStudentBirthDate).not.toHaveBeenCalled()
  })
})

describe('GuardianConsentSection — lối vào ô sửa', () => {
  it('học viên còn là thành viên ⇒ có nút sửa ngày sinh, và DOM vẫn KHÔNG lộ ngày sinh thô', async () => {
    render(<GuardianConsentSection detail={detail()} onChanged={() => {}} />)

    expect(await screen.findByTestId('birth-date-edit')).toBeInTheDocument()
    expect(document.body.textContent).not.toContain(CURRENT)
    expect(getStudentBirthDate).not.toHaveBeenCalled()
  })

  it('học viên đã rời trung tâm ⇒ không có nút sửa (máy chủ cũng trả 404)', async () => {
    render(<GuardianConsentSection detail={detail({ status: 'LEFT' })} onChanged={() => {}} />)

    await waitFor(() => expect(screen.queryByTestId('birth-date-edit')).not.toBeInTheDocument())
  })
})
