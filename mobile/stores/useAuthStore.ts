import { create } from 'zustand'
import api from '@/lib/api'
import { setTokens, clearTokens, getRoleFromToken } from '@/lib/auth'

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
  },

  logout: async () => {
    try { await api.post('/auth/logout') } catch {}
    await clearTokens()
    set({ user: null, isLoggedIn: false })
  },

  fetchMe: async () => {
    try {
      const res = await api.get<AuthUser>('/auth/me')
      set({ user: res.data, isLoggedIn: true, isLoading: false })
    } catch {
      set({ user: null, isLoggedIn: false, isLoading: false })
    }
  },

  setUser: (user) => set({ user, isLoggedIn: !!user }),
}))
