/**
 * Behavioural tests for the redesigned gradebook tab (matrix window + list views + toolbar).
 * next-intl is mocked to an identity translator (assertions use raw keys), real ui-v2/reportShared
 * components are exercised. Screen-view assertions are scoped to the `gradebook-screen` region so
 * the always-full printable block (which repeats every topic) doesn't create duplicate matches.
 */
import React from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { GradebookTab } from '@/app/v2/teacher/tc-reports/GradebookTab'
import type { Gradebook, GradebookCell } from '@/lib/teacherGradebookApi'

vi.mock('next-intl', () => ({
  useTranslations: () => (k: string) => k,
}))

function cell(status: string, score: number | null = null): GradebookCell {
  return { status, score, submittedAt: null }
}

/** 10 assignments (id 1..10): 1..9 are LESEN, 10 is HOREN. 3 students, each assigned all 10. */
function makeGradebook(): Gradebook {
  const assignments = Array.from({ length: 10 }, (_, i) => ({
    id: i + 1,
    topic: `Bài ${i + 1}`,
    assignmentType: 'GENERAL',
    skill: i + 1 === 10 ? 'HOREN' : 'LESEN',
    dueDate: null,
  }))
  const students = [1, 2, 3].map((sid) => {
    const cells: Record<string, GradebookCell> = {}
    for (let a = 1; a <= 10; a += 1) cells[String(a)] = cell('EVALUATED', 80 + sid)
    return { studentId: sid, name: `HV ${sid}`, email: `hv${sid}@x.vn`, avgScore: 80 + sid, cells }
  })
  return { classId: 1, className: 'A1', assignments, students }
}

function region() {
  return within(screen.getByTestId('gradebook-screen'))
}

// The jsdom setup ships only a partial localStorage; give each test a working in-memory one so
// the view-mode persistence path is deterministic.
beforeEach(() => {
  vi.clearAllMocks()
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => (store.has(k) ? store.get(k) : null),
    setItem: (k: string, v: string) => {
      store.set(k, String(v))
    },
    removeItem: (k: string) => {
      store.delete(k)
    },
    clear: () => {
      store.clear()
    },
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('GradebookTab — matrix view', () => {
  it('opens on the newest 8-column window and hides older columns', () => {
    render(<GradebookTab gradebook={makeGradebook()} classDisplayName="A1" />)
    // 10 assignments → newest window is columns 3..10.
    expect(region().getByText('Bài 10')).toBeInTheDocument()
    expect(region().getByText('Bài 3')).toBeInTheDocument()
    expect(region().queryByText('Bài 1')).not.toBeInTheDocument()
    expect(region().queryByText('Bài 2')).not.toBeInTheDocument()
    // pager appears because there are more than 8 columns
    expect(screen.getByText('gradebook.pageLabel')).toBeInTheDocument()
  })

  it('pages back to the older columns', async () => {
    const user = userEvent.setup()
    render(<GradebookTab gradebook={makeGradebook()} classDisplayName="A1" />)
    await user.click(screen.getByRole('button', { name: 'gradebook.prevPage' }))
    expect(region().getByText('Bài 1')).toBeInTheDocument()
    expect(region().getByText('Bài 2')).toBeInTheDocument()
    expect(region().queryByText('Bài 10')).not.toBeInTheDocument()
  })

  it('filters columns by skill', async () => {
    const user = userEvent.setup()
    render(<GradebookTab gradebook={makeGradebook()} classDisplayName="A1" />)
    // Only assignment 10 is HOREN.
    await user.click(screen.getByRole('tab', { name: 'skillLabels.horen' }))
    expect(region().getByText('Bài 10')).toBeInTheDocument()
    expect(region().queryByText('Bài 9')).not.toBeInTheDocument()
    // one column left → no pager
    expect(screen.queryByText('gradebook.pageLabel')).not.toBeInTheDocument()
  })

  it('shows the empty-filter state when the search matches nothing', async () => {
    const user = userEvent.setup()
    render(<GradebookTab gradebook={makeGradebook()} classDisplayName="A1" />)
    await user.type(screen.getByRole('searchbox'), 'zzz-nothing')
    expect(region().getByText('gradebook.noMatchingAssignments')).toBeInTheDocument()
  })
})

describe('GradebookTab — list view', () => {
  it('switches to the list and expands an assignment row to reveal student cells', async () => {
    const user = userEvent.setup()
    render(<GradebookTab gradebook={makeGradebook()} classDisplayName="A1" />)
    await user.click(screen.getByRole('tab', { name: 'gradebook.viewList' }))
    // by-assignment is the default list grouping — submission counts render on each row
    expect(region().getAllByText('gradebook.submittedCount').length).toBeGreaterThan(0)
    // expand the first assignment row → its students appear
    const rows = region().getAllByRole('button')
    await user.click(rows[0])
    expect(region().getByText('HV 1')).toBeInTheDocument()
  })

  it('switches the list grouping to by-student', async () => {
    const user = userEvent.setup()
    render(<GradebookTab gradebook={makeGradebook()} classDisplayName="A1" />)
    await user.click(screen.getByRole('tab', { name: 'gradebook.viewList' }))
    await user.click(screen.getByRole('tab', { name: 'gradebook.groupByStudent' }))
    expect(region().getByText('HV 1')).toBeInTheDocument()
    expect(region().getByText('HV 3')).toBeInTheDocument()
  })

  it('restores the persisted view mode from localStorage', () => {
    localStorage.setItem('df.gradebook.viewMode', 'list')
    render(<GradebookTab gradebook={makeGradebook()} classDisplayName="A1" />)
    // list mode exposes the grouping toggle; matrix does not
    expect(screen.getByRole('tab', { name: 'gradebook.groupByAssignment' })).toBeInTheDocument()
  })
})

describe('GradebookTab — empty states', () => {
  it('shows the no-students state', () => {
    render(<GradebookTab gradebook={{ classId: 1, className: 'A1', assignments: [], students: [] }} classDisplayName="A1" />)
    expect(screen.getByText('gradebook.emptyStudents')).toBeInTheDocument()
  })

  it('shows the no-assignments state when students exist but no assignments', () => {
    const gb: Gradebook = {
      classId: 1,
      className: 'A1',
      assignments: [],
      students: [{ studentId: 1, name: 'HV 1', email: 'hv1@x.vn', avgScore: null, cells: {} }],
    }
    render(<GradebookTab gradebook={gb} classDisplayName="A1" />)
    expect(screen.getByText('gradebook.emptyAssignments')).toBeInTheDocument()
  })
})
