import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * W10 — checklist tuần đầu trên dashboard (Đợt 4 PR-3, 19/09/2026).
 * Trạng thái đọc từ server; component tự ẩn khi không có gì để nói.
 */

const apiGet = vi.fn()
const getMyLearningProfile = vi.fn()
const updateProfile = vi.fn()
const trackEvent = vi.fn()

vi.mock('@/lib/api', () => ({ default: { get: (...a: unknown[]) => apiGet(...a) } }))
vi.mock('@/lib/profileApi', () => ({
  getMyLearningProfile: () => getMyLearningProfile(),
  updateProfile: (p: unknown) => updateProfile(p),
}))
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

/** apiGet trả progress cho /onboarding/progress và hồ sơ cá nhân cho /profile/me. */
function mockApi(progressResp: unknown, me: unknown = { data: { reminderHourLocal: null } }) {
  apiGet.mockImplementation((url: string) => {
    if (url === '/profile/me') return Promise.resolve(me)
    return progressResp instanceof Error ? Promise.reject(progressResp) : Promise.resolve(progressResp)
  })
}

beforeEach(() => {
  for (const m of [apiGet, getMyLearningProfile, updateProfile, trackEvent]) m.mockReset()
  getMyLearningProfile.mockResolvedValue({ currentLevel: 'A0' })
  updateProfile.mockResolvedValue({})
})

describe('StarterChecklist — W10', () => {
  it('A0 có 1/4 việc xong: Ngày 1 gạch bỏ, hai mục link đúng đích, mục giờ nhắc có ô chọn', async () => {
    mockApi(progress({ completedActivities: ['FIRST_LESSON:BEGINNER_SESSION'], activatedAt: new Date().toISOString() }))

    render(<StarterChecklist />)

    await waitFor(() => expect(screen.getByTestId('starter-checklist')).toBeTruthy())
    expect(screen.getByTestId('starter-progress').textContent).toBe(`${NS}.progress:{"done":1,"total":4}`)
    expect(screen.getByTestId('starter-reminder-hour')).toBeTruthy()
    expect(screen.getByTestId('starter-item-first_lesson').getAttribute('data-done')).toBe('true')
    const roadmap = screen.getByTestId('starter-item-roadmap_node').querySelector('a')
    expect(roadmap?.getAttribute('href')).toBe('/v2/student/roadmap')
    const mock = screen.getByTestId('starter-item-mock_exam').querySelector('a')
    expect(mock?.getAttribute('href')).toBe('/v2/onboarding/mock-exam')
    expect(screen.queryByTestId('starter-item-placement')).toBeNull()
  })

  it('A1+ bỏ qua Chọn đường: mục đầu là Kiểm tra đầu vào trỏ ?placement=1 (AC-ONB-15)', async () => {
    getMyLearningProfile.mockResolvedValue({ currentLevel: 'B1' })
    mockApi(progress({}))

    render(<StarterChecklist />)

    await waitFor(() => expect(screen.getByTestId('starter-item-placement')).toBeTruthy())
    expect(screen.getByTestId('starter-item-placement').querySelector('a')?.getAttribute('href')).toBe('/v2/onboarding?placement=1')
    expect(screen.queryByTestId('starter-item-first_lesson')).toBeNull()
  })

  it('bấm một mục bắn onboarding_starter_item_clicked{key}', async () => {
    mockApi(progress({}))
    render(<StarterChecklist />)
    await waitFor(() => expect(screen.getByTestId('starter-item-mock_exam')).toBeTruthy())

    screen.getByTestId('starter-item-mock_exam').querySelector('a')!.click()

    expect(trackEvent).toHaveBeenCalledWith('onboarding_starter_item_clicked', { key: 'mock_exam' })
  })

  it('không có hàng progress (tài khoản cũ) ⇒ không render gì', async () => {
    mockApi({ data: { flowVersion: 'onb_v3', lastStep: 'INTRO', completedActivities: [], activatedAt: null, coreCompletedAt: null } })
    const { container } = render(<StarterChecklist />)
    await waitFor(() => expect(apiGet).toHaveBeenCalledWith('/onboarding/progress'))
    await waitFor(() => expect(container.innerHTML).toBe(''))
  })

  it('/onboarding/progress lỗi ⇒ không render gì (không đoán)', async () => {
    mockApi(new Error('502'))
    const { container } = render(<StarterChecklist />)
    await waitFor(() => expect(apiGet).toHaveBeenCalled())
    await waitFor(() => expect(container.innerHTML).toBe(''))
  })

  it('hồ sơ lỗi nhưng progress có ⇒ vẫn hiện, trình độ coi như A0', async () => {
    getMyLearningProfile.mockRejectedValue(new Error('404'))
    mockApi(progress({}))
    render(<StarterChecklist />)
    await waitFor(() => expect(screen.getByTestId('starter-item-first_lesson')).toBeTruthy())
  })

  it('đủ ba bài + đã đặt giờ nhắc ⇒ tự ẩn', async () => {
    mockApi(progress({
      completedActivities: ['FIRST_LESSON:BEGINNER_SESSION', 'FIRST_LESSON:ROADMAP_NODE', 'FIRST_LESSON:MOCK_EXAM'],
      activatedAt: new Date().toISOString(),
    }), { data: { reminderHourLocal: 20 } })
    const { container } = render(<StarterChecklist />)
    await waitFor(() => expect(apiGet).toHaveBeenCalled())
    await waitFor(() => expect(container.innerHTML).toBe(''))
  })

  it('W11: chọn giờ + Lưu → PATCH /profile/me {reminderHourLocal}, mục chuyển sang đã xong với giờ, bắn event', async () => {
    mockApi(progress({}))
    render(<StarterChecklist />)
    await waitFor(() => expect(screen.getByTestId('starter-reminder-hour')).toBeTruthy())

    const select = screen.getByTestId('starter-reminder-hour') as HTMLSelectElement
    expect(select.value).toBe('20')
    select.value = '21'
    select.dispatchEvent(new Event('change', { bubbles: true }))
    screen.getByTestId('starter-reminder-save').click()

    await waitFor(() => expect(updateProfile).toHaveBeenCalledWith({ reminderHourLocal: 21 }))
    await waitFor(() => expect(screen.getByTestId('starter-item-reminder').getAttribute('data-done')).toBe('true'))
    expect(screen.getByText(`${NS}.reminderHour:{"hour":"21"}`)).toBeTruthy()
    expect(trackEvent).toHaveBeenCalledWith('onboarding_reminder_hour_set', { hour: 21, surface: 'starter_checklist' })
    expect(screen.getByTestId('starter-progress').textContent).toBe(`${NS}.progress:{"done":1,"total":4}`)
  })

  it('W11: giờ đã đặt từ trước ⇒ mục tích sẵn, không có ô chọn', async () => {
    mockApi(progress({}), { data: { reminderHourLocal: 7 } })
    render(<StarterChecklist />)
    await waitFor(() => expect(screen.getByTestId('starter-item-reminder')).toBeTruthy())
    expect(screen.getByTestId('starter-item-reminder').getAttribute('data-done')).toBe('true')
    expect(screen.queryByTestId('starter-reminder-hour')).toBeNull()
    expect(screen.getByText(`${NS}.reminderHour:{"hour":"07"}`)).toBeTruthy()
  })

  it('W11: PATCH lỗi ⇒ báo lỗi, mục vẫn chưa xong', async () => {
    mockApi(progress({}))
    updateProfile.mockRejectedValue(new Error('500'))
    render(<StarterChecklist />)
    await waitFor(() => expect(screen.getByTestId('starter-reminder-save')).toBeTruthy())
    screen.getByTestId('starter-reminder-save').click()
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
    expect(screen.getByTestId('starter-item-reminder').getAttribute('data-done')).toBe('false')
  })
})
