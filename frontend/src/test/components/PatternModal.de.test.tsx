/**
 * i18n đợt 3 (06/09/2026, F-I18N-02b): PatternModal đọc nhãn từ catalog v2.teacher.schedule — với
 * locale `de` người dùng phải thấy tiếng Đức ở chip thứ, danh sách lịch hiện có, option lớp, nút lưu
 * và toast tổng hợp (ghép ` · ` từ các khoá nội suy {n}), không còn tiếng Việt cứng.
 */
import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PatternModal } from '@/app/v2/teacher/schedule/scheduleClassParts'

vi.mock('next-intl', async () => (await import('@/test/intlCatalog')).nextIntlCatalogMock('de'))

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
  apiMessage: (e: unknown) => (e instanceof Error ? e.message : 'Unbekannter Fehler'),
}))

vi.mock('sonner', () => ({
  toast: {
    success: (...a: unknown[]) => toastSuccess(...a),
    error: (...a: unknown[]) => toastError(...a),
  },
}))

const CLASSES = [{ id: 1, name: 'A1 Abendkurs', studentCount: 12 }]
const VIETNAMESE = /[ăđơưạảấầẩẫậắằẳẵặẹẻẽếềểễệịỉĩọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i

beforeEach(() => {
  vi.clearAllMocks()
  getPatternsMock.mockResolvedValue([
    { id: 9, classId: 1, dayOfWeek: 3, startTime: '18:00:00', durationMinutes: 90, defaultMode: 'OFFLINE', defaultRoom: null, effectiveFrom: '2026-07-01', effectiveTo: null, teachingMinutes: 90, breakMinutes: 0 },
  ])
  upsertMock.mockResolvedValue({ patternId: 10, generated: 4, keptOverridden: 2, skipped: 0 })
})

describe('PatternModal — locale de', () => {
  it('hiện tiếng Đức ở tiêu đề, chip thứ, lịch hiện có, option lớp, nút lưu và toast tổng hợp', async () => {
    const user = userEvent.setup()
    render(<PatternModal open classes={CLASSES} onClose={vi.fn()} onSaved={vi.fn()} />)
    await waitFor(() => expect(getPatternsMock).toHaveBeenCalledWith(1))

    expect(screen.getByText('Fester Termin der Klasse')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mittwoch' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Montag' })).toHaveAttribute('aria-pressed', 'true')
    // Lịch hiện có: <b>Mittwoch</b> · 18:00 · 90′ · Im Kurs — nhãn thứ + hình thức qua DOW_LABEL_KEY/MODE_LABEL_KEY.
    expect(await screen.findByText('Mittwoch', { selector: 'b' })).toBeInTheDocument()
    expect(screen.getByText(/18:00 · 90′ · Im Kurs/)).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Im Kurs' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Festen Termin löschen' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'A1 Abendkurs · 12 Lernende' })).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Gültig ab'), { target: { value: '2026-07-10' } })
    await user.click(screen.getByRole('button', { name: 'Festen Termin speichern' }))

    await waitFor(() => expect(toastSuccess).toHaveBeenCalled())
    const msg = toastSuccess.mock.calls[0][0] as string
    expect(msg).toBe('Plan für Montag gespeichert · 4 Stunden erzeugt · 2 manuell angepasste Stunden beibehalten')
    expect(msg).not.toMatch(VIETNAMESE)
    expect(toastError).not.toHaveBeenCalled()
  })

  it('thiếu thứ → toast lỗi tiếng Đức', async () => {
    const user = userEvent.setup()
    render(<PatternModal open classes={CLASSES} onClose={vi.fn()} onSaved={vi.fn()} />)
    await waitFor(() => expect(getPatternsMock).toHaveBeenCalledWith(1))

    await user.click(screen.getByRole('button', { name: 'Montag' }))
    await user.click(screen.getByRole('button', { name: 'Festen Termin speichern' }))

    expect(upsertMock).not.toHaveBeenCalled()
    expect(toastError).toHaveBeenCalledWith('Wähle mindestens einen Wochentag')
  })
})
