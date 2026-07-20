/**
 * Smoke tests for the teacher per-class report suite (tc-reports/page.tsx +
 * its four tabs). Real ui-v2/reportShared components are used (not mocked) so
 * the Radix TkTabs + TkBadge composition is genuinely exercised in jsdom;
 * only network calls (the three new API lib modules), next-intl and toast
 * are mocked, matching the sibling TcChecklistPage test's approach.
 */
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import Page from '@/app/v2/teacher/tc-reports/page'

const getGradebook = vi.fn()
const getSkillReport = vi.fn()
const listLessonLogs = vi.fn()
const createLessonLog = vi.fn()
const updateLessonLog = vi.fn()
const deleteLessonLog = vi.fn()
const listLessons = vi.fn()
const getClassCompetency = vi.fn()
const listEvaluations = vi.fn()
const saveEvaluation = vi.fn()

vi.mock('next-intl', () => ({
  useTranslations: () => (k: string) => k,
}))

vi.mock('@/lib/api', () => ({
  apiMessage: (e: unknown) => (e instanceof Error ? e.message : 'error'),
}))

vi.mock('@/lib/teacherGradebookApi', () => ({
  getGradebook: (...a: unknown[]) => getGradebook(...a),
  getSkillReport: (...a: unknown[]) => getSkillReport(...a),
}))

vi.mock('@/lib/teacherLessonLogApi', () => ({
  listLessonLogs: (...a: unknown[]) => listLessonLogs(...a),
  createLessonLog: (...a: unknown[]) => createLessonLog(...a),
  updateLessonLog: (...a: unknown[]) => updateLessonLog(...a),
  deleteLessonLog: (...a: unknown[]) => deleteLessonLog(...a),
}))

vi.mock('@/lib/teacherLessonsApi', () => ({
  listLessons: (...a: unknown[]) => listLessons(...a),
}))

vi.mock('@/lib/teacherCompetencyApi', () => ({
  getClassCompetency: (...a: unknown[]) => getClassCompetency(...a),
}))

vi.mock('@/lib/teacherEvaluationApi', () => ({
  listEvaluations: (...a: unknown[]) => listEvaluations(...a),
  saveEvaluation: (...a: unknown[]) => saveEvaluation(...a),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/app/v2/teacher/tcShared', () => ({
  useTeacherClasses: () => ({ classes: [{ id: 1, name: 'A1' }], classId: 1, setClassId: vi.fn(), loadingClasses: false }),
  ClassPicker: () => null,
}))

const gradebookFixture = {
  classId: 1,
  className: 'A1',
  assignments: [{ id: 100, topic: 'Bài kiểm tra 1', assignmentType: 'QUIZ', skill: 'HOREN', dueDate: null }],
  students: [
    { studentId: 1, name: 'Nguyễn Văn A', email: 'a@example.com', avgScore: 85, cells: { '100': { status: 'GRADED', score: 90, submittedAt: '2026-07-01T00:00:00' } } },
  ],
}

const skillReportFixture = {
  classId: 1,
  className: 'A1',
  students: [{ studentId: 1, name: 'Nguyễn Văn A', email: 'a@example.com', horen: 8, lesen: 7.5, schreiben: null, sprechen: 6, total: 7.2, grade: 'Khá' }],
}

const lessonLogFixture = {
  id: 5,
  classId: 1,
  sessionDate: '2026-07-01',
  sessionNumber: 3,
  topic: 'Modalverben',
  homework: 'Bài tập trang 12',
  note: null,
  createdAt: '2026-07-01T00:00:00',
  attendance: [{ studentId: 1, name: 'Nguyễn Văn A', email: 'a@example.com', status: 'PRESENT', note: null }],
}

const evaluationFixture = {
  studentId: 1,
  name: 'Nguyễn Văn A',
  email: 'a@example.com',
  classId: 1,
  className: 'A1',
  teacherComment: null,
  skillHoren: 8,
  skillLesen: null,
  skillSchreiben: null,
  skillSprechen: null,
  avgScore: 85,
  recordedSessions: 10,
  presentCount: 9,
  absentCount: 1,
  lateCount: 0,
  certificateEligible: true,
  evaluatedAt: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  getGradebook.mockResolvedValue(gradebookFixture)
  getSkillReport.mockResolvedValue(skillReportFixture)
  listLessonLogs.mockResolvedValue([lessonLogFixture])
  listLessons.mockResolvedValue([])
  getClassCompetency.mockResolvedValue({ enrolledCount: 0, items: [] })
  listEvaluations.mockResolvedValue([evaluationFixture])
})

async function renderPage() {
  render(<Page />)
  await waitFor(() => expect(getGradebook).toHaveBeenCalledWith(1))
}

describe('tc-reports — per-class report suite', () => {
  it('renders the gradebook tab (default) with fetched data, no crash', async () => {
    await renderPage()
    await waitFor(() => expect(screen.getByText('Nguyễn Văn A')).toBeInTheDocument())
    expect(screen.getByText('90.0')).toBeInTheDocument()
  })

  it('switches to the skill-report tab without crashing', async () => {
    const user = userEvent.setup()
    await renderPage()
    await waitFor(() => expect(screen.getByText('Nguyễn Văn A')).toBeInTheDocument())

    await user.click(screen.getByRole('tab', { name: 'tabs.skills' }))
    expect(await screen.findByText('Khá')).toBeInTheDocument()
  })

  it('switches to the attendance tab and opens the add-session form without crashing', async () => {
    const user = userEvent.setup()
    await renderPage()
    await waitFor(() => expect(screen.getByText('Nguyễn Văn A')).toBeInTheDocument())

    await user.click(screen.getByRole('tab', { name: 'tabs.attendance' }))
    expect(await screen.findByText('attendance.countLabel')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'attendance.addLog' }))
    expect(screen.getByText('attendance.formTitleNew')).toBeInTheDocument()
  })

  it('switches to the evaluation tab and opens the edit form without crashing', async () => {
    const user = userEvent.setup()
    await renderPage()
    await waitFor(() => expect(screen.getByText('Nguyễn Văn A')).toBeInTheDocument())

    await user.click(screen.getByRole('tab', { name: 'tabs.evaluation' }))
    expect(await screen.findByText('evaluation.certificateEligible')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'evaluation.edit' }))
    expect(screen.getByText('evaluation.formTitle')).toBeInTheDocument()
  })

  /**
   * N-3 regression (root cause lives in this page). The roster memo used to fall back to
   * "students seen across existing lesson logs" when both enrolment endpoints failed. Those
   * students may have LEFT the class, and the backend rejects attendance rows for non-members —
   * so the fallback made every save 400 and the teacher could record nothing.
   *
   * The log-derived list is now confined to `printRoster`: the printed matrix still lists the
   * student (history stays visible), but the marking form refuses to offer them.
   */
  it('never feeds log-derived students into the marking form when enrolment endpoints fail', async () => {
    const user = userEvent.setup()
    getGradebook.mockRejectedValue(new Error('gradebook down'))
    listEvaluations.mockRejectedValue(new Error('evaluations down'))
    // The only surviving source names a student who is no longer enrolled.
    listLessonLogs.mockResolvedValue([{
      ...lessonLogFixture,
      attendance: [{ studentId: 99, name: 'Đã rời lớp', email: 'gone@example.com', status: 'ABSENT', note: null }],
    }])

    render(<Page />)
    await waitFor(() => expect(listLessonLogs).toHaveBeenCalledWith(1))
    await user.click(screen.getByRole('tab', { name: 'tabs.attendance' }))
    await user.click(await screen.findByRole('button', { name: 'attendance.addLog' }))

    // The teacher is told why, instead of hitting a generic save failure.
    expect(screen.getByText('attendance.rosterUnavailable')).toBeInTheDocument()
    // No marking control exists for the ex-student, so their id cannot reach the payload.
    expect(screen.queryByLabelText('Đã rời lớp')).not.toBeInTheDocument()
    // …but the printed history still lists them.
    expect(screen.getAllByText('Đã rời lớp').length).toBeGreaterThan(0)
  })

  it('shows the select-class prompt when no class is available', async () => {
    vi.doMock('@/app/v2/teacher/tcShared', () => ({
      useTeacherClasses: () => ({ classes: [], classId: null, setClassId: vi.fn(), loadingClasses: false }),
      ClassPicker: () => null,
    }))
    vi.resetModules()
    const { default: FreshPage } = await import('@/app/v2/teacher/tc-reports/page')
    render(<FreshPage />)
    expect(await screen.findByText('selectClassPrompt')).toBeInTheDocument()
  })
})
