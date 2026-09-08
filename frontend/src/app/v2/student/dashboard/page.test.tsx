import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * V-12b — chuỗi ngày học trên màn Heute.
 *
 * Trước đợt này màn đọc `today.progress.streakDays`, mà `TodayPlanDto` của backend không có trường
 * `progress` nào (record chỉ gồm dueRepairTasks + 3 recommended*). `streakDays` vì thế luôn
 * `undefined` và ngọn lửa chưa bao giờ hiện. Nguồn THẬT là `/student/dashboard.streakDays`.
 */

const apiGet = vi.fn()
const todayGetMe = vi.fn()
const phaseGetCurrent = vi.fn()
const xpGetMyXp = vi.fn()

vi.mock('@/lib/api', () => ({ default: { get: (...a: unknown[]) => apiGet(...a) } }))
vi.mock('@/lib/todayApi', () => ({ todayApi: { getMe: () => todayGetMe() } }))
vi.mock('@/lib/phaseApi', () => ({ phaseApi: { getCurrent: () => phaseGetCurrent() } }))
vi.mock('@/lib/xpApi', () => ({ xpApi: { getMyXp: () => xpGetMyXp() } }))
vi.mock('@/stores/useUserStore', () => ({ useUserStore: () => 'Cự' }))
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}))
// Translator phải ỔN ĐỊNH theo namespace: `load` của màn này phụ thuộc `t`, nên nếu mock trả hàm
// mới mỗi lần render thì useCallback đổi định danh và effect chạy vô hạn (test treo, không đỏ).
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

import V2StudentDashboardPage from '@/app/v2/student/dashboard/page'

beforeEach(() => {
  for (const m of [apiGet, todayGetMe, phaseGetCurrent, xpGetMyXp]) m.mockReset()
  apiGet.mockImplementation((url: string) =>
    url === '/student/dashboard' ? Promise.resolve({ data: { streakDays: 5 } }) : Promise.resolve({ data: [] }),
  )
  todayGetMe.mockResolvedValue({ data: { dueRepairTasks: [], recommendedSpeaking: null, recommendedVocabPractice: null } })
  phaseGetCurrent.mockResolvedValue({ data: { sessionsCompleted: 3 } })
  xpGetMyXp.mockRejectedValue(new Error('không cần cho ca này'))
})

describe('Heute — chuỗi ngày học (V-12b)', () => {
  it('lấy streak từ /student/dashboard, không từ /today/me', async () => {
    render(<V2StudentDashboardPage />)

    await waitFor(() => expect(apiGet).toHaveBeenCalledWith('/student/dashboard'))
    await waitFor(() => expect(screen.getByText('5')).toBeTruthy())
    expect(screen.getByText('v2.student.dashboard.habit.streak')).toBeTruthy()
  })

  it('/student/dashboard chết ⇒ KHÔNG vẽ "0 ngày liên tiếp"', async () => {
    apiGet.mockImplementation((url: string) =>
      url === '/student/dashboard' ? Promise.reject(new Error('502')) : Promise.resolve({ data: [] }),
    )

    render(<V2StudentDashboardPage />)

    await waitFor(() => expect(apiGet).toHaveBeenCalledWith('/student/dashboard'))
    await waitFor(() => expect(screen.queryByText('v2.student.dashboard.loading')).toBeNull())
    expect(screen.queryByText('v2.student.dashboard.habit.streak')).toBeNull()
  })

  it('việc "sửa lỗi hay gặp" — mã chết dựng trên progress — đã gỡ', async () => {
    render(<V2StudentDashboardPage />)

    await waitFor(() => expect(screen.getByText('v2.student.dashboard.habit.streak')).toBeTruthy())
    expect(screen.queryByText('v2.student.dashboard.today.repair')).toBeNull()
  })
})
