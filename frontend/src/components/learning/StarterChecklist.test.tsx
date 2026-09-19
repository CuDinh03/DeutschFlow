import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * W10 — checklist tuần đầu trên dashboard (Đợt 4 PR-3, 19/09/2026).
 * Trạng thái đọc từ server; component tự ẩn khi không có gì để nói.
 */

const apiGet = vi.fn()
const getMyLearningProfile = vi.fn()
const trackEvent = vi.fn()

vi.mock('@/lib/api', () => ({ default: { get: (...a: unknown[]) => apiGet(...a) } }))
vi.mock('@/lib/profileApi', () => ({ getMyLearningProfile: () => getMyLearningProfile() }))
vi.mock('@/hooks/useTracking', () => ({ useTracking: () => ({ trackEvent }) }))
vi.mock('next/link', () => ({
  default: ({ children, href, onClick }: { children: React.ReactNode; href: string; onClick?: () => void }) => (
    <a href={href} onClick={onClick}>{children}</a>
  ),
}))
vi.mock('next-intl', () => {
  const cache = new Map<string, unknown>()
  return {
    useLocale: () => 'vi',
    useTranslations: (ns: string) => {
      if (!cache.has(ns)) {
        cache.set(ns, (key: string, values?: Record<string, unknown>) =>
          values ? `${ns}.${key}:${JSON.stringify(values)}` : `${ns}.${key}`)
      }
      return cache.get(ns) as ReturnType<typeof import('next-intl').useTranslations>
    },
  }
})

import { StarterChecklist } from '@/components/learning/StarterChecklist'

const NS = 'v2.student.dashboard.starter'

function progress(p: Record<string, unknown>) {
  return { data: { flowVersion: 'onb_v3', lastStep: 'CLAIMED', completedActivities: [], activatedAt: null, coreCompletedAt: null, ...p } }
}

beforeEach(() => {
  for (const m of [apiGet, getMyLearningProfile, trackEvent]) m.mockReset()
  getMyLearningProfile.mockResolvedValue({ currentLevel: 'A0' })
})

describe('StarterChecklist — W10', () => {
  it('A0 có 1/3 việc xong: Ngày 1 gạch bỏ, hai mục còn lại là link đúng đích', async () => {
    apiGet.mockResolvedValue(progress({ completedActivities: ['FIRST_LESSON:BEGINNER_SESSION'], activatedAt: new Date().toISOString() }))

    render(<StarterChecklist />)

    await waitFor(() => expect(screen.getByTestId('starter-checklist')).toBeTruthy())
    expect(screen.getByTestId('starter-progress').textContent).toBe(`${NS}.progress:{"done":1,"total":3}`)
    expect(screen.getByTestId('starter-item-first_lesson').getAttribute('data-done')).toBe('true')
    const roadmap = screen.getByTestId('starter-item-roadmap_node').querySelector('a')
    expect(roadmap?.getAttribute('href')).toBe('/v2/student/roadmap')
    const mock = screen.getByTestId('starter-item-mock_exam').querySelector('a')
    expect(mock?.getAttribute('href')).toBe('/v2/onboarding/mock-exam')
    expect(screen.queryByTestId('starter-item-placement')).toBeNull()
  })

  it('A1+ bỏ qua Chọn đường: mục đầu là Kiểm tra đầu vào trỏ ?placement=1 (AC-ONB-15)', async () => {
    getMyLearningProfile.mockResolvedValue({ currentLevel: 'B1' })
    apiGet.mockResolvedValue(progress({}))

    render(<StarterChecklist />)

    await waitFor(() => expect(screen.getByTestId('starter-item-placement')).toBeTruthy())
    expect(screen.getByTestId('starter-item-placement').querySelector('a')?.getAttribute('href')).toBe('/v2/onboarding?placement=1')
    expect(screen.queryByTestId('starter-item-first_lesson')).toBeNull()
  })

  it('bấm một mục bắn onboarding_starter_item_clicked{key}', async () => {
    apiGet.mockResolvedValue(progress({}))
    render(<StarterChecklist />)
    await waitFor(() => expect(screen.getByTestId('starter-item-mock_exam')).toBeTruthy())

    screen.getByTestId('starter-item-mock_exam').querySelector('a')!.click()

    expect(trackEvent).toHaveBeenCalledWith('onboarding_starter_item_clicked', { key: 'mock_exam' })
  })

  it('không có hàng progress (tài khoản cũ) ⇒ không render gì', async () => {
    apiGet.mockResolvedValue({ data: { flowVersion: 'onb_v3', lastStep: 'INTRO', completedActivities: [], activatedAt: null, coreCompletedAt: null } })
    const { container } = render(<StarterChecklist />)
    await waitFor(() => expect(apiGet).toHaveBeenCalledWith('/onboarding/progress'))
    await waitFor(() => expect(container.innerHTML).toBe(''))
  })

  it('/onboarding/progress lỗi ⇒ không render gì (không đoán)', async () => {
    apiGet.mockRejectedValue(new Error('502'))
    const { container } = render(<StarterChecklist />)
    await waitFor(() => expect(apiGet).toHaveBeenCalled())
    await waitFor(() => expect(container.innerHTML).toBe(''))
  })

  it('hồ sơ lỗi nhưng progress có ⇒ vẫn hiện, trình độ coi như A0', async () => {
    getMyLearningProfile.mockRejectedValue(new Error('404'))
    apiGet.mockResolvedValue(progress({}))
    render(<StarterChecklist />)
    await waitFor(() => expect(screen.getByTestId('starter-item-first_lesson')).toBeTruthy())
  })

  it('đủ ba việc ⇒ tự ẩn', async () => {
    apiGet.mockResolvedValue(progress({
      completedActivities: ['FIRST_LESSON:BEGINNER_SESSION', 'FIRST_LESSON:ROADMAP_NODE', 'FIRST_LESSON:MOCK_EXAM'],
      activatedAt: new Date().toISOString(),
    }))
    const { container } = render(<StarterChecklist />)
    await waitFor(() => expect(apiGet).toHaveBeenCalled())
    await waitFor(() => expect(container.innerHTML).toBe(''))
  })
})
