/**
 * Hộp thoại cấp chứng nhận — đợt 4A A+B+E. Chốt ba điều: phải tự chọn trình độ (không có mặc định),
 * không gửi điểm, và 409 của máy chủ (chưa đạt ngưỡng, thiếu đồng ý) hiện nguyên văn.
 */
import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { toast } from 'sonner'

vi.mock('next-intl', async () => (await import('@/test/intlCatalog')).nextIntlCatalogMock())
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/lib/api', () => ({ default: {}, apiMessage: (e: unknown) => (e as Error).message }))

const issueCertificate = vi.fn()
vi.mock('@/lib/certificateApi', async (original) => ({
  ...(await original<typeof import('@/lib/certificateApi')>()),
  issueCertificate: (input: unknown) => issueCertificate(input),
}))

import { IssueCertificateDialog } from './IssueCertificateDialog'
import type { StudentEvaluation } from '@/lib/teacherEvaluationApi'

const evaluation = { studentId: 20, name: 'Nguyễn Đức', certificateEligible: true } as StudentEvaluation

const open = () =>
  render(<IssueCertificateDialog open onOpenChange={vi.fn()} classId={10} evaluation={evaluation} />)

const submitButton = () => screen.getByRole('button', { name: 'Cấp chứng nhận' })

describe('Hộp thoại cấp chứng nhận', () => {
  beforeEach(() => vi.clearAllMocks())

  it('chưa chọn trình độ thì chưa cấp được', () => {
    open()
    expect(submitButton()).toBeDisabled()
  })

  it('không có C1, C2 và không gửi điểm; xong thì hiện link xác thực', async () => {
    issueCertificate.mockResolvedValue({ certificateCode: 'DF-B1-2026-AB12CD34', verifyToken: 'tok123' })
    open()

    expect(screen.queryByRole('tab', { name: 'C1' })).toBeNull()
    fireEvent.click(screen.getByRole('tab', { name: 'B1' }))
    fireEvent.click(submitButton())

    await waitFor(() => expect(issueCertificate).toHaveBeenCalledWith({
      classId: 10,
      studentId: 20,
      cefrLevel: 'B1',
      note: null,
    }))
    expect(await screen.findByText(/\/certificate\/tok123\//)).toBeInTheDocument()
  })

  it('409 của máy chủ hiện nguyên văn, hộp thoại giữ nguyên để sửa', async () => {
    issueCertificate.mockRejectedValue(new Error('Học viên chưa thành niên: trung tâm cần có đồng ý'))
    open()

    fireEvent.click(screen.getByRole('tab', { name: 'A2' }))
    fireEvent.click(submitButton())

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Học viên chưa thành niên: trung tâm cần có đồng ý'))
    expect(submitButton()).toBeInTheDocument()
  })
})
