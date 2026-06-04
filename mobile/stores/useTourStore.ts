import { create } from 'zustand'
import * as SecureStore from 'expo-secure-store'

// One-time new-user tour state. Completion is persisted in SecureStore (same
// store the theme preference uses) so the tour shows exactly once per device.
const STORAGE_KEY = 'df_guide_tour_done'

interface TourState {
  visible: boolean
  hydrated: boolean
  /** Read persisted state once; auto-open for first-time users. */
  hydrate: () => Promise<void>
  /** Open the tour on demand (e.g. "replay" from the guide screen). */
  show: () => void
  /** Close without persisting — prefer {@link complete}. */
  hide: () => void
  /** Persist completion and close. */
  complete: () => Promise<void>
}

export const useTourStore = create<TourState>((set, get) => ({
  visible: false,
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return
    try {
      const done = await SecureStore.getItemAsync(STORAGE_KEY)
      set({ hydrated: true, visible: done !== '1' })
    } catch {
      // Storage unavailable — mark hydrated so we don't auto-show on every mount.
      set({ hydrated: true })
    }
  },

  show: () => set({ visible: true }),
  hide: () => set({ visible: false }),

  complete: async () => {
    set({ visible: false })
    try {
      await SecureStore.setItemAsync(STORAGE_KEY, '1')
    } catch {
      /* best-effort persistence */
    }
  },
}))
