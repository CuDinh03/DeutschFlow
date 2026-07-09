/**
 * Tests for the teacher CompetencyTab (Phase 2c): lesson-grouped mastery view.
 * Guards the empty/null states and — the review-flagged case — that lesson groups render in the
 * order the backend hands them (syllabus / orderIndex order), not re-sorted.
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { CompetencyTab } from '@/app/v2/teacher/tc-reports/CompetencyTab'
import type { ClassCompetency } from '@/lib/teacherCompetencyApi'

vi.mock('next-intl', () => ({ useTranslations: () => (k: string) => k }))

describe('CompetencyTab', () => {
  it('shows the empty state when there are no can-dos', () => {
    render(<CompetencyTab competency={{ enrolledCount: 5, items: [] }} />)
    expect(screen.getByText('competency.empty')).toBeInTheDocument()
  })

  it('does not crash on a null competency', () => {
    render(<CompetencyTab competency={null} />)
    expect(screen.getByText('competency.empty')).toBeInTheDocument()
  })

  it('renders lesson groups in the given (syllabus) order and each can-do text', () => {
    const competency: ClassCompetency = {
      enrolledCount: 3,
      items: [
        { canDoStatementId: 22, lessonId: 2, lessonTitle: 'Lektion B', text: 'Ich kann B', skillTag: null, cefrLevel: 'A1', mastered: 2, inProgress: 1 },
        { canDoStatementId: 11, lessonId: 1, lessonTitle: 'Lektion A', text: 'Ich kann A', skillTag: 'HOEREN', cefrLevel: null, mastered: 0, inProgress: 0 },
      ],
    }
    render(<CompetencyTab competency={competency} />)

    // Group headers appear in the exact order the items arrived (B before A) — not re-sorted.
    const titles = screen.getAllByText(/^Lektion [AB]$/).map((el) => el.textContent)
    expect(titles).toEqual(['Lektion B', 'Lektion A'])
    expect(screen.getByText('Ich kann B')).toBeInTheDocument()
    expect(screen.getByText('Ich kann A')).toBeInTheDocument()
  })
})
