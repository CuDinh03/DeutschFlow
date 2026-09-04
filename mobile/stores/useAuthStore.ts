import { create } from 'zustand'
import api from '@/lib/api'
import { setTokens, clearTokens, getRefreshToken, getRoleFromToken } from '@/lib/auth'
import { identifyUser, resetAnalytics } from '@/lib/analytics'
import { clearDeviceSessionState } from '@/lib/deviceSessionState'
import { runCleanupBestEffort } from '@/lib/bestEffort'

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
    // Best-effort: server call hỏng (mất mạng…) vẫn phải đăng xuất LOCAL được —
    // backend tự gỡ push token ở /auth/logout, nhưng giữ người dùng lại chỉ vì
    // call đó lỗi thì tệ hơn. (Q-9 soát 02/09: catch rỗng là có chủ đích.)
    try { await api.post('/auth/logout') } catch {}
    await clearTokens()
    // Cờ onboarding/tour/checklist và lịch nhắc 20:00 lưu per-THIẾT BỊ, không
    // per-tài khoản. Danh sách dọn nằm ở lib/deviceSessionState.ts vì interceptor
    // 401 trong lib/api.ts cũng phải chạy đúng danh sách đó — xem lý do ở file ấy.
    // Dọn là best-effort; kết thúc phiên thì không. Hỏng HAY treo đều không được
    // chặn hai dòng dưới, kẻo người dùng kẹt "đã đăng nhập" với token vừa bị xoá.
    await runCleanupBestEffort(clearDeviceSessionState)
    set({ user: null, isLoggedIn: false })
    resetAnalytics()
  },

  fetchMe: async () => {
    try {
      const res = await api.get<AuthUser>('/auth/me')
      set({ user: res.data, isLoggedIn: true, isLoading: false })
      identifyUser(res.data.id, { role: res.data.role })
    } catch {
      // MB-06 (owner tái hiện 03/09, cùng triết lý M2 #479): mở app lúc OFFLINE mà trong máy
      // vẫn còn refresh token → coi là CÒN PHIÊN, vào app (user tạm null — mọi màn đọc user
      // đều `user?.`; các query tự hiện lỗi tải + retry của chúng). Trước đây catch nào cũng
      // logged-out → login wall lúc offline, mà offline thì login cũng không nổi: cụt đường,
      // trong khi token còn nguyên (có mạng lại là vào thẳng — bằng chứng bị đá oan).
      //
      // Vì sao KHÔNG giữ nhầm phiên đã chết: phiên bị từ chối THẬT thì interceptor 401
      // (lib/api.ts) đã clearTokens + setUser(null) + đá về login TRƯỚC khi reject — tới
      // đây getRefreshToken() đã là null nên rơi đúng nhánh logged-out bên dưới.
      if (await getRefreshToken()) {
        set({ isLoggedIn: true, isLoading: false })
        return
      }
      set({ user: null, isLoggedIn: false, isLoading: false })
    }
  },

  setUser: (user) => set({ user, isLoggedIn: !!user }),
}))
