import { create } from 'zustand'

export type AuthRecoveryState = 'idle' | 'needs_reauth'

type AuthRecoveryStore = {
  state: AuthRecoveryState
  message: string | null
  setNeedsReauth: (message?: string | null) => void
  resolve: () => void
  reset: () => void
}

export const useAuthRecoveryStore = create<AuthRecoveryStore>((set) => ({
  state: 'idle',
  message: null,
  setNeedsReauth: (message = null) => set({ state: 'needs_reauth', message }),
  resolve: () => set({ state: 'idle', message: null }),
  reset: () => set({ state: 'idle', message: null }),
}))
