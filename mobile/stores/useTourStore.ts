import { create } from 'zustand'
import * as SecureStore from 'expo-secure-store'

// One-time onboarding-moment flags, persisted per device in SecureStore (same
// store the theme preference uses). Onboarding v1 replaced the single card-tour
// key with a per-flag map: the spotlight home tour, the contextual coach marks
// and the post-signup "first sentence" moment each fire exactly once.
//
// Migration: the legacy `df_guide_tour_done` key (old bottom-sheet card tour)
// counts as the `home` tour being done, so existing users don't get re-toured.

const LEGACY_KEY = 'df_guide_tour_done'

export type TourFlagId = 'home' | 'srs_intro' | 'speaking_intro' | 'first_sentence'

export const TOUR_FLAG_IDS: readonly TourFlagId[] = [
  'home',
  'srs_intro',
  'speaking_intro',
  'first_sentence',
] as const

const keyFor = (id: TourFlagId) => `df_tour_${id}_done`

const NONE_DONE: Record<TourFlagId, boolean> = {
  home: false,
  srs_intro: false,
  speaking_intro: false,
  first_sentence: false,
}

interface TourState {
  hydrated: boolean
  done: Record<TourFlagId, boolean>
  /** Read persisted flags once per app run (subsequent calls no-op). */
  hydrate: () => Promise<void>
  isDone: (id: TourFlagId) => boolean
  /** Persist a flag and update state. Best-effort — storage failure only means re-showing later. */
  markDone: (id: TourFlagId) => Promise<void>
}

export const useTourStore = create<TourState>((set, get) => ({
  hydrated: false,
  done: { ...NONE_DONE },

  hydrate: async () => {
    if (get().hydrated) return
    try {
      const [legacy, ...flags] = await Promise.all([
        SecureStore.getItemAsync(LEGACY_KEY),
        ...TOUR_FLAG_IDS.map((id) => SecureStore.getItemAsync(keyFor(id))),
      ])
      const done = { ...NONE_DONE }
      TOUR_FLAG_IDS.forEach((id, i) => {
        done[id] = flags[i] === '1'
      })
      if (legacy === '1') done.home = true
      set({ hydrated: true, done })
    } catch {
      // Storage unavailable — mark hydrated so callers don't wait forever.
      set({ hydrated: true })
    }
  },

  isDone: (id) => get().done[id],

  markDone: async (id) => {
    set((s) => ({ done: { ...s.done, [id]: true } }))
    try {
      await SecureStore.setItemAsync(keyFor(id), '1')
    } catch {
      /* best-effort persistence */
    }
  },
}))
