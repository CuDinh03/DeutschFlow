/**
 * Tests for PatternModal ("Lịch cố định của lớp") multi-day selection.
 *
 * The recurring-schedule modal now lets a teacher pick MANY weekdays at once
 * (toggle chips) instead of a single `<select>`. Each selected weekday is an
 * independent upsert keyed by (classId, dayOfWeek) on the backend, so the modal
 * fans the existing single-day PUT out once per day and aggregates the result.
 *
 * We mock the schedule API + toast so tests run entirely in jsdom.
 */
import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PatternModal } from '@/app/v2/teacher/schedule/scheduleClassParts'

// ─── Mocks ──────────────────────────────────────────────────────────────────

const upsertMock = vi.fn()
const getPatternsMock = vi.fn()
const toastSuccess = vi.fn()
const toastError = vi.fn()

vi.mock('@/lib/classScheduleApi', () => ({
  upsertClassPattern: (...args: unknown[]) => upsertMock(...args),
  getClassPatterns: (...args: unknown[]) => getPatternsMock(...args),
  createClassSession: vi.fn(),
  updateClassSession: vi.fn(),
  deleteClassPattern: vi.fn(),
}))

vi.mock('@/lib/api', () => ({
  apiMessage: (e: unknown) => (e instanceof Error ? e.message : 'Lỗi không xác định'),
}))

vi.mock('sonner', () => ({
  toast: {
    success: (...a: unknown[]) => toastSuccess(...a),
    error: (...a: unknown[]) => toastError(...a),
  },
}))

const CLASSES = [{ id: 1, name: 'A1 Lớp tối', studentCount: 0 }]

/** Render the open modal and wait for the initial pattern load to settle. */
async function renderOpen() {
  const onSaved = vi.fn()
  const onClose = vi.fn()
  render(<PatternModal open classes={CLASSES} onClose={onClose} onSaved={onSaved} />)
  await waitFor(() => expect(getPatternsMock).toHaveBeenCalledWith(1))
  return { onSaved, onClose }
}

beforeEach(() => {
  vi.clearAllMocks()
  getPatternsMock.mockResolvedValue([])
  upsertMock.mockResolvedValue({ patternId: 10, generated: 4, keptOverridden: 0, skipped: 0 })
})

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('PatternModal — multi-day recurring schedule', () => {
  it('fans out one upsert per selected weekday and reports the aggregate', async () => {
    const user = userEvent.setup()
    const { onSaved } = await renderOpen()

    // Thứ 2 (dow 1) is on by default; add Thứ 4 (dow 3) and Thứ 6 (dow 5).
    await user.click(screen.getByRole('button', { name: 'Thứ 4' }))
    await user.click(screen.getByRole('button', { name: 'Thứ 6' }))
    fireEvent.change(screen.getByLabelText('Áp dụng từ'), { target: { value: '2026-07-10' } })

    await user.click(screen.getByRole('button', { name: 'Lưu lịch cố định' }))

    await waitFor(() => expect(upsertMock).toHaveBeenCalledTimes(3))
    // Called once per weekday, sorted ISO 1→7 → dayOfWeek 1, 3, 5.
    const daysSent = upsertMock.mock.calls.map((c) => (c[1] as { dayOfWeek: number }).dayOfWeek)
    expect(daysSent).toEqual([1, 3, 5])
    // Shared fields carried on every call.
    expect(upsertMock.mock.calls[0][1]).toMatchObject({ startTime: '18:00', effectiveFrom: '2026-07-10' })

    const msg = toastSuccess.mock.calls[0][0] as string
    expect(msg).toContain('Thứ 2, Thứ 4, Thứ 6')
    expect(msg).toContain('sinh 12 buổi') // 3 days × 4 generated
    expect(toastError).not.toHaveBeenCalled()
    expect(onSaved).toHaveBeenCalled()
  })

  it('reports which weekdays failed without aborting the rest (partial failure)', async () => {
    const user = userEvent.setup()
    upsertMock.mockImplementation((_cid: number, body: { dayOfWeek: number }) =>
      body.dayOfWeek === 3
        ? Promise.reject(new Error('Trùng lịch giáo viên'))
        : Promise.resolve({ patternId: 1, generated: 2, keptOverridden: 0, skipped: 0 }),
    )
    await renderOpen()

    await user.click(screen.getByRole('button', { name: 'Thứ 4' })) // dow 3 → will fail
    await user.click(screen.getByRole('button', { name: 'Thứ 6' })) // dow 5 → ok
    fireEvent.change(screen.getByLabelText('Áp dụng từ'), { target: { value: '2026-07-10' } })

    await user.click(screen.getByRole('button', { name: 'Lưu lịch cố định' }))

    await waitFor(() => expect(toastError).toHaveBeenCalled())
    // Thứ 2 + Thứ 6 saved; Thứ 4 flagged with the backend reason.
    expect(toastSuccess.mock.calls[0][0]).toContain('Thứ 2, Thứ 6')
    const err = toastError.mock.calls[0][0] as string
    expect(err).toContain('Thứ 4')
    expect(err).toContain('Trùng lịch giáo viên')
  })

  it('surfaces skipped (conflicting) sessions in the success toast, not as an error', async () => {
    const user = userEvent.setup()
    // Backend skips one conflicting occurrence and generates the rest → success + warning.
    upsertMock.mockResolvedValue({ patternId: 7, generated: 3, keptOverridden: 0, skipped: 1 })
    await renderOpen()

    fireEvent.change(screen.getByLabelText('Áp dụng từ'), { target: { value: '2026-07-10' } })
    await user.click(screen.getByRole('button', { name: 'Lưu lịch cố định' }))

    await waitFor(() => expect(toastSuccess).toHaveBeenCalled())
    expect(toastSuccess.mock.calls[0][0]).toContain('bỏ qua 1 buổi trùng lịch')
    expect(toastError).not.toHaveBeenCalled()
  })

  it('blocks saving when no weekday is selected', async () => {
    const user = userEvent.setup()
    await renderOpen()

    // Turn off the only default day (Thứ 2) → empty selection.
    await user.click(screen.getByRole('button', { name: 'Thứ 2' }))
    await user.click(screen.getByRole('button', { name: 'Lưu lịch cố định' }))

    expect(upsertMock).not.toHaveBeenCalled()
    expect(toastError).toHaveBeenCalledWith('Chọn ít nhất một thứ')
  })

  it('toggles a chip on and off via aria-pressed', async () => {
    const user = userEvent.setup()
    await renderOpen()

    const thu4 = screen.getByRole('button', { name: 'Thứ 4' })
    expect(thu4).toHaveAttribute('aria-pressed', 'false')
    await user.click(thu4)
    expect(thu4).toHaveAttribute('aria-pressed', 'true')
    await user.click(thu4)
    expect(thu4).toHaveAttribute('aria-pressed', 'false')
  })
})
