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

  // ── F05: 0 thật ≠ chưa có dữ liệu; nguồn lỗi hiện lỗi đúng vùng, không rơi im lặng ──

  it('plots a confirmed 0.0 average and shows — only for null (no confirmed grade)', async () => {
    getClassesSummary.mockResolvedValue([
      { id: 11, name: 'A1 Sáng', studentCount: 3, assignmentCount: 4, avgScore: 82 },
      { id: 12, name: 'A2 Chiều', studentCount: 2, assignmentCount: 4, avgScore: 0 },
      { id: 13, name: 'B1 Tối', studentCount: 2, assignmentCount: 1, avgScore: null },
    ])
    render(<Page />)
    await waitFor(() => expect(screen.getByRole('link', { name: 'B1 Tối' })).toBeInTheDocument())
    // Điểm 0 THẬT có mặt ở cả bảng lẫn biểu đồ trung bình theo lớp — trước đây `> 0` lọc mất nó.
    expect(screen.getAllByText('A2 Chiều').length).toBeGreaterThanOrEqual(2)
    // Lớp chưa có điểm chốt (null): chỉ ở bảng, ô điểm là "—".
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(1)
  })

  it('a single failed source shows an error in ITS OWN section while the rest renders', async () => {
    getSkillDistribution.mockRejectedValue(new Error('boom'))
    render(<Page />)
    await waitFor(() => expect(screen.getByText('sectionError')).toBeInTheDocument())
    expect(screen.queryByText('loadError')).not.toBeInTheDocument()  // không phải lỗi toàn trang
    expect(screen.queryByText('skillEmpty')).not.toBeInTheDocument() // KHÔNG rơi im lặng về "trống"
    expect(screen.getByRole('link', { name: 'A1 Sáng' })).toBeInTheDocument() // bảng lớp vẫn sống
  })

  it('overview failing alone degrades to a section error, not the full-page error', async () => {
    getReportsOverview.mockRejectedValue(new Error('boom'))
    render(<Page />)
    await waitFor(() => expect(screen.getByText('sectionError')).toBeInTheDocument())
    expect(screen.queryByText('loadError')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'A1 Sáng' })).toBeInTheDocument()
  })
})
