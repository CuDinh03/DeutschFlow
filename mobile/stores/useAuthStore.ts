import { create } from 'zustand'
import api from '@/lib/api'
import { setTokens, clearTokens, getRoleFromToken } from '@/lib/auth'
import { identifyUser, resetAnalytics } from '@/lib/analytics'
import { useTourStore } from './useTourStore'
import { useStarterStore } from './useStarterStore'
import { clearDailyGoalMinutes } from '@/lib/dailyGoal'
import { clearOnboardingDraft } from '@/lib/onboardingDraft'

export type UserRole = 'STUDENT' | 'TEACHER' | 'ADMIN'

export interface AuthUser {
  id: number
  displayName: string
  email: string
  role: UserRole
}

interface AuthState {
  user: AuthUser | null
  isLoggedIn: boolean
  isLoading: boolean

  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  fetchMe: () => Promise<void>
  setUser: (user: AuthUser | null) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoggedIn: false,
  isLoading: true,

  login: async (email, password) => {
    const res = await api.post<{
      accessToken: string
      refreshToken: string
      role: string
    }>('/auth/login', { email, password })

    const { accessToken, refreshToken, role } = res.data

    // Only allow STUDENT role on mobile
    if (role?.toUpperCase() !== 'STUDENT') {
      throw new Error('NON_STUDENT_ROLE')
    }

    await setTokens(accessToken, refreshToken)
    const meRes = await api.get<AuthUser>('/auth/me')
    set({ user: meRes.data, isLoggedIn: true })
    identifyUser(meRes.data.id, { role: meRes.data.role })
  },

  logout: async () => {
    try { await api.post('/auth/logout') } catch {}
    await clearTokens()
    // Cờ onboarding/tour/checklist lưu per-THIẾT BỊ, không per-tài khoản. Không dọn
    // ở đây thì tài khoản kế tiếp đăng nhập trên cùng máy thừa hưởng trạng thái của
    // người trước: mất spotlight tour, checklist tuần đầu có thể đã dismissed, và
    // copy bước streak đọc mục tiêu phút/ngày của người khác (QA 2026-08-20, F-4).
    // Cố ý KHÔNG đụng df_ai_consent_v1 — consent chia sẻ dữ liệu với AI là quyết
    // định ở mức thiết bị, có màn riêng trong Hồ sơ để thu hồi.
    await Promise.all([
      useTourStore.getState().reset(),
      useStarterStore.getState().reset(),
      clearDailyGoalMinutes(),
      clearOnboardingDraft(),
    ])
    set({ user: null, isLoggedIn: false })
    resetAnalytics()
  },

  fetchMe: async () => {
    try {
      const res = await api.get<AuthUser>('/auth/me')
      set({ user: res.data, isLoggedIn: true, isLoading: false })
      identifyUser(res.data.id, { role: res.data.role })
    } catch {
      set({ user: null, isLoggedIn: false, isLoading: false })
    }
  },

  setUser: (user) => set({ user, isLoggedIn: !!user }),
}))
