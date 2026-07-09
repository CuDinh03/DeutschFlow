/**
 * Tests for the teacher "Nội dung giảng dạy" page (tc-checklist/page.tsx).
 *
 * A lesson now carries a title + a list of knowledge points ("kiến thức cần
 * học"), stored newline-separated in ClassLesson.description. We mock next-intl
 * (labels resolve to their key so buttons are queryable), the lessons API,
 * router, toast and the tcShared plumbing so the page runs in jsdom.
 */
import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import Page from '@/app/v2/teacher/tc-checklist/page'

// ─── Mocks ──────────────────────────────────────────────────────────────────

const listLessons = vi.fn()
const createLesson = vi.fn()
const updateLesson = vi.fn()
const deleteLesson = vi.fn()
const toastSuccess = vi.fn()
const toastError = vi.fn()

vi.mock('next-intl', () => ({
  // labels resolve to their key; supports t.rich used for the info note
  useTranslations: () => {
    const f = (k: string) => k
    ;(f as unknown as { rich: (k: string) => string }).rich = (k: string) => k
    return f
  },
}))

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

vi.mock('@/lib/api', () => ({
  apiMessage: (e: unknown) => (e instanceof Error ? e.message : 'error'),
}))

vi.mock('@/lib/teacherLessonsApi', () => ({
  listLessons: (...a: unknown[]) => listLessons(...a),
  createLesson: (...a: unknown[]) => createLesson(...a),
  updateLesson: (...a: unknown[]) => updateLesson(...a),
  deleteLesson: (...a: unknown[]) => deleteLesson(...a),
}))

vi.mock('sonner', () => ({
  toast: { success: (...a: unknown[]) => toastSuccess(...a), error: (...a: unknown[]) => toastError(...a) },
}))

vi.mock('@/app/v2/teacher/tcShared', () => ({
  useTeacherClasses: () => ({ classes: [{ id: 1, name: 'A1' }], classId: 1, setClassId: vi.fn(), loadingClasses: false }),
  ClassPicker: () => null,
  pct: (lessons: { completed: boolean }[]) =>
    lessons.length ? Math.round((lessons.filter((l) => l.completed).length / lessons.length) * 100) : 0,
}))

vi.mock('@/components/ui-v2', () => ({
  GaPageHdr: ({ title, right }: { title: React.ReactNode; right?: React.ReactNode }) => (
    <div>
      <h1>{title}</h1>
      {right}
    </div>
  ),
  GaBtn: ({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) => (
    <button onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}))

const lesson = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 10,
  classId: 1,
  orderIndex: 0,
  title: 'Bài 1',
  description: 'Chào hỏi\nGiới thiệu',
  completed: false,
  completedAt: null,
  completedByTeacherId: null,
  createdAt: '2026-07-01T00:00:00',
  updatedAt: '2026-07-01T00:00:00',
  ...over,
})

beforeEach(() => {
  vi.clearAllMocks()
  listLessons.mockResolvedValue([])
})

async function renderPage() {
  render(<Page />)
  await waitFor(() => expect(listLessons).toHaveBeenCalledWith(1))
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Nội dung giảng dạy — lessons with knowledge points', () => {
  it('renders the renamed page title', async () => {
    await renderPage()
    expect(screen.getByRole('heading', { name: 'title' })).toBeInTheDocument()
  })

  it('creates a lesson with a title and structured knowledge points', async () => {
    const user = userEvent.setup()
    createLesson.mockResolvedValue(lesson())
    await renderPage()

    await user.type(screen.getByPlaceholderText('newLessonPlaceholder'), 'Bài 2 — Gia đình')
    // first knowledge-point row, then add a second row
    const firstPoint = screen.getAllByPlaceholderText('knowledgePlaceholder')[0]
    await user.type(firstPoint, 'Từ vựng gia đình')
    await user.click(screen.getByRole('button', { name: 'addKnowledge' }))
    const rows = screen.getAllByPlaceholderText('knowledgePlaceholder')
    await user.type(rows[1], 'Sở hữu cách')

    await user.click(screen.getByRole('button', { name: 'addLesson' }))

    await waitFor(() => expect(createLesson).toHaveBeenCalledTimes(1))
    expect(createLesson).toHaveBeenCalledWith(1, expect.objectContaining({
      title: 'Bài 2 — Gia đình',
      knowledgePoints: [
        { text: 'Từ vựng gia đình', skillTag: null, contentTag: null },
        { text: 'Sở hữu cách', skillTag: null, contentTag: null },
      ],
    }))
    expect(toastSuccess).toHaveBeenCalled()
  })

  it('includes the skill/content tag chosen per knowledge point', async () => {
    const user = userEvent.setup()
    createLesson.mockResolvedValue(lesson())
    await renderPage()

    await user.type(screen.getByPlaceholderText('newLessonPlaceholder'), 'Bài 3')
    await user.type(screen.getAllByPlaceholderText('knowledgePlaceholder')[0], 'Perfekt')
    await user.selectOptions(screen.getByRole('combobox', { name: 'skillTagLabel' }), 'SCHREIBEN')
    await user.selectOptions(screen.getByRole('combobox', { name: 'contentTagLabel' }), 'GRAMMATIK')

    await user.click(screen.getByRole('button', { name: 'addLesson' }))

    await waitFor(() => expect(createLesson).toHaveBeenCalledTimes(1))
    expect(createLesson).toHaveBeenCalledWith(1, expect.objectContaining({
      knowledgePoints: [{ text: 'Perfekt', skillTag: 'SCHREIBEN', contentTag: 'GRAMMATIK' }],
    }))
  })

  it('creates a lesson with CEFR level, planned date and estimated units', async () => {
    const user = userEvent.setup()
    createLesson.mockResolvedValue(lesson())
    await renderPage()

    await user.type(screen.getByPlaceholderText('newLessonPlaceholder'), 'Lektion 1')
    await user.selectOptions(screen.getByRole('combobox', { name: 'cefrLabel' }), 'A1')
    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement
    fireEvent.change(dateInput, { target: { value: '2026-07-20' } })
    await user.type(screen.getByPlaceholderText('estimatedUnitsPlaceholder'), '3')

    await user.click(screen.getByRole('button', { name: 'addLesson' }))

    await waitFor(() => expect(createLesson).toHaveBeenCalledTimes(1))
    expect(createLesson).toHaveBeenCalledWith(1, expect.objectContaining({
      title: 'Lektion 1',
      cefrLevel: 'A1',
      plannedDate: '2026-07-20',
      estimatedUnits: 3,
    }))
  })

  it('sends a clear flag when a previously-set CEFR level is emptied on edit', async () => {
    const user = userEvent.setup()
    const withCefr = lesson({ cefrLevel: 'A1' })
    listLessons.mockResolvedValue([withCefr])
    updateLesson.mockResolvedValue(withCefr)
    await renderPage()

    await waitFor(() => expect(screen.getByText('Bài 1')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'edit' }))

    // the edit form's CEFR select is the one seeded to 'A1' (the add form's is empty)
    await user.selectOptions(screen.getByDisplayValue('A1'), '')
    await user.click(screen.getByRole('button', { name: 'save' }))

    await waitFor(() => expect(updateLesson).toHaveBeenCalledTimes(1))
    expect(updateLesson).toHaveBeenCalledWith(1, 10, expect.objectContaining({ clearCefrLevel: true }))
  })

  it('shows existing lessons with their knowledge points as a nested list', async () => {
    listLessons.mockResolvedValue([lesson()])
    await renderPage()

    await waitFor(() => expect(screen.getByText('Bài 1')).toBeInTheDocument())
    expect(screen.getByText('Chào hỏi')).toBeInTheDocument()
    expect(screen.getByText('Giới thiệu')).toBeInTheDocument()
  })

  it('edits only the title WITHOUT resending description (preserves stored points)', async () => {
    const user = userEvent.setup()
    listLessons.mockResolvedValue([lesson()])
    updateLesson.mockResolvedValue(lesson({ title: 'Bài 1 (mới)' }))
    await renderPage()

    await waitFor(() => expect(screen.getByText('Bài 1')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'edit' }))

    const titleInput = screen.getByDisplayValue('Bài 1')
    await user.clear(titleInput)
    await user.type(titleInput, 'Bài 1 (mới)')
    await user.click(screen.getByRole('button', { name: 'save' }))

    await waitFor(() => expect(updateLesson).toHaveBeenCalledTimes(1))
    // points unchanged → description omitted so the PATCH keeps the stored value intact
    expect(updateLesson).toHaveBeenCalledWith(1, 10, { title: 'Bài 1 (mới)' })
  })

  it('re-sends knowledgePoints only when the points change', async () => {
    const user = userEvent.setup()
    listLessons.mockResolvedValue([lesson()])
    updateLesson.mockResolvedValue(lesson())
    await renderPage()

    await waitFor(() => expect(screen.getByText('Bài 1')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'edit' }))

    const pointInput = screen.getByDisplayValue('Giới thiệu')
    await user.clear(pointInput)
    await user.type(pointInput, 'Giới thiệu (sửa)')
    await user.click(screen.getByRole('button', { name: 'save' }))

    await waitFor(() => expect(updateLesson).toHaveBeenCalledTimes(1))
    expect(updateLesson).toHaveBeenCalledWith(1, 10, {
      title: 'Bài 1',
      knowledgePoints: [
        { text: 'Chào hỏi', skillTag: null, contentTag: null },
        { text: 'Giới thiệu (sửa)', skillTag: null, contentTag: null },
      ],
    })
  })

  it('labels each knowledge-point input and moves focus to a newly added row', async () => {
    const user = userEvent.setup()
    await renderPage()

    // every row input has an accessible name (not just a placeholder)
    expect(screen.getAllByLabelText('knowledgeItemLabel').length).toBeGreaterThan(0)

    await user.click(screen.getByRole('button', { name: 'addKnowledge' }))
    const rows = screen.getAllByPlaceholderText('knowledgePlaceholder')
    expect(rows[rows.length - 1]).toHaveFocus()
  })

  it('toggles lesson completion', async () => {
    const user = userEvent.setup()
    listLessons.mockResolvedValue([lesson()])
    updateLesson.mockResolvedValue(lesson({ completed: true }))
    await renderPage()

    await waitFor(() => expect(screen.getByText('Bài 1')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'markComplete' }))

    await waitFor(() => expect(updateLesson).toHaveBeenCalledWith(1, 10, { completed: true }))
  })

  it('deletes a lesson after confirmation', async () => {
    const user = userEvent.setup()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    listLessons.mockResolvedValue([lesson()])
    deleteLesson.mockResolvedValue(undefined)
    await renderPage()

    await waitFor(() => expect(screen.getByText('Bài 1')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'deleteLesson' }))

    await waitFor(() => expect(deleteLesson).toHaveBeenCalledWith(1, 10))
    expect(toastSuccess).toHaveBeenCalled()
    confirmSpy.mockRestore()
  })
})
