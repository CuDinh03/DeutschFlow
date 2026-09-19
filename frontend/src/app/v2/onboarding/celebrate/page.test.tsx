import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * W9 — trang ăn mừng `/v2/onboarding/celebrate` (Đợt 4 PR-3, 19/09/2026).
 * Một trang cho mọi nguồn activation; CTA đưa về dashboard (HOME_WEEK1).
 */

const pushMock = vi.fn()
const trackEvent = vi.fn()
const getMyLearningProfile = vi.fn()
let query = ''

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(query),
}))
vi.mock('@/hooks/useTracking', () => ({ useTracking: () => ({ trackEvent }) }))
vi.mock('@/lib/profileApi', () => ({ getMyLearningProfile: () => getMyLearningProfile() }))
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}))
vi.mock('framer-motion', () => ({
  motion: { div: ({ children, ...rest }: { children: React.ReactNode } & Record<string, unknown>) => {
    const { initial: _i, animate: _a, transition: _t, ...dom } = rest
    void _i; void _a; void _t
    return <div {...(dom as Record<string, unknown>)}>{children}</div>
  } },
  useReducedMotion: () => false,
}))
// Trả về KEY (kèm values nếu có); `t.has` chỉ đúng cho mentor có trong catalog giả lập.
vi.mock('next-intl', () => {
  const translate = (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key
  const t = Object.assign(translate, { rich: translate, has: (k: string) => k === 'mentorTaglines.ANNA' })
  return { useTranslations: () => t, useLocale: () => 'vi' }
})

import V2OnboardingCelebratePage from '@/app/v2/onboarding/celebrate/page'

beforeEach(() => {
  for (const m of [pushMock, trackEvent, getMyLearningProfile]) m.mockReset()
  getMyLearningProfile.mockResolvedValue({ assignedPersonaCode: 'ANNA' })
  query = ''
})

describe('/v2/onboarding/celebrate — W9', () => {
  it('kind=beginner: câu Ngày 1, pill, bốn mục tuần đầu, mentor từ hồ sơ; CTA → dashboard + event', async () => {
    query = 'kind=beginner'
    render(<V2OnboardingCelebratePage />)

    expect(screen.getByText('celebrate.body.beginner')).toBeTruthy()
    expect(screen.getByText('celebrate.pill.beginner')).toBeTruthy()
    expect(screen.getByText('celebrate.pillStreak')).toBeTruthy()
    expect(screen.getByText('celebrate.week.roadmap.title')).toBeTruthy()
    expect(screen.getByText('celebrate.week.review.title')).toBeTruthy()
    expect(screen.getByText('celebrate.week.checklist.title')).toBeTruthy()
    expect(trackEvent).toHaveBeenCalledWith('onboarding_celebrate_viewed', { kind: 'beginner', passed: null })

    await waitFor(() => expect(screen.getByTestId('celebrate-mentor')).toBeTruthy())
    expect(screen.getByText('Anna')).toBeTruthy()
    expect(screen.getByText('mentorTaglines.ANNA')).toBeTruthy()
    expect(screen.getByText('celebrate.week.speaking.title:{"name":"Anna"}')).toBeTruthy()

    screen.getByTestId('celebrate-cta').click()
    expect(trackEvent).toHaveBeenCalledWith('onboarding_celebrate_done', { kind: 'beginner' })
    expect(pushMock).toHaveBeenCalledWith('/v2/student/dashboard')
  })

  it('kind=placement&passed=0: rớt vẫn ăn mừng (fixture L3), câu riêng cho rớt', () => {
    query = 'kind=placement&passed=0'
    render(<V2OnboardingCelebratePage />)
    expect(screen.getByText('celebrate.body.placementFailed')).toBeTruthy()
    expect(screen.getByText('celebrate.pill.placement')).toBeTruthy()
  })

  it('kind=mock_exam: câu nói thử', () => {
    query = 'kind=mock_exam'
    render(<V2OnboardingCelebratePage />)
    expect(screen.getByText('celebrate.body.mockExam')).toBeTruthy()
    expect(screen.getByText('celebrate.pill.mockExam')).toBeTruthy()
  })

  it('kind lạ rơi về beginner — không 404 khoảnh khắc tốt', () => {
    query = 'kind=xyz'
    render(<V2OnboardingCelebratePage />)
    expect(screen.getByText('celebrate.body.beginner')).toBeTruthy()
  })

  it('hồ sơ hỏng ⇒ không thẻ mentor, mục luyện nói dùng câu không tên; trang vẫn ăn mừng', async () => {
    getMyLearningProfile.mockRejectedValue(new Error('500'))
    query = 'kind=beginner'
    render(<V2OnboardingCelebratePage />)
    await waitFor(() => expect(getMyLearningProfile).toHaveBeenCalled())
    expect(screen.queryByTestId('celebrate-mentor')).toBeNull()
    expect(screen.getByText('celebrate.week.speakingNoMentor.title')).toBeTruthy()
    expect(screen.getByTestId('celebrate-cta')).toBeTruthy()
  })

  it('mentor không có trong catalog ⇒ tagline rơi về MENTOR_META', async () => {
    getMyLearningProfile.mockResolvedValue({ assignedPersonaCode: 'LUKAS' })
    query = 'kind=beginner'
    render(<V2OnboardingCelebratePage />)
    await waitFor(() => expect(screen.getByText('Lukas')).toBeTruthy())
    expect(screen.getByText('Tech Lead — CNTT')).toBeTruthy()
  })
})
