/**
 * Behavioural tests for the rebuilt teacher analytics page (X3 trend view). next-intl is mocked to
 * an identity translator; the network layer (teacherAnalyticsApi) is stubbed. Only the recharts
 * line chart (GaLines) is stubbed out — jsdom has no layout size, so ResponsiveContainer can't
 * measure — while the rest of analyticsShared (section/legend/bar-row) stays real.
 */
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Stable translator identity — the page's load() depends on `t`, and real next-intl returns a
// stable reference; a fresh function each render would loop the effect.
vi.mock('next-intl', () => {
  const t = (k: string) => k
  return { useTranslations: () => t }
})

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))

vi.mock('@/app/v2/analyticsShared', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, GaLines: () => null }
})

const getReportsOverview = vi.fn()
const getClassesSummary = vi.fn()
const getWeeklyTrends = vi.fn()
const getSkillDistribution = vi.fn()

vi.mock('@/lib/teacherAnalyticsApi', () => ({
  getReportsOverview: () => getReportsOverview(),
  getClassesSummary: () => getClassesSummary(),
  getWeeklyTrends: () => getWeeklyTrends(),
  getSkillDistribution: () => getSkillDistribution(),
}))

import Page from '@/app/v2/teacher/analytics/page'

beforeEach(() => {
  vi.clearAllMocks()
  getReportsOverview.mockResolvedValue({ classCount: 2, studentCount: 5, assignmentCount: 8, avgScore: 78.5 })
  getClassesSummary.mockResolvedValue([
    { id: 11, name: 'A1 Sáng', studentCount: 3, assignmentCount: 4, avgScore: 82 },
    { id: 12, name: 'A2 Chiều', studentCount: 2, assignmentCount: 4, avgScore: 0 },
  ])
  getWeeklyTrends.mockResolvedValue({
    buckets: ['2026-W23', '2026-W24'],
    series: [{ classId: 11, className: 'A1 Sáng', values: [70, 82] }],
  })
  getSkillDistribution.mockResolvedValue({ horen: 8, lesen: 6.5, schreiben: null, sprechen: 7, ratedCount: 3 })
})

describe('V2 teacher analytics — X3 trend view', () => {
  it('deep-links each class row into its gradebook', async () => {
    render(<Page />)
    await waitFor(() => expect(screen.getByRole('link', { name: 'A1 Sáng' })).toBeInTheDocument())
    expect(screen.getByRole('link', { name: 'A1 Sáng' })).toHaveAttribute(
      'href',
      '/v2/teacher/tc-reports?classId=11',
    )
    expect(screen.getByRole('link', { name: 'A2 Chiều' })).toHaveAttribute(
      'href',
      '/v2/teacher/tc-reports?classId=12',
    )
  })

  it('renders rated skill rows and omits unrated skills', async () => {
    render(<Page />)
    await waitFor(() => expect(screen.getByText('skill.horen')).toBeInTheDocument())
    expect(screen.getByText('skill.lesen')).toBeInTheDocument()
    expect(screen.getByText('skill.sprechen')).toBeInTheDocument()
    expect(screen.queryByText('skill.schreiben')).not.toBeInTheDocument() // null → omitted
  })

  it('shows the trend legend when a class series exists', async () => {
    render(<Page />)
    // "A1 Sáng" shows in the table link, the avg-by-class bar, and the trend legend.
    await waitFor(() => expect(screen.getAllByText('A1 Sáng').length).toBeGreaterThanOrEqual(2))
    expect(screen.queryByText('trendEmpty')).not.toBeInTheDocument()
  })

  it('falls back to the trend empty state when no series is returned', async () => {
    getWeeklyTrends.mockResolvedValue({ buckets: [], series: [] })
    render(<Page />)
    await waitFor(() => expect(screen.getByText('trendEmpty')).toBeInTheDocument())
  })

  it('shows the retry banner only when both core datasets fail', async () => {
    getReportsOverview.mockRejectedValue(new Error('boom'))
    getClassesSummary.mockRejectedValue(new Error('boom'))
    render(<Page />)
    await waitFor(() => expect(screen.getByText('loadError')).toBeInTheDocument())
  })
})
